import { KunjunganWargaData } from './kunjunganService';
import { LaporanHarianItem, UserAccount } from '../types';

export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
};

export const formatTanggalIndonesia = (dateStr: string | Date): string => {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

export const getTodayLocalIso = (date?: Date): string => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isReportMatchingKepling = (report: LaporanHarianItem, kepling: UserAccount): boolean => {
  if (report.keplingId === kepling.id) return true;
  if (report.namaKepling?.trim().toLowerCase() === kepling.nama.trim().toLowerCase()) return true;
  if (String(report.lingkungan).trim().toLowerCase() === kepling.lingkungan.trim().toLowerCase()) return true;
  return false;
};

export const generateReportPdfFileName = (..._args: any[]) => 'laporan.pdf';
export const extractNomorLingkungan = (str?: any): number => {
  if (!str) return 0;
  if (typeof str === 'number') {
    return str >= 1 && str <= 24 ? str : 0;
  }
  return getLingkunganIndex(String(str));
};
export const getReportIsoDate = (d: any): string => {
  if (!d || typeof d !== 'object') return getTodayLocalIso();
  if (d.tanggal) {
    const raw = String(d.tanggal).trim();
    // Handle "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Strip day name prefix like "Senin, " or "Minggu, "
    const cleanStr = raw.replace(/^[a-zA-Z]+[,\s]+/, '').trim().toUpperCase();
    const parts = cleanStr.split(/[\s-]+/);
    if (parts.length === 3) {
      if (/^\d{4}$/.test(parts[0])) {
        // YYYY-MM-DD format
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${y}-${m}-${day}`;
      } else {
        // DD MONTH YYYY
        const day = parts[0].padStart(2, '0');
        const monthName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
        const year = parts[2];
        const monthIdx = NAMA_BULAN.findIndex((m) => m.toUpperCase() === monthName.toUpperCase());
        if (monthIdx !== -1) {
          const month = String(monthIdx + 1).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }
  }

  // Fallback to createdAt if valid ISO
  if (d.createdAt && typeof d.createdAt === 'string' && d.createdAt.length >= 10) {
    const isoSub = d.createdAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoSub)) {
      return isoSub;
    }
  }

  return getTodayLocalIso();
};

export const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV'
];

export const getLingkunganIndex = (lingkunganStr?: string): number => {
  if (!lingkunganStr) return 0;
  const matchNum = lingkunganStr.match(/\d+/);
  if (matchNum) {
    const n = parseInt(matchNum[0], 10);
    if (n >= 1 && n <= 24) return n;
  }
  for (let i = 0; i < ROMAN_NUMERALS.length; i++) {
    const rom = ROMAN_NUMERALS[i];
    const reg = new RegExp(`\\b${rom}\\b`, 'i');
    if (reg.test(lingkunganStr)) return i + 1;
  }
  return 0;
};

export const isKunjunganMatchingKepling = (kj: KunjunganWargaData, kepling: UserAccount): boolean => {
  if (!kj || !kepling) return false;
  if (kj.keplingId && kepling.id && kj.keplingId === kepling.id) return true;
  if (kj.namaKepling?.trim().toLowerCase() === kepling.nama.trim().toLowerCase()) return true;
  if (kj.lingkungan?.trim().toLowerCase() === kepling.lingkungan.trim().toLowerCase()) return true;

  const kjLkNum = kj.lingkunganNomor || getLingkunganIndex(kj.lingkungan);
  const keplingLkNum = kepling.nomorLingkungan || getLingkunganIndex(kepling.lingkungan);
  if (kjLkNum > 0 && keplingLkNum > 0 && kjLkNum === keplingLkNum) return true;

  return false;
};

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const formatReportToText = (data: any): string => {
  if (!data) return '';
  const hari = data.hari || (data.tanggal ? getNamaHariIndonesia(data.tanggal) : 'Senin');
  const tanggal = data.tanggal ? formatTanggalIndonesia(data.tanggal) : '';
  const nama = data.namaKepling || '';
  const jabatan = data.jabatan || 'Kepala Lingkungan';

  const kin = data.kinerja || data;
  const pbbWp = kin.opsirPbbWp || data.opsirPbbWp || '0';
  const pbbKet = kin.opsirPbbKeterangan || data.opsirPbbKeterangan || '-';
  
  const perlinsos = kin.perlinsosKk || data.perlinsosKk || '0';
  const perlinsosKet = kin.perlinsosKeterangan || data.perlinsosKeterangan || '-';
  const menolak = kin.perlinsosMenolakKk || data.perlinsosMenolakKk || '0';
  const tidakDiTempat = kin.perlinsosTidakDiTempatKk || data.perlinsosTidakDiTempatKk || '0';

  const ikd = kin.ikdOrang || data.ikdOrang || '0';
  const ikdKet = kin.ikdKeterangan || data.ikdKeterangan || '-';

  const bpjs = kin.bpjsKetenagakerjaanOrang || data.bpjsKetenagakerjaanOrang || '0';
  const bpjsKet = kin.bpjsKetenagakerjaanKeterangan || data.bpjsKetenagakerjaanKeterangan || '-';

  const giatLain = kin.kegiatanLainnya || data.kegiatanLainnya || '-';

  const lines = [
    `*LAPORAN KINERJA HARIAN KEPALA LINGKUNGAN*`,
    `*KELURAHAN MANGGA, KECAMATAN MEDAN TUNTUNGAN*`,
    ``,
    `Hari / Tanggal: ${hari}, ${tanggal}`,
    `Nama: ${nama}`,
    `Jabatan: ${jabatan}`,
    ``,
    `*I. KINERJA LAPANGAN*`,
    `1. Penagihan Opsir PBB: ${pbbWp} WP`,
    `   Keterangan: ${pbbKet}`,
    `2. Pendataan Perlinsos (Door to Door): ${perlinsos} KK (Menolak: ${menolak} KK, Tidak di Tempat: ${tidakDiTempat} KK)`,
    `   Keterangan: ${perlinsosKet}`,
    `3. Aktivasi IKD: ${ikd} Orang`,
    `   Keterangan: ${ikdKet}`,
    `4. Kepesertaan BPJS Ketenagakerjaan: ${bpjs} Orang`,
    `   Keterangan: ${bpjsKet}`,
    `5. Kegiatan Lapangan Lainnya:`,
    `   ${giatLain}`,
  ];

  if (kin.infrastrukturAdaGiat || data.infrastrukturAdaGiat) {
    lines.push(``);
    lines.push(`*II. PEMANTAUAN INFRASTRUKTUR WILAYAH*`);
    lines.push(`Subjek: ${kin.infrastrukturSubjek || data.infrastrukturSubjek || '-'}`);
    lines.push(`Lokasi: ${kin.infrastrukturLokasi || data.infrastrukturLokasi || '-'}`);
    if (kin.infrastrukturTitikKoordinat || data.infrastrukturTitikKoordinat) {
      lines.push(`Koordinat: ${kin.infrastrukturTitikKoordinat || data.infrastrukturTitikKoordinat}`);
    }
  }

  if (kin.poskamlingAdaGiat || data.poskamlingAdaGiat || (kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat')) {
    lines.push(``);
    lines.push(`*III. TUGAS TAMBAHAN / SISKAMLING*`);
    lines.push(`Status: ${kin.poskamlingStatus || data.poskamlingStatus || 'Aktif'}`);
    lines.push(`Lokasi: ${kin.poskamlingLokasi || data.poskamlingLokasi || '-'}`);
    lines.push(`Petugas: ${kin.poskamlingPetugas || data.poskamlingPetugas || '-'}`);
    lines.push(`Jam: ${kin.poskamlingJamOperasional || data.poskamlingJamOperasional || '-'}`);
  }

  if (kin.posyanduAdaGiat || data.posyanduAdaGiat || kin.posyanduNama || data.posyanduNama) {
    lines.push(``);
    lines.push(`*IV. FASILITASI POSYANDU*`);
    lines.push(`Nama Posyandu: ${kin.posyanduNama || data.posyanduNama || '-'}`);
    lines.push(`Lokasi: ${kin.posyanduLokasi || data.posyanduLokasi || '-'}`);
    lines.push(`Jumlah Sasaran: ${kin.posyanduJumlahWargaTotal || data.posyanduJumlahWargaTotal || '0'} Orang`);
  }

  lines.push(``);
  lines.push(`Demikian laporan kinerja ini disampaikan. Terima kasih.`);

  return lines.join('\n');
};

export const getNamaHariIndonesia = (date?: string | Date): string => {
  if (!date) return 'Senin';
  try {
    if (date instanceof Date) {
      return NAMA_HARI[date.getDay()] || 'Senin';
    }
    const str = String(date).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return NAMA_HARI[dt.getDay()] || 'Senin';
    }
    const iso = getReportIsoDate({ tanggal: str });
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return NAMA_HARI[dt.getDay()] || 'Senin';
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return NAMA_HARI[d.getDay()] || 'Senin';
    }
  } catch {}
  return 'Senin';
};

export const isReportMatchingDate = (report: LaporanHarianItem, dateIso: string): boolean => {
  if (!report || !dateIso) return false;
  const targetIso = dateIso.slice(0, 10);
  const repIso = getReportIsoDate(report);
  if (repIso === targetIso) return true;
  if (report.tanggal && report.tanggal.slice(0, 10) === targetIso) return true;
  if (report.createdAt) {
    try {
      if (new Date(report.createdAt).toISOString().slice(0, 10) === targetIso) return true;
    } catch {}
  }
  return false;
};

export const isKunjunganOnDate = (item: KunjunganWargaData | any, dateIsoOrDisplay: string): boolean => {
  if (!item || !dateIsoOrDisplay) return false;
  const target = String(dateIsoOrDisplay).trim();
  const targetIso = /^\d{4}-\d{2}-\d{2}$/.test(target) ? target.slice(0, 10) : getReportIsoDate({ tanggal: target });

  if (item.tanggal) {
    const itemTgl = String(item.tanggal).trim();
    if (itemTgl === target || itemTgl.slice(0, 10) === targetIso) return true;
    const itemIso = getReportIsoDate({ tanggal: itemTgl });
    if (itemIso === targetIso) return true;
  }

  if (item.createdAt) {
    try {
      const createdIso = new Date(item.createdAt).toISOString().slice(0, 10);
      if (createdIso === targetIso) return true;
    } catch {}
  }

  return false;
};

