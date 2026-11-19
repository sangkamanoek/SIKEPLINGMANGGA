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
import { saveSingleReportToIndexedDB } from './indexedDbStorage';
import {
  AbsensiApelEntry,
  AbsensiApelHarian,
  LaporanHarianItem,
  StatusApelPagi,
} from '../types';
import {
  KEPLING_ACCOUNTS,
  ROMAN_NUMERALS,
  getEffectiveProfile,
} from '../data/keplingList';
import {
  formatHariTanggalIndonesia,
  getEffectiveKeplingList,
  getMonthRangeFromYm,
  getWeekRangeFromIso,
  parseIsoLocal,
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
 * Alpa / Tanpa Keterangan = 0 (0%) + Penalti langsung Poin Capaian Target (IKKT)
 */
export const PENALTI_POIN_APEL_ALPA = 3.0;
export const PENALTI_POIN_AGENDA_ALPHA = 1.5;

export const getApelStatusScore = (status: StatusApelPagi | string | undefined): number => {
  if (status === 'Hadir') return 1;
  if (status === 'Terlambat') return 0.6;
  if (status === 'Izin' || status === 'Sakit') return 0.5;
  if (status === 'Alpa') return 0;
  return 1;
};

/**
 * Menghitung total pengurangan Poin Capaian Target (IKKT 0-100) akibat
 * ketidakhadiran tanpa keterangan (Alpa Apel Pagi & Tidak Hadir Agenda/Kegiatan).
 * Status Izin dan Sakit yang sah tidak dikenakan pengurangan poin langsung.
 */
export const calculatePenaltiTanpaKeterangan = (
  apelAlpa: number,
  kegiatanTidakHadirTanpaKeterangan: number = 0
): {
  penaltiApelAlpa: number;
  penaltiAgendaAlpha: number;
  totalPenalti: number;
} => {
  const safeApelAlpa = Math.max(0, Number(apelAlpa || 0));
  const safeAgendaAlpha = Math.max(0, Number(kegiatanTidakHadirTanpaKeterangan || 0));
  const penaltiApelAlpa = Number((safeApelAlpa * PENALTI_POIN_APEL_ALPA).toFixed(1));
  const penaltiAgendaAlpha = Number((safeAgendaAlpha * PENALTI_POIN_AGENDA_ALPHA).toFixed(1));
  const totalPenalti = Number((penaltiApelAlpa + penaltiAgendaAlpha).toFixed(1));
  return {
    penaltiApelAlpa,
    penaltiAgendaAlpha,
    totalPenalti,
  };
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

const HARI_APEL_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const buildApelAttendanceReportId = (
  tanggal: string,
  nomorLingkungan: number
): string => {
  const cleanDate = String(tanggal || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return `lap_ap_${cleanDate}_lk${nomorLingkungan}`;
};

/**
 * Otomatis mencatat seluruh status kehadiran Apel Pagi (HADIR, TERLAMBAT, IZIN, SAKIT, ALPA)
 * yang telah dikonfirmasi/disimpan oleh Admin ke dalam Laporan Harian Kepling
 * (Firestore `reports`, IndexedDB, LocalStorage).
 */
export const syncAbsensiApelToLaporanHarian = async (
  record: AbsensiApelHarian
): Promise<{
  syncedHadir: number;
  syncedTerlambat: number;
  syncedIzin: number;
  syncedSakit: number;
  syncedAlpa: number;
  totalSynced: number;
}> => {
  const LAPORAN_STORAGE_KEY = 'kepling_local_laporan_history_v2';
  const nowIso = new Date().toISOString();
  const parsedDate = parseIsoLocal(record.tanggal);
  const hari = HARI_APEL_ID[parsedDate.getDay()] || 'Senin';
  const formattedTanggal = formatHariTanggalIndonesia(record.tanggal);

  const apelTagPrefix = '[Absensi Apel Pagi]';
  const apelTitleMarker = 'Apel Pagi Kelurahan';
  const waktuApel = record.waktuApel || '07.30 - 08.00 WIB';
  const lokasiApel = record.lokasi || 'Halaman Kantor Lurah Mangga';

  const upsertedReports: LaporanHarianItem[] = [];
  const upsertedKeplingIds: string[] = [];

  let syncedHadir = 0;
  let syncedTerlambat = 0;
  let syncedIzin = 0;
  let syncedSakit = 0;
  let syncedAlpa = 0;

  const getStatusUpper = (status: StatusApelPagi | string | undefined): string => {
    if (status === 'Terlambat') return 'TERLAMBAT';
    if (status === 'Izin') return 'IZIN';
    if (status === 'Sakit') return 'SAKIT';
    if (status === 'Alpa') return 'ALPA';
    return 'HADIR';
  };

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
  const entries = Object.values(record.entries || {});

  for (const entry of entries) {
    if (!entry || !entry.nomorLingkungan) continue;
    const reportId = buildApelAttendanceReportId(record.tanggal, entry.nomorLingkungan);
    const acc = KEPLING_ACCOUNTS.find(
      (k) => k.nomorLingkungan === entry.nomorLingkungan || k.id === entry.keplingId
    );
    const profile = acc ? getEffectiveProfile(acc) : null;
    const roman = ROMAN_NUMERALS[entry.nomorLingkungan - 1] || String(entry.nomorLingkungan);
    const resolvedKeplingId = acc?.id || entry.keplingId || `kepling_${entry.nomorLingkungan}`;

    const status = entry.status || 'Hadir';
    const statusUpper = getStatusUpper(status);
    if (status === 'Hadir') syncedHadir += 1;
    else if (status === 'Terlambat') syncedTerlambat += 1;
    else if (status === 'Izin') syncedIzin += 1;
    else if (status === 'Sakit') syncedSakit += 1;
    else if (status === 'Alpa') syncedAlpa += 1;

    const jamSuffix =
      (status === 'Hadir' || status === 'Terlambat') && entry.jamHadir?.trim()
        ? ` • Pukul ${entry.jamHadir.trim()}`
        : '';

    const apelDetailText = `${apelTagPrefix} ${statusUpper}: ${apelTitleMarker} (${waktuApel}${jamSuffix}) di ${lokasiApel}${
      entry.catatan?.trim() ? ` — ${entry.catatan.trim()}` : ''
    }`;

    const reportItem: LaporanHarianItem = {
      id: reportId,
      keplingId: resolvedKeplingId,
      lingkungan: acc?.lingkungan || `Lingkungan ${roman}`,
      namaKepling: profile?.nama || acc?.nama || entry.namaKepling,
      jabatan: acc?.jabatan || entry.jabatan || `Kepala Lingkungan ${roman}`,
      kelurahan: 'Kelurahan Mangga',
      kecamatan: 'Kecamatan Medan Tuntungan',
      hari,
      tanggal: record.tanggal,
      tanggalLaporan: record.tanggal,
      kinerja: {
        opsirPbbWp: 0,
        perlinsosKk: 0,
        ikdOrang: 0,
        bpjsKetenagakerjaanOrang: 0,
        kegiatanLainnya: apelDetailText,
      },
      jumlahDokumentasi: 0,
      dokumentasiFoto: [],
      petugasNama: record.diinputOlehNama || 'Admin Kelurahan',
      petugasRole: record.diinputOlehRole || 'super_admin',
      uraianTugas: `Absensi Apel Pagi (${statusUpper}): ${formattedTanggal}`,
      catatanUmum: entry.catatan?.trim()
        ? `Catatan Apel Pagi (${statusUpper}): ${entry.catatan.trim()}`
        : `Tercatat otomatis dari Absensi Apel Pagi (Status: ${statusUpper}, dikonfirmasi oleh ${
            record.diinputOlehNama || 'Admin Kelurahan'
          }).`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    upsertedReports.push(reportItem);
    upsertedKeplingIds.push(resolvedKeplingId);
  }

  try {
    const upsertedKeplingSet = new Set(upsertedKeplingIds);
    const upsertMap = new Map<string, LaporanHarianItem>(
      upsertedReports.map((r) => [r.id, r])
    );

    const cleanedLocal = localReports.map((r) => {
      if (!r || !r.id) return r;
      if (upsertMap.has(r.id)) {
        return upsertMap.get(r.id)!;
      }
      const repKeplingId = r.keplingId || '';
      const matchesTarget =
        upsertedKeplingSet.has(repKeplingId) &&
        (r.tanggal === record.tanggal || r.tanggalLaporan === record.tanggal);
      if (
        matchesTarget &&
        r.kinerja?.kegiatanLainnya?.includes(apelTagPrefix) &&
        r.kinerja?.kegiatanLainnya?.includes(apelTitleMarker)
      ) {
        const filteredLines = r.kinerja.kegiatanLainnya
          .split('\n')
          .filter((line) => !(line.includes(apelTagPrefix) && line.includes(apelTitleMarker)))
          .map((line) => line.replace(/^•\s*/, '').trim())
          .filter(Boolean);
        return {
          ...r,
          kinerja: {
            ...r.kinerja,
            kegiatanLainnya: filteredLines.join('\n• '),
          },
        };
      }
      return r;
    });

    upsertedReports.forEach((u) => {
      if (!cleanedLocal.some((r) => r && r.id === u.id)) {
        cleanedLocal.unshift(u);
      }
    });

    safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(cleanedLocal), {
      skipIdbMirror: true,
    });
  } catch {
    // Non-blocking fallback
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sikepling-reports-updated', {
        detail: {
          upsertedReports,
          deletedIds: [],
          deletedKeplingIds: upsertedKeplingIds,
          stripDate: record.tanggal,
          stripPrefix: apelTagPrefix,
          stripAgendaName: apelTitleMarker,
        },
      })
    );
  }

  const BATCH_SIZE = 6;
  for (let i = 0; i < upsertedReports.length; i += BATCH_SIZE) {
    const chunk = upsertedReports.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        await saveSingleReportToIndexedDB(item).catch(() => {});
        const cleaned = cleanFirestoreData(item);
        await resilientSetDoc('reports', item.id, cleaned, { merge: true }).catch(() => {});
      })
    );
  }

  return {
    syncedHadir,
    syncedTerlambat,
    syncedIzin,
    syncedSakit,
    syncedAlpa,
    totalSynced: upsertedReports.length,
  };
};

export const saveAbsensiApelRecord = async (
  record: AbsensiApelHarian
): Promise<{
  ok: boolean;
  syncedHadir: number;
  syncedTerlambat: number;
  syncedIzin: number;
  syncedSakit: number;
  syncedAlpa: number;
  totalSynced: number;
}> => {
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
  const [res, syncStats] = await Promise.all([
    resilientSetDoc(APEL_PAGI_COLLECTION, payload.id, cleaned, { merge: true }),
    syncAbsensiApelToLaporanHarian(payload).catch(() => ({
      syncedHadir: 0,
      syncedTerlambat: 0,
      syncedIzin: 0,
      syncedSakit: 0,
      syncedAlpa: 0,
      totalSynced: 0,
    })),
  ]);

  return {
    ok: res.synced || res.queued,
    ...syncStats,
  };
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
