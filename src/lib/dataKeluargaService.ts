import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DataKeluarga, AnggotaKeluarga, TitikRumahBangunan, AgamaType, HubunganKeluargaType } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { cleanFirestoreData } from './firestoreService';
import { safeSetLocalStorage, safeGetLocalStorage } from './safeStorage';
import { saveHouseToFirestore } from './webgisService';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { shareOrDownloadBlob } from './excelExport';

const COLLECTION_NAME = 'data_keluarga';
const STORAGE_KEY_DATA_KELUARGA = 'sikepling_database_keluarga_v1';

// ==========================================
// PRIVACY & MASKING HELPERS
// ==========================================

/**
 * Formats NIK or KK number with privacy masking (last 5 digits replaced with *****)
 * Example: 1271190811740002 -> 12711908117*****
 */
export function maskNik(nik: string | undefined | null): string {
  if (!nik) return '-';
  const str = String(nik).trim();
  if (str.length === 0) return '-';
  if (str.length <= 5) return '*****';
  return str.slice(0, str.length - 5) + '*****';
}

// ==========================================
// LOCAL STORAGE CACHE HELPERS
// ==========================================

export function getLocalDataKeluarga(): DataKeluarga[] {
  return safeGetLocalStorage<DataKeluarga[]>(STORAGE_KEY_DATA_KELUARGA, []);
}

export function saveLocalDataKeluarga(list: DataKeluarga[]): void {
  try {
    safeSetLocalStorage(STORAGE_KEY_DATA_KELUARGA, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('data-keluarga-updated', { detail: { count: list.length } }));
    }
  } catch (e) {
    console.warn('Gagal menyimpan Data Keluarga ke lokal:', e);
  }
}

// Cross-tab broadcast channel for immediate 0ms sync between tabs
const KELUARGA_BROADCAST_CHANNEL_NAME = 'sikepling_keluarga_sync_channel';
let keluargaBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    keluargaBroadcastChannel = new BroadcastChannel(KELUARGA_BROADCAST_CHANNEL_NAME);
  }
} catch {
  // ignore
}

export function broadcastDataKeluargaChange(item?: DataKeluarga, list?: DataKeluarga[]) {
  try {
    if (keluargaBroadcastChannel) {
      keluargaBroadcastChannel.postMessage({ type: 'UPDATE', item, count: list?.length, timestamp: Date.now() });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('data-keluarga-updated', { detail: { item, list } }));
    }
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// SERVER API BUFFER CLIENT (/api/data-keluarga)
// ----------------------------------------------------

export async function fetchDataKeluargaFromApi(): Promise<DataKeluarga[]> {
  try {
    const res = await fetch(`/api/data-keluarga?_t=${Date.now()}`, {
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
    console.warn('Notice fetching Data Keluarga from /api/data-keluarga:', err);
  }
  return [];
}

export async function saveDataKeluargaToApi(item: DataKeluarga): Promise<boolean> {
  try {
    const res = await fetch('/api/data-keluarga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Notice saving Data Keluarga to /api/data-keluarga:', err);
    return false;
  }
}

export async function batchSaveDataKeluargaToApi(items: DataKeluarga[]): Promise<boolean> {
  try {
    if (!Array.isArray(items) || items.length === 0) return true;
    const res = await fetch('/api/data-keluarga/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Notice batch saving Data Keluarga to /api/data-keluarga:', err);
    return false;
  }
}

export async function deleteDataKeluargaFromApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/data-keluarga/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Notice deleting Data Keluarga from /api/data-keluarga:', err);
    return false;
  }
}

/**
 * Smart merge Data Keluarga: overlays incoming updates on top of base items.
 * Uses updatedAt timestamps to preserve newest changes.
 */
export function smartMergeDataKeluarga(baseList: DataKeluarga[], updates: DataKeluarga[]): DataKeluarga[] {
  if (!Array.isArray(updates) || updates.length === 0) return baseList;
  const map = new Map<string, DataKeluarga>();
  const kkMap = new Map<string, string>();
  const nikMap = new Map<string, string>();

  // 1. Base list
  for (const item of baseList) {
    if (!item || !item.id) continue;
    map.set(item.id, { ...item });
    if (item.nomorKk) kkMap.set(item.nomorKk.replace(/[^0-9]/g, ''), item.id);
    if (item.nikKepalaKeluarga) nikMap.set(item.nikKepalaKeluarga.replace(/[^0-9]/g, ''), item.id);
  }

  // 2. Overlay updates
  for (const update of updates) {
    if (!update || !update.id) continue;
    const cleanKk = (update.nomorKk || '').replace(/[^0-9]/g, '');
    const cleanNik = (update.nikKepalaKeluarga || '').replace(/[^0-9]/g, '');

    let targetId = update.id;
    if (!map.has(targetId)) {
      if (cleanKk && kkMap.has(cleanKk)) targetId = kkMap.get(cleanKk)!;
      else if (cleanNik && nikMap.has(cleanNik)) targetId = nikMap.get(cleanNik)!;
    }

    if (map.has(targetId)) {
      const existing = map.get(targetId)!;
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const updateTime = update.updatedAt ? new Date(update.updatedAt).getTime() : 0;

      if (existingTime > updateTime) {
        map.set(targetId, { ...update, ...existing, id: targetId });
      } else {
        map.set(targetId, { ...existing, ...update, id: targetId });
      }
    } else {
      map.set(update.id, { ...update });
      if (cleanKk) kkMap.set(cleanKk, update.id);
      if (cleanNik) nikMap.set(cleanNik, update.id);
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (a.lingkunganNomor !== b.lingkunganNomor) return a.lingkunganNomor - b.lingkunganNomor;
    return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga);
  });
  return merged;
}

// ==========================================
// FIRESTORE & DUAL-TIER CRUD OPERATIONS
// ==========================================

/**
 * Ultra-fast Real-time listener & Dual-Tier loader for Data Keluarga
 */
export function subscribeDataKeluarga(
  onSuccess: (data: DataKeluarga[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // 1. Instant local load (0ms)
  const local = getLocalDataKeluarga();
  if (local.length > 0) {
    onSuccess(local);
  }

  // 2. Instant Server API buffer fetch (~2ms)
  fetchDataKeluargaFromApi()
    .then((apiItems) => {
      if (apiItems.length > 0) {
        const merged = smartMergeDataKeluarga(getLocalDataKeluarga(), apiItems);
        saveLocalDataKeluarga(merged);
        onSuccess(merged);
      }
    })
    .catch(() => {});

  // 3. Cross-tab Broadcast Channel listener (0ms)
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'UPDATE') {
      const current = getLocalDataKeluarga();
      onSuccess(current);
    }
  };
  if (keluargaBroadcastChannel) {
    keluargaBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  const handleCustomEvent = () => {
    const current = getLocalDataKeluarga();
    onSuccess(current);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('data-keluarga-updated', handleCustomEvent);
  }

  // 4. Cloud Firestore listener in background
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef);

    const unsubFirestore = onSnapshot(
      q,
      (snapshot) => {
        const list: DataKeluarga[] = [];
        snapshot.forEach((docSnap) => {
          const item = { ...(docSnap.data() as DataKeluarga), id: docSnap.id };
          list.push(item);
        });

        if (list.length > 0) {
          list.sort((a, b) => {
            if (a.lingkunganNomor !== b.lingkunganNomor) {
              return a.lingkunganNomor - b.lingkunganNomor;
            }
            return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga);
          });

          const currentLocal = getLocalDataKeluarga();
          const merged = smartMergeDataKeluarga(currentLocal, list);
          saveLocalDataKeluarga(merged);
          onSuccess(merged);
        }
      },
      (error) => {
        console.warn('Firestore onSnapshot data_keluarga error, falling back to local:', error);
        if (onError) onError(error);
        const currentLocal = getLocalDataKeluarga();
        if (currentLocal.length > 0) onSuccess(currentLocal);
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      }
    );

    return () => {
      unsubFirestore();
      if (keluargaBroadcastChannel) {
        keluargaBroadcastChannel.removeEventListener('message', handleBroadcast);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('data-keluarga-updated', handleCustomEvent);
      }
    };
  } catch (err) {
    console.warn('Failed to subscribe data_keluarga:', err);
    const currentLocal = getLocalDataKeluarga();
    onSuccess(currentLocal);
    return () => {};
  }
}

/**
 * Fetch all Data Keluarga with Dual-Tier Server Buffer & Firestore acceleration
 */
export async function fetchAllDataKeluarga(): Promise<DataKeluarga[]> {
  let currentList: DataKeluarga[] = getLocalDataKeluarga();

  // 1. Fetch from Express Server Buffer (/api/data-keluarga) for ~2ms response
  try {
    const apiItems = await fetchDataKeluargaFromApi();
    if (apiItems.length > 0) {
      currentList = smartMergeDataKeluarga(currentList, apiItems);
      saveLocalDataKeluarga(currentList);
    }
  } catch (err) {
    console.warn('Notice reading Data Keluarga server buffer:', err);
  }

  // 2. Fetch from Firebase Firestore
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list: DataKeluarga[] = [];
      snap.forEach((d) => {
        const item = { ...(d.data() as DataKeluarga), id: d.id };
        list.push(item);
      });

      if (list.length > 0) {
        currentList = smartMergeDataKeluarga(currentList, list);
        saveLocalDataKeluarga(currentList);
        // Sync back to API buffer asynchronously
        batchSaveDataKeluargaToApi(currentList).catch(() => {});
        return currentList;
      }
    }
  } catch (error) {
    console.warn('Notice fetchAllDataKeluarga Firestore, using local fallback:', error);
    try {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    } catch {}
  }

  if (currentList.length > 0) return currentList;

  // Fallback to initial seeds if completely empty
  const defaultSeeds = getInitialSeedDataKeluarga();
  saveLocalDataKeluarga(defaultSeeds);
  return defaultSeeds;
}

