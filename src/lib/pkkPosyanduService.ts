import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
} from 'firebase/firestore';
import { db } from './firebase';
import { PosyanduReport } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  savePosyanduToIndexedDB,
  getPosyanduFromIndexedDB,
  saveSinglePosyanduToIndexedDB,
  deletePosyanduFromIndexedDB,
} from './indexedDbStorage';

const COLLECTION_NAME = 'pkk_posyandu_reports';
export const POSYANDU_STORAGE_KEY = 'sikepling_pkk_posyandu_v1';

export const getLocalPosyanduReports = (): PosyanduReport[] => {
  return safeGetLocalStorage<PosyanduReport[]>(POSYANDU_STORAGE_KEY, []);
};

export const subscribePosyanduReports = (onUpdate: (items: PosyanduReport[]) => void) => {
  const initial = getLocalPosyanduReports();
  onUpdate(initial);

  // Asynchronously hydrate from IndexedDB to restore any photos that may have been stripped by localStorage quota
  getPosyanduFromIndexedDB().then((idbItems) => {
    if (idbItems && idbItems.length > 0) {
      const merged = (initial.length > 0 ? initial : idbItems).map((localItem) => {
        const idbMatch = idbItems.find(x => x.id === localItem.id);
        if (idbMatch && Array.isArray(idbMatch.dokumentasiFoto) && idbMatch.dokumentasiFoto.some(f => f.url && f.url.startsWith('data:'))) {
          const localHasPhotos = Array.isArray(localItem.dokumentasiFoto) && localItem.dokumentasiFoto.some(f => f.url && f.url.length > 50);
          if (!localHasPhotos) {
            return { ...localItem, dokumentasiFoto: idbMatch.dokumentasiFoto };
          }
        }
        return localItem;
      });
      safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(merged));
      onUpdate(merged);
    }
  }).catch((err) => {
    console.warn('[pkkPosyanduService] IndexedDB hydration note:', err);
  });

  if (!db) return () => {};

  const q = collection(db, COLLECTION_NAME);
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as PosyanduReport[];
    items.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    
    // Asynchronously backup to IndexedDB so full photo data is preserved even if localStorage hits quota
    savePosyanduToIndexedDB(items).catch(() => {});
    safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(items));
    onUpdate(items);
  });
};

export const savePosyanduReport = async (item: PosyanduReport) => {
  const current = getLocalPosyanduReports();
  const payload: PosyanduReport = { 
    ...item, 
    updatedAt: new Date().toISOString() 
  };
  const idx = current.findIndex(x => x.id === item.id);
  const updated = idx >= 0 ? current.map(x => x.id === item.id ? payload : x) : [payload, ...current];
  
  // Persist directly to IndexedDB first
  await saveSinglePosyanduToIndexedDB(payload).catch(() => {});
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    const docRef = doc(db, COLLECTION_NAME, item.id);
    await setDoc(docRef, payload, { merge: true });
  }
};

export const deletePosyanduReport = async (id: string) => {
  const current = getLocalPosyanduReports();
  const updated = current.filter(x => x.id !== id);
  await deletePosyanduFromIndexedDB(id).catch(() => {});
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};


