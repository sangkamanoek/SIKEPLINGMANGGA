import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

export interface PkkBuku1Anggota {
  id: string;
  nama: string;
  jabatan: string;
  jenisKelamin: 'L' | 'P';
  tempatLahir: string;
  tanggalLahir: string;
  statusPernikahan: 'Kawin' | 'Belum Kawin' | 'Janda/Duda';
  alamat: string;
  pendidikan: string;
  pekerjaan: string;
  keterangan: string;
  createdAt?: string;
}

export interface PkkBuku4Notulen {
  id: string;
  tanggalRapat: string;
  agenda: string;
  pimpinanRapat: string;
  jumlahPeserta: number;
  hasilKeputusan: string;
  catatanRapat: string;
  keterangan: string;
  createdAt?: string;
}

export interface PkkBuku5Inventaris {
  id: string;
  namaBarang: string;
  asalBarang: string;
  tanggalPerolehan: string;
  jumlah: number;
  kondisi: 'Baik' | 'Cukup' | 'Rusak Ringan' | 'Rusak Berat';
  keterangan: string;
  createdAt?: string;
}

const BUKU_1_COLLECTION = 'pkk_buku_1_anggota';
const BUKU_4_COLLECTION = 'pkk_buku_4_notulen';
const BUKU_5_COLLECTION = 'pkk_buku_5_inventaris';

// ==========================================
// BUKU I: DAFTAR ANGGOTA & KADER PKK
// ==========================================

export function subscribeBuku1(
  onSuccess: (items: PkkBuku1Anggota[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, BUKU_1_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PkkBuku1Anggota[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PkkBuku1Anggota);
      });
      onSuccess(items);
    },
    (err) => {
      console.error('Buku 1 subscription error:', err);
      onError?.(err);
    }
  );
}

export async function saveBuku1Item(item: PkkBuku1Anggota): Promise<void> {
  const id = item.id || 'b1_' + Date.now();
  const docRef = doc(db, BUKU_1_COLLECTION, id);
  const payload = cleanFirestoreData({
    ...item,
    id,
    createdAt: item.createdAt || new Date().toISOString(),
  });
  await setDoc(docRef, payload, { merge: true });
}

export async function deleteBuku1Item(id: string): Promise<void> {
  const docRef = doc(db, BUKU_1_COLLECTION, id);
  await deleteDoc(docRef);
}

// ==========================================
// BUKU IV: NOTULEN RAPAT PKK
// ==========================================

export function subscribeBuku4(
  onSuccess: (items: PkkBuku4Notulen[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, BUKU_4_COLLECTION);
  const q = query(colRef, orderBy('tanggalRapat', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PkkBuku4Notulen[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PkkBuku4Notulen);
      });
      onSuccess(items);
    },
    (err) => {
      console.error('Buku 4 subscription error:', err);
      onError?.(err);
    }
  );
}

export async function saveBuku4Item(item: PkkBuku4Notulen): Promise<void> {
  const id = item.id || 'b4_' + Date.now();
  const docRef = doc(db, BUKU_4_COLLECTION, id);
  const payload = cleanFirestoreData({
    ...item,
    id,
    createdAt: item.createdAt || new Date().toISOString(),
  });
  await setDoc(docRef, payload, { merge: true });
}

export async function deleteBuku4Item(id: string): Promise<void> {
  const docRef = doc(db, BUKU_4_COLLECTION, id);
  await deleteDoc(docRef);
}

// ==========================================
// BUKU V: INVENTARIS BARANG PKK
// ==========================================

export function subscribeBuku5(
  onSuccess: (items: PkkBuku5Inventaris[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, BUKU_5_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PkkBuku5Inventaris[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PkkBuku5Inventaris);
      });
      onSuccess(items);
    },
    (err) => {
      console.error('Buku 5 subscription error:', err);
      onError?.(err);
    }
  );
}

export async function saveBuku5Item(item: PkkBuku5Inventaris): Promise<void> {
  const id = item.id || 'b5_' + Date.now();
  const docRef = doc(db, BUKU_5_COLLECTION, id);
  const payload = cleanFirestoreData({
    ...item,
    id,
    createdAt: item.createdAt || new Date().toISOString(),
  });
  await setDoc(docRef, payload, { merge: true });
}

export async function deleteBuku5Item(id: string): Promise<void> {
  const docRef = doc(db, BUKU_5_COLLECTION, id);
  await deleteDoc(docRef);
}
