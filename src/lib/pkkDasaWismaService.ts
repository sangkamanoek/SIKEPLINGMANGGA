import { PkkDasaWismaItem } from '../types';
import { db } from './firebase';
import { collection, onSnapshot, setDoc, deleteDoc, doc, Unsubscribe } from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const PKK_DASA_WISMA_COLLECTION = 'pkk_dasa_wisma';
export const PKK_DASA_WISMA_STORAGE_KEY = 'sikepling_pkk_dasa_wisma_v1';
export const PKK_DASA_WISMA_CHANNEL = 'sikepling_pkk_dasa_wisma_chan';

let memoryDasaWisma: PkkDasaWismaItem[] = [];

export const getLocalDasaWismaList = (): PkkDasaWismaItem[] => {
  const stored = safeGetLocalStorage<PkkDasaWismaItem[]>(PKK_DASA_WISMA_STORAGE_KEY, []);
  if (stored && Array.isArray(stored)) {
    memoryDasaWisma = stored;
    return stored;
  }
  return memoryDasaWisma;
};

export const setLocalDasaWismaList = (items: PkkDasaWismaItem[]): void => {
  memoryDasaWisma = items;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(items));
};

export const saveDasaWisma = async (item: PkkDasaWismaItem): Promise<void> => {
  const current = getLocalDasaWismaList();
  const updated = [item, ...current.filter((x) => x.id !== item.id)];
  setLocalDasaWismaList(updated);

  if (db) {
    await setDoc(doc(db, PKK_DASA_WISMA_COLLECTION, item.id), item, { merge: true });
  }
};

export const deleteDasaWisma = async (id: string): Promise<void> => {
  const current = getLocalDasaWismaList();
  const updated = current.filter((x) => x.id !== id);
  setLocalDasaWismaList(updated);

  if (db) {
    await deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, id));
  }
};
