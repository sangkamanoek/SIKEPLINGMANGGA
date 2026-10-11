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
import { db, handleFirestoreError, OperationType } from './firebase';
import { RealisasiPembangunan, LaporanHarianItem, JenisPembangunanType } from '../types';
import { cleanFirestoreData } from './firestoreService';

export const PEMBANGUNAN_COLLECTION = 'realisasi_pembangunan';
export const PEMBANGUNAN_STORAGE_KEY = 'sikepling_realisasi_pembangunan_v1';

/**
 * Save single pembangunan record to Firestore
 */
export async function savePembangunanToFirestore(item: RealisasiPembangunan): Promise<boolean> {
  if (!item || !item.id) return false;
  try {
    const docRef = doc(db, PEMBANGUNAN_COLLECTION, item.id);
    const cleaned = cleanFirestoreData({
      ...item,
      updatedAt: new Date().toISOString(),
    });

    // Guard: Prevent exceeding Firestore 1MB document limit
    try {
      const jsonStr = JSON.stringify(cleaned);
      const byteSize = new Blob([jsonStr]).size;
      if (byteSize > 1000000) {
        console.warn(`[Firestore Pembangunan] Warning: Item ${item.id} payload is ${byteSize} bytes (near 1MB limit). Trimming redundant photo arrays.`);
        delete cleaned.fotoSebelumList;
        delete cleaned.fotoProsesList;
        delete cleaned.fotoSesudahList;
      }
    } catch {}

    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore Pembangunan] Successfully saved item ${item.id} (${item.namaProyek}) to Firestore.`);
    return true;
  } catch (error) {
    console.error(`[Firestore Pembangunan Error] Failed saving ${item.id} to Firestore:`, error);
    try {
      handleFirestoreError(error, OperationType.WRITE, PEMBANGUNAN_COLLECTION);
    } catch {}
    return false;
  }
}

/**
 * Delete single pembangunan record from Firestore
 */
export async function deletePembangunanFromFirestore(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const docRef = doc(db, PEMBANGUNAN_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PEMBANGUNAN_COLLECTION);
    return false;
  }
}

/**
 * Fetch all pembangunan records from Firestore
 */
export async function fetchPembangunanFromFirestore(): Promise<RealisasiPembangunan[]> {
  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    const snapshot = await getDocs(colRef);
    const items: RealisasiPembangunan[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as RealisasiPembangunan;
      if (data && data.id) {
        items.push(data);
      }
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PEMBANGUNAN_COLLECTION);
    return [];
  }
}

/**
 * Subscribe to real-time pembangunan updates in Firestore
 */
export function subscribeToPembangunan(
  callback: (items: RealisasiPembangunan[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  try {
    const colRef = collection(db, PEMBANGUNAN_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: RealisasiPembangunan[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as RealisasiPembangunan;
          if (data && data.id) {
            items.push(data);
          }
        });
        callback(items);
      },
      (error) => {
        console.warn('Realtime pembangunan subscription warning:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Failed to attach pembangunan listener:', err);
    return () => {};
  }
}

/**
 * Save to both Server API buffer and Firebase Firestore
 */
export async function savePembangunanToServer(item: RealisasiPembangunan): Promise<boolean> {
  if (!item || !item.id) return false;

  const firestorePromise = savePembangunanToFirestore(item).catch(() => false);
  const serverPromise = (async () => {
    try {
      const res = await fetch('/api/pembangunan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch {
      return false;
    }
  })();

  const [fsOk, srvOk] = await Promise.all([firestorePromise, serverPromise]);
  console.log(`[savePembangunanToServer] Sync result for ${item.id}: Firestore=${fsOk}, ServerBuffer=${srvOk}`);
  return Boolean(fsOk || srvOk);
}

/**
 * Delete from both Server API buffer and Firebase Firestore
 */
export async function deletePembangunanFromServer(id: string): Promise<boolean> {
  if (!id) return false;

  const firestorePromise = deletePembangunanFromFirestore(id).catch(() => false);
  const serverPromise = (async () => {
    try {
      const res = await fetch(`/api/pembangunan/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  })();

  const [fsOk, srvOk] = await Promise.all([firestorePromise, serverPromise]);
  return Boolean(fsOk || srvOk);
}

/**
 * Batch upload / sync pembangunan records to both Firestore and Server API
 */
