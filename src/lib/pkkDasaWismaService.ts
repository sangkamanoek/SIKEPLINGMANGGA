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

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'DASA_WISMA_UPDATED', item });
      bc.close();
    } catch {}
  }

  if (db) {
    try {
      await setDoc(doc(db, PKK_DASA_WISMA_COLLECTION, item.id), item, { merge: true });
    } catch (e) {
      console.warn('Gagal simpan Dasa Wisma ke Firestore:', e);
    }
  }
};

export const deleteDasaWisma = async (id: string): Promise<void> => {
  const current = getLocalDasaWismaList();
  const updated = current.filter((x) => x.id !== id);
  setLocalDasaWismaList(updated);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'DASA_WISMA_DELETED', id });
      bc.close();
    } catch {}
  }

  if (db) {
    try {
      await deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, id));
    } catch (e) {
      console.warn('Gagal hapus Dasa Wisma di Firestore:', e);
    }
  }
};

export const subscribeDasaWisma = (
  callback: (items: PkkDasaWismaItem[]) => void
): (() => void) => {
  // 1. Initial callback with cached items
  callback(getLocalDasaWismaList());

  // 2. BroadcastChannel listener
  let bc: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.onmessage = () => {
        callback(getLocalDasaWismaList());
      };
    } catch {}
  }

  // 3. Firestore listener
  let unsubFirestore: Unsubscribe | undefined;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, PKK_DASA_WISMA_COLLECTION),
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteItems: PkkDasaWismaItem[] = [];
            snapshot.forEach((d) => {
              remoteItems.push(d.data() as PkkDasaWismaItem);
            });
            remoteItems.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setLocalDasaWismaList(remoteItems);
            callback(remoteItems);
          }
        },
        (err) => {
          console.warn('Firestore Dasa Wisma error, fallback ke memori:', err);
        }
      );
    } catch (e) {
      console.warn('Error subscribing to Dasa Wisma:', e);
    }
  }

  return () => {
    if (bc) {
      bc.close();
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
};
