import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  getDocs,
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

/**
 * Fetch all posyandu reports from Firestore and update local storage & IndexedDB
 */
export const fetchPosyanduReports = async (): Promise<PosyanduReport[]> => {
  if (!db) return getLocalPosyanduReports();
  try {
    const q = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as PosyanduReport[];
    items.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    
    // Merge with any existing local reports that may have pending offline changes
    const local = getLocalPosyanduReports();
    const map = new Map<string, PosyanduReport>();
    local.forEach(item => { if (item && item.id) map.set(item.id, item); });
    items.forEach(item => { if (item && item.id) map.set(item.id, item); });

    const merged = Array.from(map.values());
    merged.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    // Back up fetched data
    savePosyanduToIndexedDB(merged).catch(() => {});
    safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('[pkkPosyanduService] fetchPosyanduReports warning:', err);
    return getLocalPosyanduReports();
  }
};

/**
 * Fetch a single posyandu report directly by document ID (e.g. posyandu_1791883394877)
 */
export const fetchSinglePosyanduReport = async (id: string): Promise<PosyanduReport | null> => {
  if (!id) return null;

  // 1. Check local storage
  const localList = getLocalPosyanduReports();
  const localFound = localList.find(x => x.id === id);
  if (localFound) return localFound;

  // 2. Check IndexedDB
  try {
    const idbList = await getPosyanduFromIndexedDB();
    const idbFound = idbList.find(x => x.id === id);
    if (idbFound) {
      const updated = [idbFound, ...localList.filter(x => x.id !== id)];
      safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));
      return idbFound;
    }
  } catch {}

  // 3. Query Firestore directly by Document Reference
  if (db) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const item = { ...snap.data(), id: snap.id } as PosyanduReport;
        await saveSinglePosyanduToIndexedDB(item).catch(() => {});
        const updated = [item, ...localList.filter(x => x.id !== id)];
        safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));
        return item;
      }
    } catch (e) {
      console.warn(`[pkkPosyanduService] Failed to fetch single doc "${id}":`, e);
    }
  }

  return null;
};

export const subscribePosyanduReports = (onUpdate: (items: PosyanduReport[]) => void) => {
  const initial = getLocalPosyanduReports();
  onUpdate(initial);

  // Asynchronously hydrate from IndexedDB to restore any photos that may have been stripped by localStorage quota
  getPosyanduFromIndexedDB().then((idbItems) => {
    if (idbItems && idbItems.length > 0) {
      const map = new Map<string, PosyanduReport>();
      
      // Seed with IDB items first
      idbItems.forEach((item) => {
        if (item && item.id) map.set(item.id, item);
      });

      // Overlay with current local items
      const current = getLocalPosyanduReports();
      current.forEach((localItem) => {
        if (!localItem || !localItem.id) return;
        const idbMatch = map.get(localItem.id);
        if (idbMatch && Array.isArray(idbMatch.dokumentasiFoto) && idbMatch.dokumentasiFoto.some(f => f.url && f.url.startsWith('data:'))) {
          const localHasPhotos = Array.isArray(localItem.dokumentasiFoto) && localItem.dokumentasiFoto.some(f => f.url && f.url.length > 50);
          map.set(localItem.id, {
            ...idbMatch,
            ...localItem,
            dokumentasiFoto: localHasPhotos ? localItem.dokumentasiFoto : idbMatch.dokumentasiFoto,
          });
        } else {
          map.set(localItem.id, { ...(idbMatch || {}), ...localItem });
        }
      });

      const merged = Array.from(map.values());
      merged.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(merged));
      onUpdate(merged);
    }
  }).catch((err) => {
    console.warn('[pkkPosyanduService] IndexedDB hydration note:', err);
  });

  if (!db) return () => {};

  const q = collection(db, COLLECTION_NAME);
  return onSnapshot(
    q,
    (snapshot) => {
      const serverItems = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PosyanduReport[];

      // Merge server items with any existing local memory items
      const current = getLocalPosyanduReports();
      const map = new Map<string, PosyanduReport>();
      current.forEach(item => { if (item?.id) map.set(item.id, item); });
      serverItems.forEach(item => { if (item?.id) map.set(item.id, item); });

      const items = Array.from(map.values());
      items.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      
      // Asynchronously backup to IndexedDB so full photo data is preserved even if localStorage hits quota
      savePosyanduToIndexedDB(items).catch(() => {});
      safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(items));
      onUpdate(items);
    },
    (error) => {
      console.warn('[pkkPosyanduService] onSnapshot listener warning:', error);
      // Fallback: fetch using getDocs
      fetchPosyanduReports().then((items) => {
        if (items && items.length > 0) onUpdate(items);
      }).catch(() => {});
    }
  );
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



