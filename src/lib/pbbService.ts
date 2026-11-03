import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { SpptPbbItem, INITIAL_PBB_SUMMARY, SAMPLE_SPPT_ITEMS } from '../data/pbbSampleData';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { cleanFirestoreData } from './firestoreService';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { savePbbToIndexedDB, getPbbFromIndexedDB } from './indexedDbStorage';
import { PRECOMPUTED_PBB_SUMMARY_2026 } from '../data/pbbSummaryData';

export interface LingkunganPbbSummary {
  lingkungan: number;
  targetNominal: number;
  realisasiNominal: number;
  totalWp: number;
  wpLunas: number;
  persentaseRealisasi: number;
  persentaseWpLunas: number;
  sisaNominal: number;
  totalBermasalah: number;
}

export interface KelurahanPbbOverview {
  year: number;
  totalTargetNominal: number;
  totalRealisasiNominal: number;
  totalSisaNominal: number;
  totalWp: number;
  totalWpLunas: number;
  totalWpBelumLunas: number;
  totalBermasalah: number;
  persentaseRealisasiNominal: number;
  persentaseWpLunas: number;
  lingkunganSummaries: LingkunganPbbSummary[];
}

export const AVAILABLE_PBB_YEARS = [2024, 2025, 2026, 2027, 2028];
export const DEFAULT_PBB_YEAR = 2026;

const STORAGE_KEY_PREFIX = 'sikepling_sppt_pbb_records_';
export const PBB_SUMMARY_STORAGE_KEY_PREFIX = 'sikepling_pbb_summary_';

export const getPbbStorageKey = (year: number): string => {
  return `${STORAGE_KEY_PREFIX}${year}_v3`;
};

/**
 * Get synchronously cached PBB overview. Eliminates 0 (NOL) flickering on mobile devices.
 */
export function getCachedPbbOverview(year: number = DEFAULT_PBB_YEAR): KelurahanPbbOverview {
  const key = `${PBB_SUMMARY_STORAGE_KEY_PREFIX}${year}`;
  const cached = safeGetLocalStorage<KelurahanPbbOverview | null>(key, null);
  if (cached && cached.totalWp > 0) {
    return cached;
  }
  if (year === 2026 && PRECOMPUTED_PBB_SUMMARY_2026) {
    return PRECOMPUTED_PBB_SUMMARY_2026 as KelurahanPbbOverview;
  }
  return {
    year,
    totalTargetNominal: 0,
    totalRealisasiNominal: 0,
    totalSisaNominal: 0,
    totalWp: 0,
    totalWpLunas: 0,
    totalWpBelumLunas: 0,
    totalBermasalah: 0,
    persentaseRealisasiNominal: 0,
    persentaseWpLunas: 0,
    lingkunganSummaries: [],
  };
}

/**
 * Fetch PBB overview summary from Firestore document or server API buffer.
 * Only downloads 1 lightweight JSON document (~5KB) instead of 22,585 records (~18MB).
 */
