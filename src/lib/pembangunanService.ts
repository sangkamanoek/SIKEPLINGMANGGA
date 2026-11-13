import { RealisasiPembangunan } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import {
  collection,
  onSnapshot,
  getDocs,
  getDocsFromServer,
} from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';

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
  safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(items), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pembangunan-data-updated'));
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PEMBANGUNAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_PEMBANGUNAN', count: items.length });
      bc.close();
    }
  } catch (e) {}
};

function sortPembangunanDesc(items: RealisasiPembangunan[]): RealisasiPembangunan[] {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
  );
}

export const fetchPembangunanAll = async (): Promise<RealisasiPembangunan[]> => {
  if (!db || isFirestoreQuotaCooldownActive()) return getLocalPembangunanList();

  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const items: RealisasiPembangunan[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
    const sorted = sortPembangunanDesc(items);
    if (sorted.length > 0 || !snap.metadata.fromCache) {
      setLocalPembangunanList(sorted);
      return sorted;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[pembangunanService] Firestore fetch error:', err);
    }
  }
  return getLocalPembangunanList();
};

export const savePembangunanToServer = async (item: RealisasiPembangunan): Promise<RealisasiPembangunan> => {
  const payload = {
    ...item,
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
  };

  // Update local
  const current = getLocalPembangunanList();
  const idx = current.findIndex((p) => p.id === item.id);
  const updatedList = idx >= 0
    ? current.map((p) => (p.id === item.id ? payload : p))
    : [payload, ...current];
  setLocalPembangunanList(updatedList);

  // Update Firestore via resilient write queue
  await resilientSetDoc(PEMBANGUNAN_COLLECTION, item.id, cleanFirestoreData(payload), { merge: true });

  return payload;
};

export const deletePembangunanFromServer = async (id: string): Promise<void> => {
  const current = getLocalPembangunanList();
  const filtered = current.filter((p) => p.id !== id);
  setLocalPembangunanList(filtered);

  await resilientDeleteDoc(PEMBANGUNAN_COLLECTION, id);
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

  if (!db || isFirestoreQuotaCooldownActive()) return () => {};

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        if (!isActive) return;
        const items: RealisasiPembangunan[] = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
        const sorted = sortPembangunanDesc(items);

        if (!snap.metadata.fromCache) {
          receivedServerSnapshot = true;
          setLocalPembangunanList(sorted);
          cb(sorted);
        } else if (sorted.length > 0 && !receivedServerSnapshot) {
          setLocalPembangunanList(sorted);
          cb(sorted);
        }
      },
      (err) => {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try { unsub(); } catch {}
          return;
        }
        console.warn('[pembangunanService] Subscription error, using getDocs fallback:', err);
        if (!isFirestoreQuotaCooldownActive()) {
          fetchPembangunanAll().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchPembangunanAll().then((items) => {
          if (isActive && !receivedServerSnapshot && items.length > 0) {
            cb(items);
          }
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { unsub(); } catch {}
    };
  } catch (e) {
    console.error('Pembangunan subscription failed:', e);
    return () => {};
  }
};

export const subscribeToPembangunan = subscribePembangunan;

