import { collection, getDocs, getDocsFromServer, query, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  AbsensiApelEntry,
  AbsensiApelHarian,
  StatusApelPagi,
} from '../types';
import {
  formatHariTanggalIndonesia,
  getEffectiveKeplingList,
  getMonthRangeFromYm,
  getWeekRangeFromIso,
} from './absensiAgendaService';

export const APEL_PAGI_STORAGE_KEY = 'sikepling_absensi_apel_pagi_v1';
export const APEL_PAGI_COLLECTION = 'absensi_apel_pagi';

export const STATUS_APEL_OPTIONS: StatusApelPagi[] = [
  'Hadir',
  'Terlambat',
  'Izin',
  'Sakit',
  'Alpa',
];

/**
 * Skor disiplin per status Apel Pagi (skala 0..1):
 * Hadir tepat waktu = 1.0 (100%)
 * Terlambat = 0.6 (60%)
 * Izin / Sakit = 0.5 (50% - keterangan sah)
 * Alpa / Tanpa Keterangan = 0 (0%)
 */
export const getApelStatusScore = (status: StatusApelPagi | string | undefined): number => {
  if (status === 'Hadir') return 1;
  if (status === 'Terlambat') return 0.6;
  if (status === 'Izin' || status === 'Sakit') return 0.5;
  if (status === 'Alpa') return 0;
  return 1;
};

export const buildDefaultApelEntries = (
  defaultStatus: StatusApelPagi = 'Hadir'
): Record<string, AbsensiApelEntry> => {
  const map: Record<string, AbsensiApelEntry> = {};
  getEffectiveKeplingList().forEach((k) => {
    map[k.keplingId] = {
      keplingId: k.keplingId,
      nomorLingkungan: k.nomorLingkungan,
      namaKepling: k.namaKepling,
      jabatan: k.jabatan,
      status: defaultStatus,
      jamHadir: defaultStatus === 'Hadir' ? '07:45 WIB' : '',
      catatan: '',
    };
  });
  return map;
};

export const buildMergedApelEntries = (
  existing?: AbsensiApelHarian | null,
  fallbackStatus: StatusApelPagi = 'Hadir'
): Record<string, AbsensiApelEntry> => {
  const base = buildDefaultApelEntries(fallbackStatus);
  if (!existing || !existing.entries) return base;

  Object.keys(base).forEach((kId) => {
    const saved = existing.entries[kId];
    if (saved) {
      base[kId] = {
        ...base[kId],
        status: saved.status || fallbackStatus,
        jamHadir: saved.jamHadir || '',
        catatan: saved.catatan || '',
      };
    }
  });
  return base;
};

export const getLocalAbsensiApelList = (): AbsensiApelHarian[] => {
  const local = safeGetLocalStorage<AbsensiApelHarian[]>(APEL_PAGI_STORAGE_KEY, []);
  if (Array.isArray(local)) {
    return local
      .filter((x) => x && x.id && x.tanggal)
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  }
  return [];
};

export const fetchAbsensiApelFromFirestore = async (): Promise<AbsensiApelHarian[]> => {
  const local = getLocalAbsensiApelList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;

  try {
    const colRef = collection(db, APEL_PAGI_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }

    const list: AbsensiApelHarian[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() as AbsensiApelHarian;
      if (d && docSnap.id && d.tanggal) {
        list.push({ ...d, id: docSnap.id });
      }
    });

    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    if (list.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(APEL_PAGI_STORAGE_KEY, JSON.stringify(list), { skipIdbMirror: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('absensi-apel-updated'));
      }
      return list;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('fetchAbsensiApelFromFirestore warn:', err);
    }
  }

  return local;
};

export const subscribeAbsensiApelFromFirestore = (
  cb: (items: AbsensiApelHarian[]) => void
) => {
  const initialLocal = getLocalAbsensiApelList();
  if (initialLocal.length > 0) {
    cb(initialLocal);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    if (initialLocal.length === 0) cb([]);
    return () => {};
  }

  let isActive = true;
  let receivedServer = false;
  let fallbackTimer: any = null;

  try {
    const q = query(collection(db, APEL_PAGI_COLLECTION));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return;
        const list: AbsensiApelHarian[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as AbsensiApelHarian;
          if (d && docSnap.id && d.tanggal) {
            list.push({ ...d, id: docSnap.id });
          }
        });
        list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

        if (!snapshot.metadata.fromCache) {
          receivedServer = true;
          safeSetLocalStorage(APEL_PAGI_STORAGE_KEY, JSON.stringify(list), { skipIdbMirror: true });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('absensi-apel-updated'));
          }
          cb(list);
        } else if (list.length > 0) {
          safeSetLocalStorage(APEL_PAGI_STORAGE_KEY, JSON.stringify(list), { skipIdbMirror: true });
          cb(list);
        }
      },
      (err) => {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try {
            unsub();
          } catch {}
          return;
        }
        if (!isFirestoreQuotaCooldownActive()) {
          fetchAbsensiApelFromFirestore().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServer && !isFirestoreQuotaCooldownActive()) {
        fetchAbsensiApelFromFirestore().then((items) => {
          if (isActive && !receivedServer) cb(items);
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        unsub();
      } catch {}
    };
  } catch {
    cb(initialLocal);
    return () => {};
  }
};

