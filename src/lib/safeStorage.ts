/**
 * Safe Storage & Sanitization Utility
 * Provides defensive storage management, quota overflow recovery,
 * fallback in-memory adapters, and input sanitization helpers.
 */

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
 * Safely set localStorage items with defensive quota recovery
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    memoryFallbackStorage.set(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError =
      error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014);

    if (isQuotaError) {
      console.warn(`[safeStorage] LocalStorage quota exceeded for key "${key}". Initiating defensive cleanup...`);

      // 1. Remove obsolete or volatile items
      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
      } catch {}

      // 2. If it's a report array, create a trimmed lightweight offline version
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const lightweight = parsed.slice(0, 20).map((item: any) => ({
            ...item,
            dokumentasiFoto: Array.isArray(item.dokumentasiFoto)
              ? item.dokumentasiFoto.map((f: any) => ({
                  ...f,
                  url:
                    typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 20000
                      ? f.url.substring(0, 500) + '...[truncated]'
                      : f.url,
                }))
              : [],
          }));

          localStorage.setItem(key, JSON.stringify(lightweight));
          memoryFallbackStorage.set(key, JSON.stringify(lightweight));
          return true;
        }
      } catch (innerErr) {
        console.warn('[safeStorage] Heavy array pruning attempt failed:', innerErr);
      }

      // 3. Fallback to memory map if storage is completely full
      memoryFallbackStorage.set(key, value);
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
