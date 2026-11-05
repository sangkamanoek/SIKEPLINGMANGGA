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
export const formatReportToText = (..._args: any[]) => '';
export const extractNomorLingkungan = (..._args: any[]) => 1;
export const getReportIsoDate = (d: any): string => {
  if (!d || typeof d !== 'object' || !d.tanggal) return getTodayLocalIso();
  const t = d.tanggal.trim().toUpperCase();
  // Handle "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // Handle "DD MONTH YYYY" (e.g., "03 SEPTEMBER 2025")
  const parts = t.split(' ');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const year = parts[2];
    const monthIdx = NAMA_BULAN.findIndex(m => m === monthName);
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
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

export const getNamaHariIndonesia = (..._args: any[]) => 'Senin';
export const isReportMatchingDate = (..._args: any[]) => true;
export const isKunjunganOnDate = (..._args: any[]) => true;

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

