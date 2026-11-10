import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  DEFAULT_PKK_LINGKUNGAN_NAMES,
  ROMAN_NUMERALS,
} from '../data/keplingList';
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

export const subscribeBuku1 = (onUpdate: (items: PkkBuku1Anggota[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, DEFAULT_BUKU1_ITEMS);
  // Pastikan data tersimpan tidak menggunakan format placeholder lama
  const hasPlaceholder = Array.isArray(stored) && stored.some(x => x.id && x.id.startsWith('anggota_pkk_lingkungan_') && !x.pasphotoUrl);
  const effectiveStored = (Array.isArray(stored) && stored.length >= 25 && !hasPlaceholder)
    ? stored
    : DEFAULT_BUKU1_ITEMS;
  
  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(effectiveStored));
  syncBuku1ToPkkProfiles(effectiveStored);
  onUpdate(effectiveStored);

  let unsub: Unsubscribe | undefined;
  try {
    if (db) {
      const q = query(collection(db, BUKU1_COL));
      unsub = onSnapshot(q, (snap) => {
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
        safeSetLocalStorage(BUKU1_KEY, JSON.stringify(items));
        syncBuku1ToPkkProfiles(items);
        onUpdate(items);
      });
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU1_CHAN);
      bc.onmessage = (e) => {
        if (e.data && e.data.items) {
          syncBuku1ToPkkProfiles(e.data.items);
          onUpdate(e.data.items);
        }
      };
    }
  } catch (e) {}

  return () => {
    if (unsub) unsub();
    if (bc) bc.close();
  };
};

export const saveBuku1Item = async (item: PkkBuku1Anggota) => {
  const current = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, []);
  const payload = { ...item, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(updated));
  syncBuku1ToPkkProfiles(updated);
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU1_CHAN);
      bc.postMessage({ items: updated });
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

  try {
    if (db) {
      // Non-blocking Firestore save with 3.5s timeout guard so UI never hangs on slow cellular connections
      const savePromise = setDoc(doc(db, BUKU1_COL, item.id), cleanFirestoreData(payload));
      await Promise.race([
        savePromise,
        new Promise((resolve) => setTimeout(resolve, 3500)),
      ]);
    }
  } catch (e) {
    console.warn('[pkkBukuService] Firestore save error:', e);
  }
};

export const deleteBuku1Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku1Anggota[]>(BUKU1_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU1_KEY, JSON.stringify(updated));
  try {
    fetch(`/api/pkk/buku1/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}
  try {
    if (db) {
      await deleteDoc(doc(db, BUKU1_COL, id));
    }
  } catch (e) {}
};

// BUKU 4 SERVICE
const BUKU4_COL = 'pkk_buku_4_notulen';
const BUKU4_KEY = 'sikepling_pkk_buku_4_v1';
const BUKU4_CHAN = 'sikepling_buku_4_chan';

export const subscribeBuku4 = (onUpdate: (items: PkkBuku4Notulen[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  onUpdate(stored);

  let unsub: Unsubscribe | undefined;
  try {
    if (db) {
      const q = query(collection(db, BUKU4_COL));
      unsub = onSnapshot(q, (snap) => {
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
        safeSetLocalStorage(BUKU4_KEY, JSON.stringify(items));
        onUpdate(items);
      });
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU4_CHAN);
      bc.onmessage = (e) => {
        if (e.data && e.data.items) onUpdate(e.data.items);
      };
    }
  } catch (e) {}

  return () => {
    if (unsub) unsub();
    if (bc) bc.close();
  };
};

export const saveBuku4Item = async (item: PkkBuku4Notulen) => {
  const current = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  const payload = { ...item, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU4_KEY, JSON.stringify(updated));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU4_CHAN);
      bc.postMessage({ items: updated });
      bc.close();
    }
  } catch (e) {}
  try {
    if (db) {
      await setDoc(doc(db, BUKU4_COL, item.id), cleanFirestoreData(payload));
    }
  } catch (e) {}
};

export const deleteBuku4Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku4Notulen[]>(BUKU4_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU4_KEY, JSON.stringify(updated));
  try {
    if (db) {
      await deleteDoc(doc(db, BUKU4_COL, id));
    }
  } catch (e) {}
};

// BUKU 5 SERVICE
const BUKU5_COL = 'pkk_buku_5_inventaris';
const BUKU5_KEY = 'sikepling_pkk_buku_5_v1';
const BUKU5_CHAN = 'sikepling_buku_5_chan';

export const subscribeBuku5 = (onUpdate: (items: PkkBuku5Inventaris[]) => void) => {
  const stored = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  onUpdate(stored);

  let unsub: Unsubscribe | undefined;
  try {
    if (db) {
      const q = query(collection(db, BUKU5_COL));
      unsub = onSnapshot(q, (snap) => {
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
        safeSetLocalStorage(BUKU5_KEY, JSON.stringify(items));
        onUpdate(items);
      });
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BUKU5_CHAN);
      bc.onmessage = (e) => {
        if (e.data && e.data.items) onUpdate(e.data.items);
      };
    }
  } catch (e) {}

  return () => {
    if (unsub) unsub();
    if (bc) bc.close();
  };
};

export const saveBuku5Item = async (item: PkkBuku5Inventaris) => {
  const current = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  const payload = { ...item, updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(BUKU5_KEY, JSON.stringify(updated));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BUKU5_CHAN);
      bc.postMessage({ items: updated });
      bc.close();
    }
  } catch (e) {}
  try {
    if (db) {
      await setDoc(doc(db, BUKU5_COL, item.id), cleanFirestoreData(payload));
    }
  } catch (e) {}
};

export const deleteBuku5Item = async (id: string) => {
  const current = safeGetLocalStorage<PkkBuku5Inventaris[]>(BUKU5_KEY, []);
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(BUKU5_KEY, JSON.stringify(updated));
  try {
    if (db) {
      await deleteDoc(doc(db, BUKU5_COL, id));
    }
  } catch (e) {}
};