/**
 * Save or update single Data Keluarga document
 */
export async function saveDataKeluargaToFirestore(
  keluarga: DataKeluarga,
  syncWithWebgisHouse: boolean = true
): Promise<boolean> {
  const current = getLocalDataKeluarga();
  const index = current.findIndex(
    (k) =>
      k.id === keluarga.id ||
      (k.nomorKk && keluarga.nomorKk && k.nomorKk === keluarga.nomorKk) ||
      (k.nikKepalaKeluarga && keluarga.nikKepalaKeluarga && k.nikKepalaKeluarga === keluarga.nikKepalaKeluarga)
  );

  let updatedList: DataKeluarga[];
  let mergedKeluarga: DataKeluarga = { ...keluarga };

  if (index >= 0) {
    const existing = current[index];
    const existingMembers = existing.anggotaKeluarga || [];
    const incomingMembers = keluarga.anggotaKeluarga || [];

    const mergedMembers: AnggotaKeluarga[] = [...existingMembers];
    for (const inc of incomingMembers) {
      const mIdx = mergedMembers.findIndex(
        (m) =>
          (m.nik && inc.nik && m.nik === inc.nik) ||
          (m.nama && inc.nama && m.nama.toLowerCase().trim() === inc.nama.toLowerCase().trim())
      );
      if (mIdx >= 0) {
        mergedMembers[mIdx] = { ...mergedMembers[mIdx], ...inc };
      } else {
        mergedMembers.push(inc);
      }
    }

    mergedKeluarga = {
      ...existing,
      ...keluarga,
      id: existing.id || keluarga.id,
      nomorKk: keluarga.nomorKk || existing.nomorKk,
      nikKepalaKeluarga: keluarga.nikKepalaKeluarga || existing.nikKepalaKeluarga,
      namaKepalaKeluarga: keluarga.namaKepalaKeluarga || existing.namaKepalaKeluarga,
      desilKesejahteraan: keluarga.desilKesejahteraan || existing.desilKesejahteraan || '',
      jambanKeluarga: keluarga.jambanKeluarga || existing.jambanKeluarga || '',
      sumberAirMinum: keluarga.sumberAirMinum || existing.sumberAirMinum || '',
      sumberAirBersih: keluarga.sumberAirBersih || existing.sumberAirBersih || '',
      pembuanganSampahRumah: keluarga.pembuanganSampahRumah || existing.pembuanganSampahRumah || '',
      statusStuntingRentan: keluarga.statusStuntingRentan || existing.statusStuntingRentan || '',
      penerimaBansos: keluarga.penerimaBansos || existing.penerimaBansos,
      bantuanDiterima:
        keluarga.bantuanDiterima && keluarga.bantuanDiterima.length > 0
          ? keluarga.bantuanDiterima
          : existing.bantuanDiterima,
      anggotaKeluarga: mergedMembers,
      jumlahAnggotaKeluarga: mergedMembers.length,
      jumlahLakiLaki: mergedMembers.filter((m) => m.jenisKelamin === 'L').length,
      jumlahPerempuan: mergedMembers.filter((m) => m.jenisKelamin === 'P').length,
      updatedAt: new Date().toISOString(),
    };

    updatedList = [...current];
    updatedList[index] = mergedKeluarga;
  } else {
    updatedList = [keluarga, ...current];
  }

  // 1. Instant 0ms local persistence & Broadcast
  saveLocalDataKeluarga(updatedList);
  broadcastDataKeluargaChange(mergedKeluarga, updatedList);

  // 2. Fast Save to Server API Buffer (/api/data-keluarga)
  saveDataKeluargaToApi(mergedKeluarga).catch(() => {});

  // 3. Firestore Write in background / parallel
  try {
    const docId = mergedKeluarga.id || `kk_${mergedKeluarga.nomorKk || Date.now()}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const cleaned = cleanFirestoreData({ ...mergedKeluarga, id: docId });
    await setDoc(docRef, cleaned, { merge: true });

    // Non-blocking background sync to WebGIS House Point
    if (syncWithWebgisHouse) {
      let lat = mergedKeluarga.titikKoordinat?.lat;
      let lng = mergedKeluarga.titikKoordinat?.lng;

      if (!lat || !lng) {
        const lk = mergedKeluarga.lingkunganNomor || 1;
        const seedStr = (mergedKeluarga.nomorKk || mergedKeluarga.nikKepalaKeluarga || mergedKeluarga.namaKepalaKeluarga || '');
        let hash = 0;
        for (let idx = 0; idx < seedStr.length; idx++) {
          hash = (hash * 31 + seedStr.charCodeAt(idx)) & 0xffffffff;
        }
        const jitterLat = (((Math.abs(hash) % 1000) - 500) / 1000) * 0.0035;
        const jitterLng = ((((Math.abs(hash) * 7) % 1000) - 500) / 1000) * 0.0035;
        lat = 3.514234 + ((lk - 12) * 0.0008) + jitterLat;
        lng = 98.633175 + (((lk % 6) - 3) * 0.0008) + jitterLng;
      }

      const houseId = mergedKeluarga.housePointId || `house_kk_${mergedKeluarga.id}`;
      const webgisItem: TitikRumahBangunan = {
        id: houseId,
        lingkunganId: mergedKeluarga.lingkunganId,
        lingkunganNomor: mergedKeluarga.lingkunganNomor,
        namaJalan: mergedKeluarga.namaJalan,
        nomorRumah: mergedKeluarga.nomorRumah || '',
        namaKepalaKeluarga: mergedKeluarga.namaKepalaKeluarga,
        nikKk: mergedKeluarga.nikKepalaKeluarga,
        isKkMangga: mergedKeluarga.statusDomisili.includes('Mangga'),
        lat,
        lng,
        jumlahJiwa: mergedKeluarga.jumlahAnggotaKeluarga,
        jumlahLakiLaki: mergedKeluarga.jumlahLakiLaki,
        jumlahPerempuan: mergedKeluarga.jumlahPerempuan,
        jumlahLansia: mergedKeluarga.jumlahLansia,
        jumlahAnak: mergedKeluarga.jumlahBalita + mergedKeluarga.jumlahUsiaSekolah,
        pekerjaanKk: mergedKeluarga.pekerjaanUtamaKepalaKeluarga || 'Wiraswasta',
        desilKesejahteraan: mergedKeluarga.desilKesejahteraan,
        penerimaBansos: mergedKeluarga.penerimaBansos,
        jenisBansos: mergedKeluarga.bantuanDiterima,
        kategoriRentan: mergedKeluarga.kategoriRentan && mergedKeluarga.kategoriRentan.length > 0,
        jambanKeluarga: mergedKeluarga.jambanKeluarga,
        tempatAkhirTinja: mergedKeluarga.tempatAkhirTinja,
        sumberAirMinum: mergedKeluarga.sumberAirMinum,
        sumberAirBersih: mergedKeluarga.sumberAirBersih,
        pembuanganSampahRumah: mergedKeluarga.pembuanganSampahRumah,
        statusStuntingRentan: mergedKeluarga.statusStuntingRentan,
        statusWrs: mergedKeluarga.statusWrs || 'AKTIF',
        nopPbb: mergedKeluarga.nopPbb,
        statusPbb: mergedKeluarga.statusPbb,
        kategoriBangunan: 'RUMAH_TINGGAL',
        createdAt: mergedKeluarga.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: mergedKeluarga.createdByName || 'Database Keluarga',
      };
      saveHouseToFirestore(webgisItem).catch((e) => console.warn('Sync house error:', e));
    }

    return true;
  } catch (error) {
    console.warn('Gagal menyimpan Data Keluarga ke Firestore, tersimpan di lokal:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${keluarga.id}`);
    } catch {}
    return false;
  }
}

/**
 * Delete Data Keluarga document
 */
export async function deleteDataKeluargaFromFirestore(id: string): Promise<boolean> {
  const current = getLocalDataKeluarga();
  const updated = current.filter((k) => k.id !== id);
  
  // 1. Instant 0ms local persistence & Broadcast
  saveLocalDataKeluarga(updated);
  broadcastDataKeluargaChange(undefined, updated);

  // 2. Fast delete from Server API Buffer
  deleteDataKeluargaFromApi(id).catch(() => {});

  // 3. Firestore deletion
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.warn('Gagal menghapus Data Keluarga di Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    } catch {}
    return false;
  }
}

