import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
} from 'firebase/firestore';
import { db } from './firebase';
import { PosyanduReport } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

const COLLECTION_NAME = 'pkk_posyandu_reports';
export const POSYANDU_STORAGE_KEY = 'sikepling_pkk_posyandu_v1';

export const getLocalPosyanduReports = (): PosyanduReport[] => {
  return safeGetLocalStorage<PosyanduReport[]>(POSYANDU_STORAGE_KEY, []);
};

export const subscribePosyanduReports = (onUpdate: (items: PosyanduReport[]) => void) => {
  const initial = getLocalPosyanduReports();
  onUpdate(initial);

  if (!db) return () => {};

  const q = query(collection(db, COLLECTION_NAME), orderBy('tanggal', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as PosyanduReport[];
    safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(items));
    onUpdate(items);
  });
};

export const savePosyanduReport = async (item: PosyanduReport) => {
  const current = getLocalPosyanduReports();
  const payload = { 
    ...item, 
    updatedAt: new Date().toISOString() 
  };
  const idx = current.findIndex(x => x.id === item.id);
  const updated = idx >= 0 ? current.map(x => x.id === item.id ? payload : x) : [payload, ...current];
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    const docRef = doc(db, COLLECTION_NAME, item.id);
    await setDoc(docRef, payload, { merge: true });
  }
};

export const deletePosyanduReport = async (id: string) => {
  const current = getLocalPosyanduReports();
  const updated = current.filter(x => x.id !== id);
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};

