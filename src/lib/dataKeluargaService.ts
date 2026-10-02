import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DataKeluarga, AnggotaKeluarga, TitikRumahBangunan } from '../types';
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
// LOCAL STORAGE CACHE HELPERS
// ==========================================

export function getLocalDataKeluarga(): DataKeluarga[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA_KELUARGA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca cache Data Keluarga lokal:', e);
  }
  return [];
}

export function saveLocalDataKeluarga(list: DataKeluarga[]): void {
  try {
    safeSetLocalStorage(STORAGE_KEY_DATA_KELUARGA, JSON.stringify(list));
  } catch (e) {
    console.warn('Gagal menyimpan Data Keluarga ke lokal:', e);
  }
}

// ==========================================
// FIRESTORE CRUD OPERATIONS
// ==========================================

/**
 * Real-time listener for Data Keluarga from Firestore
 */
export function subscribeDataKeluarga(
  onSuccess: (data: DataKeluarga[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef);

    return onSnapshot(
      q,
      (snapshot) => {
        const list: DataKeluarga[] = [];
        snapshot.forEach((docSnap) => {
          const item = { ...(docSnap.data() as DataKeluarga), id: docSnap.id };
          list.push(item);
        });

        // Urutkan berdasarkan Lingkungan dan Nama Kepala Keluarga
        list.sort((a, b) => {
          if (a.lingkunganNomor !== b.lingkunganNomor) {
            return a.lingkunganNomor - b.lingkunganNomor;
          }
          return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga);
        });

        saveLocalDataKeluarga(list);
        onSuccess(list);
      },
      (error) => {
        console.warn('Firestore onSnapshot data_keluarga error, falling back to local:', error);
        if (onError) onError(error);
        const local = getLocalDataKeluarga();
        if (local.length > 0) onSuccess(local);
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe data_keluarga:', err);
    const local = getLocalDataKeluarga();
    onSuccess(local);
    return () => {};
  }
}

/**
 * Fetch all Data Keluarga from Firestore with local fallback
 */
export async function fetchAllDataKeluarga(): Promise<DataKeluarga[]> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list: DataKeluarga[] = [];
      snap.forEach((d) => {
        const item = { ...(d.data() as DataKeluarga), id: d.id };
        list.push(item);
      });

      list.sort((a, b) => {
        if (a.lingkunganNomor !== b.lingkunganNomor) {
          return a.lingkunganNomor - b.lingkunganNomor;
        }
        return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga);
      });

      saveLocalDataKeluarga(list);
      return list;
    }
  } catch (error) {
    console.warn('Notice fetchAllDataKeluarga Firestore, using local fallback:', error);
    try {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    } catch {}
  }

  // Fallback to local
  const local = getLocalDataKeluarga();
  if (local.length > 0) return local;

  // If completely empty, auto-seed default realistic data
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
  const index = current.findIndex((k) => k.id === keluarga.id || k.nomorKk === keluarga.nomorKk);
  let updatedList: DataKeluarga[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = keluarga;
  } else {
    updatedList = [keluarga, ...current];
  }
  saveLocalDataKeluarga(updatedList);

  // Firestore Write
  try {
    const docId = keluarga.id || `kk_${keluarga.nomorKk || Date.now()}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const cleaned = cleanFirestoreData({ ...keluarga, id: docId });
    await setDoc(docRef, cleaned, { merge: true });

    // Sinkronisasi otomatis ke Titik Bangunan WebGIS jika koordinat tersedia
    if (syncWithWebgisHouse && keluarga.titikKoordinat?.lat && keluarga.titikKoordinat?.lng) {
      const houseId = keluarga.housePointId || `house_kk_${keluarga.id}`;
      const webgisItem: TitikRumahBangunan = {
        id: houseId,
        lingkunganId: keluarga.lingkunganId,
        lingkunganNomor: keluarga.lingkunganNomor,
        namaJalan: keluarga.namaJalan,
        nomorRumah: keluarga.nomorRumah || '',
        namaKepalaKeluarga: keluarga.namaKepalaKeluarga,
        nikKk: keluarga.nikKepalaKeluarga,
        isKkMangga: keluarga.statusDomisili.includes('Mangga'),
        lat: keluarga.titikKoordinat.lat,
        lng: keluarga.titikKoordinat.lng,
        jumlahJiwa: keluarga.jumlahAnggotaKeluarga,
        jumlahLakiLaki: keluarga.jumlahLakiLaki,
        jumlahPerempuan: keluarga.jumlahPerempuan,
        jumlahLansia: keluarga.jumlahLansia,
        jumlahAnak: keluarga.jumlahBalita + keluarga.jumlahUsiaSekolah,
        pekerjaanKk: keluarga.pekerjaanUtamaKepalaKeluarga || 'Wiraswasta',
        desilKesejahteraan: keluarga.desilKesejahteraan,
        penerimaBansos: keluarga.penerimaBansos,
        jenisBansos: keluarga.bantuanDiterima,
        kategoriRentan: keluarga.kategoriRentan && keluarga.kategoriRentan.length > 0,
        jambanKeluarga: keluarga.jambanKeluarga,
        tempatAkhirTinja: keluarga.tempatAkhirTinja,
        sumberAirMinum: keluarga.sumberAirMinum,
        sumberAirBersih: keluarga.sumberAirBersih,
        pembuanganSampahRumah: keluarga.pembuanganSampahRumah,
        statusStuntingRentan: keluarga.statusStuntingRentan,
        statusWrs: keluarga.statusWrs || 'AKTIF',
        nopPbb: keluarga.nopPbb,
        statusPbb: keluarga.statusPbb,
        kategoriBangunan: 'RUMAH_TINGGAL',
        createdAt: keluarga.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: keluarga.createdByName || 'Database Keluarga',
      };
      await saveHouseToFirestore(webgisItem).catch((e) => console.warn('Sync house error:', e));
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
  saveLocalDataKeluarga(updated);

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
    'NO. TELEPON / WA',
    'LINGKUNGAN',
    'NAMA JALAN / GANG',
    'NO. RUMAH / RT-RW',
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
      item.telepon || '-',
      item.lingkunganNama,
      item.namaJalan,
      `${item.nomorRumah || '-'} / RT ${item.rt || '00'}-RW ${item.rw || '00'}`,
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
    'TELEPON_WA',                  // 4
    'LINGKUNGAN_NOMOR',            // 5 (1 - 24)
    'NAMA_JALAN',                  // 6
    'NOMOR_RUMAH',                 // 7
    'RT',                          // 8
    'RW',                          // 9
    'STATUS_DOMISILI',             // 10
    'DESIL_KESEJAHTERAAN',         // 11
    'BANTUAN_DITERIMA',            // 12 (koma pisah, misal: PKH Medan Makmur, BPNT, PBI-JK)
    'JAMBAN_KELUARGA',             // 13
    'SUMBER_AIR_MINUM',            // 14
    'SUMBER_AIR_BERSIH',           // 15
    'PEMBUANGAN_SAMPAH',           // 16
    'STATUS_STUNTING',             // 17
    'NOP_PBB',                     // 18
    'STATUS_PBB',                  // 19 (LUNAS / BELUM_LUNAS)
    'JUMLAH_JIWA',                 // 20
    'JUMLAH_LAKI_LAKI',            // 21
    'JUMLAH_PEREMPUAN',            // 22
    'JUMLAH_LANSIA',               // 23
    'JUMLAH_BALITA',               // 24
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
    '081260012345',
    '1',
    'Jl. Bunga Ncole No. 45',
    '45',
    '001',
    '002',
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
 * Parses uploaded Excel (.xlsx, .xls) or CSV file into DataKeluarga records with validation
 */
export async function parseDataKeluargaFile(file: File): Promise<ImportParsedResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert sheet to json matrix
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('Berkas Excel / CSV kosong.');
  }

  // Find header row (usually contains NOMOR_KK, KK, NIK, or NAMA)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = (rows[i] || []).map((c: any) => String(c).toUpperCase().trim()).join(' ');
    if (
      rowStr.includes('NOMOR_KK') ||
      rowStr.includes('NOMOR KK') ||
      rowStr.includes('NO KK') ||
      rowStr.includes('NO. KK') ||
      rowStr.includes('KEPALA KELUARGA') ||
      rowStr.includes('NIK_KEPALA') ||
      rowStr.includes('NAMA_KEPALA')
    ) {
      headerIndex = i;
      break;
    }
  }

  // If no explicit header row was detected, process from index 0
  const headers = headerIndex !== -1
    ? (rows[headerIndex] || []).map((h: any) => String(h).toUpperCase().trim())
    : [];

  const getColIdx = (possibleNames: string[]) => {
    return headers.findIndex((h) => possibleNames.some((p) => h.includes(p)));
  };

  const idxKk = getColIdx(['NOMOR_KK', 'NOMOR KK', 'NO KK', 'NO. KK', 'NO_KK']);
  const idxNik = getColIdx(['NIK_KEPALA', 'NIK KEPALA', 'NIK']);
  const idxNama = getColIdx(['NAMA_KEPALA', 'NAMA KEPALA', 'NAMA']);
  const idxHp = getColIdx(['TELEPON', 'WA', 'HP', 'NO. TELP']);
  const idxLk = getColIdx(['LINGKUNGAN_NOMOR', 'LINGKUNGAN', 'LK']);
  const idxJalan = getColIdx(['NAMA_JALAN', 'JALAN', 'ALAMAT']);
  const idxNoRumah = getColIdx(['NOMOR_RUMAH', 'NO. RUMAH', 'RUMAH']);
  const idxRt = getColIdx(['RT']);
  const idxRw = getColIdx(['RW']);
  const idxDomisili = getColIdx(['STATUS_DOMISILI', 'DOMISILI']);
  const idxDesil = getColIdx(['DESIL', 'KESEJAHTERAAN']);
  const idxBansos = getColIdx(['BANTUAN', 'BANSOS']);
  const idxJamban = getColIdx(['JAMBAN', 'SANITASI']);
  const idxAirMinum = getColIdx(['AIR_MINUM', 'AIR MINUM']);
  const idxAirBersih = getColIdx(['AIR_BERSIH', 'AIR BERSIH']);
  const idxSampah = getColIdx(['SAMPAH', 'PEMBUANGAN']);
  const idxStunting = getColIdx(['STUNTING', 'RISIKO']);
  const idxNop = getColIdx(['NOP_PBB', 'NOP']);
  const idxPbb = getColIdx(['STATUS_PBB', 'PBB']);
  const idxJiwa = getColIdx(['JUMLAH_JIWA', 'JIWA']);
  const idxL = getColIdx(['JUMLAH_LAKI', 'LAKI', 'L']);
  const idxP = getColIdx(['JUMLAH_PEREMPUAN', 'PEREMPUAN', 'P']);
  const idxLansia = getColIdx(['LANSIA']);
  const idxBalita = getColIdx(['BALITA']);

  const parsedItems: DataKeluarga[] = [];
  const errors: { row: number; nomorKk?: string; message: string }[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || String(c).trim() === '')) continue;

    let rawKk = idxKk !== -1 ? String(row[idxKk] || '').trim().replace(/['"\s]/g, '') : '';
    let rawNik = idxNik !== -1 ? String(row[idxNik] || '').trim().replace(/['"\s]/g, '') : '';
    let rawNama = idxNama !== -1 ? String(row[idxNama] || '').trim() : '';
    let rawAlamat = idxJalan !== -1 ? String(row[idxJalan] || '').trim() : '';
    let rawLk = idxLk !== -1 ? String(row[idxLk] || '').trim() : '';

    // Smart Cell Auto-Detection for headerless or custom columns (e.g. BASMI KABAN | 1271072412650002 | GG. BERAS MUNTE NO.22 LK-II MEDAN | LINGKUNGAN 2)
    for (const cell of row) {
      const val = String(cell || '').trim();
      if (!val) continue;

      const cleanDigits = val.replace(/[\s-]/g, '');
      // Check 16-digit NIK/KK
      if (/^\d{16}$/.test(cleanDigits)) {
        if (!rawNik) rawNik = cleanDigits;
        if (!rawKk) rawKk = cleanDigits;
      }
      // Check Lingkungan label
      else if (/lingkungan|lk[-_\s]*\d+/i.test(val)) {
        if (!rawLk) rawLk = val;
      }
      // Check Alamat/Jalan string
      else if (/\b(gg|jalan|jl|gang|no|lk|medan)\b/i.test(val) && val.length > 5) {
        if (!rawAlamat) rawAlamat = val;
      }
      // Check Person Name (letters only, no long numbers)
      else if (/^[a-zA-Z\s'.,]+$/.test(val) && val.length >= 3 && !rawNama) {
        rawNama = val;
      }
    }

    // Fallbacks to ensure valid records
    if (!rawKk && rawNik) rawKk = rawNik;
    if (!rawNik && rawKk) rawNik = rawKk;
    if (!rawKk && rawNama) rawKk = `127107${Date.now().toString().slice(-10)}`;

    if (!rawKk && !rawNama) {
      continue;
    }

    if (!rawNama) {
      errors.push({ row: i + 1, nomorKk: rawKk, message: 'Nama Kepala Keluarga wajib diisi.' });
      continue;
    }

    // Resolve Lingkungan
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

    const item: DataKeluarga = {
      id: `kk_${rawKk}`,
      nomorKk: rawKk,
      nikKepalaKeluarga: rawNik || `${rawKk}0001`,
      namaKepalaKeluarga: rawNama,
      telepon: idxHp !== -1 ? String(row[idxHp] || '').trim() : '',
      lingkunganId: kepling.id,
      lingkunganNomor: lkNum,
      lingkunganNama: kepling.lingkungan,
      namaJalan: rawAlamat || (idxJalan !== -1 && String(row[idxJalan]).trim() ? String(row[idxJalan]).trim() : 'Jl. Bunga Ncole'),
      nomorRumah: idxNoRumah !== -1 ? String(row[idxNoRumah] || '').trim() : '',
      rt: idxRt !== -1 ? String(row[idxRt] || '001').trim() : '001',
      rw: idxRw !== -1 ? String(row[idxRw] || '001').trim() : '001',
      alamatLengkap: rawAlamat ? `${rawAlamat}, ${kepling.lingkungan}, Kelurahan Mangga` : `${idxJalan !== -1 && row[idxJalan] ? row[idxJalan] : 'Jl. Bunga Ncole'}, ${kepling.lingkungan}, Kelurahan Mangga`,
      statusDomisili: idxDomisili !== -1 ? String(row[idxDomisili] || '').trim() || 'KK Kelurahan Mangga (KTP/KK Setempat)' : 'KK Kelurahan Mangga (KTP/KK Setempat)',
      jumlahAnggotaKeluarga: idxJiwa !== -1 && Number(row[idxJiwa]) ? Number(row[idxJiwa]) : 4,
      jumlahLakiLaki: idxL !== -1 && Number(row[idxL]) ? Number(row[idxL]) : 2,
      jumlahPerempuan: idxP !== -1 && Number(row[idxP]) ? Number(row[idxP]) : 2,
      jumlahBalita: idxBalita !== -1 && Number(row[idxBalita]) ? Number(row[idxBalita]) : 0,
      jumlahUsiaSekolah: 1,
      jumlahUsiaProduktif: 2,
      jumlahLansia: idxLansia !== -1 && Number(row[idxLansia]) ? Number(row[idxLansia]) : 0,
      pekerjaanUtamaKepalaKeluarga: 'Wiraswasta / Pekerja Mandiri',
      penghasilanRataRata: '2.5 - 5 Juta',
      desilKesejahteraan: idxDesil !== -1 ? String(row[idxDesil] || '').trim() || 'Desil 6-10 (Mampu / Non-Desil)' : 'Desil 6-10 (Mampu / Non-Desil)',
      penerimaBansos: bansosList.length > 0,
      bantuanDiterima: bansosList,
      kategoriRentan: bansosList.length > 0 ? ['Keluarga Rentan'] : [],
      jambanKeluarga: idxJamban !== -1 ? String(row[idxJamban] || '').trim() || 'Jamban Sendiri (Leher Angsa / Septik SNI)' : 'Jamban Sendiri (Leher Angsa / Septik SNI)',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: idxAirMinum !== -1 ? String(row[idxAirMinum] || '').trim() || 'PDAM / Air Perpipaan' : 'PDAM / Air Perpipaan',
      sumberAirBersih: idxAirBersih !== -1 ? String(row[idxAirBersih] || '').trim() || 'PDAM Tirtanadi' : 'PDAM Tirtanadi',
      pembuanganSampahRumah: idxSampah !== -1 ? String(row[idxSampah] || '').trim() || 'Diangkut Petugas / WRS' : 'Diangkut Petugas / WRS',
      statusStuntingRentan: idxStunting !== -1 ? String(row[idxStunting] || '').trim() || 'Bebas Risiko Stunting' : 'Bebas Risiko Stunting',
      statusKepemilikanRumah: 'Milik Sendiri',
      dayaListrik: 'PLN 900 VA',
      nopPbb: idxNop !== -1 ? String(row[idxNop] || '').trim() : '',
      statusPbb: idxPbb !== -1 ? (String(row[idxPbb]).toUpperCase().includes('LUNAS') ? 'LUNAS' : 'BELUM_LUNAS') : 'LUNAS',
      statusWrs: 'AKTIF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: 'Import Excel User',
      anggotaKeluarga: [
        {
          id: `ang_${rawKk}_1`,
          nik: rawNik || `${rawKk}0001`,
          nama: rawNama,
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '1985-01-01',
          usia: 41,
          agama: 'Islam',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Wiraswasta',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: bansosList.length > 0 ? 'PBI-JK (Bansos APBD/APBN)' : 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: true,
        }
      ]
    };

    parsedItems.push(item);
  }

  return {
    items: parsedItems,
    totalRows: rows.length - (headerIndex + 1),
    validCount: parsedItems.length,
    invalidCount: errors.length,
    errors,
  };
}

/**
 * Parses raw text lines (e.g. pasted tab-separated or comma-separated rows) into DataKeluarga records
 */
export async function parseDataKeluargaText(rawText: string): Promise<ImportParsedResult> {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Teks yang dimasukkan kosong.');
  }

  const rows: string[][] = lines.map((line) => {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(';')) return line.split(';');
    if (line.includes(',')) return line.split(',');
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
 * Batch saves imported DataKeluarga list to Firestore & Local Storage with progress updates
 */
export async function batchSaveDataKeluarga(
  items: DataKeluarga[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const ok = await saveDataKeluargaToFirestore(item, true);
    if (ok) {
      successCount++;
    } else {
      failCount++;
    }
    if (onProgress) {
      onProgress(i + 1, items.length);
    }
  }

  return { successCount, failCount };
}

// ==========================================
// SEED INITIAL DATA KELUARGA (24 LINGKUNGAN)
// ==========================================

export function getInitialSeedDataKeluarga(): DataKeluarga[] {
  const seeds: DataKeluarga[] = [
    {
      id: 'kk_1271010010001',
      nomorKk: '1271010101050001',
      nikKepalaKeluarga: '1271010502750001',
      namaKepalaKeluarga: 'Bachtiar Sembiring',
      telepon: '081260458891',
      lingkunganId: 'kepling_1',
      lingkunganNomor: 1,
      lingkunganNama: 'Lingkungan I',
      namaJalan: 'Jl. Bunga Raya Gg. Melati',
      nomorRumah: 'No. 12',
      rt: '001',
      rw: '001',
      alamatLengkap: 'Jl. Bunga Raya Gg. Melati No. 12, Lingkungan I, Kelurahan Mangga',
      statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
      titikKoordinat: { lat: 3.52841, lng: 98.64152 },
      jumlahAnggotaKeluarga: 4,
      jumlahLakiLaki: 2,
      jumlahPerempuan: 2,
      jumlahBalita: 1,
      jumlahUsiaSekolah: 1,
      jumlahUsiaProduktif: 2,
      jumlahLansia: 0,
      pekerjaanUtamaKepalaKeluarga: 'Buruh Harian Lepas',
      penghasilanRataRata: '1 - 2.5 Juta',
      anggotaKeluarga: [
        {
          id: 'ang_1_1',
          nik: '1271010502750001',
          nama: 'Bachtiar Sembiring',
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '1975-02-05',
          usia: 51,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Buruh Harian Lepas',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: true,
        },
        {
          id: 'ang_1_2',
          nik: '1271014506780002',
          nama: 'Mariana br Tarigan',
          hubunganKeluarga: 'Istri',
          jenisKelamin: 'P',
          tempatLahir: 'Kabanjahe',
          tanggalLahir: '1978-06-15',
          usia: 48,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMP/Sederajat',
          pekerjaan: 'Ibu Rumah Tangga',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
        },
        {
          id: 'ang_1_3',
          nik: '1271011208110003',
          nama: 'David Sembiring',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '2011-08-12',
          usia: 15,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMP/Sederajat',
          pekerjaan: 'Pelajar',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: false,
          memilikiAktaKelahiran: true,
          memilikiKia: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
        },
        {
          id: 'ang_1_4',
          nik: '1271016503230004',
          nama: 'Grace br Sembiring',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'P',
          tempatLahir: 'Medan',
          tanggalLahir: '2023-03-25',
          usia: 3,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'Tidak/Belum Sekolah',
          pekerjaan: 'Belum Bekerja',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: false,
          memilikiAktaKelahiran: true,
          memilikiKia: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
          catatanKhusus: 'Rutin Posyandu Balita',
        },
      ],
      desilKesejahteraan: 'Desil 2 (Miskin)',
      penerimaBansos: true,
      bantuanDiterima: ['PKH Medan Makmur', 'BPNT / Sembako', 'PBI-JK (BPJS Gratis)'],
      kategoriRentan: ['Balita Pantau Stunting', 'Keluarga Rentan'],
      jambanKeluarga: 'Jamban Sendiri (Leher Angsa / Septik SNI)',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: 'PDAM / Air Perpipaan',
      sumberAirBersih: 'PDAM Tirtanadi',
      pembuanganSampahRumah: 'Diangkut Petugas / WRS',
      statusStuntingRentan: 'Bebas Risiko Stunting',
      statusKepemilikanRumah: 'Milik Sendiri',
      dayaListrik: 'PLN 450 VA',
      nopPbb: '12.71.010.001.001-0012.0',
      statusPbb: 'LUNAS',
      statusWrs: 'AKTIF',
      createdAt: '2026-03-15T08:30:00.000Z',
      updatedAt: '2026-09-20T10:15:00.000Z',
      createdByName: 'Juan Prananta Purba (Kepling I)',
    },
    {
      id: 'kk_1271010020002',
      nomorKk: '1271010102060002',
      nikKepalaKeluarga: '1271011504620001',
      namaKepalaKeluarga: 'Op. Saut Ginting',
      telepon: '085275891230',
      lingkunganId: 'kepling_2',
      lingkunganNomor: 2,
      lingkunganNama: 'Lingkungan II',
      namaJalan: 'Jl. Flamboyan Raya Gg. Kenanga',
      nomorRumah: 'No. 05',
      rt: '002',
      rw: '001',
      alamatLengkap: 'Jl. Flamboyan Raya Gg. Kenanga No. 05, Lingkungan II, Kelurahan Mangga',
      statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
      titikKoordinat: { lat: 3.52615, lng: 98.63875 },
      jumlahAnggotaKeluarga: 2,
      jumlahLakiLaki: 1,
      jumlahPerempuan: 1,
      jumlahBalita: 0,
      jumlahUsiaSekolah: 0,
      jumlahUsiaProduktif: 0,
      jumlahLansia: 2,
      pekerjaanUtamaKepalaKeluarga: 'Pensiunan / Tidak Bekerja',
      penghasilanRataRata: '< 1 Juta',
      anggotaKeluarga: [
        {
          id: 'ang_2_1',
          nik: '1271011504620001',
          nama: 'Saut Ginting',
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Kabanjahe',
          tanggalLahir: '1962-04-15',
          usia: 64,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMP/Sederajat',
          pekerjaan: 'Tidak Bekerja / Lansia',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
          catatanKhusus: 'Lansia Penderita Hipertensi',
        },
        {
          id: 'ang_2_2',
          nik: '1271015010640002',
          nama: 'Murni br Bangun',
          hubunganKeluarga: 'Istri',
          jenisKelamin: 'P',
          tempatLahir: 'Berastagi',
          tanggalLahir: '1964-10-10',
          usia: 62,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SD/Sederajat',
          pekerjaan: 'Ibu Rumah Tangga',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
          catatanKhusus: 'Lansia Rutin Posyandu Lansia',
        },
      ],
      desilKesejahteraan: 'Desil 1 (Sangat Miskin)',
      penerimaBansos: true,
      bantuanDiterima: ['PKH Medan Makmur', 'PKH Nasional', 'BPNT / Sembako', 'PBI-JK (BPJS Gratis)'],
      kategoriRentan: ['Lansia Tunggal', 'Keluarga Rentan'],
      jambanKeluarga: 'Jamban Bersama / Komunal',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: 'Depot Isi Ulang',
      sumberAirBersih: 'Sumur Bor Listrik',
      pembuanganSampahRumah: 'Diangkut Petugas / WRS',
      statusStuntingRentan: 'Bebas Risiko Stunting',
      statusKepemilikanRumah: 'Milik Sendiri',
      dayaListrik: 'PLN 450 VA',
      nopPbb: '12.71.010.002.001-0005.0',
      statusPbb: 'BELUM_LUNAS',
      statusWrs: 'AKTIF',
      createdAt: '2026-03-20T09:00:00.000Z',
      updatedAt: '2026-09-22T11:00:00.000Z',
      createdByName: 'Mulianta Sebayang (Kepling II)',
    },
    {
      id: 'kk_1271010030003',
      nomorKk: '1271010103070003',
      nikKepalaKeluarga: '1271012211830001',
      namaKepalaKeluarga: 'Hendro Wijaya',
      telepon: '081370213344',
      lingkunganId: 'kepling_3',
      lingkunganNomor: 3,
      lingkunganNama: 'Lingkungan III',
      namaJalan: 'Jl. Sakura Raya No. 44',
      nomorRumah: 'No. 44',
      rt: '001',
      rw: '002',
      alamatLengkap: 'Jl. Sakura Raya No. 44, Lingkungan III, Kelurahan Mangga',
      statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
      titikKoordinat: { lat: 3.52410, lng: 98.63610 },
      jumlahAnggotaKeluarga: 5,
      jumlahLakiLaki: 3,
      jumlahPerempuan: 2,
      jumlahBalita: 0,
      jumlahUsiaSekolah: 2,
      jumlahUsiaProduktif: 3,
      jumlahLansia: 0,
      pekerjaanUtamaKepalaKeluarga: 'Wiraswasta Toko Kelontong',
      penghasilanRataRata: '2.5 - 5 Juta',
      anggotaKeluarga: [
        {
          id: 'ang_3_1',
          nik: '1271012211830001',
          nama: 'Hendro Wijaya',
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '1983-11-22',
          usia: 43,
          agama: 'Islam',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Wiraswasta',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: true,
        },
        {
          id: 'ang_3_2',
          nik: '1271016005850002',
          nama: 'Siti Rahma',
          hubunganKeluarga: 'Istri',
          jenisKelamin: 'P',
          tempatLahir: 'Binjai',
          tanggalLahir: '1985-05-20',
          usia: 41,
          agama: 'Islam',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Mengurus Rumah Tangga',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: false,
        },
        {
          id: 'ang_3_3',
          nik: '1271011002080003',
          nama: 'Rizky Pratama',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '2008-02-10',
          usia: 18,
          agama: 'Islam',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Pelajar',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: false,
        },
        {
          id: 'ang_3_4',
          nik: '1271011508130004',
          nama: 'Ahmad Fauzi',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '2013-08-15',
          usia: 13,
          agama: 'Islam',
          pendidikanTerakhir: 'SMP/Sederajat',
          pekerjaan: 'Pelajar',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: false,
          memilikiAktaKelahiran: true,
          memilikiKia: true,
          statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: false,
        },
        {
          id: 'ang_3_5',
          nik: '1271017001180005',
          nama: 'Aisyah Putri',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'P',
          tempatLahir: 'Medan',
          tanggalLahir: '2018-01-30',
          usia: 8,
          agama: 'Islam',
          pendidikanTerakhir: 'SD/Sederajat',
          pekerjaan: 'Pelajar',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: false,
          memilikiAktaKelahiran: true,
          memilikiKia: true,
          statusBpjsKesehatan: 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: false,
        },
      ],
      desilKesejahteraan: 'Desil 6-10 (Mampu / Non-Desil)',
      penerimaBansos: false,
      bantuanDiterima: [],
      jambanKeluarga: 'Jamban Sendiri (Leher Angsa / Septik SNI)',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: 'PDAM / Air Perpipaan',
      sumberAirBersih: 'PDAM Tirtanadi',
      pembuanganSampahRumah: 'Diangkut Petugas / WRS',
      statusStuntingRentan: 'Bebas Risiko Stunting',
      statusKepemilikanRumah: 'Milik Sendiri',
      dayaListrik: 'PLN 1300 VA',
      memilikiUsahaRumah: true,
      namaUsahaRumah: 'Toko Kelontong Berkah',
      nopPbb: '12.71.010.003.001-0044.0',
      statusPbb: 'LUNAS',
      statusWrs: 'AKTIF',
      createdAt: '2026-03-25T14:20:00.000Z',
      updatedAt: '2026-09-24T16:45:00.000Z',
      createdByName: 'Arif Syahputra (Kepling III)',
    },
    {
      id: 'kk_1271010040004',
      nomorKk: '1271010104080004',
      nikKepalaKeluarga: '1271011809890001',
      namaKepalaKeluarga: 'Rudi Hartono Sinaga',
      telepon: '082166778899',
      lingkunganId: 'kepling_4',
      lingkunganNomor: 4,
      lingkunganNama: 'Lingkungan IV',
      namaJalan: 'Jl. Bunga Ncole Gg. Sejahtera',
      nomorRumah: 'No. 08',
      rt: '003',
      rw: '001',
      alamatLengkap: 'Jl. Bunga Ncole Gg. Sejahtera No. 08, Lingkungan IV, Kelurahan Mangga',
      statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
      titikKoordinat: { lat: 3.52180, lng: 98.63420 },
      jumlahAnggotaKeluarga: 3,
      jumlahLakiLaki: 2,
      jumlahPerempuan: 1,
      jumlahBalita: 1,
      jumlahUsiaSekolah: 0,
      jumlahUsiaProduktif: 2,
      jumlahLansia: 0,
      pekerjaanUtamaKepalaKeluarga: 'Supir Angkutan Kota (Angkot)',
      penghasilanRataRata: '1 - 2.5 Juta',
      anggotaKeluarga: [
        {
          id: 'ang_4_1',
          nik: '1271011809890001',
          nama: 'Rudi Hartono Sinaga',
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Pematang Siantar',
          tanggalLahir: '1989-09-18',
          usia: 37,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Pengemudi / Supir',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: true,
        },
        {
          id: 'ang_4_2',
          nik: '1271015502930002',
          nama: 'Marlina br Sihombing',
          hubunganKeluarga: 'Istri',
          jenisKelamin: 'P',
          tempatLahir: 'Medan',
          tanggalLahir: '1993-02-15',
          usia: 33,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Ibu Rumah Tangga',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
          catatanKhusus: 'Ibu Hamil Trimester 2',
        },
        {
          id: 'ang_4_3',
          nik: '1271012010240003',
          nama: 'Kevin Sinaga',
          hubunganKeluarga: 'Anak',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: '2024-10-20',
          usia: 2,
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'Tidak/Belum Sekolah',
          pekerjaan: 'Belum Bekerja',
          statusPerkawinan: 'Belum Kawin',
          memilikiKtpIkd: false,
          memilikiAktaKelahiran: true,
          memilikiKia: true,
          statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
          terdaftarBpjsKetenagakerjaan: false,
          catatanKhusus: 'Pemantauan Berat Badan Kurang (Risiko Stunting)',
        },
      ],
      desilKesejahteraan: 'Desil 3 (Hampir Miskin)',
      penerimaBansos: true,
      bantuanDiterima: ['PKH Medan Makmur', 'BPNT / Sembako', 'PBI-JK (BPJS Gratis)'],
      kategoriRentan: ['Balita Pantau Stunting', 'Ibu Hamil KEK / Resti'],
      jambanKeluarga: 'Jamban Sendiri (Leher Angsa / Septik SNI)',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: 'Depot Isi Ulang',
      sumberAirBersih: 'Sumur Bor Listrik',
      pembuanganSampahRumah: 'Diangkut Petugas / WRS',
      statusStuntingRentan: 'Ada Balita / Baduta Berisiko Stunting',
      statusKepemilikanRumah: 'Sewa / Kontrak',
      dayaListrik: 'PLN 900 VA',
      nopPbb: '12.71.010.004.001-0008.0',
      statusPbb: 'LUNAS',
      statusWrs: 'AKTIF',
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-09-25T08:30:00.000Z',
      createdByName: 'Supriadi Barus (Kepling IV)',
    },
  ];

  // Tambahkan KK representatif untuk lingkungan 5 s/d 24 agar seluruh 24 lingkungan memiliki data
  const streetsByLingkungan: Record<number, string> = {
    5: 'Jl. Bunga Rinte Raya',
    6: 'Jl. Bunga Sedap Malam',
    7: 'Jl. Bunga Cempaka Gg. Damai',
    8: 'Jl. Bunga Mawar Ujung',
    9: 'Jl. Bunga Kenanga Gg. Bersama',
    10: 'Jl. Bunga Asoka Raya',
    11: 'Jl. Bunga Terompet',
    12: 'Jl. Bunga Ncole Raya',
    13: 'Jl. Jamin Ginting Km 10.5',
    14: 'Jl. Bunga Pancur Siwah',
    15: 'Jl. Bunga Kardiol',
    16: 'Jl. Bunga Rinte Gg. Melati',
    17: 'Jl. Bunga Herba',
    18: 'Jl. Bunga Ester',
    19: 'Jl. Bunga Rampai',
    20: 'Jl. Bunga Wijaya Kusuma',
    21: 'Jl. Bunga Teratai',
    22: 'Jl. Bunga Dahlia',
    23: 'Jl. Bunga Flamboyan Gg. Buntu',
    24: 'Jl. Perjuangan Lingkungan 24',
  };

  const sampleDesilList = [
    'Desil 1 (Sangat Miskin)',
    'Desil 2 (Miskin)',
    'Desil 3 (Hampir Miskin)',
    'Desil 4 (Rentan Miskin)',
    'Desil 5 (Menengah Bawah)',
    'Desil 6-10 (Mampu / Non-Desil)',
  ];

  for (let lk = 5; lk <= 24; lk++) {
    const kepling = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === lk) || KEPLING_ACCOUNTS[0];
    const desil = sampleDesilList[(lk - 5) % sampleDesilList.length];
    const isPenerima = desil.startsWith('Desil 1') || desil.startsWith('Desil 2') || desil.startsWith('Desil 3');
    const street = streetsByLingkungan[lk] || `Jl. Lingkungan ${lk}`;
    const latOffset = 3.514 + (lk % 6) * 0.003;
    const lngOffset = 98.630 + (lk % 5) * 0.003;

    seeds.push({
      id: `kk_12710100${lk}000${lk}`,
      nomorKk: `12710101${String(lk).padStart(2, '0')}1500${lk}`,
      nikKepalaKeluarga: `12710110058${String(lk).padStart(2, '0')}0001`,
      namaKepalaKeluarga: `Keluarga ${kepling.nama.split(' ')[0]} Lk ${lk}`,
      telepon: `08126000${String(lk).padStart(4, '0')}`,
      lingkunganId: kepling.id,
      lingkunganNomor: lk,
      lingkunganNama: kepling.lingkungan,
      namaJalan: street,
      nomorRumah: `No. ${lk + 2}`,
      rt: '001',
      rw: '001',
      alamatLengkap: `${street} No. ${lk + 2}, ${kepling.lingkungan}, Kelurahan Mangga`,
      statusDomisili: 'KK Kelurahan Mangga (KTP/KK Setempat)',
      titikKoordinat: { lat: latOffset, lng: lngOffset },
      jumlahAnggotaKeluarga: 3 + (lk % 3),
      jumlahLakiLaki: 2,
      jumlahPerempuan: 1 + (lk % 2),
      jumlahBalita: lk % 2 === 0 ? 1 : 0,
      jumlahUsiaSekolah: 1,
      jumlahUsiaProduktif: 2,
      jumlahLansia: lk % 3 === 0 ? 1 : 0,
      pekerjaanUtamaKepalaKeluarga: lk % 2 === 0 ? 'Buruh Bangunan' : 'Wiraswasta / Pedagang',
      penghasilanRataRata: isPenerima ? '1 - 2.5 Juta' : '2.5 - 5 Juta',
      anggotaKeluarga: [
        {
          id: `ang_${lk}_1`,
          nik: `12710110058${String(lk).padStart(2, '0')}0001`,
          nama: `Bapak ${kepling.nama.split(' ')[0]}`,
          hubunganKeluarga: 'Kepala Keluarga',
          jenisKelamin: 'L',
          tempatLahir: 'Medan',
          tanggalLahir: `198${lk % 10}-05-10`,
          usia: 40 + (lk % 15),
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: lk % 2 === 0 ? 'Buruh Harian Lepas' : 'Wiraswasta',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: isPenerima ? 'PBI-JK (Bansos APBD/APBN)' : 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: true,
        },
        {
          id: `ang_${lk}_2`,
          nik: `12710155088${String(lk).padStart(2, '0')}0002`,
          nama: `Ibu Keluarga Lk ${lk}`,
          hubunganKeluarga: 'Istri',
          jenisKelamin: 'P',
          tempatLahir: 'Medan',
          tanggalLahir: `198${(lk + 2) % 10}-08-15`,
          usia: 38 + (lk % 15),
          agama: 'Kristen Protestan',
          pendidikanTerakhir: 'SMA/SMK/Sederajat',
          pekerjaan: 'Ibu Rumah Tangga',
          statusPerkawinan: 'Kawin',
          memilikiKtpIkd: true,
          memilikiAktaKelahiran: true,
          statusBpjsKesehatan: isPenerima ? 'PBI-JK (Bansos APBD/APBN)' : 'Mandiri (Bayar Sendiri)',
          terdaftarBpjsKetenagakerjaan: false,
        },
      ],
      desilKesejahteraan: desil,
      penerimaBansos: isPenerima,
      bantuanDiterima: isPenerima ? ['PKH Medan Makmur', 'BPNT / Sembako', 'PBI-JK (BPJS Gratis)'] : [],
      kategoriRentan: isPenerima ? ['Keluarga Rentan'] : [],
      jambanKeluarga: lk % 7 === 0 ? 'Jamban Bersama / Komunal' : 'Jamban Sendiri (Leher Angsa / Septik SNI)',
      tempatAkhirTinja: 'Tangki Septik / SPALD',
      sumberAirMinum: lk % 3 === 0 ? 'Depot Isi Ulang' : 'PDAM / Air Perpipaan',
      sumberAirBersih: 'PDAM Tirtanadi',
      pembuanganSampahRumah: 'Diangkut Petugas / WRS',
      statusStuntingRentan: lk % 5 === 0 ? 'Ada Balita / Baduta Berisiko Stunting' : 'Bebas Risiko Stunting',
      statusKepemilikanRumah: 'Milik Sendiri',
      dayaListrik: isPenerima ? 'PLN 450 VA' : 'PLN 900 VA',
      nopPbb: `12.71.010.${String(lk).padStart(3, '0')}.001-0010.0`,
      statusPbb: lk % 2 === 0 ? 'LUNAS' : 'BELUM_LUNAS',
      statusWrs: 'AKTIF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: `${kepling.nama} (${kepling.lingkungan})`,
    });
  }

  return seeds;
}
