import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { KunjunganWargaData } from '../components/FormKunjunganWarga';
import { AbsenApelItem, StatusAbsenApel } from '../types';
import {
  computeWeeklyAttendance24,
  computeMonthlyAttendance24,
  KeplingWeeklyRow,
  KeplingMonthlyRow,
  checkApelTimeStatus,
  calculateAbsentDays,
} from './attendanceApi';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

/**
 * Trigger file download from Blob in browser
 */
export function triggerFileDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Share or download an Excel workbook file (XLSX SheetJS fallback)
 */
export async function shareOrDownloadWorkbook(
  wb: XLSX.WorkBook,
  fileName: string,
  shareTitle: string,
  shareText: string
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return shareOrDownloadBlob(blob, fileName, shareTitle, shareText, true);
  } catch (err) {
    console.error('Error in shareOrDownloadWorkbook:', err);
    return { method: 'download', success: false };
  }
}

/**
 * Share or download a generic Blob (ExcelJS or JSZip)
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
  shareMode: boolean = false
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  if (shareMode) {
    try {
      const file = new File([blob], fileName, {
        type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file],
          });
          return { method: 'share', success: true };
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return { method: 'share', success: false };
          }
          console.warn('navigator.share failed, fallback to download:', err);
        }
      }
    } catch (e) {
      console.warn('Error checking navigator.canShare, fallback to download:', e);
    }
  }

  // Fallback: direct browser download
  triggerFileDownload(blob, fileName);
  return { method: 'download', success: true };
}

/**
 * Helper: extract clean base64 and image extension from base64 data URL or HTTP URL
 */
async function extractBase64AndExt(urlOrData: string): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  if (!urlOrData) return null;

  try {
    if (urlOrData.startsWith('data:image/png')) {
      return {
        base64: urlOrData.replace(/^data:image\/png;base64,/, ''),
        extension: 'png',
      };
    } else if (urlOrData.startsWith('data:image/')) {
      return {
        base64: urlOrData.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, ''),
        extension: 'jpeg',
      };
    } else if (urlOrData.startsWith('http://') || urlOrData.startsWith('https://')) {
      const resp = await fetch(urlOrData, { mode: 'cors' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const ext = blob.type === 'image/png' ? 'png' : 'jpeg';

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resStr = (reader.result as string) || '';
          resolve(resStr.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, ''));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return { base64, extension: ext };
    }
  } catch (err) {
    console.warn('Gagal memproses gambar untuk excel:', err);
  }

  return null;
}

/**
 * Export Kunjungan Warga Lapangan to Excel (.xlsx) DENGAN FOTO ASLI TERSEMAT DI DALAM SEL
 * Menggunakan ExcelJS agar foto dokumentasi tampil langsung di setiap baris tabel.
 */
