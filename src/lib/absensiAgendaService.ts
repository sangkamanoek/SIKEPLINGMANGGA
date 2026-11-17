import { collection, getDocs, getDocsFromServer, query, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { resilientDeleteDoc, resilientSetDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  deleteReportFromIndexedDB,
  saveSingleReportToIndexedDB,
} from './indexedDbStorage';
import {
  AbsensiAgendaKepling,
  AbsensiKeplingEntry,
  AgendaKelurahanItem,
  LaporanHarianItem,
  StatusKehadiranKepling,
} from '../types';
import {
  KEPLING_ACCOUNTS,
  ROMAN_NUMERALS,
  getEffectiveProfile,
} from '../data/keplingList';

export const ABSENSI_STORAGE_KEY = 'sikepling_absensi_agenda_kepling_v1';
export const ABSENSI_COLLECTION = 'absensi_agenda_kepling';

export const getEffectiveKeplingList = () => {
  return KEPLING_ACCOUNTS.map((acc) => {
    const profile = getEffectiveProfile(acc);
    return {
      keplingId: acc.id,
      nomorLingkungan: acc.nomorLingkungan || 1,
      namaKepling: profile.nama || acc.nama,
      jabatan: acc.jabatan,
    };
  }).sort((a, b) => a.nomorLingkungan - b.nomorLingkungan);
};

export const buildDefaultAbsensiEntries = (
  defaultStatus: StatusKehadiranKepling = 'Hadir'
): Record<string, AbsensiKeplingEntry> => {
  const map: Record<string, AbsensiKeplingEntry> = {};
  getEffectiveKeplingList().forEach((k) => {
    map[k.keplingId] = {
      keplingId: k.keplingId,
      nomorLingkungan: k.nomorLingkungan,
      namaKepling: k.namaKepling,
      jabatan: k.jabatan,
      status: defaultStatus,
      catatan: '',
    };
  });
  return map;
};

export const buildMergedEntriesForAgenda = (
  existing?: AbsensiAgendaKepling | null,
  fallbackStatus: StatusKehadiranKepling = 'Hadir'
): Record<string, AbsensiKeplingEntry> => {
  const base = buildDefaultAbsensiEntries(fallbackStatus);
  if (!existing || !existing.entries) return base;

  Object.keys(base).forEach((kId) => {
    const saved = existing.entries[kId];
    if (saved) {
      base[kId] = {
        ...base[kId],
        status: saved.status || fallbackStatus,
        catatan: saved.catatan || '',
      };
    }
  });
  return base;
};

export const getLocalAbsensiAgendaList = (): AbsensiAgendaKepling[] => {
  const local = safeGetLocalStorage<AbsensiAgendaKepling[]>(ABSENSI_STORAGE_KEY, []);
  if (Array.isArray(local)) {
    return local.filter((x) => x && x.id && x.agendaId);
  }
  return [];
};

export const fetchAbsensiAgendaFromFirestore = async (): Promise<AbsensiAgendaKepling[]> => {
  const local = getLocalAbsensiAgendaList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;

  try {
    const colRef = collection(db, ABSENSI_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }

    const list: AbsensiAgendaKepling[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() as AbsensiAgendaKepling;
      if (d && docSnap.id) {
        list.push({ ...d, id: docSnap.id });
      }
    });

    list.sort((a, b) => (b.tanggalKegiatan || '').localeCompare(a.tanggalKegiatan || ''));

    if (list.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(ABSENSI_STORAGE_KEY, JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('absensi-agenda-updated'));
      }
      return list;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('fetchAbsensiAgendaFromFirestore warn:', err);
    }
  }

  return local;
};

