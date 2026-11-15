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
  AbsensiAgendaKepling,
  AbsensiKeplingEntry,
  AgendaKelurahanItem,
  StatusKehadiranKepling,
} from '../types';
import { KEPLING_ACCOUNTS, getEffectiveProfile } from '../data/keplingList';

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

export const saveAbsensiAgendaRecord = async (
  record: AbsensiAgendaKepling
): Promise<boolean> => {
  const current = getLocalAbsensiAgendaList();
  const nowIso = new Date().toISOString();
  const payload: AbsensiAgendaKepling = {
    ...record,
    id: record.id || `abs_${record.agendaId}`,
    namaKegiatan: String(record.namaKegiatan || '').slice(0, 300),
    tanggalKegiatan: String(record.tanggalKegiatan || '').slice(0, 20),
    createdAt: record.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const exists = current.some((x) => x.id === payload.id);
  const updated = exists
    ? current.map((x) => (x.id === payload.id ? payload : x))
    : [payload, ...current];

  safeSetLocalStorage(ABSENSI_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('absensi-agenda-updated'));
  }

  const cleaned = cleanFirestoreData(payload);
  const res = await resilientSetDoc(ABSENSI_COLLECTION, payload.id, cleaned, { merge: true });
  return res.synced || res.queued;
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