export async function batchSyncPembangunan(items: RealisasiPembangunan[]): Promise<boolean> {
  if (!Array.isArray(items) || items.length === 0) return true;

  // 1. Sync to server API
  const serverPromise = (async () => {
    try {
      const res = await fetch('/api/pembangunan/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      return res.ok;
    } catch {
      return false;
    }
  })();

  // 2. Sync to Firestore in chunks of 400
  const firestorePromise = (async () => {
    try {
      for (let i = 0; i < items.length; i += 400) {
        const chunk = items.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((it) => {
          if (it && it.id) {
            const ref = doc(db, PEMBANGUNAN_COLLECTION, it.id);
            batch.set(ref, cleanFirestoreData(it), { merge: true });
          }
        });
        await batch.commit();
      }
      return true;
    } catch (err) {
      console.warn('Batch firestore sync pembangunan notice:', err);
      return false;
    }
  })();

  const [srvOk, fsOk] = await Promise.all([serverPromise, firestorePromise]);
  return Boolean(srvOk || fsOk);
}

/**
 * Fetch all pembangunan items from Server, Firestore, or fallback to Local Storage
 */
export async function fetchPembangunanAll(): Promise<RealisasiPembangunan[]> {
  // 1. Try Server API first
  try {
    const res = await fetch('/api/pembangunan');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Server pembangunan fetch notice:', err);
  }

  // 2. Try Firestore next
  try {
    const fsItems = await fetchPembangunanFromFirestore();
    if (fsItems.length > 0) {
      return fsItems;
    }
  } catch (err) {
    console.warn('Firestore pembangunan fetch notice:', err);
  }

  // 3. Fallback to LocalStorage
  try {
    const local = localStorage.getItem(PEMBANGUNAN_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('LocalStorage pembangunan fetch notice:', err);
  }

  return [];
}

/**
 * Automatically bridges an infrastructure finding from a daily report (FormLaporan Poin 6)
 * into a tracked project/item in Realisasi Pembangunan Infrastruktur
 */
export async function syncInfraReportToPembangunan(report: LaporanHarianItem): Promise<boolean> {
  const kin = report.kinerja;
  if (!kin || (!kin.infrastrukturAdaGiat && !kin.infrastrukturSubjek)) {
    return false;
  }

  const subjek = kin.infrastrukturSubjek || 'Pemantauan Infrastruktur Wilayah';
  const lokasi = kin.infrastrukturLokasi || `Wilayah ${report.jabatan || 'Kelurahan Mangga'}`;
  const subjekLower = subjek.toLowerCase();

  let jenisPembangunan: JenisPembangunanType = 'PERBAIKAN_JALAN';
  let sumberDana = 'Dinas SDABMBK Kota Medan';

  if (subjekLower.includes('drainase') || subjekLower.includes('parit') || subjekLower.includes('saluran')) {
    jenisPembangunan = 'PERBAIKAN_DRAINASE';
    sumberDana = 'Dinas SDABMBK Kota Medan';
  } else if (subjekLower.includes('lampu') || subjekLower.includes('lpju') || subjekLower.includes('penerangan')) {
    jenisPembangunan = 'PERBAIKAN_LAMPU_LPJU';
    sumberDana = 'Dinas Perhubungan (Dishub)';
  } else if (subjekLower.includes('tiang')) {
    jenisPembangunan = 'PENAMBAHAN_TIANG_LPJU';
    sumberDana = 'Dinas Perhubungan (Dishub)';
  } else if (subjekLower.includes('paving') || subjekLower.includes('blok')) {
    jenisPembangunan = 'PEMASANGAN_PAVING_BLOK';
    sumberDana = 'Dinas Perkim';
  }

  // Parse environment number
  let lingkunganNomor = 1;
  const numMatch = (report.jabatan || report.keplingId || '').match(/(\d+)/);
  if (numMatch) {
    lingkunganNomor = parseInt(numMatch[1], 10);
  }

  // Find relevant photo if available
  const infraPhoto =
    (report.dokumentasiFoto || []).find((p) => {
      const cat = (p.kategori || '').toLowerCase();
      const n = (p.name || '').toLowerCase();
      return cat.includes('infra') || n.includes('infra') || cat.includes('jalan') || cat.includes('drainase');
    }) || report.dokumentasiFoto?.[0];

  const newItem: RealisasiPembangunan = {
    id: `infra_${report.id}`,
    lingkunganId: report.keplingId || `kepling_${lingkunganNomor}`,
    lingkunganNomor,
    jenisPembangunan,
    namaProyek: subjek,
    lokasiDetail: lokasi,
    sumberDana,
    statusRealisasi: 'USULAN',
    volumeRealisasi: '1 Titik Lokasi',
    fotoSebelumUrl: infraPhoto?.url || undefined,
    keterangan: `Dilaporkan oleh ${report.namaKepling} (${report.jabatan}) pada tanggal ${report.tanggal}.${
      kin.infrastrukturTitikKoordinat ? ` Titik Koordinat: ${kin.infrastrukturTitikKoordinat}` : ''
    }`,
    createdAt: report.createdAt || new Date().toISOString(),
    createdByName: `${report.namaKepling} (${report.jabatan})`,
  };

  return await savePembangunanToServer(newItem);
}
