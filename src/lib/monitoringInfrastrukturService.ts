import { LaporanMonitoringInfrastruktur } from '../types';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import * as XLSX from 'xlsx';

export const MONITORING_INFRA_COLLECTION = 'monitoring_infrastruktur';
export const MONITORING_INFRA_STORAGE_KEY = 'sikepling_monitoring_infra_v2';
export const MONITORING_INFRA_DELETED_KEY = 'sikepling_monitoring_infra_deleted_v2';
export const MONITORING_INFRA_CHANNEL = 'sikepling_monitoring_infra_channel';

// Default Seed Laporan Monitoring Resmi Sesuai Permintaan User
export const INITIAL_MONITORING_DATA: LaporanMonitoringInfrastruktur[] = [
  {
    id: 'mon_158_mangga',
    nomorLaporan: '158/MANGGA',
    subjek: 'LPJU Padam sebanyak 9 Titik',
    lokasi: 'Jl. Tali Air Kelurahan Mangga Kecamatan Medan Tuntungan',
    lingkunganNomor: 10,
    koordinatUrl: 'https://maps.app.goo.gl/wVNAV1fu3ufn1ihy5?g_st=aw',
    tanggal: '2026-09-30',
    pelapor: 'Fery Arapenta Tarigan',
    kategoriIsu: 'LPJU / Penerangan',
    statusTindakLanjut: 'MENUNGGU_TINDAK_LANJUT',
    keterangan:
      'Laporan hasil monitoring lapangan: Terdata sebanyak 9 titik tiang LPJU dalam kondisi padam/rusak di sepanjang ruas Jl. Tali Air Kelurahan Mangga. Mengakibatkan kondisi jalan gelap dan rawan gangguan kamtibmas saat malam hari.',
    fotoAngle1Url: '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
    fotoAngle1Label: 'Angle 1: Tampak Depan / Tiang LPJU Padam',
    fotoAngle2Url: '/src/assets/images/proses_instalasi_lpju_1790856798909.jpg',
    fotoAngle2Label: 'Angle 2: Tampak Samping / Deretan Tiang Jl. Tali Air',
    fotoAngle3Url: '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
    fotoAngle3Label: 'Angle 3: Tampak Luas / Perspektif Wilayah Pemukiman',
    createdAt: '2026-09-30T09:30:00.000Z',
    updatedAt: '2026-09-30T09:30:00.000Z',
  },
];

let memoryMonitoring: LaporanMonitoringInfrastruktur[] = [];
let deletedMonitoringIdsCache: string[] = safeGetLocalStorage<string[]>(
  MONITORING_INFRA_DELETED_KEY,
  []
);

export const getDeletedMonitoringIds = (): string[] => {
  if (!Array.isArray(deletedMonitoringIdsCache)) deletedMonitoringIdsCache = [];
  return deletedMonitoringIdsCache;
};

export const markMonitoringDeleted = (id: string): void => {
  const current = getDeletedMonitoringIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedMonitoringIdsCache = current;
    safeSetLocalStorage(MONITORING_INFRA_DELETED_KEY, JSON.stringify(current));
  }
};

export const getLocalMonitoringList = (): LaporanMonitoringInfrastruktur[] => {
  const deletedSet = new Set(getDeletedMonitoringIds());
  const stored = safeGetLocalStorage<LaporanMonitoringInfrastruktur[]>(
    MONITORING_INFRA_STORAGE_KEY,
    []
  );

  if (stored && Array.isArray(stored) && stored.length > 0) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    if (cleaned.length > 0) {
      memoryMonitoring = cleaned;
      return cleaned;
    }
  }

  if (memoryMonitoring.length > 0) {
    const cleaned = memoryMonitoring.filter((x) => x && x.id && !deletedSet.has(x.id));
    if (cleaned.length > 0) {
      memoryMonitoring = cleaned;
      return cleaned;
    }
  }

  const initialCleaned = INITIAL_MONITORING_DATA.filter((x) => !deletedSet.has(x.id));
  memoryMonitoring = initialCleaned;
  safeSetLocalStorage(MONITORING_INFRA_STORAGE_KEY, JSON.stringify(initialCleaned));
  return initialCleaned;
};

export const setLocalMonitoringList = (items: LaporanMonitoringInfrastruktur[]): void => {
  const deletedSet = new Set(getDeletedMonitoringIds());
  const cleaned = items.filter((x) => x && x.id && !deletedSet.has(x.id));
  memoryMonitoring = cleaned;
  safeSetLocalStorage(MONITORING_INFRA_STORAGE_KEY, JSON.stringify(cleaned));

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(MONITORING_INFRA_CHANNEL);
      bc.postMessage({ type: 'SYNC_MONITORING', items: cleaned });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
};

