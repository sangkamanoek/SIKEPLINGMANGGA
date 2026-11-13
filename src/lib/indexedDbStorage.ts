import { LaporanHarianItem, SuratKedinasanItem, PosyanduReport, LaporanKegiatanPkk, FotoDokumentasi } from '../types';
import { SpptPbbItem } from '../data/pbbSampleData';

const DB_NAME = 'sikepling_offline_db';
const DB_VERSION = 8;
const STORE_REPORTS = 'reports_store';
const STORE_PBB = 'pbb_store';
const STORE_VISITS = 'visits_store';
const STORE_HISTORY = 'history_store';
const STORE_SURAT = 'surat_store';
const STORE_POSYANDU = 'posyandu_store';
const STORE_PKK_DASA_WISMA = 'pkk_dasa_wisma_store';
const STORE_PKK_KEUANGAN = 'pkk_keuangan_store';
const STORE_PKK_KEGIATAN = 'pkk_kegiatan_store';
const STORE_WRITE_QUEUE = 'write_queue_store';

export interface QueuedWriteRecord {
  key: string;
  op: 'set' | 'delete';
  colName: string;
  docId: string;
  payload?: Record<string, any>;
  merge?: boolean;
  enqueuedAt: number;
  attempts?: number;
  lastError?: string;
  storedInIdbOnly?: boolean;
}

// Singleton connection cache to avoid leaking IDB handles across rapid calls on iOS/Safari/WebViews
let dbPromise: Promise<IDBDatabase> | null = null;
let lastSavedPbbRef: SpptPbbItem[] | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_REPORTS)) {
          db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PBB)) {
          db.createObjectStore(STORE_PBB, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_VISITS)) {
          db.createObjectStore(STORE_VISITS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SURAT)) {
          db.createObjectStore(STORE_SURAT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_POSYANDU)) {
          db.createObjectStore(STORE_POSYANDU, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PKK_DASA_WISMA)) {
          db.createObjectStore(STORE_PKK_DASA_WISMA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PKK_KEUANGAN)) {
          db.createObjectStore(STORE_PKK_KEUANGAN, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PKK_KEGIATAN)) {
          db.createObjectStore(STORE_PKK_KEGIATAN, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_WRITE_QUEUE)) {
          db.createObjectStore(STORE_WRITE_QUEUE, { keyPath: 'key' });
        }
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database upgrade blocked by another tab');
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export async function putWriteQueueItemIDB(record: QueuedWriteRecord): Promise<boolean> {
  if (!record || !record.key) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WRITE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_WRITE_QUEUE);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error putting write queue item:', err);
    return false;
  }
}

export async function getAllWriteQueueItemsIDB(): Promise<QueuedWriteRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WRITE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_WRITE_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? (req.result as QueuedWriteRecord[]) : []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteWriteQueueItemIDB(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WRITE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_WRITE_QUEUE);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

export async function saveKeluargaToIndexedDB(_data: any[]): Promise<boolean> {
  return true;
}

export async function getKeluargaFromIndexedDB(): Promise<any[] | null> {
  return null;
}

/**
 * Save single SPPT item to IndexedDB cleanly without rewriting all 22k records
 */
export async function saveSinglePbbToIndexedDB(item: SpptPbbItem): Promise<boolean> {
  if (!item || !item.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PBB, 'readwrite');
      tx.objectStore(STORE_PBB).put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving single PBB item:', err);
    return false;
  }
}

/**
 * Delete single SPPT item from IndexedDB
 */
export async function deleteSinglePbbFromIndexedDB(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PBB, 'readwrite');
      tx.objectStore(STORE_PBB).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error deleting single PBB item:', err);
    return false;
  }
}

/**
 * Save all PBB data to IndexedDB in chunked transactions to prevent main-thread UI freeze & OOM spikes
 */
export async function savePbbToIndexedDB(data: SpptPbbItem[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  if (lastSavedPbbRef === data) return true;

  try {
    const db = await openDatabase();
    lastSavedPbbRef = data;

    // 1. Clear store first cleanly
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PBB, 'readwrite');
      tx.objectStore(STORE_PBB).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    if (data.length === 0) return true;

    // 2. Write in batches of 1500 items with micro-yields to avoid memory spikes / browser hangs
    const CHUNK_SIZE = 1500;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PBB, 'readwrite');
        const store = tx.objectStore(STORE_PBB);
        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          if (item && item.id) {
            store.put(item);
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      if (i + CHUNK_SIZE < data.length) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return true;
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
 * Save all visits to IndexedDB
 */
export async function saveVisitsToIndexedDB(data: any[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VISITS, 'readwrite');
      const store = tx.objectStore(STORE_VISITS);

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
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving visits:', err);
    return false;
  }
}

/**
 * Read all visits from IndexedDB
 */
export async function getVisitsFromIndexedDB(): Promise<any[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VISITS, 'readonly');
      const store = tx.objectStore(STORE_VISITS);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) && result.length > 0 ? result : null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting visits:', err);
    return null;
  }
}

