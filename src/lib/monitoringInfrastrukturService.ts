import { LaporanMonitoringInfrastruktur } from '../types';
import {
  db,
  getAccessToken,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import * as XLSX from 'xlsx';
import { syncMonitoringPhotosToDrive } from './driveSync';

export const MONITORING_INFRA_COLLECTION = 'monitoring_infrastruktur';
export const MONITORING_INFRA_STORAGE_KEY = 'sikepling_monitoring_infra_v2';
export const MONITORING_INFRA_DELETED_KEY = 'sikepling_monitoring_infra_deleted_v2';
export const MONITORING_INFRA_CHANNEL = 'sikepling_monitoring_infra_channel';

// Default Seed Laporan Monitoring Resmi Sesuai Permintaan User (Kosong agar diisi Kepling)
export const INITIAL_MONITORING_DATA: LaporanMonitoringInfrastruktur[] = [];

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

function stripMonitoringMediaForBroadcast(items: LaporanMonitoringInfrastruktur[]): LaporanMonitoringInfrastruktur[] {
  const strip = (s?: string) => (typeof s === 'string' && s.startsWith('data:') && s.length > 200 ? '' : s);
  return items.map((it) => {
    if (!it) return it;
    const copy: any = { ...it };
    if (copy.fotoSebelumUrl) copy.fotoSebelumUrl = strip(copy.fotoSebelumUrl);
    if (copy.fotoProsesUrl) copy.fotoProsesUrl = strip(copy.fotoProsesUrl);
    if (copy.fotoSelesaiUrl) copy.fotoSelesaiUrl = strip(copy.fotoSelesaiUrl);
    if (copy.fotoUrl) copy.fotoUrl = strip(copy.fotoUrl);
    return copy;
  });
}

export const setLocalMonitoringList = (items: LaporanMonitoringInfrastruktur[]): void => {
  const deletedSet = new Set(getDeletedMonitoringIds());
  const cleaned = items.filter((x) => x && x.id && !deletedSet.has(x.id));
  memoryMonitoring = cleaned;
  safeSetLocalStorage(MONITORING_INFRA_STORAGE_KEY, JSON.stringify(cleaned), { skipIdbMirror: true });

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(MONITORING_INFRA_CHANNEL);
      bc.postMessage({ type: 'SYNC_MONITORING', items: stripMonitoringMediaForBroadcast(cleaned) });
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

export const fetchMonitoringFromFirestore = async (): Promise<LaporanMonitoringInfrastruktur[]> => {
  const local = getLocalMonitoringList();
  if (!db || isFirestoreQuotaCooldownActive()) return local;
  try {
    const colRef = collection(db, MONITORING_INFRA_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const deletedSet = new Set(getDeletedMonitoringIds());
    const remote: LaporanMonitoringInfrastruktur[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && !deletedSet.has(docSnap.id)) {
        remote.push({ ...(d as LaporanMonitoringInfrastruktur), id: docSnap.id });
      }
    });
    remote.sort((a, b) => {
      const dateA = a.tanggal || a.createdAt || '';
      const dateB = b.tanggal || b.createdAt || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (remote.length > 0 || !snap.metadata.fromCache) {
      setLocalMonitoringList(remote);
      return remote;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[Monitoring Infra fetch error]:', err);
    }
  }
  return local;
};

export const subscribeMonitoringReports = (
  callback: (items: LaporanMonitoringInfrastruktur[]) => void
): Unsubscribe => {
  const initial = getLocalMonitoringList();
  callback(initial);

  let isActive = true;
  let receivedServerSnapshot = false;

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(MONITORING_INFRA_CHANNEL);
      bc.onmessage = (ev) => {
        if (isActive && ev.data?.items && Array.isArray(ev.data.items)) {
          const deletedSet = new Set(getDeletedMonitoringIds());
          const memMap = new Map<string, any>();
          memoryMonitoring.forEach((m) => { if (m && m.id) memMap.set(m.id, m); });
          const cleaned = ev.data.items
            .filter((x: LaporanMonitoringInfrastruktur) => x && x.id && !deletedSet.has(x.id))
            .map((x: any) => {
              const prev = memMap.get(x.id);
              if (!prev) return x;
              return {
                ...x,
                fotoSebelumUrl: x.fotoSebelumUrl || prev.fotoSebelumUrl,
                fotoProsesUrl: x.fotoProsesUrl || prev.fotoProsesUrl,
                fotoSelesaiUrl: x.fotoSelesaiUrl || prev.fotoSelesaiUrl,
                fotoUrl: x.fotoUrl || prev.fotoUrl,
              };
            });
          memoryMonitoring = cleaned;
          callback(cleaned);
        }
      };
    }
  } catch {
    // Ignore
  }

  let firestoreUnsub: Unsubscribe = () => {};
  let fallbackTimer: any = null;
  if (db && !isFirestoreQuotaCooldownActive()) {
    try {
      const colRef = collection(db, MONITORING_INFRA_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (!isActive) return;
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

          remote.sort((a, b) => {
            const dateA = a.tanggal || a.createdAt || '';
            const dateB = b.tanggal || b.createdAt || '';
            if (dateB !== dateA) return dateB.localeCompare(dateA);
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });

          if (!snapshot.metadata.fromCache) {
            receivedServerSnapshot = true;
            setLocalMonitoringList(remote);
            callback(remote);
          } else if (remote.length > 0 && !receivedServerSnapshot) {
            const local = getLocalMonitoringList();
            const merged = smartMergeMonitoring(local, remote);
            setLocalMonitoringList(merged);
            callback(merged);
          }
        },
        (err) => {
          if (isQuotaExhaustedError(err)) {
            markFirestoreQuotaExhausted(err);
            isActive = false;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            try { firestoreUnsub(); } catch {}
            return;
          }
          console.warn('[Monitoring Infra Firestore error]:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchMonitoringFromFirestore().then((items) => {
              if (isActive) callback(items);
            });
          }
        }
      );

      fallbackTimer = setTimeout(() => {
        if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
          fetchMonitoringFromFirestore().then((items) => {
            if (isActive && !receivedServerSnapshot && items.length > 0) {
              callback(items);
            }
          });
        }
      }, 4500);
    } catch (err) {
      console.warn('[Monitoring Infra setup error]:', err);
    }
  }

  return () => {
    isActive = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (bc) bc.close();
    try { firestoreUnsub(); } catch {}
  };
};

export const saveMonitoringReport = async (
  item: LaporanMonitoringInfrastruktur
): Promise<void> => {
  let itemToSave = item;

  // 0. Sync to Drive if connected
  try {
    const activeToken = await getAccessToken();
    if (activeToken) {
      itemToSave = await syncMonitoringPhotosToDrive(item, activeToken);
    }
  } catch (err) {
    console.warn('Drive sync for monitoring failed:', err);
  }

  const current = getLocalMonitoringList();
  const filtered = current.filter((x) => x.id !== itemToSave.id);
  const updated = [itemToSave, ...filtered].sort((a, b) => {
    if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setLocalMonitoringList(updated);

  const cleaned = cleanFirestoreData(itemToSave);
  await resilientSetDoc(MONITORING_INFRA_COLLECTION, itemToSave.id, cleaned, { merge: true });
};

export const deleteMonitoringReport = async (id: string): Promise<void> => {
  markMonitoringDeleted(id);
  const current = getLocalMonitoringList();
  const updated = current.filter((x) => x.id !== id);
  setLocalMonitoringList(updated);

  await resilientDeleteDoc(MONITORING_INFRA_COLLECTION, id);
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
