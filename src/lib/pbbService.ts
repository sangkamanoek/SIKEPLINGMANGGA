import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { SpptPbbItem, INITIAL_PBB_SUMMARY, SAMPLE_SPPT_ITEMS } from '../data/pbbSampleData';

export interface LingkunganPbbSummary {
  lingkungan: number;
  targetNominal: number;
  realisasiNominal: number;
  totalWp: number;
  wpLunas: number;
  persentaseRealisasi: number;
  persentaseWpLunas: number;
  sisaNominal: number;
}

export interface KelurahanPbbOverview {
  year: number;
  totalTargetNominal: number;
  totalRealisasiNominal: number;
  totalSisaNominal: number;
  totalWp: number;
  totalWpLunas: number;
  totalWpBelumLunas: number;
  persentaseRealisasiNominal: number;
  persentaseWpLunas: number;
  lingkunganSummaries: LingkunganPbbSummary[];
}

export const AVAILABLE_PBB_YEARS = [2024, 2025, 2026, 2027, 2028];
export const DEFAULT_PBB_YEAR = 2026;

const STORAGE_KEY_PREFIX = 'sikepling_sppt_pbb_records_';

export const getPbbStorageKey = (year: number): string => {
  return `${STORAGE_KEY_PREFIX}${year}_v3`;
};

/**
 * Load SPPT items from localStorage or fallback to defaults
 */
export function getLocalSpptForYear(year: number): SpptPbbItem[] {
  try {
    const key = getPbbStorageKey(year);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading local SPPT:', err);
  }
  return [];
}

/**
 * Save SPPT items to localStorage
 */
export function saveLocalSpptForYear(items: SpptPbbItem[], year: number): void {
  try {
    const key = getPbbStorageKey(year);
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn('Error saving local SPPT:', err);
  }
}

/**
 * Calculate comprehensive PBB statistics per Lingkungan and for entire Kelurahan
 */
export function computePbbOverview(spptList: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): KelurahanPbbOverview {
  const lingkunganSummaries: LingkunganPbbSummary[] = [];
  let totalTargetNominal = 0;
  let totalRealisasiNominal = 0;
  let totalWp = 0;
  let totalWpLunas = 0;

  for (let n = 1; n <= 24; n++) {
    const base = INITIAL_PBB_SUMMARY[n] || {
      targetNominal: 0,
      realisasiNominal: 0,
      totalWp: 0,
      wpLunas: 0,
    };

    const spptLingkungan = spptList.filter((s) => Number(s.lingkungan) === n);
    const spptLunas = spptLingkungan.filter((s) => s.status === 'Sudah Bayar');

    const spptNominalLunas = spptLunas.reduce((acc, curr) => acc + (Number(curr.pbbTerutang) || 0), 0);
    const spptNominalTotal = spptLingkungan.reduce((acc, curr) => acc + (Number(curr.pbbTerutang) || 0), 0);

    // If actual SPPTs exist in database, use actual counts and sums; otherwise use target baseline
    const lkTotalWp = spptLingkungan.length > 0 ? spptLingkungan.length : base.totalWp;
    const lkTargetNominal = spptNominalTotal > 0 ? spptNominalTotal : base.targetNominal;

    const lkWpLunas = spptLunas.length;
    const lkRealisasiNominal = spptNominalLunas;
    const lkSisaNominal = Math.max(0, lkTargetNominal - lkRealisasiNominal);

    const persentaseRealisasi = lkTargetNominal > 0 ? (lkRealisasiNominal / lkTargetNominal) * 100 : 0;
    const persentaseWpLunas = lkTotalWp > 0 ? (lkWpLunas / lkTotalWp) * 100 : 0;

    lingkunganSummaries.push({
      lingkungan: n,
      targetNominal: lkTargetNominal,
      realisasiNominal: lkRealisasiNominal,
      totalWp: lkTotalWp,
      wpLunas: lkWpLunas,
      persentaseRealisasi,
      persentaseWpLunas,
      sisaNominal: lkSisaNominal,
    });

    totalTargetNominal += lkTargetNominal;
    totalRealisasiNominal += lkRealisasiNominal;
    totalWp += lkTotalWp;
    totalWpLunas += lkWpLunas;
  }

  const totalSisaNominal = Math.max(0, totalTargetNominal - totalRealisasiNominal);
  const totalWpBelumLunas = Math.max(0, totalWp - totalWpLunas);
  const persentaseRealisasiNominal = totalTargetNominal > 0 ? (totalRealisasiNominal / totalTargetNominal) * 100 : 0;
  const persentaseWpLunas = totalWp > 0 ? (totalWpLunas / totalWp) * 100 : 0;

  return {
    year,
    totalTargetNominal,
    totalRealisasiNominal,
    totalSisaNominal,
    totalWp,
    totalWpLunas,
    totalWpBelumLunas,
    persentaseRealisasiNominal,
    persentaseWpLunas,
    lingkunganSummaries,
  };
}

