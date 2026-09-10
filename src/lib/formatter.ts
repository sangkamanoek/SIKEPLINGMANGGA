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

  // 1. Opsir PBB
  const pbbValue = item.kinerja.opsirPbbWp ? `${item.kinerja.opsirPbbWp} WP` : '-';
  const pbbKet = item.kinerja.opsirPbbKeterangan ? ` (${item.kinerja.opsirPbbKeterangan})` : '';
  lines.push(`1. OPSIR PBB : ${pbbValue}${pbbKet}`);

  // 2. Perlinsos
  const perlinsosVal = item.kinerja.perlinsosKk ? `${item.kinerja.perlinsosKk} KK` : '-';
  const perlinsosKet = item.kinerja.perlinsosKeterangan ? ` (${item.kinerja.perlinsosKeterangan})` : '';
  lines.push(`2. PERLINSOS : ${perlinsosVal}${perlinsosKet}`);

  // 3. IKD
  const ikdVal = item.kinerja.ikdOrang ? `${item.kinerja.ikdOrang} ORANG` : '-';
  const ikdKet = item.kinerja.ikdKeterangan ? ` (${item.kinerja.ikdKeterangan})` : '';
  lines.push(`3. IDENTITAS KEPENDUDUKAN DIGITAL : ${ikdVal}${ikdKet}`);

  // 4. BPJS Ketenagakerjaan
  const bpjsVal = item.kinerja.bpjsKetenagakerjaanOrang ? `${item.kinerja.bpjsKetenagakerjaanOrang} ORANG` : '-';
  const bpjsKet = item.kinerja.bpjsKetenagakerjaanKeterangan ? ` (${item.kinerja.bpjsKetenagakerjaanKeterangan})` : '';
  lines.push(`4. BPJS KETENAGAKERJAAN : ${bpjsVal}${bpjsKet}`);

  // 5. Poskamling / Siskamling if active
  if (item.kinerja.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat') {
    const pStatus = item.kinerja.poskamlingStatus;
    const pLokasi = item.kinerja.poskamlingLokasi ? ` (${item.kinerja.poskamlingLokasi})` : '';
    const pPetugas = item.kinerja.poskamlingPetugas ? ` - Petugas: ${item.kinerja.poskamlingPetugas}` : '';
    const pKet = item.kinerja.poskamlingKeterangan ? ` [${item.kinerja.poskamlingKeterangan}]` : '';
    lines.push(`5. POSKAMLING / SISKAMLING : ${pStatus}${pLokasi}${pPetugas}${pKet}`);
  }

  // 6. Kegiatan Tambahan / Lainnya if any
  if (item.kinerja.kegiatanLainnya && item.kinerja.kegiatanLainnya.trim()) {
    lines.push(`6. KEGIATAN LAINNYA : ${item.kinerja.kegiatanLainnya.trim()}`);
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
