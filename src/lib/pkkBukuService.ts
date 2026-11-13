import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { PKK_DEFAULT_ANGGOTA_LIST } from '../data/pkkDefaultAnggota';

export interface PkkBuku1Anggota {
  id: string;
  nik?: string;
  noRegistrasi?: string;
  nama: string;
  jabatan: string;
  jenisKelamin: 'L' | 'P';
  tempatLahir?: string;
  tanggalLahir?: string;
  statusPerkawinan?: 'Kawin' | 'Belum Kawin' | 'Janda/Duda' | string;
  statusPernikahan?: string;
  alamat?: string;
  pendidikan?: string;
  pekerjaan?: string;
  keterangan?: string;
  pasphotoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PkkBuku4Notulen {
  id: string;
  tanggal?: string;
  tanggalRapat?: string;
  tempat?: string;
  acara?: string;
  agenda?: string;
  pimpinanRapat: string;
  jumlahPeserta: number;
  notulenRingkas?: string;
  keputusanRapat?: string;
  hasilKeputusan?: string;
  catatanRapat?: string;
  dokumentasiUrl?: string;
  keterangan?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PkkBuku5Inventaris {
  id: string;
  namaBarang: string;
  asalBarang: string;
  tanggalPerolehan?: string;
  jumlah: number;
  satuan?: string;
  tahunPengadaan?: string;
  kondisiBarang?: 'Baik' | 'Rusak Ringan' | 'Rusak Berat' | string;
  kondisi?: string;
  hargaSatuan?: number;
  keterangan?: string;
  createdAt: string;
  updatedAt?: string;
}

// BUKU 1 SERVICE
const BUKU1_COL = 'pkk_buku_1_anggota';
const BUKU1_KEY = 'sikepling_pkk_buku_1_v1';
const BUKU1_CHAN = 'sikepling_buku_1_chan';

// 37 Data Anggota PKK Asli & Permanen dari Firestore
export const DEFAULT_BUKU1_ITEMS: PkkBuku1Anggota[] = PKK_DEFAULT_ANGGOTA_LIST;

export const fetchBuku1FromFirestore = async (): Promise<PkkBuku1Anggota[]> => {
  if (!db || isFirestoreQuotaCooldownActive()) return safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, DEFAULT_BUKU1_ITEMS);
  try {
    const colRef = collection(db, BUKU1_COL);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const items: PkkBuku1Anggota[] = [];
    snap.forEach((d) => {
      const data = d.data() as PkkBuku1Anggota;
      items.push({
        ...data,
        id: d.id,
        createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
      });
    });
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (items.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(BUKU1_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      markFirestoreQuotaExhausted(e);
    } else {
      console.warn('[pkkBukuService] fetchBuku1 error:', e);
    }
  }
  return safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, DEFAULT_BUKU1_ITEMS);
};

export const subscribeBuku1 = (onUpdate: (items: PkkBuku1Anggota[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, DEFAULT_BUKU1_ITEMS);
  const hasPlaceholder = Array.isArray(stored) && stored.some((x) => x.id && x.id.startsWith('anggota_pkk_lingkungan_') && !x.pasphotoUrl);
  const effectiveStored = (Array.isArray(stored) && stored.length > 0 && !hasPlaceholder)
    ? stored
    : DEFAULT_BUKU1_ITEMS;

  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(effectiveStored));
  onUpdate(effectiveStored);

  let isActive = true;
  let receivedServerSnapshot = false;
  let unsub: Unsubscribe | undefined;
  let fallbackTimer: any = null;

  try {
    if (db && !isFirestoreQuotaCooldownActive()) {
      const colRef = collection(db, BUKU1_COL);
      unsub = onSnapshot(
        colRef,
        (snap) => {
          if (!isActive) return;
          const items: PkkBuku1Anggota[] = [];
          snap.forEach((d) => {
            const data = d.data() as PkkBuku1Anggota;
            items.push({
              ...data,
              id: d.id,
              createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
            });
          });
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          if (!snap.metadata.fromCache) {
            receivedServerSnapshot = true;
            safeSetLocalStorage(BUKU1_KEY, JSON.stringify(items));
            onUpdate(items);
          } else if (items.length > 0 && !receivedServerSnapshot) {
            safeSetLocalStorage(BUKU1_KEY, JSON.stringify(items));
            onUpdate(items);
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
          console.warn('[pkkBukuService] subscribeBuku1 error:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchBuku1FromFirestore().then((items) => {
              if (isActive) onUpdate(items);
            });
          }
        }
      );

      fallbackTimer = setTimeout(() => {
        if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
          fetchBuku1FromFirestore().then((items) => {
            if (isActive && !receivedServerSnapshot && items.length > 0) {
              onUpdate(items);
            }
          });
        }
      }, 4500);
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU1_CHAN);
      bc.onmessage = (e) => {
        if (isActive && e.data && e.data.items) {
          onUpdate(e.data.items);
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

export const saveBuku1Item = async (item: PkkBuku1Anggota) => {
  const current = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, []);
  const payload = { ...item, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU1_CHAN);
      const light = updated.map((x) => (x.pasphotoUrl?.startsWith('data:') ? { ...x, pasphotoUrl: '' } : x));
      bc.postMessage({ items: light });
      bc.close();
    }
  } catch (e) {}
  try {
    fetch('/api/pkk/buku1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: payload }),
    }).catch(() => {});
  } catch {}

  await resilientSetDoc(BUKU1_COL, item.id, cleanFirestoreData(payload), { merge: true });
};

