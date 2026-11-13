import { PkkDasaWismaItem } from '../types';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const PKK_DASA_WISMA_COLLECTION = 'pkk_dasa_wisma';
export const PKK_DASA_WISMA_STORAGE_KEY = 'sikepling_pkk_dasa_wisma_v1';
export const PKK_DASA_WISMA_CHANNEL = 'sikepling_pkk_dasa_wisma_chan';

let memoryDasaWisma: PkkDasaWismaItem[] = [];

/**
 * Normalize Dasa Wisma records between Firestore native schema
 * (namaKetuaDawis, jumlahLakiLaki, jumlahPerempuan, punyaJambanSehat, punyaSpal, punyaToga, etc.)
 * and legacy UI field aliases.
 */
export const normalizeDasaWismaItem = (raw: any, docId?: string): PkkDasaWismaItem => {
  const lingkNum =
    Number(raw?.lingkunganNomor) ||
    (raw?.lingkunganNama ? parseInt(String(raw.lingkunganNama).replace(/\D/g, ''), 10) || 1 : 1);

  const ketua = raw?.namaKetuaDawis || raw?.namaKetua || '';
  const laki = Number(raw?.jumlahLakiLaki ?? raw?.jumlahJiwaLaki ?? 0);
  const perempuan = Number(raw?.jumlahPerempuan ?? raw?.jumlahJiwaPerempuan ?? 0);
  const jamban = Number(raw?.punyaJambanSehat ?? raw?.jumlahJambanSehat ?? 0);
  const spal = Number(raw?.punyaSpal ?? raw?.jumlahSpal ?? 0);
  const toga = Number(raw?.punyaToga ?? raw?.jumlahPekaranganManfaat ?? 0);
  const kkList = Array.isArray(raw?.daftarKkAnggota) ? raw.daftarKkAnggota : [];
  const totalKk = Number(raw?.jumlahKk ?? (kkList.length > 0 ? kkList.length : 0));
  const totalJiwa = Number(raw?.jumlahJiwa ?? (laki + perempuan));

  return {
    ...raw,
    id: raw?.id || docId || `dawis_${Date.now()}`,
    namaKelompok: raw?.namaKelompok || 'Kelompok Dasa Wisma',
    lingkunganNomor: lingkNum,
    lingkunganNama: raw?.lingkunganNama || `Lingkungan ${lingkNum}`,
    namaKetuaDawis: ketua,
    namaKetua: ketua,
    namaKrt: raw?.namaKrt || '',
    teleponKetua: raw?.teleponKetua || '',
    rtRw: raw?.rtRw || '',
    createdByName: raw?.createdByName || '',
    daftarKkAnggota: kkList,
    jumlahKk: totalKk,
    jumlahJiwa: totalJiwa,
    jumlahLakiLaki: laki,
    jumlahPerempuan: perempuan,
    jumlahJiwaLaki: laki,
    jumlahJiwaPerempuan: perempuan,
    jumlahIbuHamil: Number(raw?.jumlahIbuHamil ?? 0),
    jumlahIbuMenyusui: Number(raw?.jumlahIbuMenyusui ?? 0),
    jumlahIbuNifas: Number(raw?.jumlahIbuNifas ?? 0),
    jumlahBalita: Number(raw?.jumlahBalita ?? 0),
    jumlahLansia: Number(raw?.jumlahLansia ?? 0),
    jumlahPus: Number(raw?.jumlahPus ?? 0),
    jumlahWus: Number(raw?.jumlahWus ?? 0),
    jumlahAkseptorKb: Number(raw?.jumlahAkseptorKb ?? 0),
    jumlahButaAksara: Number(raw?.jumlahButaAksara ?? 0),
    punyaJambanSehat: jamban,
    punyaSpal: spal,
    punyaToga: toga,
    jumlahJambanSehat: jamban,
    jumlahSpal: spal,
    jumlahPekaranganManfaat: toga,
    kriteriaRumah: raw?.kriteriaRumah || 'Layak Huni',
    sumberAirBersih: raw?.sumberAirBersih || 'PDAM / Air Perpipaan',
    sumberAirMinum: raw?.sumberAirMinum || 'Depot Isi Ulang',
    makananPokok: raw?.makananPokok || 'Beras',
    stikerP4k: raw?.stikerP4k || 'Tidak Menempel',
    kegiatanPosyandu: Boolean(raw?.kegiatanPosyandu),
    kegiatanUp2kKoperasi: Boolean(raw?.kegiatanUp2kKoperasi),
    industriPangan: Boolean(raw?.industriPangan),
    industriSandang: Boolean(raw?.industriSandang),
    ptpToga: Boolean(raw?.ptpToga),
    ptpWarungHidup: Boolean(raw?.ptpWarungHidup),
    ptpPeternakan: Boolean(raw?.ptpPeternakan),
    ptpPerikanan: Boolean(raw?.ptpPerikanan),
    kegiatanUtama: raw?.kegiatanUtama || '',
    catatan: raw?.catatan || '',
    updatedAt: raw?.updatedAt || raw?.createdAt || new Date().toISOString(),
  };
};