export async function wipeAllFirestoreDataKeluarga(): Promise<{ success: boolean; message: string }> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return { success: true, message: 'Data sudah kosong.' };

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();

    // Clear local storage and server buffer
    localStorage.removeItem(STORAGE_KEY_DATA_KELUARGA);
    await fetch('/api/data-keluarga/wipe', { method: 'POST' }).catch(() => {});
    
    // Broadcast change
    broadcastDataKeluargaChange(undefined, []);

    return { success: true, message: 'Seluruh data keluarga berhasil dihapus!' };
  } catch (error: any) {
    console.error('Fatal error in wipeAllFirestoreDataKeluarga:', error);
    return { success: false, message: error?.message || 'Gagal mereset Firebase Firestore' };
  }
}

// ==========================================
// EXPORT DATA KELUARGA TO EXCEL (.XLSX)
// ==========================================

export async function exportDataKeluargaToExcel(
  records: DataKeluarga[],
  titleLabel: string = 'Kelurahan Mangga',
  shareMode: boolean = false
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kelurahan Mangga - Medan Tuntungan';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // SHEET 1: REKAP DATA KARTU KELUARGA (KK)
  // -------------------------------------------------------------
  const wsKk = workbook.addWorksheet('Buku Data Keluarga (KK)', {
    views: [{ showGridLines: true }],
  });

  // Title rows
  const r1 = wsKk.addRow(['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN']);
  const r2 = wsKk.addRow(['KELURAHAN MANGGA']);
  const r3 = wsKk.addRow(['BUKU INDUK DATABASE DATA KELUARGA (KARTU KELUARGA)']);
  const r4 = wsKk.addRow([
    `Kriteria: ${titleLabel}`,
    '',
    `Total Terdaftar: ${records.length} Kartu Keluarga`,
    '',
    `Total Jiwa: ${records.reduce((s, k) => s + (k.jumlahAnggotaKeluarga || 0), 0)} Jiwa`,
  ]);
  wsKk.addRow([]);

  r1.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  r2.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  r3.font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
  r4.font = { italic: true, size: 10, color: { argb: 'FF475569' } };

  // Header row KK
  const headerKk = wsKk.addRow([
    'NO',
    'NOMOR KK (16 DIGIT)',
    'NIK KEPALA KELUARGA',
    'NAMA KEPALA KELUARGA',
    'AGAMA',
    'NO. TELEPON / WA',
    'LINGKUNGAN',
    'NAMA JALAN / GANG',
    'NO. RUMAH',
    'STATUS DOMISILI',
    'JUMLAH JIWA',
    'L',
    'P',
    'LANSIA (60+)',
    'BALITA (0-5)',
    'TINGKAT KESEJAHTERAAN (DESIL)',
    'PENERIMA BANSOS',
    'BANTUAN DITERIMA',
    'JAMBAN KELUARGA',
    'SUMBER AIR MINUM',
    'SUMBER AIR BERSIH',
    'PEMBUANGAN SAMPAH',
    'STATUS RISIKO STUNTING',
    'NOP PBB',
    'STATUS PBB',
    'TANGGAL PENDATAAN',
  ]);

  headerKk.height = 28;
  headerKk.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Navy blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // Widths
  wsKk.getColumn(1).width = 5;
  wsKk.getColumn(2).width = 20;
  wsKk.getColumn(3).width = 20;
  wsKk.getColumn(4).width = 25;
  wsKk.getColumn(5).width = 16;
  wsKk.getColumn(6).width = 15;
  wsKk.getColumn(7).width = 28;
  wsKk.getColumn(8).width = 16;
  wsKk.getColumn(9).width = 22;
  wsKk.getColumn(10).width = 12;
  wsKk.getColumn(11).width = 6;
  wsKk.getColumn(12).width = 6;
  wsKk.getColumn(13).width = 12;
  wsKk.getColumn(14).width = 12;
  wsKk.getColumn(15).width = 22;
  wsKk.getColumn(16).width = 15;
  wsKk.getColumn(17).width = 28;
  wsKk.getColumn(18).width = 25;
  wsKk.getColumn(19).width = 24;
  wsKk.getColumn(20).width = 22;
  wsKk.getColumn(21).width = 22;
  wsKk.getColumn(22).width = 22;
  wsKk.getColumn(23).width = 20;
  wsKk.getColumn(24).width = 14;
  wsKk.getColumn(25).width = 16;

  // Add KK Rows
  records.forEach((item, idx) => {
    const row = wsKk.addRow([
      idx + 1,
      item.nomorKk,
      item.nikKepalaKeluarga,
      item.namaKepalaKeluarga,
      item.agama || (item.anggotaKeluarga?.[0]?.agama) || 'Islam',
      item.telepon || '-',
      item.lingkunganNama,
      item.namaJalan,
      item.nomorRumah || '-',
      item.statusDomisili,
      item.jumlahAnggotaKeluarga,
      item.jumlahLakiLaki,
      item.jumlahPerempuan,
      item.jumlahLansia,
      item.jumlahBalita,
      item.desilKesejahteraan,
      item.penerimaBansos ? 'Ya (Penerima)' : 'Bukan Penerima',
      (item.bantuanDiterima || []).join(', ') || '-',
      item.jambanKeluarga,
      item.sumberAirMinum,
      item.sumberAirBersih,
      item.pembuanganSampahRumah,
      item.statusStuntingRentan,
      item.nopPbb || '-',
      item.statusPbb || '-',
      item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '-',
    ]);

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if ([1, 2, 3, 5, 6, 8, 10, 11, 12, 13, 14, 16, 23, 24, 25].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      cell.font = { size: 9 };
    });
  });

  // -------------------------------------------------------------
  // SHEET 2: DAFTAR ANGGOTA KELUARGA (DETAIL JIWA)
  // -------------------------------------------------------------
  const wsAnggota = workbook.addWorksheet('Daftar Anggota Keluarga', {
    views: [{ showGridLines: true }],
  });

  wsAnggota.addRow(['DAFTAR SELURUH ANGGOTA KELUARGA - KELURAHAN MANGGA']);
  wsAnggota.addRow([]);

  const headerAnggota = wsAnggota.addRow([
    'NO',
    'NOMOR KK',
    'NAMA KEPALA KELUARGA',
    'LINGKUNGAN',
    'NIK ANGGOTA',
    'NAMA LENGKAP',
    'HUBUNGAN KELUARGA',
    'JENIS KELAMIN',
    'USIA (TH)',
    'AGAMA',
    'PENDIDIKAN TERAKHIR',
    'PEKERJAAN',
    'STATUS KAWIN',
    'KTP-EL / IKD',
    'AKTA LAHIR',
    'BPJS KESEHATAN',
    'BPJS KETENAGAKERJAAN',
    'CATATAN KHUSUS',
  ]);

  headerAnggota.height = 26;
  headerAnggota.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF047857' }, // Emerald green
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  wsAnggota.getColumn(1).width = 5;
  wsAnggota.getColumn(2).width = 20;
  wsAnggota.getColumn(3).width = 24;
  wsAnggota.getColumn(4).width = 15;
  wsAnggota.getColumn(5).width = 20;
  wsAnggota.getColumn(6).width = 24;
  wsAnggota.getColumn(7).width = 18;
  wsAnggota.getColumn(8).width = 12;
  wsAnggota.getColumn(9).width = 10;
  wsAnggota.getColumn(10).width = 14;
  wsAnggota.getColumn(11).width = 18;
  wsAnggota.getColumn(12).width = 20;
  wsAnggota.getColumn(13).width = 14;
  wsAnggota.getColumn(14).width = 14;
  wsAnggota.getColumn(15).width = 12;
  wsAnggota.getColumn(16).width = 24;
  wsAnggota.getColumn(17).width = 16;
  wsAnggota.getColumn(18).width = 20;

  let anggotaCounter = 1;
  records.forEach((kk) => {
    (kk.anggotaKeluarga || []).forEach((ang) => {
      const row = wsAnggota.addRow([
        anggotaCounter++,
        kk.nomorKk,
        kk.namaKepalaKeluarga,
        kk.lingkunganNama,
        ang.nik,
        ang.nama,
        ang.hubunganKeluarga,
        ang.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan',
        ang.usia,
        ang.agama,
        ang.pendidikanTerakhir,
        ang.pekerjaan,
        ang.statusPerkawinan,
        ang.memilikiKtpIkd ? 'Sudah Ada' : 'Belum Ada',
        ang.memilikiAktaKelahiran ? 'Sudah Ada' : 'Belum Ada',
        ang.statusBpjsKesehatan,
        ang.terdaftarBpjsKetenagakerjaan ? 'Terdaftar BPJS TK' : 'Belum Terdaftar',
        ang.catatanKhusus || '-',
      ]);

      row.height = 19;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if ([1, 2, 4, 5, 8, 9, 13, 14, 15, 17].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        cell.font = { size: 9 };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Database_Data_Keluarga_Kelurahan_Mangga_${dateStr}.xlsx`;
  const shareTitle = `Database Data Keluarga Kelurahan Mangga`;
  const shareText = `Berikut rekapitulasi database data keluarga, tingkat kesejahteraan (desil), bansos, dan sanitasi Kelurahan Mangga.`;

  return shareOrDownloadBlob(blob, fileName, shareTitle, shareText, shareMode);
}

// ==========================================
// IMPORT DATA KELUARGA (TEMPLATE, PARSER, BATCH)
// ==========================================

export interface ImportParsedResult {
  items: DataKeluarga[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  errors: { row: number; nomorKk?: string; message: string }[];
}

/**
 * Downloads a standardized Excel template (.xlsx) for Data Keluarga import
 */
export async function downloadImportTemplateExcel(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kelurahan Mangga';
  
  const ws = workbook.addWorksheet('Template Import KK', { views: [{ showGridLines: true }] });

  // Add header title & instruction
  const r1 = ws.addRow(['TEMPLATE FORMAT IMPORT DATABASE DATA KELUARGA (KK) - KELURAHAN MANGGA']);
  const r2 = ws.addRow(['Petunjuk: Isikan data keluarga sesuai kolom di bawah. JANGAN mengubah nama kolom di baris 4!']);
  ws.addRow([]);

  r1.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  r2.font = { italic: true, size: 10, color: { argb: 'FF0284C7' } };

  const headerRow = ws.addRow([
    'NOMOR_KK',                     // 1 (16 digit)
    'NIK_KEPALA_KELUARGA',         // 2 (16 digit)
    'NAMA_KEPALA_KELUARGA',        // 3
    'AGAMA',                       // 4 (Islam / Kristen Protestan / Katolik / Hindu / Buddha / Konghucu)
    'TELEPON_WA',                  // 5
    'LINGKUNGAN_NOMOR',            // 6 (1 - 24)
    'NAMA_JALAN',                  // 7
    'NOMOR_RUMAH',                 // 8
    'STATUS_DOMISILI',             // 9
    'DESIL_KESEJAHTERAAN',         // 10
    'BANTUAN_DITERIMA',            // 11 (koma pisah, misal: PKH Medan Makmur, BPNT, PBI-JK)
    'JAMBAN_KELUARGA',             // 12
    'SUMBER_AIR_MINUM',            // 13
    'SUMBER_AIR_BERSIH',           // 14
    'PEMBUANGAN_SAMPAH',           // 15
    'STATUS_STUNTING',             // 16
    'NOP_PBB',                     // 17
    'STATUS_PBB',                  // 18 (LUNAS / BELUM_LUNAS)
    'JUMLAH_JIWA',                 // 19
    'JUMLAH_LAKI_LAKI',            // 20
    'JUMLAH_PEREMPUAN',            // 21
    'JUMLAH_LANSIA',               // 22
    'JUMLAH_BALITA',               // 23
  ]);

  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // Example Row 1
  ws.addRow([
    '1271010115080001',
    '1271011005820001',
    'Budi Santoso',
    'Islam',
    '081260012345',
    '1',
    'Jl. Bunga Ncole No. 45',
    '45',
    'KK Kelurahan Mangga (KTP/KK Setempat)',
    'Desil 1 (Sangat Miskin)',
    'PKH Medan Makmur, BPNT / Sembako, PBI-JK (BPJS Gratis)',
    'Jamban Sendiri (Leher Angsa / Septik SNI)',
    'PDAM / Air Perpipaan',
    'PDAM Tirtanadi',
    'Diangkut Petugas / WRS',
    'Bebas Risiko Stunting',
    '12.71.010.001.001-0001.0',
    'LUNAS',
    '4',
    '2',
    '2',
    '0',
    '1'
  ]);

  // Example Row 2
  ws.addRow([
    '1271010115080002',
    '1271011005820002',
    'Marthin Tarigan',
    '081260054321',
    '2',
    'Jl. Flamboyan Raya Gg. Mawar',
    '12',
    '002',
    '003',
    'KK Kelurahan Mangga (KTP/KK Setempat)',
    'Desil 2 (Miskin)',
    'PKH Medan Makmur, PBI-JK (BPJS Gratis)',
    'Jamban Sendiri (Leher Angsa / Septik SNI)',
    'Depot Isi Ulang',
    'PDAM Tirtanadi',
    'Diangkut Petugas / WRS',
    'Ada Balita / Baduta Berisiko Stunting',
    '12.71.010.002.001-0005.0',
    'BELUM_LUNAS',
    '5',
    '3',
    '2',
    '1',
    '1'
  ]);

  // Widths
  for (let c = 1; c <= 24; c++) {
    ws.getColumn(c).width = 20;
  }
  ws.getColumn(3).width = 26;
  ws.getColumn(6).width = 28;
  ws.getColumn(12).width = 36;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await shareOrDownloadBlob(blob, 'TEMPLATE_IMPORT_DATA_KELUARGA_MANGGA.xlsx', 'Template Import Data Keluarga', 'Berkas template Excel resmi import data KK.');
}

/**
 * Extracts pure digits from any cell value, safely handling BigInt, Numbers, and exponential notation (e.g. 1.20103E+15)
 */
function extractCellDigits(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    try {
      return BigInt(Math.round(val)).toString();
    } catch {
      return Number(val).toFixed(0);
    }
  }
  const str = String(val).trim();
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(str)) {
    try {
      return BigInt(Math.round(Number(str))).toString();
    } catch {}
  }
  return str.replace(/\D/g, '');
}

/**
 * Normalizes header string to clean uppercase alphanumeric representation
 */
function normalizeHeaderStr(s: any): string {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Parses uploaded Excel (.xlsx, .xls) or CSV file into DataKeluarga records with validation
 */
export async function parseDataKeluargaFile(file: File): Promise<ImportParsedResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert sheet to json matrix with raw: false to preserve formatted cell text
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

  if (!rows || rows.length === 0) {
    throw new Error('Berkas Excel / CSV kosong.');
  }

  // Find header row (usually contains NOMOR_KK, KK, NIK, or NAMA, and must NOT contain actual 16-digit NIK/KK)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowCells = rows[i] || [];
    // If the row contains actual 16-digit numbers in cells, it is data, not a header!
    const hasDataDigits = rowCells.some((c: any) => extractCellDigits(c).length === 16);
    if (hasDataDigits) {
      continue;
    }
    const rowStr = rowCells.map((c: any) => normalizeHeaderStr(c)).join(' ');
    if (
      rowStr.includes('NOMORKK') ||
      rowStr.includes('NOKK') ||
      rowStr.includes('KARTUKELUARGA') ||
      rowStr.includes('NIKKEPALA') ||
      rowStr.includes('NAMAKEPALA') ||
      rowStr.includes('NAMALENGKAP') ||
      rowStr.includes('NAMALGKP')
    ) {
      headerIndex = i;
      break;
    }
  }

  // If no explicit header row was detected, process from index 0
  const rawHeaders = headerIndex !== -1 ? rows[headerIndex] || [] : [];
  const normalizedHeaders = rawHeaders.map((h: any) => normalizeHeaderStr(h));

  const getColIdx = (keywords: string[]) => {
    const normKeywords = keywords.map((k) => normalizeHeaderStr(k));
    return normalizedHeaders.findIndex((h) => normKeywords.some((k) => h.includes(k)));
  };

  const idxKk = getColIdx([
    'NOMOR_KK', 'NOMOR KK', 'NO KK', 'NO. KK', 'NO_KK', 'NOKK', 'NO.KK',
    'KARTU KELUARGA', 'KARTU_KELUARGA', 'NO KARTU KELUARGA', 'NO. KARTU KELUARGA',
    'NO_KARTU_KELUARGA', 'NOMOR_KARTU_KELUARGA', 'NOMOR KARTU KELUARGA'
  ]);
  const idxNik = getColIdx([
    'NIK', 'NO_NIK', 'NO. NIK', 'NO.NIK', 'NONIK', 'NOMOR INDUK KEPENDUDUKAN',
    'NOMOR_INDUK_KEPENDUDUKAN', 'NIK_KEPALA', 'NIK KEPALA', 'NIK_WARGA', 'NIK WARGA',
    'KTP', 'NO_KTP', 'NO. KTP'
  ]);
  const idxNama = getColIdx([
    'NAMA', 'NAMA LENGKAP', 'NAMA_LENGKAP', 'NAMA_LGKP', 'NAMALENGKAP',
    'NAMA KEPALA KELUARGA', 'NAMA_KEPALA_KELUARGA', 'NAMA_KEPALA', 'NAMA KEPALA', 'WARGA'
  ]);
  const idxHp = getColIdx(['TELEPON', 'WA', 'HP', 'NO. TELP', 'NO_HP', 'TELP']);
  const idxLk = getColIdx(['LINGKUNGAN_NOMOR', 'LINGKUNGAN', 'LK', 'KEPLING', 'DUSUN_LINGKUNGAN', 'DUSUN']);
  const idxJalan = getColIdx(['NAMA_JALAN', 'JALAN', 'ALAMAT', 'ALAMAT_LENGKAP', 'ALAMAT_SEKARANG']);
  const idxNoRumah = getColIdx(['NOMOR_RUMAH', 'NO. RUMAH', 'RUMAH', 'NO_RUMAH']);
  const idxAgama = getColIdx(['AGAMA', 'AGAMA_KEPALA', 'AGAMA KEPALA', 'AGAMA_KK', 'RELIGION']);
  const idxDomisili = getColIdx(['STATUS_DOMISILI', 'DOMISILI']);
  const idxDesil = getColIdx(['DESIL', 'KESEJAHTERAAN', 'DESIL_KESEJAHTERAAN']);
  const idxBansos = getColIdx(['BANTUAN', 'BANSOS', 'PROGRAM_BANSOS']);
  const idxJamban = getColIdx(['JAMBAN', 'SANITASI', 'BAB']);
  const idxAirMinum = getColIdx(['AIR_MINUM', 'AIR MINUM', 'SUMBER_AIR_MINUM']);
  const idxAirBersih = getColIdx(['AIR_BERSIH', 'AIR BERSIH', 'SUMBER_AIR_BERSIH']);
  const idxSampah = getColIdx(['SAMPAH', 'PEMBUANGAN', 'PEMBUANGAN_SAMPAH']);
  const idxStunting = getColIdx(['STUNTING', 'RISIKO', 'STATUS_STUNTING']);
  const idxNop = getColIdx(['NOP_PBB', 'NOP', 'NOP_SPPT']);
  const idxPbb = getColIdx(['STATUS_PBB', 'PBB', 'PAJAK']);
  const idxJiwa = getColIdx(['JUMLAH_JIWA', 'JIWA', 'ANGGOTA']);
  const idxL = getColIdx(['JUMLAH_LAKI', 'LAKI', 'L']);
  const idxP = getColIdx(['JUMLAH_PEREMPUAN', 'PEREMPUAN', 'P']);
  const idxLansia = getColIdx(['LANSIA']);
  const idxBalita = getColIdx(['BALITA']);

  const idxHubungan = getColIdx([
    'HUBUNGAN_KELUARGA', 'HUBUNGAN KELUARGA', 'HUBUNGAN', 'STATUS_HUBUNGAN',
    'STATUS HUBUNGAN', 'SHDK', 'STATUS DALAM KELUARGA', 'STATUS_DALAM_KELUARGA'
  ]);
  const idxKelamin = getColIdx([
    'JENIS_KELAMIN', 'JENIS KELAMIN', 'KELAMIN', 'JK', 'SEX', 'GENDER'
  ]);

  // Frequency-based detection for No. KK vs NIK:
  // In family data with multiple members per row, No KK repeats across multiple rows,
  // whereas NIK is unique for each person.
  let detectedKkCol = idxKk;
  let detectedNikCol = idxNik;

  if (detectedKkCol === -1 || detectedNikCol === -1 || detectedKkCol === detectedNikCol) {
    const col16Counts: Record<number, { total: number; duplicates: number; seen: Set<string> }> = {};
    const sampleLimit = Math.min(rows.length, 250);
    for (let r = headerIndex + 1; r < sampleLimit; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const digits = extractCellDigits(row[c]);
        if (digits.length === 16) {
          if (!col16Counts[c]) {
            col16Counts[c] = { total: 0, duplicates: 0, seen: new Set() };
          }
          col16Counts[c].total++;
          if (col16Counts[c].seen.has(digits)) {
            col16Counts[c].duplicates++;
          } else {
            col16Counts[c].seen.add(digits);
          }
        }
      }
    }

    const candidateCols = Object.keys(col16Counts).map(Number);
    if (candidateCols.length >= 2) {
      // Sort: column with more duplicates is the NOMOR KK; column with fewer/0 duplicates is NIK
      candidateCols.sort((a, b) => col16Counts[b].duplicates - col16Counts[a].duplicates);
      if (detectedKkCol === -1 || detectedKkCol === detectedNikCol) detectedKkCol = candidateCols[0];
      if (detectedNikCol === -1 || detectedNikCol === detectedKkCol) detectedNikCol = candidateCols[1];
    } else if (candidateCols.length === 1) {
      if (detectedKkCol === -1) detectedKkCol = candidateCols[0];
      if (detectedNikCol === -1) detectedNikCol = candidateCols[0];
    }
  }

  const familyMap = new Map<string, DataKeluarga>();
  const errors: { row: number; nomorKk?: string; message: string }[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || String(c).trim() === '')) continue;

    let rawKk = detectedKkCol !== -1 ? extractCellDigits(row[detectedKkCol]) : '';
    let rawNik = detectedNikCol !== -1 ? extractCellDigits(row[detectedNikCol]) : '';
    let rawNama = idxNama !== -1 ? String(row[idxNama] || '').trim() : '';
    let rawAlamat = idxJalan !== -1 ? String(row[idxJalan] || '').trim() : '';
    let rawLk = idxLk !== -1 ? String(row[idxLk] || '').trim() : '';
    let rawAgama = idxAgama !== -1 ? String(row[idxAgama] || '').trim() : '';
    let rawHubungan: HubunganKeluargaType = 'Kepala Keluarga';
    let hasExplicitHubungan = false;
    let rawGender: 'L' | 'P' = 'L';
    let hasExplicitGender = false;

    // Detect all 16-digit numbers in row (if column index resolution wasn't exact)
    if (rawKk.length !== 16 || rawNik.length !== 16) {
      const digits16List: string[] = [];
      for (const cell of row) {
        const d = extractCellDigits(cell);
        if (d.length === 16 && !digits16List.includes(d)) {
          digits16List.push(d);
        }
      }
      if (digits16List.length >= 2) {
        if (rawKk.length !== 16) rawKk = digits16List[0];
        if (rawNik.length !== 16) rawNik = digits16List[1];
      } else if (digits16List.length === 1) {
        if (rawKk.length !== 16 && rawNik.length !== 16) {
          rawKk = digits16List[0];
          rawNik = digits16List[0];
        } else if (rawKk.length !== 16) {
          rawKk = rawNik || digits16List[0];
        } else if (rawNik.length !== 16) {
          rawNik = rawKk || digits16List[0];
        }
      }
    }

    // 2. Detect Hubungan Keluarga from cell or column
    if (idxHubungan !== -1 && row[idxHubungan]) {
      const hStr = String(row[idxHubungan]).trim().toLowerCase();
      if (/kepala/i.test(hStr)) {
        rawHubungan = 'Kepala Keluarga';
        hasExplicitHubungan = true;
      } else if (/istri/i.test(hStr)) {
        rawHubungan = 'Istri';
        hasExplicitHubungan = true;
      } else if (/anak/i.test(hStr)) {
        rawHubungan = 'Anak';
        hasExplicitHubungan = true;
      } else if (/orang\s*tua|ayah|ibu/i.test(hStr)) {
        rawHubungan = 'Orang Tua';
        hasExplicitHubungan = true;
      } else if (/mertua/i.test(hStr)) {
        rawHubungan = 'Mertua';
        hasExplicitHubungan = true;
      } else if (/famili|cucu|menantu|lainnya/i.test(hStr)) {
        rawHubungan = 'Famili Lain';
        hasExplicitHubungan = true;
      }
    }

    // 3. Smart Scan Across Row Cells for Lingkungan, Agama, Alamat, Hubungan, Gender, & Name
    for (const cell of row) {
      const val = String(cell || '').trim();
      if (!val) continue;

      // Hubungan Keluarga detection in cell
      if (!hasExplicitHubungan) {
        if (/kepala\s*keluarga/i.test(val)) {
          rawHubungan = 'Kepala Keluarga';
          hasExplicitHubungan = true;
        } else if (/^istri$/i.test(val) || /\bistri\b/i.test(val)) {
          rawHubungan = 'Istri';
          hasExplicitHubungan = true;
        } else if (/^suami$/i.test(val) || /\bsuami\b/i.test(val)) {
          rawHubungan = 'Kepala Keluarga';
          hasExplicitHubungan = true;
        } else if (/^anak$/i.test(val) || /\banak\b/i.test(val)) {
          rawHubungan = 'Anak';
          hasExplicitHubungan = true;
        } else if (/orang\s*tua|^ayah$|^ibu$/i.test(val)) {
          rawHubungan = 'Orang Tua';
          hasExplicitHubungan = true;
        } else if (/mertua/i.test(val)) {
          rawHubungan = 'Mertua';
          hasExplicitHubungan = true;
        } else if (/famili|cucu|menantu|lainnya/i.test(val)) {
          rawHubungan = 'Famili Lain';
          hasExplicitHubungan = true;
        }
      }

      // Gender detection in cell
      if (!hasExplicitGender) {
        if (/^p$|^perempuan$/i.test(val)) {
          rawGender = 'P';
          hasExplicitGender = true;
        } else if (/^l$|^laki-laki$|^pria$/i.test(val)) {
          rawGender = 'L';
          hasExplicitGender = true;
        }
      }

      // Lingkungan label (Kota Medan: Lingkungan 1-24, Kepling, tanpa RT/RW)
      if (!rawLk && /lingkungan|kepling|lk[-_\s]*\d+/i.test(val)) {
        rawLk = val;
      }

      // Agama
      if (!rawAgama && /^(islam|kristen|katolik|hindu|buddha|budha|konghucu)/i.test(val)) {
        if (/katolik/i.test(val)) rawAgama = 'Katolik';
        else if (/kristen/i.test(val)) rawAgama = 'Kristen Protestan';
        else if (/hindu/i.test(val)) rawAgama = 'Hindu';
        else if (/buddh?a/i.test(val)) rawAgama = 'Buddha';
        else if (/konghucu/i.test(val)) rawAgama = 'Konghucu';
        else rawAgama = 'Islam';
      }

      // Alamat / Jalan
      if (!rawAlamat && /\b(gg|jalan|jl|gang|no|lk|medan|tembakau|ncole)\b/i.test(val) && val.length > 5) {
        rawAlamat = val;
      }

      // Person Name (letters only, no long numbers, not keywords)
      if (
        !rawNama &&
        val.length >= 3 &&
        /^[a-zA-Z\s'.,]+$/.test(val) &&
        !/^(islam|kristen|katolik|hindu|buddha|konghucu|kepala\s*keluarga|istri|anak|suami|orang\s*tua|mertua|famili|famili\s*lain|laki-laki|perempuan|l|p)$/i.test(
          val
        ) &&
        !/\b(jl|jalan|gang|gg)\b/i.test(val)
      ) {
        rawNama = val;
      }
    }

    // Gender deduction from NIK if not explicitly stated
    if (!hasExplicitGender) {
      if (rawHubungan === 'Istri') {
        rawGender = 'P';
      } else if (rawNik && rawNik.length === 16) {
        const birthDay = parseInt(rawNik.substring(6, 8), 10);
        if (!isNaN(birthDay) && birthDay > 40 && birthDay <= 71) {
          rawGender = 'P';
        } else {
          rawGender = 'L';
        }
      }
    }

    // Fallbacks
    if (!rawKk && rawNik) rawKk = rawNik;
    if (!rawNik && rawKk) rawNik = rawKk;
    if (!rawKk && rawNama) rawKk = `127107${Date.now().toString().slice(-10)}`;

    if (!rawKk && !rawNama) {
      continue;
    }

    if (!rawNama) {
      if (rawNik) {
        rawNama = `Warga (${maskNik(rawNik)})`;
      } else {
        errors.push({ row: i + 1, nomorKk: rawKk, message: 'Nama Anggota / Kepala Keluarga wajib diisi.' });
        continue;
      }
    }

    // Resolve Lingkungan (Kota Medan: Lingkungan 1 s/d 24 tanpa RT/RW)
    let lkNum = 1;
    const lkMatch = (rawLk || (idxLk !== -1 ? String(row[idxLk] || '') : '')).match(/\d+/);
    if (lkMatch) {
      lkNum = Math.min(24, Math.max(1, parseInt(lkMatch[0], 10)));
    }
    const kepling = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === lkNum) || KEPLING_ACCOUNTS[0];

    const rawBansosStr = idxBansos !== -1 ? String(row[idxBansos] || '').trim() : '';
    const bansosList = rawBansosStr
      ? rawBansosStr.split(/[,;/]/).map((s) => s.trim()).filter(Boolean)
      : [];

    let finalAgama = rawAgama || (idxAgama !== -1 && row[idxAgama] ? String(row[idxAgama]).trim() : 'Islam');
    if (/katolik/i.test(finalAgama)) finalAgama = 'Katolik';
    else if (/kristen/i.test(finalAgama)) finalAgama = 'Kristen Protestan';
    else if (/hindu/i.test(finalAgama)) finalAgama = 'Hindu';
    else if (/buddh?a/i.test(finalAgama)) finalAgama = 'Buddha';
    else if (/konghucu/i.test(finalAgama)) finalAgama = 'Konghucu';
    else finalAgama = 'Islam';

    // Construct Member Record
    const member: AnggotaKeluarga = {
      id: `ang_${rawNik || rawKk}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nik: rawNik || `${rawKk}0001`,
      nama: rawNama,
      hubunganKeluarga: rawHubungan,
      jenisKelamin: rawGender,
      tempatLahir: 'Medan',
      tanggalLahir: '1985-01-01',
      usia: rawGender === 'P' ? 38 : 42,
      agama: finalAgama as AgamaType,
      pendidikanTerakhir: 'SMA/SMK/Sederajat',
      pekerjaan:
        rawHubungan === 'Kepala Keluarga'
          ? 'Wiraswasta'
          : rawHubungan === 'Istri'
          ? 'Mengurus Rumah Tangga'
          : 'Pelajar/Mahasiswa',
      statusPerkawinan: rawHubungan === 'Kepala Keluarga' || rawHubungan === 'Istri' ? 'Kawin' : 'Belum Kawin',
      memilikiKtpIkd: true,
      memilikiAktaKelahiran: true,
      statusBpjsKesehatan: bansosList.length > 0 ? 'PBI-JK (Bansos APBD/APBN)' : 'Mandiri (Bayar Sendiri)',
      terdaftarBpjsKetenagakerjaan: rawHubungan === 'Kepala Keluarga',
    };

    // Check if this No. KK is already in our grouped map
    const existingFamily = familyMap.get(rawKk);

    if (!existingFamily) {
      // First person encountered for this No. KK
      const item: DataKeluarga = {
        id: `kk_${rawKk}`,
        nomorKk: rawKk,
        nikKepalaKeluarga: rawHubungan === 'Kepala Keluarga' || !hasExplicitHubungan ? rawNik : rawNik,
        namaKepalaKeluarga: rawNama,
        telepon: idxHp !== -1 ? String(row[idxHp] || '').trim() : '',
        lingkunganId: kepling.id,
        lingkunganNomor: lkNum,
        lingkunganNama: kepling.lingkungan,
        namaJalan: rawAlamat || (idxJalan !== -1 && String(row[idxJalan]).trim() ? String(row[idxJalan]).trim() : 'Jl. Bunga Ncole'),
        nomorRumah: idxNoRumah !== -1 ? String(row[idxNoRumah] || '').trim() : '',
        agama: finalAgama,
        alamatLengkap: rawAlamat
          ? `${rawAlamat}, ${kepling.lingkungan}, Kelurahan Mangga`
          : `${idxJalan !== -1 && row[idxJalan] ? row[idxJalan] : 'Jl. Bunga Ncole'}, ${kepling.lingkungan}, Kelurahan Mangga`,
        statusDomisili:
          idxDomisili !== -1
            ? String(row[idxDomisili] || '').trim() || 'KK Kelurahan Mangga (KTP/KK Setempat)'
            : 'KK Kelurahan Mangga (KTP/KK Setempat)',
        jumlahAnggotaKeluarga: 1,
        jumlahLakiLaki: rawGender === 'L' ? 1 : 0,
        jumlahPerempuan: rawGender === 'P' ? 1 : 0,
        jumlahBalita: 0,
        jumlahUsiaSekolah: 0,
        jumlahUsiaProduktif: 1,
        jumlahLansia: 0,
        pekerjaanUtamaKepalaKeluarga: rawHubungan === 'Kepala Keluarga' ? 'Wiraswasta' : '',
        penghasilanRataRata: '',
        desilKesejahteraan: idxDesil !== -1 ? String(row[idxDesil] || '').trim() : '',
        penerimaBansos: bansosList.length > 0,
        bantuanDiterima: bansosList,
        kategoriRentan: bansosList.length > 0 ? ['Keluarga Rentan'] : [],
        jambanKeluarga: idxJamban !== -1 ? String(row[idxJamban] || '').trim() : '',
        tempatAkhirTinja: '',
        sumberAirMinum: idxAirMinum !== -1 ? String(row[idxAirMinum] || '').trim() : '',
        sumberAirBersih: idxAirBersih !== -1 ? String(row[idxAirBersih] || '').trim() : '',
        pembuanganSampahRumah: idxSampah !== -1 ? String(row[idxSampah] || '').trim() : '',
        statusStuntingRentan: idxStunting !== -1 ? String(row[idxStunting] || '').trim() : '',
        statusKepemilikanRumah: '',
        dayaListrik: '',
        nopPbb: idxNop !== -1 ? String(row[idxNop] || '').trim() : '',
        statusPbb:
          idxPbb !== -1 ? (String(row[idxPbb]).toUpperCase().includes('LUNAS') ? 'LUNAS' : 'BELUM_LUNAS') : 'LUNAS',
        statusWrs: 'AKTIF',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: 'Import Excel / Teks',
        anggotaKeluarga: [member],
      };
      familyMap.set(rawKk, item);
    } else {
      // Family card already exists in this import batch! Add this person as a member!
      const alreadyInList = existingFamily.anggotaKeluarga.some(
        (m) =>
          (m.nik && member.nik && m.nik === member.nik) ||
          (m.nama && member.nama && m.nama.toLowerCase().trim() === member.nama.toLowerCase().trim())
      );
      if (!alreadyInList) {
        existingFamily.anggotaKeluarga.push(member);
        existingFamily.jumlahAnggotaKeluarga = existingFamily.anggotaKeluarga.length;
        if (member.jenisKelamin === 'L') existingFamily.jumlahLakiLaki += 1;
        if (member.jenisKelamin === 'P') existingFamily.jumlahPerempuan += 1;
      }
      // If this row is explicitly KEPALA KELUARGA, set family head info
      if (rawHubungan === 'Kepala Keluarga') {
        existingFamily.namaKepalaKeluarga = rawNama;
        existingFamily.nikKepalaKeluarga = rawNik;
      }
      // Update street address if currently default
      if (rawAlamat && (!existingFamily.namaJalan || existingFamily.namaJalan === 'Jl. Bunga Ncole')) {
        existingFamily.namaJalan = rawAlamat;
        existingFamily.alamatLengkap = `${rawAlamat}, ${existingFamily.lingkunganNama}, Kelurahan Mangga`;
      }
    }
  }

  const parsedItems = Array.from(familyMap.values());

  return {
    items: parsedItems,
    totalRows: rows.length - (headerIndex + 1),
    validCount: parsedItems.length,
    invalidCount: errors.length,
    errors,
  };
}

/**
 * Parses raw text lines (e.g. pasted tab-separated, comma-separated, pipe-separated, or document blocks) into DataKeluarga records
 */
export async function parseDataKeluargaText(rawText: string): Promise<ImportParsedResult> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Teks yang dimasukkan kosong.');
  }

  // Check if text is formatted as Key-Value pairs or freeform document blocks
  const isKeyValueOrDocument =
    /(?:nik|nama|alamat|lingkungan|agama|kk|kepling)[\s]*[:=]/i.test(trimmed) ||
    /DATA\s*BASE\s*KELUARGA/i.test(trimmed);

  if (isKeyValueOrDocument) {
    // Intelligent Multi-Block Parser
    let blocks = trimmed.split(/\n\s*\n+/).filter((b) => b.trim().length > 0);
    const allNikMatches = [...trimmed.matchAll(/\b(\d{16})\b/g)];

    // If there are multiple 16-digit NIKs but only 1 block, split by lines containing 16-digit NIK
    if (blocks.length === 1 && allNikMatches.length > 1) {
      const subLines = trimmed.split(/\r?\n/);
      const reconstructed: string[] = [];
      let currentChunk: string[] = [];
      for (const line of subLines) {
        if (/\b\d{16}\b/.test(line) && currentChunk.length > 0) {
          reconstructed.push(currentChunk.join('\n'));
          currentChunk = [line];
        } else {
          currentChunk.push(line);
        }
      }
      if (currentChunk.length > 0) reconstructed.push(currentChunk.join('\n'));
      blocks = reconstructed;
    }

    const parsedItems: DataKeluarga[] = [];
    const errors: { row: number; nomorKk?: string; message: string }[] = [];

    blocks.forEach((block, idx) => {
      // 1. Extract 16-digit NIK
      const nikMatch = block.match(/\b(\d{16})\b/);
      const rawNik = nikMatch ? nikMatch[1] : '';

      // 2. Extract Nama
      let rawNama = '';
      const namaMatch = block.match(/(?:nama|nama\s*kepala|kepala\s*keluarga)[\s]*[:=]\s*([^\n\r,;]+)/i);
      if (namaMatch) {
        rawNama = namaMatch[1].trim();
      } else {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/DATA\s*BASE|KELURAHAN|MANGGA|REPUBLIK|PEMERINTAH|KARTU/i.test(line)) continue;
          if (/\b\d{16}\b/.test(line)) {
            // Check if there is a name next to the NIK
            const clean = line.replace(/\b\d{16}\b/, '').replace(/[^\w\s'.,]/g, '').trim();
            if (clean.length >= 3 && !/yang saya entri|adalah nik|bukan no/i.test(clean)) {
              rawNama = clean;
              break;
            }
            continue;
          }
          if (/^[a-zA-Z\s'.,]{3,50}$/.test(line) && !/^(islam|kristen|katolik|hindu|buddha|konghucu)$/i.test(line)) {
            rawNama = line;
            break;
          }
        }
      }

      if (!rawNama && rawNik) {
        rawNama = `Kepala Keluarga (${maskNik(rawNik)})`;
      }

      // 3. Extract Lingkungan (Kota Medan: 1–24 tanpa RT/RW)
      let lkNum = 1;
      const lkMatch =
        block.match(/(?:lingkungan|lk|kepling)[\s.:_-]*(\d+)/i) ||
        block.match(/\b(?:lingkungan|lk)\s*([IVXLCDM\d]+)/i);
      if (lkMatch) {
        const num = parseInt(lkMatch[1], 10);
        if (!isNaN(num)) {
          lkNum = Math.min(24, Math.max(1, num));
        }
      }
      const kepling = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === lkNum) || KEPLING_ACCOUNTS[0];

      // 4. Extract Alamat
      let rawAlamat = '';
      const alamatMatch = block.match(/(?:alamat|jalan|jl|gang|gg)[\s]*[:=]\s*([^\n\r]+)/i);
      if (alamatMatch) {
        rawAlamat = alamatMatch[1].trim();
      } else {
        const addrLine = block.split(/\r?\n/).find((l) => /\b(jl|jalan|gg|gang|komplek|no\.)\b/i.test(l));
        if (addrLine) rawAlamat = addrLine.trim();
      }

      // 5. Extract Agama
      let rawAgama: AgamaType = 'Islam';
      const agamaMatch = block.match(/(?:agama)[\s]*[:=]\s*([^\n\r,;]+)/i);
      const testAgamaStr = agamaMatch ? agamaMatch[1] : block;
      if (/katolik/i.test(testAgamaStr)) rawAgama = 'Katolik';
      else if (/kristen/i.test(testAgamaStr)) rawAgama = 'Kristen Protestan';
      else if (/hindu/i.test(testAgamaStr)) rawAgama = 'Hindu';
      else if (/buddh?a/i.test(testAgamaStr)) rawAgama = 'Buddha';
      else if (/konghucu/i.test(testAgamaStr)) rawAgama = 'Konghucu';
      else if (/islam/i.test(testAgamaStr)) rawAgama = 'Islam';

      if (!rawNik && !rawNama) {
        errors.push({ row: idx + 1, message: 'Tidak ditemukan NIK 16 digit atau Nama pada blok data.' });
        return;
      }

      const effectiveNik = rawNik || `127107${Date.now().toString().slice(-10)}`;
      const effectiveKk = effectiveNik;

      const item: DataKeluarga = {
        id: `kk_${effectiveKk}`,
        nomorKk: effectiveKk,
        nikKepalaKeluarga: effectiveNik,
        namaKepalaKeluarga: rawNama || 'Warga Kelurahan Mangga',
        telepon: '',
        lingkunganId: kepling.id,
        lingkunganNomor: lkNum,
        lingkunganNama: kepling.lingkungan,
        namaJalan: rawAlamat || 'Jl. Bunga Ncole',
        nomorRumah: '',
        agama: rawAgama,
        alamatLengkap: rawAlamat
          ? `${rawAlamat}, ${kepling.lingkungan}, Kelurahan Mangga`
          : `Jl. Bunga Ncole, ${kepling.lingkungan}, Kelurahan Mangga`,
        statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
        jumlahAnggotaKeluarga: 4,
        jumlahLakiLaki: 2,
        jumlahPerempuan: 2,
        jumlahBalita: 0,
        jumlahUsiaSekolah: 1,
        jumlahUsiaProduktif: 2,
        jumlahLansia: 0,
        pekerjaanUtamaKepalaKeluarga: '',
        penghasilanRataRata: '',
        desilKesejahteraan: '',
        penerimaBansos: false,
        bantuanDiterima: [],
        kategoriRentan: [],
        jambanKeluarga: '',
        tempatAkhirTinja: '',
        sumberAirMinum: '',
        sumberAirBersih: '',
        pembuanganSampahRumah: '',
        statusStuntingRentan: '',
        statusKepemilikanRumah: '',
        dayaListrik: '',
        nopPbb: '',
        statusPbb: 'LUNAS',
        statusWrs: 'AKTIF',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: 'Smart Text Parser',
        anggotaKeluarga: [
          {
            id: `ang_${effectiveKk}_1`,
            nik: effectiveNik,
            nama: rawNama || 'Warga Kelurahan Mangga',
            hubunganKeluarga: 'Kepala Keluarga',
            jenisKelamin: 'L',
            tempatLahir: 'Medan',
            tanggalLahir: '1985-01-01',
            usia: 41,
            agama: rawAgama,
            pendidikanTerakhir: 'SMA/SMK/Sederajat',
            pekerjaan: 'Wiraswasta',
            statusPerkawinan: 'Kawin',
            memilikiKtpIkd: true,
            memilikiAktaKelahiran: true,
            statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
            terdaftarBpjsKetenagakerjaan: true,
          }
        ]
      };

      parsedItems.push(item);
    });

    if (parsedItems.length > 0) {
      return {
        items: parsedItems,
        totalRows: blocks.length,
        validCount: parsedItems.length,
        invalidCount: errors.length,
        errors,
      };
    }
  }

  // Standard line-based parsing (Tab, Semicolon, Comma, Pipe, or Space-delimited NIK/KK lines)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = lines.map((line) => {
    if (line.includes('\t')) return line.split('\t').map((c) => c.trim()).filter(Boolean);
    if (line.includes('|')) return line.split('|').map((c) => c.trim()).filter(Boolean);
    if (line.includes(';')) return line.split(';').map((c) => c.trim()).filter(Boolean);
    if (line.includes(',')) return line.split(',').map((c) => c.trim()).filter(Boolean);

    // Smart space-separated parser for lines containing 16-digit NIK / KK:
    // Pattern 1: JON MARIHOT SINAGA 1271190811740002 .JL. COKLAT X PERUM COKLAT PERMAI BLOK C-2 LINGKUNGAN 24
    // Pattern 2: DAMENI MENDROFA 1201030605090043 1201035908730001 KEPALA KELUARGA JL. TEMBAKAU RAYA NO.35
    const matches16 = [...line.matchAll(/\b\d{16}\b/g)];
    if (matches16.length >= 2) {
      // 2 16-digit numbers (1st = No. KK, 2nd = NIK)
      const firstMatch = matches16[0];
      const secondMatch = matches16[1];
      const name = line.substring(0, firstMatch.index).trim();
      const kk = firstMatch[0];
      const nik = secondMatch[0];
      const afterNik = line.substring(secondMatch.index! + 16).trim();

      // Check if Hubungan Keluarga is immediately after NIK
      const hubMatch = afterNik.match(
        /^(kepala\s*keluarga|istri|suami|anak|orang\s*tua|mertua|famili\s*lain|famili|cucu|menantu|lainnya)\b/i
      );
      let hubungan = '';
      let rest = afterNik;
      if (hubMatch) {
        hubungan = hubMatch[0];
        rest = afterNik.substring(hubMatch[0].length).trim();
      }

      // Check if Lingkungan is in rest
      const lkMatch = rest.match(/(?:lingkungan|lk|kepling)[\s.:_-]*(\d+)/i);
      let lkStr = '';
      let alamat = rest;
      if (lkMatch) {
        lkStr = lkMatch[0];
        alamat = rest.replace(lkMatch[0], '').trim();
      }
      // Clean leading dots or dashes from alamat (e.g. ".JL. COKLAT..." -> "JL. COKLAT...")
      alamat = alamat.replace(/^[.\s\-_/]+/, '').trim();

      return [name, kk, nik, hubungan || 'Kepala Keluarga', alamat, lkStr].filter(Boolean);
    } else if (matches16.length === 1) {
      // 1 16-digit number (NIK Kepala Keluarga)
      const match = matches16[0];
      const name = line.substring(0, match.index).trim();
      const nik = match[0];
      const after = line.substring(match.index! + 16).trim();

      // Check if Lingkungan is in after
      const lkMatch = after.match(/(?:lingkungan|lk|kepling)[\s.:_-]*(\d+)/i);
      let lkStr = '';
      let alamat = after;
      if (lkMatch) {
        lkStr = lkMatch[0];
        alamat = after.replace(lkMatch[0], '').trim();
      }
      // Clean leading dots or dashes from alamat (e.g. ".JL. COKLAT..." -> "JL. COKLAT...")
      alamat = alamat.replace(/^[.\s\-_/]+/, '').trim();

      return [name, nik, alamat, lkStr].filter(Boolean);
    }

    return [line];
  });

  // Create a synthetic XLSX sheet buffer and use parseDataKeluargaFile
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const file = new File([buf], 'pasted_data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  return parseDataKeluargaFile(file);
}

