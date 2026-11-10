import { collection, getDocs, doc, setDoc, deleteDoc, query, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { AgendaKelurahanItem, StatusAgendaType } from '../types';

const AGENDA_STORAGE_KEY = 'sikepling_agenda_kelurahan_v2';
const AGENDA_DELETED_KEY = 'sikepling_agenda_deleted_v1';

export const SAMPLE_AGENDA_ITEMS: AgendaKelurahanItem[] = [
  {
    id: 'ag_01_2026',
    namaKegiatan: 'Rapat Koordinasi Evaluasi PBB-P2 & Optimalisasi Pendataan Lingkungan',
    tanggalKegiatan: '2026-10-30',
    jamKegiatan: '09:00 WIB',
    lokasi: 'Aula Utama Kantor Kelurahan Mangga',
    peserta: 'Lurah, Seklur, Kasi Pemerintahan, & 24 Kepala Lingkungan',
    statusSelesai: 'BELUM',
    catatan: 'Seluruh Kepling wajib membawa rekapitulasi SPPT PBB-P2 dan daftar warga yang belum bayar.',
    penanggungJawab: 'Kasi Tata Pemerintahan',
    createdByName: 'KASI TATA PEMERINTAHAN',
    createdByRole: 'kasi_pemerintahan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ag_02_2026',
    namaKegiatan: 'Pelaksanaan Posyandu ILP & Penimbangan Balita Stunting',
    tanggalKegiatan: '2026-10-28',
    jamKegiatan: '08:30 WIB',
    lokasi: 'Posyandu Kapas Lingkungan XVIII',
    peserta: 'Bidan Kelurahan, TP-PKK Lingkungan XVIII, & 29 Warga Balita/Lansia',
    statusSelesai: 'SELESAI',
    catatan: 'Pelayanan penimbangan 29 warga berjalan lancar. Pemberian PMT balita terlaksana.',
    penanggungJawab: 'Ketua TP-PKK Kelurahan / Kader Posyandu',
    createdByName: 'Ketua PKK Lingkungan XVIII',
    createdByRole: 'ketua_pkk_lingkungan',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ag_03_2026',
    namaKegiatan: 'Gotong Royong Massal Kebersihan Drainase Parit Anti-Banjir',
    tanggalKegiatan: '2026-10-25',
    jamKegiatan: '07:30 WIB',
    lokasi: 'Ruas Jl. Flamboyan Raya & Parit Utama Lk. IV & V',
    peserta: 'Kepling Lk. IV & V, Tim Trantibum, P3SU, & Warga Sekitar',
    statusSelesai: 'SELESAI',
    catatan: 'Pembersihan parit sepanjang 250m selesai. Sampah diangkut truk kebersihan.',
    penanggungJawab: 'Kasi Trantibum & Linmas',
    createdByName: 'KASI TRANTIBUM',
    createdByRole: 'kasi_trantibum',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'ag_04_2026',
    namaKegiatan: 'Apel Pagi Gabungan & Evaluasi Disiplin Kepling 24 Lingkungan',
    tanggalKegiatan: '2026-11-02',
    jamKegiatan: '07:30 WIB',
    lokasi: 'Halaman Kantor Kelurahan Mangga',
    peserta: 'Lurah, Seklur, Seluruh Kasi, ASN, & 24 Kepala Lingkungan',
    statusSelesai: 'BELUM',
    catatan: 'Peserta wajib hadir tepat waktu di Halaman Kantor Kelurahan Mangga.',
    penanggungJawab: 'Sekretaris Kelurahan / Lurah',
    createdByName: 'SUPER ADMIN',
    createdByRole: 'super_admin',
    createdAt: new Date().toISOString(),
  },
];

let deletedAgendaIdsCache: string[] = safeGetLocalStorage<string[]>(AGENDA_DELETED_KEY, []);

export const getDeletedAgendaIds = (): string[] => {
  if (!Array.isArray(deletedAgendaIdsCache)) deletedAgendaIdsCache = [];
  return deletedAgendaIdsCache;
};

export const markAgendaDeleted = (id: string): void => {
  const current = getDeletedAgendaIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedAgendaIdsCache = current;
    safeSetLocalStorage(AGENDA_DELETED_KEY, JSON.stringify(current));
  }
};

export const getLocalAgendaList = (): AgendaKelurahanItem[] => {
  const deletedSet = new Set(getDeletedAgendaIds());
  const local = safeGetLocalStorage<AgendaKelurahanItem[]>(AGENDA_STORAGE_KEY, []);
  
  // 1. If we have local user-saved data, use it (filtered by deletions)
  if (local && Array.isArray(local) && local.length > 0) {
    const filteredLocal = local.filter(x => !deletedSet.has(x.id));
    // If user has saved things but then deleted everything, we should probably respect that.
    // However, if the deletion was just of a sample, we might still want to see the rest.
    if (filteredLocal.length > 0 || local.some(x => !SAMPLE_AGENDA_ITEMS.some(s => s.id === x.id))) {
      return filteredLocal;
    }
  }

  // 2. If no user data, return sample data (filtered by deletions)
  return SAMPLE_AGENDA_ITEMS.filter(x => !deletedSet.has(x.id));
};

