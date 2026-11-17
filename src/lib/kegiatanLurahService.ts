import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { KegiatanLurahItem } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { cleanFirestoreData } from './firestoreService';
import { resilientDeleteDoc, resilientSetDoc } from './firestoreWriteQueue';

export const KEGIATAN_LURAH_STORAGE_KEY = 'sikepling_kegiatan_lurah_v1';
export const KEGIATAN_LURAH_DELETED_KEY = 'sikepling_kegiatan_lurah_deleted_v1';
export const KEGIATAN_LURAH_COLLECTION = 'kegiatan_lurah';

let deletedKegiatanLurahIdsCache: string[] = safeGetLocalStorage<string[]>(
  KEGIATAN_LURAH_DELETED_KEY,
  []
);

const getDeletedKegiatanLurahIds = (): string[] => {
  if (!Array.isArray(deletedKegiatanLurahIdsCache)) deletedKegiatanLurahIdsCache = [];
  return deletedKegiatanLurahIdsCache;
};

const markKegiatanLurahDeleted = (id: string): void => {
  const current = getDeletedKegiatanLurahIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedKegiatanLurahIdsCache = current;
    safeSetLocalStorage(KEGIATAN_LURAH_DELETED_KEY, JSON.stringify(current.slice(-200)));
  }
};

export const getLocalKegiatanLurahList = (): KegiatanLurahItem[] => {
  const deletedSet = new Set(getDeletedKegiatanLurahIds());
  const local = safeGetLocalStorage<KegiatanLurahItem[]>(KEGIATAN_LURAH_STORAGE_KEY, []);
  return Array.isArray(local)
    ? local.filter((x) => x && x.id && !deletedSet.has(x.id))
    : [];
};

export const saveLocalKegiatanLurahList = (items: KegiatanLurahItem[]): void => {
  safeSetLocalStorage(KEGIATAN_LURAH_STORAGE_KEY, JSON.stringify(items), {
    skipIdbMirror: true,
  });
};

export const fetchKegiatanLurahFromFirestore = async (): Promise<KegiatanLurahItem[]> => {
  const local = getLocalKegiatanLurahList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;

  try {
    const deletedSet = new Set(getDeletedKegiatanLurahIds());
    const q = query(collection(db, KEGIATAN_LURAH_COLLECTION), orderBy('createdAt', 'desc'));
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(q);
    }

    const list: KegiatanLurahItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as KegiatanLurahItem;
      if (data && d.id && !deletedSet.has(d.id)) {
        list.push({ ...data, id: d.id });
      }
    });

    if (list.length > 0 || !snap.metadata.fromCache) {
      saveLocalKegiatanLurahList(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kegiatan-lurah-updated'));
      }
      return list;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('Failed to fetch kegiatan lurah from Firestore, falling back to local:', err);
    }
  }
  return local;
};

export const subscribeKegiatanLurahFromFirestore = (
  cb: (items: KegiatanLurahItem[]) => void
) => {
  const initialLocal = getLocalKegiatanLurahList();
  if (initialLocal.length > 0) {
    cb(initialLocal);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    if (initialLocal.length === 0) cb([]);
    return () => {};
  }

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const q = query(collection(db, KEGIATAN_LURAH_COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isActive) return;
        const deletedSet = new Set(getDeletedKegiatanLurahIds());
        const list: KegiatanLurahItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as KegiatanLurahItem;
          if (data && d.id && !deletedSet.has(d.id)) {
            list.push({ ...data, id: d.id });
          }
        });

        if (!snap.metadata.fromCache) {
          receivedServerSnapshot = true;
          saveLocalKegiatanLurahList(list);
          cb(list);
        } else if (list.length > 0) {
          saveLocalKegiatanLurahList(list);
          cb(list);
        }
      },
      (err) => {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try {
            unsub();
          } catch {}
          return;
        }
        console.warn('Kegiatan lurah snapshot error:', err);
        if (!isFirestoreQuotaCooldownActive()) {
          fetchKegiatanLurahFromFirestore().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchKegiatanLurahFromFirestore().then((items) => {
          if (isActive && !receivedServerSnapshot) {
            cb(items);
          }
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        unsub();
      } catch {}
    };
  } catch (e) {
    console.warn('Failed to subscribe to kegiatan lurah:', e);
    cb(getLocalKegiatanLurahList());
    return () => {};
  }
};

export const saveKegiatanLurahItem = async (item: KegiatanLurahItem): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    const updatedItem: KegiatanLurahItem = {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };

    const local = getLocalKegiatanLurahList();
    const idx = local.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      local[idx] = updatedItem;
    } else {
      local.unshift(updatedItem);
    }
    saveLocalKegiatanLurahList(local);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kegiatan-lurah-updated'));
    }

    if (!item.id) return true;

    const cleaned = cleanFirestoreData(updatedItem);
    const res = await resilientSetDoc(KEGIATAN_LURAH_COLLECTION, item.id, cleaned, {
      merge: true,
    });
    return res.synced || res.queued;
  } catch (err) {
    console.error('Error saving kegiatan lurah:', err);
    return false;
  }
};

export const deleteKegiatanLurahItem = async (id: string): Promise<boolean> => {
  try {
    markKegiatanLurahDeleted(id);
    const local = getLocalKegiatanLurahList();
    const filtered = local.filter((i) => i.id !== id);
    saveLocalKegiatanLurahList(filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kegiatan-lurah-updated'));
    }

    if (!id) return true;

    const res = await resilientDeleteDoc(KEGIATAN_LURAH_COLLECTION, id);
    return res.synced || res.queued;
  } catch (err) {
    console.error('Error deleting kegiatan lurah:', err);
    return false;
  }
};
