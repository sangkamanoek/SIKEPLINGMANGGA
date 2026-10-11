import { LaporanKegiatanPkk, PokjaPkkType } from '../types';
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
import * as XLSX from 'xlsx';

import { getAccessToken } from './firebase';
import { syncPkkPhotosToDrive } from './driveSync';

export const PKK_KEGIATAN_COLLECTION = 'pkk_kegiatan';
export const PKK_KEGIATAN_STORAGE_KEY = 'sikepling_pkk_kegiatan_v1';
export const PKK_DELETED_STORAGE_KEY = 'sikepling_pkk_deleted_v1';
export const PKK_KEGIATAN_CHANNEL = 'sikepling_pkk_kegiatan_channel';

export const POKJA_LABELS: Record<PokjaPkkType, string> = {
  SEKRETARIAT: 'Sekretariat TP PKK',
  POKJA_I: 'Pokja I (Pancasila & Gotong Royong)',
  POKJA_II: 'Pokja II (Pendidikan & UP2K)',
  POKJA_III: 'Pokja III (Pangan, Sandang & Rumah Sehat)',
  POKJA_IV: 'Pokja IV (Kesehatan, Posyandu & PHBS)',
  PKK_LINGKUNGAN: 'TP PKK Lingkungan',
};

// Initial Seed Kegiatan PKK Kelurahan Mangga TA 2026 (Dikosongkan agar bersih)
const INITIAL_PKK_KEGIATAN: LaporanKegiatanPkk[] = [];

let memoryKegiatan: LaporanKegiatanPkk[] = [];
let deletedPkkIdsCache: string[] = safeGetLocalStorage<string[]>(PKK_DELETED_STORAGE_KEY, []);

export const getDeletedPkkIds = (): string[] => {
  if (!Array.isArray(deletedPkkIdsCache)) deletedPkkIdsCache = [];
  return deletedPkkIdsCache;
};

export const markPkkDeleted = (id: string): void => {
  const current = getDeletedPkkIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedPkkIdsCache = current;
    safeSetLocalStorage(PKK_DELETED_STORAGE_KEY, JSON.stringify(current));
  }
};

export const getLocalPkkKegiatanList = (): LaporanKegiatanPkk[] => {
  const deletedSet = new Set(getDeletedPkkIds());
  const stored = safeGetLocalStorage<LaporanKegiatanPkk[]>(PKK_KEGIATAN_STORAGE_KEY, []);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    memoryKegiatan = cleaned;
    return cleaned;
  }
  if (memoryKegiatan.length > 0) {
    const cleaned = memoryKegiatan.filter((x) => x && x.id && !deletedSet.has(x.id));
    memoryKegiatan = cleaned;
    return cleaned;
  }
  return INITIAL_PKK_KEGIATAN;
};

export const setLocalPkkKegiatanList = (items: LaporanKegiatanPkk[]): void => {
  memoryKegiatan = items;
  safeSetLocalStorage(PKK_KEGIATAN_STORAGE_KEY, JSON.stringify(items));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PKK_KEGIATAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KEGIATAN', items });
      bc.close();
    }
  } catch (e) {
    // Ignore BroadcastChannel errors
  }
};

export const smartMergePkkKegiatan = (
  local: LaporanKegiatanPkk[],
  remote: LaporanKegiatanPkk[]
): LaporanKegiatanPkk[] => {
  const deletedSet = new Set(getDeletedPkkIds());
  const map = new Map<string, LaporanKegiatanPkk>();
  for (const item of local) {
    if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
  }
  for (const item of remote) {
    if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.tanggal || a.createdAt || '';
    const dateB = b.tanggal || b.createdAt || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
};

export const subscribePkkKegiatan = (
  callback: (items: LaporanKegiatanPkk[]) => void
): Unsubscribe => {
  const initial = getLocalPkkKegiatanList();
  callback(initial);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(PKK_KEGIATAN_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.items && Array.isArray(ev.data.items)) {
          const deletedSet = new Set(getDeletedPkkIds());
          const cleaned = ev.data.items.filter((x: LaporanKegiatanPkk) => x && x.id && !deletedSet.has(x.id));
          memoryKegiatan = cleaned;
          callback(cleaned);
        }
      };
    }
  } catch (e) {
    // Ignore BroadcastChannel error
  }

  let firestoreUnsub: Unsubscribe = () => {};
  if (db) {
    try {
      const colRef = collection(db, PKK_KEGIATAN_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          const deletedSet = new Set(getDeletedPkkIds());
          const remote: LaporanKegiatanPkk[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d && !deletedSet.has(docSnap.id)) {
              remote.push({
                ...(d as LaporanKegiatanPkk),
                id: docSnap.id,
              });
            }
          });

          const local = getLocalPkkKegiatanList();
          const merged = smartMergePkkKegiatan(local, remote);
          setLocalPkkKegiatanList(merged);
          callback(merged);

          // Auto-sync local items that are missing in remote ONLY if they are NOT deleted
          if (remote.length < merged.length) {
            const remoteIds = new Set(remote.map((r) => r.id));
            merged.forEach((item) => {
              if (!remoteIds.has(item.id) && !deletedSet.has(item.id)) {
                savePkkKegiatan(item).catch(() => {});
              }
            });
          }
        },
        (err) => {
          console.warn('[PKK Kegiatan Firestore error]:', err);
        }
      );
    } catch (err) {
      console.warn('[PKK Kegiatan setup error]:', err);
    }
  }

  return () => {
    if (bc) bc.close();
    firestoreUnsub();
  };
};

