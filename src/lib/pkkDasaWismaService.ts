import { KelompokDasaWisma } from '../types';
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

export const PKK_DASA_WISMA_COLLECTION = 'pkk_dasa_wisma';
export const PKK_DASA_WISMA_STORAGE_KEY = 'sikepling_pkk_dasa_wisma_v2';
export const PKK_DASA_WISMA_CHANNEL = 'sikepling_pkk_dasa_wisma_channel';

// Helper to check if an item is a generated dummy sample item
export const isSampleDawis = (item: Partial<KelompokDasaWisma> | null | undefined): boolean => {
  if (!item) return false;
  const idStr = String(item.id || '');
  const namaStr = String(item.namaKelompok || '');
  const ketuaStr = String(item.namaKetuaDawis || '');
  const kegiatanStr = String(item.kegiatanUtama || '');

  const idMatch = /^dawis_lk_\d+_01$/.test(idStr);
  const nameMatch = namaStr.includes('Dasa Wisma Melati') && namaStr.includes('(Kelompok 1)');
  const ketuaMatch = ketuaStr.startsWith('Kader Dawis Lk');
  const kegiatanMatch = kegiatanStr.includes('Pemeriksaan jentik berkala, arisan dasawisma');

  return Boolean(idMatch || (nameMatch && ketuaMatch) || (nameMatch && kegiatanMatch));
};

// Initial Dasa Wisma is strictly empty so users can fill it manually
const INITIAL_DASA_WISMA: KelompokDasaWisma[] = [];

let memoryDawis: KelompokDasaWisma[] = [];

// Clean legacy localStorage keys containing dummy sample data
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sikepling_pkk_dasa_wisma_v1');
  }
} catch (e) {
  // Ignore
}

export const getLocalDasaWismaList = (): KelompokDasaWisma[] => {
  if (memoryDawis.length > 0) {
    return memoryDawis.filter((it) => !isSampleDawis(it));
  }
  const stored = safeGetLocalStorage<KelompokDasaWisma[]>(PKK_DASA_WISMA_STORAGE_KEY, []);
  if (stored && Array.isArray(stored)) {
    const cleaned = stored.filter((it) => !isSampleDawis(it));
    memoryDawis = cleaned;
    if (cleaned.length !== stored.length) {
      safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  }
  memoryDawis = [];
  return [];
};

export const setLocalDasaWismaList = (items: KelompokDasaWisma[]): void => {
  const cleaned = items.filter((it) => !isSampleDawis(it));
  memoryDawis = cleaned;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(cleaned));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'SYNC_DAWIS', items: cleaned });
      bc.close();
    }
  } catch (e) {
    // Ignore BroadcastChannel errors
  }
};

export const subscribeDasaWisma = (
  callback: (items: KelompokDasaWisma[]) => void
): Unsubscribe => {
  const initial = getLocalDasaWismaList();
  callback(initial);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.items && Array.isArray(ev.data.items)) {
          const cleaned = ev.data.items.filter((it: KelompokDasaWisma) => !isSampleDawis(it));
          memoryDawis = cleaned;
          callback(cleaned);
        }
      };
    }
  } catch (e) {
    // Ignore BroadcastChannel errors
  }

  let firestoreUnsub: Unsubscribe = () => {};
  if (db) {
    try {
      const q = query(
        collection(db, PKK_DASA_WISMA_COLLECTION),
        orderBy('lingkunganNomor', 'asc')
      );
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remote: KelompokDasaWisma[] = [];
            const dummyDocIdsToDelete: string[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              const itm: KelompokDasaWisma = {
                ...(d as KelompokDasaWisma),
                id: docSnap.id,
              };
              if (isSampleDawis(itm)) {
                dummyDocIdsToDelete.push(docSnap.id);
              } else {
                remote.push(itm);
              }
            });

            // Asynchronously delete lingering dummy sample documents from Firestore
            if (dummyDocIdsToDelete.length > 0) {
              for (const docId of dummyDocIdsToDelete) {
                deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, docId)).catch(() => {});
              }
            }

            setLocalDasaWismaList(remote);
            callback(remote);
          } else {
            setLocalDasaWismaList([]);
            callback([]);
          }
        },
        (err) => {
          console.warn('[Dasa Wisma Firestore error]:', err);
        }
      );
    } catch (err) {
      console.warn('[Dasa Wisma setup error]:', err);
    }
  }

  return () => {
    if (bc) bc.close();
    firestoreUnsub();
  };
};

export const clearSampleDasaWismaData = async (): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sikepling_pkk_dasa_wisma_v1');
    }
  } catch (e) {
    // Ignore
  }

  const current = getLocalDasaWismaList();
  const cleaned = current.filter((it) => !isSampleDawis(it));
  memoryDawis = cleaned;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(cleaned));

  if (db) {
    try {
      for (let i = 1; i <= 24; i++) {
        const dummyId = `dawis_lk_${i}_01`;
        deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, dummyId)).catch(() => {});
      }
    } catch (err) {
      console.warn('[clearSampleDasaWismaData error]:', err);
    }
  }
};

// Automatically run sample cleanup on load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    clearSampleDasaWismaData().catch(() => {});
  }, 100);
}

export const saveDasaWisma = async (
  item: KelompokDasaWisma
): Promise<void> => {
  const current = getLocalDasaWismaList();
  const filtered = current.filter((x) => x.id !== item.id);
  const updated = [...filtered, item].sort((a, b) => a.lingkunganNomor - b.lingkunganNomor);
  setLocalDasaWismaList(updated);

  if (db) {
    try {
      await setDoc(doc(db, PKK_DASA_WISMA_COLLECTION, item.id), item, { merge: true });
    } catch (err) {
      console.warn('[saveDasaWisma to firestore error]:', err);
    }
  }
};

export const deleteDasaWisma = async (id: string): Promise<void> => {
  const current = getLocalDasaWismaList();
  const updated = current.filter((x) => x.id !== id);
  setLocalDasaWismaList(updated);

  if (db) {
    try {
      await deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, id));
    } catch (err) {
      console.warn('[deleteDasaWisma from firestore error]:', err);
    }
  }
};

export const exportDasaWismaToExcel = (items: KelompokDasaWisma[]): void => {
  const headers = [
    'No',
    'Lingkungan',
    'Nama Kelompok Dasa Wisma',
    'Nama Ketua Dawis',
    'Kontak HP/WA',
    'Jumlah KK',
    'Jumlah Jiwa',
    'Jumlah Balita',
    'Jumlah Ibu Hamil',
    'Jumlah Lansia',
    'Jamban Sehat (KK)',
    'SPAL Sehat (KK)',
    'Pekarangan TOGA (KK)',
    'Kegiatan Pokok',
  ];

  const rows = items.map((it, idx) => [
    idx + 1,
    it.lingkunganNama,
    it.namaKelompok,
    it.namaKetuaDawis,
    it.teleponKetua || '-',
    it.jumlahKk,
    it.jumlahJiwa,
    it.jumlahBalita,
    it.jumlahIbuHamil,
    it.jumlahLansia,
    it.punyaJambanSehat,
    it.punyaSpal,
    it.punyaToga,
    it.kegiatanUtama || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    ['TIM PENGGERAK PKK KELURAHAN MANGGA'],
    ['REKAPITULASI DATA KELOMPOK DASA WISMA 24 LINGKUNGAN'],
    [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
    [],
    headers,
    ...rows,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dasa Wisma PKK');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Data_Dasa_Wisma_PKK_Kelurahan_Mangga_${dateStr}.xlsx`);
};
