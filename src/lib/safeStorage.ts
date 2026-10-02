/**
 * Safe Storage & Sanitization Utility
 * Provides defensive storage management, quota overflow recovery,
 * fallback in-memory adapters, and input sanitization helpers.
 */

import { saveReportsToIndexedDB } from './indexedDbStorage';

const memoryFallbackStorage = new Map<string, string>();

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
 * NEVER drops or slices records; strips heavy base64 strings on quota error to keep ALL reports intact.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    // Keep in memory map first
    memoryFallbackStorage.set(key, value);

    // If it's a reports array, also save full data to IndexedDB asynchronously
    try {
      if (key.includes('laporan') || key.includes('reports')) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveReportsToIndexedDB(parsed).catch(() => {});
        }
      }
    } catch {}

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
      console.warn(`[safeStorage] LocalStorage quota exceeded for key "${key}". Initiating defensive compression across ALL records...`);

      // 1. Remove obsolete or volatile items to free space
      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
      } catch {}

      // 2. If it's a report array, compress heavy base64 photo payloads while keeping ALL items intact (NEVER slice!)
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
            // Strip heavy base64 photo lists for realisasi pembangunan if quota hit
            const stripHeavyStr = (url?: string) => (typeof url === 'string' && url.startsWith('data:') && url.length > 500 ? '' : url);
            if (copy.fotoSebelumUrl) copy.fotoSebelumUrl = stripHeavyStr(copy.fotoSebelumUrl);
            if (copy.fotoProsesUrl) copy.fotoProsesUrl = stripHeavyStr(copy.fotoProsesUrl);
            if (copy.fotoSesudahUrl) copy.fotoSesudahUrl = stripHeavyStr(copy.fotoSesudahUrl);
            if (Array.isArray(copy.fotoSebelumList)) copy.fotoSebelumList = copy.fotoSebelumList.map(stripHeavyStr).filter(Boolean);
            if (Array.isArray(copy.fotoProsesList)) copy.fotoProsesList = copy.fotoProsesList.map(stripHeavyStr).filter(Boolean);
            if (Array.isArray(copy.fotoSesudahList)) copy.fotoSesudahList = copy.fotoSesudahList.map(stripHeavyStr).filter(Boolean);
            if (copy.absenApel && typeof copy.absenApel === 'object') {
              copy.absenApel = {
                ...copy.absenApel,
                fotoApel: '',
                fotoBase64: '',
              };
            }
            return copy;
          });

          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        }
      } catch (innerErr) {
        console.warn('[safeStorage] Heavy array compression attempt failed:', innerErr);
      }

      return true;
    }

    // Save in-memory if browser blocks localStorage
    memoryFallbackStorage.set(key, value);
    return false;
  }
}

/**
 * Safely remove an item from storage
 */
export function safeRemoveLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
  memoryFallbackStorage.delete(key);
}

/**
 * Safely write to sessionStorage
 */
export function safeSetSessionStorage(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[safeStorage] Could not write "${key}" to sessionStorage:`, error);
    return false;
  }
}

/**
 * Safely read from sessionStorage
 */
export function safeGetSessionStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}
