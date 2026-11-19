import {
  FotoDokumentasi,
  LaporanHarianItem,
  RealisasiPembangunan,
  UserAccount,
} from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import {
  collection,
  onSnapshot,
  getDocs,
  getDocsFromServer,
} from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import {
  deleteReportFromIndexedDB,
  getSingleReportFromIndexedDB,
  saveSingleReportToIndexedDB,
} from './indexedDbStorage';
import { mergeFotoArraysPreservingUrls } from './reportConsolidator';
import {
  KEPLING_ACCOUNTS,
  ROMAN_NUMERALS,
  getEffectiveProfile,
} from '../data/keplingList';
import { getNamaHariIndonesia, getTodayLocalIso } from './formatter';

export const PEMBANGUNAN_COLLECTION = 'realisasi_pembangunan';
export const PEMBANGUNAN_STORAGE_KEY = 'sikepling_pembangunan_data_v1';
export const PEMBANGUNAN_CHANNEL = 'sikepling_pembangunan_channel';
const LAPORAN_STORAGE_KEY = 'kepling_local_laporan_history_v2';
const REALISASI_LAPORAN_PREFIX = '[Realisasi Fisik]';

export const getLocalPembangunanList = (): RealisasiPembangunan[] => {
  const stored = safeGetLocalStorage<RealisasiPembangunan[]>(PEMBANGUNAN_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
};

export const setLocalPembangunanList = (items: RealisasiPembangunan[]): void => {
  safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(items), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pembangunan-data-updated'));
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PEMBANGUNAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_PEMBANGUNAN', count: items.length });
      bc.close();
    }
  } catch (e) {}
};

function sortPembangunanDesc(items: RealisasiPembangunan[]): RealisasiPembangunan[] {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
  );
}

export const fetchPembangunanAll = async (): Promise<RealisasiPembangunan[]> => {
  if (!db || isFirestoreQuotaCooldownActive()) return getLocalPembangunanList();

  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const items: RealisasiPembangunan[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
    const sorted = sortPembangunanDesc(items);
    if (sorted.length > 0 || !snap.metadata.fromCache) {
      setLocalPembangunanList(sorted);
      return sorted;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[pembangunanService] Firestore fetch error:', err);
    }
  }
  return getLocalPembangunanList();
};

export const savePembangunanToServer = async (item: RealisasiPembangunan): Promise<RealisasiPembangunan> => {
  const payload = {
    ...item,
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
  };

  // Update local
  const current = getLocalPembangunanList();
  const idx = current.findIndex((p) => p.id === item.id);
  const updatedList = idx >= 0
    ? current.map((p) => (p.id === item.id ? payload : p))
    : [payload, ...current];
  setLocalPembangunanList(updatedList);

  // Update Firestore via resilient write queue
  await resilientSetDoc(PEMBANGUNAN_COLLECTION, item.id, cleanFirestoreData(payload), { merge: true });

  return payload;
};

export const deletePembangunanFromServer = async (id: string): Promise<void> => {
  const current = getLocalPembangunanList();
  const filtered = current.filter((p) => p.id !== id);
  setLocalPembangunanList(filtered);

  await resilientDeleteDoc(PEMBANGUNAN_COLLECTION, id);
};

export const batchSyncPembangunan = async (items: RealisasiPembangunan[]): Promise<boolean> => {
  if (!Array.isArray(items) || items.length === 0) return true;

  for (const item of items) {
    await savePembangunanToServer(item);
  }
  return true;
};

