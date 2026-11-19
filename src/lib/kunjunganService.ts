import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc, isDocQueuedForWrite } from './firestoreWriteQueue';
import { ensureCompactDataUrl } from './imageCompressor';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  getVisitsFromIndexedDB,
  saveVisitsToIndexedDB,
  saveSingleReportToIndexedDB,
  deleteReportFromIndexedDB,
  getReportsFromIndexedDB,
  getSingleReportFromIndexedDB,
} from './indexedDbStorage';
import { mergeFotoArraysPreservingUrls } from './reportConsolidator';
import { LaporanHarianItem, FotoDokumentasi, UserAccount } from '../types';
import { KEPLING_ACCOUNTS, ROMAN_NUMERALS, getEffectiveProfile } from '../data/keplingList';
import {
  extractNomorLingkungan,
  getNamaHariIndonesia,
  getReportIsoDate,
  getTodayLocalIso,
  isKunjunganMatchingKepling,
} from './formatter';

export const KUNJUNGAN_COLLECTION = 'kunjungan_warga';
export const KUNJUNGAN_STORAGE_KEY = 'sikepling_kunjungan_warga_v2';
export const KUNJUNGAN_DELETED_KEY = 'sikepling_kunjungan_deleted_v2';
export const KUNJUNGAN_CHANNEL = 'sikepling_kunjungan_channel';
const LAPORAN_STORAGE_KEY = 'kepling_local_laporan_history_v2';
const KUNJUNGAN_LAPORAN_PREFIX = '[Kunjungan Warga]';

export interface KunjunganWargaData {
  id: string;
  tanggal: string;
  namaWarga: string;
  nik?: string;
  alamat: string;
  lingkungan: string;
  lingkunganNomor?: number;
  namaKepling: string;
  keplingId?: string;
  perlinsos?: string;
  ikd?: string;
  pbb?: string;
  kategoriBansos?: string;
  statusBansos?: 'Sudah' | 'Belum' | 'Menolak' | 'Layak' | 'Tidak Layak';
  bpjsTk?: 'Aktif' | 'Non-Aktif' | 'Belum Terdaftar' | 'Sudah Daftar (Agen Perisai)' | 'Menolak' | string;
  keterangan?: string;
  telepon?: string;
  fotoUrl?: string;
  fotoDokumentasi?: any;
  createdAt?: string;
  updatedAt?: string;
}

let memoryKunjungan: KunjunganWargaData[] = [];
let deletedKunjunganIdsCache: string[] = safeGetLocalStorage<string[]>(KUNJUNGAN_DELETED_KEY, []);
const visitPhotoCache = new Map<string, string>();
const recentlySavedVisitIds = new Set<string>();

export const hasValidVisitPhoto = (val?: unknown): boolean =>
  typeof val === 'string' && val.trim().length > 20 && val.trim() !== '[object Object]';

const extractPhotoString = (val: unknown): string => {
  if (hasValidVisitPhoto(val)) return String(val).trim();
  if (Array.isArray(val)) {
    for (const el of val) {
      const found = extractPhotoString(el);
      if (found) return found;
    }
  } else if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return (
      extractPhotoString(obj.url) ||
      extractPhotoString(obj.src) ||
      extractPhotoString(obj.link) ||
      extractPhotoString(obj.fotoUrl) ||
      ''
    );
  }
  return '';
};

export const getVisitPhotoSrc = (v?: Partial<KunjunganWargaData> | any | null): string => {
  if (!v) return '';
  const candidates = [
    v.fotoUrl,
    v.fotoDokumentasi,
    v.foto,
    v.photoUrl,
    v.fotoRumah,
    v.dokumentasiFoto,
  ];
  for (const c of candidates) {
    const found = extractPhotoString(c);
    if (found) return found;
  }
  return '';
};

const cacheVisitPhotosFromList = (list?: KunjunganWargaData[]): void => {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (!item || !item.id) continue;
    const src = getVisitPhotoSrc(item);
    if (src) {
      visitPhotoCache.set(item.id, src);
    }
  }
};

export const mergeVisitWithPreservedPhoto = (
  incoming: KunjunganWargaData,
  existing?: KunjunganWargaData | null
): KunjunganWargaData => {
  const incPhoto = getVisitPhotoSrc(incoming);
  if (incPhoto) {
    if (incoming.id) visitPhotoCache.set(incoming.id, incPhoto);
    if (!hasValidVisitPhoto(incoming.fotoUrl)) {
      return { ...incoming, fotoUrl: incPhoto };
    }
    return incoming;
  }
  const exPhoto = existing ? getVisitPhotoSrc(existing) : '';
  const cachedPhoto = incoming.id ? visitPhotoCache.get(incoming.id) || '' : '';
  const resolvedPhoto = exPhoto || cachedPhoto;
  if (resolvedPhoto) {
    if (incoming.id) visitPhotoCache.set(incoming.id, resolvedPhoto);
    return {
      ...incoming,
      fotoUrl: resolvedPhoto,
      ...(existing && hasValidVisitPhoto(existing.fotoDokumentasi)
        ? { fotoDokumentasi: existing.fotoDokumentasi }
        : {}),
    };
  }
  return incoming;
};

