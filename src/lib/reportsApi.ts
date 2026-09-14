import { LaporanHarianItem } from '../types';
import { safeSetLocalStorage } from './safeStorage';
import {
  fetchReportsFromFirestore,
  saveReportToFirestore,
  deleteReportFromFirestore,
  resetAllReportsInFirestore,
  subscribeReportsFromFirestore,
  isBeforeSept7,
} from './firestoreService';

const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history_v2';
const LOCAL_STORAGE_KEY_DELETED = 'kepling_deleted_reports_v1';

// Clear obsolete previous caches to free browser memory
try {
  localStorage.removeItem('kepling_local_laporan_history');
  localStorage.removeItem('cleaned_reports_v2_kepling21');
} catch {}

/**
 * Get locally known deleted report IDs
 */
export const getLocalDeletedReportIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DELETED);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
};

/**
 * Register deleted report ID to local blacklist
 */
export const addLocalDeletedReportId = (id: string) => {
  try {
    const set = getLocalDeletedReportIds();
    set.add(id);
    safeSetLocalStorage(LOCAL_STORAGE_KEY_DELETED, JSON.stringify(Array.from(set)));
  } catch {}
};

export const isReportBeforeSept7 = (r: LaporanHarianItem): boolean => {
  return isBeforeSept7(r);
};

// Fetch all reports with resilient multi-tier merge (LocalStorage + Firestore + Server Buffer)
export const fetchAllReports = async (): Promise<LaporanHarianItem[]> => {
  const deletedIds = getLocalDeletedReportIds();
  const map = new Map<string, LaporanHarianItem>();

  // 1. Include locally cached items first so freshly inputted reports are never lost
  try {
    const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((r) => {
          if (r && r.id && !deletedIds.has(r.id) && !isReportBeforeSept7(r)) {
            map.set(r.id, r);
          }
        });
      }
    }
  } catch {}

  // 2. Fetch from Firebase Firestore
  try {
    const firestoreReports = await fetchReportsFromFirestore();
    if (Array.isArray(firestoreReports) && firestoreReports.length > 0) {
      firestoreReports.forEach((r) => {
        if (r && r.id && !deletedIds.has(r.id) && !isReportBeforeSept7(r)) {
          map.set(r.id, r);
        }
      });
    }
  } catch (err) {
    console.warn('Notice reading from Firebase Firestore:', err);
  }

  // 3. Merge with Server Buffer
  let serverReportIds = new Set<string>();
  try {
    const res = await fetch('/api/reports');
    if (res.ok) {
      const json = await res.json();
      const serverReports = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (Array.isArray(serverReports) && serverReports.length > 0) {
        serverReports.forEach((r: LaporanHarianItem) => {
          if (r && r.id && !deletedIds.has(r.id) && !isReportBeforeSept7(r)) {
            map.set(r.id, r);
            serverReportIds.add(r.id);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Notice reading server buffer /api/reports:', e);
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  if (merged.length > 0) {
    safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(merged));
  }

  // 4. Two-Way Sync: If we have reports locally that the server doesn't have yet, push them via batch sync!
  const unsyncedReports = merged.filter((r) => r && r.id && !serverReportIds.has(r.id));
  if (unsyncedReports.length > 0) {
    fetch('/api/reports/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: unsyncedReports }),
    }).catch((err) => {
      console.warn('Notice pushing unsynced reports to server batch:', err);
    });
  }

  return merged;
};

// Sync all local reports to server buffer explicitly
export const syncLocalReportsToServer = async (): Promise<void> => {
  try {
    const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (!localRaw) return;
    const items = JSON.parse(localRaw);
    if (!Array.isArray(items) || items.length === 0) return;
    const deletedIds = getLocalDeletedReportIds();
    const validItems = items.filter((r: LaporanHarianItem) => r && r.id && !deletedIds.has(r.id));
    if (validItems.length > 0) {
      await fetch('/api/reports/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: validItems }),
      });
    }
  } catch (err) {
    console.warn('Error during syncLocalReportsToServer:', err);
  }
};

// Save single report to Firebase Firestore, server, and local storage (Full Create/Update)
export const saveReportToServer = async (item: LaporanHarianItem): Promise<boolean> => {
  const deletedIds = getLocalDeletedReportIds();
  if (item.id && deletedIds.has(item.id)) {
    console.warn(`Laporan ${item.id} telah dihapus oleh Admin dan tidak dapat disimpan.`);
    return false;
  }

  // 1. Update local storage immediately
  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    const existing: LaporanHarianItem[] = existingRaw ? JSON.parse(existingRaw) : [];
    const index = existing.findIndex((r) => r.id === item.id);
    let updated: LaporanHarianItem[];
    if (index >= 0) {
      existing[index] = item;
      updated = [...existing];
    } else {
      updated = [item, ...existing];
    }
    // Filter out any deleted items before saving
    const sanitized = updated.filter((r) => !deletedIds.has(r.id));
    safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }

  // 2. Concurrently save to Firebase Firestore and Server Buffer in parallel
  const firestorePromise = saveReportToFirestore(item).catch((err) => {
    console.warn('Notice saving report to Firebase Firestore:', err);
    return false;
  });

  // Helper function to send to server with automatic retry
  const sendToServerWithRetry = async (payload: LaporanHarianItem, retries = 2): Promise<Response | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return res;
      } catch (err) {
        if (attempt === retries) {
          console.warn('Final retry failed syncing to server /api/reports:', err);
          return null;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    return null;
  };

  const serverPromise = sendToServerWithRetry(item);

  const [firestoreRes, serverRes] = await Promise.all([firestorePromise, serverPromise]);
  return Boolean(firestoreRes || (serverRes && serverRes.ok));
};

// Delete single report from Firebase Firestore, server, and local storage (Full Delete)
export const deleteReportFromServer = async (id: string): Promise<boolean> => {
  if (!id) return false;

  // 1. Register to local deleted blacklist tombstone
  addLocalDeletedReportId(id);

  // 2. Remove immediately from local storage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (stored) {
      const reports: LaporanHarianItem[] = JSON.parse(stored);
      const filtered = reports.filter((r) => r.id !== id);
      safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn(e);
  }

  // 3. Delete from Firebase Firestore with permanent tombstone
  try {
    await deleteReportFromFirestore(id);
  } catch (err) {
    console.warn('Notice deleting from Firebase Firestore:', err);
  }

  // 4. Delete from server buffer & add server tombstone
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting report on server:', err);
    return true;
  }
};

// Reset all reports in Firebase Firestore, server, and local storage
export const resetAllReportsOnServer = async (): Promise<boolean> => {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_LAPORAN);
  } catch (e) {
    console.warn(e);
  }

  // Reset in Firebase Firestore
  try {
    await resetAllReportsInFirestore();
  } catch (err) {
    console.warn('Notice resetting Firebase Firestore reports:', err);
  }

  // Reset in server
  try {
    const res = await fetch('/api/reports/reset', { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.error('Error resetting reports on server:', err);
    return false;
  }
};

export { subscribeReportsFromFirestore };
