import { LaporanHarianItem, DataKeluarga } from '../types';
import { SpptPbbItem } from '../data/pbbSampleData';

const DB_NAME = 'sikepling_offline_db';
const DB_VERSION = 3; // Incremented version to add PBB store
const STORE_REPORTS = 'reports_store';
const STORE_KELUARGA = 'family_store';
const STORE_PBB = 'pbb_store';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KELUARGA)) {
        db.createObjectStore(STORE_KELUARGA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PBB)) {
        db.createObjectStore(STORE_PBB, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save all family data to IndexedDB
 */
export async function saveKeluargaToIndexedDB(data: DataKeluarga[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KELUARGA, 'readwrite');
      const store = tx.objectStore(STORE_KELUARGA);

      store.clear();
      if (data.length > 0) {
        data.forEach((item) => {
          if (item && item.id) {
            store.put(item);
          }
        });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving keluarga data:', err);
    return false;
  }
}

/**
 * Read all family data from IndexedDB
 */
export async function getKeluargaFromIndexedDB(): Promise<DataKeluarga[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KELUARGA, 'readonly');
      const store = tx.objectStore(STORE_KELUARGA);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as DataKeluarga[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting keluarga data:', err);
    return null;
  }
}

/**
 * Save all PBB data to IndexedDB
 */
export async function savePbbToIndexedDB(data: SpptPbbItem[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PBB, 'readwrite');
      const store = tx.objectStore(STORE_PBB);

      store.clear();
      if (data.length > 0) {
        data.forEach((item) => {
          if (item && item.id) {
            store.put(item);
          }
        });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving PBB data:', err);
    return false;
  }
}

/**
 * Read all PBB data from IndexedDB
 */
export async function getPbbFromIndexedDB(): Promise<SpptPbbItem[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PBB, 'readonly');
      const store = tx.objectStore(STORE_PBB);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as SpptPbbItem[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting PBB data:', err);
    return null;
  }
}

/**
 * Save all reports to IndexedDB (No 5MB quota limitation)
 */
export async function saveReportsToIndexedDB(reports: LaporanHarianItem[]): Promise<boolean> {
  if (!Array.isArray(reports)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);

      // Clear old and put all new items
      store.clear();
      if (reports.length > 0) {
        reports.forEach((item) => {
          if (item && item.id) {
            store.put(item);
          }
        });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving reports:', err);
    return false;
  }
}

/**
 * Clear all reports in IndexedDB
 */
export async function clearIndexedDBReports(): Promise<boolean> {
  return saveReportsToIndexedDB([]);
}

/**
 * Read all reports from IndexedDB
 */
export async function getReportsFromIndexedDB(): Promise<LaporanHarianItem[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readonly');
      const store = tx.objectStore(STORE_REPORTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as LaporanHarianItem[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting reports:', err);
    return null;
  }
}

/**
 * Save single report to IndexedDB
 */
export async function saveSingleReportToIndexedDB(report: LaporanHarianItem): Promise<boolean> {
  if (!report || !report.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);
      store.put(report);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving single report:', err);
    return false;
  }
}

/**
 * Delete single report from IndexedDB
 */
export async function deleteReportFromIndexedDB(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);
      store.delete(id);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error deleting report:', err);
    return false;
  }
}
