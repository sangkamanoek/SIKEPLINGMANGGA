import { TransaksiKeuanganPkk, PosAnggaranPkk } from '../types';
import { db } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import * as XLSX from 'xlsx';

export const PKK_KEUANGAN_COLLECTION = 'pkk_keuangan';
export const PKK_KEUANGAN_STORAGE_KEY = 'sikepling_pkk_keuangan_v1';
export const PKK_KEUANGAN_CHANNEL = 'sikepling_pkk_keuangan_channel';

export const POS_ANGGARAN_LABELS: Record<PosAnggaranPkk, string> = {
  SEKRETARIAT: 'Sekretariat & Administrasi',
  POKJA_I: 'Pokja I (Pancasila & Gotong Royong)',
  POKJA_II: 'Pokja II (Pendidikan & UP2K)',
  POKJA_III: 'Pokja III (Pangan & Sandang/HATINYA PKK)',
  POKJA_IV: 'Pokja IV (Kesehatan, Posyandu, PHBS)',
  UP2K: 'Usaha Peningkatan Pendapatan Keluarga (UP2K)',
  BANTUAN_PEMERINTAH: 'Bantuan Operasional APBD / Kelurahan',
  IURAN_KAS: 'Iuran Kas / Pertemuan Rutin',
  SWADAYA_SPONSOR: 'Swadaya / Donatur / Sponsor',
  LAINNYA: 'Lainnya',
};

// Data Inisial Pembuka Buku Kas Umum PKK Kelurahan Mangga TA 2026
const INITIAL_PKK_TRANSACTIONS: TransaksiKeuanganPkk[] = [
  {
    id: 'pkk_tx_init_01',
    tanggal: '2026-10-01',
    nomorBukti: 'BKM-01/PKK/X/2026',
    jenis: 'PENERIMAAN',
    posAnggaran: 'BANTUAN_PEMERINTAH',
    uraian: 'Penerimaan Saldo Awal Kas PKK Kelurahan Mangga Bulan Oktober 2026',
    jumlah: 5500000,
    sumberDana: 'Saldo Awal Kas',
    penerimaPenyetor: 'Bendahara TP PKK',
    lingkunganNomor: 0,
    lingkunganNama: 'TP PKK Kelurahan Mangga',
    catatan: 'Saldo kas tunai & bank awal bulan Oktober 2026',
    dibuatOlehNama: 'Bendahara PKK',
    dibuatOlehRole: 'bendahara_pkk',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'pkk_tx_init_02',
    tanggal: '2026-10-01',
    nomorBukti: 'BKM-02/PKK/X/2026',
    jenis: 'PENERIMAAN',
    posAnggaran: 'IURAN_KAS',
    uraian: 'Iuran Kas Pertemuan Rutin Bulanan Pengurus TP PKK Kelurahan',
    jumlah: 600000,
    sumberDana: 'Iuran Rutin Pengurus',
    penerimaPenyetor: 'Sekretaris PKK',
    lingkunganNomor: 0,
    lingkunganNama: 'TP PKK Kelurahan Mangga',
    catatan: '24 Lingkungan & Tim Penggerak Kelurahan',
    dibuatOlehNama: 'Bendahara PKK',
    dibuatOlehRole: 'bendahara_pkk',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'pkk_tx_init_03',
    tanggal: '2026-10-02',
    nomorBukti: 'BKK-01/PKK/X/2026',
    jenis: 'PENGELUARAN',
    posAnggaran: 'SEKRETARIAT',
    uraian: 'Pembelian ATK, Kertas HVS, Tinta Printer, dan Penggandaan Buku Administrasi 6 PKK',
    jumlah: 375000,
    sumberDana: 'Kas Operasional',
    penerimaPenyetor: 'Toko Alat Tulis Bersama',
    lingkunganNomor: 0,
    lingkunganNama: 'TP PKK Kelurahan Mangga',
    catatan: 'Kuitansi No. 102/ATK/2026',
    dibuatOlehNama: 'Bendahara PKK',
    dibuatOlehRole: 'bendahara_pkk',
    createdAt: '2026-10-02T09:30:00.000Z',
  },
  {
    id: 'pkk_tx_init_04',
    tanggal: '2026-10-02',
    nomorBukti: 'BKK-02/PKK/X/2026',
    jenis: 'PENGELUARAN',
    posAnggaran: 'POKJA_IV',
    uraian: 'Bantuan Pengadaan Paket Makanan Tambahan (PMT) Balita & Lansia Posyandu Melati',
    jumlah: 850000,
    sumberDana: 'Kas Pokja IV',
    penerimaPenyetor: 'Kader Posyandu Lingkungan IV & VI',
    lingkunganNomor: 4,
    lingkunganNama: 'Lingkungan IV',
    catatan: 'Untuk 45 balita dan 20 lansia',
    dibuatOlehNama: 'Ketua Pokja IV',
    dibuatOlehRole: 'pokja_iv',
    createdAt: '2026-10-02T14:15:00.000Z',
  },
  {
    id: 'pkk_tx_init_05',
    tanggal: '2026-10-03',
    nomorBukti: 'BKM-03/PKK/X/2026',
    jenis: 'PENERIMAAN',
    posAnggaran: 'UP2K',
    uraian: 'Setoran Hasil Penjualan Produk Olahan Keripik Kelompok UP2K PKK Lingkungan XI',
    jumlah: 450000,
    sumberDana: 'Bagi Hasil UP2K',
    penerimaPenyetor: 'Kelompok UP2K Lingkungan XI',
    lingkunganNomor: 11,
    lingkunganNama: 'Lingkungan XI',
    catatan: 'Pemberdayaan ekonomi keluarga binaan PKK',
    dibuatOlehNama: 'Ketua Pokja II',
    dibuatOlehRole: 'pokja_ii',
    createdAt: '2026-10-03T11:00:00.000Z',
  },
  {
    id: 'pkk_tx_init_06',
    tanggal: '2026-10-03',
    nomorBukti: 'BKK-03/PKK/X/2026',
    jenis: 'PENGELUARAN',
    posAnggaran: 'POKJA_III',
    uraian: 'Pengadaan Bibit Tanaman Obat Keluarga (TOGA) & Sayuran untuk Program HATINYA PKK',
    jumlah: 520000,
    sumberDana: 'Kas Pokja III',
    penerimaPenyetor: 'Kelompok Tani Bunga Rinte',
    lingkunganNomor: 0,
    lingkunganNama: 'TP PKK Kelurahan Mangga',
    catatan: 'Distribusi bibit cabai, tomat, dan jahe merah',
    dibuatOlehNama: 'Ketua Pokja III',
    dibuatOlehRole: 'pokja_iii',
    createdAt: '2026-10-03T13:45:00.000Z',
  },
];