export const subscribeAbsensiAgendaFromFirestore = (
  cb: (items: AbsensiAgendaKepling[]) => void
) => {
  const initialLocal = getLocalAbsensiAgendaList();
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
    const q = query(collection(db, ABSENSI_COLLECTION));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return;
        const list: AbsensiAgendaKepling[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as AbsensiAgendaKepling;
          if (d && docSnap.id) {
            list.push({ ...d, id: docSnap.id });
          }
        });
        list.sort((a, b) => (b.tanggalKegiatan || '').localeCompare(a.tanggalKegiatan || ''));

        if (!snapshot.metadata.fromCache) {
          receivedServer = true;
          safeSetLocalStorage(ABSENSI_STORAGE_KEY, JSON.stringify(list));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('absensi-agenda-updated'));
          }
          cb(list);
        } else if (list.length > 0) {
          safeSetLocalStorage(ABSENSI_STORAGE_KEY, JSON.stringify(list));
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
          fetchAbsensiAgendaFromFirestore().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServer && !isFirestoreQuotaCooldownActive()) {
        fetchAbsensiAgendaFromFirestore().then((items) => {
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

const sanitizeAgendaKey = (agendaId: string): string => {
  const clean = String(agendaId || 'ag').replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 55) return clean;
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (h * 31 + clean.charCodeAt(i)) | 0;
  }
  return `${clean.slice(0, 35)}_${Math.abs(h).toString(36)}`;
};

export const buildAgendaAttendanceReportId = (
  agendaId: string,
  nomorLingkungan: number
): string => `lap_ag_${sanitizeAgendaKey(agendaId)}_lk${nomorLingkungan}`;

/**
 * Otomatis mencatat Kepala Lingkungan yang berstatus "Hadir" pada Agenda Kelurahan
 * ke dalam Laporan Harian Kepling (Firestore `reports`, IndexedDB, LocalStorage),
 * serta membersihkan entri otomatis bila status diubah menjadi selain Hadir.
 */
export const syncAbsensiAgendaHadirToLaporanHarian = async (
  record: AbsensiAgendaKepling,
  previousRecord?: AbsensiAgendaKepling
): Promise<{ syncedHadir: number; removedNonHadir: number }> => {
  const LAPORAN_STORAGE_KEY = 'kepling_local_laporan_history_v2';
  const nowIso = new Date().toISOString();
  const parsedDate = parseIsoLocal(record.tanggalKegiatan);
  const hari = HARI_ID[parsedDate.getDay()] || 'Senin';
  const formattedTanggal = formatHariTanggalIndonesia(record.tanggalKegiatan);

  const upsertedReports: LaporanHarianItem[] = [];
  const deletedIds: string[] = [];
  const deletedKeplingIds: string[] = [];

  const agendaSummaryPrefix = `[Absensi Agenda Kelurahan] Hadir: ${record.namaKegiatan}`;
  const agendaDetailText = `${agendaSummaryPrefix}${
    record.jamKegiatan ? ` (${record.jamKegiatan})` : ''
  }${record.lokasi ? ` di ${record.lokasi}` : ''}`;

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
  const localIdSet = new Set(localReports.map((r) => r?.id).filter(Boolean));

  const entries = Object.values(record.entries || {});

  for (const entry of entries) {
    if (!entry || !entry.nomorLingkungan) continue;
    const reportId = buildAgendaAttendanceReportId(record.agendaId, entry.nomorLingkungan);
    const acc = KEPLING_ACCOUNTS.find(
      (k) => k.nomorLingkungan === entry.nomorLingkungan || k.id === entry.keplingId
    );
    const profile = acc ? getEffectiveProfile(acc) : null;
    const roman = ROMAN_NUMERALS[entry.nomorLingkungan - 1] || String(entry.nomorLingkungan);
    const resolvedKeplingId = acc?.id || entry.keplingId || `kepling_${entry.nomorLingkungan}`;

    if (entry.status === 'Hadir') {
      const reportItem: LaporanHarianItem = {
        id: reportId,
        keplingId: resolvedKeplingId,
        lingkungan: acc?.lingkungan || `Lingkungan ${roman}`,
        namaKepling: profile?.nama || acc?.nama || entry.namaKepling,
        jabatan: acc?.jabatan || entry.jabatan || `Kepala Lingkungan ${roman}`,
        kelurahan: 'Kelurahan Mangga',
        kecamatan: 'Kecamatan Medan Tuntungan',
        hari,
        tanggal: record.tanggalKegiatan,
        tanggalLaporan: record.tanggalKegiatan,
        kinerja: {
          opsirPbbWp: 0,
          perlinsosKk: 0,
          ikdOrang: 0,
          bpjsKetenagakerjaanOrang: 0,
          kegiatanLainnya: entry.catatan?.trim()
            ? `${agendaDetailText} — ${entry.catatan.trim()}`
            : agendaDetailText,
        },
        jumlahDokumentasi: 0,
        dokumentasiFoto: [],
        petugasNama: record.diinputOlehNama || 'Admin Kelurahan',
        petugasRole: record.diinputOlehRole || 'super_admin',
        uraianTugas: `Kehadiran Agenda Kelurahan: ${record.namaKegiatan} (${formattedTanggal})`,
        catatanUmum: entry.catatan?.trim()
          ? `Catatan Absensi Agenda: ${entry.catatan.trim()}`
          : 'Tercatat otomatis dari Absensi Kehadiran Agenda Kelurahan.',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      upsertedReports.push(reportItem);
    } else {
      const prevEntry =
        previousRecord?.entries?.[entry.keplingId] ||
        Object.values(previousRecord?.entries || {}).find(
          (pe) => pe.nomorLingkungan === entry.nomorLingkungan
        );
      if (prevEntry?.status === 'Hadir' || localIdSet.has(reportId)) {
        deletedIds.push(reportId);
        deletedKeplingIds.push(resolvedKeplingId);
      }
    }
  }

  // 1. Update LocalStorage cache dalam satu kali proses (hemat memori)
  try {
    const deleteSet = new Set(deletedIds);
    const deletedKeplingSet = new Set(deletedKeplingIds);
    const upsertMap = new Map<string, LaporanHarianItem>(
      upsertedReports.map((r) => [r.id, r])
    );

    const cleanedLocal = localReports
      .filter((r) => r && r.id && !deleteSet.has(r.id))
      .map((r) => {
        if (upsertMap.has(r.id)) {
          return upsertMap.get(r.id)!;
        }
        // Bersihkan baris agenda terkait hanya untuk Kepling yang statusnya diubah dari Hadir ke non-Hadir
        const repKeplingId = r.keplingId || '';
        const matchesDeletedTarget =
          deletedKeplingSet.has(repKeplingId) &&
          (r.tanggal === record.tanggalKegiatan || r.tanggalLaporan === record.tanggalKegiatan);
        if (
          matchesDeletedTarget &&
          r.kinerja?.kegiatanLainnya?.includes(agendaSummaryPrefix)
        ) {
          const filteredLines = r.kinerja.kegiatanLainnya
            .split('\n')
            .filter((line) => !line.includes(agendaSummaryPrefix))
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
      if (!cleanedLocal.some((r) => r.id === u.id)) {
        cleanedLocal.unshift(u);
      }
    });

    safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(cleanedLocal), {
      skipIdbMirror: true,
    });
  } catch {
    // Non-blocking fallback
  }

  // 2. Beri tahu App.tsx agar state Laporan Harian & Capaian Kinerja langsung terbarui
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sikepling-reports-updated', {
        detail: {
          upsertedReports,
          deletedIds,
          deletedKeplingIds,
          stripDate: record.tanggalKegiatan,
          stripPrefix: agendaSummaryPrefix,
        },
      })
    );
  }

  // 3. Sinkronkan ke IndexedDB & Cloud Firestore dalam batch kecil (6 dok/batch) agar ringan & bebas OutOfMemory
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

  for (let i = 0; i < deletedIds.length; i += BATCH_SIZE) {
    const chunk = deletedIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (id) => {
        await deleteReportFromIndexedDB(id).catch(() => {});
        await resilientDeleteDoc('reports', id).catch(() => {});
      })
    );
  }

  return {
    syncedHadir: upsertedReports.length,
    removedNonHadir: deletedIds.length,
  };
};

