import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { getVisitsFromIndexedDB, saveVisitsToIndexedDB } from './indexedDbStorage';

export const KUNJUNGAN_COLLECTION = 'kunjungan_warga';
export const KUNJUNGAN_STORAGE_KEY = 'sikepling_kunjungan_warga_v2';
export const KUNJUNGAN_DELETED_KEY = 'sikepling_kunjungan_deleted_v2';
export const KUNJUNGAN_CHANNEL = 'sikepling_kunjungan_channel';

export interface KunjunganWargaData {
  id: string;
  tanggal: string;
  namaWarga: string;
  nik?: string;
  alamat: string;
  lingkungan: string;
  lingkunganNomor?: number;
  namaKepling: string;
  keplingId?: string;
  perlinsos?: string;
  ikd?: string;
  pbb?: string;
  kategoriBansos?: string;
  statusBansos?: 'Sudah' | 'Belum' | 'Menolak' | 'Layak' | 'Tidak Layak';
  bpjsTk?: 'Aktif' | 'Non-Aktif' | 'Belum Terdaftar' | 'Sudah Daftar (Agen Perisai)' | 'Menolak' | string;
  keterangan?: string;
  telepon?: string;
  fotoUrl?: string;
  fotoDokumentasi?: any;
  createdAt?: string;
  updatedAt?: string;
}

let memoryKunjungan: KunjunganWargaData[] = [];
let deletedKunjunganIdsCache: string[] = safeGetLocalStorage<string[]>(KUNJUNGAN_DELETED_KEY, []);

export const getDeletedKunjunganIds = (): string[] => {
  if (!Array.isArray(deletedKunjunganIdsCache)) deletedKunjunganIdsCache = [];
  return deletedKunjunganIdsCache;
};

export const markKunjunganDeleted = (id: string): void => {
  const current = getDeletedKunjunganIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedKunjunganIdsCache = current;
    safeSetLocalStorage(KUNJUNGAN_DELETED_KEY, JSON.stringify(current));
  }
};

export const getLocalKunjunganList = (): KunjunganWargaData[] => {
  const deletedSet = new Set(getDeletedKunjunganIds());
  const stored = safeGetLocalStorage<KunjunganWargaData[]>(KUNJUNGAN_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    memoryKunjungan = cleaned;
    return cleaned;
  }
  return memoryKunjungan.filter((x) => x && x.id && !deletedSet.has(x.id));
};

function stripKunjunganMediaForBroadcast(items: KunjunganWargaData[]): KunjunganWargaData[] {
  return items.map((it) => {
    if (!it) return it;
    const copy = { ...it };
    if (typeof copy.fotoUrl === 'string' && copy.fotoUrl.startsWith('data:') && copy.fotoUrl.length > 200) {
      copy.fotoUrl = '';
    }
    return copy;
  });
}

export const setLocalKunjunganList = (items: KunjunganWargaData[]): void => {
  const deletedSet = new Set(getDeletedKunjunganIds());
  const cleaned = items.filter((x) => x && x.id && !deletedSet.has(x.id));
  memoryKunjungan = cleaned;
  safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(cleaned), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kunjungan-data-updated'));
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KUNJUNGAN', items: stripKunjunganMediaForBroadcast(cleaned) });
      bc.close();
    }
  } catch (e) {}
};