// ====================================================
// SMART MERGE & DUAL-TIER SYNC (SERVER BUFFER + FIRESTORE)
// ====================================================

const PBB_COLLECTION_PREFIX = 'pbb_sppt_';

/**
 * Format raw NOP digits (up to 18 digits) into XX.XX.XXX.XXX.XXX-XXXX.X dynamically as-you-type
 */
export function formatNop(nop: string): string {
  if (!nop) return '';
  const digits = nop.replace(/[^0-9]/g, '').substring(0, 18);
  let res = '';
  if (digits.length > 0) {
    res += digits.substring(0, 2);
  }
  if (digits.length > 2) {
    res += '.' + digits.substring(2, 4);
  }
  if (digits.length > 4) {
    res += '.' + digits.substring(4, 7);
  }
  if (digits.length > 7) {
    res += '.' + digits.substring(7, 10);
  }
  if (digits.length > 10) {
    res += '.' + digits.substring(10, 13);
  }
  if (digits.length > 13) {
    res += '-' + digits.substring(13, 17);
  }
  if (digits.length > 17) {
    res += '.' + digits.substring(17, 18);
  }
  return res;
}

/**
 * Remove dots and hyphens from NOP for comparison
 */
export function stripNonDigits(val: string): string {
  if (!val) return '';
  return val.replace(/[^0-9]/g, '');
}

/**
 * Smart merge SPPT items: overlays updates on top of base items without losing other records
 */
export function smartMergeSpptItems(baseList: SpptPbbItem[], updates: SpptPbbItem[]): SpptPbbItem[] {
  if (!Array.isArray(updates) || updates.length === 0) return baseList;
  const map = new Map<string, SpptPbbItem>();
  const nopMap = new Map<string, string>(); // cleaned nop -> canonical id

  // 1. Fill map with base items
  for (const item of baseList) {
    if (!item || !item.id) continue;
    map.set(item.id, { ...item });
    if (item.nop) {
      nopMap.set(stripNonDigits(item.nop), item.id);
    }
  }

  // 2. Overlay updates (matched by id or canonical stripped NOP)
  for (const update of updates) {
    if (!update || !update.id) continue;
    const cleanNop = update.nop ? stripNonDigits(update.nop) : '';
    let targetId = update.id;
    if (!map.has(targetId) && cleanNop && nopMap.has(cleanNop)) {
      targetId = nopMap.get(cleanNop)!;
    }

    if (map.has(targetId)) {
      const existing = map.get(targetId)!;
      map.set(targetId, {
        ...existing,
        ...update,
        id: targetId,
      });
    } else {
      // New record added by user
      map.set(update.id, { ...update });
      if (cleanNop) {
        nopMap.set(cleanNop, update.id);
      }
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (a.lingkungan !== b.lingkungan) return a.lingkungan - b.lingkungan;
    return a.no - b.no;
  });
  return merged;
}

// Cross-tab broadcast channel for immediate 0ms sync between Super Admin & Kasi Pem on same device
const PBB_BROADCAST_CHANNEL_NAME = 'sikepling_pbb_sync_channel';
let pbbBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    pbbBroadcastChannel = new BroadcastChannel(PBB_BROADCAST_CHANNEL_NAME);
  }
} catch {
  // ignore
}

