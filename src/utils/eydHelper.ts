/**
 * Modul Otomatisasi Penulisan Kaidah Bahasa Indonesia (EYD V / PUEBI)
 * Untuk Kelurahan Mangga, Kecamatan Medan Tuntungan, Kota Medan
 */

export const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV'
];

// Kata tugas (konjungsi / preposisi) yang ditulis huruf kecil di tengah nama/judul
const KATA_TUGAS = new Set([
  'dan', 'atau', 'serta', 'di', 'ke', 'dari', 'pada', 'dalam',
  'untuk', 'dengan', 'tentang', 'oleh', 'yang', 'bin', 'binti', 'sd', 's/d'
]);

// Akronim & singkatan resmi yang wajib huruf kapital seluruhnya
const AKRONIM_KAPITAL = new Set([
  'PKK', 'TP-PKK', 'KRT', 'KK', 'NIK', 'PUS', 'WUS', 'KB', 'TOGA',
  'SPAL', 'WC', 'PTP', 'UP2K', 'P4K', 'PDAM', 'BPJS', 'KTP', 'IKD',
  'PMT', 'ANC', 'PTM', 'LPJU', 'WRS', 'APBD', 'APBN', 'DPRD', 'SDABMBK', 'PERKIM'
]);

/**
 * Mengubah angka 1 - 24 menjadi Angka Romawi resmi (I s/d XXIV)
 */
export const toRomanNumeral = (num: number): string => {
  if (num >= 1 && num <= 24) {
    return ROMAN_NUMERALS[num - 1];
  }
  return String(num);
};

/**
 * Format nama orang sesuai EYD (Title Case dengan pengecualian partikel)
 * Contoh: "nur aisyah lubis" -> "Nur Aisyah Lubis"
 * Contoh: "ahmad bin abdullah" -> "Ahmad bin Abdullah"
 */
