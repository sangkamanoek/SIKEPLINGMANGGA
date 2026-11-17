import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { cleanFirestoreData } from './firestoreService';
import { resilientDeleteDoc, resilientSetDoc } from './firestoreWriteQueue';
import {
  deleteReportFromIndexedDB,
  saveSingleReportToIndexedDB,
} from './indexedDbStorage';
import { JadwalPoskoItem, KeplingPetugasPosko, LaporanHarianItem } from '../types';
import {
  KEPLING_ACCOUNTS,
  KEPLING_DATA_RESMI,
  ROMAN_NUMERALS,
  getEffectiveProfile,
} from '../data/keplingList';

export const JADWAL_POSKO_STORAGE_KEY = 'sikepling_jadwal_posko_v1';
export const JADWAL_POSKO_COLLECTION = 'jadwal_posko_kelurahan';

/**
 * Buat seed awal jadwal posko harian jika belum ada
 */
export const getInitialSampleJadwalPosko = (): JadwalPoskoItem[] => {
  const today = new Date().toISOString().split('T')[0];

  // Shift 1: Kepling Lingkungan 1 - 6 untuk Posko Trantibum
  const petugasTrantibum: KeplingPetugasPosko[] = KEPLING_DATA_RESMI.slice(0, 6).map((k) => ({
    keplingId: `kepling_${k.nomor}`,
    nomorLingkungan: k.nomor,
    namaKepling: k.namaKepling,
    telepon: k.telepon,
    statusKehadiran: 'Belum Hadir',
  }));

  // Shift 2: Kepling Lingkungan 7 - 12 untuk Posko Kewaspadaan Banjir
  const petugasBanjir: KeplingPetugasPosko[] = KEPLING_DATA_RESMI.slice(6, 12).map((k) => ({
    keplingId: `kepling_${k.nomor}`,
    nomorLingkungan: k.nomor,
    namaKepling: k.namaKepling,
    telepon: k.telepon,
    statusKehadiran: 'Belum Hadir',
  }));

  const itemTrantibum: JadwalPoskoItem = {
    id: `posko_trantib_${today}`,
    jenisPosko: 'posko_trantibum',
    namaPosko: 'Posko Trantibum (Ketentraman & Ketertiban Umum)',
    tanggal: today,
    waktuMulai: 'Pukul 21.00 WIB s/d Selesai',
    lokasiPosko: 'Kantor Lurah',
    arahanTugas:
      'Lakukan apel malam pukul 21.00 WIB di Kantor Lurah, patroli pemantauan siskamling, pembubaran potensi kerumunan remaja/balap liar, dan koordinasi dengan Babinsa/Bhabinkamtibmas.',
    penanggungJawab: 'Kasi Ketentraman & Ketertiban Umum',
    status: 'TERJADWAL',
    petugasKepling: petugasTrantibum,
    createdById: 'kasi_trantibum',
    createdByName: 'KASI KETENTRAMAN & KETERTIBAN UMUM',
    createdByRole: 'kasi_trantibum',
    createdAt: new Date().toISOString(),
  };

  const itemBanjir: JadwalPoskoItem = {
    id: `posko_banjir_${today}`,
    jenisPosko: 'posko_banjir',
    namaPosko: 'Posko Kewaspadaan Banjir',
    tanggal: today,
    waktuMulai: 'Pukul 21.00 WIB s/d Selesai',
    lokasiPosko: 'Taman Segitiga Lk. 9',
    arahanTugas:
      'Siaga di Taman Segitiga Lk. 9, pantau debit saluran drainase primer/sekunder, cek potensi sumbatan sampah pada gorong-gorong, siagakan alat evakuasi ringan, dan laporkan ketinggian debit air berkala.',
    penanggungJawab: 'Lurah Kelurahan Mangga / Kasi Trantibum',
    status: 'TERJADWAL',
    petugasKepling: petugasBanjir,
    createdById: 'super_admin',
    createdByName: 'Feriyanto Arapenta Tarigan, A.Md (Lurah Mangga)',
    createdByRole: 'super_admin',
    createdAt: new Date().toISOString(),
  };

  return [itemTrantibum, itemBanjir];
};