export function broadcastPbbChange(item: SpptPbbItem, year: number) {
  try {
    if (pbbBroadcastChannel) {
      pbbBroadcastChannel.postMessage({ type: 'UPDATE_ITEM', item, year, timestamp: Date.now() });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pbb-item-synced', { detail: { item, year } }));
    }
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// SERVER API BUFFER CLIENT (/api/pbb)
// ----------------------------------------------------

export async function fetchPbbFromApi(year: number = DEFAULT_PBB_YEAR): Promise<SpptPbbItem[]> {
  try {
    const res = await fetch(`/api/pbb?year=${year}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn(`Notice fetching PBB from /api/pbb for ${year}:`, err);
  }
  return [];
}

export async function savePbbToApi(item: SpptPbbItem, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  try {
    const res = await fetch('/api/pbb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, year }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Notice saving PBB to /api/pbb:`, err);
    return false;
  }
}

export async function batchSavePbbToApi(items: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  try {
    if (!Array.isArray(items) || items.length === 0) return true;
    const res = await fetch('/api/pbb/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, year }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Notice batch saving PBB to /api/pbb:`, err);
    return false;
  }
}

export async function deletePbbFromApi(id: string, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  try {
    const res = await fetch(`/api/pbb/${year}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn(`Notice deleting PBB from /api/pbb:`, err);
    return false;
  }
}

// ----------------------------------------------------
// COMBINED FETCH & PERSISTENCE (FIRESTORE + API BUFFER)
// ----------------------------------------------------

/**
 * Fetch SPPT data with multi-tier fallback: Local Cache -> Server API Buffer -> Cloud Firestore
 */
export async function fetchPbbSpptFromFirestore(year: number = DEFAULT_PBB_YEAR): Promise<SpptPbbItem[]> {
  let currentList = getLocalSpptForYear(year);

  // 1. Fetch from Express Server Buffer (/api/pbb)
  try {
    const apiItems = await fetchPbbFromApi(year);
    if (apiItems.length > 0) {
      currentList = smartMergeSpptItems(currentList, apiItems);
      saveLocalSpptForYear(currentList, year);
    }
  } catch (err) {
    console.warn(`Notice reading PBB server buffer for ${year}:`, err);
  }

  // 2. Fetch from Firebase Firestore
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    const firestoreItems: SpptPbbItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SpptPbbItem;
      if (data && data.id) {
        firestoreItems.push({ ...data, id: docSnap.id || data.id });
      }
    });

    if (firestoreItems.length > 0) {
      currentList = smartMergeSpptItems(currentList, firestoreItems);
      saveLocalSpptForYear(currentList, year);
      // Sync to Server API buffer as well so all devices have it
      batchSavePbbToApi(currentList, year).catch(() => {});
      return currentList;
    }

    return currentList;
  } catch (err) {
    console.warn(`Firestore PBB fetch notice for ${year}:`, err);
    return currentList;
  }
}

/**
 * Save single SPPT item to Firebase Firestore AND Server Buffer AND broadcast
 */
export async function savePbbSpptToFirestore(item: SpptPbbItem, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  // 1. Immediately update Local Cache
  const currentList = getLocalSpptForYear(year);
  const updatedList = smartMergeSpptItems(currentList, [item]);
  saveLocalSpptForYear(updatedList, year);

  // 2. Broadcast to other open tabs on same device (e.g. Super Admin vs Kasi Pem)
  broadcastPbbChange(item, year);

  // 3. Save to Express Server Buffer (/api/pbb) for zero-latency multi-user sync
  savePbbToApi(item, year).catch(() => {});

  // 4. Save to Cloud Firestore
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const docRef = doc(db, colName, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Firestore saving notice for SPPT ${item.id}:`, err);
    return false;
  }
}

/**
 * Batch save SPPT items to Firebase Firestore & Server Buffer
 */
export async function batchSavePbbSpptToFirestore(items: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): Promise<number> {
  // 1. Save to Server Buffer
  batchSavePbbToApi(items, year).catch(() => {});

  // 2. Save to Firestore in chunks of 400
  try {
    if (!Array.isArray(items) || items.length === 0) return 0;
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    let savedCount = 0;

    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item || !item.id) continue;
        const docRef = doc(db, colName, item.id);
        batch.set(docRef, item, { merge: true });
        savedCount++;
      }

      await batch.commit();
    }
    return savedCount;
  } catch (err) {
    console.warn('Error batch saving SPPT to Firestore:', err);
    return 0;
  }
}

/**
 * Delete SPPT item from Firebase Firestore & Server Buffer
 */
export async function deletePbbSpptFromFirestore(id: string, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  // 1. Remove from local cache
  const currentList = getLocalSpptForYear(year).filter((i) => i.id !== id);
  saveLocalSpptForYear(currentList, year);

  // 2. Remove from Server Buffer
  deletePbbFromApi(id, year).catch(() => {});

  // 3. Remove from Firestore
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn(`Error deleting SPPT ${id} from Firestore:`, err);
    return false;
  }
}

/**
 * Real-time listener for SPPT from Firebase Firestore + Server Polling + Cross-tab Broadcast
 */
