import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { LingkunganPolygon, TitikRumahBangunan, RuasJalanLingkungan } from '../types';
import {
  DEFAULT_LINGKUNGAN_POLYGONS,
  DEFAULT_TITIK_RUMAH,
  DEFAULT_RUAS_JALAN,
} from '../data/defaultGeoData';
import { safeSetLocalStorage } from './safeStorage';
import { cleanFirestoreData } from './firestoreService';

const STORAGE_KEY_POLYGONS = 'webgis_lingkungan_polygons_v1';
const STORAGE_KEY_HOUSES = 'webgis_titik_rumah_v1';
const STORAGE_KEY_ROADS = 'webgis_ruas_jalan_v1';

const COLLECTION_POLYGONS = 'webgis_polygons';
const COLLECTION_HOUSES = 'webgis_houses';
const COLLECTION_ROADS = 'webgis_roads';

// ==========================================
// 1. POLYGONS (BATAS LINGKUNGAN 1 - 24)
// ==========================================

export function getLocalPolygons(): LingkunganPolygon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLYGONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Gagal membaca polygon lokal:', e);
  }
  return DEFAULT_LINGKUNGAN_POLYGONS;
}

export function saveLocalPolygons(polygons: LingkunganPolygon[]): void {
  safeSetLocalStorage(STORAGE_KEY_POLYGONS, JSON.stringify(polygons));
}

export async function fetchAllPolygons(): Promise<LingkunganPolygon[]> {
  try {
    const colRef = collection(db, COLLECTION_POLYGONS);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list: LingkunganPolygon[] = [];
      snap.forEach((d) => {
        list.push(d.data() as LingkunganPolygon);
      });
      list.sort((a, b) => a.lingkunganNomor - b.lingkunganNomor);
      saveLocalPolygons(list);
      return list;
    }
  } catch (e) {
    console.warn('Notice fetch polygons Firestore, using local fallback:', e);
  }
  return getLocalPolygons();
}

export async function deleteAllPolygons(): Promise<boolean> {
  saveLocalPolygons([]);
  try {
    const colRef = collection(db, COLLECTION_POLYGONS);
    const snap = await getDocs(colRef);
    const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
    return true;
  } catch (e) {
    console.warn('Gagal menghapus polygon di Firestore:', e);
    return false;
  }
}

export async function savePolygonToFirestore(polygon: LingkunganPolygon): Promise<boolean> {
  // Update local cache first
  const current = getLocalPolygons();
  const index = current.findIndex((p) => p.lingkunganId === polygon.lingkunganId || p.id === polygon.id);
  let updated: LingkunganPolygon[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = polygon;
  } else {
    updated = [...current, polygon];
  }
  saveLocalPolygons(updated);

  try {
    const docRef = doc(db, COLLECTION_POLYGONS, polygon.id || `poly_${polygon.lingkunganId}`);
    const cleaned = cleanFirestoreData(polygon);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (e) {
    console.warn('Gagal menyimpan polygon ke Firestore, tersimpan di lokal:', e);
    return false;
  }
}

// ==========================================
// 2. TITIK RUMAH & BANGUNAN (WRS, BANSOS, DEMOGRAFI)
// ==========================================

export function getLocalHouses(): TitikRumahBangunan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOUSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id === 'rumah_1') {
        localStorage.removeItem(STORAGE_KEY_HOUSES);
        return DEFAULT_TITIK_RUMAH;
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca titik rumah lokal:', e);
  }
  return DEFAULT_TITIK_RUMAH;
}

export function saveLocalHouses(houses: TitikRumahBangunan[]): void {
  try {
    safeSetLocalStorage(STORAGE_KEY_HOUSES, JSON.stringify(houses));
  } catch (e) {
    console.warn('Gagal menyimpan titik rumah ke lokal:', e);
  }
}