const normalizeOfficialPoskoLocations = (items: JadwalPoskoItem[]): JadwalPoskoItem[] => {
  return items.map((item) => {
    if (
      item.jenisPosko === 'posko_trantibum' &&
      item.lokasiPosko === 'Kantor Kelurahan Mangga & Patroli Mobile Wilayah'
    ) {
      return { ...item, lokasiPosko: 'Kantor Lurah' };
    }
    if (
      item.jenisPosko === 'posko_banjir' &&
      item.lokasiPosko === 'Pos Pantau Siaga Banjir & Titik Rawan Genangan Air Kelurahan Mangga'
    ) {
      return { ...item, lokasiPosko: 'Taman Segitiga Lk. 9' };
    }
    return item;
  });
};

export const getLocalJadwalPoskoList = (): JadwalPoskoItem[] => {
  const local = safeGetLocalStorage<JadwalPoskoItem[]>(JADWAL_POSKO_STORAGE_KEY, []);
  if (Array.isArray(local) && local.length > 0) {
    return normalizeOfficialPoskoLocations(local);
  }
  const initial = getInitialSampleJadwalPosko();
  saveLocalJadwalPoskoList(initial);
  return initial;
};

export const saveLocalJadwalPoskoList = (items: JadwalPoskoItem[]): void => {
  safeSetLocalStorage(JADWAL_POSKO_STORAGE_KEY, JSON.stringify(items));
};

export const fetchJadwalPoskoFromFirestore = async (): Promise<JadwalPoskoItem[]> => {
  try {
    const q = query(collection(db, JADWAL_POSKO_COLLECTION), orderBy('tanggal', 'desc'));
    const snap = await getDocs(q);
    const list: JadwalPoskoItem[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as JadwalPoskoItem), id: d.id });
    });
    if (list.length > 0) {
      const normalized = normalizeOfficialPoskoLocations(list);
      saveLocalJadwalPoskoList(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('Failed to fetch jadwal posko from Firestore, using local cache:', err);
  }
  return getLocalJadwalPoskoList();
};

export const subscribeJadwalPoskoFromFirestore = (cb: (items: JadwalPoskoItem[]) => void) => {
  try {
    const q = query(collection(db, JADWAL_POSKO_COLLECTION), orderBy('tanggal', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: JadwalPoskoItem[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as JadwalPoskoItem), id: d.id });
        });
        if (list.length > 0) {
          const normalized = normalizeOfficialPoskoLocations(list);
          saveLocalJadwalPoskoList(normalized);
          cb(normalized);
        } else {
          cb(getLocalJadwalPoskoList());
        }
      },
      (err) => {
        console.warn('Jadwal posko snapshot error:', err);
        cb(getLocalJadwalPoskoList());
      }
    );
  } catch (e) {
    console.warn('Jadwal posko subscribe error:', e);
    cb(getLocalJadwalPoskoList());
    return () => {};
  }
};

export const saveJadwalPoskoItem = async (item: JadwalPoskoItem): Promise<void> => {
  const current = getLocalJadwalPoskoList();
  const idx = current.findIndex((x) => x.id === item.id);
  const now = new Date().toISOString();
  const updatedItem = {
    ...item,
    updatedAt: now,
  };

  let updatedList: JadwalPoskoItem[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = updatedItem;
  } else {
    updatedList = [updatedItem, ...current];
  }

  saveLocalJadwalPoskoList(updatedList);
  window.dispatchEvent(new CustomEvent('jadwal-posko-updated', { detail: updatedList }));

  try {
    await setDoc(doc(db, JADWAL_POSKO_COLLECTION, item.id), updatedItem);
  } catch (err) {
    console.warn('Firestore setDoc failed for jadwal posko, saved locally:', err);
  }
};

export const deleteJadwalPoskoItem = async (id: string): Promise<void> => {
  const current = getLocalJadwalPoskoList();
  const filtered = current.filter((x) => x.id !== id);
  saveLocalJadwalPoskoList(filtered);
  window.dispatchEvent(new CustomEvent('jadwal-posko-updated', { detail: filtered }));

  try {
    await deleteDoc(doc(db, JADWAL_POSKO_COLLECTION, id));
  } catch (err) {
    console.warn('Firestore deleteDoc failed for jadwal posko, removed locally:', err);
  }
};

const HARI_POSKO_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const sanitizePoskoKey = (poskoId: string): string => {
  const clean = String(poskoId || 'pk').replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 55) return clean;
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (h * 31 + clean.charCodeAt(i)) | 0;
  }
  return `${clean.slice(0, 35)}_${Math.abs(h).toString(36)}`;
};