export const saveAbsensiApelRecord = async (
  record: AbsensiApelHarian
): Promise<{ ok: boolean }> => {
  const current = getLocalAbsensiApelList();
  const nowIso = new Date().toISOString();
  const targetId = record.id || `apel_${record.tanggal}`;
  const existing = current.find((x) => x.id === targetId || x.tanggal === record.tanggal);

  const payload: AbsensiApelHarian = {
    ...record,
    id: targetId,
    tanggal: String(record.tanggal || '').slice(0, 20),
    waktuApel: record.waktuApel || '07.30 - 08.00 WIB',
    lokasi: record.lokasi || 'Halaman Kantor Lurah Mangga',
    createdAt: existing?.createdAt || record.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const updated = existing
    ? current.map((x) => (x.id === payload.id ? payload : x))
    : [payload, ...current];

  updated.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  safeSetLocalStorage(APEL_PAGI_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('absensi-apel-updated'));
  }

  const cleaned = cleanFirestoreData(payload);
  const res = await resilientSetDoc(APEL_PAGI_COLLECTION, payload.id, cleaned, { merge: true });
  return { ok: res.synced || res.queued };
};

export const exportAbsensiApelToExcel = (
  title: string,
  periodeLabel: string,
  records: AbsensiApelHarian[],
  filename: string
) => {
  const keplingList = getEffectiveKeplingList();
  const workbook = XLSX.utils.book_new();

  const summaryRows = keplingList.map((k, idx) => {
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    let scoreSum = 0;

    records.forEach((rec) => {
      const entry =
        rec.entries?.[k.keplingId] ||
        Object.values(rec.entries || {}).find(
          (e) =>
            e.nomorLingkungan === k.nomorLingkungan ||
            e.namaKepling?.trim().toLowerCase() === k.namaKepling.trim().toLowerCase()
        );
      const st: StatusApelPagi = entry?.status || 'Hadir';
      if (st === 'Hadir') hadir += 1;
      else if (st === 'Terlambat') terlambat += 1;
      else if (st === 'Izin') izin += 1;
      else if (st === 'Sakit') sakit += 1;
      else if (st === 'Alpa') alpa += 1;
      scoreSum += getApelStatusScore(st);
    });

    const total = records.length;
    const pct = total > 0 ? ((scoreSum / total) * 100).toFixed(1) : '0.0';
    return {
      'No.': idx + 1,
      'Nama': k.namaKepling,
      'Jabatan': k.jabatan,
      'Total Hari Apel': total,
      'Hadir': hadir,
      'Terlambat': terlambat,
      'Izin': izin,
      'Sakit': sakit,
      'Alpa': alpa,
      'Skor Disiplin Apel (%)': `${pct}%`,
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 26 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Rekap Apel Pagi');

  const detailRows: Record<string, any>[] = [];
  records.forEach((rec) => {
    const entries = buildMergedApelEntries(rec, 'Hadir');
    keplingList.forEach((k, idx) => {
      const entry = entries[k.keplingId];
      detailRows.push({
        'Hari / Tanggal': formatHariTanggalIndonesia(rec.tanggal),
        'Waktu Apel': rec.waktuApel || '07.30 - 08.00 WIB',
        'No.': idx + 1,
        'Nama': k.namaKepling,
        'Jabatan': k.jabatan,
        'Status Kehadiran': entry.status,
        'Jam Hadir': entry.jamHadir || '-',
        'Catatan': entry.catatan || '-',
      });
    });
  });

  if (detailRows.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 24 },
      { wch: 20 },
      { wch: 6 },
      { wch: 28 },
      { wch: 24 },
      { wch: 16 },
      { wch: 14 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsDetail, `Rincian ${title}`.slice(0, 31));
  }

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  return { periodeLabel, getWeekRangeFromIso, getMonthRangeFromYm };
};