/**
 * Mengambil transaksi PKK instan dari Local Storage (0ms)
 */
export function getLocalTransaksiPkk(): TransaksiKeuanganPkk[] {
  const stored = safeGetLocalStorage<TransaksiKeuanganPkk[]>(PKK_KEUANGAN_STORAGE_KEY, []);
  if (!stored || stored.length === 0) {
    safeSetLocalStorage(PKK_KEUANGAN_STORAGE_KEY, JSON.stringify(INITIAL_PKK_TRANSACTIONS));
    return INITIAL_PKK_TRANSACTIONS;
  }
  return stored;
}

/**
 * Menyimpan transaksi PKK ke Local Storage & Broadcast ke tab lain
 */
export function setLocalTransaksiPkk(list: TransaksiKeuanganPkk[]): void {
  safeSetLocalStorage(PKK_KEUANGAN_STORAGE_KEY, JSON.stringify(list));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pkk-keuangan-updated', { detail: list }));
  }
}

/**
 * Broadcast event perubahan data transaksi
 */
export function broadcastTransaksiPkk(item: TransaksiKeuanganPkk): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('pkk-keuangan-updated', { detail: item }));
    const bc = new BroadcastChannel(PKK_KEUANGAN_CHANNEL);
    bc.postMessage({ type: 'PKK_TX_SAVED', item, timestamp: Date.now() });
    setTimeout(() => {
      try {
        bc.close();
      } catch {}
    }, 200);
  } catch {}
}

/**
 * Ambil data dari Server Buffer Express
 */
