/**
 * Safe Storage & Performance Optimization Utility
 * Provides defensive storage management, non-blocking asynchronous persistence,
 * quota overflow recovery, and OOM-safe memory handling across Chrome, Safari, Firefox, and mobile WebViews.
 */

import {
  saveReportsToIndexedDB,
  savePbbToIndexedDB,
  saveVisitsToIndexedDB,
  saveHistoryToIndexedDB,
  saveSuratToIndexedDB,
  savePosyanduToIndexedDB,
  savePkkKegiatanToIndexedDB,
} from './indexedDbStorage';

// Bounded memory cache to avoid memory leaks on 1GB/2GB RAM mobile devices
const memoryFallbackStorage = new Map<string, string>();
const MAX_MEMORY_CACHE_ENTRY_BYTES = 120_000;
const MAX_LOCALSTORAGE_STRING_LEN = 3_200_000; // ~3.2M chars (~6.4MB UTF-16), safely below 5MB browser quota

let idbSaveTimeout: any = null;
let idPbbSaveTimeout: any = null;
let idbVisitsTimeout: any = null;
let idbHistoryTimeout: any = null;
let idbSuratTimeout: any = null;
let idbPosyanduTimeout: any = null;
let idbPkkKegiatanTimeout: any = null;

/**
 * Clean & sanitize text input to prevent malicious injections
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '')
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
  const cached = memoryFallbackStorage.get(key);
  if (cached !== undefined && cached !== null) {
    try {
      return JSON.parse(cached);
    } catch {
      memoryFallbackStorage.delete(key);
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
 * Helper to strip heavy base64 media strings from objects for lightweight localStorage hydration
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
  if (copy.fotoUrl) copy.fotoUrl = stripHeavyStr(copy.fotoUrl);
  if (copy.fotoDokumenUrl) copy.fotoDokumenUrl = stripHeavyStr(copy.fotoDokumenUrl);
  if (copy.pasphotoUrl) copy.pasphotoUrl = stripHeavyStr(copy.pasphotoUrl);
  if (copy.dokumentasiUrl) copy.dokumentasiUrl = stripHeavyStr(copy.dokumentasiUrl);
  if (Array.isArray(copy.fotoDokumentasi)) {
    copy.fotoDokumentasi = copy.fotoDokumentasi.map((f: any) => {
      if (!f) return f;
      return { ...f, url: stripHeavyStr(f.url) };
    });
  } else if (copy.fotoDokumentasi) {
    copy.fotoDokumentasi = stripHeavyStr(copy.fotoDokumentasi);
  }
  if (copy.fotoKkUrl) copy.fotoKkUrl = stripHeavyStr(copy.fotoKkUrl);
  if (copy.fotoRumahUrl) copy.fotoRumahUrl = stripHeavyStr(copy.fotoRumahUrl);
  if (copy.fileUrl) copy.fileUrl = stripHeavyStr(copy.fileUrl);

  return copy;
}

function scheduleIdbPersist(key: string, getParsedArray: () => any[] | null): void {
  if (key.includes('laporan') || key.includes('reports')) {
    if (idbSaveTimeout) clearTimeout(idbSaveTimeout);
    idbSaveTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) saveReportsToIndexedDB(parsed).catch(() => {});
    }, 250);
  }

  if (key.includes('pbb') || key.includes('sppt')) {
    if (idPbbSaveTimeout) clearTimeout(idPbbSaveTimeout);
    idPbbSaveTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) savePbbToIndexedDB(parsed).catch(() => {});
    }, 500);
  }

  if (key.includes('kunjungan') || key.includes('visit')) {
    if (idbVisitsTimeout) clearTimeout(idbVisitsTimeout);
    idbVisitsTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) saveVisitsToIndexedDB(parsed).catch(() => {});
    }, 450);
  }

  if (key.includes('history')) {
    if (idbHistoryTimeout) clearTimeout(idbHistoryTimeout);
    idbHistoryTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) saveHistoryToIndexedDB(parsed).catch(() => {});
    }, 550);
  }

  if (key.includes('surat')) {
    if (idbSuratTimeout) clearTimeout(idbSuratTimeout);
    idbSuratTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) saveSuratToIndexedDB(parsed).catch(() => {});
    }, 350);
  }

  if (key.includes('posyandu')) {
    if (idbPosyanduTimeout) clearTimeout(idbPosyanduTimeout);
    idbPosyanduTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) savePosyanduToIndexedDB(parsed).catch(() => {});
    }, 350);
  }

  if (key.includes('pkk_kegiatan')) {
    if (idbPkkKegiatanTimeout) clearTimeout(idbPkkKegiatanTimeout);
    idbPkkKegiatanTimeout = setTimeout(() => {
      const parsed = getParsedArray();
      if (parsed && parsed.length > 0) savePkkKegiatanToIndexedDB(parsed).catch(() => {});
    }, 350);
  }
}

/**
 * Safely set localStorage items with single-parse OOM protection and defensive quota recovery.
 */
