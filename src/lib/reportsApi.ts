import { LaporanHarianItem } from '../types';
import {
  fetchReportsFromFirestore,
  saveReportToFirestore,
  deleteReportFromFirestore,
  resetAllReportsInFirestore,
  subscribeReportsFromFirestore,
  shouldFilterReport,
} from './firestoreService';
import { purgeAllClientCache } from './purgeCache';

export const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history_v2';
export const LOCAL_STORAGE_KEY_DELETED = 'kepling_deleted_reports_v1';
export const KNOWN_STORAGE_KEYS = [
  'kepling_local_laporan_history_v2',
  'kepling_local_laporan_history',
  'laporan_kepling_local',
  'kepling_reports',
  'sikepling_reports',
];

// In-memory set for transient deleted IDs during active session
const sessionDeletedIds = new Set<string>();

export const getLocalDeletedReportIds = (): Set<string> => {
  return sessionDeletedIds;
};

export const addLocalDeletedReportId = (id: string) => {
  if (id) sessionDeletedIds.add(id);
};

export const isReportDeleted = (r: LaporanHarianItem): boolean => {
  if (r && r.id && sessionDeletedIds.has(r.id)) return true;
  return shouldFilterReport(r);
};

/**
 * Fetch all reports strictly online from Server API buffer and Firestore.
 * Does NOT read from or write to client device cache (LocalStorage / IndexedDB).
 */
export const fetchAllReports = async (): Promise<LaporanHarianItem[]> => {
  const map = new Map<string, LaporanHarianItem>();

  // 1. Fetch online directly from Server API buffer (/api/reports) - fastest, lightweight for low-end mobile
  try {
    const res = await fetch(`/api/reports?light=true&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      const serverReports = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (Array.isArray(serverReports) && serverReports.length > 0) {
        serverReports.forEach((r: LaporanHarianItem) => {
          if (r && r.id && !sessionDeletedIds.has(r.id) && !shouldFilterReport(r)) {
            map.set(r.id, r);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[Online API] Error reading /api/reports:', e);
  }

  // 2. Only if Server API returned 0 reports, fallback to Firebase Firestore getDocs to conserve mobile RAM/bandwidth
  if (map.size === 0) {
    try {
      const firestoreReports = await fetchReportsFromFirestore();
      if (Array.isArray(firestoreReports) && firestoreReports.length > 0) {
        firestoreReports.forEach((r) => {
          if (r && r.id && !sessionDeletedIds.has(r.id) && !shouldFilterReport(r)) {
            map.set(r.id, r);
          }
        });
      }
    } catch (err) {
      console.warn('[Online Firestore] Error reading Firestore reports:', err);
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return merged;
};

/**
 * Seed initial reports - disabled for 100% clean production operation
 */
export const seedInitialReports = async (): Promise<LaporanHarianItem[]> => {
  return [];
};

export interface ReportDiffResult {
  localOnly: LaporanHarianItem[];
  serverOnly: LaporanHarianItem[];
  synced: LaporanHarianItem[];
  conflicted: { local: LaporanHarianItem; server: LaporanHarianItem }[];
}

export const compareLocalVsServerReports = async (localReports: LaporanHarianItem[]): Promise<ReportDiffResult> => {
  const serverReports = await fetchAllReports();
  const serverMap = new Map<string, LaporanHarianItem>();
  serverReports.forEach(r => serverMap.set(r.id, r));

  const localMap = new Map<string, LaporanHarianItem>();
  localReports.forEach(r => localMap.set(r.id, r));

  const localOnly: LaporanHarianItem[] = [];
  const serverOnly: LaporanHarianItem[] = [];
  const synced: LaporanHarianItem[] = [];
  const conflicted: { local: LaporanHarianItem; server: LaporanHarianItem }[] = [];

  localReports.forEach(localItem => {
    const serverItem = serverMap.get(localItem.id);
    if (!serverItem) {
      localOnly.push(localItem);
    } else {
      const localTime = new Date(localItem.createdAt || 0).getTime();
      const serverTime = new Date(serverItem.createdAt || 0).getTime();
      if (Math.abs(localTime - serverTime) > 1000 && JSON.stringify(localItem) !== JSON.stringify(serverItem)) {
        conflicted.push({ local: localItem, server: serverItem });
      } else {
        synced.push(localItem);
      }
    }
  });

  serverReports.forEach(serverItem => {
    if (!localMap.has(serverItem.id)) {
      serverOnly.push(serverItem);
    }
  });

  return { localOnly, serverOnly, synced, conflicted };
};

/**
 * Create or Update single report strictly online (Server Buffer + Firebase Firestore)
 */
export const saveReportToServer = async (item: LaporanHarianItem): Promise<boolean> => {
  if (!item || !item.id) return false;
  if (sessionDeletedIds.has(item.id)) {
    console.warn(`Laporan ${item.id} telah dihapus dan tidak dapat disimpan.`);
    return false;
  }

  // Concurrently save to Firebase Firestore and Server API buffer
  const firestorePromise = saveReportToFirestore(item).catch(() => {
    return false;
  });

  const serverPromise = (async () => {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  })();

  const [firestoreRes, serverRes] = await Promise.all([firestorePromise, serverPromise]);
  return Boolean(firestoreRes || serverRes);
};

/**
 * Delete single report strictly online from Server Buffer and Firebase Firestore
 */
export const deleteReportFromServer = async (id: string): Promise<boolean> => {
  if (!id) return false;
  sessionDeletedIds.add(id);

  // 1. Delete from Firebase Firestore
  try {
    await deleteReportFromFirestore(id);
  } catch (err) {
    // Already handled
  }

  // 2. Delete from Server Buffer & add server tombstone
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return true;
  }
};

/**
 * Reset all reports strictly online across Server Buffer and Firebase Firestore
 */
export const resetAllReportsOnServer = async (): Promise<boolean> => {
  sessionDeletedIds.clear();
  await purgeAllClientCache();

  // Reset in Firebase Firestore
  try {
    await resetAllReportsInFirestore();
  } catch (err) {
    // Already handled
  }

  // Reset in server
  try {
    const res = await fetch('/api/reports/reset', { method: 'POST' });
    return res.ok;
  } catch (err) {
    return true;
  }
};

export { subscribeReportsFromFirestore };