export async function fetchTransaksiPkkFromServer(): Promise<TransaksiKeuanganPkk[]> {
  try {
    const res = await fetch(`/api/pkk/keuangan?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        return json.data as TransaksiKeuanganPkk[];
      }
    }
  } catch (err) {
    console.warn('Notice fetching PKK keuangan from server:', err);
  }
  return [];
}

export const fetchPkkKeuanganFromServer = fetchTransaksiPkkFromServer;

export async function fetchPkkKegiatanFromServer(): Promise<any[]> {
  try {
    const local = safeGetLocalStorage(PKK_KEUANGAN_STORAGE_KEY, '[]');
    return JSON.parse(local);
  } catch {
    return [];
  }
}

/**
 * Simpan transaksi PKK (Dual-Tier: Local 0ms + Broadcast + Server Buffer + Firestore)
 */
export async function saveTransaksiPkk(item: TransaksiKeuanganPkk): Promise<void> {
  const current = getLocalTransaksiPkk();
  const exists = current.some((x) => x.id === item.id);
  const updated = exists ? current.map((x) => (x.id === item.id ? item : x)) : [item, ...current];
  setLocalTransaksiPkk(updated);
  broadcastTransaksiPkk(item);

  // 1. Simpan ke Server Express
  fetch('/api/pkk/keuangan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item }),
  }).catch((err) => {
    console.warn('Notice saving PKK keuangan to server buffer:', err);
  });

  // 2. Simpan ke Firebase Firestore
  if (db) {
    try {
      const docRef = doc(db, PKK_KEUANGAN_COLLECTION, item.id);
      await setDoc(docRef, item, { merge: true });
    } catch (err) {
      console.warn('Firestore setDoc notice on pkk_keuangan:', err);
    }
  }
}

/**
 * Hapus transaksi PKK (Local + Server + Firestore)
 */
export async function deleteTransaksiPkk(id: string): Promise<void> {
  const current = getLocalTransaksiPkk();
  const updated = current.filter((x) => x.id !== id);
  setLocalTransaksiPkk(updated);

  if (typeof window !== 'undefined') {
    try {
      const bc = new BroadcastChannel(PKK_KEUANGAN_CHANNEL);
      bc.postMessage({ type: 'PKK_TX_DELETED', id, timestamp: Date.now() });
      setTimeout(() => bc.close(), 200);
    } catch {}
  }

  fetch(`/api/pkk/keuangan/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((err) => {
    console.warn('Notice deleting PKK keuangan on server:', err);
  });

  if (db) {
    try {
      await deleteDoc(doc(db, PKK_KEUANGAN_COLLECTION, id));
    } catch (err) {
      console.warn('Firestore deleteDoc notice on pkk_keuangan:', err);
    }
  }
}

/**
 * Real-time listener & Dual-tier sync untuk Keuangan PKK
 */
export function subscribeTransaksiPkk(
  onSuccess: (data: TransaksiKeuanganPkk[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // 1. 0ms instant local cache
  const initial = getLocalTransaksiPkk();
  if (initial.length > 0) {
    onSuccess(initial);
  }

  // 2. Fetch server buffer
  fetchTransaksiPkkFromServer().then((serverItems) => {
    if (serverItems.length > 0) {
      const current = getLocalTransaksiPkk();
      const map = new Map<string, TransaksiKeuanganPkk>();
      serverItems.forEach((it) => map.set(it.id, it));
      current.forEach((it) => {
        if (!map.has(it.id)) map.set(it.id, it);
      });
      const merged = Array.from(map.values()).sort((a, b) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        return dateB.localeCompare(dateA);
      });
      setLocalTransaksiPkk(merged);
      onSuccess(merged);
    }
  });

  // 3. Cross-tab Broadcast listener
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(PKK_KEUANGAN_CHANNEL);
    bc.onmessage = (event) => {
      if (event?.data?.type === 'PKK_TX_SAVED' && event.data.item) {
        const item = event.data.item as TransaksiKeuanganPkk;
        const current = getLocalTransaksiPkk();
        const exists = current.some((x) => x.id === item.id);
        const updated = exists ? current.map((x) => (x.id === item.id ? item : x)) : [item, ...current];
        setLocalTransaksiPkk(updated);
        onSuccess(updated);
      } else if (event?.data?.type === 'PKK_TX_DELETED' && event.data.id) {
        const id = event.data.id;
        const current = getLocalTransaksiPkk();
        const updated = current.filter((x) => x.id !== id);
        setLocalTransaksiPkk(updated);
        onSuccess(updated);
      }
    };
  } catch {}

  // 4. Same-window custom event listener
  const handleCustomEvent = (e: any) => {
    const detail = e?.detail;
    if (Array.isArray(detail)) {
      onSuccess(detail);
    } else if (detail && detail.id) {
      const current = getLocalTransaksiPkk();
      const exists = current.some((x) => x.id === detail.id);
      const updated = exists ? current.map((x) => (x.id === detail.id ? detail : x)) : [detail, ...current];
      setLocalTransaksiPkk(updated);
      onSuccess(updated);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pkk-keuangan-updated', handleCustomEvent);
  }

  // 5. Firestore real-time snapshot
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, PKK_KEUANGAN_COLLECTION), orderBy('tanggal', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, TransaksiKeuanganPkk>();
          snapshot.forEach((d) => {
            const data = d.data() as TransaksiKeuanganPkk;
            if (data && (data.id || d.id)) {
              const fullData = { ...data, id: data.id || d.id };
              map.set(fullData.id, fullData);
            }
          });
          const list = Array.from(map.values());
          if (list.length > 0) {
            setLocalTransaksiPkk(list);
            onSuccess(list);
          }
        },
        (err) => {
          console.warn('Firestore snapshot error on pkk_keuangan:', err);
          if (onError) onError(err);
        }
      );
    } catch (e: any) {
      console.warn('Error setting up firestore snapshot on pkk_keuangan:', e);
      if (onError) onError(e);
    }
  }

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pkk-keuangan-updated', handleCustomEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}

