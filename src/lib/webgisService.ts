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
    await setDoc(docRef, polygon, { merge: true });
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
      if (Array.isArray(parsed)) {
        const hasJuan = parsed.some(
          (h) =>
            h.id === 'rumah_juan_lingk1' ||
            (h.namaKepalaKeluarga && h.namaKepalaKeluarga.toLowerCase() === 'juan')
        );
        if (!hasJuan && DEFAULT_TITIK_RUMAH.length > 0) {
          const merged = [...DEFAULT_TITIK_RUMAH, ...parsed];
          safeSetLocalStorage(STORAGE_KEY_HOUSES, JSON.stringify(merged));
          return merged;
        }
        return parsed.length > 0 ? parsed : DEFAULT_TITIK_RUMAH;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca titik rumah lokal:', e);
  }
  return DEFAULT_TITIK_RUMAH;
}

export function saveLocalHouses(_houses: TitikRumahBangunan[]): void {
  // Deliberately no-op: Houses are stored online on server and Firestore
}

export async function fetchAllHouses(): Promise<TitikRumahBangunan[]> {
  const map = new Map<string, TitikRumahBangunan>();

  // 1. Fetch from Server API buffer
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

  // 2. Fetch from Firebase Firestore
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
  if (list.length > 0) {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }
  return DEFAULT_TITIK_RUMAH;
}

export async function saveHouseToFirestore(house: TitikRumahBangunan): Promise<boolean> {
  // 1. Save online to Server Buffer
  fetch('/api/webgis/houses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: house }),
  }).catch((err) => {
    console.warn('Notice saving house to server:', err);
  });

  // 2. Save online to Firestore
  try {
    const docRef = doc(db, COLLECTION_HOUSES, house.id);
    await setDoc(docRef, house, { merge: true });
    return true;
  } catch (e) {
    console.warn('Gagal menyimpan titik rumah ke Firestore:', e);
    return false;
  }
}

export async function deleteHouseFromFirestore(houseId: string): Promise<boolean> {
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
    console.warn('Gagal menghapus rumah di Firestore:', e);
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

export function saveLocalRoads(_roads: RuasJalanLingkungan[]): void {
  // Deliberately no-op: Roads are stored online
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
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    await setDoc(docRef, road, { merge: true });
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
    console.warn(e);
  }

  try {
    const u2 = onSnapshot(collection(db, COLLECTION_HOUSES), (snap) => {
      if (!snap.empty) {
        const list: TitikRumahBangunan[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as TitikRumahBangunan), id: d.id }));
        const hasJuan = list.some(
          (h) =>
            h.id === 'rumah_juan_lingk1' ||
            (h.namaKepalaKeluarga && h.namaKepalaKeluarga.toLowerCase() === 'juan')
        );
        if (!hasJuan && DEFAULT_TITIK_RUMAH.length > 0) {
          list.push(...DEFAULT_TITIK_RUMAH);
        }
        onHousesUpdate(list);
      } else if (DEFAULT_TITIK_RUMAH.length > 0) {
        onHousesUpdate(DEFAULT_TITIK_RUMAH);
      }
    });
    unsubList.push(u2);
  } catch (e) {
    console.warn(e);
  }

  try {
    const u3 = onSnapshot(collection(db, COLLECTION_ROADS), (snap) => {
      if (!snap.empty) {
        const list: RuasJalanLingkungan[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as RuasJalanLingkungan), id: d.id }));
        onRoadsUpdate(list);
      }
    });
    unsubList.push(u3);
  } catch (e) {
    console.warn(e);
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