export const mergeVisitListPreservingPhotos = (
  incomingList: KunjunganWargaData[],
  fallbackList?: KunjunganWargaData[]
): KunjunganWargaData[] => {
  cacheVisitPhotosFromList(fallbackList);
  if (!Array.isArray(incomingList)) return Array.isArray(fallbackList) ? fallbackList : [];
  const fallbackMap = new Map<string, KunjunganWargaData>();
  if (Array.isArray(fallbackList)) {
    fallbackList.forEach((f) => {
      if (f && f.id) fallbackMap.set(f.id, f);
    });
  }
  return incomingList.map((item) => {
    if (!item || !item.id) return item;
    return mergeVisitWithPreservedPhoto(item, fallbackMap.get(item.id));
  });
};

export const getDeletedKunjunganIds = (): string[] => {
  if (!Array.isArray(deletedKunjunganIdsCache)) deletedKunjunganIdsCache = [];
  return deletedKunjunganIdsCache;
};

export const markKunjunganDeleted = (id: string): void => {
  const current = getDeletedKunjunganIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedKunjunganIdsCache = current;
    safeSetLocalStorage(KUNJUNGAN_DELETED_KEY, JSON.stringify(current));
  }
};

export const getLocalKunjunganList = (): KunjunganWargaData[] => {
  const deletedSet = new Set(getDeletedKunjunganIds());
  const memValid = memoryKunjungan.filter((x) => x && x.id && !deletedSet.has(x.id));
  const stored = safeGetLocalStorage<KunjunganWargaData[]>(KUNJUNGAN_STORAGE_KEY, []);
  if (Array.isArray(stored) && stored.length > 0) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    // safeSetLocalStorage strips base64 fotoUrl when payload > 250KB; always preserve full photos from memoryKunjungan
    const merged = mergeVisitListPreservingPhotos(cleaned, memValid);
    memoryKunjungan = merged;
    return merged;
  }
  if (memValid.length > 0) return memValid;
  return [];
};

function stripKunjunganMediaForBroadcast(items: KunjunganWargaData[]): KunjunganWargaData[] {
  return items.map((it) => {
    if (!it) return it;
    const copy = { ...it };
    if (typeof copy.fotoUrl === 'string' && copy.fotoUrl.startsWith('data:') && copy.fotoUrl.length > 200) {
      copy.fotoUrl = '';
    }
    return copy;
  });
}

export const setLocalKunjunganList = (items: KunjunganWargaData[]): void => {
  const deletedSet = new Set(getDeletedKunjunganIds());
  const cleaned = items.filter((x) => x && x.id && !deletedSet.has(x.id));
  const preserved = mergeVisitListPreservingPhotos(cleaned, memoryKunjungan);
  memoryKunjungan = preserved;
  safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(preserved), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kunjungan-data-updated'));
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KUNJUNGAN', items: stripKunjunganMediaForBroadcast(preserved) });
      bc.close();
    }
  } catch (e) {}
};

const getVisitIsoDate = (visit: Partial<KunjunganWargaData>): string => {
  if (!visit) return getTodayLocalIso();
  const iso = getReportIsoDate({ tanggal: visit.tanggal, createdAt: visit.createdAt });
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : getTodayLocalIso();
};

const resolveKeplingTargetForVisit = (params: {
  keplingId?: string;
  lingkungan?: string;
  lingkunganNomor?: number;
  namaKepling?: string;
}) => {
  const rawLkNum =
    Number(params.lingkunganNomor || 0) ||
    extractNomorLingkungan(params.lingkungan) ||
    extractNomorLingkungan(params.keplingId);

  const acc =
    KEPLING_ACCOUNTS.find(
      (k) =>
        (params.keplingId && k.id === params.keplingId) ||
        (rawLkNum > 0 && k.nomorLingkungan === rawLkNum) ||
        (params.namaKepling && k.nama.trim().toLowerCase() === params.namaKepling.trim().toLowerCase())
    ) || null;

  const profile = acc ? getEffectiveProfile(acc) : null;
  const nomorLingkungan = acc?.nomorLingkungan || rawLkNum || 1;
  const roman = ROMAN_NUMERALS[nomorLingkungan - 1] || String(nomorLingkungan);
  const resolvedKeplingId = (acc?.id || params.keplingId || `kepling_${nomorLingkungan}`)
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const resolvedLingkungan = acc?.lingkungan || params.lingkungan || `Lingkungan ${roman}`;
  const resolvedNama = profile?.nama || acc?.nama || params.namaKepling || `Kepling Lingkungan ${roman}`;
  const resolvedJabatan = acc?.jabatan || `Kepala Lingkungan ${roman}`;

  const matchAccount: UserAccount = acc
    ? { ...acc, nama: resolvedNama }
    : ({
        id: resolvedKeplingId,
        nama: resolvedNama,
        jabatan: resolvedJabatan,
        role: 'kepling',
        lingkungan: resolvedLingkungan,
        nomorLingkungan,
      } as UserAccount);

  return {
    resolvedKeplingId,
    nomorLingkungan,
    resolvedLingkungan,
    resolvedNama,
    resolvedJabatan,
    matchAccount,
  };
};

export const buildKunjunganReportId = (keplingId: string, tanggalIso: string): string => {
  const cleanId = String(keplingId || 'kepling_1').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const cleanDate = String(tanggalIso || getTodayLocalIso()).replace(/[^0-9-]/g, '').slice(0, 15);
  return `lap_kj_${cleanId}_${cleanDate}`;
};