export async function exportKunjunganWargaToExcel(
  records: KunjunganWargaData[],
  selectedDate: string,
  shareMode: boolean = false
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kelurahan Mangga - Medan Tuntungan';
  workbook.lastModifiedBy = 'Admin Kelurahan Mangga';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Kunjungan Lapangan', {
    views: [{ showGridLines: true }],
  });

  // 1. Header Judul Resmi
  const r1 = worksheet.addRow(['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN']);
  const r2 = worksheet.addRow(['KELURAHAN MANGGA']);
  const r3 = worksheet.addRow(['BUKU REKAPITULASI KUNJUNGAN HARIAN LAPANGAN (DOOR-TO-DOOR)']);
  const r4 = worksheet.addRow([
    `Periode / Tanggal: ${selectedDate || 'Semua Tanggal'}`,
    '',
    `Total Kunjungan: ${records.length} Rumah`,
    '',
    `Dokumentasi Foto Tersedia: ${records.filter((r) => Boolean(r.fotoDokumentasi)).length} Rumah`,
  ]);
  const r5 = worksheet.addRow(['#MedanUntukSemua', '#SemuaUntukMedan', '#KolaborasiMedanBerkah']);
  worksheet.addRow([]); // Baris kosong pembatas (baris 6)

  // Styling Title Rows
  r1.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  r2.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  r3.font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
  r4.font = { italic: true, size: 10, color: { argb: 'FF334155' } };
  r5.font = { bold: true, size: 9, color: { argb: 'FF0284C7' } };

  // 2. Baris Header Tabel (Baris 7)
  const headerRow = worksheet.addRow([
    'NO',
    'TANGGAL',
    'NAMA WARGA',
    'ALAMAT LENGKAP',
    'LINGKUNGAN',
    'KEPALA LINGKUNGAN',
    'STATUS PERLINSOS',
    'IKD',
    'PBB',
    'DOKUMENTASI FOTO',
    'WAKTU PENCATATAN',
  ]);

  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF065F46' }, // Dark Emerald Green
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF047857' } },
      bottom: { style: 'medium', color: { argb: 'FF022C22' } },
      left: { style: 'thin', color: { argb: 'FF10B981' } },
      right: { style: 'thin', color: { argb: 'FF10B981' } },
    };
  });

  // 3. Atur Lebar Kolom
  worksheet.getColumn(1).width = 6;   // NO
  worksheet.getColumn(2).width = 14;  // TANGGAL
  worksheet.getColumn(3).width = 25;  // NAMA WARGA
  worksheet.getColumn(4).width = 36;  // ALAMAT
  worksheet.getColumn(5).width = 16;  // LINGKUNGAN
  worksheet.getColumn(6).width = 24;  // KEPLING
  worksheet.getColumn(7).width = 16;  // STATUS PERLINSOS
  worksheet.getColumn(8).width = 10;  // IKD
  worksheet.getColumn(9).width = 10;  // PBB
  worksheet.getColumn(10).width = 26; // DOKUMENTASI FOTO (Lebar untuk foto)
  worksheet.getColumn(11).width = 16; // WAKTU

  // 4. Masukkan Baris Data & Sematkan Gambar Asli
  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const hasPhoto = Boolean(item.fotoDokumentasi);

    const row = worksheet.addRow([
      i + 1,
      item.tanggal,
      (item.namaWarga || '').toUpperCase(),
      (item.alamat || '').toUpperCase(),
      item.lingkungan,
      item.namaKepling,
      item.perlinsos || item.keterangan || '-',
      item.ikd || '-',
      item.pbb || '-',
      hasPhoto ? '' : 'Tanpa Foto',
      item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID') : '-',
    ]);

    const currentRowNumber = row.number;

    // Atur tinggi baris: Jika ada foto diberi tinggi 80pt agar foto terlihat jelas dan proporsional
    if (hasPhoto) {
      row.height = 78;
    } else {
      row.height = 24;
    }

    // Styling sel
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment
      if (
        colNumber === 1 || // NO
        colNumber === 2 || // TGL
        colNumber === 5 || // LINGKUNGAN
        colNumber === 7 || // PERLINSOS
        colNumber === 8 || // IKD
        colNumber === 9 || // PBB
        colNumber === 10 || // FOTO
        colNumber === 11   // WAKTU
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      cell.font = { size: 9, color: { argb: 'FF1E293B' } };
    });

    // Sematkan Gambar ke Kolom 10 (Kolom J, 0-indexed: col 9)
    if (hasPhoto && item.fotoDokumentasi) {
      try {
        const photoData = await extractBase64AndExt(item.fotoDokumentasi);
        if (photoData && photoData.base64) {
          const imageId = workbook.addImage({
            base64: photoData.base64,
            extension: photoData.extension,
          });

          // Posisikan gambar di dalam sel J[row]
          worksheet.addImage(imageId, {
            tl: { col: 9 + 0.12, row: currentRowNumber - 1 + 0.08 },
            ext: { width: 135, height: 92 },
            editAs: 'oneCell',
          });
        } else {
          row.getCell(10).value = 'Foto Tidak Dapat Dibuka';
        }
      } catch (err) {
        console.warn(`Gagal menyematkan gambar untuk ${item.namaWarga}:`, err);
        row.getCell(10).value = 'Foto Gagal Dimuat';
      }
    }
  }

  // 5. Generate Excel Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = `Laporan_Kunjungan_Warga_Mangga_${selectedDate || 'Semua'}.xlsx`;
  const shareTitle = `Laporan Kunjungan Lapangan Kelurahan Mangga (${selectedDate})`;
  const shareText = `Berikut rekapitulasi data kunjungan harian lapangan warga door-to-door Kelurahan Mangga tanggal ${selectedDate} (${records.length} rumah) dengan foto dokumentasi lengkap di dalam Excel.`;

  return shareOrDownloadBlob(blob, fileName, shareTitle, shareText, shareMode);
}

