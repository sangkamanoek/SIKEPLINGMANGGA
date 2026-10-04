import { SuratKedinasanItem, JenisSuratKedinasan } from '../types';
import { db } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const SURAT_STORAGE_KEY = 'si_mangga_surat_kedinasan_list_v2';
export const SURAT_COLLECTION = 'surat_kedinasan';
export const SURAT_CHANNEL = 'si_mangga_surat_channel';

// Helper to identify generated dummy sample surat items
export const isDummySurat = (item: Partial<SuratKedinasanItem> | null | undefined): boolean => {
  if (!item) return false;
  const idStr = String(item.id || '');
  return /^surat_[1-9]$/.test(idStr);
};

// Initial surat list is strictly empty for real official correspondence
export const INITIAL_SURAT_LIST: SuratKedinasanItem[] = [];

let memorySurat: SuratKedinasanItem[] = [];

export const getLocalSuratList = (): SuratKedinasanItem[] => {
  if (memorySurat.length > 0) {
    return memorySurat.filter((x) => !isDummySurat(x));
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('si_mangga_surat_kedinasan_list');
    }
  } catch {}

  const stored = safeGetLocalStorage<SuratKedinasanItem[]>(SURAT_STORAGE_KEY, []);
  if (stored && Array.isArray(stored)) {
    const cleaned = stored.filter((x) => !isDummySurat(x));
    memorySurat = cleaned;
    if (cleaned.length !== stored.length) {
      safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  }
  memorySurat = [];
  return [];
};

export const setLocalSuratList = (items: SuratKedinasanItem[]): void => {
  const cleaned = items.filter((x) => !isDummySurat(x));
  memorySurat = cleaned;
  safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(cleaned));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.postMessage({ type: 'SYNC_SURAT', items: cleaned });
      bc.close();
    }
  } catch (e) {
    console.warn(e);
  }
};

export async function fetchSuratFromServer(): Promise<SuratKedinasanItem[]> {
  if (!db) return getLocalSuratList();
  try {
    const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
    const snap = await getDocs(q);
    const items: SuratKedinasanItem[] = [];
    const dummyIdsToDelete: string[] = [];
    snap.forEach((d) => {
      const itm = d.data() as SuratKedinasanItem;
      if (isDummySurat(itm)) {
        dummyIdsToDelete.push(d.id);
      } else {
        items.push(itm);
      }
    });

    if (dummyIdsToDelete.length > 0) {
      for (const dId of dummyIdsToDelete) {
        deleteDoc(doc(db, SURAT_COLLECTION, dId)).catch(() => {});
      }
    }

    memorySurat = items;
    safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
    return items;
  } catch (err) {
    console.warn('Failed fetching surat from server:', err);
  }
  return getLocalSuratList();
}

export async function saveSuratItem(item: SuratKedinasanItem): Promise<void> {
  const current = getLocalSuratList();
  const existsIndex = current.findIndex((x) => x.id === item.id);
  const updated = existsIndex >= 0
    ? current.map((x) => (x.id === item.id ? item : x))
    : [item, ...current];

  setLocalSuratList(updated);

  if (db) {
    try {
      await setDoc(doc(db, SURAT_COLLECTION, item.id), item);
    } catch (err) {
      console.warn('Failed saving surat to Firestore:', err);
    }
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('si-mangga-surat-updated', { detail: item }));
    }
  } catch {}
}

export async function deleteSuratItem(id: string): Promise<void> {
  const current = getLocalSuratList();
  const updated = current.filter((x) => x.id !== id);
  setLocalSuratList(updated);

  if (db) {
    try {
      await deleteDoc(doc(db, SURAT_COLLECTION, id));
    } catch (err) {
      console.warn('Failed deleting surat from Firestore:', err);
    }
  }
}

export function subscribeSurat(
  onSuccess: (data: SuratKedinasanItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const initial = getLocalSuratList();
  if (initial.length > 0) {
    onSuccess(initial);
  }

  fetchSuratFromServer().then((serverItems) => {
    if (serverItems.length > 0) {
      onSuccess(serverItems);
    }
  });

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data && event.data.items) {
          memorySurat = event.data.items;
          onSuccess(event.data.items);
        }
      };
    }
  } catch {}

  const handleCustomEvent = (e: any) => {
    if (e && e.detail) {
      const current = getLocalSuratList();
      onSuccess(current);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('si-mangga-surat-updated', handleCustomEvent);
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const items: SuratKedinasanItem[] = [];
          snapshot.forEach((d) => {
            const itm = d.data() as SuratKedinasanItem;
            if (!isDummySurat(itm)) {
              items.push(itm);
            }
          });
          memorySurat = items;
          safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
          onSuccess(items);
        },
        (err) => {
          console.warn('Firestore snapshot error on surat_kedinasan:', err);
          if (onError) onError(err);
        }
      );
    } catch (e: any) {
      console.warn('Error setting up firestore snapshot on surat_kedinasan:', e);
      if (onError) onError(e);
    }
  }

  return () => {
    if (bc) {
      try { bc.close(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('si-mangga-surat-updated', handleCustomEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}
