/**
 * Utility to safely set localStorage and sessionStorage items without throwing QuotaExceededError
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
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
      console.warn(`[safeStorage] LocalStorage quota exceeded when setting "${key}". Cleaning up offline cache...`);

      // 1. Remove obsolete temporary tokens only
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
          console.info(`[safeStorage] Saved pruned lightweight offline cache for key "${key}".`);
          return true;
        }
      } catch (innerErr) {
        console.warn('[safeStorage] Heavy array pruning attempt failed:', innerErr);
      }

      // 3. Last attempt
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {}
    } else {
      console.warn(`[safeStorage] Could not write "${key}" to localStorage:`, error);
    }

    return false;
  }
}

export function safeSetSessionStorage(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[safeStorage] Could not write "${key}" to sessionStorage:`, error);
    return false;
  }
}