export const getLocalDasaWismaList = (): PkkDasaWismaItem[] => {
  const stored = safeGetLocalStorage<PkkDasaWismaItem[]>(PKK_DASA_WISMA_STORAGE_KEY, []);
  if (stored && Array.isArray(stored)) {
    const normalized = stored.map((it) => normalizeDasaWismaItem(it));
    memoryDasaWisma = normalized;
    return normalized;
  }
  return memoryDasaWisma;
};

export const setLocalDasaWismaList = (items: PkkDasaWismaItem[]): void => {
  const normalized = items.map((it) => normalizeDasaWismaItem(it));
  memoryDasaWisma = normalized;
  safeSetLocalStorage(PKK_DASA_WISMA_STORAGE_KEY, JSON.stringify(normalized));
};

export const fetchDasaWismaFromFirestore = async (): Promise<PkkDasaWismaItem[]> => {
  if (!db) return getLocalDasaWismaList();
  try {
    const colRef = collection(db, PKK_DASA_WISMA_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch {
      snap = await getDocs(colRef);
    }
    const remoteItems: PkkDasaWismaItem[] = [];
    snap.forEach((d) => {
      remoteItems.push(normalizeDasaWismaItem(d.data(), d.id));
    });
    remoteItems.sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
    );
    if (remoteItems.length > 0 || !snap.metadata.fromCache) {
      setLocalDasaWismaList(remoteItems);
    }
    return remoteItems;
  } catch (e) {
    console.warn('Gagal fetch Dasa Wisma dari Firestore:', e);
    return getLocalDasaWismaList();
  }
};

export const saveDasaWisma = async (item: PkkDasaWismaItem): Promise<void> => {
  const normalized = normalizeDasaWismaItem(item);
  const current = getLocalDasaWismaList();
  const updated = [normalized, ...current.filter((x) => x.id !== normalized.id)];
  setLocalDasaWismaList(updated);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'DASA_WISMA_UPDATED', item: normalized });
      bc.close();
    } catch {}
  }

  if (db) {
    try {
      const cleaned = cleanFirestoreData(normalized);
      await setDoc(doc(db, PKK_DASA_WISMA_COLLECTION, normalized.id), cleaned, { merge: true });
    } catch (e) {
      console.warn('Gagal simpan Dasa Wisma ke Firestore:', e);
    }
  }
};

export const deleteDasaWisma = async (id: string): Promise<void> => {
  const current = getLocalDasaWismaList();
  const updated = current.filter((x) => x.id !== id);
  setLocalDasaWismaList(updated);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.postMessage({ type: 'DASA_WISMA_DELETED', id });
      bc.close();
    } catch {}
  }

  if (db) {
    try {
      await deleteDoc(doc(db, PKK_DASA_WISMA_COLLECTION, id));
    } catch (e) {
      console.warn('Gagal hapus Dasa Wisma di Firestore:', e);
    }
  }
};

export const subscribeDasaWisma = (
  callback: (items: PkkDasaWismaItem[]) => void
): (() => void) => {
  let isActive = true;
  let receivedServerSnapshot = false;

  // 1. Initial callback with cached items
  callback(getLocalDasaWismaList());

  // 2. BroadcastChannel listener
  let bc: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(PKK_DASA_WISMA_CHANNEL);
      bc.onmessage = () => {
        if (isActive) callback(getLocalDasaWismaList());
      };
    } catch {}
  }

  // 3. Firestore listener + explicit server fetch fallback
  let unsubFirestore: Unsubscribe | undefined;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, PKK_DASA_WISMA_COLLECTION),
        (snapshot) => {
          if (!isActive) return;
          const remoteItems: PkkDasaWismaItem[] = [];
          snapshot.forEach((d) => {
            remoteItems.push(normalizeDasaWismaItem(d.data(), d.id));
          });
          remoteItems.sort((a, b) =>
            (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
          );
          if (!snapshot.metadata.fromCache) {
            receivedServerSnapshot = true;
          }
          if (remoteItems.length > 0 || !snapshot.metadata.fromCache) {
            setLocalDasaWismaList(remoteItems);
            callback(remoteItems);
          }
        },
        (err) => {
          console.warn('Firestore Dasa Wisma error, mencoba getDocs fallback:', err);
          fetchDasaWismaFromFirestore().then((items) => {
            if (isActive && items.length > 0) callback(items);
          });
        }
      );

      // Parallel getDocsFromServer ensures cold-start / iframe environments immediately populate from Firestore
      fetchDasaWismaFromFirestore().then((items) => {
        if (isActive && !receivedServerSnapshot && items.length > 0) {
          callback(items);
        }
      });
    } catch (e) {
      console.warn('Error subscribing to Dasa Wisma:', e);
    }
  }

  return () => {
    isActive = false;
    if (bc) {
      bc.close();
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
};
