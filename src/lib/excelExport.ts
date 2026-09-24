import * as XLSX from 'xlsx';
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
 * Share or download an Excel workbook file
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

    const file = new File([blob], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Check if Web Share API with files is supported (common on Android Chrome, iOS Safari)
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
        // User cancelled share or aborted
        if (err?.name === 'AbortError') {
          return { method: 'share', success: false };
        }
        console.warn('navigator.share failed, fallback to download:', err);
      }
    }

    // Fallback: direct browser download
    triggerFileDownload(blob, fileName);
    return { method: 'download', success: true };
  } catch (err) {
    console.error('Error in shareOrDownloadWorkbook:', err);
    return { method: 'download', success: false };
  }
}

/**
 * Export Kunjungan Warga Lapangan to Excel (.xlsx) and optionally share
 */
export async function exportKunjunganWargaToExcel(
  records: KunjunganWargaData[],
  selectedDate: string,
  shareMode: boolean = false
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  const wb = XLSX.utils.book_new();

  // Create Header Info Rows
  const titleRows = [
    ['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN'],
    ['KELURAHAN MANGGA'],
    ['BUKU REKAPITULASI KUNJUNGAN HARIAN LAPANGAN (DOOR-TO-DOOR)'],
    [`Tanggal: ${selectedDate || 'Semua Tanggal'}`, `Total Kunjungan: ${records.length} Rumah`],
    ['#MedanUntukSemua', '#SemuaUntukMedan'],
    [], // Empty row
    [
      'NO',
      'TANGGAL',
      'NAMA WARGA',
      'ALAMAT LENGKAP',
      'LINGKUNGAN',
      'NAMA KEPALA LINGKUNGAN',
      'STATUS KUNJUNGAN (KETERANGAN)',
      'DOKUMENTASI FOTO',
      'WAKTU PENCATATAN',
    ],
  ];

  // Data Rows
  const dataRows = records.map((item, index) => [
    index + 1,
    item.tanggal,
    item.namaWarga,
    item.alamat,
    item.lingkungan,
    item.namaKepling,
    item.keterangan,
    item.fotoDokumentasi ? 'Tersedia Foto' : 'Tanpa Foto',
    item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID') : '-',
  ]);

  const allRows = [...titleRows, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // NO
    { wch: 14 }, // TANGGAL
    { wch: 25 }, // NAMA WARGA
    { wch: 35 }, // ALAMAT
    { wch: 16 }, // LINGKUNGAN
    { wch: 22 }, // NAMA KEPLING
    { wch: 20 }, // KETERANGAN
    { wch: 18 }, // FOTO
    { wch: 16 }, // WAKTU
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Kunjungan Lapangan');

  const fileName = `Laporan_Kunjungan_Warga_Mangga_${selectedDate || 'Semua'}.xlsx`;
  const shareTitle = `Laporan Kunjungan Lapangan Kelurahan Mangga (${selectedDate})`;
  const shareText = `Berikut rekapitulasi data kunjungan harian lapangan warga door-to-door Kelurahan Mangga tanggal ${selectedDate} (${records.length} rumah).`;

  if (shareMode) {
    return shareOrDownloadWorkbook(wb, fileName, shareTitle, shareText);
  } else {
    XLSX.writeFile(wb, fileName);
    return { method: 'download', success: true };
  }
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