export function safeSetLocalStorage(
  key: string,
  value: string,
  options?: { skipIdbMirror?: boolean }
): boolean {
  let cachedParsed: any | undefined;
  let didParse = false;

  const parseOnce = (): any => {
    if (!didParse) {
      didParse = true;
      try {
        cachedParsed = JSON.parse(value);
      } catch {
        cachedParsed = null;
      }
    }
    return cachedParsed;
  };

  try {
    if (value.length <= MAX_MEMORY_CACHE_ENTRY_BYTES) {
      memoryFallbackStorage.set(key, value);
    } else {
      memoryFallbackStorage.delete(key);
    }

    if (!options?.skipIdbMirror) {
      scheduleIdbPersist(key, () => {
        const parsed = parseOnce();
        return Array.isArray(parsed) ? parsed : null;
      });
    }

    // If payload exceeds browser localStorage limit completely, do not thrash localStorage or allocate compressed multi-MB copies unnecessarily
    if (value.length > MAX_LOCALSTORAGE_STRING_LEN) {
      const parsed = parseOnce();
      if (Array.isArray(parsed)) {
        const lightweight = parsed.map(stripHeavyMediaFromItem);
        const compressed = JSON.stringify(lightweight);
        if (compressed.length <= MAX_LOCALSTORAGE_STRING_LEN) {
          try {
            localStorage.setItem(key, compressed);
          } catch {}
        } else {
          // Too huge even stripped (e.g. 22k SPPT rows = ~18MB) — safely kept in IndexedDB without blowing localStorage
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
      return true;
    }

    const isHeavyData = value.length > 250_000;
    if (isHeavyData) {
      const parsed = parseOnce();
      if (Array.isArray(parsed)) {
        const lightweight = parsed.map(stripHeavyMediaFromItem);
        const compressed = JSON.stringify(lightweight);
        if (compressed.length <= MAX_LOCALSTORAGE_STRING_LEN) {
          localStorage.setItem(key, compressed);
        }
        return true;
      }
    }

    try {
      localStorage.setItem(key, value);
    } catch (setErr) {
      const parsed = parseOnce();
      if (Array.isArray(parsed)) {
        const lightweight = parsed.map(stripHeavyMediaFromItem);
        const compressed = JSON.stringify(lightweight);
        if (compressed.length <= MAX_LOCALSTORAGE_STRING_LEN) {
          localStorage.setItem(key, compressed);
        } else {
          return true;
        }
      } else {
        throw setErr;
      }
    }
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

      try {
        localStorage.removeItem('cleaned_reports_v2_kepling21');
        localStorage.removeItem('google_cached_access_token');
        localStorage.removeItem('sikepling_bottom5_monthly_kepling_ids');

        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key && (k.includes('sikepling_pbb_master_data_') || k.includes('sikepling_sppt_pbb_records_'))) {
            toDelete.push(k);
          }
        }
        toDelete.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
      } catch {}

      try {
        const parsed = parseOnce();
        if (Array.isArray(parsed)) {
          const lightweight = parsed.map(stripHeavyMediaFromItem);
          const compressedJson = JSON.stringify(lightweight);
          if (compressedJson.length <= MAX_LOCALSTORAGE_STRING_LEN) {
            try {
              localStorage.setItem(key, compressedJson);
            } catch {}
          }
          return true;
        }
      } catch {}

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
 * Cleans obsolete cache, volatile logs, orphaned tokens, and frees browser memory
 * without deleting essential accounts, active _v2 data, or pending Firestore sync queues.
 */
export function optimizeAndCleanBrowserMemory(): { freedKeys: number; freedApproxBytes: number } {
  let freedCount = 0;
  let freedBytes = 0;

  try {
    memoryFallbackStorage.clear();

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      const lower = k.toLowerCase();
      const isEssential =
        lower.includes('account') ||
        lower.includes('profile') ||
        lower.includes('password') ||
        lower.includes('active_tab') ||
        lower.includes('auth') ||
        lower.includes('device_id') ||
        lower.includes('write_queue') ||
        lower.includes('deleted') ||
        lower.includes('pbb_summary') ||
        k === 'kepling_local_laporan_history_v2' ||
        k === 'sikepling_kunjungan_warga_v2' ||
        k === 'sikepling_monitoring_infra_v2' ||
        k === 'sikepling_agenda_kelurahan_v2' ||
        k === 'sikepling_surat_kedinasan_v1' ||
        k === 'sikepling_pkk_buku_1_v1' ||
        k === 'sikepling_pkk_buku_4_v1' ||
        k === 'sikepling_pkk_buku_5_v1' ||
        k === 'sikepling_pkk_kegiatan_v1' ||
        k === 'sikepling_pkk_keuangan_v1' ||
        k === 'sikepling_pkk_dasa_wisma_v1' ||
        k === 'sikepling_pkk_posyandu_v2' ||
        k === 'sikepling_pkk_dasa_wisma_v2';

      if (!isEssential) {
        if (
          lower.includes('backup') ||
          lower.includes('old') ||
          lower.includes('temp') ||
          lower.includes('cache') ||
          lower.includes('log') ||
          lower.includes('_v1') ||
          lower.includes('sikepling_pbb_master_data_') ||
          lower.includes('sikepling_sppt_pbb_records_') ||
          lower.includes('draft') ||
          lower.includes('seen_items') ||
          lower.includes('google_cached') ||
          lower.includes('cleaned_reports') ||
          lower.includes('dismissed') ||
          lower.includes('network_clock')
        ) {
          keysToRemove.push(k);
        }
      }
    }

    keysToRemove.forEach((key) => {
      try {
        const val = localStorage.getItem(key);
        if (val) freedBytes += val.length * 2;
        localStorage.removeItem(key);
        freedCount++;
      } catch {}
    });

    try {
      sessionStorage.clear();
    } catch {}

    console.log(`[Memory Cleaner] Cleaned ${freedCount} keys (~${(freedBytes / 1024).toFixed(1)} KB freed).`);
  } catch (err) {
    console.warn('[Memory Cleaner] Error during memory optimization:', err);
  }

  return { freedKeys: freedCount, freedApproxBytes: freedBytes };
}