export const buildPoskoAttendanceReportId = (
  poskoId: string,
  nomorLingkungan: number
): string => `lap_pk_${sanitizePoskoKey(poskoId)}_lk${nomorLingkungan}`;

const formatDeviceClockWib = (d: Date = new Date()): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
};

const getHariIndonesiaFromIso = (isoDate: string): string => {
  const parts = (isoDate || '').split('-').map((n) => parseInt(n, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return HARI_POSKO_ID[dt.getDay()] || 'Senin';
  }
  return HARI_POSKO_ID[new Date().getDay()] || 'Senin';
};

/**
 * Otomatis mencatat absen kehadiran Posko oleh Kepling (status Hadir)
 * ke dalam Laporan Harian Kepling (Firestore `reports`, IndexedDB, LocalStorage)
 * dan menghapus entri otomatis bila status diubah ke non-Hadir.
 */
export const syncPoskoKehadiranToLaporanHarian = async (
  posko: JadwalPoskoItem,
  petugas: KeplingPetugasPosko
): Promise<void> => {
  if (!posko || !petugas || !petugas.nomorLingkungan) return;

  const LAPORAN_STORAGE_KEY = 'kepling_local_laporan_history_v2';
  const nowIso = new Date().toISOString();
  const reportId = buildPoskoAttendanceReportId(posko.id, petugas.nomorLingkungan);
  const acc = KEPLING_ACCOUNTS.find(
    (k) => k.nomorLingkungan === petugas.nomorLingkungan || k.id === petugas.keplingId
  );
  const profile = acc ? getEffectiveProfile(acc) : null;
  const roman = ROMAN_NUMERALS[petugas.nomorLingkungan - 1] || String(petugas.nomorLingkungan);
  const resolvedKeplingId = acc?.id || petugas.keplingId || `kepling_${petugas.nomorLingkungan}`;

  const poskoPrefix = `[Absensi Posko] Hadir: ${posko.namaPosko}`;
  const poskoDetail = `${poskoPrefix} (${petugas.jamHadir || formatDeviceClockWib()}) di ${posko.lokasiPosko}${
    petugas.catatanSituasi?.trim() ? ` — ${petugas.catatanSituasi.trim()}` : ''
  }`;

  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_STORAGE_KEY, []);

  if (petugas.statusKehadiran === 'Hadir') {
    const isTrantibum = posko.jenisPosko === 'posko_trantibum';
    const fotos = petugas.fotoKehadiranUrl
      ? [
          {
            id: `foto_${reportId}`,
            url: petugas.fotoKehadiranUrl,
            name: `Kehadiran_${posko.jenisPosko}_Lk${petugas.nomorLingkungan}.jpg`,
            timestamp: petugas.waktuUploadFoto || nowIso,
            kategori: isTrantibum ? 'poskamling' : 'umum',
            keterangan: `${posko.namaPosko} (${petugas.jamHadir || ''})`,
          },
        ]
      : [];

    const reportItem: LaporanHarianItem = {
      id: reportId,
      keplingId: resolvedKeplingId,
      lingkungan: acc?.lingkungan || `Lingkungan ${roman}`,
      namaKepling: profile?.nama || acc?.nama || petugas.namaKepling,
      jabatan: acc?.jabatan || `Kepala Lingkungan ${roman}`,
      kelurahan: 'Kelurahan Mangga',
      kecamatan: 'Kecamatan Medan Tuntungan',
      hari: getHariIndonesiaFromIso(posko.tanggal),
      tanggal: posko.tanggal,
      tanggalLaporan: posko.tanggal,
      kinerja: {
        opsirPbbWp: 0,
        perlinsosKk: 0,
        ikdOrang: 0,
        bpjsKetenagakerjaanOrang: 0,
        ...(isTrantibum
          ? {
              poskamlingAdaGiat: true,
              poskamlingStatus: 'Piket Posko Trantibum',
              poskamlingLokasi: posko.lokasiPosko,
              poskamlingJamOperasional: petugas.jamHadir || posko.waktuMulai,
              poskamlingKeterangan:
                petugas.catatanSituasi?.trim() || 'Piket malam Posko Trantibum Kelurahan.',
            }
          : {}),
        kegiatanLainnya: poskoDetail,
      },
      jumlahDokumentasi: fotos.length,
      dokumentasiFoto: fotos,
      petugasNama: profile?.nama || acc?.nama || petugas.namaKepling,
      petugasRole: 'kepling',
      uraianTugas: `Kehadiran ${posko.namaPosko} (${petugas.jamHadir || formatDeviceClockWib()})`,
      catatanUmum: petugas.catatanSituasi?.trim()
        ? `Situasi Posko: ${petugas.catatanSituasi.trim()}`
        : `Tercatat otomatis dari Absensi Kehadiran Posko di ${posko.lokasiPosko}.`,
      createdAt: nowIso,
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
            r.keplingId === resolvedKeplingId &&
            (r.tanggal === posko.tanggal || r.tanggalLaporan === posko.tanggal);
          if (matchesTarget && r.kinerja?.kegiatanLainnya?.includes(poskoPrefix)) {
            const filteredLines = r.kinerja.kegiatanLainnya
              .split('\n')
              .filter((line) => !line.includes(poskoPrefix))
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
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-reports-updated', {
          detail: {
            upsertedReports: [],
            deletedIds: [reportId],
            deletedKeplingIds: [resolvedKeplingId],
            stripDate: posko.tanggal,
            stripPrefix: poskoPrefix,
          },
        })
      );
    }

    await deleteReportFromIndexedDB(reportId).catch(() => {});
    await resilientDeleteDoc('reports', reportId).catch(() => {});
  }
};