export const getExpectedKunjunganReportIds = (visits: KunjunganWargaData[]): Set<string> => {
  const ids = new Set<string>();
  if (!Array.isArray(visits)) return ids;
  for (const v of visits) {
    if (!v || !v.id) continue;
    const tanggalIso = getVisitIsoDate(v);
    const resolved = resolveKeplingTargetForVisit(v);
    ids.add(buildKunjunganReportId(resolved.resolvedKeplingId, tanggalIso));
  }
  return ids;
};

interface ComputedKunjunganDaily {
  reportItem: LaporanHarianItem;
  signature: string;
}

const computeKunjunganDailyReport = (
  resolved: ReturnType<typeof resolveKeplingTargetForVisit>,
  tanggalIso: string,
  dayVisits: KunjunganWargaData[],
  existingReport?: LaporanHarianItem
): ComputedKunjunganDaily => {
  const reportId = buildKunjunganReportId(resolved.resolvedKeplingId, tanggalIso);

  const wargaNames: string[] = [];
  const fotos: FotoDokumentasi[] = [];
  let totalFotoUrlChars = 0;
  let totalVisitsWithPhoto = 0;
  const MAX_SYNCED_PHOTOS = 12;
  const MAX_TOTAL_PHOTO_CHARS = 620_000;

  let earliestCreatedAt = dayVisits[0]?.createdAt || new Date().toISOString();

  const sortedVisits = [...dayVisits].sort((a, b) =>
    String(a.id || '').localeCompare(String(b.id || ''))
  );

  sortedVisits.forEach((v, idx) => {
    if (v.createdAt && v.createdAt < earliestCreatedAt) {
      earliestCreatedAt = v.createdAt;
    }

    const wargaLabel = `${v.namaWarga}${v.alamat ? ` (${v.alamat})` : ''}`;
    if (wargaNames.length < 15) {
      wargaNames.push(wargaLabel);
    }

    // Dokumentasi Foto Kegiatan Kunjungan Warga (dibatasi agar ukuran dokumen Firestore aman < 1 MB)
    const directFoto = getVisitPhotoSrc(v) || (v.id ? visitPhotoCache.get(v.id) || '' : '');
    const fotoId = `foto_kj_${v.id || idx}`;
    const existingMatchedFoto =
      !directFoto && Array.isArray(existingReport?.dokumentasiFoto)
        ? existingReport!.dokumentasiFoto.find(
            (ef) =>
              ef &&
              hasValidVisitPhoto(ef.url) &&
              (ef.id === fotoId || (v.namaWarga && ef.name?.includes(v.namaWarga)))
          )?.url || ''
        : '';
    const rawFoto = directFoto || existingMatchedFoto;
    if (hasValidVisitPhoto(rawFoto)) {
      totalVisitsWithPhoto += 1;
      if (
        fotos.length < MAX_SYNCED_PHOTOS &&
        totalFotoUrlChars + rawFoto.length <= MAX_TOTAL_PHOTO_CHARS
      ) {
        totalFotoUrlChars += rawFoto.length;
        fotos.push({
          id: fotoId,
          url: rawFoto,
          name: `[KUNJUNGAN] ${v.namaWarga} - ${v.alamat || resolved.resolvedLingkungan}`,
          timestamp: v.updatedAt || v.createdAt || new Date().toISOString(),
          kategori: 'umum',
          keterangan: `Kegiatan Kunjungan Warga: ${v.namaWarga}`,
        });
      }
    }
  });

  // Preserve valid photos from existingReport if local visit entries were stripped of base64 data
  const existingValidFotos = Array.isArray(existingReport?.dokumentasiFoto)
    ? existingReport!.dokumentasiFoto.filter((f) => f && hasValidVisitPhoto(f.url))
    : [];
  const effectiveFotos =
    fotos.length > 0
      ? mergeFotoArraysPreservingUrls(existingReport?.dokumentasiFoto, fotos)
      : existingValidFotos.length > 0
      ? existingValidFotos
      : [];

  const validFotoCount = effectiveFotos.filter((f) => f && hasValidVisitPhoto(f.url)).length;

  const summaryListText =
    sortedVisits.length > 15
      ? `${wargaNames.join(', ')}, dan ${sortedVisits.length - 15} warga lainnya`
      : wargaNames.join(', ');

  const nowIso = new Date().toISOString();
  const reportItem: LaporanHarianItem = {
    id: reportId,
    keplingId: resolved.resolvedKeplingId,
    lingkungan: resolved.resolvedLingkungan,
    namaKepling: resolved.resolvedNama,
    jabatan: resolved.resolvedJabatan,
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    hari: getNamaHariIndonesia(tanggalIso),
    tanggal: tanggalIso,
    tanggalLaporan: tanggalIso,
    kinerja: {
      opsirPbbWp: 0,
      opsirPbbKeterangan: '',
      perlinsosKk: 0,
      perlinsosKeterangan: '',
      perlinsosMenolakKk: 0,
      perlinsosMenolakRincian: '',
      perlinsosTidakDiTempatKk: 0,
      perlinsosTidakDiTempatRincian: '',
      ikdOrang: 0,
      ikdKeterangan: '',
      bpjsKetenagakerjaanOrang: 0,
      bpjsKetenagakerjaanKeterangan: '',
      kegiatanLainnya: `${KUNJUNGAN_LAPORAN_PREFIX} Melaksanakan Kegiatan Kunjungan Warga (${sortedVisits.length} Warga Dikunjungi): ${summaryListText}`,
    },
    jumlahDokumentasi: Math.max(effectiveFotos.length, totalVisitsWithPhoto, Number(existingReport?.jumlahDokumentasi || 0)),
    dokumentasiFoto: effectiveFotos,
    petugasNama: resolved.resolvedNama,
    petugasRole: 'kepling',
    uraianTugas: `Kegiatan Kunjungan Warga (${sortedVisits.length} Rumah): ${summaryListText}`,
    catatanUmum: `Tercatat otomatis sebagai Kegiatan Kunjungan Warga (${sortedVisits.length} rumah) pada ${tanggalIso}.`,
    createdAt: existingReport?.createdAt || earliestCreatedAt,
    updatedAt: nowIso,
  };

  const signature = `activity_only|${sortedVisits.length}|${validFotoCount}|${sortedVisits
    .map((v) => `${v.id}:${v.updatedAt || ''}:${v.namaWarga || ''}:${getVisitPhotoSrc(v) ? 1 : 0}`)
    .join(',')}`;

  return { reportItem, signature };
};

