export interface KinerjaHarian {
  opsirPbbWp: number | string;
  opsirPbbKeterangan?: string;
  perlinsosKk: number | string;
  perlinsosKeterangan?: string;
  ikdOrang: number | string;
  ikdKeterangan?: string;
  bpjsKetenagakerjaanOrang: number | string;
  bpjsKetenagakerjaanKeterangan?: string;
  // Tugas Tambahan POSKAMLING / SISKAMLING
  poskamlingAdaGiat?: boolean;
  poskamlingStatus?: string; // e.g. 'Aktif Ronda', 'Patroli Bersama', 'Pemeriksaan Pos', 'Situasi Kondusif'
  poskamlingLokasi?: string; // e.g. 'Pos Ronda Lingkungan IV'
  poskamlingPetugas?: string; // e.g. 'Kepling & 3 Warga'
  poskamlingKeterangan?: string; // e.g. 'Patroli lingkungan berjalan aman dan kondusif'
  kegiatanLainnya?: string;
}

export interface FotoDokumentasi {
  id: string;
  url: string;
  name: string;
  timestamp: string;
  kategori?: 'poskamling' | 'pbb' | 'perlinsos' | 'ikd' | 'bpjs' | 'umum' | string;
}

export interface LaporanHarianItem {
  id: string;
  keplingId?: string; // e.g. "kepling1", "kepling24"
  hari: string;
  tanggal: string; // e.g. "03 SEPTEMBER 2025" or "YYYY-MM-DD"
  namaKepling: string;
  jabatan: string; // e.g. "Kepala Lingkungan XXIV"
  kelurahan: string; // e.g. "Kelurahan Mangga"
  kecamatan: string; // e.g. "Kecamatan Medan Tuntungan"
  kinerja: KinerjaHarian;
  jumlahDokumentasi: number;
  dokumentasiFoto?: FotoDokumentasi[];
  nomorWaAtasan?: string;
  namaAtasan?: string;
  createdAt: string;
  updatedAt?: string;
  sheetRowIndex?: number;
  spreadsheetUrl?: string;
}

export interface GoogleUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface SheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export type TaskCategory = 'PBB' | 'PERLINSOS' | 'IKD' | 'BPJS' | 'LAPORAN_HARIAN';

export interface TaskReminder {
  id: string;
  category: TaskCategory;
  title: string;
  description: string;
  time: string; // e.g. "09:00"
  enabled: boolean;
  daysOfWeek: number[]; // 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 0=Minggu
  googleCalendarSync?: boolean;
}

export interface NotificationLog {
  id: string;
  title: string;
  message: string;
  category: TaskCategory;
  timestamp: string;
  read: boolean;
}

export interface CalendarScheduleItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: 'LAPORAN_SUBMITTED' | 'TASK_REMINDER';
  category: TaskCategory;
  details: string;
  status: 'COMPLETED' | 'SCHEDULED';
  googleCalendarLink?: string;
  reportId?: string;
}

export type UserRole = 'super_admin' | 'kepling';

export interface UserAccount {
  id: string;
  role: UserRole;
  lingkungan: string; // e.g. "Lingkungan I" or "Kantor Kelurahan"
  nama: string; // e.g. "Juan P. Purba" or "SUPER ADMIN"
  jabatan: string; // e.g. "Kepala Lingkungan I" or "Super Admin Kelurahan Mangga"
  kelurahan: string; // "Kelurahan Mangga"
  kecamatan: string; // "Kecamatan Medan Tuntungan"
  nomorLingkungan?: number; // 1 - 24, undefined for super admin
  password: string; // Password / PIN akun
}

export interface KeplingTargetCapaian {
  keplingId: string; // e.g. "kepling_1"
  nomorLingkungan: number;
  lingkungan: string;
  nama: string;
  // Target kinerja resmi (KK, WP, Orang)
  targetPerlinsos: number; // e.g. 429 KK
  targetPbb?: number; // Target WP (default or custom)
  targetIkd?: number; // Target Orang (default or custom)
  targetBpjs?: number; // Target Orang (default or custom)
  // Super Admin overrides / adjustments on total realized capaian
  overridePerlinsos?: number | null; // direct override on total Perlinsos KK
  overridePbb?: number | null; // direct override on total PBB WP
  overrideIkd?: number | null; // direct override on total IKD Orang
  overrideBpjs?: number | null; // direct override on total BPJS Orang
  catatanPenyesuaian?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type TargetsCapaianMap = Record<string, KeplingTargetCapaian>;

