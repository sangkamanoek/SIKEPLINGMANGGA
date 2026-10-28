import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

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
  namaKepling: string;
  perlinsos?: string;
  ikd?: string;
  pbb?: string;
  kategoriBansos?: string;
  statusBansos?: 'Sudah' | 'Belum' | 'Menolak' | 'Layak' | 'Tidak Layak';
  keterangan?: string;
  telepon?: string;
  fotoUrl?: string;
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
  return [];
};

export const setLocalKunjunganList = (items: KunjunganWargaData[]): void => {
  const deletedSet = new Set(getDeletedKunjunganIds());
  const cleaned = items.filter((x) => x && x.id && !deletedSet.has(x.id));
  memoryKunjungan = cleaned;
  safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(cleaned));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KUNJUNGAN', items: cleaned });
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

  // 1. Update local state
  const current = getLocalKunjunganList();
  const idx = current.findIndex((p) => p.id === dataToSave.id);
  let updatedList = [...current];
  if (idx >= 0) {
    updatedList[idx] = dataToSave;
  } else {
    updatedList = [dataToSave, ...updatedList];
  }
  setLocalKunjunganList(updatedList);

  // 2. Save to Firestore if connected
  try {
    if (db) {
      await setDoc(doc(db, KUNJUNGAN_COLLECTION, dataToSave.id), dataToSave, { merge: true });
    }
  } catch (err) {
    console.warn('[kunjunganService] Firestore save error:', err);
  }

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

  try {
    if (db) {
      await deleteDoc(doc(db, KUNJUNGAN_COLLECTION, id));
    }
  } catch (err) {
    console.warn('[kunjunganService] Firestore delete error:', err);
  }

  try {
    await fetch(`/api/kunjungan/${id}`, { method: 'DELETE' });
  } catch (e) {}
};

export const subscribeKunjunganWarga = (cb: (items: KunjunganWargaData[]) => void): (() => void) => {
  // Initial local emit
  cb(getLocalKunjunganList());

  let unsub: Unsubscribe | null = null;
  try {
    if (db) {
      const q = query(collection(db, KUNJUNGAN_COLLECTION), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snapshot) => {
          const remoteItems: KunjunganWargaData[] = [];
          snapshot.forEach((docSnap) => {
            const dat = docSnap.data() as KunjunganWargaData;
            if (dat && dat.id) remoteItems.push(dat);
          });
          if (remoteItems.length > 0) {
            const deletedSet = new Set(getDeletedKunjunganIds());
            const local = getLocalKunjunganList();
            const map = new Map<string, KunjunganWargaData>();
            local.forEach((l) => map.set(l.id, l));
            remoteItems.forEach((r) => {
              if (!deletedSet.has(r.id)) {
                map.set(r.id, r);
              }
            });
            const merged = Array.from(map.values()).sort((a, b) =>
              (b.createdAt || '').localeCompare(a.createdAt || '')
            );
            setLocalKunjunganList(merged);
            cb(merged);
          }
        },
        (err) => {
          console.warn('[kunjunganService] Snapshot listener error:', err);
        }
      );
    }
  } catch (e) {}

  // Broadcast channel sync
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC_KUNJUNGAN' && Array.isArray(event.data.items)) {
          cb(event.data.items);
        }
      };
    }
  } catch (e) {}

  return () => {
    if (unsub) unsub();
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
