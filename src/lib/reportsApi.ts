import { LaporanHarianItem } from '../types';
import {
  fetchReportsFromFirestore,
  saveReportToFirestore,
  deleteReportFromFirestore,
  batchSyncReportsToFirestore,
  resetAllReportsInFirestore,
  subscribeReportsFromFirestore,
} from './firestoreService';

const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history';

export const isReportBeforeSept7 = (_r: LaporanHarianItem): boolean => {
  return false;
};

// Fetch all reports from Firebase Firestore (with server & localStorage fallback)
export const fetchAllReports = async (): Promise<LaporanHarianItem[]> => {
  // 1. First priority: Firebase Firestore
  try {
    const firestoreReports = await fetchReportsFromFirestore();
    if (firestoreReports && firestoreReports.length > 0) {
      const cleaned = firestoreReports.filter((r) => !isReportBeforeSept7(r));
      localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(cleaned));
      return cleaned;
    }
  } catch (err) {
    console.warn('Notice reading from Firebase Firestore, checking server buffer:', err);
  }

  // 2. Second priority: Central server buffer
  try {
    const res = await fetch('/api/reports');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const cleaned = json.data.filter((r: LaporanHarianItem) => !isReportBeforeSept7(r));
        localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(cleaned));
        // Also sync server reports to Firestore in background
        batchSyncReportsToFirestore(cleaned).catch((e) => console.warn('Background sync to Firestore:', e));
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Network error fetching from /api/reports, reading from localStorage:', err);
  }

  // 3. Third priority: Local storage fallback
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (stored) {
      const parsed: LaporanHarianItem[] = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((r) => !isReportBeforeSept7(r));
        localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(cleaned));
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('Could not read local reports:', e);
  }

  return [];
};

// Save single report to Firebase Firestore, server, and local storage (Full Create/Update)
export const saveReportToServer = async (item: LaporanHarianItem): Promise<boolean> => {
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
    localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }

  // 2. Save directly to Firebase Firestore
  let firestoreSuccess = false;
  try {
    firestoreSuccess = await saveReportToFirestore(item);
  } catch (err) {
    console.warn('Notice saving report to Firebase Firestore:', err);
  }

  // 3. Also sync to server buffer
  try {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch (err) {
    console.warn('Error syncing to server /api/reports:', err);
  }

  return firestoreSuccess || true;
};

// Delete single report from Firebase Firestore, server, and local storage (Full Delete)
export const deleteReportFromServer = async (id: string): Promise<boolean> => {
  // 1. Remove from local storage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (stored) {
      const reports: LaporanHarianItem[] = JSON.parse(stored);
      const filtered = reports.filter((r) => r.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn(e);
  }

  // 2. Delete from Firebase Firestore
  try {
    await deleteReportFromFirestore(id);
  } catch (err) {
    console.warn('Notice deleting from Firebase Firestore:', err);
  }

  // 3. Delete from server buffer
  try {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting report on server:', err);
    return true;
  }
};

// Batch sync reports to Firebase Firestore and server
export const syncLocalReportsToServer = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
    if (!stored) return;
    const reports: LaporanHarianItem[] = JSON.parse(stored);
    if (!Array.isArray(reports) || reports.length === 0) return;

    // Sync to Firestore
    await batchSyncReportsToFirestore(reports);

    // Sync to server
    await fetch('/api/reports/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports }),
    });
  } catch (err) {
    console.warn('Error syncing local reports to Firebase and server:', err);
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
