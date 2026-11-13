import { collection, getDocs, getDocsFromServer, query, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { AgendaKelurahanItem, StatusAgendaType } from '../types';

const AGENDA_STORAGE_KEY = 'sikepling_agenda_kelurahan_v2';
const AGENDA_DELETED_KEY = 'sikepling_agenda_deleted_v1';

export const SAMPLE_AGENDA_ITEMS: AgendaKelurahanItem[] = [];

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

  if (local && Array.isArray(local)) {
    return local.filter((x) => x && x.id && !deletedSet.has(x.id));
  }

  return [];
};

export const fetchAgendaFromFirestore = async (): Promise<AgendaKelurahanItem[]> => {
  const local = getLocalAgendaList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;

  try {
    const deletedSet = new Set(getDeletedAgendaIds());
    const colRef = collection(db, 'agenda_kelurahan');
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }

    const firestoreList: AgendaKelurahanItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as AgendaKelurahanItem;
      if (data && d.id && !deletedSet.has(d.id)) {
        firestoreList.push({ ...data, id: d.id });
      }
    });

    firestoreList.sort((a, b) => (b.tanggalKegiatan || '').localeCompare(a.tanggalKegiatan || ''));

    if (firestoreList.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(firestoreList));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agenda-data-updated'));
      }
      return firestoreList;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('fetchAgendaFromFirestore warn:', err);
    }
  }

  return local;
};

export const saveAgendaItem = async (item: AgendaKelurahanItem): Promise<boolean> => {
  const current = getLocalAgendaList();
  const exists = current.some((a) => a.id === item.id);
  const updatedItem = { ...item, updatedAt: new Date().toISOString() };
  const updated = exists
    ? current.map((a) => (a.id === item.id ? updatedItem : a))
    : [updatedItem, ...current];

  safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });

  // Trigger cross-component sync event
  window.dispatchEvent(new CustomEvent('agenda-data-updated'));

  if (!item.id) return true;

  const cleaned = cleanFirestoreData(updatedItem);
  const res = await resilientSetDoc('agenda_kelurahan', item.id, cleaned, { merge: true });
  return res.synced || res.queued;
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
  safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });

  window.dispatchEvent(new CustomEvent('agenda-data-updated'));

  if (!id) return true;

  const res = await resilientDeleteDoc('agenda_kelurahan', id);
  return res.synced || res.queued;
};

export const subscribeAgendaFromFirestore = (cb: (items: AgendaKelurahanItem[]) => void) => {
  const initialLocal = getLocalAgendaList();
  if (initialLocal.length > 0) {
    cb(initialLocal);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    if (initialLocal.length === 0) cb([]);
    return () => {};
  }

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const q = query(collection(db, 'agenda_kelurahan'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return;
        const deletedSet = new Set(getDeletedAgendaIds());
        const firestoreItems: AgendaKelurahanItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as AgendaKelurahanItem;
          if (d && docSnap.id && !deletedSet.has(docSnap.id)) {
            firestoreItems.push({ ...d, id: docSnap.id });
          }
        });

        firestoreItems.sort((a, b) => (b.tanggalKegiatan || '').localeCompare(a.tanggalKegiatan || ''));

        if (!snapshot.metadata.fromCache) {
          receivedServerSnapshot = true;
          safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(firestoreItems));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('agenda-data-updated'));
          }
          cb(firestoreItems);
        } else if (firestoreItems.length > 0) {
          safeSetLocalStorage(AGENDA_STORAGE_KEY, JSON.stringify(firestoreItems));
          cb(firestoreItems);
        }
      },
      (err) => {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try { unsub(); } catch {}
          return;
        }
        console.warn('subscribeAgendaFromFirestore error, trying getDocs fallback:', err);
        if (!isFirestoreQuotaCooldownActive()) {
          fetchAgendaFromFirestore().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchAgendaFromFirestore().then((items) => {
          if (isActive && !receivedServerSnapshot) {
            cb(items);
          }
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { unsub(); } catch {}
    };
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
