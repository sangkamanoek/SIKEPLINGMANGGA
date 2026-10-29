import { collection, query, orderBy, onSnapshot, setDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { DataKeluarga } from '../types';

const COLLECTION_NAME = 'data_keluarga';
const STORAGE_KEY = 'sikepling_data_keluarga_v1';

export interface DeduplicateResult {
  removedCount: number;
}

export interface ImportParsedResult {
  valid: DataKeluarga[];
  invalid: any[];
}

export const getLocalDataKeluarga = (): DataKeluarga[] => {
  return safeGetLocalStorage<DataKeluarga[]>(STORAGE_KEY, []);
};

export const subscribeDataKeluarga = (onUpdate: (items: DataKeluarga[]) => void) => {
  const initial = getLocalDataKeluarga();
  onUpdate(initial);

  if (!db) return () => {};

  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items: DataKeluarga[] = [];
    snapshot.forEach((d) => {
      items.push({ ...d.data(), id: d.id } as DataKeluarga);
    });
    safeSetLocalStorage(STORAGE_KEY, JSON.stringify(items));
    onUpdate(items);
  });
};

export const saveDataKeluarga = async (item: DataKeluarga) => {
  const current = getLocalDataKeluarga();
  const payload = { ...item, updatedAt: new Date().toISOString() };
  const updated = current.some(x => x.id === item.id)
    ? current.map(x => x.id === item.id ? payload : x)
    : [payload, ...current];
  
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    await setDoc(doc(db, COLLECTION_NAME, item.id), cleanFirestoreData(payload), { merge: true });
  }
};

export const deleteDataKeluargaFromFirestore = async (id: string) => {
  const current = getLocalDataKeluarga();
  const updated = current.filter(x => x.id !== id);
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};

export const fetchAllDataKeluarga = async (): Promise<DataKeluarga[]> => {
  if (!db) return getLocalDataKeluarga();
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const items: DataKeluarga[] = [];
  snap.forEach(d => items.push({ ...d.data(), id: d.id } as DataKeluarga));
  return items;
};

export const autoCleanDuplicateDataKeluarga = async () => ({ removedCount: 0 });
export const wipeAllFirestoreDataKeluarga = async () => {};
export const exportDataKeluargaToExcel = async () => {};
export const downloadImportTemplateExcel = async () => {};
export const parseDataKeluargaFile = async (): Promise<ImportParsedResult> => ({ valid: [], invalid: [] });
export const parseDataKeluargaText = (): ImportParsedResult => ({ valid: [], invalid: [] });
export const batchSaveDataKeluarga = async (items: DataKeluarga[]) => {
  for (const item of items) {
    await saveDataKeluarga(item);
  }
};
export const batchUpdateLingkunganDataKeluarga = async () => {};
export const normalizeStreetName = (str: string) => (str || '').trim();
export const maskNik = (nik: string) => {
  if (!nik || nik.length < 6) return nik;
  return nik.slice(0, 6) + '******' + nik.slice(-4);
};

export const saveDataKeluargaToFirestore = saveDataKeluarga;