/**
 * Paket Lengkap ZIP: File Excel Bergambar (.xlsx) + Folder Foto Asli Resolusi Tinggi (.jpg)
 */
export async function exportKunjunganWargaZipPackage(
  records: KunjunganWargaData[],
  selectedDate: string,
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  const zip = new JSZip();

  // 1. Buat Workbook Excel via ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kelurahan Mangga - Medan Tuntungan';
  const worksheet = workbook.addWorksheet('Kunjungan Lapangan');

  worksheet.addRow(['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN']);
  worksheet.addRow(['KELURAHAN MANGGA']);
  worksheet.addRow(['BUKU REKAPITULASI KUNJUNGAN HARIAN LAPANGAN']);
  worksheet.addRow([`Periode: ${selectedDate || 'Semua Tanggal'}`, `Total: ${records.length} Rumah`]);
  worksheet.addRow([]);

  const header = worksheet.addRow([
    'NO',
    'TANGGAL',
    'NAMA WARGA',
    'ALAMAT LENGKAP',
    'LINGKUNGAN',
    'KEPALA LINGKUNGAN',
    'STATUS PERLINSOS',
    'IKD',
    'PBB',
    'NAMA FILE FOTO DI FOLDER',
    'WAKTU PENCATATAN',
  ]);
  header.font = { bold: true };

  const photoFolder = zip.folder('Foto_Dokumentasi_Kunjungan');
  const itemsWithPhotos = records.filter((r) => Boolean(r.fotoDokumentasi));
  let processedPhotos = 0;

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const safeName = item.namaWarga.replace(/[^a-zA-Z0-9]/g, '_');
    const safeLingk = item.lingkungan.replace(/[^a-zA-Z0-9]/g, '_');
    const photoFileName = `${String(i + 1).padStart(2, '0')}_Lk${item.lingkunganNomor}_${safeName}_${item.tanggal}.jpg`;

    worksheet.addRow([
      i + 1,
      item.tanggal,
      (item.namaWarga || '').toUpperCase(),
      (item.alamat || '').toUpperCase(),
      item.lingkungan,
      item.namaKepling,
      item.perlinsos || item.keterangan || '-',
      item.ikd || '-',
      item.pbb || '-',
      item.fotoDokumentasi ? photoFileName : 'Tanpa Foto',
      item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID') : '-',
    ]);

    if (item.fotoDokumentasi && photoFolder) {
      try {
        const photoData = await extractBase64AndExt(item.fotoDokumentasi);
        if (photoData && photoData.base64) {
          photoFolder.file(photoFileName, photoData.base64, { base64: true });
        }
      } catch (e) {
        console.warn('Gagal memasukkan foto ke ZIP:', e);
      }
      processedPhotos++;
      if (onProgress) onProgress(processedPhotos, itemsWithPhotos.length);
    }
  }

  // 2. Simpan Excel ke dalam ZIP
  const excelBuffer = await workbook.xlsx.writeBuffer();
  zip.file(`Rekap_Kunjungan_Warga_Mangga_${selectedDate || 'Semua'}.xlsx`, excelBuffer);

  // 3. Tambahkan File Panduan README
  zip.file(
    'PETUNJUK_DOKUMENTASI.txt',
    `REKAP KUNJUNGAN HARIAN LAPANGAN DOOR-TO-DOOR
KELURAHAN MANGGA, KECAMATAN MEDAN TUNTUNGAN
=================================================
Periode / Tanggal: ${selectedDate || 'Semua Tanggal'}
Total Kunjungan : ${records.length} Rumah
Jumlah Foto     : ${itemsWithPhotos.length} Lembar

Isi Berkas Paket:
1. Rekap_Kunjungan_Warga_Mangga_${selectedDate || 'Semua'}.xlsx
   (Tabel data lengkap kunjungan 24 lingkungan)
2. Folder: Foto_Dokumentasi_Kunjungan/
   (Seluruh foto bukti kunjungan warga yang dinamai berurutan berdasarkan nomor urut, lingkungan, dan nama warga)
=================================================
Pemerintah Kelurahan Mangga
#MedanUntukSemua #SemuaUntukMedan`
  );

  // 4. Generate ZIP & Unduh
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(zipBlob, `Paket_Lengkap_Kunjungan_Warga_Mangga_${selectedDate || 'Semua'}.zip`);
  return true;
}

