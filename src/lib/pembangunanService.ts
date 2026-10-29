import { RealisasiPembangunan } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { db } from './firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';

export const PEMBANGUNAN_COLLECTION = 'realisasi_pembangunan';
export const PEMBANGUNAN_STORAGE_KEY = 'sikepling_pembangunan_data_v1';
export const PEMBANGUNAN_CHANNEL = 'sikepling_pembangunan_channel';

export const getLocalPembangunanList = (): RealisasiPembangunan[] => {
  const stored = safeGetLocalStorage<RealisasiPembangunan[]>(PEMBANGUNAN_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
};

export const setLocalPembangunanList = (items: RealisasiPembangunan[]): void => {
  safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(items));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PEMBANGUNAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_PEMBANGUNAN', items });
      bc.close();
    }
  } catch (e) {}
};

export const fetchPembangunanAll = async (): Promise<RealisasiPembangunan[]> => {
  if (!db) return getLocalPembangunanList();

  try {
    const q = query(collection(db, PEMBANGUNAN_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const items: RealisasiPembangunan[] = [];
    snap.forEach(d => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
    setLocalPembangunanList(items);
    return items;
  } catch (err) {
    console.warn('[pembangunanService] Firestore fetch error:', err);
    return getLocalPembangunanList();
  }
};

export const savePembangunanToServer = async (item: RealisasiPembangunan): Promise<RealisasiPembangunan> => {
  const payload = { 
    ...item, 
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString()
  };

  // Update local
  const current = getLocalPembangunanList();
  const idx = current.findIndex((p) => p.id === item.id);
  const updatedList = idx >= 0 
    ? current.map(p => p.id === item.id ? payload : p)
    : [payload, ...current];
  setLocalPembangunanList(updatedList);

  // Update Firestore
  if (db) {
    try {
      await setDoc(doc(db, PEMBANGUNAN_COLLECTION, item.id), cleanFirestoreData(payload), { merge: true });
    } catch (err) {
      console.warn('[pembangunanService] Firestore save error:', err);
    }
  }

  return payload;
};

export const deletePembangunanFromServer = async (id: string): Promise<void> => {
  const current = getLocalPembangunanList();
  const filtered = current.filter((p) => p.id !== id);
  setLocalPembangunanList(filtered);

  if (db) {
    try {
      await deleteDoc(doc(db, PEMBANGUNAN_COLLECTION, id));
    } catch (err) {
      console.warn('[pembangunanService] Firestore delete error:', err);
    }
  }
};

export const batchSyncPembangunan = async (items: RealisasiPembangunan[]): Promise<boolean> => {
  if (!Array.isArray(items) || items.length === 0) return true;
  
  for (const item of items) {
    await savePembangunanToServer(item);
  }
  return true;
};

export const subscribePembangunan = (cb: (items: RealisasiPembangunan[]) => void): (() => void) => {
  const initial = getLocalPembangunanList();
  cb(initial);

  if (!db) return () => {};

  try {
    const q = query(collection(db, PEMBANGUNAN_COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: RealisasiPembangunan[] = [];
      snap.forEach(d => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
      setLocalPembangunanList(items);
      cb(items);
    });
    return unsub;
  } catch (e) {
    console.error('Pembangunan subscription failed:', e);
    return () => {};
  }
};

export const subscribeToPembangunan = subscribePembangunan;

