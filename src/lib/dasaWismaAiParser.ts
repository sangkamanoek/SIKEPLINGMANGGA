import { KelompokDasaWisma } from '../types';

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  sanitizedData: Partial<KelompokDasaWisma>;
}

/**
  * Melakukan verifikasi & validasi logika data Dasa Wisma PKK
  * Sesuai Aturan:
  * 1. (Laki-laki + Perempuan) == Total Jiwa (jika L & P diisi)
  * 2. Jika ada Ibu Hamil (>0), maka WUS minimal = 1
  * 3. Standardisasi penulisan teks (e.g. "pdam" -> "PDAM")
  * 4. Peringatan untuk field utama yang belum terisi
  */
export function validateDasaWismaData(data: Partial<KelompokDasaWisma>): ValidationResult {
  const warnings: string[] = [];
  const sanitized = { ...data };

  // Standardisasi Nama & Teks
  if (sanitized.namaKelompok) {
    let name = sanitized.namaKelompok.trim();
    if (!/^dasa wisma/i.test(name) && !/^dawis/i.test(name)) {
      name = `Dasa Wisma ${name}`;
    }
    sanitized.namaKelompok = name.replace(/\bdawis\b/gi, 'Dasa Wisma');
  } else {
    warnings.push('Nama Kelompok Dasa Wisma belum diisi.');
  }

  // Standardisasi Sumber Air Minum
  if (sanitized.sumberAirMinum) {
    const air = sanitized.sumberAirMinum.toLowerCase();
    if (air.includes('pdam')) sanitized.sumberAirMinum = 'PDAM / Air Perpipaan';
    else if (air.includes('sumur')) sanitized.sumberAirMinum = 'Sumur Bor / Terlindungi';
    else if (air.includes('kemasan') || air.includes('galon')) sanitized.sumberAirMinum = 'Air Galon / Kemasan';
    else if (air.includes('depot') || air.includes('isi ulang')) sanitized.sumberAirMinum = 'Depot Isi Ulang';
    else if (air.includes('mata air')) sanitized.sumberAirMinum = 'Mata Air';
  }

  // Standardisasi Sumber Air Bersih
  if (sanitized.sumberAirBersih) {
    const air = sanitized.sumberAirBersih.toLowerCase();
    if (air.includes('pdam')) sanitized.sumberAirBersih = 'PDAM / Air Perpipaan';
    else if (air.includes('sumur')) sanitized.sumberAirBersih = 'Sumur Bor / Terlindungi';
    else if (air.includes('kemasan') || air.includes('galon')) sanitized.sumberAirBersih = 'Air Galon / Kemasan';
    else if (air.includes('mata air')) sanitized.sumberAirBersih = 'Mata Air';
    else if (air.includes('sungai')) sanitized.sumberAirBersih = 'Sungai / Air Hujan';
  }

  const totalJiwa = Number(sanitized.jumlahJiwa) || 0;
  const jmlL = Number(sanitized.jumlahLakiLaki) || 0;
  const jmlP = Number(sanitized.jumlahPerempuan) || 0;

  // Validasi Jumlah Demografi (Laki-laki + Perempuan = Total Jiwa)
  if (jmlL > 0 || jmlP > 0) {
    const totalHitung = jmlL + jmlP;
    if (totalJiwa > 0 && totalHitung !== totalJiwa) {
      warnings.push(`Jumlah Laki-Laki (${jmlL}) + Perempuan (${jmlP}) = ${totalHitung}, tidak cocok dengan Total Jiwa (${totalJiwa}). Silakan periksa kembali.`);
    } else if (totalJiwa === 0 && totalHitung > 0) {
      sanitized.jumlahJiwa = totalHitung;
    }
  }

  // Validasi Logika Ibu Hamil & WUS (Wanita Usia Subur)
  const bumil = Number(sanitized.jumlahIbuHamil) || 0;
  let wus = Number(sanitized.jumlahWus) || 0;
  if (bumil > 0 && wus < bumil) {
    warnings.push(`Terdapat ${bumil} Ibu Hamil, tetapi Wanita Usia Subur (WUS) dicatat ${wus}. WUS disesuaikan minimal = ${bumil}.`);
    sanitized.jumlahWus = Math.max(wus, bumil);
  }

  // Validasi PUS & WUS
  const pus = Number(sanitized.jumlahPus) || 0;
  wus = Number(sanitized.jumlahWus) || 0;
  if (pus > 0 && wus === 0) {
    warnings.push(`Terdapat Pasangan Usia Subur (${pus} PUS), namun WUS masih 0. [Perlu Konfirmasi]`);
  }

  // Validasi Balita vs Jumlah Jiwa
  const balita = Number(sanitized.jumlahBalita) || 0;
  if (totalJiwa > 0 && balita > totalJiwa) {
    warnings.push(`Jumlah Balita (${balita}) melebihi Total Jiwa (${totalJiwa}). [Perlu Perbaikan]`);
  }

  // Mandatory fields check
  if (!sanitized.namaKetuaDawis) {
    warnings.push('Nama Ketua Dasa Wisma belum diisi.');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    sanitizedData: sanitized,
  };
}