export function subscribePbbSpptFromFirestore(
  year: number = DEFAULT_PBB_YEAR,
  onData: (items: SpptPbbItem[]) => void
): Unsubscribe {
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  const colRef = collection(db, colName);

  let activeList = getLocalSpptForYear(year);

  // 1. Firestore Real-time listener
  const firestoreUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      const firestoreItems: SpptPbbItem[] = [];
      const isFromCache = snapshot.metadata.fromCache;
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SpptPbbItem;
        if (data && data.id) {
          firestoreItems.push({ ...data, id: docSnap.id || data.id });
        }
      });

      // If the server is genuinely empty (database wiped / fresh start) and we are not loading from offline cache
      if (snapshot.empty && !isFromCache) {
        console.log(`[PBB Sync] Firestore collection is empty on the server. Clearing local cache for ${year}.`);
        activeList = [];
        saveLocalSpptForYear([], year);
        onData([]);
      } else if (firestoreItems.length > 0) {
        activeList = smartMergeSpptItems(activeList, firestoreItems);
        saveLocalSpptForYear(activeList, year);
        onData(activeList);
      }
    },
    (err) => {
      console.warn(`Firestore PBB onSnapshot notice for ${year}:`, err);
    }
  );

  // 2. Cross-tab BroadcastChannel listener (instant 0ms update between Super Admin and Kasi Pem)
  const handleBroadcast = (msg: any) => {
    if (msg?.data?.year === year && msg?.data?.item) {
      activeList = smartMergeSpptItems(activeList, [msg.data.item]);
      saveLocalSpptForYear(activeList, year);
      onData(activeList);
    }
  };
  if (pbbBroadcastChannel) {
    pbbBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Window Storage event listener (syncs across browser tabs on same domain)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === getPbbStorageKey(year) && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          activeList = smartMergeSpptItems(activeList, parsed);
          onData(activeList);
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 4. Custom DOM event in same tab / window
  const handleCustomEvent = (e: any) => {
    const detail = e.detail;
    if (detail?.year === year && detail?.item) {
      activeList = smartMergeSpptItems(activeList, [detail.item]);
      saveLocalSpptForYear(activeList, year);
      onData(activeList);
    }
  };
  window.addEventListener('pbb-item-synced', handleCustomEvent);

  // 5. Periodic polling from Server API buffer every 8 seconds as safety net
  const pollInterval = setInterval(async () => {
    try {
      const apiItems = await fetchPbbFromApi(year);
      if (apiItems && apiItems.length > 0) {
        const prevStatusStr = activeList.map((x) => `${x.id}:${x.status}`).join('|');
        const merged = smartMergeSpptItems(activeList, apiItems);
        const newStatusStr = merged.map((x) => `${x.id}:${x.status}`).join('|');
        if (prevStatusStr !== newStatusStr || merged.length !== activeList.length) {
          activeList = merged;
          saveLocalSpptForYear(activeList, year);
          onData(activeList);
        }
      }
    } catch {
      // ignore
    }
  }, 8000);

  return () => {
    firestoreUnsub();
    if (pbbBroadcastChannel) {
      pbbBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('pbb-item-synced', handleCustomEvent);
    clearInterval(pollInterval);
  };
}

/**
 * Hapus seluruh data PBB SPPT dari Firestore, LocalStorage, dan Server Buffer
 */
export async function wipeAllPbbSpptEverywhere(years: number[] = [2025, 2026, 2027]): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Clear LocalStorage
    years.forEach((yr) => {
      localStorage.removeItem(getPbbStorageKey(yr));
    });
    localStorage.removeItem('sikepling_sppt_pbb_records_v1');

    // 2. Clear Server API buffer
    try {
      await fetch('/api/pbb/clear-all', { method: 'POST' });
    } catch (e) {
      console.warn('Server clear PBB notice:', e);
    }

    // 3. Clear Firestore Collections
    const collectionsToClean = ['pbb_sppt', ...years.map((y) => `${PBB_COLLECTION_PREFIX}${y}`)];
    for (const colName of collectionsToClean) {
      try {
        const colRef = collection(db, colName);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn(`Error cleaning collection ${colName}:`, err);
      }
    }

    // 4. Dispatch broadcast
    if (pbbBroadcastChannel) {
      pbbBroadcastChannel.postMessage({ type: 'PBB_WIPED_ALL' });
    }
    window.dispatchEvent(new CustomEvent('pbb-wiped-all'));

    return { success: true, message: 'Seluruh data SPPT PBB berhasil dihapus dari Firebase Firestore, server, dan memori aplikasi.' };
  } catch (err: any) {
    console.error('Error in wipeAllPbbSpptEverywhere:', err);
    return { success: false, message: err?.message || 'Gagal menghapus data PBB' };
  }
}