/**
 * Update kehadiran Kepling bertugas (Jam hadir, foto, catatan)
 */
export const updateKeplingPoskoKehadiran = async (
  poskoId: string,
  keplingId: string,
  payload: {
    statusKehadiran: 'Hadir' | 'Belum Hadir' | 'Izin' | 'Sakit';
    jamHadir?: string;
    fotoKehadiranUrl?: string;
    catatanSituasi?: string;
  }
): Promise<void> => {
  const list = getLocalJadwalPoskoList();
  const posko = list.find((p) => p.id === poskoId);
  if (!posko) return;

  const now = new Date().toISOString();
  const deviceWibTime = formatDeviceClockWib(new Date());

  let updatedTargetPetugas: KeplingPetugasPosko | undefined;

  const updatedPetugas = posko.petugasKepling.map((k) => {
    if (k.keplingId === keplingId || String(k.nomorLingkungan) === keplingId.replace('kepling_', '')) {
      const nextPetugas: KeplingPetugasPosko = {
        ...k,
        statusKehadiran: payload.statusKehadiran,
        jamHadir: payload.jamHadir || deviceWibTime,
        fotoKehadiranUrl: payload.fotoKehadiranUrl || k.fotoKehadiranUrl,
        waktuUploadFoto: payload.fotoKehadiranUrl ? now : k.waktuUploadFoto,
        catatanSituasi: payload.catatanSituasi !== undefined ? payload.catatanSituasi : k.catatanSituasi,
      };
      updatedTargetPetugas = nextPetugas;
      return nextPetugas;
    }
    return k;
  });

  // Jika ada petugas yang hadir, ubah status posko jadi BERLANGSUNG jika tadinya TERJADWAL
  let newStatus = posko.status;
  if (posko.status === 'TERJADWAL' && payload.statusKehadiran === 'Hadir') {
    newStatus = 'BERLANGSUNG';
  }

  const updatedPosko: JadwalPoskoItem = {
    ...posko,
    status: newStatus,
    petugasKepling: updatedPetugas,
    updatedAt: now,
  };

  await saveJadwalPoskoItem(updatedPosko);

  if (updatedTargetPetugas) {
    await syncPoskoKehadiranToLaporanHarian(updatedPosko, updatedTargetPetugas).catch(() => {});
  }
};

/**
 * Tandai posko telah SELESAI oleh Lurah atau Kasi Trantibum
 */
export const selesaikanPosko = async (
  poskoId: string,
  verifikator: {
    nama: string;
    role: string;
    catatan?: string;
  }
): Promise<void> => {
  const list = getLocalJadwalPoskoList();
  const posko = list.find((p) => p.id === poskoId);
  if (!posko) return;

  const now = new Date().toISOString();
  const updatedPosko: JadwalPoskoItem = {
    ...posko,
    status: 'SELESAI',
    selesaiAt: now,
    catatanSelesai: verifikator.catatan || 'Posko telah selesai dan daftar hadir diverifikasi lengkap.',
    diverifikasiOlehNama: verifikator.nama,
    diverifikasiOlehRole: verifikator.role,
    updatedAt: now,
  };

  await saveJadwalPoskoItem(updatedPosko);
};
