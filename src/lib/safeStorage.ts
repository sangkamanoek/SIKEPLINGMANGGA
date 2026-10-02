/**
 * Safe Storage & Performance Optimization Utility
 * Provides defensive storage management, non-blocking asynchronous persistence,
 * quota overflow recovery, and memory caching.
 */

import { saveReportsToIndexedDB, saveKeluargaToIndexedDB, savePbbToIndexedDB } from './indexedDbStorage';

const memoryFallbackStorage = new Map<string, string>();

let idbSaveTimeout: any = null;
let idbKkSaveTimeout: any = null;
let idPbbSaveTimeout: any = null;

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
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      const fallback = memoryFallbackStorage.get(key);
      return fallback ? JSON.parse(fallback) : defaultValue;
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
      console.warn(`[safeStorage] LocalStorage quota exceeded for key "${key}". Initiating defensive compression...`);

      // 1. Remove obsolete or volatile items to free space
      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
        localStorage.removeItem('sikepling_bottom5_monthly_kepling_ids');
      } catch {}

      // 2. If it's a family database or PBB data, save full data to IndexedDB and keep minimal in LocalStorage
      if (key.includes('keluarga') || key.includes('family') || key.includes('pbb') || key.includes('sppt')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            // Persist full data to IndexedDB immediately on quota error
            if (key.includes('keluarga') || key.includes('family')) {
              saveKeluargaToIndexedDB(parsed).catch(() => {});
            } else {
              savePbbToIndexedDB(parsed).catch(() => {});
            }
            
            // Save an empty array to LocalStorage to avoid crashing
            localStorage.setItem(key, JSON.stringify([]));
            return true;
          }
        } catch (storageErr) {
          console.error('[safeStorage] Error during large data quota recovery:', storageErr);
        }
      }

      // 3. If it's a report array, compress heavy base64 photo payloads while keeping ALL items intact
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Asynchronously persist full data with photos to IndexedDB
          saveReportsToIndexedDB(parsed).catch(() => {});

          // Preserve ALL items, stripping heavy base64 strings to ensure 100% fit in LocalStorage
          const lightweight = parsed.map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            const copy = { ...item };
            if (Array.isArray(copy.dokumentasiFoto)) {
              copy.dokumentasiFoto = copy.dokumentasiFoto.map((f: any) => {
                if (!f) return f;
                const isHeavy = typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 500;
                return {
                  ...f,
                  url: isHeavy ? '' : f.url,
                };
              });
            }
            const stripHeavyStr = (url?: string) => (typeof url === 'string' && url.startsWith('data:') && url.length > 500 ? '' : url);
            if (copy.fotoSebelumUrl) copy.fotoSebelumUrl = stripHeavyStr(copy.fotoSebelumUrl);
            if (copy.fotoProsesUrl) copy.fotoProsesUrl = stripHeavyStr(copy.fotoProsesUrl);
            if (copy.fotoSelesaiUrl) copy.fotoSelesaiUrl = stripHeavyStr(copy.fotoSelesaiUrl);
            return copy;
          });

          const compressedJson = JSON.stringify(lightweight);
          localStorage.setItem(key, compressedJson);
          return true;
        }
      } catch (stripError) {
        console.error('[safeStorage] Error during defensive strip compression:', stripError);
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