export const saveAbsensiAgendaRecord = async (
  record: AbsensiAgendaKepling
): Promise<{ ok: boolean; syncedHadir: number }> => {
  const current = getLocalAbsensiAgendaList();
  const nowIso = new Date().toISOString();
  const targetId = record.id || `abs_${record.agendaId}`;
  const previousRecord = current.find((x) => x.id === targetId);

  const payload: AbsensiAgendaKepling = {
    ...record,
    id: targetId,
    namaKegiatan: String(record.namaKegiatan || '').slice(0, 300),
    tanggalKegiatan: String(record.tanggalKegiatan || '').slice(0, 20),
    createdAt: record.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const exists = Boolean(previousRecord);
  const updated = exists
    ? current.map((x) => (x.id === payload.id ? payload : x))
    : [payload, ...current];

  safeSetLocalStorage(ABSENSI_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('absensi-agenda-updated'));
  }

  const cleaned = cleanFirestoreData(payload);
  const [res, syncStats] = await Promise.all([
    resilientSetDoc(ABSENSI_COLLECTION, payload.id, cleaned, { merge: true }),
    syncAbsensiAgendaHadirToLaporanHarian(payload, previousRecord).catch(() => ({
      syncedHadir: 0,
      removedNonHadir: 0,
    })),
  ]);

  return {
    ok: res.synced || res.queued,
    syncedHadir: syncStats.syncedHadir,
  };
};