/**
 * Export Absensi Apel Pagi (Harian, Mingguan, Bulanan) to Excel (.xlsx)
 */
export async function exportAbsensiToExcel(
  attendanceList: AbsenApelItem[],
  mode: 'harian' | 'mingguan' | 'bulanan',
  options: {
    tanggal?: string;
    mingguRefDate?: string;
    bulan?: number; // 1-12
    tahun?: number;
    shareMode?: boolean;
  }
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  const wb = XLSX.utils.book_new();

  if (mode === 'harian') {
    const tgl = options.tanggal || new Date().toISOString().split('T')[0];
    const timeStat = checkApelTimeStatus();

    const titleRows = [
      ['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN'],
      ['KELURAHAN MANGGA'],
      ['REKAPITULASI PRESENSI APEL PAGI 24 KEPALA LINGKUNGAN (HARIAN)'],
      [`Hari / Tanggal: ${tgl}`, `Jadwal Resmi: 07.30 - 08.30 WIB`],
      [],
      [
        'NO',
        'LINGKUNGAN',
        'NAMA KEPALA LINGKUNGAN',
        'STATUS KEHADIRAN',
        'JAM PRESENSI',
        'LOKASI GPS / KETERANGAN',
        'TIDAK APEL (HARI)',
      ],
    ];

    const dataRows = KEPLING_ACCOUNTS.map((k, idx) => {
      const rec = attendanceList.find((a) => a.accountId === k.id && a.tanggal === tgl);
      const absentStat = calculateAbsentDays(attendanceList, k.id, tgl);

      let status = 'Belum Absen';
      let jam = '-';
      let lokasi = '-';

      if (rec) {
        status = rec.status;
        jam = rec.jam || '-';
        lokasi = rec.lokasiGps || rec.catatan || '-';
      } else {
        const isPastCutoff = timeStat.isLate || !timeStat.isWorkDay;
        if (isPastCutoff) {
          status = 'Tidak Mengikuti Apel';
          lokasi = 'Akses ditutup lewat 08.30 WIB';
        }
      }

      return [
        idx + 1,
        k.lingkungan,
        k.nama,
        String(status || '').toUpperCase(),
        jam,
        lokasi,
        status === 'Tidak Mengikuti Apel' ? `${absentStat.consecutiveDays} Hari` : '-',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 38 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Harian');

    const fileName = `Rekap_Absen_Apel_Harian_Mangga_${tgl}.xlsx`;
    const shareTitle = `Rekap Absen Apel Pagi Kelurahan Mangga - ${tgl}`;
    const shareText = `Rekapitulasi resmi presensi apel pagi 24 Kepala Lingkungan Kelurahan Mangga tanggal ${tgl}.`;

    if (options.shareMode) {
      return shareOrDownloadWorkbook(wb, fileName, shareTitle, shareText);
    } else {
      XLSX.writeFile(wb, fileName);
      return { method: 'download', success: true };
    }
  }

  if (mode === 'mingguan') {
    const weekly = computeWeeklyAttendance24(attendanceList, options.mingguRefDate);

    const titleRows = [
      ['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN'],
      ['KELURAHAN MANGGA'],
      ['REKAPITULASI PRESENSI APEL PAGI 24 KEPALA LINGKUNGAN (MINGGUAN)'],
      [`Periode Minggu: ${weekly.weekLabel}`],
      [],
      [
        'NO',
        'LINGKUNGAN',
        'NAMA KEPALA LINGKUNGAN',
        ...weekly.workDates.map((wd) => `${wd.dayName} (${wd.formatted})`),
        'HADIR',
        'TIDAK APEL',
        'IZIN/SAKIT',
        '% KEHADIRAN',
      ],
    ];

    const dataRows = weekly.rows.map((row, idx) => [
      idx + 1,
      row.lingkungan,
      row.nama,
      ...row.days.map((d) => (d.status === 'Hadir' ? '✓ HADIR' : d.status === '-' ? '-' : d.status)),
      row.totalHadir,
      row.totalTidakApel,
      row.totalIzinSakit,
      `${row.persentase}%`,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Mingguan');

    const fileName = `Rekap_Absen_Apel_Mingguan_Mangga.xlsx`;
    const shareTitle = `Rekap Absen Apel Mingguan Kelurahan Mangga`;
    const shareText = `Rekapitulasi mingguan presensi apel pagi 24 Kepling Kelurahan Mangga periode ${weekly.weekLabel}.`;

    if (options.shareMode) {
      return shareOrDownloadWorkbook(wb, fileName, shareTitle, shareText);
    } else {
      XLSX.writeFile(wb, fileName);
      return { method: 'download', success: true };
    }
  }

  // mode === 'bulanan'
  const year = options.tahun || new Date().getFullYear();
  const month = options.bulan || new Date().getMonth() + 1;
  const monthly = computeMonthlyAttendance24(attendanceList, year, month);

  const titleRows = [
    ['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN'],
    ['KELURAHAN MANGGA'],
    ['REKAPITULASI PRESENSI APEL PAGI 24 KEPALA LINGKUNGAN (BULANAN)'],
    [`Bulan: ${monthly.monthName}`, `Total Hari Kerja: ${monthly.totalWorkDays} Hari`],
    [],
    [
      'NO',
      'LINGKUNGAN',
      'NAMA KEPALA LINGKUNGAN',
      'HARI KERJA',
      'HADIR',
      'IZIN',
      'SAKIT',
      'DINAS LUAR',
      'TIDAK APEL',
      'STREAK TIDAK APEL (HARI)',
      '% HADIR',
    ],
  ];

  const dataRows = monthly.rows.map((row, idx) => [
    idx + 1,
    row.lingkungan,
    row.nama,
    row.totalHariKerja,
    row.totalHadir,
    row.totalIzin,
    row.totalSakit,
    row.totalDinasLuar,
    row.totalTidakApel,
    row.consecutiveAbsentDays > 0 ? `${row.consecutiveAbsentDays} Hari` : '-',
    `${row.persentaseHadir}%`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 25 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');

  const fileName = `Rekap_Absen_Apel_Bulanan_Mangga_${year}_${String(month).padStart(2, '0')}.xlsx`;
  const shareTitle = `Rekap Absen Apel Bulanan Kelurahan Mangga - ${monthly.monthName}`;
  const shareText = `Rekapitulasi bulanan presensi apel pagi 24 Kepling Kelurahan Mangga periode ${monthly.monthName}.`;

  if (options.shareMode) {
    return shareOrDownloadWorkbook(wb, fileName, shareTitle, shareText);
  } else {
    XLSX.writeFile(wb, fileName);
    return { method: 'download', success: true };
  }
}
