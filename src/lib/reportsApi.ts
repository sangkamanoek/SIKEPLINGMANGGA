import { LaporanHarianItem } from '../types';
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
    localStorage.setItem(LOCAL_STORAGE_KEY_DELETED, JSON.stringify(Array.from(set)));
  } catch {}
};

export const isReportBeforeSept7 = (r: LaporanHarianItem): boolean => {
  return isBeforeSept7(r);
};

// Fetch all reports from Firebase Firestore (filtered against deleted IDs)
export const fetchAllReports = async (): Promise<LaporanHarianItem[]> => {
  try {
    const deletedIds = getLocalDeletedReportIds();
    const firestoreReports = await fetchReportsFromFirestore();
    const cleaned = firestoreReports.filter((r) => !isReportBeforeSept7(r) && !deletedIds.has(r.id));
    localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(cleaned));
    return cleaned;
  } catch (err) {
    console.warn('Error reading from Firebase Firestore:', err);
    return [];
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
    localStorage.setItem(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(sanitized));
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
  if (!id) return false;

  // 1. Register to local deleted blacklist tombstone
  addLocalDeletedReportId(id);

  // 2. Remove immediately from local storage
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