export const syncPkkKegiatanDirectly = async (): Promise<LaporanKegiatanPkk[]> => {
  const local = getLocalPkkKegiatanList();
  if (!db) return local;

  try {
    const deletedSet = new Set(getDeletedPkkIds());
    const { getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(collection(db, PKK_KEGIATAN_COLLECTION));
    const remote: LaporanKegiatanPkk[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && !deletedSet.has(docSnap.id)) {
        remote.push({
          ...(d as LaporanKegiatanPkk),
          id: docSnap.id,
        });
      }
    });

    const merged = smartMergePkkKegiatan(local, remote);
    setLocalPkkKegiatanList(merged);

    // Push local unsynced items to Firestore ONLY if not marked deleted
    const remoteIds = new Set(remote.map((r) => r.id));
    for (const item of merged) {
      if (!remoteIds.has(item.id) && !deletedSet.has(item.id)) {
        try {
          const cleaned = cleanFirestoreData(item);
          await setDoc(doc(db, PKK_KEGIATAN_COLLECTION, item.id), cleaned, { merge: true });
        } catch (e) {
          // ignore
        }
      }
    }

    return merged;
  } catch (err) {
    console.warn('Manual sync PKK kegiatan failed:', err);
    return local;
  }
};

export const savePkkKegiatan = async (
  item: LaporanKegiatanPkk
): Promise<void> => {
  let itemToSave = item;

  // 0. Sync to Drive if connected
  try {
    const activeToken = await getAccessToken();
    if (activeToken) {
      itemToSave = await syncPkkPhotosToDrive(item, activeToken);
    }
  } catch (err) {
    console.warn('Drive sync for PKK failed:', err);
  }

  const current = getLocalPkkKegiatanList();
  const filtered = current.filter((x) => x.id !== itemToSave.id);
  const updated = [itemToSave, ...filtered].sort((a, b) => {
    if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setLocalPkkKegiatanList(updated);

  if (db) {
    try {
      const cleaned = cleanFirestoreData(itemToSave);
      await setDoc(doc(db, PKK_KEGIATAN_COLLECTION, itemToSave.id), cleaned, { merge: true });
    } catch (err) {
      console.warn('[savePkkKegiatan to firestore error, attempting safe fallback]:', err);
      try {
        const safeItem = {
          ...itemToSave,
          fotoDokumentasi: itemToSave.fotoDokumentasi?.slice(0, 3),
        };
        const cleanedSafe = cleanFirestoreData(safeItem);
        await setDoc(doc(db, PKK_KEGIATAN_COLLECTION, itemToSave.id), cleanedSafe, { merge: true });
      } catch (fallbackErr) {
        console.error('[savePkkKegiatan fallback failed]:', fallbackErr);
        throw fallbackErr;
      }
    }
  }
};

export const deletePkkKegiatan = async (id: string): Promise<void> => {
  markPkkDeleted(id);
  const current = getLocalPkkKegiatanList();
  const updated = current.filter((x) => x.id !== id);
  setLocalPkkKegiatanList(updated);

  if (db) {
    try {
      await deleteDoc(doc(db, PKK_KEGIATAN_COLLECTION, id));
    } catch (err) {
      console.warn('[deletePkkKegiatan from firestore error]:', err);
    }
  }
};

export const exportPkkKegiatanToExcel = (
  items: LaporanKegiatanPkk[],
  filterTitle: string = 'Seluruh Kegiatan PKK'
): void => {
  const headers = [
    'No',
    'Tanggal',
    'Pokja / Unit',
    'Nama Kegiatan',
    'Kategori Program 10 Pokok',
    'Lokasi',
    'Lingkungan',
    'Jumlah Peserta',
    'Uraian Hasil Kegiatan',
    'Rencana Tindak Lanjut',
    'Pelapor',
  ];

  const rows = items.map((it, idx) => [
    idx + 1,
    it.tanggal,
    POKJA_LABELS[it.pokja] || it.pokja,
    it.namaKegiatan,
    it.kategoriProgram,
    it.lokasi,
    it.lingkunganNama || (it.lingkunganNomor ? `Lingkungan ${it.lingkunganNomor}` : 'Kelurahan'),
    it.jumlahPeserta || 0,
    it.uraianHasil,
    it.tindakLanjut || '-',
    it.pelaporNama,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    ['TIM PENGGERAK PKK KELURAHAN MANGGA'],
    [`BUKU LAPORAN KEGIATAN TP-PKK - ${filterTitle.toUpperCase()}`],
    [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
    [],
    headers,
    ...rows,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kegiatan PKK');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Laporan_Kegiatan_PKK_Kelurahan_Mangga_${dateStr}.xlsx`);
};
