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
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  getVisitsFromIndexedDB,
  saveVisitsToIndexedDB,
  saveSingleReportToIndexedDB,
  deleteReportFromIndexedDB,
} from './indexedDbStorage';
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
  const stored = safeGetLocalStorage<KunjunganWargaData[]>(KUNJUNGAN_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    memoryKunjungan = cleaned;
    return cleaned;
  }
  return memoryKunjungan.filter((x) => x && x.id && !deletedSet.has(x.id));
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
  memoryKunjungan = cleaned;
  safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(cleaned), { skipIdbMirror: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kunjungan-data-updated'));
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(KUNJUNGAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KUNJUNGAN', items: stripKunjunganMediaForBroadcast(cleaned) });
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

  const matchAccount: UserAccount =
    acc ||
    ({
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
  const allVisits = Array.isArray(visitsOverride) ? visitsOverride : getLocalKunjunganList();

  const dayVisits = allVisits.filter(
    (v) =>
      v &&
      getVisitIsoDate(v) === tanggalIso &&
      isKunjunganMatchingKepling(v, resolved.matchAccount)
  );

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);

  if (dayVisits.length > 0) {
    let perlinsosSudahCount = 0;
    let perlinsosMenolakCount = 0;
    let ikdCount = 0;
    let bpjsCount = 0;
    let pbbCount = 0;

    const wargaNames: string[] = [];
    const menolakDetails: string[] = [];
    const pbbDetails: string[] = [];
    const ikdDetails: string[] = [];
    const bpjsDetails: string[] = [];

    const fotos: FotoDokumentasi[] = [];
    let totalFotoUrlChars = 0;
    let totalVisitsWithPhoto = 0;
    const MAX_SYNCED_PHOTOS = 4;
    const MAX_TOTAL_PHOTO_CHARS = 360_000;

    let earliestCreatedAt = dayVisits[0]?.createdAt || new Date().toISOString();

    dayVisits.forEach((v, idx) => {
      if (v.createdAt && v.createdAt < earliestCreatedAt) {
        earliestCreatedAt = v.createdAt;
      }

      const wargaLabel = `${v.namaWarga}${v.alamat ? ` (${v.alamat})` : ''}`;
      if (wargaNames.length < 15) {
        wargaNames.push(wargaLabel);
      }

      // 1. Perlinsos: prioritaskan pilihan dropdown perlinsos; fallback ke statusBansos hanya jika perlinsos kosong
      const rawPerlinsos = (v.perlinsos || v.statusBansos || '').trim().toLowerCase();
      if (rawPerlinsos === 'sudah' || rawPerlinsos === 'layak') {
        perlinsosSudahCount += 1;
      } else if (rawPerlinsos === 'menolak') {
        perlinsosMenolakCount += 1;
        if (menolakDetails.length < 10) menolakDetails.push(wargaLabel);
      }

      // 2. PBB
      const rawPbb = (v.pbb || '').trim().toLowerCase();
      if (rawPbb === 'sudah' || rawPbb === 'lunas') {
        pbbCount += 1;
        if (pbbDetails.length < 10) pbbDetails.push(v.namaWarga);
      }

      // 3. IKD
      const rawIkd = (v.ikd || '').trim().toLowerCase();
      if (rawIkd === 'sudah') {
        ikdCount += 1;
        if (ikdDetails.length < 10) ikdDetails.push(v.namaWarga);
      }

      // 4. BPJS Ketenagakerjaan
      const rawBpjs = (v.bpjsTk || '').trim().toLowerCase();
      if (
        rawBpjs.includes('perisai') ||
        rawBpjs.includes('sudah') ||
        (rawBpjs.includes('aktif') && !rawBpjs.includes('non-aktif'))
      ) {
        bpjsCount += 1;
        if (bpjsDetails.length < 10) bpjsDetails.push(v.namaWarga);
      }

      // 5. Dokumentasi Foto (dibatasi agar ukuran dokumen Firestore aman < 1 MB)
      const rawFoto =
        (typeof v.fotoUrl === 'string' && v.fotoUrl.trim()) ||
        (typeof v.fotoDokumentasi === 'string' && v.fotoDokumentasi.trim()) ||
        '';
      if (rawFoto.length > 20) {
        totalVisitsWithPhoto += 1;
        if (
          fotos.length < MAX_SYNCED_PHOTOS &&
          totalFotoUrlChars + rawFoto.length <= MAX_TOTAL_PHOTO_CHARS
        ) {
          totalFotoUrlChars += rawFoto.length;
          fotos.push({
            id: `foto_kj_${v.id || idx}`,
            url: rawFoto,
            name: `[KUNJUNGAN] ${v.namaWarga} - ${v.alamat || resolved.resolvedLingkungan}`,
            timestamp: v.updatedAt || v.createdAt || new Date().toISOString(),
            kategori: 'perlinsos',
            keterangan: `Kunjungan Warga: ${v.namaWarga}`,
          });
        }
      }
    });

    const summaryListText =
      dayVisits.length > 15
        ? `${wargaNames.join(', ')}, dan ${dayVisits.length - 15} warga lainnya`
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
        opsirPbbWp: pbbCount,
        opsirPbbKeterangan:
          pbbCount > 0 ? `Terdata lunas saat Kunjungan Warga: ${pbbDetails.join(', ')}` : '',
        perlinsosKk: perlinsosSudahCount,
        perlinsosKeterangan: `Kunjungan Warga Door-to-Door (${dayVisits.length} warga dikunjungi): ${summaryListText}`,
        perlinsosMenolakKk: perlinsosMenolakCount,
        perlinsosMenolakRincian:
          menolakDetails.length > 0 ? `Menolak Perlinsos: ${menolakDetails.join(', ')}` : '',
        ikdOrang: ikdCount,
        ikdKeterangan:
          ikdCount > 0 ? `Sudah aktivasi IKD saat kunjungan: ${ikdDetails.join(', ')}` : '',
        bpjsKetenagakerjaanOrang: bpjsCount,
        bpjsKetenagakerjaanKeterangan:
          bpjsCount > 0 ? `BPJS TK Aktif/Terdaftar: ${bpjsDetails.join(', ')}` : '',
        kegiatanLainnya: `${KUNJUNGAN_LAPORAN_PREFIX} ${dayVisits.length} Warga Dikunjungi: ${summaryListText}`,
      },
      jumlahDokumentasi: Math.max(fotos.length, totalVisitsWithPhoto),
      dokumentasiFoto: fotos,
      petugasNama: resolved.resolvedNama,
      petugasRole: 'kepling',
      uraianTugas: `Kunjungan Warga Door-to-Door (${dayVisits.length} Rumah): ${summaryListText}`,
      catatanUmum: `Tercatat otomatis dari ${dayVisits.length} data Kunjungan Warga (Door-to-Door) pada ${tanggalIso}.`,
      createdAt: earliestCreatedAt,
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
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-reports-updated', {
          detail: { upsertedReports: [reportItem], deletedIds: [] },
        })
      );
    }

    await saveSingleReportToIndexedDB(reportItem).catch(() => {});
    await resilientSetDoc('reports', reportItem.id, cleanFirestoreData(reportItem), {
      merge: true,
    }).catch(() => {});
  } else {
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

    await deleteReportFromIndexedDB(reportId).catch(() => {});
    await resilientDeleteDoc('reports', reportId).catch(() => {});
  }
};

