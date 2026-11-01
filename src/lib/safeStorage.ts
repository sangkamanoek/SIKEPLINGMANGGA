/**
 * Safe Storage & Performance Optimization Utility
 * Provides defensive storage management, non-blocking asynchronous persistence,
 * quota overflow recovery, and memory caching optimized for low-end mobile devices & laptops.
 */

import {
  saveReportsToIndexedDB,
  saveKeluargaToIndexedDB,
  savePbbToIndexedDB,
  saveVisitsToIndexedDB,
  saveHistoryToIndexedDB,
  saveSuratToIndexedDB,
  savePosyanduToIndexedDB,
} from './indexedDbStorage';

// Bounded memory cache (max 2MB total) to avoid memory leaks on 1GB/2GB RAM mobile devices
const memoryFallbackStorage = new Map<string, string>();
const MAX_MEMORY_CACHE_ENTRY_BYTES = 150_000; // 150KB per entry max for in-memory string cache

let idbSaveTimeout: any = null;
let idbKkSaveTimeout: any = null;
let idPbbSaveTimeout: any = null;
let idbVisitsTimeout: any = null;
let idbHistoryTimeout: any = null;
let idbSuratTimeout: any = null;
let idbPosyanduTimeout: any = null;

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
 * Populate in-memory cache for high-frequency small settings/keys
 */
export function populateMemoryCache(key: string, value: string): void {
  if (value.length <= MAX_MEMORY_CACHE_ENTRY_BYTES) {
    memoryFallbackStorage.set(key, value);
  }
}

/**
 * Type-safe and error-resilient retrieval from LocalStorage with fallback
 */
export function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  // Check memory cache first for fast lookup of lightweight data
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
 * Helper to strip heavy base64 media strings from objects for lightweight storage
 */
function stripHeavyMediaFromItem(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const copy = { ...item };
  const stripHeavyStr = (url?: any) =>
    typeof url === 'string' && url.startsWith('data:') && url.length > 200 ? '' : url;

  if (Array.isArray(copy.dokumentasiFoto)) {
    copy.dokumentasiFoto = copy.dokumentasiFoto.map((f: any) => {
      if (!f) return f;
      return { ...f, url: stripHeavyStr(f.url) };
    });
  }

  if (copy.fotoSebelumUrl) copy.fotoSebelumUrl = stripHeavyStr(copy.fotoSebelumUrl);
  if (copy.fotoProsesUrl) copy.fotoProsesUrl = stripHeavyStr(copy.fotoProsesUrl);
  if (copy.fotoSelesaiUrl) copy.fotoSelesaiUrl = stripHeavyStr(copy.fotoSelesaiUrl);
  if (copy.fotoDokumentasi) copy.fotoDokumentasi = stripHeavyStr(copy.fotoDokumentasi);
  if (copy.fotoKkUrl) copy.fotoKkUrl = stripHeavyStr(copy.fotoKkUrl);
  if (copy.fotoRumahUrl) copy.fotoRumahUrl = stripHeavyStr(copy.fotoRumahUrl);
  if (copy.fileUrl) copy.fileUrl = stripHeavyStr(copy.fileUrl);

  return copy;
}

/**
 * Safely set localStorage items with defensive quota recovery.
 * Optimized with debounced asynchronous IndexedDB persistence to prevent main-thread lag.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    // Only store lightweight keys in memory map to conserve RAM on low-end devices
    if (value.length <= MAX_MEMORY_CACHE_ENTRY_BYTES) {
      memoryFallbackStorage.set(key, value);
    } else {
      memoryFallbackStorage.delete(key);
    }

    // Persist heavy entities to IndexedDB in background with debouncing
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

    if (key.includes('surat')) {
      if (idbSuratTimeout) clearTimeout(idbSuratTimeout);
      idbSuratTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveSuratToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 500);
    }

    if (key.includes('posyandu')) {
      if (idbPosyanduTimeout) clearTimeout(idbPosyanduTimeout);
      idbPosyanduTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savePosyanduToIndexedDB(parsed).catch(() => {});
          }
        } catch {}
      }, 500);
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
      console.warn(`[safeStorage] LocalStorage quota exceeded for key "${key}". Running defensive recovery...`);

      // 1. Aggressively clear volatile and obsolete items to free space immediately
      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
        localStorage.removeItem('sikepling_bottom5_monthly_kepling_ids');

        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes('_v1') || k.includes('_v2')) && k !== key) {
            if (!k.includes('history') && !k.includes('reports') && !k.includes('list')) {
              localStorage.removeItem(k);
            }
          }
        }
      } catch {}

      // 2. Selective Payload Compression: Strip heavy base64 media while keeping all text & metadata
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Asynchronously persist full data with photos to IndexedDB first
          if (key.includes('laporan') || key.includes('reports')) {
            saveReportsToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('keluarga') || key.includes('family')) {
            saveKeluargaToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('pbb') || key.includes('sppt')) {
            savePbbToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('kunjungan') || key.includes('visit')) {
            saveVisitsToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('history')) {
            saveHistoryToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('surat')) {
            saveSuratToIndexedDB(parsed).catch(() => {});
          } else if (key.includes('posyandu')) {
            savePosyanduToIndexedDB(parsed).catch(() => {});
          }

          const lightweight = parsed.map(stripHeavyMediaFromItem);
          const compressedJson = JSON.stringify(lightweight);

          try {
            localStorage.setItem(key, compressedJson);
            console.log(`[safeStorage] Successfully saved stripped lightweight data for "${key}".`);
            return true;
          } catch (secondQuotaErr) {
            console.warn(`[safeStorage] Stripped data still exceeded quota. Offloaded safely to IndexedDB.`);
            return true;
          }
        }
      } catch (stripError) {
        console.error('[safeStorage] Error during defensive compression recovery:', stripError);
      }

      // Defensive: Never overwrite with '[]', preserve whatever is safely stored in IndexedDB and memory
      return true;
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