/**
  * Ekstrak teks mentah / catatan WhatsApp / hasil OCR menjadi objek Dasa Wisma terstruktur
  */
export function parseRawTextToDasaWisma(
  rawText: string,
  defaultLingkunganNomor: number = 1
): { parsedData: Partial<KelompokDasaWisma>; validation: ValidationResult } {
  const text = rawText || '';
  const parsedData: Partial<KelompokDasaWisma> = {
    lingkunganNomor: defaultLingkunganNomor,
    lingkunganNama: `Lingkungan ${defaultLingkunganNomor}`,
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    kotaKabupaten: 'Kota Medan',
    rtRw: '00/00',
    jumlahKk: 0,
    jumlahJiwa: 0,
    jumlahLakiLaki: 0,
    jumlahPerempuan: 0,
    jumlahBalita: 0,
    jumlahAnakSekolah: 0,
    jumlahLansia: 0,
    jumlahPus: 0,
    jumlahWus: 0,
    jumlahIbuHamil: 0,
    jumlahIbuMenyusui: 0,
    punyaJambanSehat: 0,
    punyaSpal: 0,
    punyaToga: 0,
    punyaTempatSampah: 0,
    sumberAirMinum: 'Air Galon / Kemasan',
    sumberAirBersih: 'PDAM / Air Perpipaan',
    kriteriaRumahSehat: 0,
    kriteriaRumahKurangSehat: 0,
    kegiatanPosyandu: true,
  };

  // 1. Ekstrak Nama Kelompok
  const namaMatch = text.match(/(?:dasa wisma|dawis|kelompok)\s+([a-zA-Z0-9\s]+?)(?=\n|,| ketua| rt| rw| lk| lingkungan|\d)/i);
  if (namaMatch && namaMatch[1]) {
    parsedData.namaKelompok = `Dasa Wisma ${namaMatch[1].trim()}`;
  } else {
    parsedData.namaKelompok = 'Dasa Wisma Anggrek';
  }

  // 2. Ekstrak Ketua & No Telp
  const ketuaMatch = text.match(/(?:ketua|pimpinan|pengurus)\s*:\s*([a-zA-Z\s'.]+)(?=\n|,|hp|wa|telp|\d)/i);
  if (ketuaMatch && ketuaMatch[1]) {
    parsedData.namaKetuaDawis = ketuaMatch[1].trim();
  }

  const telpMatch = text.match(/(?:hp|wa|telepon|telp|no)\s*:?\s*(08[0-9\-]{8,13})/i);
  if (telpMatch && telpMatch[1]) {
    parsedData.teleponKetua = telpMatch[1].replace(/[^0-9]/g, '');
  }

  // 3. Ekstrak Lingkungan / RT / RW
  const lkMatch = text.match(/(?:lingkungan|lk|dusun)\s*:?\s*(\d+|[ivxLCDM]+)/i);
  if (lkMatch && lkMatch[1]) {
    const num = parseInt(lkMatch[1], 10);
    if (!isNaN(num) && num > 0 && num <= 24) {
      parsedData.lingkunganNomor = num;
      parsedData.lingkunganNama = `Lingkungan ${num}`;
    }
  }

  // 4. Ekstrak Jumlah KK & Jiwa
  const kkMatch = text.match(/(?:kk|kepala keluarga|jumlah kk)\s*:?\s*(\d+)/i);
  if (kkMatch) parsedData.jumlahKk = parseInt(kkMatch[1], 10);

  const jiwaMatch = text.match(/(?:jiwa|warga|total jiwa|anggota)\s*:?\s*(\d+)/i);
  if (jiwaMatch) parsedData.jumlahJiwa = parseInt(jiwaMatch[1], 10);

  const lMatch = text.match(/(?:laki-laki|laki|pria|l)\s*:?\s*(\d+)/i);
  if (lMatch) parsedData.jumlahLakiLaki = parseInt(lMatch[1], 10);

  const pMatch = text.match(/(?:perempuan|wanita|p)\s*:?\s*(\d+)/i);
  if (pMatch) parsedData.jumlahPerempuan = parseInt(pMatch[1], 10);

  // 5. Ekstrak Kelompok Khusus (Balita, Lansia, PUS, WUS, Bumil, Busui)
  const balitaMatch = text.match(/(?:balita|bayi)\s*:?\s*(\d+)/i);
  if (balitaMatch) parsedData.jumlahBalita = parseInt(balitaMatch[1], 10);

  const lansiaMatch = text.match(/(?:lansia|manula)\s*:?\s*(\d+)/i);
  if (lansiaMatch) parsedData.jumlahLansia = parseInt(lansiaMatch[1], 10);

  const pusMatch = text.match(/(?:pus|pasangan usia subur)\s*:?\s*(\d+)/i);
  if (pusMatch) parsedData.jumlahPus = parseInt(pusMatch[1], 10);

  const wusMatch = text.match(/(?:wus|wanita usia subur)\s*:?\s*(\d+)/i);
  if (wusMatch) parsedData.jumlahWus = parseInt(wusMatch[1], 10);

  const bumilMatch = text.match(/(?:ibu hamil|bumil)\s*:?\s*(\d+)/i);
  if (bumilMatch) parsedData.jumlahIbuHamil = parseInt(bumilMatch[1], 10);

  const busuiMatch = text.match(/(?:ibu menyusui|busui|nifas)\s*:?\s*(\d+)/i);
  if (busuiMatch) parsedData.jumlahIbuMenyusui = parseInt(busuiMatch[1], 10);

  // 6. Sanitasi & Lingkungan
  const jambanMatch = text.match(/(?:jamban|wc|kakus)\s*:?\s*(\d+|ada|sehat)/i);
  if (jambanMatch) {
    const num = parseInt(jambanMatch[1], 10);
    parsedData.punyaJambanSehat = !isNaN(num) ? num : (parsedData.jumlahKk || 1);
  }

  const spalMatch = text.match(/(?:spal|parit|drainase)\s*:?\s*(\d+|ada)/i);
  if (spalMatch) {
    const num = parseInt(spalMatch[1], 10);
    parsedData.punyaSpal = !isNaN(num) ? num : (parsedData.jumlahKk || 1);
  }

  const togaMatch = text.match(/(?:toga|tanaman obat|pekarangan)\s*:?\s*(\d+|ada)/i);
  if (togaMatch) {
    const num = parseInt(togaMatch[1], 10);
    parsedData.punyaToga = !isNaN(num) ? num : (parsedData.jumlahKk || 1);
  }

  // Sumber Air Minum vs Bersih
  const minumMatch = text.match(/(?:air minum|minum)\s*:?\s*([a-zA-Z\s/]+)(?=\n|,| bersih| jamban|$)/i);
  if (minumMatch) {
    const air = minumMatch[1].toLowerCase();
    if (air.includes('pdam')) parsedData.sumberAirMinum = 'PDAM / Air Perpipaan';
    else if (air.includes('galon')) parsedData.sumberAirMinum = 'Air Galon / Kemasan';
    else if (air.includes('depot')) parsedData.sumberAirMinum = 'Depot Isi Ulang';
    else if (air.includes('sumur')) parsedData.sumberAirMinum = 'Sumur Bor / Terlindungi';
  }

  const bersihMatch = text.match(/(?:air bersih|bersih)\s*:?\s*([a-zA-Z\s/]+)(?=\n|,| minum| jamban|$)/i);
  if (bersihMatch) {
    const air = bersihMatch[1].toLowerCase();
    if (air.includes('pdam')) parsedData.sumberAirBersih = 'PDAM / Air Perpipaan';
    else if (air.includes('sumur')) parsedData.sumberAirBersih = 'Sumur Bor / Terlindungi';
    else if (air.includes('sungai')) parsedData.sumberAirBersih = 'Sungai / Air Hujan';
  }

  // 7. New Fields from Latest Prompt
  if (/beras/i.test(text)) parsedData.makananPokok = 'Beras';
  else if (/non-beras|jagung|sagu|ubi/i.test(text)) parsedData.makananPokok = 'Non-Beras';

  if (/stiker p4k|stiker/i.test(text)) {
    if (/menempel|ada/i.test(text)) parsedData.stikerP4k = 'Menempel';
    else if (/tidak/i.test(text)) parsedData.stikerP4k = 'Tidak Menempel';
  }

  if (/layak huni|rumah sehat/i.test(text)) parsedData.kriteriaRumah = 'Layak Huni';
  else if (/tidak layak|kurang sehat/i.test(text)) parsedData.kriteriaRumah = 'Tidak Layak Huni';

  const kbMatch = text.match(/(?:kb|akseptor kb)\s*:?\s*(\d+)/i);
  if (kbMatch) parsedData.jumlahAkseptorKb = parseInt(kbMatch[1], 10);

  const nifasMatch = text.match(/(?:nifas|ibu nifas)\s*:?\s*(\d+)/i);
  if (nifasMatch) parsedData.jumlahIbuNifas = parseInt(nifasMatch[1], 10);

  const krtMatch = text.match(/(?:krt|kepala rumah tangga)\s*:?\s*([a-zA-Z\s'.]+)(?=\n|,|hp|wa|telp|\d)/i);
  if (krtMatch && krtMatch[1]) parsedData.namaKrt = krtMatch[1].trim();

  // Flag boolean untuk PTP & Kegiatan Warga
  if (/peternakan|ternak|ayam|kambing|sapi/i.test(text)) parsedData.ptpPeternakan = true;
  if (/perikanan|ikan|lele|kolam/i.test(text)) parsedData.ptpPerikanan = true;
  if (/warung hidup|sayur|cabe|tomat/i.test(text)) parsedData.ptpWarungHidup = true;
  if (/toga|tanaman obat/i.test(text)) parsedData.ptpToga = true;
  if (/pangan|kue|keripik|makanan/i.test(text)) parsedData.industriPangan = true;
  if (/konveksi|jahit|pakaian/i.test(text)) parsedData.industriKonveksi = true;
  if (/posyandu/i.test(text)) parsedData.kegiatanPosyandu = true;
  if (/bkb|bina keluarga balita/i.test(text)) parsedData.kegiatanBkb = true;
  if (/tabulin|tabungan ibu hamil/i.test(text)) parsedData.kegiatanTabulin = true;
  if (/up2k|koperasi/i.test(text)) parsedData.kegiatanUp2kKoperasi = true;

  // Catatan Kegiatan
  parsedData.kegiatanUtama = text.length > 200 ? text.substring(0, 200) + '...' : text;

  // Lakukan validasi hasil ekstraksi
  const validation = validateDasaWismaData(parsedData);

  return {
    parsedData: validation.sanitizedData,
    validation,
  };
}

/**
  * Menghasilkan Ringkasan Laporan (Format Narasi)
  */
export function generateDasaWismaNarrative(item: Partial<KelompokDasaWisma>): string {
  const lines = [
    `Profil ${item.namaKelompok || 'Dasa Wisma Baru'} di ${item.lingkunganNama || 'Wilayah Lingkungan'}.`,
    `Kelompok ini diketuai oleh ${item.namaKetuaDawis || '[Perlu Konfirmasi]'} dengan rincian pendataan sebagai berikut:`,
    `- Populasi: Terdiri dari ${item.jumlahKk || 0} KK dan total ${item.jumlahJiwa || 0} jiwa (${item.jumlahLakiLaki || 0} L / ${item.jumlahPerempuan || 0} P).`,
    `- Kesehatan Ibu & Anak: Terdapat ${item.jumlahBalita || 0} balita, ${item.jumlahIbuHamil || 0} ibu hamil, dan ${item.jumlahIbuMenyusui || 0} ibu menyusui.`,
    `- Pasangan Usia Subur: Tercatat ${item.jumlahPus || 0} PUS dan ${item.jumlahWus || 0} WUS.`,
    `- Lingkungan: Air minum utama adalah ${item.sumberAirMinum || 'Galon'}, sedangkan air bersih menggunakan ${item.sumberAirBersih || 'PDAM'}. Sanitasi meliputi ${item.punyaJambanSehat || 0} jamban sehat dan ${item.punyaSpal || 0} saluran pembuangan limbah.`,
    `- PTP/UP2K: Warga aktif dalam kegiatan ${[
      item.ptpToga || item.punyaToga ? 'Pekarangan TOGA' : '',
      item.ptpWarungHidup ? 'Warung Hidup' : '',
      item.kegiatanUp2kKoperasi ? 'UP2K Koperasi' : '',
      item.kegiatanPosyandu ? 'Posyandu' : ''
    ].filter(Boolean).join(', ') || 'rutin Dasa Wisma'}.`,
    `Status Rumah: ${item.kriteriaRumah || 'Layak Huni'}. Stiker P4K: ${item.stikerP4k || 'Belum Terdata'}.`
  ];
  return lines.join('\n');
}

/**
  * Menghasilkan Tabel Rekapitulasi (Format Markdown)
  */
export function generateDasaWismaMarkdownTable(items: KelompokDasaWisma[]): string {
  const header = `| No | Nama KRT | Jml Anggota (L/P/Ttl) | PUS/WUS | Ibu Hamil/Menyusui | Balita/Lansia | 3 Buta | Makanan Pokok | Air Minum | Air Bersih | Jamban | SPAL | Sampah | Kriteria Rumah | Stiker P4K | UP2K/PTP | Ket |`;
  const separator = `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`;
  
  const rows = items.map((item, idx) => {
    const demographic = `${item.jumlahLakiLaki || 0}/${item.jumlahPerempuan || 0}/${item.jumlahJiwa || 0}`;
    const pusWus = `${item.jumlahPus || 0}/${item.jumlahWus || 0}`;
    const maternal = `${item.jumlahIbuHamil || 0}/${item.jumlahIbuMenyusui || 0}`;
    const childOld = `${item.jumlahBalita || 0}/${item.jumlahLansia || 0}`;
    const activities = [
      item.ptpToga || item.punyaToga ? 'Toga' : '',
      item.ptpWarungHidup ? 'Warung Hidup' : '',
      item.kegiatanUp2kKoperasi ? 'UP2K' : ''
    ].filter(Boolean).join(',');

    return `| ${idx + 1} | ${item.namaKrt || item.namaKetuaDawis || '-'} | ${demographic} | ${pusWus} | ${maternal} | ${childOld} | ${item.jumlahButaAksara || 0} | ${item.makananPokok || 'Beras'} | ${item.sumberAirMinum || 'Galon'} | ${item.sumberAirBersih || 'PDAM'} | ${item.punyaJambanSehat || 0} | ${item.punyaSpal || 0} | ${item.punyaTempatSampah || 0} | ${item.kriteriaRumah || 'Layak'} | ${item.stikerP4k || '-'} | ${activities || '-'} | ${item.validationWarnings?.[0] || '-'} |`;
  });

  return [header, separator, ...rows].join('\n');
}

/**
  * Menghasilkan format tabel CSV / TSV yang siap di copy-paste ke Google Sheets / Excel
  */
export function generateDasaWismaSheetsCsv(items: KelompokDasaWisma[]): string {
  const headers = [
    'No',
    'Nama Kelompok Dasa Wisma',
    'Lingkungan',
    'Nama Ketua',
    'No HP',
    'Jml KK',
    'Total Jiwa',
    'Laki-Laki',
    'Perempuan',
    'PUS',
    'WUS',
    'Ibu Hamil',
    'Ibu Menyusui',
    'Balita',
    'Lansia',
    'Jamban Sehat',
    'SPAL',
    'TOGA',
    'Air Minum',
    'Air Bersih',
    'PTP / Kegiatan',
  ];

  const rows = items.map((item, idx) => {
    const ptpList: string[] = [];
    if (item.ptpToga || item.punyaToga > 0) ptpList.push('TOGA');
    if (item.ptpWarungHidup) ptpList.push('Warung Hidup');
    if (item.ptpPeternakan) ptpList.push('Peternakan');
    if (item.ptpPerikanan) ptpList.push('Perikanan');
    if (item.kegiatanPosyandu) ptpList.push('Posyandu');
    if (item.kegiatanUp2kKoperasi) ptpList.push('UP2K');

    return [
      idx + 1,
      `"${item.namaKelompok || ''}"`,
      `"${item.lingkunganNama || ''}"`,
      `"${item.namaKetuaDawis || ''}"`,
      `"${item.teleponKetua || '-'}"`,
      item.jumlahKk || 0,
      item.jumlahJiwa || 0,
      item.jumlahLakiLaki || 0,
      item.jumlahPerempuan || 0,
      item.jumlahPus || 0,
      item.jumlahWus || 0,
      item.jumlahIbuHamil || 0,
      item.jumlahIbuMenyusui || 0,
      item.jumlahBalita || 0,
      item.jumlahLansia || 0,
      item.punyaJambanSehat || 0,
      item.punyaSpal || 0,
      item.punyaToga || 0,
      `"${item.sumberAirMinum || 'Air Galon'}"`,
      `"${item.sumberAirBersih || 'PDAM'}"`,
      `"${ptpList.join(', ') || 'Rutin Dawis'}"`,
    ].join('\t'); // Gunakan TSV (Tab Separated) agar pas saat paste di Google Sheets
  });

  return [headers.join('\t'), ...rows].join('\n');
}