export const saveKunjunganWargaToFirestore = async (item: KunjunganWargaData): Promise<KunjunganWargaData> => {
  const dataToSave: KunjunganWargaData = {
    ...item,
    id: item.id || `visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Update local state & IndexedDB
  const current = getLocalKunjunganList();
  const idx = current.findIndex((p) => p.id === dataToSave.id);
  const previousVisit = idx >= 0 ? current[idx] : undefined;
  let updatedList = [...current];
  if (idx >= 0) {
    updatedList[idx] = dataToSave;
  } else {
    updatedList = [dataToSave, ...updatedList];
  }
  setLocalKunjunganList(updatedList);
  saveVisitsToIndexedDB(updatedList).catch(() => {});

  // 2. Save to Firestore via resilient write queue
  await resilientSetDoc(KUNJUNGAN_COLLECTION, dataToSave.id, cleanFirestoreData(dataToSave), { merge: true });

  // 3. Save to server API buffer
  try {
    await fetch('/api/kunjungan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
    });
  } catch (e) {}

  // 4. Otomatis catatkan ke Laporan Harian Kepling & Capaian Kinerja
  await syncKunjunganToLaporanHarian(dataToSave, updatedList).catch(() => {});
  if (previousVisit) {
    const prevDate = getVisitIsoDate(previousVisit);
    const nextDate = getVisitIsoDate(dataToSave);
    const prevRes = resolveKeplingTargetForVisit(previousVisit);
    const nextRes = resolveKeplingTargetForVisit(dataToSave);
    if (prevDate !== nextDate || prevRes.resolvedKeplingId !== nextRes.resolvedKeplingId) {
      await syncKunjunganToLaporanHarian(previousVisit, updatedList).catch(() => {});
    }
  }

  return dataToSave;
};

export const deleteKunjunganWargaFromFirestore = async (id: string): Promise<void> => {
  const current = getLocalKunjunganList();
  const targetVisit = current.find((p) => p.id === id);

  markKunjunganDeleted(id);
  const filtered = current.filter((p) => p.id !== id);
  setLocalKunjunganList(filtered);
  saveVisitsToIndexedDB(filtered).catch(() => {});

  await resilientDeleteDoc(KUNJUNGAN_COLLECTION, id);

  try {
    await fetch(`/api/kunjungan/${id}`, { method: 'DELETE' });
  } catch (e) {}

  // Perbarui / bersihkan entri otomatis pada Laporan Harian Kepling & Capaian Kinerja
  if (targetVisit) {
    await syncKunjunganToLaporanHarian(targetVisit, filtered).catch(() => {});
  }
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
    snap.forEach((docSnap) => {
      const dat = docSnap.data() as KunjunganWargaData;
      const docId = docSnap.id || dat?.id;
      if (dat && docId && !deletedSet.has(docId)) {
        remoteItems.push({ ...dat, id: docId });
      }
    });
    const sorted = sortKunjunganDesc(remoteItems);
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

  // 1. Initial local emit (0ms)
  const initialLocal = getLocalKunjunganList();
  cb(initialLocal);

  // 2. Fast IndexedDB restore (10ms) if live Firestore hasn't arrived yet
  getVisitsFromIndexedDB()
    .then((idb) => {
      if (!isActive || hasLiveFirestore) return;
      if (Array.isArray(idb) && idb.length > initialLocal.length) {
        const deletedSet = new Set(getDeletedKunjunganIds());
        const cleaned = sortKunjunganDesc(idb.filter((x) => x && x.id && !deletedSet.has(x.id)));
        setLocalKunjunganList(cleaned);
        cb(cleaned);
      }
    })
    .catch(() => {});

  // 3. Server API buffer ONLY as cold-start fallback if Firestore hasn't delivered yet
  fetch('/api/kunjungan')
    .then((res) => res.json())
    .then((resData) => {
      if (!isActive || hasLiveFirestore) return;
      if (resData && resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
        const deletedSet = new Set(getDeletedKunjunganIds());
        const serverItems: KunjunganWargaData[] = resData.data.filter(
          (x: any) => x && x.id && !deletedSet.has(x.id)
        );
        const current = getLocalKunjunganList();
        if (current.length === 0 && serverItems.length > 0) {
          const sorted = sortKunjunganDesc(serverItems);
          setLocalKunjunganList(sorted);
          saveVisitsToIndexedDB(sorted).catch(() => {});
          cb(sorted);
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
          const remoteItems: KunjunganWargaData[] = [];
          snapshot.forEach((docSnap) => {
            const dat = docSnap.data() as KunjunganWargaData;
            const docId = docSnap.id || dat?.id;
            if (dat && docId && !deletedSet.has(docId)) {
              remoteItems.push({ ...dat, id: docId });
            }
          });

          const sorted = sortKunjunganDesc(remoteItems);
          if (!snapshot.metadata.fromCache) {
            hasLiveFirestore = true;
            setLocalKunjunganList(sorted);
            saveVisitsToIndexedDB(sorted).catch(() => {});
            cb(sorted);
          } else if (sorted.length > 0 && !hasLiveFirestore) {
            setLocalKunjunganList(sorted);
            saveVisitsToIndexedDB(sorted).catch(() => {});
            cb(sorted);
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
          const memMap = new Map<string, KunjunganWargaData>();
          memoryKunjungan.forEach((m) => { if (m && m.id) memMap.set(m.id, m); });
          const hydrated = event.data.items.map((it: KunjunganWargaData) => {
            if (!it?.fotoUrl && memMap.get(it.id)?.fotoUrl) {
              return { ...it, fotoUrl: memMap.get(it.id)!.fotoUrl };
            }
            return it;
          });
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