export const saveKunjunganWargaToFirestore = async (item: KunjunganWargaData): Promise<KunjunganWargaData> => {
  const dataToSave: KunjunganWargaData = {
    ...item,
    id: item.id || `visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Update local state & IndexedDB
  const current = getLocalKunjunganList();
  const idx = current.findIndex((p) => p.id === dataToSave.id);
  let updatedList = [...current];
  if (idx >= 0) {
    updatedList[idx] = dataToSave;
  } else {
    updatedList = [dataToSave, ...updatedList];
  }
  setLocalKunjunganList(updatedList);
  saveVisitsToIndexedDB(updatedList).catch(() => {});

  // 2. Save to Firestore via resilient write queue
  await resilientSetDoc(KUNJUNGAN_COLLECTION, dataToSave.id, cleanFirestoreData(dataToSave), { merge: true });

  // 3. Save to server API buffer
  try {
    await fetch('/api/kunjungan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
    });
  } catch (e) {}

  return dataToSave;
};

export const deleteKunjunganWargaFromFirestore = async (id: string): Promise<void> => {
  markKunjunganDeleted(id);
  const current = getLocalKunjunganList();
  const filtered = current.filter((p) => p.id !== id);
  setLocalKunjunganList(filtered);
  saveVisitsToIndexedDB(filtered).catch(() => {});

  await resilientDeleteDoc(KUNJUNGAN_COLLECTION, id);

  try {
    await fetch(`/api/kunjungan/${id}`, { method: 'DELETE' });
  } catch (e) {}
};

function sortKunjunganDesc(items: KunjunganWargaData[]): KunjunganWargaData[] {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.createdAt || b.tanggal || '').localeCompare(a.updatedAt || a.createdAt || a.tanggal || '')
  );
}

export const fetchKunjunganFromFirestore = async (): Promise<KunjunganWargaData[]> => {
  const local = getLocalKunjunganList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;
  try {
    const colRef = collection(db, KUNJUNGAN_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const deletedSet = new Set(getDeletedKunjunganIds());
    const remoteItems: KunjunganWargaData[] = [];
    snap.forEach((docSnap) => {
      const dat = docSnap.data() as KunjunganWargaData;
      const docId = docSnap.id || dat?.id;
      if (dat && docId && !deletedSet.has(docId)) {
        remoteItems.push({ ...dat, id: docId });
      }
    });
    const sorted = sortKunjunganDesc(remoteItems);
    if (sorted.length > 0 || !snap.metadata.fromCache) {
      setLocalKunjunganList(sorted);
      saveVisitsToIndexedDB(sorted).catch(() => {});
      return sorted;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[kunjunganService] fetchKunjunganFromFirestore warning:', err);
    }
  }
  return local;
};

export const subscribeKunjunganWarga = (cb: (items: KunjunganWargaData[]) => void): (() => void) => {
  let isActive = true;
  let hasLiveFirestore = false;

  // 1. Initial local emit (0ms)
  const initialLocal = getLocalKunjunganList();
  cb(initialLocal);

  // 2. Fast IndexedDB restore (10ms) if live Firestore hasn't arrived yet
  getVisitsFromIndexedDB()
    .then((idb) => {
      if (!isActive || hasLiveFirestore) return;
      if (Array.isArray(idb) && idb.length > initialLocal.length) {
        const deletedSet = new Set(getDeletedKunjunganIds());
        const cleaned = sortKunjunganDesc(idb.filter((x) => x && x.id && !deletedSet.has(x.id)));
        setLocalKunjunganList(cleaned);
        cb(cleaned);
      }
    })
    .catch(() => {});

  // 3. Server API buffer ONLY as cold-start fallback if Firestore hasn't delivered yet
  fetch('/api/kunjungan')
    .then((res) => res.json())
    .then((resData) => {
      if (!isActive || hasLiveFirestore) return;
      if (resData && resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
        const deletedSet = new Set(getDeletedKunjunganIds());
        const serverItems: KunjunganWargaData[] = resData.data.filter(
          (x: any) => x && x.id && !deletedSet.has(x.id)
        );
        const current = getLocalKunjunganList();
        if (current.length === 0 && serverItems.length > 0) {
          const sorted = sortKunjunganDesc(serverItems);
          setLocalKunjunganList(sorted);
          saveVisitsToIndexedDB(sorted).catch(() => {});
          cb(sorted);
        }
      }
    })
    .catch(() => {});

  // 4. Realtime Authoritative Firestore Sync
  let unsub: Unsubscribe | null = null;
  let fallbackTimer: any = null;
  try {
    if (db && !isFirestoreQuotaCooldownActive()) {
      const q = collection(db, KUNJUNGAN_COLLECTION);
      unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!isActive) return;
          const deletedSet = new Set(getDeletedKunjunganIds());
          const remoteItems: KunjunganWargaData[] = [];
          snapshot.forEach((docSnap) => {
            const dat = docSnap.data() as KunjunganWargaData;
            const docId = docSnap.id || dat?.id;
            if (dat && docId && !deletedSet.has(docId)) {
              remoteItems.push({ ...dat, id: docId });
            }
          });

          const sorted = sortKunjunganDesc(remoteItems);
          if (!snapshot.metadata.fromCache) {
            hasLiveFirestore = true;
            setLocalKunjunganList(sorted);
            saveVisitsToIndexedDB(sorted).catch(() => {});
            cb(sorted);
          } else if (sorted.length > 0 && !hasLiveFirestore) {
            setLocalKunjunganList(sorted);
            saveVisitsToIndexedDB(sorted).catch(() => {});
            cb(sorted);
          }
        },
        (err) => {
          if (isQuotaExhaustedError(err)) {
            markFirestoreQuotaExhausted(err);
            isActive = false;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            try { unsub?.(); } catch {}
            return;
          }
          console.warn('[kunjunganService] Snapshot listener error:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchKunjunganFromFirestore().then((items) => {
              if (isActive && items.length > 0) cb(items);
            });
          }
        }
      );

      // Delayed explicit server fetch only if live snapshot hasn't arrived
      fallbackTimer = setTimeout(() => {
        if (isActive && !hasLiveFirestore && !isFirestoreQuotaCooldownActive()) {
          fetchKunjunganFromFirestore().then((items) => {
            if (isActive && !hasLiveFirestore && items.length > 0) {
              hasLiveFirestore = true;
              cb(items);
            }
          });
        }
      }, 4500);
    }
  } catch (e) {}

  // Broadcast channel sync
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.onmessage = (event) => {
        if (isActive && event.data && event.data.type === 'SYNC_KUNJUNGAN' && Array.isArray(event.data.items)) {
          const memMap = new Map<string, KunjunganWargaData>();
          memoryKunjungan.forEach((m) => { if (m && m.id) memMap.set(m.id, m); });
          const hydrated = event.data.items.map((it: KunjunganWargaData) => {
            if (!it?.fotoUrl && memMap.get(it.id)?.fotoUrl) {
              return { ...it, fotoUrl: memMap.get(it.id)!.fotoUrl };
            }
            return it;
          });
          memoryKunjungan = hydrated;
          cb(hydrated);
        }
      };
    }
  } catch (e) {}

  return () => {
    isActive = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (unsub) { try { unsub(); } catch {} }
    if (bc) bc.close();
  };
};

export const subscribeKunjungan = subscribeKunjunganWarga;
export const saveKunjungan = saveKunjunganWargaToFirestore;
export const saveKunjunganWarga = saveKunjunganWargaToFirestore;

export const isKunjunganOnDate = (item: KunjunganWargaData, dateIso: string): boolean => {
  if (!item || !item.tanggal) return false;
  return item.tanggal.slice(0, 10) === dateIso.slice(0, 10);
};

export const consolidateKunjunganWithReports = (visits: KunjunganWargaData[], reports: any[]): any[] => {
  return visits;
};