/**
 * Normalizes street names into clean, grouped root names
 * E.g. "JL NILAM 02 NO 5 PERUMNAS" -> "JL NILAM 02"
 * E.g. "JL. FLAMBOYAN RAYA BLOK C NO 12" -> "JL FLAMBOYAN RAYA"
 * E.g. "GG. MELATI NO. 14 LK. 1" -> "GG MELATI"
 */
export function normalizeStreetName(rawAddress?: string): string {
  if (!rawAddress) return 'TIDAK ADA ALAMAT';
  let clean = rawAddress
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common address noise at the end:
  // e.g. "NO 5 PERUMNAS", "NO. 12B", "BLOK A NO 3", "KELURAHAN MANGGA", "LINGKUNGAN I", "LK 1"
  clean = clean.replace(/(\bNO\.?|\bNOMOR|\bBLOK|\bRT|\bRW|\bLK\.?|\bLINGKUNGAN|\bKELURAHAN|\bKECAMATAN|\bMEDAN).*/gi, '').trim();
  clean = clean.replace(/[,.-]+$/, '').trim();

  // Standardize prefixes
  clean = clean.replace(/^JALAN\b/i, 'JL').replace(/^JLN\b/i, 'JL').replace(/^GANG\b/i, 'GG');
  if (!clean.startsWith('JL') && !clean.startsWith('GG') && !clean.startsWith('KOMPLEK') && !clean.startsWith('ASRAMA') && !clean.startsWith('PERUM')) {
    clean = 'JL ' + clean;
  }

  return clean.replace(/\s+/g, ' ').trim() || 'JL UTAMA';
}

