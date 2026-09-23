/**
 * Purge All Client-Side Cache
 * Ensures no persistent application data or assets are cached on users' phones or browsers,
 * fulfilling the requirement for a 100% online system without phantom resurrecting data.
 */

export async function purgeAllClientCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Unregister old/stale Service Workers but PRESERVE our current active sw.js for PWA installability
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active && registration.active.scriptURL.includes('sw.js')) {
          console.log('[CachePurge] Preserving active PWA service worker:', registration.active.scriptURL);
          continue;
        }
        await registration.unregister();
        console.log('[CachePurge] Unregistered stale service worker:', registration.scope);
      }
    }
  } catch (err) {
    console.warn('[CachePurge] Error unregistering service workers:', err);
  }

  // 2. Delete all CacheStorage entries (caches.open, workbox-precache, etc.)
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        console.log('[CachePurge] Deleted cache storage:', name);
      }
    }
  } catch (err) {
    console.warn('[CachePurge] Error clearing caches:', err);
  }

  // 3. Remove all data-bearing localStorage keys
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const lower = k.toLowerCase();
        if (
          lower.includes('laporan') ||
          lower.includes('report') ||
          lower.includes('absen') ||
          lower.includes('attendance') ||
          lower.includes('sppt') ||
          lower.includes('pbb') ||
          lower.includes('kunjungan') ||
          lower.includes('offline_db') ||
          lower.startsWith('sikepling_') ||
          lower.startsWith('kepling_') ||
          lower.includes('workbox')
        ) {
          // Do not delete current active user session to avoid unexpected logout during active usage
          if (!lower.includes('session_current_user') && !lower.includes('current_user_account')) {
            keysToRemove.push(k);
          }
        }
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch (err) {
    console.warn('[CachePurge] Error clearing localStorage:', err);
  }

  // 4. Delete or clear IndexedDB databases
  try {
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      window.indexedDB.deleteDatabase('sikepling_offline_db');
    }
  } catch (err) {
    console.warn('[CachePurge] Error deleting IndexedDB:', err);
  }
}