const lastReconciledKunjunganSignatures = new Map<string, string>();

const persistReportRemoteAndIdb = async (reportItem: LaporanHarianItem): Promise<void> => {
  await Promise.allSettled([
    saveSingleReportToIndexedDB(reportItem).catch(() => {}),
    resilientSetDoc('reports', reportItem.id, cleanFirestoreData(reportItem), {
      merge: true,
    }).catch(() => {}),
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportItem),
    }).catch(() => {}),
  ]);
};

/**
 * Otomatis menyinkronkan entri Kunjungan Warga milik Kepala Lingkungan pada tanggal tertentu
 * ke dalam dokumen Laporan Harian Kepling (`lap_kj_${keplingId}_${tanggalIso}`) agar
 * tercatat otomatis di Riwayat Laporan, Monitoring, dan perhitungan Capaian Kinerja Kepling.
 */
export const syncKunjunganToLaporanHarian = async (
  target: {
    keplingId?: string;
    lingkungan?: string;
    lingkunganNomor?: number;
    namaKepling?: string;
    tanggal?: string;
    createdAt?: string;
  },
  visitsOverride?: KunjunganWargaData[]
): Promise<void> => {
  const tanggalIso = getVisitIsoDate(target);
  const resolved = resolveKeplingTargetForVisit(target);
  const reportId = buildKunjunganReportId(resolved.resolvedKeplingId, tanggalIso);
  let allVisits = Array.isArray(visitsOverride) ? visitsOverride : getLocalKunjunganList();

  let dayVisits = allVisits.filter(
    (v) =>
      v &&
      getVisitIsoDate(v) === tanggalIso &&
      isKunjunganMatchingKepling(v, resolved.matchAccount)
  );

  // Hydrate missing visit photos from IndexedDB & API cache so earlier visits on the same day keep their photos
  if (dayVisits.some((v) => !getVisitPhotoSrc(v))) {
    try {
      const idbVisits = await getVisitsFromIndexedDB();
      if (Array.isArray(idbVisits) && idbVisits.length > 0) {
        dayVisits = mergeVisitListPreservingPhotos(dayVisits, idbVisits);
      }
    } catch {}
    if (dayVisits.some((v) => !getVisitPhotoSrc(v))) {
      try {
        const res = await fetch('/api/kunjungan');
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          dayVisits = mergeVisitListPreservingPhotos(dayVisits, json.data);
        }
      } catch {}
    }
  }

  // Ensure photos included in daily report lap_kj_* stay compact so up to 12 photos fit safely <1MB in Firestore
  if (dayVisits.length > 0) {
    dayVisits = await Promise.all(
      dayVisits.map(async (v) => {
        const src = getVisitPhotoSrc(v);
        if (src.startsWith('data:image/') && src.length > 120_000) {
          const compact = await ensureCompactDataUrl(src, 520, 0.36).catch(() => src);
          if (compact && compact.length < src.length) {
            return { ...v, fotoUrl: compact };
          }
        }
        return v;
      })
    );
  }

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);

  if (dayVisits.length > 0) {
    let existingReport = localReports.find((r) => r?.id === reportId);
    const existingHasValid = Boolean(
      existingReport?.dokumentasiFoto?.some((f) => f && hasValidVisitPhoto(f.url))
    );
    if (!existingHasValid) {
      try {
        const idbReport = await getSingleReportFromIndexedDB(reportId);
        if (idbReport) {
          existingReport = existingReport
            ? {
                ...existingReport,
                dokumentasiFoto: mergeFotoArraysPreservingUrls(
                  idbReport.dokumentasiFoto,
                  existingReport.dokumentasiFoto
                ),
              }
            : idbReport;
        }
      } catch {}
    }

    const { reportItem, signature } = computeKunjunganDailyReport(
      resolved,
      tanggalIso,
      dayVisits,
      existingReport
    );
    lastReconciledKunjunganSignatures.set(reportId, signature);

    try {
      const idx = localReports.findIndex((r) => r?.id === reportId);
      const updatedLocal =
        idx >= 0
          ? localReports.map((r) => (r?.id === reportId ? reportItem : r))
          : [reportItem, ...localReports];
      safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(updatedLocal), {
        skipIdbMirror: true,
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-reports-updated', {
          detail: { upsertedReports: [reportItem], deletedIds: [] },
        })
      );
    }

    await persistReportRemoteAndIdb(reportItem);
  } else {
    lastReconciledKunjunganSignatures.delete(reportId);
    try {
      const cleanedLocal = localReports
        .filter((r) => r && r.id && r.id !== reportId)
        .map((r) => {
          const matchesTarget =
            r.keplingId === resolved.resolvedKeplingId &&
            (r.tanggal === tanggalIso || r.tanggalLaporan === tanggalIso);
          if (matchesTarget && r.kinerja?.kegiatanLainnya?.includes(KUNJUNGAN_LAPORAN_PREFIX)) {
            const filteredLines = r.kinerja.kegiatanLainnya
              .split('\n')
              .filter((line) => !line.includes(KUNJUNGAN_LAPORAN_PREFIX))
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

      safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(cleanedLocal), {
        skipIdbMirror: true,
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-reports-updated', {
          detail: {
            upsertedReports: [],
            deletedIds: [reportId],
            deletedKeplingIds: [resolved.resolvedKeplingId],
            stripDate: tanggalIso,
            stripPrefix: KUNJUNGAN_LAPORAN_PREFIX,
          },
        })
      );
    }

    await Promise.allSettled([
      deleteReportFromIndexedDB(reportId).catch(() => {}),
      resilientDeleteDoc('reports', reportId).catch(() => {}),
      fetch(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' }).catch(() => {}),
    ]);
  }
};

let isSyncingAllKunjungan = false;

/**
 * Menyelaraskan SELURUH data Kunjungan Warga (termasuk data lama yang sudah tersimpan di Firestore/IDB)
 * agar setiap tanggal & Kepling otomatis memiliki dokumen arsip laporan harian (`lap_kj_...`).
 */
export const syncAllKunjunganToLaporanHarian = async (
  visits: KunjunganWargaData[],
  currentRawReports: LaporanHarianItem[],
  deletedIdsSet?: Set<string>
): Promise<number> => {
  if (!Array.isArray(visits) || visits.length === 0 || isSyncingAllKunjungan) return 0;
  isSyncingAllKunjungan = true;

  try {
    // Hydrate any stripped visit photos from memoryKunjungan, IndexedDB, & /api/kunjungan before building daily reports
    let hydratedVisits = mergeVisitListPreservingPhotos(visits, memoryKunjungan);
    if (hydratedVisits.some((v) => v && v.id && !getVisitPhotoSrc(v))) {
      try {
        const idbVisits = await getVisitsFromIndexedDB();
        if (Array.isArray(idbVisits) && idbVisits.length > 0) {
          hydratedVisits = mergeVisitListPreservingPhotos(hydratedVisits, idbVisits);
        }
      } catch {}
      if (hydratedVisits.some((v) => v && v.id && !getVisitPhotoSrc(v))) {
        try {
          const res = await fetch('/api/kunjungan');
          const json = await res.json();
          if (json?.success && Array.isArray(json.data)) {
            hydratedVisits = mergeVisitListPreservingPhotos(hydratedVisits, json.data);
          }
        } catch {}
      }
    }

    hydratedVisits = await Promise.all(
      hydratedVisits.map(async (v) => {
        const src = getVisitPhotoSrc(v);
        if (src.startsWith('data:image/') && src.length > 120_000) {
          const compact = await ensureCompactDataUrl(src, 520, 0.36).catch(() => src);
          if (compact && compact.length < src.length) {
            return { ...v, fotoUrl: compact };
          }
        }
        return v;
      })
    );

    const groups = new Map<
      string,
      {
        resolved: ReturnType<typeof resolveKeplingTargetForVisit>;
        tanggalIso: string;
        visits: KunjunganWargaData[];
      }
    >();

    for (const v of hydratedVisits) {
      if (!v || !v.id) continue;
      const tanggalIso = getVisitIsoDate(v);
      const resolved = resolveKeplingTargetForVisit(v);
      const key = `${resolved.resolvedKeplingId}::${tanggalIso}`;
      const bucket = groups.get(key);
      if (bucket) {
        bucket.visits.push(v);
      } else {
        groups.set(key, { resolved, tanggalIso, visits: [v] });
      }
    }

    const rawById = new Map<string, LaporanHarianItem>();
    currentRawReports.forEach((r) => {
      if (r && r.id) rawById.set(r.id, r);
    });

    // Also enrich rawById with any intact photos from IndexedDB reports store
    try {
      const idbReports = await getReportsFromIndexedDB();
      if (Array.isArray(idbReports)) {
        idbReports.forEach((ir) => {
          if (!ir || !ir.id || !ir.id.startsWith('lap_kj_')) return;
          const cur = rawById.get(ir.id);
          if (cur) {
            const merged = mergeFotoArraysPreservingUrls(ir.dokumentasiFoto, cur.dokumentasiFoto);
            rawById.set(ir.id, { ...cur, dokumentasiFoto: merged });
          } else {
            rawById.set(ir.id, ir);
          }
        });
      }
    } catch {}

    const countValidFotos = (list?: FotoDokumentasi[]): number =>
      Array.isArray(list) ? list.filter((f) => f && hasValidVisitPhoto(f.url)).length : 0;

    const toUpsert: LaporanHarianItem[] = [];

    for (const group of groups.values()) {
      const reportId = buildKunjunganReportId(group.resolved.resolvedKeplingId, group.tanggalIso);
      if (deletedIdsSet?.has(reportId)) continue;

      const existing = rawById.get(reportId);
      const { reportItem, signature } = computeKunjunganDailyReport(
        group.resolved,
        group.tanggalIso,
        group.visits,
        existing
      );

      if (existing && lastReconciledKunjunganSignatures.get(reportId) === signature) {
        continue;
      }

      const existingValidFotos = countValidFotos(existing?.dokumentasiFoto);
      const nextValidFotos = countValidFotos(reportItem.dokumentasiFoto);

      // Guard: if existing already has valid photos and computed report somehow has fewer valid photos
      // despite visits having no new photo edits, keep existing photos intact
      const finalReportItem =
        existingValidFotos > 0 && nextValidFotos === 0
          ? {
              ...reportItem,
              dokumentasiFoto: existing!.dokumentasiFoto,
              jumlahDokumentasi: Math.max(
                Number(reportItem.jumlahDokumentasi || 0),
                existing!.dokumentasiFoto.length
              ),
            }
          : reportItem;

      const needsUpsert =
        !existing ||
        Number(existing.kinerja?.opsirPbbWp || 0) !== 0 ||
        Number(existing.kinerja?.perlinsosKk || 0) !== 0 ||
        Number(existing.kinerja?.perlinsosMenolakKk || 0) !== 0 ||
        Number(existing.kinerja?.perlinsosTidakDiTempatKk || 0) !== 0 ||
        Number(existing.kinerja?.ikdOrang || 0) !== 0 ||
        Number(existing.kinerja?.bpjsKetenagakerjaanOrang || 0) !== 0 ||
        Boolean(existing.kinerja?.opsirPbbKeterangan?.trim()) ||
        Boolean(existing.kinerja?.perlinsosKeterangan?.trim()) ||
        Boolean(existing.kinerja?.perlinsosMenolakRincian?.trim()) ||
        Boolean(existing.kinerja?.ikdKeterangan?.trim()) ||
        Boolean(existing.kinerja?.bpjsKetenagakerjaanKeterangan?.trim()) ||
        !String(existing.kinerja?.kegiatanLainnya || '').includes(
          `Kegiatan Kunjungan Warga (${group.visits.length} Warga Dikunjungi)`
        ) ||
        nextValidFotos > existingValidFotos;

      lastReconciledKunjunganSignatures.set(reportId, signature);
      if (needsUpsert) {
        toUpsert.push(finalReportItem);
      }
    }

    if (toUpsert.length === 0) return 0;

    // 1. Update LocalStorage & UI state atomically in one dispatch (0ms)
    try {
      const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
      const upsertMap = new Map<string, LaporanHarianItem>(toUpsert.map((r) => [r.id, r]));
      const nextLocal = localReports.filter((r) => r && r.id && !upsertMap.has(r.id));
      safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify([...toUpsert, ...nextLocal]), {
        skipIdbMirror: true,
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-reports-updated', {
          detail: { upsertedReports: toUpsert, deletedIds: [] },
        })
      );
    }

    // 2. Persist in small batches (5 at a time) to IDB, Firestore, and /api/reports
    const BATCH = 5;
    for (let i = 0; i < toUpsert.length; i += BATCH) {
      const slice = toUpsert.slice(i, i + BATCH);
      await Promise.allSettled(slice.map((item) => persistReportRemoteAndIdb(item)));
    }

    return toUpsert.length;
  } finally {
    isSyncingAllKunjungan = false;
  }
};

