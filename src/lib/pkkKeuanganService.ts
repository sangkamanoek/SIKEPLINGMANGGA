import { TransaksiKeuanganPkk } from '../types';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const KEUANGAN_COLLECTION = 'pkk_keuangan';
export const KEUANGAN_STORAGE_KEY = 'sikepling_pkk_keuangan_v1';
export const KEUANGAN_CHANNEL = 'sikepling_pkk_keuangan_chan';

export const POS_ANGGARAN_LABELS: Record<string, string> = {
  SEKRETARIAT: 'Sekretariat',
  POKJA_I: 'Pokja I',
  POKJA_II: 'Pokja II',
  POKJA_III: 'Pokja III',
  POKJA_IV: 'Pokja IV',
  UP2K: 'UP2K PKK',
  BANTUAN_PEMERINTAH: 'Bantuan Pemerintah',
  IURAN_KAS: 'Iuran Kas',
  SWADAYA_SPONSOR: 'Swadaya / Sponsor',
  LAINNYA: 'Lainnya',
};

export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
};

export const getLocalTransaksiPkk = (): TransaksiKeuanganPkk[] => {
  return safeGetLocalStorage<TransaksiKeuanganPkk[]>(KEUANGAN_STORAGE_KEY, []);
};

function sortKeuanganDesc(items: TransaksiKeuanganPkk[]): TransaksiKeuanganPkk[] {
  return [...items].sort((a, b) =>
    (b.tanggal || b.createdAt || '').localeCompare(a.tanggal || a.createdAt || '')
  );
}

export const fetchPkkKeuanganFromFirestore = async (): Promise<TransaksiKeuanganPkk[]> => {
  if (!db) return getLocalTransaksiPkk();
  try {
    const colRef = collection(db, KEUANGAN_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch {
      snap = await getDocs(colRef);
    }
    const items: TransaksiKeuanganPkk[] = [];
    snap.forEach((d) => {
      const data = d.data() as TransaksiKeuanganPkk;
      items.push({ ...data, id: d.id });
    });
    const sorted = sortKeuanganDesc(items);
    if (sorted.length > 0 || !snap.metadata.fromCache) {
      safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify(sorted));
      return sorted;
    }
  } catch (err) {
    console.warn('[pkkKeuanganService] fetch error:', err);
  }
  return getLocalTransaksiPkk();
};

export const subscribePkkKeuangan = (
  onUpdate: (items: TransaksiKeuanganPkk[]) => void
): (() => void) => {
  const stored = getLocalTransaksiPkk();
  onUpdate(stored);

  let isActive = true;
  let receivedServerSnapshot = false;
  let unsub: Unsubscribe | undefined;

  try {
    if (db) {
      const colRef = collection(db, KEUANGAN_COLLECTION);
      unsub = onSnapshot(
        colRef,
        (snap) => {
          if (!isActive) return;
          const items: TransaksiKeuanganPkk[] = [];
          snap.forEach((d) => {
            const data = d.data() as TransaksiKeuanganPkk;
            items.push({ ...data, id: d.id });
          });
          const sorted = sortKeuanganDesc(items);

          if (!snap.metadata.fromCache) {
            receivedServerSnapshot = true;
            safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify(sorted));
            onUpdate(sorted);
          } else if (sorted.length > 0 && !receivedServerSnapshot) {
            safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify(sorted));
            onUpdate(sorted);
          }
        },
        (err) => {
          console.warn('[pkkKeuanganService] Subscription error:', err);
          fetchPkkKeuanganFromFirestore().then((items) => {
            if (isActive) onUpdate(items);
          });
        }
      );

      fetchPkkKeuanganFromFirestore().then((items) => {
        if (isActive && !receivedServerSnapshot && items.length > 0) {
          onUpdate(items);
        }
      });
    }
  } catch (e) {}

  let bc: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(KEUANGAN_CHANNEL);
      bc.onmessage = (e) => {
        if (isActive && e.data && e.data.items) onUpdate(e.data.items);
      };
    }
  } catch (e) {}

  return () => {
    isActive = false;
    if (unsub) unsub();
    if (bc) bc.close();
  };
};

export const saveTransaksiPkk = async (item: TransaksiKeuanganPkk) => {
  const current = getLocalTransaksiPkk();
  const payload = { ...item, updatedAt: new Date().toISOString() };
  const idx = current.findIndex((x) => x.id === item.id);
  const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? payload : x)) : [payload, ...current];
  safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify(updated));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(KEUANGAN_CHANNEL);
      bc.postMessage({ items: updated });
      bc.close();
    }
  } catch (e) {}
  try {
    if (db) {
      await setDoc(doc(db, KEUANGAN_COLLECTION, item.id), cleanFirestoreData(payload));
    }
  } catch (e) {}
};

export const deleteTransaksiPkk = async (id: string) => {
  const current = getLocalTransaksiPkk();
  const updated = current.filter((x) => x.id !== id);
  safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify(updated));
  try {
    if (db) {
      await deleteDoc(doc(db, KEUANGAN_COLLECTION, id));
    }
  } catch (e) {}
};

export const subscribeTransaksiPkk = subscribePkkKeuangan;
export const fetchPkkKeuanganFromServer = fetchPkkKeuanganFromFirestore;
export const fetchPkkKegiatanFromServer = async (): Promise<any[]> => [];
export const clearPkkKeuanganData = async (): Promise<void> => {
  safeSetLocalStorage(KEUANGAN_STORAGE_KEY, JSON.stringify([]));
};
export const exportPkkKeuanganToExcel = async (..._args: any[]): Promise<void> => {};


