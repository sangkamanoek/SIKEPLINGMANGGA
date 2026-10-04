import { SuratKedinasanItem, JenisSuratKedinasan } from '../types';
import { db } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const SURAT_STORAGE_KEY = 'si_mangga_surat_kedinasan_list';
export const SURAT_COLLECTION = 'surat_kedinasan';
export const SURAT_CHANNEL = 'si_mangga_surat_channel';

export const INITIAL_SURAT_LIST: SuratKedinasanItem[] = [
  {
    id: 'surat_1',
    nomorSurat: '005 / 421 / X / 2026',
    tanggalSurat: '2026-10-01',
    jenisSurat: 'UNDANGAN',
    perihal: 'Undangan Rapat Koordinasi Bulanan Kepala Lingkungan & PKK',
    tujuanSurat: 'Seluruh Kepling I s/d XXIV & Pengurus TP-PKK',
    sifat: 'PENTING',
    status: 'DISETUJUI',
    isiRingkas: 'Rapat koordinasi evaluasi realisasi PBB-P2, ketertiban umum poskamling, dan persiapan kegiatan bulan bakti gotong royong.',
    penandatangan: 'Lurah Kelurahan Mangga',
    dibuatOlehNama: 'Kasi Pemerintahan',
    dibuatOlehRole: 'kasi_pemerintahan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'surat_2',
    nomorSurat: '400.10.2 / 115 / X / 2026',
    tanggalSurat: '2026-10-02',
    jenisSurat: 'SURAT_KELUAR',
    perihal: 'Pengantar Verifikasi Data Kesejahteraan Sosial (DTKS)',
    tujuanSurat: 'Kepala Dinas Sosial Kota Medan',
    sifat: 'BIASA',
    status: 'DIARSIPKAN',
    isiRingkas: 'Penyampaian hasil musyawarah kelurahan terkait usulan verifikasi dan validasi data warga kurang mampu di 24 Lingkungan.',
    penandatangan: 'Lurah Kelurahan Mangga',
    dibuatOlehNama: 'Kasi Pembangunan',
    dibuatOlehRole: 'kasi_pembangunan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'surat_3',
    nomorSurat: '800 / 088 / SK / X / 2026',
    tanggalSurat: '2026-10-03',
    jenisSurat: 'SK_LURAH',
    perihal: 'Keputusan Lurah Mangga tentang Penetapan Kader Posyandu & Dasa Wisma 2026',
    asalSurat: 'Kecamatan Medan Tuntungan',
    sifat: 'PENTING',
    status: 'DISETUJUI',
    isiRingkas: 'Penetapan nama-nama pengurus posyandu dan kelompok dasa wisma di seluruh lingkungan Kelurahan Mangga.',
    penandatangan: 'Lurah Kelurahan Mangga',
    dibuatOlehNama: 'Super Admin',
    dibuatOlehRole: 'super_admin',
    createdAt: new Date().toISOString(),
  },
];

let memorySurat: SuratKedinasanItem[] = [];

export const getLocalSuratList = (): SuratKedinasanItem[] => {
  if (memorySurat.length > 0) return memorySurat;
  const stored = safeGetLocalStorage<SuratKedinasanItem[]>(SURAT_STORAGE_KEY, []);
  if (stored && stored.length > 0) {
    memorySurat = stored;
    return stored;
  }
  memorySurat = INITIAL_SURAT_LIST;
  safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(INITIAL_SURAT_LIST));
  return INITIAL_SURAT_LIST;
};

export const setLocalSuratList = (items: SuratKedinasanItem[]): void => {
  memorySurat = items;
  safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.postMessage({ type: 'SYNC_SURAT', items });
      bc.close();
    }
  } catch (e) {
    console.warn(e);
  }
};

export async function fetchSuratFromServer(): Promise<SuratKedinasanItem[]> {
  if (!db) return getLocalSuratList();
  try {
    const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
    const snap = await getDocs(q);
    const items: SuratKedinasanItem[] = [];
    snap.forEach((d) => {
      items.push(d.data() as SuratKedinasanItem);
    });
    if (items.length > 0) {
      memorySurat = items;
      safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    console.warn('Failed fetching surat from server:', err);
  }
  return getLocalSuratList();
}

export async function saveSuratItem(item: SuratKedinasanItem): Promise<void> {
  const current = getLocalSuratList();
  const existsIndex = current.findIndex((x) => x.id === item.id);
  const updated = existsIndex >= 0
    ? current.map((x) => (x.id === item.id ? item : x))
    : [item, ...current];

  setLocalSuratList(updated);

  if (db) {
    try {
      await setDoc(doc(db, SURAT_COLLECTION, item.id), item);
    } catch (err) {
      console.warn('Failed saving surat to Firestore:', err);
    }
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('si-mangga-surat-updated', { detail: item }));
    }
  } catch {}
}

export async function deleteSuratItem(id: string): Promise<void> {
  const current = getLocalSuratList();
  const updated = current.filter((x) => x.id !== id);
  setLocalSuratList(updated);

  if (db) {
    try {
      await deleteDoc(doc(db, SURAT_COLLECTION, id));
    } catch (err) {
      console.warn('Failed deleting surat from Firestore:', err);
    }
  }
}

export function subscribeSurat(
  onSuccess: (data: SuratKedinasanItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const initial = getLocalSuratList();
  if (initial.length > 0) {
    onSuccess(initial);
  }

  fetchSuratFromServer().then((serverItems) => {
    if (serverItems.length > 0) {
      onSuccess(serverItems);
    }
  });

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data && event.data.items) {
          memorySurat = event.data.items;
          onSuccess(event.data.items);
        }
      };
    }
  } catch {}

  const handleCustomEvent = (e: any) => {
    if (e && e.detail) {
      const current = getLocalSuratList();
      onSuccess(current);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('si-mangga-surat-updated', handleCustomEvent);
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const items: SuratKedinasanItem[] = [];
          snapshot.forEach((d) => {
            items.push(d.data() as SuratKedinasanItem);
          });
          if (items.length > 0) {
            memorySurat = items;
            safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
            onSuccess(items);
          }
        },
        (err) => {
          console.warn('Firestore snapshot error on surat_kedinasan:', err);
          if (onError) onError(err);
        }
      );
    } catch (e: any) {
      console.warn('Error setting up firestore snapshot on surat_kedinasan:', e);
      if (onError) onError(e);
    }
  }

  return () => {
    if (bc) {
      try { bc.close(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('si-mangga-surat-updated', handleCustomEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}
