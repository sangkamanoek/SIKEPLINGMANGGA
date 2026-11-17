import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { KegiatanLurahItem } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const KEGIATAN_LURAH_STORAGE_KEY = 'sikepling_kegiatan_lurah_v1';
export const KEGIATAN_LURAH_COLLECTION = 'kegiatan_lurah';

export const getLocalKegiatanLurahList = (): KegiatanLurahItem[] => {
  return safeGetLocalStorage<KegiatanLurahItem[]>(KEGIATAN_LURAH_STORAGE_KEY, []);
};

export const saveLocalKegiatanLurahList = (items: KegiatanLurahItem[]): void => {
  safeSetLocalStorage(KEGIATAN_LURAH_STORAGE_KEY, JSON.stringify(items));
};

export const fetchKegiatanLurahFromFirestore = async (): Promise<KegiatanLurahItem[]> => {
  try {
    const q = query(collection(db, KEGIATAN_LURAH_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: KegiatanLurahItem[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as KegiatanLurahItem), id: d.id });
    });
    if (list.length > 0) {
      saveLocalKegiatanLurahList(list);
      return list;
    }
  } catch (err) {
    console.warn('Failed to fetch kegiatan lurah from Firestore, falling back to local:', err);
  }
  return getLocalKegiatanLurahList();
};

export const subscribeKegiatanLurahFromFirestore = (cb: (items: KegiatanLurahItem[]) => void) => {
  try {
    const q = query(collection(db, KEGIATAN_LURAH_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: KegiatanLurahItem[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as KegiatanLurahItem), id: d.id });
        });
        saveLocalKegiatanLurahList(list);
        cb(list);
      },
      (err) => {
        console.warn('Kegiatan lurah snapshot error:', err);
        cb(getLocalKegiatanLurahList());
      }
    );
  } catch (e) {
    console.warn('Failed to subscribe to kegiatan lurah:', e);
    cb(getLocalKegiatanLurahList());
    return () => {};
  }
};

export const saveKegiatanLurahItem = async (item: KegiatanLurahItem): Promise<boolean> => {
  try {
    const local = getLocalKegiatanLurahList();
    const idx = local.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      local[idx] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      local.unshift(item);
    }
    saveLocalKegiatanLurahList(local);
    window.dispatchEvent(new CustomEvent('kegiatan-lurah-updated'));

    // Save to Firestore
    const docRef = doc(db, KEGIATAN_LURAH_COLLECTION, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving kegiatan lurah:', err);
    return false;
  }
};

export const deleteKegiatanLurahItem = async (id: string): Promise<boolean> => {
  try {
    const local = getLocalKegiatanLurahList();
    const filtered = local.filter((i) => i.id !== id);
    saveLocalKegiatanLurahList(filtered);
    window.dispatchEvent(new CustomEvent('kegiatan-lurah-updated'));

    await deleteDoc(doc(db, KEGIATAN_LURAH_COLLECTION, id));
    return true;
  } catch (err) {
    console.error('Error deleting kegiatan lurah:', err);
    return false;
  }
};