// =========================================================================
// DATE & PERIOD HELPERS (HARIAN / MINGGUAN / BULANAN)
// =========================================================================

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const parseIsoLocal = (isoDate: string): Date => {
  const parts = (isoDate || '').split('-').map((n) => parseInt(n, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};

export const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatHariTanggalIndonesia = (isoDate: string): string => {
  if (!isoDate) return '-';
  const d = parseIsoLocal(isoDate);
  const hari = HARI_ID[d.getDay()];
  const tgl = d.getDate();
  const bln = BULAN_ID[d.getMonth()];
  const thn = d.getFullYear();
  return `${hari}, ${tgl} ${bln} ${thn}`;
};

export const formatTanggalSingkatIndonesia = (isoDate: string): string => {
  if (!isoDate) return '-';
  const d = parseIsoLocal(isoDate);
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
};

export const getWeekRangeFromIso = (isoDate: string) => {
  const base = parseIsoLocal(isoDate);
  const day = base.getDay(); // 0=Sun .. 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = toIsoDate(monday);
  const endIso = toIsoDate(sunday);
  return {
    startIso,
    endIso,
    label: `${formatHariTanggalIndonesia(startIso)} s/d ${formatHariTanggalIndonesia(endIso)}`,
  };
};

export const getMonthRangeFromYm = (ym: string) => {
  const [yStr, mStr] = (ym || '').split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const month = parseInt(mStr, 10) || new Date().getMonth() + 1;
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    startIso: toIsoDate(first),
    endIso: toIsoDate(last),
    label: `Bulan ${BULAN_ID[month - 1]} ${year}`,
    year,
    month,
  };
};

export const computeAttendanceSummaryForAgenda = (
  agenda: AgendaKelurahanItem,
  record?: AbsensiAgendaKepling | null
) => {
  const entries = Object.values(buildMergedEntriesForAgenda(record, 'Hadir'));
  const hasSavedRecord = Boolean(record);
  if (!hasSavedRecord) {
    return {
      agenda,
      hasSavedRecord: false,
      hadir: 0,
      tidakHadir: 0,
      sakit: 0,
      izin: 0,
      total: entries.length,
    };
  }
  let hadir = 0;
  let tidakHadir = 0;
  let sakit = 0;
  let izin = 0;
  entries.forEach((e) => {
    if (e.status === 'Hadir') hadir += 1;
    else if (e.status === 'Tidak Hadir') tidakHadir += 1;
    else if (e.status === 'Sakit') sakit += 1;
    else if (e.status === 'Izin') izin += 1;
  });
  return {
    agenda,
    hasSavedRecord: true,
    hadir,
    tidakHadir,
    sakit,
    izin,
    total: entries.length,
  };
};

export const exportAbsensiAgendaToExcel = (
  title: string,
  periodeLabel: string,
  agendas: AgendaKelurahanItem[],
  recordsByAgendaId: Record<string, AbsensiAgendaKepling>,
  filename: string
) => {
  const keplingList = getEffectiveKeplingList();
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Rekapitulasi 24 Kepling
  const summaryRows = keplingList.map((k, idx) => {
    let hadir = 0;
    let tidakHadir = 0;
    let sakit = 0;
    let izin = 0;
    let tercatat = 0;

    agendas.forEach((ag) => {
      const rec = recordsByAgendaId[ag.id];
      if (!rec) return;
      tercatat += 1;
      const st = rec.entries?.[k.keplingId]?.status || 'Hadir';
      if (st === 'Hadir') hadir += 1;
      else if (st === 'Tidak Hadir') tidakHadir += 1;
      else if (st === 'Sakit') sakit += 1;
      else if (st === 'Izin') izin += 1;
    });

    const pct = tercatat > 0 ? ((hadir / tercatat) * 100).toFixed(1) : '0.0';
    return {
      'No.': idx + 1,
      'Nama': k.namaKepling,
      'Jabatan': k.jabatan,
      'Total Agenda Tercatat': tercatat,
      'Hadir': hadir,
      'Tidak Hadir': tidakHadir,
      'Sakit': sakit,
      'Izin': izin,
      'Persentase Hadir (%)': `${pct}%`,
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 26 },
    { wch: 20 },
    { wch: 10 },
    { wch: 13 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Rekap Kehadiran Kepling');

  // Sheet 2: Rincian Per Agenda
  const detailRows: Record<string, any>[] = [];
  agendas.forEach((ag) => {
    const rec = recordsByAgendaId[ag.id];
    const entries = buildMergedEntriesForAgenda(rec, 'Hadir');
    keplingList.forEach((k, idx) => {
      const entry = entries[k.keplingId];
      const statusText = rec ? entry.status : 'Belum Diabsen';
      detailRows.push({
        'Hari / Tanggal': formatHariTanggalIndonesia(ag.tanggalKegiatan),
        'Nama Agenda': ag.namaKegiatan,
        'Lokasi': ag.lokasi || '-',
        'No.': idx + 1,
        'Nama': k.namaKepling,
        'Jabatan': k.jabatan,
        'Keterangan': statusText,
        'Catatan': entry?.catatan || '-',
      });
    });
  });

  if (detailRows.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 24 },
      { wch: 34 },
      { wch: 26 },
      { wch: 6 },
      { wch: 28 },
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsDetail, `Rincian ${title}`.slice(0, 31));
  }

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  return { periodeLabel };
};
