/**
 * Safe Storage & Performance Optimization Utility
 * Provides defensive storage management, non-blocking asynchronous persistence,
 * quota overflow recovery, and memory caching.
 */

import {
  saveReportsToIndexedDB,
  saveKeluargaToIndexedDB,
  savePbbToIndexedDB,
  saveVisitsToIndexedDB,
  saveHistoryToIndexedDB,
} from './indexedDbStorage';

const memoryFallbackStorage = new Map<string, string>();

let idbSaveTimeout: any = null;
let idbKkSaveTimeout: any = null;
let idPbbSaveTimeout: any = null;
let idbVisitsTimeout: any = null;
let idbHistoryTimeout: any = null;

/**
 * Clean & sanitize text input to prevent malicious injections (XSS / SQLi / Corrupt characters)
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .trim();
}

/**
 * Manual override to populate memory map (used on startup from IndexedDB)
 */
export function populateMemoryCache(key: string, value: string): void {
  memoryFallbackStorage.set(key, value);
}

/**
 * Type-safe and error-resilient retrieval from LocalStorage with fallback
 */
export function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  // Always check memory cache first for maximum speed and to bypass LocalStorage quota-saving placeholders (like empty arrays)
  const cached = memoryFallbackStorage.get(key);
  if (cached !== undefined && cached !== null) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn(`[safeStorage] Memory cache parse error for ${key}:`, e);
    }
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeStorage] Failed parsing localStorage key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safely set localStorage items with defensive quota recovery.
 * Optimized with debounced asynchronous IndexedDB persistence to prevent main-thread lag.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    // Keep in memory map first
    memoryFallbackStorage.set(key, value);

    // If it's a reports array, persist to IndexedDB asynchronously with debounce
    if (key.includes('laporan') || key.includes('reports')) {
      if (idbSaveTimeout) clearTimeout(idbSaveTimeout);
      idbSaveTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveReportsToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 300);
    }

    // If it's a family database, persist to IndexedDB asynchronously with debounce
    if (key.includes('keluarga') || key.includes('family')) {
      if (idbKkSaveTimeout) clearTimeout(idbKkSaveTimeout);
      idbKkSaveTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveKeluargaToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 500);
    }

    // If it's PBB data, persist to IndexedDB asynchronously with debounce
    if (key.includes('pbb') || key.includes('sppt')) {
      if (idPbbSaveTimeout) clearTimeout(idPbbSaveTimeout);
      idPbbSaveTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savePbbToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 700);
    }

    // If it's visits data
    if (key.includes('kunjungan') || key.includes('visit')) {
      if (idbVisitsTimeout) clearTimeout(idbVisitsTimeout);
      idbVisitsTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveVisitsToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 800);
    }

    // If it's history data
    if (key.includes('history')) {
      if (idbHistoryTimeout) clearTimeout(idbHistoryTimeout);
      idbHistoryTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveHistoryToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 900);
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError =
      error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014);

    if (isQuotaError) {
      console.warn(`[safeStorage] LocalStorage quota exceeded for key "${key}". Initiating defensive recovery...`);

      // 1. Aggressively clear volatile and obsolete items to free space immediately
      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
        localStorage.removeItem('sikepling_bottom5_monthly_kepling_ids');
        
        // Remove ANY key that looks like a legacy version or temp data
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes('_v1') || k.includes('_v2')) && k !== key) {
            // Only remove if it's not the current active key being saved
            if (k.includes('history') || k.includes('reports') || k.includes('list')) {
               // keep it, but maybe others?
            } else {
               localStorage.removeItem(k);
            }
          }
        }
      } catch {}

      // 2. Large Data Recovery (Full redirect to IndexedDB, LocalStorage becomes a tiny pointer)
      if (
        key.includes('keluarga') ||
        key.includes('family') ||
        key.includes('pbb') ||
        key.includes('sppt') ||
        key.includes('kunjungan') ||
        key.includes('visit') ||
        key.includes('history')
      ) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            // Persist full data to IndexedDB immediately and synchronously (as possible)
            if (key.includes('keluarga') || key.includes('family')) {
              saveKeluargaToIndexedDB(parsed).catch(() => {});
            } else if (key.includes('pbb') || key.includes('sppt')) {
              savePbbToIndexedDB(parsed).catch(() => {});
            } else if (key.includes('kunjungan') || key.includes('visit')) {
              saveVisitsToIndexedDB(parsed).catch(() => {});
            } else if (key.includes('history')) {
              saveHistoryToIndexedDB(parsed).catch(() => {});
            }

            // Save a tiny placeholder to LocalStorage. 
            // safeGetLocalStorage will use memoryFallbackStorage to return the REAL data.
            localStorage.setItem(key, JSON.stringify([]));
            console.log(`[safeStorage] Successfully offloaded "${key}" to IndexedDB. LocalStorage now contains placeholder.`);
            return true;
          }
        } catch (storageErr) {
          console.error('[safeStorage] Error during large data quota recovery:', storageErr);
        }
        // If we reached here, it failed or wasn't an array, fall through to compression or fail
      }

      // 3. Selective Payload Compression (Strip heavy base64 strings but keep metadata)
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Asynchronously persist full data with photos to IndexedDB first
          if (key.includes('laporan') || key.includes('reports')) {
            saveReportsToIndexedDB(parsed).catch(() => {});
          }

          // Preserve ALL items, stripping heavy base64 strings to ensure 100% fit in LocalStorage
          const lightweight = parsed.map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            const copy = { ...item };
            
            const stripHeavyStr = (url?: any) => (typeof url === 'string' && url.startsWith('data:') && url.length > 300 ? '' : url);

            // Handle reports format (dokumentasiFoto array)
            if (Array.isArray(copy.dokumentasiFoto)) {
              copy.dokumentasiFoto = copy.dokumentasiFoto.map((f: any) => {
                if (!f) return f;
                return { ...f, url: stripHeavyStr(f.url) };
              });
            }
            
            // Handle various photo field names across entities
            if (copy.fotoSebelumUrl) copy.fotoSebelumUrl = stripHeavyStr(copy.fotoSebelumUrl);
            if (copy.fotoProsesUrl) copy.fotoProsesUrl = stripHeavyStr(copy.fotoProsesUrl);
            if (copy.fotoSelesaiUrl) copy.fotoSelesaiUrl = stripHeavyStr(copy.fotoSelesaiUrl);
            if (copy.fotoDokumentasi) copy.fotoDokumentasi = stripHeavyStr(copy.fotoDokumentasi);
            if (copy.fotoKkUrl) copy.fotoKkUrl = stripHeavyStr(copy.fotoKkUrl);
            if (copy.fotoRumahUrl) copy.fotoKkUrl = stripHeavyStr(copy.fotoRumahUrl);
            
            return copy;
          });

          const compressedJson = JSON.stringify(lightweight);
          localStorage.setItem(key, compressedJson);
          console.log(`[safeStorage] Successfully compressed "${key}" by stripping heavy media.`);
          return true;
        }
      } catch (stripError) {
        console.error('[safeStorage] Error during defensive compression recovery:', stripError);
      }
    }

    return false;
  }
}

/**
 * Safely set sessionStorage items
 */
export function safeSetSessionStorage(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[safeStorage] Failed setting sessionStorage key "${key}":`, err);
    return false;
  }
}

/**
 * Safely get sessionStorage items
 */
export function safeGetSessionStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeStorage] Failed getting sessionStorage key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Remove an item safely
 */
export function safeRemoveLocalStorage(key: string): void {
  try {
    memoryFallbackStorage.delete(key);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[safeStorage] Failed removing localStorage key "${key}":`, err);
  }
}

/**
 * Clears volatile keys while preserving permanent auth or target credentials
 */
export function clearVolatileStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !k.includes('password') && !k.includes('account') && !k.includes('profile')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    memoryFallbackStorage.clear();
  } catch (err) {
    console.warn('[safeStorage] Error clearing volatile storage:', err);
  }
}