export const fetchAgendaFromFirestore = async (): Promise<AgendaKelurahanItem[]> => {
  const local = getLocalAgendaList();
  if (!db) return local;

  try {
    const deletedSet = new Set(getDeletedAgendaIds());
    const snap = await getDocs(collection(db, 'agenda_kelurahan'));
    const firestoreList: AgendaKelurahanItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as AgendaKelurahanItem;
      if (data && d.id && !deletedSet.has(d.id)) {
        firestoreList.push({ ...data, id: d.id });
      }
    });

    if (firestoreList.length > 0) {
      // Merge with local items by id
      const map = new Map<string, AgendaKelurahanItem>();
      local.forEach((item) => map.set(item.id, item));
      firestoreList.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values()).sort((a, b) =>
        b.tanggalKegiatan.localeCompare(a.tanggalKegiatan)
      );
      safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('fetchAgendaFromFirestore warn:', err);
  }

  return local;
};

export const saveAgendaItem = async (item: AgendaKelurahanItem): Promise<boolean> => {
  const current = getLocalAgendaList();
  const exists = current.some((a) => a.id === item.id);
  const updated = exists
    ? current.map((a) => (a.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : a))
    : [item, ...current];

  safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(updated));

  // Trigger cross-component sync event
  window.dispatchEvent(new CustomEvent('agenda-data-updated'));

  if (!db || !item.id) return true;

  try {
    const cleaned = cleanFirestoreData({
      ...item,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agenda_kelurahan', item.id), cleaned, { merge: true });
    return true;
  } catch (err) {
    console.error('saveAgendaItem firestore error:', err);
    return false;
  }
};

export const updateAgendaStatus = async (
  id: string,
  newStatus: StatusAgendaType,
  catatanTambahan?: string
): Promise<boolean> => {
  const current = getLocalAgendaList();
  const found = current.find((a) => a.id === id);
  if (!found) return false;

  const updatedItem: AgendaKelurahanItem = {
    ...found,
    statusSelesai: newStatus,
    catatan: catatanTambahan !== undefined ? catatanTambahan : found.catatan,
    updatedAt: new Date().toISOString(),
  };

  return saveAgendaItem(updatedItem);
};

export const deleteAgendaItem = async (id: string): Promise<boolean> => {
  markAgendaDeleted(id);
  const current = getLocalAgendaList();
  const updated = current.filter((a) => a.id !== id);
  safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(updated));

  window.dispatchEvent(new CustomEvent('agenda-data-updated'));

  if (!db || !id) return true;

  try {
    await deleteDoc(doc(db, 'agenda_kelurahan', id));
    return true;
  } catch (err) {
    console.error('deleteAgendaItem firestore error:', err);
    return false;
  }
};

export const subscribeAgendaFromFirestore = (cb: (items: AgendaKelurahanItem[]) => void) => {
  if (!db) {
    cb(getLocalAgendaList());
    return () => {};
  }

  try {
    const q = query(collection(db, 'agenda_kelurahan'));
    return onSnapshot(
      q,
      (snapshot) => {
        const deletedSet = new Set(getDeletedAgendaIds());
        const firestoreItems: AgendaKelurahanItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as AgendaKelurahanItem;
          if (d && docSnap.id && !deletedSet.has(docSnap.id)) {
            firestoreItems.push({ ...d, id: docSnap.id });
          }
        });

        if (firestoreItems.length > 0) {
          const local = getLocalAgendaList();
          const map = new Map<string, AgendaKelurahanItem>();
          local.forEach((item) => map.set(item.id, item));
          firestoreItems.forEach((item) => map.set(item.id, item));
          const merged = Array.from(map.values()).sort((a, b) =>
            b.tanggalKegiatan.localeCompare(a.tanggalKegiatan)
          );
          safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(merged));
          cb(merged);
        } else {
          cb(getLocalAgendaList());
        }
      },
      (err) => {
        console.warn('subscribeAgendaFromFirestore error:', err);
        cb(getLocalAgendaList());
      }
    );
  } catch (e) {
    cb(getLocalAgendaList());
    return () => {};
  }
};

/**
 * Exports the Agenda list to an Excel file (.xlsx) formatted neatly with all user-requested columns
 */
export const exportAgendaToExcel = (
  items: AgendaKelurahanItem[],
  filename = 'Agenda_Kegiatan_Kelurahan_Mangga.xlsx'
) => {
  const dataForExcel = items.map((item, index) => {
    const statusLabel =
      item.statusSelesai === 'SELESAI'
        ? 'Selesai 100%'
        : item.statusSelesai === 'PROSES'
        ? 'Sedang Berlangsung'
        : item.statusSelesai === 'BATAL'
        ? 'Dibatalkan'
        : 'Belum Selesai (Mendatang)';

    return {
      'No': index + 1,
      'Nama Kegiatan': item.namaKegiatan,
      'Tanggal Kegiatan': item.tanggalKegiatan,
      'Jam Kegiatan': item.jamKegiatan || '-',
      'Lokasi Kegiatan': item.lokasi,
      'Peserta / Sasaran': item.peserta,
      'Status Selesai': statusLabel,
      'Catatan / Uraian Hasil': item.catatan || '-',
      'Penanggung Jawab': item.penanggungJawab || item.createdByName || 'Kelurahan Mangga',
      'Tanggal Input': item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 38 }, // Nama Kegiatan
    { wch: 16 }, // Tanggal Kegiatan
    { wch: 14 }, // Jam Kegiatan
    { wch: 32 }, // Lokasi Kegiatan
    { wch: 32 }, // Peserta
    { wch: 22 }, // Status Selesai
    { wch: 38 }, // Catatan
    { wch: 26 }, // Penanggung Jawab
    { wch: 16 }, // Tanggal Input
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agenda Kelurahan');
  XLSX.writeFile(workbook, filename);
};
