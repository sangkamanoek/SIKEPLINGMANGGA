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
export const PKK_DASA_WISMA_STORAGE_KEY = 'sikepling_pkk_dasa_wisma_v1';
export const PKK_DASA_WISMA_CHANNEL = 'sikepling_pkk_dasa_wisma_channel';

// 24 Initial Dasa Wisma groups for 24 Lingkungan in Kelurahan Mangga
const INITIAL_DASA_WISMA: KelompokDasaWisma[] = Array.from({ length: 24 }, (_, i) => {
  const num = i + 1;
  const roman = [
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
    'XXI', 'XXII', 'XXIII', 'XXIV'
  ][i];
  return {
    id: `dawis_lk_${num}_01`,
    namaKelompok: `Dasa Wisma Melati ${roman} (Kelompok 1)`,
    lingkunganNomor: num,
    lingkunganNama: `Lingkungan ${roman}`,
    namaKetuaDawis: `Kader Dawis Lk ${roman}`,
    teleponKetua: '081260000' + String(num).padStart(2, '0'),
    jumlahKk: 15 + ((num * 3) % 7),
    jumlahJiwa: 52 + ((num * 5) % 25),
    jumlahBalita: 4 + (num % 5),
    jumlahIbuHamil: 1 + (num % 3),
    jumlahLansia: 6 + (num % 6),
    punyaJambanSehat: 15 + ((num * 3) % 7) - (num % 2),
    punyaSpal: 14 + ((num * 3) % 7) - (num % 3),
    punyaToga: 10 + (num % 5),
    kegiatanUtama: 'Pemeriksaan jentik berkala, arisan dasawisma, senam sehat lansia & pemanfaatan pekarangan toga.',
    updatedAt: '2026-10-01T08:00:00.000Z',
  };
});

let memoryDawis: KelompokDasaWisma[] = [];

export const getLocalDasaWismaList = (): KelompokDasaWisma[] => {
  if (memoryDawis.length > 0) return memoryDawis;
  const stored = safeGetLocalStorage<KelompokDasaWisma[]>(PKK_DASA_WISMA_STORAGE_KEY, []);
  if (stored && stored.length > 0) {
    memoryDawis = stored;
    return stored;
  }
  memoryDawis = INITIAL_DASA_WISMA;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(INITIAL_DASA_WISMA));
  return INITIAL_DASA_WISMA;
};

export const setLocalDasaWismaList = (items: KelompokDasaWisma[]): void => {
  memoryDawis = items;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(items));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'SYNC_DAWIS', items });
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
          memoryDawis = ev.data.items;
          callback(ev.data.items);
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
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              remote.push({
                ...(d as KelompokDasaWisma),
                id: docSnap.id,
              });
            });
            setLocalDasaWismaList(remote);
            callback(remote);
          } else {
            const current = getLocalDasaWismaList();
            if (current.length === 0) {
              for (const itm of INITIAL_DASA_WISMA) {
                saveDasaWisma(itm).catch(console.warn);
              }
            }
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