export const formatNamaEyd = (rawName?: string | null): string => {
  if (!rawName) return '-';
  const clean = rawName.trim().replace(/\s+/g, ' ');
  if (!clean) return '-';

  const words = clean.split(' ');
  const formatted = words.map((w, idx) => {
    const lower = w.toLowerCase();

    // Cek partikel bin / binti di tengah nama
    if (idx > 0 && (lower === 'bin' || lower === 'binti')) {
      return lower;
    }

    // Cek akronim gelar seperti S.Pd, S.Sos, M.Kes, Dra., dr., dsb.
    if (w.includes('.')) {
      return w;
    }

    // Cek nama dengan apostrof seperti Ma'ruf, D'Costa
    if (w.includes("'")) {
      return w.split("'").map((part) => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join("'");
    }

    // Cek nama dengan tanda hubung seperti Siti-Aminah
    if (w.includes('-')) {
      return w.split('-').map((part) => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('-');
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return formatted.join(' ');
};

/**
 * Format nama kelompok Dasa Wisma sesuai EYD
 * Contoh: "dasa wisma lily 1" -> "Dasa Wisma Lily I"
 * Contoh: "mawar ii" -> "Dasa Wisma Mawar II"
 */
export const formatKelompokEyd = (rawKelompok?: string | null): string => {
  if (!rawKelompok) return '';
  let str = rawKelompok.trim().replace(/\s+/g, ' ');
  if (!str) return '';

  // Bersihkan semua kemungkinan duplikasi awalan seperti "Dasa Wisma Dasawisma", "Dasawisma", "Dawis", dsb.
  while (/^(dasa\s*wisma|dasawisma|dawis)\b\s*/i.test(str)) {
    str = str.replace(/^(dasa\s*wisma|dasawisma|dawis)\b\s*/i, '').trim();
  }

  // Jika nama kelompok setelah dibersihkan kosong, kembalikan 'Dasa Wisma'
  if (!str) return 'Dasa Wisma';

  // Pisahkan per kata untuk format sisa nama kelompok
  const words = str.split(' ');
  const formattedWords = words.map((w, idx) => {
    const lower = w.toLowerCase();
    const upper = w.toUpperCase();

    // Cek jika kata adalah angka romawi yang sudah diketik (i, ii, iii, dll.)
    if (ROMAN_NUMERALS.includes(upper)) {
      return upper;
    }

    // Cek jika kata adalah digit angka (misal "1", "2", "24")
    const num = parseInt(w, 10);
    if (!isNaN(num) && num >= 1 && num <= 24 && String(num) === w) {
      return toRomanNumeral(num);
    }

    if (idx > 0 && KATA_TUGAS.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return `Dasa Wisma ${formattedWords.join(' ')}`;
};

/**
 * Format alamat jalan/gang sesuai EYD & standar tata naskah
 * Contoh: "jl. vanili raya gg. melati no 12" -> "Jl. Vanili Raya Gg. Melati No. 12"
 */
export const formatAlamatEyd = (rawAlamat?: string | null): string => {
  if (!rawAlamat) return '-';
  let str = rawAlamat.trim().replace(/\s+/g, ' ');
  if (!str) return '-';

  // Standardisasi singkatan umum
  str = str.replace(/\b(jalan|jln|jl)\b\.?/gi, 'Jl.');
  str = str.replace(/\b(gang|gng|gg)\b\.?/gi, 'Gg.');
  str = str.replace(/\b(nomor|nmr|no)\b\.?/gi, 'No.');
  str = str.replace(/\b(komplek|kompleks|komp)\b\.?/gi, 'Komp.');
  str = str.replace(/\b(blok|blk)\b\.?/gi, 'Blok');
  str = str.replace(/\b(lingkungan|lingk|lk)\b\.?/gi, 'Lingkungan');
  str = str.replace(/\brt\b\.?/gi, 'RT');
  str = str.replace(/\brw\b\.?/gi, 'RW');

  const words = str.split(' ');
  const formatted = words.map((w, idx) => {
    // Jika sudah singkatan khusus bertitik (Jl., Gg., No., Komp.)
    if (/^(Jl\.|Gg\.|No\.|Komp\.|RT|RW|Blok)$/i.test(w)) {
      if (w.toLowerCase() === 'rt') return 'RT';
      if (w.toLowerCase() === 'rw') return 'RW';
      if (w.toLowerCase() === 'blok') return 'Blok';
      if (w.toLowerCase().startsWith('jl')) return 'Jl.';
      if (w.toLowerCase().startsWith('gg')) return 'Gg.';
      if (w.toLowerCase().startsWith('no')) return 'No.';
      if (w.toLowerCase().startsWith('komp')) return 'Komp.';
    }

    const lower = w.toLowerCase();
    const upper = w.toUpperCase();

    if (ROMAN_NUMERALS.includes(upper)) {
      return upper;
    }

    if (idx > 0 && KATA_TUGAS.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return formatted.join(' ');
};

/**
 * Format teks umum / judul / keterangan sesuai EYD
 */
export const formatTeksEyd = (rawText?: string | null): string => {
  if (!rawText) return '-';
  const clean = rawText.trim().replace(/\s+/g, ' ');
  if (!clean) return '-';

  const words = clean.split(' ');
  const formatted = words.map((w, idx) => {
    const lower = w.toLowerCase();
    const upper = w.toUpperCase();

    if (AKRONIM_KAPITAL.has(upper)) {
      return upper;
    }

    if (ROMAN_NUMERALS.includes(upper)) {
      return upper;
    }

    if (idx > 0 && KATA_TUGAS.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return formatted.join(' ');
};

/**
 * Format nomor telepon Indonesia agar rapi dan mudah dibaca
 * Contoh: "081234567890" -> "0812-3456-7890"
 */
export const formatNomorTelepon = (rawPhone?: string | null): string => {
  if (!rawPhone) return '-';
  const digits = rawPhone.replace(/[^0-9+]/g, '');
  if (!digits) return '-';

  if (digits.startsWith('08') && digits.length >= 10 && digits.length <= 13) {
    if (digits.length === 10) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 11) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 12) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
    } else {
      return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
  }

  return rawPhone.trim();
};

/**
 * Format tanggal resmi bahasa Indonesia untuk dokumen pemerintahan
 * Contoh: "Medan, 4 November 2026"
 */
export const formatTanggalResmiIndonesia = (dateInput?: Date | string | null): string => {
  const d = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const tgl = validDate.getDate();
  const bln = BULAN_INDONESIA[validDate.getMonth()];
  const thn = validDate.getFullYear();

  return `Medan, ${tgl} ${bln} ${thn}`;
};
