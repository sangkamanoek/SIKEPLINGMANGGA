import { LaporanHarianItem } from '../types';
import { safeSetLocalStorage } from './safeStorage';
import {
  saveReportsToIndexedDB,
  getReportsFromIndexedDB,
  saveSingleReportToIndexedDB,
  deleteReportFromIndexedDB,
} from './indexedDbStorage';
import {
  fetchReportsFromFirestore,
  saveReportToFirestore,
  deleteReportFromFirestore,
  resetAllReportsInFirestore,
  subscribeReportsFromFirestore,
  batchSyncReportsToFirestore,
  shouldFilterReport,
} from './firestoreService';
import { readLaporanFromSheet } from './sheetsService';
import { generateInitialReports24Kepling } from '../data/initialReportsData';

export const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history_v2';
export const LOCAL_STORAGE_KEY_DELETED = 'kepling_deleted_reports_v1';

// Known storage keys from prior versions to ensure zero data loss during upgrades
export const KNOWN_STORAGE_KEYS = [
  'kepling_local_laporan_history_v2',
  'kepling_local_laporan_history',
  'laporan_kepling_local',
  'kepling_reports',
  'sikepling_reports',
];

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

export const isReportDeleted = (r: LaporanHarianItem): boolean => {
  return shouldFilterReport(r);
};

// Fetch all reports with resilient multi-tier merge (IndexedDB + LocalStorage + Google Sheets + Firestore + Server Buffer)
export const fetchAllReports = async (): Promise<LaporanHarianItem[]> => {
  const deletedIds = getLocalDeletedReportIds();
  const map = new Map<string, LaporanHarianItem>();

  // 0. High-capacity IndexedDB recovery (Full offline store with photos)
  try {
    const idbReports = await getReportsFromIndexedDB();
    if (Array.isArray(idbReports) && idbReports.length > 0) {
      idbReports.forEach((r) => {
        if (r && r.id && !deletedIds.has(r.id) && !shouldFilterReport(r)) {
          map.set(r.id, r);
        }
      });
    }
  } catch (idbErr) {
    console.warn('IndexedDB initial read note:', idbErr);
  }

  // 1. Comprehensive Local Storage multi-key recovery
  KNOWN_STORAGE_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((r) => {
            if (r && r.id && !deletedIds.has(r.id) && !shouldFilterReport(r)) {
              if (!map.has(r.id)) {
                map.set(r.id, r);
              }
            }
          });
        }
      }
    } catch {}
  });

  // 2. Read from connected Google Sheets if metadata & token exist
  try {
    const sheetMetaRaw = localStorage.getItem('google_sheet_metadata');
    const tokenRaw = localStorage.getItem('google_cached_access_token') || sessionStorage.getItem('google_cached_access_token');
    if (sheetMetaRaw && tokenRaw) {
      const sheetMeta = JSON.parse(sheetMetaRaw);
      if (sheetMeta?.spreadsheetId) {
        const sheetReports = await readLaporanFromSheet(tokenRaw, sheetMeta.spreadsheetId);
        if (Array.isArray(sheetReports) && sheetReports.length > 0) {
          sheetReports.forEach((r) => {
            if (r && r.id && !deletedIds.has(r.id) && !isReportBeforeSept7(r)) {
              // Only add if not already present or if sheet has newer row
              if (!map.has(r.id)) {
                map.set(r.id, r);
              }
            }
          });
        }
      }
    }
  } catch (sheetErr) {
    console.warn('Google Sheet background read notice:', sheetErr);
  }

  // 3. Fetch from Firebase Firestore
  let firestoreCount = 0;
  try {
    const firestoreReports = await fetchReportsFromFirestore();
    if (Array.isArray(firestoreReports) && firestoreReports.length > 0) {
      firestoreCount = firestoreReports.length;
      firestoreReports.forEach((r) => {
        if (r && r.id && !deletedIds.has(r.id) && !isReportBeforeSept7(r)) {
          map.set(r.id, r);
        }
      });
    }
  } catch (err) {
    console.warn('Notice reading from Firebase Firestore:', err);
  }

  // 4. Merge with Server Buffer
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

  // 5. Fallback: If no reports exist at all, initialize the official 24 Kepling historical reports
  if (map.size === 0) {
    try {
      const initial = generateInitialReports24Kepling();
      initial.forEach((r) => {
        if (!deletedIds.has(r.id)) {
          map.set(r.id, r);
        }
      });
    } catch (e) {
      console.warn('Fallback initial reports generation notice:', e);
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  if (merged.length > 0) {
    // Save to IndexedDB (Full data with photos) and LocalStorage (lightweight)
    saveReportsToIndexedDB(merged).catch(() => {});
    safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(merged));
  }

  // 6. Two-Way Sync: If we have reports locally that the server doesn't have yet, push them via batch sync!
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

  // 7. Background Firestore sync if Firestore is behind
  if (firestoreCount < merged.length) {
    batchSyncReportsToFirestore(merged).catch(() => {});
  }

  return merged;
};

// Explicitly seed/restore the official initial reports for all 24 Kepling
export const seedInitialReports = async (): Promise<LaporanHarianItem[]> => {
  try {
    const res = await fetch('/api/reports/seed-initial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      const serverReports = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      if (serverReports.length > 0) {
        saveReportsToIndexedDB(serverReports).catch(() => {});
        safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(serverReports));
        batchSyncReportsToFirestore(serverReports).catch(() => {});
        return serverReports;
      }
    }
  } catch (err) {
    console.warn('Error in seedInitialReports:', err);
  }

  // Fallback to client generator if server endpoint unavailable
  const clientGenerated = generateInitialReports24Kepling();
  saveReportsToIndexedDB(clientGenerated).catch(() => {});
  safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(clientGenerated));
  try {
    await fetch('/api/reports/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: clientGenerated }),
    });
  } catch {}
  return clientGenerated;
};

// Sync all local reports to server buffer explicitly
export const syncLocalReportsToServer = async (): Promise<void> => {
  try {
    let items: LaporanHarianItem[] | null = await getReportsFromIndexedDB();
    if (!items || items.length === 0) {
      const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
      if (localRaw) {
        items = JSON.parse(localRaw);
      }
    }
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

  // 1. Update IndexedDB & local storage immediately
  try {
    saveSingleReportToIndexedDB(item).catch(() => {});
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

  // 2. Remove immediately from IndexedDB & local storage
  try {
    deleteReportFromIndexedDB(id).catch(() => {});
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
