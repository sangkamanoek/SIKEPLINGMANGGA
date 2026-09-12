import { LaporanHarianItem } from '../types';

export const NAMA_HARI = [
  'MINGGU',
  'SENIN',
  'SELASA',
  'RABU',
  'KAMIS',
  'JUMAT',
  'SABTU',
];

export const NAMA_BULAN = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

export function getNamaHariIndonesia(d: Date): string {
  return NAMA_HARI[d.getDay()];
}

export function getTodayLocalIso(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTanggalIndonesia(d: Date): string {
  const tgl = String(d.getDate()).padStart(2, '0');
  const bulan = NAMA_BULAN[d.getMonth()];
  const tahun = d.getFullYear();
  return `${tgl} ${bulan} ${tahun}`;
}

/**
 * Normalisasi tanggal laporan ke format ISO YYYY-MM-DD
 * Mendukung format string "01 SEPTEMBER 2026", "1 September 2026", "SABTU, 1 SEPTEMBER 2026", "2026-09-01", maupun r.createdAt ISO.
 */
export function getReportIsoDate(r: LaporanHarianItem | any): string {
  if (!r) return '';

  // 1. Prioritas Utama: Ekstraksi dari r.tanggal (input resmi dari form kepling)
  if (r.tanggal) {
    const t = String(r.tanggal).trim();

    // Format YYYY-MM-DD
    if (t.match(/^\d{4}-\d{2}-\d{2}$/)) return t;

    // Format DD-MM-YYYY atau DD/MM/YYYY
    const ddmmyyyy = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // Format Nama Bulan (contoh: "01 SEPTEMBER 2026", "1 SEPTEMBER 2026", "SABTU, 1 SEPTEMBER 2026", "1 Sept 2026")
    const monthNameMatch = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (monthNameMatch) {
      const day = monthNameMatch[1].padStart(2, '0');
      const monthStr = monthNameMatch[2].toUpperCase();
      const year = monthNameMatch[3];

      let monthIdx = NAMA_BULAN.findIndex(
        (b) => b.startsWith(monthStr) || monthStr.startsWith(b.slice(0, 3))
      );
      if (monthIdx >= 0) {
        const month = String(monthIdx + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }

  // 2. Fallback: Ekstraksi dari r.createdAt
  if (r.createdAt && typeof r.createdAt === 'string') {
    if (r.createdAt.includes('T')) {
      const iso = r.createdAt.split('T')[0];
      if (iso.match(/^\d{4}-\d{2}-\d{2}$/)) return iso;
    }
    if (r.createdAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return r.createdAt;
    }
  }

  return '';
}

/**
 * Memeriksa apakah laporan sesuai dengan tanggal target ISO YYYY-MM-DD.
 * Menangani fleksibilitas format (misal "1 SEPTEMBER 2026" vs "01 SEPTEMBER 2026", "2026-09-01").
 */
export function isReportMatchingDate(r: LaporanHarianItem | any, targetDateIso: string): boolean {
  if (!r || !targetDateIso) return true;

  const reportIso = getReportIsoDate(r);
  if (reportIso && reportIso === targetDateIso) {
    return true;
  }

  // Fallback: Cek r.createdAt split
  if (r.createdAt && typeof r.createdAt === 'string') {
    const createdIso = r.createdAt.split('T')[0];
    if (createdIso === targetDateIso) {
      return true;
    }
  }

  // Fallback: Match string tanggal
  if (r.tanggal) {
    const tglLower = String(r.tanggal).toLowerCase();
    const parts = targetDateIso.split('-');
    if (parts.length === 3) {
      const selYear = parts[0];
      const selMonthIdx = parseInt(parts[1], 10) - 1;
      const selDay = parseInt(parts[2], 10);
      const selDayPadded = String(selDay).padStart(2, '0');
      const monthName = NAMA_BULAN[selMonthIdx]?.toLowerCase() || '';

      const hasYear = tglLower.includes(selYear);
      const hasMonth = monthName && (tglLower.includes(monthName) || tglLower.includes(monthName.slice(0, 3)));
      const hasDay =
        new RegExp(`\\b${selDay}\\b`).test(tglLower) ||
        new RegExp(`\\b${selDayPadded}\\b`).test(tglLower);

      if (hasYear && hasMonth && hasDay) {
        return true;
      }
    }
  }

  return false;
}

export function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function generateLaporanWhatsAppText(item: LaporanHarianItem): string {
  const lines: string[] = [];

  lines.push('*🟩 LAPORAN KEGIATAN HARIAN*');
  lines.push(`*${(item.jabatan || 'KEPALA LINGKUNGAN').toUpperCase()}*`);
  lines.push(`*${(item.kelurahan || 'KELURAHAN MANGGA').toUpperCase()}*`);
  lines.push(`*${(item.kecamatan || 'KECAMATAN MEDAN TUNTUNGAN').toUpperCase()}*`);
  lines.push('');
  lines.push(`📅 *Hari*        : ${item.hari.toUpperCase()}`);
  lines.push(`📆 *Tanggal*    : ${item.tanggal.toUpperCase()}`);
  lines.push(`👤 *Nama*       : ${item.namaKepling}`);
  lines.push(`🏷️ *Jabatan*    : ${item.jabatan}`);
  lines.push('');
  lines.push('📋 *KINERJA HARIAN:*');

  const kin = item.kinerja || ({} as Record<string, any>);

  // 1. Opsir PBB
  const pbbValue = kin.opsirPbbWp ? `${kin.opsirPbbWp} WP` : '-';
  const pbbKet = kin.opsirPbbKeterangan ? ` (${kin.opsirPbbKeterangan})` : '';
  lines.push(`1. OPSIR PBB : ${pbbValue}${pbbKet}`);

  // 2. Perlinsos
  const perlinsosVal = kin.perlinsosKk ? `${kin.perlinsosKk} KK` : '-';
  const perlinsosKet = kin.perlinsosKeterangan ? ` (${kin.perlinsosKeterangan})` : '';
  lines.push(`2. PERLINSOS : ${perlinsosVal}${perlinsosKet}`);

  // 3. IKD
  const ikdVal = kin.ikdOrang ? `${kin.ikdOrang} ORANG` : '-';
  const ikdKet = kin.ikdKeterangan ? ` (${kin.ikdKeterangan})` : '';
  lines.push(`3. IDENTITAS KEPENDUDUKAN DIGITAL : ${ikdVal}${ikdKet}`);

  // 4. BPJS Ketenagakerjaan
  const bpjsVal = kin.bpjsKetenagakerjaanOrang ? `${kin.bpjsKetenagakerjaanOrang} ORANG` : '-';
  const bpjsKet = kin.bpjsKetenagakerjaanKeterangan ? ` (${kin.bpjsKetenagakerjaanKeterangan})` : '';
  lines.push(`4. BPJS KETENAGAKERJAAN : ${bpjsVal}${bpjsKet}`);

  // 5. Poskamling / Siskamling if active
  if (kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat') {
    const pStatus = kin.poskamlingStatus;
    const pLokasi = kin.poskamlingLokasi ? ` (${kin.poskamlingLokasi})` : '';
    const pPetugas = kin.poskamlingPetugas ? ` - Petugas: ${kin.poskamlingPetugas}` : '';
    const pKet = kin.poskamlingKeterangan ? ` [${kin.poskamlingKeterangan}]` : '';
    lines.push(`5. POSKAMLING / SISKAMLING : ${pStatus}${pLokasi}${pPetugas}${pKet}`);
  }

  // 6. Kegiatan Tambahan / Lainnya if any
  if (kin.kegiatanLainnya && kin.kegiatanLainnya.trim()) {
    lines.push(`6. KEGIATAN LAINNYA : ${kin.kegiatanLainnya.trim()}`);
  }

  lines.push('');
  lines.push('📷 *(Dokumentasi Terlampir)*');
  if (item.jumlahDokumentasi && item.jumlahDokumentasi > 0) {
    lines.push(`   _(${item.jumlahDokumentasi} foto terlampir)_`);
  }
  lines.push('');
  lines.push('#MedanUntukSemua');
  lines.push('#SemuaUntukMedan');

  return lines.join('\n');
}

export function buildWhatsAppShareUrl(phone: string, text: string): string {
  const cleaned = cleanPhoneNumber(phone);
  const encoded = encodeURIComponent(text);
  if (cleaned) {
    return `https://api.whatsapp.com/send?phone=${cleaned}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

const ROMAN_NUMERALS: [string, number][] = [
  ['XXIV', 24], ['XXIII', 23], ['XXII', 22], ['XXI', 21], ['XX', 20],
  ['XIX', 19], ['XVIII', 18], ['XVII', 17], ['XVI', 16], ['XV', 15],
  ['XIV', 14], ['XIII', 13], ['XII', 12], ['XI', 11], ['X', 10],
  ['IX', 9], ['VIII', 8], ['VII', 7], ['VI', 6], ['V', 5],
  ['IV', 4], ['III', 3], ['II', 2], ['I', 1]
];

/**
 * Ekstraksi nomor lingkungan (1 - 24) secara presisi tanpa salah mengenali angka romawi.
 * Mencegah bug di mana "Lingkungan XX" salah terbaca sebagai "Lingkungan X".
 */
export function extractNomorLingkungan(text?: string | null): number | null {
  if (!text) return null;
  const upper = text.toUpperCase().trim();

  // 1. Cek pola angka eksplisit: "Lingkungan 20", "LK 10", "Kepling 5"
  const numMatch = upper.match(/\b(?:LINGKUNGAN|KEPLING|LK)\s*(\d{1,2})\b/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 24) return n;
  }

  // 2. Cek angka Romawi yang didahului kata Lingkungan/Kepling: "Lingkungan XX", "Kepala Lingkungan X"
  for (const [roman, num] of ROMAN_NUMERALS) {
    const regex = new RegExp(`\\b(?:LINGKUNGAN|KEPLING|LK)\\s+${roman}\\b`, 'i');
    if (regex.test(upper)) {
      return num;
    }
  }

  // 3. Cek angka Romawi berdiri sendiri dengan word boundary
  for (const [roman, num] of ROMAN_NUMERALS) {
    const regex = new RegExp(`\\b${roman}\\b`, 'i');
    if (regex.test(upper)) {
      return num;
    }
  }

  return null;
}

/**
 * Validasi apakah sebuah laporan benar-benar milik akun Kepling tertentu.
 * Menggunakan pencocokan keplingId, nama lengkap, dan nomor lingkungan eksak.
 * Menghindari penggunaan substring .includes('Lingkungan X') yang dapat salah mencocokkan 'Lingkungan XX'.
 */
export function isReportMatchingKepling(
  report: LaporanHarianItem,
  kepling: { id: string; nama: string; nomorLingkungan?: number; jabatan?: string; lingkungan?: string }
): boolean {
  if (!report || !kepling) return false;

  // 1. Jika laporan memiliki keplingId, cek kecocokan ID terlebih dahulu
  if (report.keplingId && kepling.id) {
    const rId = report.keplingId.toLowerCase().replace(/_/g, '');
    const kId = kepling.id.toLowerCase().replace(/_/g, '');
    if (rId === kId) {
      return true;
    }
  }

  // 2. Pencocokan nama lengkap (case-insensitive & trimmed)
  if (report.namaKepling && kepling.nama) {
    const rName = report.namaKepling.trim().toLowerCase();
    const kName = kepling.nama.trim().toLowerCase();
    if (rName === kName) {
      return true;
    }
  }

  // 3. Pencocokan nomor lingkungan eksak (1 s/d 24)
  const reportLingkunganNum =
    extractNomorLingkungan(report.jabatan) ||
    extractNomorLingkungan((report as any).lingkungan);

  if (reportLingkunganNum !== null && kepling.nomorLingkungan) {
    return reportLingkunganNum === kepling.nomorLingkungan;
  }

  // 4. Pencocokan string jabatan/lingkungan secara utuh (equality, BUKAN includes)
  const rJabatan = (report.jabatan || '').trim().toLowerCase();
  const kJabatan = (kepling.jabatan || '').trim().toLowerCase();
  const kLingkungan = (kepling.lingkungan || '').trim().toLowerCase();

  if (rJabatan && (rJabatan === kJabatan || rJabatan === kLingkungan)) {
    return true;
  }

  return false;
}