export const subscribePembangunan = (cb: (items: RealisasiPembangunan[]) => void): (() => void) => {
  const initial = getLocalPembangunanList();
  cb(initial);

  if (!db || isFirestoreQuotaCooldownActive()) return () => {};

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        if (!isActive) return;
        const items: RealisasiPembangunan[] = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id } as RealisasiPembangunan));
        const sorted = sortPembangunanDesc(items);

        if (!snap.metadata.fromCache) {
          receivedServerSnapshot = true;
          setLocalPembangunanList(sorted);
          cb(sorted);
        } else if (sorted.length > 0 && !receivedServerSnapshot) {
          setLocalPembangunanList(sorted);
          cb(sorted);
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
        console.warn('[pembangunanService] Subscription error, using getDocs fallback:', err);
        if (!isFirestoreQuotaCooldownActive()) {
          fetchPembangunanAll().then((items) => {
            if (isActive) cb(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchPembangunanAll().then((items) => {
          if (isActive && !receivedServerSnapshot && items.length > 0) {
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
    console.error('Pembangunan subscription failed:', e);
    return () => {};
  }
};

export const subscribeToPembangunan = subscribePembangunan;

const sanitizePembangunanKey = (rawId: string): string => {
  const clean = String(rawId || 'pb').replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 60) return clean;
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (h * 31 + clean.charCodeAt(i)) | 0;
  }
  return `${clean.slice(0, 42)}_${Math.abs(h).toString(36)}`;
};

export const buildPembangunanReportId = (pembangunanId: string): string =>
  `lap_pb_${sanitizePembangunanKey(pembangunanId)}`;

const isValidMediaUrl = (url?: string): boolean => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.length > 10 &&
    (trimmed.startsWith('data:image/') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/'))
  );
};

const pickPembangunanIsoDate = (item: RealisasiPembangunan): string => {
  const candidates = [
    item.tanggalSelesai,
    item.tanggalMulai,
    typeof item.createdAt === 'string' ? item.createdAt.slice(0, 10) : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.trim())) {
      return c.trim();
    }
  }
  return getTodayLocalIso();
};

const formatJenisPembangunanLabel = (jenis: RealisasiPembangunan['jenisPembangunan']): string => {
  switch (jenis) {
    case 'PERBAIKAN_JALAN':
      return 'Perbaikan Jalan';
    case 'PERBAIKAN_DRAINASE':
      return 'Perbaikan Drainase';
    case 'PERBAIKAN_LAMPU_LPJU':
      return 'Perbaikan Lampu LPJU';
    case 'PENAMBAHAN_TIANG_LPJU':
      return 'Penambahan Tiang LPJU Baru';
    case 'PEMASANGAN_PAVING_BLOK':
      return 'Pemasangan Paving Blok';
    default:
      return 'Realisasi Infrastruktur';
  }
};

const formatStatusRealisasiLabel = (status: RealisasiPembangunan['statusRealisasi']): string => {
  switch (status) {
    case 'SELESAI_100%':
      return 'Selesai 100%';
    case 'PROSES_PENGERJAAN':
      return 'Proses Pengerjaan';
    case 'USULAN':
      return 'Usulan Proyek';
    case 'PEMELIHARAAN':
      return 'Pemeliharaan';
    default:
      return String(status || '-');
  }
};

export const hasLinkedPembangunanLaporanHarian = async (
  pembangunanId: string
): Promise<boolean> => {
  const reportId = buildPembangunanReportId(pembangunanId);
  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
  if (localReports.some((r) => r?.id === reportId)) return true;
  try {
    const idb = await getSingleReportFromIndexedDB(reportId);
    return Boolean(idb);
  } catch {
    return false;
  }
};

/**
 * Otomatis mencatat entri Realisasi Fisik Pembangunan yang diisi Kepala Lingkungan
 * ke dalam Laporan Harian Kepling (LocalStorage, React State Event, IndexedDB, Firestore, Server API).
 */
export const syncPembangunanToLaporanHarian = async (
  item: RealisasiPembangunan,
  actor?: UserAccount
): Promise<LaporanHarianItem | null> => {
  if (!item || !item.id) return null;

  const nomorLingkungan = Number(item.lingkunganNomor || actor?.nomorLingkungan || 0);
  if (!nomorLingkungan || nomorLingkungan < 1) return null;

  const acc = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === nomorLingkungan) || null;
  const profile = acc ? getEffectiveProfile(acc) : null;
  const roman = ROMAN_NUMERALS[nomorLingkungan - 1] || String(nomorLingkungan);
  const resolvedKeplingId = acc?.id || item.lingkunganId || `kepling_${nomorLingkungan}`;
  const resolvedLingkungan = acc?.lingkungan || `Lingkungan ${roman}`;
  const resolvedNama = profile?.nama || acc?.nama || actor?.nama || `Kepling Lingkungan ${roman}`;
  const resolvedJabatan = acc?.jabatan || `Kepala Lingkungan ${roman}`;

  const reportId = buildPembangunanReportId(item.id);
  const tanggalIso = pickPembangunanIsoDate(item);
  const nowIso = new Date().toISOString();

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
  let existingReport = localReports.find((r) => r?.id === reportId);
  if (!existingReport) {
    try {
      const idbReport = await getSingleReportFromIndexedDB(reportId);
      if (idbReport) existingReport = idbReport;
    } catch {
      // ignore
    }
  }

  // Kumpulkan dokumentasi foto (prioritas: Sesudah -> Proses -> Sebelum), dibatasi agar aman < 1 MB
  const candidateUrls: Array<{ url: string; stage: string }> = [];
  const pushUrl = (u: string | undefined, stage: string) => {
    if (isValidMediaUrl(u) && !candidateUrls.some((c) => c.url === u!.trim())) {
      candidateUrls.push({ url: u!.trim(), stage });
    }
  };
  (item.fotoSesudahList || []).forEach((u) => pushUrl(u, 'Sesudah (100%)'));
  pushUrl(item.fotoSesudahUrl, 'Sesudah (100%)');
  (item.fotoProsesList || []).forEach((u) => pushUrl(u, 'Proses (50%)'));
  pushUrl(item.fotoProsesUrl, 'Proses (50%)');
  (item.fotoSebelumList || []).forEach((u) => pushUrl(u, 'Sebelum (0%)'));
  pushUrl(item.fotoSebelumUrl, 'Sebelum (0%)');

  const MAX_PHOTOS = 4;
  const MAX_TOTAL_CHARS = 340_000;
  const fotos: FotoDokumentasi[] = [];
  let totalChars = 0;

  candidateUrls.forEach((cand, idx) => {
    if (fotos.length >= MAX_PHOTOS) return;
    if (totalChars + cand.url.length > MAX_TOTAL_CHARS) return;
    totalChars += cand.url.length;
    fotos.push({
      id: `foto_${reportId}_${idx + 1}`,
      url: cand.url,
      name: `[REALISASI FISIK] ${item.namaProyek} (${cand.stage})`,
      timestamp: item.updatedAt || item.createdAt || nowIso,
      kategori: 'infrastruktur',
      keterangan: `${cand.stage} — ${item.lokasiDetail || resolvedLingkungan}`,
    });
  });

  const existingValidFotos = Array.isArray(existingReport?.dokumentasiFoto)
    ? existingReport!.dokumentasiFoto.filter((f) => f && isValidMediaUrl(f.url))
    : [];
  const effectiveFotos =
    fotos.length > 0
      ? mergeFotoArraysPreservingUrls(existingReport?.dokumentasiFoto, fotos)
      : existingValidFotos;

  const jenisLabel = formatJenisPembangunanLabel(item.jenisPembangunan);
  const statusLabel = formatStatusRealisasiLabel(item.statusRealisasi);
  const progressStr =
    item.persentaseFisik !== undefined ? ` (${item.persentaseFisik}%)` : '';
  const coordStr =
    item.titikKoordinat?.lat && item.titikKoordinat?.lng
      ? `https://maps.google.com/?q=${item.titikKoordinat.lat},${item.titikKoordinat.lng}`
      : '';

  const reportItem: LaporanHarianItem = {
    id: reportId,
    keplingId: resolvedKeplingId,
    lingkungan: resolvedLingkungan,
    namaKepling: resolvedNama,
    jabatan: resolvedJabatan,
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
      ikdOrang: 0,
      ikdKeterangan: '',
      bpjsKetenagakerjaanOrang: 0,
      bpjsKetenagakerjaanKeterangan: '',
      infrastrukturAdaGiat: true,
      infrastrukturSubjek: `${REALISASI_LAPORAN_PREFIX} ${jenisLabel}: ${item.namaProyek}`,
      infrastrukturLokasi: item.lokasiDetail || `${resolvedLingkungan}, Kelurahan Mangga`,
      infrastrukturTitikKoordinat: coordStr,
      infrastrukturTanggalPelaporan: tanggalIso,
      infrastrukturPelapor: resolvedNama,
      kegiatanLainnya: `${REALISASI_LAPORAN_PREFIX} ${jenisLabel} — ${item.namaProyek} (Vol: ${
        item.volumeRealisasi || '-'
      }, Status: ${statusLabel}${progressStr}, Pelaksana: ${item.sumberDana || '-'})${
        item.keterangan?.trim() ? ` — ${item.keterangan.trim()}` : ''
      }`,
    },
    jumlahDokumentasi: Math.max(effectiveFotos.length, candidateUrls.length),
    dokumentasiFoto: effectiveFotos,
    petugasNama: resolvedNama,
    petugasRole: 'kepling',
    uraianTugas: `Realisasi Fisik (${jenisLabel}): ${item.namaProyek} di ${
      item.lokasiDetail || resolvedLingkungan
    }`,
    catatanUmum: item.keterangan?.trim()
      ? item.keterangan.trim()
      : `Tercatat otomatis dari Menu Realisasi Fisik (${statusLabel}${progressStr}).`,
    createdAt: existingReport?.createdAt || item.createdAt || nowIso,
    updatedAt: nowIso,
  };

  try {
    const idx = localReports.findIndex((r) => r?.id === reportId);
    const updatedLocal =
      idx >= 0
        ? localReports.map((r) => (r?.id === reportId ? reportItem : r))
        : [reportItem, ...localReports];
    safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(updatedLocal), {
      skipIdbMirror: true,
    });
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sikepling-reports-updated', {
        detail: { upsertedReports: [reportItem], deletedIds: [] },
      })
    );
  }

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

  return reportItem;
};

export const deletePembangunanLaporanHarian = async (pembangunanId: string): Promise<void> => {
  if (!pembangunanId) return;
  const reportId = buildPembangunanReportId(pembangunanId);

  try {
    const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);
    const cleaned = localReports.filter((r) => r && r.id && r.id !== reportId);
    safeSetLocalStorage(LAPORAN_STORAGE_KEY, JSON.stringify(cleaned), {
      skipIdbMirror: true,
    });
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sikepling-reports-updated', {
        detail: { upsertedReports: [], deletedIds: [reportId] },
      })
    );
  }

  await Promise.allSettled([
    deleteReportFromIndexedDB(reportId).catch(() => {}),
    resilientDeleteDoc('reports', reportId).catch(() => {}),
    fetch(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' }).catch(() => {}),
  ]);
};