export interface LingkunganMoveTarget {
  id: string; // DataKeluarga ID
  lingkunganId: string;
  lingkunganNomor: number;
  lingkunganNama: string;
}

/**
 * Super-fast Batch update Lingkungan for multiple DataKeluarga records
 * Updates local cache instantly and commits in Firestore chunks (400 per batch)
 */
export async function batchUpdateLingkunganDataKeluarga(
  itemsToUpdate: LingkunganMoveTarget[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  if (!itemsToUpdate || itemsToUpdate.length === 0) return { successCount: 0, failCount: 0 };

  const current = getLocalDataKeluarga();
  const updateMap = new Map<string, LingkunganMoveTarget>();
  itemsToUpdate.forEach((item) => updateMap.set(item.id, item));

  const updatedList: DataKeluarga[] = [];
  const modifiedItems: DataKeluarga[] = [];

  for (const kk of current) {
    if (updateMap.has(kk.id)) {
      const target = updateMap.get(kk.id)!;
      const updatedKk: DataKeluarga = {
        ...kk,
        lingkunganId: target.lingkunganId,
        lingkunganNomor: target.lingkunganNomor,
        lingkunganNama: target.lingkunganNama,
        alamatLengkap: `${kk.namaJalan || ''} ${kk.nomorRumah ? `NO. ${kk.nomorRumah}` : ''}, ${target.lingkunganNama.toUpperCase()}, KELURAHAN MANGGA`.replace(/\s+/g, ' ').trim(),
        updatedAt: new Date().toISOString(),
      };
      updatedList.push(updatedKk);
      modifiedItems.push(updatedKk);
    } else {
      updatedList.push(kk);
    }
  }

  // 1. Instant local persistence (LocalStorage + IndexedDB + BroadcastChannel + Server API Buffer)
  saveLocalDataKeluarga(updatedList);
  broadcastDataKeluargaChange(undefined, updatedList);
  batchSaveDataKeluargaToApi(modifiedItems).catch(() => {});

  // 2. Fast chunked Firestore batch writes (400 per batch)
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < modifiedItems.length; i += 400) {
    const chunk = modifiedItems.slice(i, i + 400);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        batch.set(docRef, cleanFirestoreData(item), { merge: true });
      }
      await batch.commit();
      successCount += chunk.length;
    } catch (err) {
      console.warn('Batch write chunk error, fallbacking to per-doc save:', err);
      for (const item of chunk) {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        await setDoc(docRef, cleanFirestoreData(item), { merge: true }).then(() => successCount++).catch(() => failCount++);
      }
    }
    if (onProgress) {
      onProgress(Math.min(i + chunk.length, modifiedItems.length), modifiedItems.length);
    }
  }

  return { successCount, failCount };
}