export async function fetchPbbSummaryFromFirestore(year: number = DEFAULT_PBB_YEAR): Promise<KelurahanPbbOverview> {
  const key = `${PBB_SUMMARY_STORAGE_KEY_PREFIX}${year}`;

  // 1. Try Firestore doc `pbb_summary/{year}`
  try {
    const docRef = doc(db, 'pbb_summary', String(year));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as KelurahanPbbOverview;
      if (data && data.totalWp > 0) {
        safeSetLocalStorage(key, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn(`[PBB Summary] Firestore notice for ${year}:`, err);
  }

  // 2. Try Server buffer route `/api/pbb/summary`
  try {
    const res = await fetch(`/api/pbb/summary?year=${year}&_t=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.totalWp > 0) {
        safeSetLocalStorage(key, JSON.stringify(json.data));
        return json.data as KelurahanPbbOverview;
      }
    }
  } catch (err) {
    console.warn(`[PBB Summary] Server buffer notice for ${year}:`, err);
  }

  return getCachedPbbOverview(year);
}

/**
 * Real-time listener for PBB overview summary.
 * Instantly supplies cached numbers to mobile UI, then silently syncs updates.
 */
export function subscribePbbSummary(
  year: number = DEFAULT_PBB_YEAR,
  onData: (overview: KelurahanPbbOverview) => void
): Unsubscribe {
  const key = `${PBB_SUMMARY_STORAGE_KEY_PREFIX}${year}`;
  // 1. Immediately provide cached overview (0ms latency, never NOL)
  const initial = getCachedPbbOverview(year);
  onData(initial);

  // 2. Background refresh
  fetchPbbSummaryFromFirestore(year).then((latest) => {
    if (latest && latest.totalWp > 0) {
      onData(latest);
    }
  }).catch(() => {});

  // 3. Realtime Firestore listener on `pbb_summary/{year}`
  try {
    const docRef = doc(db, 'pbb_summary', String(year));
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as KelurahanPbbOverview;
          if (data && data.totalWp > 0) {
            safeSetLocalStorage(key, JSON.stringify(data));
            onData(data);
          }
        }
      },
      (err) => {
        console.warn(`[PBB Summary] Listener notice for ${year}:`, err);
      }
    );
  } catch (e) {
    console.warn('Error setting up pbb_summary subscription:', e);
    return () => {};
  }
}

/**
 * Save updated overview summary to Firestore and LocalStorage
 */
export async function savePbbSummaryToFirestore(overview: KelurahanPbbOverview, year: number = DEFAULT_PBB_YEAR): Promise<void> {
  const key = `${PBB_SUMMARY_STORAGE_KEY_PREFIX}${year}`;
  safeSetLocalStorage(key, JSON.stringify(overview));
  try {
    const docRef = doc(db, 'pbb_summary', String(year));
    await setDoc(docRef, { ...overview, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn(`[PBB Summary] Error saving summary to Firestore:`, e);
  }
}

/**
 * Load SPPT items from localStorage or IndexedDB fallback
 */
export function getLocalSpptForYear(year: number): SpptPbbItem[] {
  const key = getPbbStorageKey(year);
  const res = safeGetLocalStorage<SpptPbbItem[]>(key, []);
  if (Array.isArray(res) && res.length > 0) return res;

  // Check fallback storage keys (e.g. legacy master data key)
  const legacyMaster = safeGetLocalStorage<SpptPbbItem[]>(`sikepling_pbb_master_data_${year}`, []);
  if (Array.isArray(legacyMaster) && legacyMaster.length > 0) {
    safeSetLocalStorage(key, JSON.stringify(legacyMaster));
    return legacyMaster;
  }

  return year === 2026 ? SAMPLE_SPPT_ITEMS : [];
}

/**
 * Asynchronously read full PBB SPPT records from IndexedDB (supports 100MB+ without 5MB quota limit)
 */
export async function getPbbSpptFromIndexedDb(year: number = DEFAULT_PBB_YEAR): Promise<SpptPbbItem[]> {
  try {
    const idbData = await getPbbFromIndexedDB();
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }
  } catch (err) {
    console.warn('[PBB IDB] Error loading from IndexedDB:', err);
  }
  return getLocalSpptForYear(year);
}

/**
 * Save SPPT items to localStorage AND IndexedDB and notify all components
 */
export function saveLocalSpptForYear(items: SpptPbbItem[], year: number): void {
  const key = getPbbStorageKey(year);
  safeSetLocalStorage(key, JSON.stringify(items));
  safeSetLocalStorage(`sikepling_pbb_master_data_${year}`, JSON.stringify(items));
  // Safely persist complete dataset to IndexedDB (prevents mobile quota drop)
  savePbbToIndexedDB(items).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pbb-data-updated', { detail: { year, count: items.length } }));
  }
}

/**
 * Calculate comprehensive PBB statistics per Lingkungan and for entire Kelurahan.
 * If spptList is not yet loaded, automatically returns cached/precomputed overview so HP never displays 0!
 */
export function computePbbOverview(spptList: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): KelurahanPbbOverview {
  if (!spptList || spptList.length === 0) {
    return getCachedPbbOverview(year);
  }

  const lingkunganSummaries: LingkunganPbbSummary[] = [];
  let totalTargetNominal = 0;
  let totalRealisasiNominal = 0;
  let totalWp = 0;
  let totalWpLunas = 0;
  let totalBermasalah = 0;

  // Single-pass bucket aggregation for 24 Lingkungan
  interface LkBucket {
    count: number;
    lunasCount: number;
    nominalTotal: number;
    nominalLunas: number;
    bermasalahCount: number;
  }

  const buckets: LkBucket[] = Array.from({ length: 25 }, () => ({
    count: 0,
    lunasCount: 0,
    nominalTotal: 0,
    nominalLunas: 0,
    bermasalahCount: 0,
  }));

  for (let i = 0; i < spptList.length; i++) {
    const s = spptList[i];
    const n = Number(s.lingkungan);
    if (n >= 1 && n <= 24) {
      const b = buckets[n];
      b.count++;
      const terutang = Number(s.pbbTerutang) || 0;
      b.nominalTotal += terutang;
      if (s.status === 'Sudah Bayar') {
        b.lunasCount++;
        const paid =
          s.jumlahBayar !== undefined && s.jumlahBayar !== null && Number(s.jumlahBayar) > 0
            ? Number(s.jumlahBayar)
            : terutang;
        b.nominalLunas += paid;
      }
      if (s.isBermasalah) {
        b.bermasalahCount++;
      }
    }
  }

  for (let n = 1; n <= 24; n++) {
    const base = INITIAL_PBB_SUMMARY[n] || {
      targetNominal: 0,
      realisasiNominal: 0,
      totalWp: 0,
      wpLunas: 0,
    };

    const b = buckets[n];
    const lkTotalWp = b.count > 0 ? b.count : base.totalWp;
    const lkTargetNominal = b.nominalTotal > 0 ? b.nominalTotal : base.targetNominal;
    const lkWpLunas = b.count > 0 ? b.lunasCount : base.wpLunas;
    const lkRealisasiNominal = b.nominalTotal > 0 ? b.nominalLunas : base.realisasiNominal;
    const lkBermasalah = b.bermasalahCount;
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
      totalBermasalah: lkBermasalah,
    });

    totalTargetNominal += lkTargetNominal;
    totalRealisasiNominal += lkRealisasiNominal;
    totalWp += lkTotalWp;
    totalWpLunas += lkWpLunas;
    totalBermasalah += lkBermasalah;
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
    totalBermasalah,
    persentaseRealisasiNominal,
    persentaseWpLunas,
    lingkunganSummaries,
  };
}

/**
 * Fetch only the SPPT items belonging to a single lingkungan (e.g. for Kepling on mobile).
 * Reduces payload from 22,585 items to ~800 items.
 */
export async function fetchPbbSpptForLingkungan(year: number = DEFAULT_PBB_YEAR, lingkungan: number): Promise<SpptPbbItem[]> {
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  try {
    const q = query(collection(db, colName), where('lingkungan', '==', lingkungan));
    const snap = await getDocs(q);
    const items: SpptPbbItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as SpptPbbItem;
      if (data && data.id) items.push({ ...data, id: docSnap.id || data.id });
    });
    return items;
  } catch (err) {
    console.warn(`[PBB Fetch] Notice fetching Lingkungan ${lingkungan}:`, err);
    return [];
  }
}

/**
 * Subscribe to SPPT items for a single lingkungan in real-time
 */
export function subscribePbbSpptForLingkungan(
  year: number = DEFAULT_PBB_YEAR,
  lingkungan: number,
  onData: (items: SpptPbbItem[]) => void
): Unsubscribe {
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  const q = query(collection(db, colName), where('lingkungan', '==', lingkungan));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SpptPbbItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SpptPbbItem;
        if (data && data.id) items.push({ ...data, id: docSnap.id || data.id });
      });
      if (items.length > 0) {
        onData(items);
      }
    },
    (err) => {
      console.warn(`[PBB Subscribe] Notice for Lingkungan ${lingkungan}:`, err);
    }
  );
}

/**
 * Format teks resmi WhatsApp untuk Rekapitulasi Capaian PBB 24 Lingkungan (Persentase Kepatuhan WP).
 * Diurutkan dari Lingkungan 1 sampai dengan 24.
 */
export function formatRekapPbbWaText(overview: KelurahanPbbOverview, year: number = DEFAULT_PBB_YEAR): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatRp = (val: number) => 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');

  let text = `*REKAPITULASI CAPAIAN REALISASI PBB-P2 KELURAHAN MANGGA*\n`;
  text += `*TAHUN PAJAK ${year}*\n`;
  text += `*KECAMATAN MEDAN TUNTUNGAN*\n\n`;
  text += `📅 Hari/Tanggal : ${dateStr}\n`;
  text += `⏰ Waktu Tarik   : Pukul ${timeStr} WIB\n`;
  text += `👥 Kepatuhan WP  : ${overview.totalWpLunas.toLocaleString('id-ID')} / ${overview.totalWp.toLocaleString('id-ID')} WP (${overview.persentaseWpLunas.toFixed(1)}% Lunas)\n`;
  text += `💰 Nominal Uang  : ${formatRp(overview.totalRealisasiNominal)} / ${formatRp(overview.totalTargetNominal)} (${overview.persentaseRealisasiNominal.toFixed(1)}%)\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*DAFTAR CAPAIAN 24 LINGKUNGAN (URUT 1 - 24):*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // Urut Lingkungan 1 sampai 24
  const sorted = [...overview.lingkunganSummaries].sort((a, b) => a.lingkungan - b.lingkungan);

  sorted.forEach((item) => {
    const lkAccount = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === item.lingkungan);
    const namaLingkungan = lkAccount?.lingkungan || `Lingkungan ${item.lingkungan}`;
    const namaKepling = lkAccount?.nama || 'Kepala Lingkungan';
    const pctWp = item.persentaseWpLunas.toFixed(1);
    const pctNominal = item.persentaseRealisasi.toFixed(1);

    // Indikator status kepatuhan (< 50% Merah, 50-74% Kuning, >= 75% Hijau)
    let badge = '🔴';
    if (item.persentaseWpLunas >= 75) badge = '🟢';
    else if (item.persentaseWpLunas >= 50) badge = '🟡';
    else badge = '🔴';

    text += `${badge} *${namaLingkungan}* (${namaKepling})\n`;
    text += `   • Rasio WP Lunas : *${pctWp}%* (${item.wpLunas}/${item.totalWp} WP)\n`;
    text += `   • Realisasi Uang : ${pctNominal}% (${formatRp(item.realisasiNominal)})\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*TOTAL KELURAHAN MANGGA:*\n`;
  text += `• Total WP Lunas : *${overview.totalWpLunas.toLocaleString('id-ID')} / ${overview.totalWp.toLocaleString('id-ID')} WP (${overview.persentaseWpLunas.toFixed(1)}%)*\n`;
  text += `• Total Terbayar : *${formatRp(overview.totalRealisasiNominal)} / ${formatRp(overview.totalTargetNominal)} (${overview.persentaseRealisasiNominal.toFixed(1)}%)*\n`;
  text += `• Sisa Tunggakan : ${formatRp(overview.totalSisaNominal)} (${overview.totalWpBelumLunas.toLocaleString('id-ID')} WP Belum Bayar)\n\n`;
  text += `_Data tersinkronisasi langsung dengan Database SPPT PBB-P2 Kelurahan Mangga._`;

  return text;
}

// ====================================================
// SMART MERGE & DUAL-TIER SYNC (SERVER BUFFER + FIRESTORE)
// ====================================================

export const PBB_COLLECTION_PREFIX = 'pbb_sppt_';

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
 * Smart merge SPPT items: overlays updates on top of base items.
 * Uses updatedAt timestamps to ensure recent edits (such as moving lingkungan) are strictly preserved.
 */
export function smartMergeSpptItems(baseList: SpptPbbItem[], updates: SpptPbbItem[], prioritizeRemote: boolean = false): SpptPbbItem[] {
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
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const updateTime = update.updatedAt ? new Date(update.updatedAt).getTime() : 0;

      // Conflict resolution:
      // If existing item was modified more recently than incoming update, KEEP existing item!
      // Otherwise, apply update.
      if (existingTime > updateTime) {
        map.set(targetId, {
          ...update,
          ...existing,
          id: targetId,
        });
      } else {
        map.set(targetId, {
          ...existing,
          ...update,
          id: targetId,
        });
      }
    } else {
      // New record added
      const newItemPaid = update.jumlahBayar !== undefined 
        ? update.jumlahBayar 
        : (update.status === 'Sudah Bayar' ? update.pbbTerutang : null);
      map.set(update.id, { 
        ...update,
        jumlahBayar: newItemPaid ?? null,
        keterangan: update.keterangan || '',
      });
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
      window.dispatchEvent(new CustomEvent('pbb-data-updated', { detail: { year } }));
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
 * Fetch SPPT data strictly online: Server API Buffer + Cloud Firestore
 */
export async function fetchPbbSpptFromFirestore(year: number = DEFAULT_PBB_YEAR): Promise<SpptPbbItem[]> {
  let currentList: SpptPbbItem[] = [];
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;

  // 1. Fetch from Firebase Firestore (Priority)
  try {
    console.log(`[PBB Fetch] Fetching from Firestore: ${colName}`);
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    const firestoreItems: SpptPbbItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SpptPbbItem;
      if (data && data.id) {
        firestoreItems.push({ ...data, id: docSnap.id || data.id });
      }
    });

    console.log(`[PBB Fetch] Firestore returned ${firestoreItems.length} items for ${colName}`);

    if (firestoreItems.length > 0) {
      currentList = smartMergeSpptItems(currentList, firestoreItems);
      // Asynchronously cache into local IndexedDB
      savePbbToIndexedDB(currentList).catch(() => {});
    } else if (snapshot.size === 0) {
      console.warn(`[PBB Fetch] Firestore collection ${colName} is empty.`);
    }
  } catch (err) {
    console.warn(`[PBB Fetch] Firestore notice for ${colName}, attempting local offline fallback:`, err);
    try {
      const idbItems = await getPbbFromIndexedDB();
      if (idbItems && idbItems.length > 0) {
        currentList = smartMergeSpptItems(currentList, idbItems);
      }
    } catch {}
  }

  // 2. Fetch from Express Server Buffer (/api/pbb) (Fallback/Merge)
  try {
    const apiItems = await fetchPbbFromApi(year);
    if (apiItems.length > 0) {
      console.log(`[PBB Fetch] Buffer returned ${apiItems.length} items`);
      currentList = smartMergeSpptItems(currentList, apiItems);
    }
  } catch (err) {
    console.warn(`[PBB Fetch] Buffer warning for ${year}:`, err);
  }

  return currentList;
}

/**
 * Sanitizes and normalizes an SPPT item for safe writing to Firestore.
 * Strictly guarantees `jumlahBayar` is either a valid number or null (NEVER undefined),
 * and removes any undefined fields to prevent Firestore serialization errors.
 */
export function cleanPbbItemForFirestore(item: SpptPbbItem): Record<string, any> {
  const isLunas = item.status === 'Sudah Bayar';
  const terutang = typeof item.pbbTerutang === 'number'
    ? item.pbbTerutang
    : (Number(String(item.pbbTerutang || 0).replace(/[^0-9]/g, '')) || 0);

  let jBayar: number | null = null;
  if (item.jumlahBayar !== undefined && item.jumlahBayar !== null) {
    const num = Number(item.jumlahBayar);
    jBayar = isNaN(num) ? null : num;
  } else if (isLunas) {
    jBayar = terutang;
  }

  const rawDoc: Record<string, any> = {
    id: String(item.id),
    no: Number(item.no) || 1,
    nop: item.nop ? String(item.nop).trim() : '',
    buku: item.buku ? String(item.buku) : 'I, II, III',
    namaWp: item.namaWp ? String(item.namaWp).trim() : '',
    alamatOp: item.alamatOp ? String(item.alamatOp).trim() : '',
    pbbTerutang: terutang,
    status: isLunas ? 'Sudah Bayar' : 'Belum Bayar',
    lingkungan: typeof item.lingkungan === 'number' && !isNaN(item.lingkungan)
      ? item.lingkungan
      : (!isNaN(Number(item.lingkungan)) ? Number(item.lingkungan) : 0),
    jumlahBayar: jBayar, // Guaranteed to be number or null, NEVER undefined!
    keterangan: item.keterangan ? String(item.keterangan).trim() : '',
    isBermasalah: Boolean(item.isBermasalah),
    masalahNote: item.masalahNote ? String(item.masalahNote).trim() : '',
    tglBayar: item.tglBayar ? String(item.tglBayar).trim() : (isLunas ? (item.updatedAt ? item.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0]) : null),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };

  return cleanFirestoreData(rawDoc);
}

/**
 * Save single SPPT item to Firebase Firestore AND Server Buffer AND broadcast
 */
export async function savePbbSpptToFirestore(item: SpptPbbItem, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  const safePayload = cleanPbbItemForFirestore(item) as unknown as SpptPbbItem;

  // 1. Broadcast to other open tabs on same device (e.g. Super Admin vs Kasi Pem)
  broadcastPbbChange(safePayload, year);

  // 2. Save to Express Server Buffer (/api/pbb) for zero-latency multi-user sync
  await savePbbToApi(safePayload, year).catch(() => {});

  // 3. Save to Cloud Firestore
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const docRef = doc(db, colName, String(safePayload.id));
    await setDoc(docRef, safePayload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PBB_COLLECTION_PREFIX}${year}`);
    return false;
  }
}

/**
 * Batch save SPPT items to Firebase Firestore & Server Buffer
 */
export async function batchSavePbbSpptToFirestore(items: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;

  // 0. Pre-clean all items to guarantee clean fields (no undefined)
  const sanitizedItems = items.map((item) => cleanPbbItemForFirestore(item) as unknown as SpptPbbItem);

  // 1. Save to Server Buffer
  await batchSavePbbToApi(sanitizedItems, year).catch(() => {});

  // 2. Save to Firestore in chunks of 400
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    let savedCount = 0;

    for (let i = 0; i < sanitizedItems.length; i += 400) {
      const chunk = sanitizedItems.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item || !item.id) continue;
        const docRef = doc(db, colName, String(item.id));
        const safeDoc = cleanPbbItemForFirestore(item);
        batch.set(docRef, safeDoc, { merge: true });
        savedCount++;
      }

      await batch.commit();
    }
    return savedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PBB_COLLECTION_PREFIX}${year}`);
    return 0;
  }
}

/**
 * Delete SPPT item from Firebase Firestore & Server Buffer
 */
export async function deletePbbSpptFromFirestore(id: string, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  // 1. Remove from Server Buffer
  deletePbbFromApi(id, year).catch(() => {});

  // 2. Remove from Firestore
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PBB_COLLECTION_PREFIX}${year}`);
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

  let activeList: SpptPbbItem[] = getLocalSpptForYear(year);
  if (activeList.length > 0) {
    onData(activeList);
  }

  // Hydrate immediately from IndexedDB for zero-lag mobile restoration
  getPbbFromIndexedDB().then((idb) => {
    if (idb && idb.length > 0 && idb.length > activeList.length) {
      activeList = smartMergeSpptItems(activeList, idb);
      onData(activeList);
    }
  }).catch(() => {});

  // Initial fetch from Server API buffer
  fetchPbbFromApi(year).then((apiItems) => {
    if (apiItems.length > 0) {
      activeList = smartMergeSpptItems(activeList, apiItems);
      onData(activeList);
    }
  }).catch(() => {});

  // 1. Firestore Real-time listener
  let firestoreUnsub: (() => void) | null = null;
  firestoreUnsub = onSnapshot(
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
        console.warn(`[PBB Sync] Firestore collection appears empty for ${year}. Retaining existing data to prevent flicker.`);
        // Do NOT set activeList to [] immediately, wait for actual data or explicit wipe command
      } else if (firestoreItems.length > 0) {
        activeList = smartMergeSpptItems(activeList, firestoreItems);
        savePbbToIndexedDB(activeList).catch(() => {});
        onData(activeList);
      } else if (!snapshot.empty && firestoreItems.length === 0 && !isFromCache) {
        // This case handles a true empty collection if we know it should be empty
        activeList = [];
        onData([]);
      }
    },
    (err: any) => {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('Quota exceeded') ||
        err?.message?.includes('resource-exhausted')
      ) {
        console.warn(`Firestore quota exhausted for PBB SPPT ${year}, detaching listener.`);
        if (firestoreUnsub) {
          try { firestoreUnsub(); } catch {}
        }
      }
      handleFirestoreError(err, OperationType.LIST, colName);
    }
  );

  // 2. Cross-tab BroadcastChannel listener (instant 0ms update between Super Admin and Kasi Pem)
  const handleBroadcast = (msg: any) => {
    if (msg?.data?.year === year && msg?.data?.item) {
      activeList = smartMergeSpptItems(activeList, [msg.data.item]);
      onData(activeList);
    }
  };
  if (pbbBroadcastChannel) {
    pbbBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Custom DOM event in same tab / window
  const handleCustomEvent = (e: any) => {
    const detail = e.detail;
    if (detail?.year === year && detail?.item) {
      activeList = smartMergeSpptItems(activeList, [detail.item]);
      onData(activeList);
    }
  };
  window.addEventListener('pbb-item-synced', handleCustomEvent);

  // 4. Periodic polling from Server API buffer every 30 seconds as fallback only when tab is visible
  const pollInterval = setInterval(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const apiItems = await fetchPbbFromApi(year);
      if (apiItems && apiItems.length > 0) {
        if (apiItems.length !== activeList.length) {
          activeList = smartMergeSpptItems(activeList, apiItems);
          onData(activeList);
        }
      }
    } catch {
      // ignore
    }
  }, 600000);

  return () => {
    firestoreUnsub();
    clearInterval(pollInterval);
    if (pbbBroadcastChannel) {
      pbbBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('pbb-item-synced', handleCustomEvent);
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

    // 3. Clear Firestore Collections in 400-doc chunks
    const collectionsToClean = ['pbb_sppt', ...years.map((y) => `${PBB_COLLECTION_PREFIX}${y}`)];
    for (const colName of collectionsToClean) {
      try {
        const colRef = collection(db, colName);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 400);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, colName);
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

/**
 * Reset seluruh status WP menjadi 'Belum Bayar' di Firestore, server, dan memori
 */
export async function resetAllPbbStatusEverywhere(year: number = DEFAULT_PBB_YEAR): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const nowIso = new Date().toISOString();
    let totalUpdated = 0;

    // 1. Reset on Server Buffer
    try {
      await fetch('/api/pbb/reset', { method: 'POST' });
    } catch (e) {
      console.warn('Server reset PBB notice:', e);
    }

    // 2. Reset on Firestore in batches
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);

    const docsToReset: { id: string; ref: any }[] = [];
    snap.forEach((d) => {
      const data = d.data() as SpptPbbItem;
      if (data.status !== 'Belum Bayar' || (data.jumlahBayar !== null && data.jumlahBayar !== undefined)) {
        docsToReset.push({ id: d.id, ref: d.ref });
      }
    });

    for (let i = 0; i < docsToReset.length; i += 400) {
      const chunk = docsToReset.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.update(item.ref, {
          status: 'Belum Bayar',
          jumlahBayar: null,
          updatedAt: nowIso,
        });
      }
      await batch.commit();
      totalUpdated += chunk.length;
    }

    // 3. Clear/Update LocalStorage
    const key = getPbbStorageKey(year);
    const local = safeGetLocalStorage<SpptPbbItem[]>(key, []);
    if (Array.isArray(local) && local.length > 0) {
      const updatedLocal = local.map((x) => ({
        ...x,
        status: 'Belum Bayar' as const,
        jumlahBayar: null,
        updatedAt: nowIso,
      }));
      safeSetLocalStorage(key, JSON.stringify(updatedLocal));
    }

    // 4. Dispatch broadcast
    if (pbbBroadcastChannel) {
      pbbBroadcastChannel.postMessage({ type: 'PBB_RESET_ALL_STATUS', year });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pbb-data-updated', { detail: { year, resetStatus: true } }));
    }

    return {
      success: true,
      message: `Berhasil mereset seluruh status Wajib Pajak (${totalUpdated} WP) menjadi "Belum Bayar" di Cloud Firestore & Server.`,
      count: totalUpdated,
    };
  } catch (err: any) {
    console.error('Error in resetAllPbbStatusEverywhere:', err);
    return {
      success: false,
      message: err?.message || 'Gagal mereset status PBB',
      count: 0,
    };
  }
}
