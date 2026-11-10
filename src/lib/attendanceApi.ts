// Stub types and helper functions for presensi removal compatibility
export type StatusAbsenApel = 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Tidak Mengikuti Apel';

export interface AbsenApelItem {
  id: string;
  accountId: string;
  namaKepling: string;
  lingkungan: string;
  nomorLingkungan?: number;
  tanggal: string;
  status: StatusAbsenApel;
  jam?: string;
  waktuLengkap?: string;
  fotoSelfieUrl?: string;
  lokasiGps?: string;
  catatan?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfoAbsenApelLaporan {
  status: StatusAbsenApel | string;
  jam?: string;
  waktuLengkap?: string;
  fotoSelfieUrl?: string;
  lokasiGps?: string;
  catatan?: string;
}

export const loadAllAttendance = (..._args: any[]) => [];
export const checkApelTimeStatus = (..._args: any[]) => ({
  formattedTime: '08:00 WIB',
  isWorkDay: true,
  isWithinWindow: true,
  isTooEarly: false,
  isLate: false,
  isNetworkVerified: true,
  statusLabel: 'Normal',
});
export const calculateAbsentDays = (..._args: any[]) => ({ consecutiveDays: 0 });
export const isAttendanceMatchingDate = (..._args: any[]) => false;
export const isAttendanceMatchingKepling = (..._args: any[]) => false;
export const subscribeAttendance = (cb: any) => { if (typeof cb === 'function') cb([]); return () => {}; };
export const distinctApelDatesInPeriod = [];
export const filteredAttendanceByPeriod = [];
export const attendanceCache = [];
export const saveStoredAttendance = (..._args: any[]) => {};
export const onNavigateToPresensi = (..._args: any[]) => {};