export const smartMergeMonitoring = (
  local: LaporanMonitoringInfrastruktur[],
  remote: LaporanMonitoringInfrastruktur[]
): LaporanMonitoringInfrastruktur[] => {
  const deletedSet = new Set(getDeletedMonitoringIds());
  const map = new Map<string, LaporanMonitoringInfrastruktur>();

  for (const item of local) {
    if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
  }
  for (const item of remote) {
    if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.tanggal || a.createdAt || '';
    const dateB = b.tanggal || b.createdAt || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
};

export const subscribeMonitoringReports = (
  callback: (items: LaporanMonitoringInfrastruktur[]) => void
): Unsubscribe => {
  const initial = getLocalMonitoringList();
  callback(initial);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(MONITORING_INFRA_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.items && Array.isArray(ev.data.items)) {
          const deletedSet = new Set(getDeletedMonitoringIds());
          const cleaned = ev.data.items.filter(
            (x: LaporanMonitoringInfrastruktur) => x && x.id && !deletedSet.has(x.id)
          );
          memoryMonitoring = cleaned;
          callback(cleaned);
        }
      };
    }
  } catch {
    // Ignore
  }

  let firestoreUnsub: Unsubscribe = () => {};
  if (db) {
    try {
      const colRef = collection(db, MONITORING_INFRA_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          const deletedSet = new Set(getDeletedMonitoringIds());
          const remote: LaporanMonitoringInfrastruktur[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d && !deletedSet.has(docSnap.id)) {
              remote.push({
                ...(d as LaporanMonitoringInfrastruktur),
                id: docSnap.id,
              });
            }
          });

          const local = getLocalMonitoringList();
          const merged = smartMergeMonitoring(local, remote);
          setLocalMonitoringList(merged);
          callback(merged);
        },
        (err) => {
          console.warn('[Monitoring Infra Firestore error]:', err);
        }
      );
    } catch (err) {
      console.warn('[Monitoring Infra setup error]:', err);
    }
  }

  return () => {
    if (bc) bc.close();
    firestoreUnsub();
  };
};

export const saveMonitoringReport = async (
  item: LaporanMonitoringInfrastruktur
): Promise<void> => {
  const current = getLocalMonitoringList();
  const filtered = current.filter((x) => x.id !== item.id);
  const updated = [item, ...filtered].sort((a, b) => {
    if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setLocalMonitoringList(updated);

  if (db) {
    try {
      const cleaned = cleanFirestoreData(item);
      await setDoc(doc(db, MONITORING_INFRA_COLLECTION, item.id), cleaned, { merge: true });
    } catch (err) {
      console.warn('[saveMonitoringReport to firestore error]:', err);
    }
  }
};

export const deleteMonitoringReport = async (id: string): Promise<void> => {
  markMonitoringDeleted(id);
  const current = getLocalMonitoringList();
  const updated = current.filter((x) => x.id !== id);
  setLocalMonitoringList(updated);

  if (db) {
    try {
      await deleteDoc(doc(db, MONITORING_INFRA_COLLECTION, id));
    } catch (err) {
      console.warn('[deleteMonitoringReport from firestore error]:', err);
    }
  }
};

export const formatMonitoringForWhatsApp = (report: LaporanMonitoringInfrastruktur): string => {
  const statusStr =
    report.statusTindakLanjut === 'SELESAI_DIPERBAIKI'
      ? 'Sudah Ditangani'
      : report.statusTindakLanjut === 'SEDANG_DITANGANI'
      ? 'Sedang Ditangani'
      : 'Belum Ditangani';

  let displayTanggal = report.tanggal || '-';
  try {
    if (report.tanggal) {
      const d = new Date(report.tanggal);
      if (!isNaN(d.getTime())) {
        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        displayTanggal = `${day} ${month} ${year}`;
      }
    }
  } catch {
    // fallback to raw date
  }

  const parts = [
    '*LAPORAN MONITORING*',
    '',
    `- Nomor laporan : ${report.nomorLaporan || '-'}`,
    `- Subjek : ${report.subjek || '-'}`,
    `- Lokasi : ${report.lokasi || '-'}`,
    `- koordinat : ${report.koordinatUrl || '-'}`,
    `- Tanggal  : ${displayTanggal}`,
    `-  Dari : ${report.pelapor || '-'}`,
    `- Status : ${statusStr}`,
  ];

  if (report.keterangan && report.keterangan.trim()) {
    parts.push(`- Keterangan : ${report.keterangan.trim()}`);
  }

  return parts.join('\n');
};

export const getWhatsAppShareUrl = (report: LaporanMonitoringInfrastruktur): string => {
  const text = formatMonitoringForWhatsApp(report);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
};

export const exportMonitoringToExcel = (
  items: LaporanMonitoringInfrastruktur[],
  fileName: string = 'Laporan_Monitoring_Infrastruktur_Mangga'
): void => {
  const headers = [
    'No',
    'Nomor Laporan',
    'Tanggal',
    'Subjek Laporan',
    'Lokasi',
    'Lingkungan',
    'Pelapor (Dari)',
    'Kategori Isu',
    'Status Penanganan',
    'Koordinat Google Maps',
    'Keterangan & Rincian',
  ];

  const rows = items.map((it, idx) => [
    idx + 1,
    it.nomorLaporan,
    it.tanggal,
    it.subjek,
    it.lokasi,
    it.lingkunganNomor ? `Lingkungan ${it.lingkunganNomor}` : 'Kelurahan',
    it.pelapor,
    it.kategoriIsu || 'Infrastruktur',
    it.statusTindakLanjut === 'SELESAI_DIPERBAIKI'
      ? 'Sudah Ditangani'
      : it.statusTindakLanjut === 'SEDANG_DITANGANI'
      ? 'Sedang Ditangani'
      : 'Belum Ditangani',
    it.koordinatUrl || '-',
    it.keterangan || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monitoring Infrastruktur');
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