export const subscribePkkKeuangan = subscribeTransaksiPkk;

/**
 * Ekspor Buku Kas Umum PKK ke Format Excel (.xlsx)
 */
export function exportPkkKeuanganToExcel(
  items: TransaksiKeuanganPkk[],
  periodTitle: string = 'Tahun Anggaran 2026'
): void {
  // Sort ascending by date for chronological ledger
  const sorted = [...items].sort((a, b) => {
    const tA = (a.tanggal || '') + (a.createdAt || '');
    const tB = (b.tanggal || '') + (b.createdAt || '');
    return tA.localeCompare(tB);
  });

  let runningSaldo = 0;
  const rows: any[] = [];

  // Header meta
  rows.push(['BUKU KAS UMUM (BKU) TIM PENGGERAK PKK']);
  rows.push(['KELURAHAN MANGGA, KECAMATAN MEDAN TUNTUNGAN']);
  rows.push([`Periode: ${periodTitle}`]);
  rows.push([]);
  rows.push([
    'No',
    'Tanggal',
    'Nomor Bukti',
    'Uraian Transaksi',
    'Pos / Alokasi Pokja',
    'Sumber Dana / Penyetor / Penerima',
    'Lingkungan',
    'Penerimaan (Rp)',
    'Pengeluaran (Rp)',
    'Saldo Kas (Rp)',
    'Catatan / Keterangan',
  ]);

  let totalMasuk = 0;
  let totalKeluar = 0;

  sorted.forEach((item, index) => {
    const masuk = item.jenis === 'PENERIMAAN' ? item.jumlah : 0;
    const keluar = item.jenis === 'PENGELUARAN' ? item.jumlah : 0;
    runningSaldo += masuk - keluar;
    totalMasuk += masuk;
    totalKeluar += keluar;

    rows.push([
      index + 1,
      item.tanggal,
      item.nomorBukti || '-',
      item.uraian,
      POS_ANGGARAN_LABELS[item.posAnggaran] || item.posAnggaran,
      item.penerimaPenyetor || item.sumberDana || '-',
      item.lingkunganNama || (item.lingkunganNomor ? `Lingkungan ${item.lingkunganNomor}` : 'Kelurahan'),
      masuk > 0 ? masuk : 0,
      keluar > 0 ? keluar : 0,
      runningSaldo,
      item.catatan || '',
    ]);
  });

  // Total summary row
  rows.push([]);
  rows.push([
    'TOTAL',
    '',
    '',
    `Total Akumulasi Transaksi: ${sorted.length} Kegiatan`,
    '',
    '',
    '',
    totalMasuk,
    totalKeluar,
    runningSaldo,
    `Sisa Saldo Kas: Rp ${runningSaldo.toLocaleString('id-ID')}`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 12 }, // Tanggal
    { wch: 20 }, // No Bukti
    { wch: 45 }, // Uraian
    { wch: 30 }, // Pos / Pokja
    { wch: 28 }, // Sumber Dana / Penerima
    { wch: 20 }, // Lingkungan
    { wch: 18 }, // Penerimaan
    { wch: 18 }, // Pengeluaran
    { wch: 18 }, // Saldo Kas
    { wch: 30 }, // Catatan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas Umum PKK');

  const fileName = `Buku_Kas_Umum_PKK_Kelurahan_Mangga_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
