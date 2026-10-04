import { LaporanKegiatanPkk, PokjaPkkType } from '../types';
import { db } from './firebase';
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

export const PKK_KEGIATAN_COLLECTION = 'pkk_kegiatan';
export const PKK_KEGIATAN_STORAGE_KEY = 'sikepling_pkk_kegiatan_v1';
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

export const getLocalPkkKegiatanList = (): LaporanKegiatanPkk[] => {
  if (memoryKegiatan.length > 0) return memoryKegiatan;
  const stored = safeGetLocalStorage<LaporanKegiatanPkk[]>(PKK_KEGIATAN_STORAGE_KEY, []);
  if (stored && stored.length > 0) {
    memoryKegiatan = stored;
    return stored;
  }
  memoryKegiatan = INITIAL_PKK_KEGIATAN;
  safeSetLocalStorage(PKK_KEGIATAN_STORAGE_KEY, JSON.stringify(INITIAL_PKK_KEGIATAN));
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
          memoryKegiatan = ev.data.items;
          callback(ev.data.items);
        }
      };
    }
  } catch (e) {
    // Ignore BroadcastChannel error
  }

  let firestoreUnsub: Unsubscribe = () => {};
  if (db) {
    try {
      const q = query(
        collection(db, PKK_KEGIATAN_COLLECTION),
        orderBy('tanggal', 'desc')
      );
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remote: LaporanKegiatanPkk[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              remote.push({
                ...(d as LaporanKegiatanPkk),
                id: docSnap.id,
              });
            });
            setLocalPkkKegiatanList(remote);
            callback(remote);
          } else {
            const current = getLocalPkkKegiatanList();
            if (current.length === 0) {
              for (const itm of INITIAL_PKK_KEGIATAN) {
                savePkkKegiatan(itm).catch(console.warn);
              }
            }
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

export const savePkkKegiatan = async (
  item: LaporanKegiatanPkk
): Promise<void> => {
  const current = getLocalPkkKegiatanList();
  const filtered = current.filter((x) => x.id !== item.id);
  const updated = [item, ...filtered].sort((a, b) => {
    if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setLocalPkkKegiatanList(updated);

  if (db) {
    try {
      await setDoc(doc(db, PKK_KEGIATAN_COLLECTION, item.id), item, { merge: true });
    } catch (err) {
      console.warn('[savePkkKegiatan to firestore error]:', err);
    }
  }
};

export const deletePkkKegiatan = async (id: string): Promise<void> => {
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