/**
 * High-speed Batch saves imported DataKeluarga list to Firestore & Server API & Local Storage
 */
export async function batchSaveDataKeluarga(
  items: DataKeluarga[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  if (!Array.isArray(items) || items.length === 0) return { successCount: 0, failCount: 0 };

  const current = getLocalDataKeluarga();
  const itemMap = new Map<string, DataKeluarga>();
  current.forEach((k) => itemMap.set(k.id, k));

  const now = new Date().toISOString();
  const sanitizedItems: DataKeluarga[] = [];

  for (const item of items) {
    if (!item) continue;
    const cleanKk = (item.nomorKk || '').replace(/[^0-9]/g, '');
    const cleanNik = (item.nikKepalaKeluarga || '').replace(/[^0-9]/g, '');
    const docId = item.id || `kk_${cleanKk || cleanNik || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const readyItem: DataKeluarga = {
      ...item,
      id: docId,
      updatedAt: now,
      createdAt: item.createdAt || now,
    };

    itemMap.set(docId, readyItem);
    sanitizedItems.push(readyItem);
  }

  const updatedList = Array.from(itemMap.values()).sort((a, b) => {
    if (a.lingkunganNomor !== b.lingkunganNomor) return a.lingkunganNomor - b.lingkunganNomor;
    return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga);
  });

  // 1. Instant Local Persistence + 0ms Broadcast + Server API Buffer
  saveLocalDataKeluarga(updatedList);
  broadcastDataKeluargaChange(undefined, updatedList);
  batchSaveDataKeluargaToApi(sanitizedItems).catch(() => {});

  // 2. High-speed chunked Firestore Batch Writes (400 per batch)
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sanitizedItems.length; i += 400) {
    const chunk = sanitizedItems.slice(i, i + 400);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        batch.set(docRef, cleanFirestoreData(item), { merge: true });
      }
      await batch.commit();
      successCount += chunk.length;
    } catch (err) {
      console.warn('Batch write chunk error, fallbacking to per-doc save:', err);
      for (const item of chunk) {
        try {
          const docRef = doc(db, COLLECTION_NAME, item.id);
          await setDoc(docRef, cleanFirestoreData(item), { merge: true });
          successCount++;
        } catch {
          failCount++;
        }
      }
    }
    if (onProgress) {
      onProgress(Math.min(i + chunk.length, sanitizedItems.length), sanitizedItems.length);
    }
  }

  return { successCount, failCount };
}

// ==========================================
// SEED INITIAL DATA KELUARGA (24 LINGKUNGAN)
// ==========================================

export function getInitialSeedDataKeluarga(): DataKeluarga[] {
  return [];
}
