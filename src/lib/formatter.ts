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

export const isReportMatchingKepling = (..._args: any[]) => true;
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

export const isKunjunganMatchingKepling = (..._args: any[]) => true;
export const getNamaHariIndonesia = (..._args: any[]) => 'Senin';
export const isReportMatchingDate = (..._args: any[]) => true;
export const isKunjunganOnDate = (..._args: any[]) => true;

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