export async function fetchAllHouses(): Promise<TitikRumahBangunan[]> {
  const map = new Map<string, TitikRumahBangunan>();

  // 1. Ensure default landmarks like Kantor Lurah, SPBU, Kampus are present
  DEFAULT_TITIK_RUMAH.forEach((def) => {
    if (def && def.id) map.set(def.id, def);
  });

  // 2. Load cached local items first for instant responsiveness
  try {
    const local = getLocalHouses();
    if (Array.isArray(local) && local.length > 0) {
      local.forEach((h) => {
        if (h && h.id) map.set(h.id, h);
      });
    }
  } catch (e) {
    console.warn('Notice getLocalHouses:', e);
  }

  // 3. Fetch from Server API buffer
  try {
    const res = await fetch(`/api/webgis/houses?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        json.data.forEach((h: TitikRumahBangunan) => {
          if (h && h.id) map.set(h.id, h);
        });
      }
    }
  } catch (e) {
    console.warn('Notice fetch houses from server:', e);
  }

  // 4. Fetch directly from Firebase Firestore (Cloud Source of Truth)
  try {
    const colRef = collection(db, COLLECTION_HOUSES);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      snap.forEach((d) => {
        const item = { ...(d.data() as TitikRumahBangunan), id: d.id };
        if (item && item.id) map.set(item.id, item);
      });
    }
  } catch (e) {
    console.warn('Notice fetch houses Firestore:', e);
  }

  const list = Array.from(map.values());
  const kantorDef = DEFAULT_TITIK_RUMAH.find((d) => d.id === 'kantor_lurah_mangga');
  if (kantorDef) {
    const idx = list.findIndex((h) => h.id === 'kantor_lurah_mangga');
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        lingkunganId: kantorDef.lingkunganId,
        lingkunganNomor: kantorDef.lingkunganNomor,
        lat: kantorDef.lat,
        lng: kantorDef.lng,
        namaJalan: kantorDef.namaJalan,
        nomorRumah: kantorDef.nomorRumah,
      };
    }
  }

  if (list.length > 0) {
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    saveLocalHouses(list);
    return list;
  }
  return DEFAULT_TITIK_RUMAH;
}

export async function saveHouseToFirestore(house: TitikRumahBangunan): Promise<boolean> {
  // Update local cache immediately so it never vanishes on client
  const current = getLocalHouses();
  const index = current.findIndex((h) => h.id === house.id);
  let updated: TitikRumahBangunan[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = house;
  } else {
    updated = [house, ...current];
  }
  saveLocalHouses(updated);

  // 1. Save online to Server Buffer
  fetch('/api/webgis/houses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: house }),
  }).catch((err) => {
    console.warn('Notice saving house to server:', err);
  });

  // 2. Save online to Firestore with sanitized payload (strictly strip undefined fields)
  try {
    const cleaned = cleanFirestoreData(house);
    const docRef = doc(db, COLLECTION_HOUSES, house.id);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (e) {
    console.error('Gagal menyimpan titik rumah ke Firestore:', e);
    return false;
  }
}

export async function deleteHouseFromFirestore(houseId: string): Promise<boolean> {
  // Update local cache immediately
  const current = getLocalHouses();
  const updated = current.filter((h) => h.id !== houseId);
  saveLocalHouses(updated);

  // 1. Delete on Server Buffer
  fetch(`/api/webgis/houses/${encodeURIComponent(houseId)}`, {
    method: 'DELETE',
  }).catch((err) => {
    console.warn('Notice deleting house from server:', err);
  });

  // 2. Delete on Firestore
  try {
    const docRef = doc(db, COLLECTION_HOUSES, houseId);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.error('Gagal menghapus rumah di Firestore:', e);
    return false;
  }
}

export async function deleteBulkHousesFromFirestore(houseIds: string[]): Promise<boolean> {
  if (!Array.isArray(houseIds) || houseIds.length === 0) return true;
  const idSet = new Set(houseIds);

  // Update local cache
  const current = getLocalHouses();
  const updated = current.filter((h) => !idSet.has(h.id));
  saveLocalHouses(updated);

  // 1. Delete on Server Buffer
  fetch('/api/webgis/houses/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: houseIds }),
  }).catch((err) => {
    console.warn('Notice bulk deleting houses from server:', err);
  });

  // 2. Delete on Firestore in batches
  try {
    const promises = houseIds.map((id) => {
      const docRef = doc(db, COLLECTION_HOUSES, id);
      return deleteDoc(docRef).catch(() => {});
    });
    await Promise.all(promises);
    return true;
  } catch (e) {
    console.error('Gagal menghapus bulk houses di Firestore:', e);
    return false;
  }
}

export async function deleteAllHousesFromFirestore(): Promise<boolean> {
  // Update local cache
  saveLocalHouses([]);

  // 1. Server clear
  fetch('/api/webgis/houses/clear-all', {
    method: 'POST',
  }).catch((err) => {
    console.warn('Notice clearing houses on server:', err);
  });

  // 2. Firestore clear
  try {
    const colRef = collection(db, COLLECTION_HOUSES);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref).catch(() => {}));
      await Promise.all(deletePromises);
    }
    return true;
  } catch (e) {
    console.error('Gagal mengosongkan rumah di Firestore:', e);
    return false;
  }
}

// ==========================================
// 3. RUAS JALAN LINGKUNGAN
// ==========================================

export function getLocalRoads(): RuasJalanLingkungan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROADS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id === 'jalan_1') {
        localStorage.removeItem(STORAGE_KEY_ROADS);
        return [];
      }
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Gagal membaca jalan lokal:', e);
  }
  return DEFAULT_RUAS_JALAN;
}

export function saveLocalRoads(roads: RuasJalanLingkungan[]): void {
  try {
    safeSetLocalStorage(STORAGE_KEY_ROADS, JSON.stringify(roads));
  } catch (e) {
    console.warn('Gagal menyimpan ruas jalan ke lokal:', e);
  }
}

export async function fetchAllRoads(): Promise<RuasJalanLingkungan[]> {
  try {
    const colRef = collection(db, COLLECTION_ROADS);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list: RuasJalanLingkungan[] = [];
      snap.forEach((d) => {
        list.push({ ...(d.data() as RuasJalanLingkungan), id: d.id });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      saveLocalRoads(list);
      return list;
    }
  } catch (e) {
    console.warn('Notice fetch roads Firestore, using local fallback:', e);
  }
  return getLocalRoads();
}

export async function saveRoadToFirestore(road: RuasJalanLingkungan): Promise<boolean> {
  const current = getLocalRoads();
  const index = current.findIndex((r) => r.id === road.id);
  let updated: RuasJalanLingkungan[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = road;
  } else {
    updated = [road, ...current];
  }
  saveLocalRoads(updated);

  try {
    const docRef = doc(db, COLLECTION_ROADS, road.id);
    const cleaned = cleanFirestoreData(road);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (e) {
    console.warn('Gagal menyimpan ruas jalan ke Firestore:', e);
    return false;
  }
}

export async function deleteRoadFromFirestore(roadId: string): Promise<boolean> {
  const current = getLocalRoads();
  const updated = current.filter((r) => r.id !== roadId);
  saveLocalRoads(updated);

  try {
    const docRef = doc(db, COLLECTION_ROADS, roadId);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.warn('Gagal menghapus jalan di Firestore:', e);
    return false;
  }
}

// ==========================================
// 4. REAL-TIME SUBSCRIPTIONS
// ==========================================

export function subscribeWebgisData(
  onPolygonsUpdate: (polys: LingkunganPolygon[]) => void,
  onHousesUpdate: (houses: TitikRumahBangunan[]) => void,
  onRoadsUpdate: (roads: RuasJalanLingkungan[]) => void
): () => void {
  const unsubList: Unsubscribe[] = [];

  try {
    const u1 = onSnapshot(collection(db, COLLECTION_POLYGONS), (snap) => {
      if (!snap.empty) {
        const list: LingkunganPolygon[] = [];
        snap.forEach((d) => list.push(d.data() as LingkunganPolygon));
        list.sort((a, b) => a.lingkunganNomor - b.lingkunganNomor);
        saveLocalPolygons(list);
        onPolygonsUpdate(list);
      }
    });
    unsubList.push(u1);
  } catch (e) {
    console.warn('Error subscribing to polygons:', e);
  }

  try {
    const u2 = onSnapshot(collection(db, COLLECTION_HOUSES), (snap) => {
      const map = new Map<string, TitikRumahBangunan>();

      // 1. Always seed with default landmarks
      DEFAULT_TITIK_RUMAH.forEach((def) => {
        if (def && def.id) map.set(def.id, def);
      });

      // 2. Overlay live snapshot from Firestore
      if (!snap.empty) {
        snap.forEach((d) => {
          const item = { ...(d.data() as TitikRumahBangunan), id: d.id };
          if (item && item.id) map.set(item.id, item);
        });
      }

      const list = Array.from(map.values());
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      saveLocalHouses(list);
      onHousesUpdate(list);
    });
    unsubList.push(u2);
  } catch (e) {
    console.warn('Error subscribing to houses:', e);
  }

  try {
    const u3 = onSnapshot(collection(db, COLLECTION_ROADS), (snap) => {
      if (!snap.empty) {
        const list: RuasJalanLingkungan[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as RuasJalanLingkungan), id: d.id }));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        saveLocalRoads(list);
        onRoadsUpdate(list);
      }
    });
    unsubList.push(u3);
  } catch (e) {
    console.warn('Error subscribing to roads:', e);
  }

  return () => {
    unsubList.forEach((u) => {
      try {
        u();
      } catch (e) {}
    });
  };
}

// ==========================================
// 5. KML / GEOJSON PARSER HELPER
// ==========================================

export interface ParsedKmlPolygonItem {
  name: string;
  coordinates: [number, number][];
}

export function parseAllKmlPolygons(fileText: string): ParsedKmlPolygonItem[] {
  const results: ParsedKmlPolygonItem[] = [];
  try {
    const placemarkRegex = /<Placemark[\s\S]*?>([\s\S]*?)<\/Placemark>/gi;
    let pmMatch;
    while ((pmMatch = placemarkRegex.exec(fileText)) !== null) {
      const pmContent = pmMatch[1];
      const nameMatch = pmContent.match(/<name>([\s\S]*?)<\/name>/i);
      const name = nameMatch ? nameMatch[1].trim() : 'Lingkungan';

      const polyMatch = pmContent.match(/<Polygon[\s\S]*?>([\s\S]*?)<\/Polygon>/i);
      if (polyMatch) {
        const polyContent = polyMatch[1];
        const coordMatch = polyContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch && coordMatch[1]) {
          const rawCoords = coordMatch[1].trim().split(/\s+/);
          const coords: [number, number][] = [];
          for (const item of rawCoords) {
            const parts = item.split(',');
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                coords.push([lat, lng]);
              }
            }
          }
          if (coords.length >= 3) {
            results.push({ name, coordinates: coords });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error parsing multi-polygon KML:', e);
  }

  if (results.length === 0) {
    const singleCoords = parseKmlPolygonCoordinates(fileText);
    if (singleCoords.length >= 3) {
      results.push({ name: 'Lingkungan', coordinates: singleCoords });
    }
  }

  return results;
}

export function parseKmlPolygonCoordinates(fileText: string): [number, number][] {
  try {
    // Try parsing as GeoJSON first
    const trimmed = fileText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = JSON.parse(trimmed);
      let coordsRaw: any = null;
      if (json.type === 'FeatureCollection' && json.features?.[0]) {
        coordsRaw = json.features[0].geometry?.coordinates;
      } else if (json.type === 'Feature') {
        coordsRaw = json.geometry?.coordinates;
      } else if (json.type === 'Polygon' || json.type === 'MultiPolygon') {
        coordsRaw = json.coordinates;
      }
      
      if (coordsRaw) {
        const ring = json.type === 'MultiPolygon' ? coordsRaw[0][0] : (json.type === 'Polygon' ? coordsRaw[0] : coordsRaw);
        if (Array.isArray(ring)) {
          const coords: [number, number][] = [];
          for (const pt of ring) {
            if (Array.isArray(pt) && pt.length >= 2) {
              const lng = parseFloat(pt[0]);
              const lat = parseFloat(pt[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                coords.push([lat, lng]);
              }
            }
          }
          if (coords.length >= 3) return coords;
        }
      }
    }
  } catch (e) {
    // Not GeoJSON, proceed to KML
  }

  try {
    const match = fileText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (match && match[1]) {
      const rawCoords = match[1].trim().split(/\s+/);
      const coords: [number, number][] = [];
      for (const item of rawCoords) {
        const parts = item.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            coords.push([lat, lng]);
          }
        }
      }
      return coords;
    }
  } catch (e) {
    console.warn('Gagal mem-parsing file KML:', e);
  }
  return [];
}