/**
 * Save all history reports to IndexedDB
 */
export async function saveHistoryToIndexedDB(data: LaporanHarianItem[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);

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
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving history:', err);
    return false;
  }
}

/**
 * Read all history reports from IndexedDB
 */
export async function getHistoryFromIndexedDB(): Promise<LaporanHarianItem[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_HISTORY);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) && result.length > 0 ? result : null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting history:', err);
    return null;
  }
}

/**
 * Read single report from IndexedDB by ID
 */
export async function getSingleReportFromIndexedDB(id: string): Promise<LaporanHarianItem | null> {
  if (!id) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readonly');
      const store = tx.objectStore(STORE_REPORTS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as LaporanHarianItem) || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting single report:', err);
    return null;
  }
}

/**
 * Save all reports to IndexedDB (No 5MB quota limitation) while preserving valid photo URLs
 * so lightweight/stripped payloads never erase existing offline images.
 */
export async function saveReportsToIndexedDB(reports: LaporanHarianItem[]): Promise<boolean> {
  if (!Array.isArray(reports)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);

      const incomingIds = new Set(reports.filter((x) => x && x.id).map((x) => x.id));
      const keysReq = store.getAllKeys();

      keysReq.onsuccess = () => {
        const existingKeys = Array.isArray(keysReq.result) ? keysReq.result : [];
        existingKeys.forEach((k) => {
          if (!incomingIds.has(String(k))) {
            store.delete(k);
          }
        });

        reports.forEach((item) => {
          if (!item || !item.id) return;
          const missingPhotoSlots =
            hasAnyEmptyPhotoUrl(item.dokumentasiFoto) ||
            ((!Array.isArray(item.dokumentasiFoto) || item.dokumentasiFoto.length === 0) &&
              Number(item.jumlahDokumentasi || 0) > 0);

          if (missingPhotoSlots) {
            const getReq = store.get(item.id);
            getReq.onsuccess = () => {
              const prev = getReq.result as LaporanHarianItem | undefined;
              let mergedFotos = mergeMediaArrayPreservingUrls(item.dokumentasiFoto, prev?.dokumentasiFoto);
              if (
                (!Array.isArray(mergedFotos) || mergedFotos.length === 0) &&
                Array.isArray(prev?.dokumentasiFoto) &&
                prev.dokumentasiFoto.some((f) => f && typeof f.url === 'string' && f.url.length > 20)
              ) {
                mergedFotos = prev.dokumentasiFoto;
              }
              store.put(
                mergedFotos !== undefined
                  ? {
                      ...item,
                      dokumentasiFoto: mergedFotos,
                      jumlahDokumentasi: Math.max(mergedFotos.length, Number(item.jumlahDokumentasi || 0)),
                    }
                  : item
              );
            };
          } else {
            store.put(item);
          }
        });
      };

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
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      tx.objectStore(STORE_REPORTS).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error clearing reports:', err);
    return false;
  }
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
 * Save single report to IndexedDB while preserving existing valid photo URLs if incoming has empty URLs
 */
