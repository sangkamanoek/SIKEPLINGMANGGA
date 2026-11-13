import { KeplingTargetCapaian, TargetsCapaianMap } from '../types';
import { getDefaultTargetsCapaianMap, DEFAULT_PERLINSOS_BASELINES } from '../data/targetsData';
import { safeSetLocalStorage } from './safeStorage';
import {
  fetchTargetsFromFirestore,
  saveTargetToFirestore,
  saveAllTargetsToFirestore,
  resetTargetsInFirestore,
  subscribeTargetsFromFirestore,
} from './firestoreService';

const LOCAL_STORAGE_KEY = 'manggajuara_targets_capaian_v2';
const OVERRIDE_VERSION_KEY = 'manggajuara_perlinsos_override_v2_applied';

/**
 * Baca target & capaian dari Firebase Firestore (dengan fallback ke server buffer, localStorage, dan defaults)
 */
export async function fetchTargetsCapaian(): Promise<TargetsCapaianMap> {
  let resultMap: TargetsCapaianMap | null = null;

  // 1. Prioritas utama: Firebase Firestore
  try {
    const firestoreMap = await fetchTargetsFromFirestore();
    if (firestoreMap && Object.keys(firestoreMap).length > 0) {
      resultMap = firestoreMap;
    }
  } catch (err) {
    // Already handled in fetchTargetsFromFirestore
  }

  // 2. Prioritas kedua: Server API buffer
  if (!resultMap) {
    try {
      const res = await fetch('/api/targets-capaian', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && typeof json.data === 'object' && Object.keys(json.data).length > 0) {
          resultMap = json.data as TargetsCapaianMap;
        }
      }
    } catch (err) {
      // Silent catch
    }
  }

  // 3. Fallback localStorage
  if (!resultMap) {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          resultMap = parsed as TargetsCapaianMap;
        }
      }
    } catch (err) {
      // Silent catch
    }
  }

  // 4. Fallback defaults resmi (Fresh baseline) without overwriting Firestore overrides
  const defaults = getDefaultTargetsCapaianMap();
  if (!resultMap || Object.keys(resultMap).length === 0) {
    resultMap = defaults;
  } else {
    Object.keys(defaults).forEach((k) => {
      if (resultMap && resultMap[k]) {
        if (resultMap[k].overrideBpjs === undefined) {
          resultMap[k].overrideBpjs = defaults[k].overrideBpjs;
        }
        if (resultMap[k].overridePerlinsos === undefined) {
          resultMap[k].overridePerlinsos = defaults[k].overridePerlinsos;
        }
        if (!resultMap[k].targetBpjs || resultMap[k].targetBpjs < 50) {
          resultMap[k].targetBpjs = 50;
        }
        // Align Kepling display name with official active Kepling directory if outdated
        resultMap[k].nama = defaults[k].nama;
        resultMap[k].lingkungan = defaults[k].lingkungan;
      } else if (resultMap) {
        resultMap[k] = defaults[k];
      }
    });
  }

  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(resultMap));
  return resultMap;
}

/**
 * Simpan target atau override capaian untuk satu Kepling ke Firebase Firestore dan server
 */
export async function saveKeplingTargetCapaian(
  item: Partial<KeplingTargetCapaian> & { keplingId: string }
): Promise<TargetsCapaianMap> {
  // 1. Update local storage first
  let currentMap: TargetsCapaianMap = {};
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    currentMap = local ? JSON.parse(local) : getDefaultTargetsCapaianMap();
  } catch {
    currentMap = getDefaultTargetsCapaianMap();
  }

  const existing = currentMap[item.keplingId] || {};
  currentMap[item.keplingId] = {
    ...existing,
    ...item,
    updatedAt: new Date().toISOString(),
  } as KeplingTargetCapaian;

  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(currentMap));

  // 2. Simpan langsung ke Firebase Firestore
  try {
    await saveTargetToFirestore(item);
  } catch (err) {
    // Already handled
  }

  // 3. Sync ke server buffer
  try {
    const res = await fetch('/api/targets-capaian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
        return json.data;
      }
    }
  } catch (err) {
    // Already handled
  }

  return currentMap;
}

/**
 * Simpan batch seluruh target ke Firebase Firestore and server
 */
export async function saveAllTargetsCapaian(
  allTargets: TargetsCapaianMap
): Promise<TargetsCapaianMap> {
  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(allTargets));

  // 1. Simpan ke Firebase Firestore
  try {
    await saveAllTargetsToFirestore(allTargets);
  } catch (err) {
    // Already handled
  }

  // 2. Sync ke server buffer
  try {
    const res = await fetch('/api/targets-capaian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allTargets }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
        return json.data;
      }
    }
  } catch (err) {
    // Silent catch
  }

  return allTargets;
}

/**
 * Reset target ke nilai resmi Pemko Medan / Kelurahan Mangga di Firebase Firestore and server
 */
export async function resetTargetsCapaianToDefaults(): Promise<TargetsCapaianMap> {
  const defaults = getDefaultTargetsCapaianMap();
  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(defaults));

  // 1. Reset di Firebase Firestore
  try {
    await resetTargetsInFirestore();
  } catch (err) {
    // Already handled
  }

  // 2. Reset di server buffer
  try {
    const res = await fetch('/api/targets-capaian/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    // Silent catch
  }

  return defaults;
}

export { subscribeTargetsFromFirestore };
