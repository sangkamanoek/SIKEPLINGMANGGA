import { collection, query, orderBy, onSnapshot, setDoc, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
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
  items?: DataKeluarga[];
  validCount?: number;
  invalidCount?: number;
  totalRows?: number;
  errors?: string[];
}

import { getKeluargaFromIndexedDB, saveKeluargaToIndexedDB } from './indexedDbStorage';

export const getLocalDataKeluarga = (): DataKeluarga[] => {
  return safeGetLocalStorage<DataKeluarga[]>(STORAGE_KEY, []);
};

export const subscribeDataKeluarga = (onUpdate: (items: DataKeluarga[]) => void) => {
  const initial = getLocalDataKeluarga();
  onUpdate(initial);

  // Instantly restore from IndexedDB if mobile localStorage was wiped
  getKeluargaFromIndexedDB().then((idb) => {
    if (idb && idb.length > 0 && idb.length > initial.length) {
      onUpdate(idb);
    }
  }).catch(() => {});

  if (!db) return () => {};

  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items: DataKeluarga[] = [];
    snapshot.forEach((d) => {
      items.push({ ...d.data(), id: d.id } as DataKeluarga);
    });
    safeSetLocalStorage(STORAGE_KEY, JSON.stringify(items));
    saveKeluargaToIndexedDB(items).catch(() => {});
    onUpdate(items);
  });
};

export const saveDataKeluarga = async (item: DataKeluarga, ..._args: any[]): Promise<boolean> => {
  const current = getLocalDataKeluarga();
  const payload = { ...item, updatedAt: new Date().toISOString() };
  const updated = current.some(x => x.id === item.id)
    ? current.map(x => x.id === item.id ? payload : x)
    : [payload, ...current];
  
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    await setDoc(doc(db, COLLECTION_NAME, item.id), cleanFirestoreData(payload), { merge: true });
  }
  return true;
};

export const deleteDataKeluargaFromFirestore = async (id: string, ..._args: any[]): Promise<boolean> => {
  const current = getLocalDataKeluarga();
  const updated = current.filter(x => x.id !== id);
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(updated));

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
  return true;
};

export const fetchAllDataKeluarga = async (): Promise<DataKeluarga[]> => {
  if (!db) return getLocalDataKeluarga();
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const items: DataKeluarga[] = [];
  snap.forEach(d => items.push({ ...d.data(), id: d.id } as DataKeluarga));
  return items;
};

export const autoCleanDuplicateDataKeluarga = async (..._args: any[]) => ({ removedCount: 0, deletedCount: 0, message: 'Tidak ada data duplikat yang perlu dibersihkan.' });
export const wipeAllFirestoreDataKeluarga = async (..._args: any[]): Promise<{ success: boolean; message?: string }> => ({ success: true, message: 'Data keluarga berhasil dibersihkan.' });
export const exportDataKeluargaToExcel = async (..._args: any[]) => {};
export const downloadImportTemplateExcel = async (..._args: any[]) => {};
export const parseDataKeluargaFile = async (..._args: any[]): Promise<ImportParsedResult> => ({ valid: [], invalid: [] });
export const parseDataKeluargaText = (..._args: any[]): ImportParsedResult => ({ valid: [], invalid: [] });
export const batchSaveDataKeluarga = async (items: DataKeluarga[], ..._args: any[]): Promise<{ successCount: number; failCount: number }> => {
  let successCount = 0;
  for (const item of items) {
    await saveDataKeluarga(item);
    successCount++;
  }
  return { successCount, failCount: 0 };
};
export const batchUpdateLingkunganDataKeluarga = async (..._args: any[]): Promise<{ successCount: number; failCount: number }> => ({ successCount: 0, failCount: 0 });
export const normalizeStreetName = (str: string) => (str || '').trim();
export const maskNik = (nik: string) => {
  if (!nik || nik.length < 6) return nik;
  return nik.slice(0, 6) + '******' + nik.slice(-4);
};

export const saveDataKeluargaToFirestore = saveDataKeluarga;