export async function saveSingleReportToIndexedDB(report: LaporanHarianItem): Promise<boolean> {
  if (!report || !report.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_REPORTS);

      const missingPhotoSlots =
        hasAnyEmptyPhotoUrl(report.dokumentasiFoto) ||
        ((!Array.isArray(report.dokumentasiFoto) || report.dokumentasiFoto.length === 0) &&
          Number(report.jumlahDokumentasi || 0) > 0);

      if (missingPhotoSlots) {
        const getReq = store.get(report.id);
        getReq.onsuccess = () => {
          const prev = getReq.result as LaporanHarianItem | undefined;
          let mergedFotos = mergeMediaArrayPreservingUrls(report.dokumentasiFoto, prev?.dokumentasiFoto);
          if (
            (!Array.isArray(mergedFotos) || mergedFotos.length === 0) &&
            Array.isArray(prev?.dokumentasiFoto) &&
            prev.dokumentasiFoto.some((f) => f && typeof f.url === 'string' && f.url.length > 20)
          ) {
            mergedFotos = prev.dokumentasiFoto;
          }
          store.put(
            mergedFotos !== undefined
              ? {
                  ...report,
                  dokumentasiFoto: mergedFotos,
                  jumlahDokumentasi: Math.max(mergedFotos.length, Number(report.jumlahDokumentasi || 0)),
                }
              : report
          );
        };
      } else {
        store.put(report);
      }

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

/**
 * Save all surat kedinasan items to IndexedDB (supports large PDF attachments without quota limit)
 */
export async function saveSuratToIndexedDB(data: SuratKedinasanItem[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURAT, 'readwrite');
      const store = tx.objectStore(STORE_SURAT);

      // Preserve existing PDF attachments if incoming list has stripped fileUrl
      const incomingIds = new Set(data.filter((x) => x && x.id).map((x) => x.id));
      const keysReq = store.getAllKeys();
      keysReq.onsuccess = () => {
        const existingKeys = Array.isArray(keysReq.result) ? keysReq.result : [];
        existingKeys.forEach((k) => {
          if (!incomingIds.has(String(k))) {
            store.delete(k);
          }
        });

        data.forEach((item) => {
          if (!item || !item.id) return;
          if (!item.fileUrl && item.fileName) {
            const getReq = store.get(item.id);
            getReq.onsuccess = () => {
              const prev = getReq.result as SuratKedinasanItem | undefined;
              store.put(
                prev && prev.fileUrl
                  ? { ...item, fileUrl: prev.fileUrl, fileSize: item.fileSize || prev.fileSize, fileType: item.fileType || prev.fileType }
                  : item
              );
            };
          } else {
            store.put(item);
          }
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving surat data:', err);
    return false;
  }
}

/**
 * Read all surat kedinasan items from IndexedDB
 */
export async function getSuratFromIndexedDB(): Promise<SuratKedinasanItem[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURAT, 'readonly');
      const store = tx.objectStore(STORE_SURAT);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as SuratKedinasanItem[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting surat data:', err);
    return null;
  }
}

/**
 * Save single surat item with attached PDF to IndexedDB
 */
export async function saveSingleSuratToIndexedDB(item: SuratKedinasanItem): Promise<boolean> {
  if (!item || !item.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURAT, 'readwrite');
      const store = tx.objectStore(STORE_SURAT);
      store.put(item);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving single surat item:', err);
    return false;
  }
}

/**
 * Delete single surat from IndexedDB
 */
export async function deleteSuratFromIndexedDB(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURAT, 'readwrite');
      const store = tx.objectStore(STORE_SURAT);
      store.delete(id);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error deleting surat item from IndexedDB:', err);
    return false;
  }
}

export function mergeMediaArrayPreservingUrls(
  incomingList: FotoDokumentasi[] | undefined,
  existingList: FotoDokumentasi[] | undefined
): FotoDokumentasi[] | undefined {
  if (!Array.isArray(incomingList)) return existingList;
  if (!Array.isArray(existingList) || existingList.length === 0) return incomingList;

  return incomingList.map((inc, idx) => {
    if (inc && typeof inc.url === 'string' && inc.url.trim().length > 20) {
      return inc;
    }
    const match =
      (inc?.id ? existingList.find((ex) => ex && ex.id === inc.id && ex.url && ex.url.trim().length > 20) : undefined) ||
      (inc?.name
        ? existingList.find((ex, exIdx) => ex && ex.name === inc.name && (exIdx === idx || existingList.length === incomingList.length) && ex.url && ex.url.trim().length > 20)
        : undefined) ||
      (existingList[idx] && existingList[idx].url && existingList[idx].url.trim().length > 20 ? existingList[idx] : undefined);

    if (match && match.url) {
      return { ...inc, url: match.url };
    }
    return inc;
  });
}

export function hasAnyEmptyPhotoUrl(list: FotoDokumentasi[] | undefined): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((f) => !f || typeof f.url !== 'string' || f.url.trim().length <= 20);
}

/**
 * Save all Posyandu reports to IndexedDB without loading all existing base64 photos into RAM via getAll().
 */