export const deleteBuku1Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  try {
    fetch(`/api/pkk/buku1/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}
  await resilientDeleteDoc(BUKU1_COL, id);
};

// BUKU 4 SERVICE
const BUKU4_COL = 'pkk_buku_4_notulen';
const BUKU4_KEY = 'sikepling_pkk_buku_4_v1';
const BUKU4_CHAN = 'sikepling_buku_4_chan';

export const fetchBuku4FromFirestore = async (): Promise<PkkBuku4Notulen[]> => {
  if (!db || isFirestoreQuotaCooldownActive()) return safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  try {
    const colRef = collection(db, BUKU4_COL);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const items: PkkBuku4Notulen[] = [];
    snap.forEach((d) => {
      const data = d.data() as PkkBuku4Notulen;
      items.push({
        ...data,
        id: d.id,
        createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
      });
    });
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (items.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(BUKU4_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      markFirestoreQuotaExhausted(e);
    } else {
      console.warn('[pkkBukuService] fetchBuku4 error:', e);
    }
  }
  return safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
};

export const subscribeBuku4 = (onUpdate: (items: PkkBuku4Notulen[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  onUpdate(stored);

  let isActive = true;
  let receivedServerSnapshot = false;
  let unsub: Unsubscribe | undefined;
  let fallbackTimer: any = null;

  try {
    if (db && !isFirestoreQuotaCooldownActive()) {
      const colRef = collection(db, BUKU4_COL);
      unsub = onSnapshot(
        colRef,
        (snap) => {
          if (!isActive) return;
          const items: PkkBuku4Notulen[] = [];
          snap.forEach((d) => {
            const data = d.data() as PkkBuku4Notulen;
            items.push({
              ...data,
              id: d.id,
              createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
            });
          });
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          if (!snap.metadata.fromCache) {
            receivedServerSnapshot = true;
            safeSetLocalStorage(BUKU4_KEY, JSON.stringify(items));
            onUpdate(items);
          } else if (items.length > 0 && !receivedServerSnapshot) {
            safeSetLocalStorage(BUKU4_KEY, JSON.stringify(items));
            onUpdate(items);
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
          console.warn('[pkkBukuService] subscribeBuku4 error:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchBuku4FromFirestore().then((items) => {
              if (isActive) onUpdate(items);
            });
          }
        }
      );

      fallbackTimer = setTimeout(() => {
        if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
          fetchBuku4FromFirestore().then((items) => {
            if (isActive && !receivedServerSnapshot && items.length > 0) {
              onUpdate(items);
            }
          });
        }
      }, 4500);
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU4_CHAN);
      bc.onmessage = (e) => {
        if (isActive && e.data && e.data.items) onUpdate(e.data.items);
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

export const saveBuku4Item = async (item: PkkBuku4Notulen) => {
  const current = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  const payload = { ...item, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU4_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU4_CHAN);
      const light = updated.map((x) => (x.dokumentasiUrl?.startsWith('data:') ? { ...x, dokumentasiUrl: '' } : x));
      bc.postMessage({ items: light });
      bc.close();
    }
  } catch (e) {}
  await resilientSetDoc(BUKU4_COL, item.id, cleanFirestoreData(payload), { merge: true });
};

export const deleteBuku4Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU4_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  await resilientDeleteDoc(BUKU4_COL, id);
};

// BUKU 5 SERVICE
const BUKU5_COL = 'pkk_buku_5_inventaris';
const BUKU5_KEY = 'sikepling_pkk_buku_5_v1';
const BUKU5_CHAN = 'sikepling_buku_5_chan';

export const fetchBuku5FromFirestore = async (): Promise<PkkBuku5Inventaris[]> => {
  if (!db || isFirestoreQuotaCooldownActive()) return safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  try {
    const colRef = collection(db, BUKU5_COL);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const items: PkkBuku5Inventaris[] = [];
    snap.forEach((d) => {
      const data = d.data() as PkkBuku5Inventaris;
      items.push({
        ...data,
        id: d.id,
        createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
      });
    });
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (items.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(BUKU5_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      markFirestoreQuotaExhausted(e);
    } else {
      console.warn('[pkkBukuService] fetchBuku5 error:', e);
    }
  }
  return safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
};

export const subscribeBuku5 = (onUpdate: (items: PkkBuku5Inventaris[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  onUpdate(stored);

  let isActive = true;
  let receivedServerSnapshot = false;
  let unsub: Unsubscribe | undefined;
  let fallbackTimer: any = null;

  try {
    if (db && !isFirestoreQuotaCooldownActive()) {
      const colRef = collection(db, BUKU5_COL);
      unsub = onSnapshot(
        colRef,
        (snap) => {
          if (!isActive) return;
          const items: PkkBuku5Inventaris[] = [];
          snap.forEach((d) => {
            const data = d.data() as PkkBuku5Inventaris;
            items.push({
              ...data,
              id: d.id,
              createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
            });
          });
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          if (!snap.metadata.fromCache) {
            receivedServerSnapshot = true;
            safeSetLocalStorage(BUKU5_KEY, JSON.stringify(items));
            onUpdate(items);
          } else if (items.length > 0 && !receivedServerSnapshot) {
            safeSetLocalStorage(BUKU5_KEY, JSON.stringify(items));
            onUpdate(items);
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
          console.warn('[pkkBukuService] subscribeBuku5 error:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchBuku5FromFirestore().then((items) => {
              if (isActive) onUpdate(items);
            });
          }
        }
      );

      fallbackTimer = setTimeout(() => {
        if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
          fetchBuku5FromFirestore().then((items) => {
            if (isActive && !receivedServerSnapshot && items.length > 0) {
              onUpdate(items);
            }
          });
        }
      }, 4500);
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU5_CHAN);
      bc.onmessage = (e) => {
        if (isActive && e.data && e.data.items) onUpdate(e.data.items);
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

export const saveBuku5Item = async (item: PkkBuku5Inventaris) => {
  const current = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  const payload = {
    ...item,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU5_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU5_CHAN);
      bc.postMessage({ items: updated });
      bc.close();
    }
  } catch (e) {}
  await resilientSetDoc(BUKU5_COL, item.id, cleanFirestoreData(payload), { merge: true });
};

export const deleteBuku5Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU5_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  await resilientDeleteDoc(BUKU5_COL, id);
};
