import { KeplingTargetCapaian, TargetsCapaianMap } from '../types';
import { getDefaultTargetsCapaianMap } from '../data/targetsData';
import { safeSetLocalStorage } from './safeStorage';
import {
  fetchTargetsFromFirestore,
  saveTargetToFirestore,
  saveAllTargetsToFirestore,
  resetTargetsInFirestore,
  subscribeTargetsFromFirestore,
} from './firestoreService';

const LOCAL_STORAGE_KEY = 'manggajuara_targets_capaian_v1';

/**
 * Baca target & capaian dari Firebase Firestore (dengan fallback ke server buffer, localStorage, dan defaults)
 */
export async function fetchTargetsCapaian(): Promise<TargetsCapaianMap> {
  // 1. Prioritas utama: Firebase Firestore
  try {
    const firestoreMap = await fetchTargetsFromFirestore();
    if (firestoreMap && Object.keys(firestoreMap).length > 0) {
      safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(firestoreMap));
      return firestoreMap;
    }
  } catch (err) {
    console.warn('Notice reading targets from Firebase Firestore, checking server buffer:', err);
  }

  // 2. Prioritas kedua: Server API buffer
  try {
    const res = await fetch('/api/targets-capaian', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && typeof json.data === 'object' && Object.keys(json.data).length > 0) {
        safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
        // Sync ke Firestore di background
        saveAllTargetsToFirestore(json.data).catch((e) => console.warn('Background sync targets to Firestore:', e));
        return json.data as TargetsCapaianMap;
      }
    }
  } catch (err) {
    console.warn('Gagal fetch /api/targets-capaian, menggunakan cache lokal:', err);
  }

  // 3. Fallback localStorage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed as TargetsCapaianMap;
      }
    }
  } catch (err) {
    console.error('Error parsing local targets:', err);
  }

  // 4. Fallback defaults resmi
  const defaults = getDefaultTargetsCapaianMap();
  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(defaults));
  // Simpan ke Firestore agar database Firebase langsung terisi data awal resmi
  saveAllTargetsToFirestore(defaults).catch((e) => console.warn('Init defaults to Firestore:', e));
  return defaults;
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
    console.warn('Notice saving target to Firebase Firestore:', err);
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
    console.warn('Gagal sync target ke server, tetap tersimpan di Firestore dan lokal:', err);
  }

  return currentMap;
}

/**
 * Simpan batch seluruh target ke Firebase Firestore dan server
 */
export async function saveAllTargetsCapaian(
  allTargets: TargetsCapaianMap
): Promise<TargetsCapaianMap> {
  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(allTargets));

  // 1. Simpan ke Firebase Firestore
  try {
    await saveAllTargetsToFirestore(allTargets);
  } catch (err) {
    console.warn('Notice saving all targets to Firebase Firestore:', err);
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
    console.warn('Gagal sync batch target ke server, tersimpan di Firestore dan lokal:', err);
  }

  return allTargets;
}

/**
 * Reset target ke nilai resmi Pemko Medan / Kelurahan Mangga di Firebase Firestore dan server
 */
export async function resetTargetsCapaianToDefaults(): Promise<TargetsCapaianMap> {
  const defaults = getDefaultTargetsCapaianMap();
  safeSetLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(defaults));

  // 1. Reset di Firebase Firestore
  try {
    await resetTargetsInFirestore();
  } catch (err) {
    console.warn('Notice resetting targets in Firebase Firestore:', err);
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
    console.warn('Gagal reset target ke server:', err);
  }

  return defaults;
}

export { subscribeTargetsFromFirestore };