export async function savePosyanduToIndexedDB(data: PosyanduReport[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSYANDU, 'readwrite');
      const store = tx.objectStore(STORE_POSYANDU);

      const incomingIds = new Set(data.filter((x) => x && x.id).map((x) => x.id));
      const keysReq = store.getAllKeys();

      keysReq.onsuccess = () => {
        const existingKeys = Array.isArray(keysReq.result) ? keysReq.result : [];
        existingKeys.forEach((k) => {
          if (!incomingIds.has(String(k))) {
            store.delete(k);
          }
        });

        data.forEach((item) => {
          if (!item || !item.id) return;
          if (hasAnyEmptyPhotoUrl(item.dokumentasiFoto)) {
            const getReq = store.get(item.id);
            getReq.onsuccess = () => {
              const prev = getReq.result as PosyanduReport | undefined;
              const mergedFotos = mergeMediaArrayPreservingUrls(item.dokumentasiFoto, prev?.dokumentasiFoto);
              store.put(
                mergedFotos !== undefined
                  ? { ...item, dokumentasiFoto: mergedFotos }
                  : item
              );
            };
          } else {
            store.put(item);
          }
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving posyandu data:', err);
    return false;
  }
}

/**
 * Read all Posyandu reports from IndexedDB
 */
export async function getPosyanduFromIndexedDB(): Promise<PosyanduReport[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSYANDU, 'readonly');
      const store = tx.objectStore(STORE_POSYANDU);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as PosyanduReport[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting posyandu data:', err);
    return null;
  }
}

/**
 * Save single Posyandu report to IndexedDB
 */
export async function saveSinglePosyanduToIndexedDB(item: PosyanduReport): Promise<boolean> {
  if (!item || !item.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSYANDU, 'readwrite');
      const store = tx.objectStore(STORE_POSYANDU);
      store.put(item);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving single posyandu item:', err);
    return false;
  }
}

/**
 * Delete single Posyandu report from IndexedDB
 */
export async function deletePosyanduFromIndexedDB(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POSYANDU, 'readwrite');
      const store = tx.objectStore(STORE_POSYANDU);
      store.delete(id);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error deleting posyandu item from IndexedDB:', err);
    return false;
  }
}

/**
 * Save all PKK Kegiatan reports to IndexedDB without loading all existing base64 photos into RAM via getAll().
 */
export async function savePkkKegiatanToIndexedDB(data: LaporanKegiatanPkk[]): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PKK_KEGIATAN, 'readwrite');
      const store = tx.objectStore(STORE_PKK_KEGIATAN);

      const incomingIds = new Set(data.filter((x) => x && x.id).map((x) => x.id));
      const keysReq = store.getAllKeys();

      keysReq.onsuccess = () => {
        const existingKeys = Array.isArray(keysReq.result) ? keysReq.result : [];
        existingKeys.forEach((k) => {
          if (!incomingIds.has(String(k))) {
            store.delete(k);
          }
        });

        data.forEach((item) => {
          if (!item || !item.id) return;
          if (hasAnyEmptyPhotoUrl(item.fotoDokumentasi)) {
            const getReq = store.get(item.id);
            getReq.onsuccess = () => {
              const prev = getReq.result as LaporanKegiatanPkk | undefined;
              const mergedFotos = mergeMediaArrayPreservingUrls(item.fotoDokumentasi, prev?.fotoDokumentasi);
              store.put(
                mergedFotos !== undefined
                  ? { ...item, fotoDokumentasi: mergedFotos }
                  : item
              );
            };
          } else {
            store.put(item);
          }
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving pkk kegiatan data:', err);
    return false;
  }
}

export async function getPkkKegiatanFromIndexedDB(): Promise<LaporanKegiatanPkk[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PKK_KEGIATAN, 'readonly');
      const store = tx.objectStore(STORE_PKK_KEGIATAN);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as LaporanKegiatanPkk[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error getting pkk kegiatan data:', err);
    return null;
  }
}

export async function saveSinglePkkKegiatanToIndexedDB(item: LaporanKegiatanPkk): Promise<boolean> {
  if (!item || !item.id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PKK_KEGIATAN, 'readwrite');
      const store = tx.objectStore(STORE_PKK_KEGIATAN);
      store.put(item);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error saving single pkk kegiatan item:', err);
    return false;
  }
}

export async function deletePkkKegiatanFromIndexedDB(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PKK_KEGIATAN, 'readwrite');
      const store = tx.objectStore(STORE_PKK_KEGIATAN);
      store.delete(id);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error deleting pkk kegiatan item from IndexedDB:', err);
    return false;
  }
}
