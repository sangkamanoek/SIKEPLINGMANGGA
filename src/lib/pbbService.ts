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
  return `${STORAGE_KEY_PREFIX}${year}_v2`;
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Fallback for legacy 2025 key if needed
    if (year === 2025) {
      const legacyRaw = localStorage.getItem('sikepling_sppt_pbb_records_v1');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading local SPPT:', err);
  }
  return SAMPLE_SPPT_ITEMS;
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

  // Pre-calculate sample counts per lingkungan to detect "extra" WP added by user
  const sampleCountsByLk: Record<number, number> = {};
  const sampleNominalsByLk: Record<number, number> = {};
  
  SAMPLE_SPPT_ITEMS.forEach(item => {
    sampleCountsByLk[item.lingkungan] = (sampleCountsByLk[item.lingkungan] || 0) + 1;
    sampleNominalsByLk[item.lingkungan] = (sampleNominalsByLk[item.lingkungan] || 0) + (Number(item.pbbTerutang) || 0);
  });

  for (let n = 1; n <= 24; n++) {
    const base = INITIAL_PBB_SUMMARY[n] || {
      targetNominal: 300000000,
      realisasiNominal: 0,
      totalWp: 350,
      wpLunas: 0,
    };

    const spptLingkungan = spptList.filter((s) => Number(s.lingkungan) === n);
    const spptLunas = spptLingkungan.filter((s) => s.status === 'Sudah Bayar');

    const sampleNominalLunas = spptLunas.reduce((acc, curr) => acc + (Number(curr.pbbTerutang) || 0), 0);
    const currentNominalTotal = spptLingkungan.reduce((acc, curr) => acc + (Number(curr.pbbTerutang) || 0), 0);

    // Logic: 
    // Total WP = Official Target + (Actual records in DB - Sample records in DB)
    // This way, if they add a new WP, the total increases.
    const lkSampleCount = sampleCountsByLk[n] || 0;
    const lkExtraWp = Math.max(0, spptLingkungan.length - lkSampleCount);
    const lkTotalWp = base.totalWp + lkExtraWp;

    // Target Nominal = Official Target + (Actual nominal in DB - Sample nominal in DB)
    const lkSampleNominal = sampleNominalsByLk[n] || 0;
    const lkExtraNominal = Math.max(0, currentNominalTotal - lkSampleNominal);
    const lkTargetNominal = base.targetNominal + lkExtraNominal;

    const lkWpLunas = spptLunas.length;
    const lkRealisasiNominal = sampleNominalLunas;
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
// FIRESTORE SYNC FOR PBB
// ====================================================

const PBB_COLLECTION_PREFIX = 'pbb_sppt_';

/**
 * Fetch SPPT data from Firebase Firestore for given year
 */
export async function fetchPbbSpptFromFirestore(year: number = DEFAULT_PBB_YEAR): Promise<SpptPbbItem[]> {
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    const items: SpptPbbItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SpptPbbItem;
      if (data && data.id) {
        items.push({ ...data, id: docSnap.id || data.id });
      }
    });

    if (items.length > 0) {
      // Sort by lingkungan then no
      items.sort((a, b) => {
        if (a.lingkungan !== b.lingkungan) return a.lingkungan - b.lingkungan;
        return a.no - b.no;
      });
      // Save to local cache as well
      saveLocalSpptForYear(items, year);
      return items;
    }

    // Auto-seed default to Firestore if empty
    const defaults = getLocalSpptForYear(year);
    if (defaults.length > 0) {
      await batchSavePbbSpptToFirestore(defaults, year);
    }
    return defaults;
  } catch (err) {
    console.warn(`Firestore PBB fetch notice for ${year}:`, err);
    return getLocalSpptForYear(year);
  }
}

/**
 * Save single SPPT item to Firebase Firestore
 */
export async function savePbbSpptToFirestore(item: SpptPbbItem, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
  try {
    const colName = `${PBB_COLLECTION_PREFIX}${year}`;
    const docRef = doc(db, colName, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Error saving SPPT ${item.id} to Firestore:`, err);
    return false;
  }
}

/**
 * Batch save SPPT items to Firebase Firestore
 */
export async function batchSavePbbSpptToFirestore(items: SpptPbbItem[], year: number = DEFAULT_PBB_YEAR): Promise<number> {
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
 * Delete SPPT item from Firebase Firestore
 */
export async function deletePbbSpptFromFirestore(id: string, year: number = DEFAULT_PBB_YEAR): Promise<boolean> {
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
 * Real-time listener for SPPT from Firebase Firestore
 */
export function subscribePbbSpptFromFirestore(
  year: number = DEFAULT_PBB_YEAR,
  onData: (items: SpptPbbItem[]) => void
): Unsubscribe {
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  const colRef = collection(db, colName);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: SpptPbbItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SpptPbbItem;
        if (data && data.id) {
          items.push({ ...data, id: docSnap.id || data.id });
        }
      });
      if (items.length > 0) {
        items.sort((a, b) => {
          if (a.lingkungan !== b.lingkungan) return a.lingkungan - b.lingkungan;
          return a.no - b.no;
        });
        saveLocalSpptForYear(items, year);
        onData(items);
      }
    },
    (err) => {
      console.warn(`Firestore PBB onSnapshot notice for ${year}:`, err);
    }
  );
}

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