export const saveKunjunganWargaToFirestore = async (item: KunjunganWargaData): Promise<KunjunganWargaData> => {
  const visitId = item.id || `visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const currentBefore = getLocalKunjunganList();
  const previousVisit = currentBefore.find((p) => p.id === visitId);

  let rawPhoto =
    getVisitPhotoSrc(item) ||
    getVisitPhotoSrc(previousVisit) ||
    visitPhotoCache.get(visitId) ||
    '';

  // Ensure base64 photo stays safely under Firestore 1MB document limit
  if (rawPhoto.startsWith('data:image/') && rawPhoto.length > 220_000) {
    rawPhoto = await ensureCompactDataUrl(rawPhoto, 760, 0.54).catch(() => rawPhoto);
    if (rawPhoto.length > 480_000) {
      rawPhoto = await ensureCompactDataUrl(rawPhoto, 560, 0.36).catch(() => rawPhoto);
    }
  }

  const dataToSave: KunjunganWargaData = {
    ...item,
    id: visitId,
    ...(rawPhoto ? { fotoUrl: rawPhoto } : {}),
    createdAt: item.createdAt || previousVisit?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (rawPhoto) {
    visitPhotoCache.set(visitId, rawPhoto);
  }
  recentlySavedVisitIds.add(visitId);

  // 1. Update local state & IndexedDB immediately
  const current = getLocalKunjunganList();
  const idx = current.findIndex((p) => p.id === dataToSave.id);
  let updatedList = [...current];
  if (idx >= 0) {
    updatedList[idx] = dataToSave;
  } else {
    updatedList = [dataToSave, ...updatedList];
  }
  setLocalKunjunganList(updatedList);
  saveVisitsToIndexedDB(updatedList).catch(() => {});

  // 2. Run Laporan Harian auto-sync, Firestore visit save, & /api/kunjungan concurrently
  const syncTasks: Promise<any>[] = [
    resilientSetDoc(KUNJUNGAN_COLLECTION, dataToSave.id, cleanFirestoreData(dataToSave), { merge: true }).catch(
      () => {}
    ),
    fetch('/api/kunjungan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
    }).catch(() => {}),
    syncKunjunganToLaporanHarian(dataToSave, updatedList).catch(() => {}),
  ];

  if (previousVisit) {
    const prevDate = getVisitIsoDate(previousVisit);
    const nextDate = getVisitIsoDate(dataToSave);
    const prevRes = resolveKeplingTargetForVisit(previousVisit);
    const nextRes = resolveKeplingTargetForVisit(dataToSave);
    if (prevDate !== nextDate || prevRes.resolvedKeplingId !== nextRes.resolvedKeplingId) {
      syncTasks.push(syncKunjunganToLaporanHarian(previousVisit, updatedList).catch(() => {}));
    }
  }

  await Promise.allSettled(syncTasks);
  return dataToSave;
};

export const deleteKunjunganWargaFromFirestore = async (id: string): Promise<void> => {
  const current = getLocalKunjunganList();
  const targetVisit = current.find((p) => p.id === id);

  markKunjunganDeleted(id);
  const filtered = current.filter((p) => p.id !== id);
  setLocalKunjunganList(filtered);
  saveVisitsToIndexedDB(filtered).catch(() => {});

  await Promise.allSettled([
    resilientDeleteDoc(KUNJUNGAN_COLLECTION, id).catch(() => {}),
    fetch(`/api/kunjungan/${id}`, { method: 'DELETE' }).catch(() => {}),
    targetVisit
      ? syncKunjunganToLaporanHarian(targetVisit, filtered).catch(() => {})
      : Promise.resolve(),
  ]);
};

function sortKunjunganDesc(items: KunjunganWargaData[]): KunjunganWargaData[] {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.createdAt || b.tanggal || '').localeCompare(a.updatedAt || a.createdAt || a.tanggal || '')
  );
}

export const fetchKunjunganFromFirestore = async (): Promise<KunjunganWargaData[]> => {
  const local = getLocalKunjunganList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;
  try {
    const colRef = collection(db, KUNJUNGAN_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const deletedSet = new Set(getDeletedKunjunganIds());
    const remoteItems: KunjunganWargaData[] = [];
    const remoteIdSet = new Set<string>();
    snap.forEach((docSnap) => {
      const dat = docSnap.data() as KunjunganWargaData;
      const docId = docSnap.id || dat?.id;
      if (dat && docId && !deletedSet.has(docId)) {
        remoteItems.push({ ...dat, id: docId });
        remoteIdSet.add(docId);
      }
    });
    const fallbackPool = [...local, ...memoryKunjungan];
    const pendingExtras = fallbackPool.filter(
      (v) =>
        v &&
        v.id &&
        !deletedSet.has(v.id) &&
        !remoteIdSet.has(v.id) &&
        (isDocQueuedForWrite(KUNJUNGAN_COLLECTION, v.id) || recentlySavedVisitIds.has(v.id))
    );
    const merged = mergeVisitListPreservingPhotos([...pendingExtras, ...remoteItems], fallbackPool);
    const sorted = sortKunjunganDesc(merged);
    if (sorted.length > 0 || !snap.metadata.fromCache) {
      setLocalKunjunganList(sorted);
      saveVisitsToIndexedDB(sorted).catch(() => {});
      return sorted;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[kunjunganService] fetchKunjunganFromFirestore warning:', err);
    }
  }
  return local;
};

export const subscribeKunjunganWarga = (cb: (items: KunjunganWargaData[]) => void): (() => void) => {
  let isActive = true;
  let hasLiveFirestore = false;
  const idbMap = new Map<string, KunjunganWargaData>();
  const serverMap = new Map<string, KunjunganWargaData>();
  const firestoreMap = new Map<string, KunjunganWargaData>();

  const emitCombined = (persistToIdb: boolean) => {
    if (!isActive) return;
    const deletedSet = new Set(getDeletedKunjunganIds());
    const fallbackPool = [
      ...memoryKunjungan,
      ...Array.from(idbMap.values()),
      ...Array.from(serverMap.values()),
    ];
    cacheVisitPhotosFromList(fallbackPool);

    const outMap = new Map<string, KunjunganWargaData>();

    if (hasLiveFirestore) {
      firestoreMap.forEach((item, id) => {
        if (!deletedSet.has(id)) outMap.set(id, item);
      });
      // Keep locally saved or pending-queue visits even if Firestore snapshot doesn't have them yet
      fallbackPool.forEach((localItem) => {
        if (!localItem || !localItem.id || deletedSet.has(localItem.id)) return;
        if (
          !outMap.has(localItem.id) &&
          (isDocQueuedForWrite(KUNJUNGAN_COLLECTION, localItem.id) ||
            recentlySavedVisitIds.has(localItem.id))
        ) {
          outMap.set(localItem.id, localItem);
        }
      });
    } else {
      // Combine all available sources while waiting for authoritative Firestore snapshot
      [...serverMap.values(), ...idbMap.values(), ...memoryKunjungan, ...firestoreMap.values()].forEach(
        (item) => {
          if (item && item.id && !deletedSet.has(item.id)) {
            const prev = outMap.get(item.id);
            outMap.set(item.id, prev ? mergeVisitWithPreservedPhoto(item, prev) : item);
          }
        }
      );
    }

    const hydrated = mergeVisitListPreservingPhotos(Array.from(outMap.values()), fallbackPool);
    const sorted = sortKunjunganDesc(hydrated);
    setLocalKunjunganList(sorted);
    if (persistToIdb && sorted.length > 0) {
      saveVisitsToIndexedDB(sorted).catch(() => {});
    }
    cb(sorted);
  };

  // 1. Initial local emit (0ms)
  const initialLocal = getLocalKunjunganList();
  cacheVisitPhotosFromList(initialLocal);
  cb(initialLocal);

  // 2. Fast IndexedDB restore — always hydrate photos & cache into idbMap even if Firestore resolved earlier
  getVisitsFromIndexedDB()
    .then((idb) => {
      if (!isActive || !Array.isArray(idb) || idb.length === 0) return;
      const deletedSet = new Set(getDeletedKunjunganIds());
      let addedOrHydrated = false;
      idb.forEach((x) => {
        if (x && x.id && !deletedSet.has(x.id)) {
          idbMap.set(x.id, x);
          if (getVisitPhotoSrc(x)) {
            visitPhotoCache.set(x.id, getVisitPhotoSrc(x));
          }
          addedOrHydrated = true;
        }
      });
      if (addedOrHydrated) {
        emitCombined(false);
      }
    })
    .catch(() => {});

  // 3. Server API buffer as cold-start & photo-hydration source (always populates serverMap even if Firestore fired first)
  fetch('/api/kunjungan')
    .then((res) => res.json())
    .then((resData) => {
      if (!isActive) return;
      if (resData && resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
        const deletedSet = new Set(getDeletedKunjunganIds());
        let hasAnyServerPhoto = false;
        resData.data.forEach((x: any) => {
          if (x && x.id && !deletedSet.has(x.id)) {
            serverMap.set(x.id, x);
            const src = getVisitPhotoSrc(x);
            if (src) {
              visitPhotoCache.set(x.id, src);
              hasAnyServerPhoto = true;
            }
          }
        });
        const current = getLocalKunjunganList();
        const currentNeedsPhoto = current.some((c) => !getVisitPhotoSrc(c));
        if ((!hasLiveFirestore && current.length === 0) || (currentNeedsPhoto && hasAnyServerPhoto)) {
          emitCombined(true);
        }
      }
    })
    .catch(() => {});

  // 4. Realtime Authoritative Firestore Sync
  let unsub: Unsubscribe | null = null;
  let fallbackTimer: any = null;
  try {
    if (db && !isFirestoreQuotaCooldownActive()) {
      const q = collection(db, KUNJUNGAN_COLLECTION);
      unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!isActive) return;
          const deletedSet = new Set(getDeletedKunjunganIds());
          firestoreMap.clear();
          snapshot.forEach((docSnap) => {
            const dat = docSnap.data() as KunjunganWargaData;
            const docId = docSnap.id || dat?.id;
            if (dat && docId && !deletedSet.has(docId)) {
              const item = { ...dat, id: docId };
              firestoreMap.set(docId, item);
              const src = getVisitPhotoSrc(item);
              if (src) visitPhotoCache.set(docId, src);
            }
          });

          if (!snapshot.metadata.fromCache) {
            hasLiveFirestore = true;
            emitCombined(true);
          } else if (firestoreMap.size > 0 && !hasLiveFirestore) {
            emitCombined(false);
          }
        },
        (err) => {
          if (isQuotaExhaustedError(err)) {
            markFirestoreQuotaExhausted(err);
            isActive = false;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            try { unsub?.(); } catch {}
            return;
          }
          console.warn('[kunjunganService] Snapshot listener error:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchKunjunganFromFirestore().then((items) => {
              if (isActive && items.length > 0) cb(items);
            });
          }
        }
      );

      // Delayed explicit server fetch only if live snapshot hasn't arrived
      fallbackTimer = setTimeout(() => {
        if (isActive && !hasLiveFirestore && !isFirestoreQuotaCooldownActive()) {
          fetchKunjunganFromFirestore().then((items) => {
            if (isActive && !hasLiveFirestore && items.length > 0) {
              hasLiveFirestore = true;
              cb(items);
            }
          });
        }
      }, 4500);
    }
  } catch (e) {}

  // Broadcast channel sync
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.onmessage = (event) => {
        if (isActive && event.data && event.data.type === 'SYNC_KUNJUNGAN' && Array.isArray(event.data.items)) {
          const hydrated = mergeVisitListPreservingPhotos(event.data.items, memoryKunjungan);
          memoryKunjungan = hydrated;
          cb(hydrated);
        }
      };
    }
  } catch (e) {}

  return () => {
    isActive = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (unsub) { try { unsub(); } catch {} }
    if (bc) bc.close();
  };
};

export const subscribeKunjungan = subscribeKunjunganWarga;
export const saveKunjungan = saveKunjunganWargaToFirestore;
export const saveKunjunganWarga = saveKunjunganWargaToFirestore;

export const isKunjunganOnDate = (item: KunjunganWargaData, dateIso: string): boolean => {
  if (!item || !item.tanggal) return false;
  return item.tanggal.slice(0, 10) === dateIso.slice(0, 10);
};

export const consolidateKunjunganWithReports = (visits: KunjunganWargaData[], reports: any[]): any[] => {
  return visits;
};
