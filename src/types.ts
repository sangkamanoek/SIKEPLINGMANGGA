export interface KinerjaHarian {
  opsirPbbWp: number | string;
  opsirPbbKeterangan?: string;
  perlinsosKk: number | string;
  perlinsosKeterangan?: string;
  // Pendataan Perlinsos (Pengecekan, Verifikasi, Menolak, Tidak di Tempat)
  perlinsosKategoriKegiatan?: string; // e.g. 'Pendataan', 'Pengecekan', 'Verifikasi', 'Menolak', 'Tidak di Tempat'
  perlinsosMenolakKk?: number | string; // Jumlah KK / warga menolak
  perlinsosMenolakRincian?: string; // Nama & Alamat warga yang menolak
  perlinsosTidakDiTempatKk?: number | string; // Jumlah KK / warga tidak di tempat
  perlinsosTidakDiTempatRincian?: string; // Nama & Alamat warga yang tidak di tempat
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
  // Poin 6: Kegiatan Pemantauan Kondisi Infrastruktur Wilayah
  infrastrukturAdaGiat?: boolean;
  infrastrukturSubjek?: string; // e.g. 'Jalan Rusak / Berlubang', 'Drainase Tersumbat', 'Lampu Jalan Padam'
  infrastrukturLokasi?: string; // Jalan... Lk.. Kelurahan Mangga Kecamatan Medan Tuntungan
  infrastrukturTitikKoordinat?: string; // Berisi Link Google Maps
  infrastrukturTanggalPelaporan?: string;
  infrastrukturPelapor?: string; // Otomatis Nama Kepling
}

export interface FotoDokumentasi {
  id: string;
  url: string;
  name: string;
  timestamp: string;
  kategori?: 'poskamling' | 'pbb' | 'perlinsos' | 'ikd' | 'bpjs' | 'apel' | 'umum' | 'infrastruktur' | 'lainnya' | string;
}

export interface InfoAbsenApelLaporan {
  status: StatusAbsenApel | string;
  jam?: string; // e.g. "07:35 WIB"
  waktuLengkap?: string;
  fotoSelfieUrl?: string;
  lokasiGps?: string;
  catatan?: string;
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
  absenApel?: InfoAbsenApelLaporan;
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

export type UserRole =
  | 'super_admin'
  | 'kepling'
  | 'kasi_pemerintahan'
  | 'kasi_pembangunan'
  | 'kasi_trantibum';

export const isKelurahanAdmin = (role: UserRole | string): boolean => {
  return (
    role === 'super_admin' ||
    role === 'kasi_pemerintahan' ||
    role === 'kasi_pembangunan' ||
    role === 'kasi_trantibum'
  );
};

export interface UserAccount {
  id: string;
  role: UserRole;
  lingkungan: string; // e.g. "Lingkungan I" or "Kantor Kelurahan"
  nama: string; // e.g. "Juan Prananta Purba" or "SUPER ADMIN"
  jabatan: string; // e.g. "Kepala Lingkungan I" or "Super Admin Kelurahan Mangga"
  kelurahan: string; // "Kelurahan Mangga"
  kecamatan: string; // "Kecamatan Medan Tuntungan"
  nomorLingkungan?: number; // 1 - 24, undefined for super admin
  password: string; // Password / PIN akun
  telepon?: string; // Optional contact number
}

export interface UserProfileCustom {
  accountId: string;
  nama?: string;
  telepon?: string;
  updatedAt?: string;
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

export type StatusAbsenApel = 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Tidak Mengikuti Apel';

export interface CustomEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  description?: string;
  required: boolean;
  targetKeplingIds?: string[]; // Array of account IDs
  createdBy: string;
  createdAt: string;
}

export interface EventAttendance {
  id: string; // e.g. "att_eventid_accountId"
  eventId: string;
  accountId: string;
  namaKepling: string;
  lingkungan: string;
  nomorLingkungan?: number;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Tidak Hadir';
  timestamp: string;
  fotoSelfieUrl?: string;
  lokasiGps?: string;
  catatan?: string;
}

export interface AbsenApelItem {
  id: string; // e.g. "absen_kepling_1_2026-09-13" or timestamp
  accountId: string; // e.g. "kepling_1" or "super_admin"
  namaKepling: string;
  lingkungan: string;
  nomorLingkungan?: number;
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:mm:ss WIB
  waktuLengkap: string; // ISO String timestamp
  status: StatusAbsenApel;
  fotoSelfieUrl?: string; // base64 or photo URL
  lokasiGps?: string; // e.g. "3.5234, 98.6123 (GPS Verified)" or "Kelurahan Mangga"
  catatan?: string; // Optional reason for Izin/Sakit/Dinas Luar
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// WEBGIS & PEMETAAN LINGKUNGAN TYPES
// ==========================================

export interface LingkunganPolygon {
  id: string; // e.g. "poly_kepling_1"
  lingkunganId: string; // e.g. "kepling_1"
  lingkunganNomor: number; // 1 - 24
  lingkunganNama: string; // "Lingkungan I"
  keplingNama: string;
  coordinates: [number, number][]; // array of [lat, lng]
  color?: string; // Hex / CSS color
  updatedAt: string;
  updatedBy: string;
}

export type StatusWrs = 'AKTIF' | 'BELUM_MENOLAK' | 'MANDIRI';
export type StatusPbb = 'LUNAS' | 'BELUM_LUNAS' | 'BEBAS_PAJAK';

export interface TitikRumahBangunan {
  id: string;
  lingkunganId: string; // "kepling_1"
  lingkunganNomor: number;
  namaJalan: string; // e.g. "Jl. Bunga Raya Gg. Melati"
  nomorRumah: string; // e.g. "No. 14A"
  namaKepalaKeluarga: string;
  nikKk?: string;
  // Status Kartu Keluarga (KK)
  isKkMangga?: boolean; // true: KK Kelurahan Mangga, false: Bukan KK Mangga (Luar)
  asalKk?: string;
  lat: number;
  lng: number;
  // Demografi
  jumlahJiwa: number;
  jumlahLakiLaki: number;
  jumlahPerempuan: number;
  jumlahLansia: number;
  jumlahAnak: number;
  pekerjaanKk: string;
  // Bansos
  penerimaBansos: boolean;
  jenisBansos?: string[]; // ['PKH', 'BPNT', 'BLT', 'PBI-JK', 'Lainnya']
  desilBansos?: string; // 'Desil 1', 'Desil 2', 'Desil 3', 'Desil 4', 'Desil 5', 'Desil 6-10'
  kategoriRentan?: boolean;
  // WRS (Wajib Retribusi Sampah)
  statusWrs: StatusWrs;
  tarifRetribusi?: number; // e.g. 15000
  petugasSampah?: string;
  // Usaha Rumah / UMKM
  memilikiUsaha?: boolean;
  jenisUsaha?: string;
  namaUsaha?: string;
  // Luas Tanah & Bangunan (m²)
  luasTanahM2?: number;
  luasBangunanM2?: number;
  // Kategori Bangunan & Fasilitas Publik (Rumah Ibadah, Sekolah, dll)
  kategoriBangunan?: 'RUMAH_TINGGAL' | 'RUMAH_USAHA' | 'RUMAH_IBADAH' | 'SEKOLAH' | 'KANTOR_FASUM';
  jenisFasilitas?: string; // e.g. "Gereja", "Masjid", "SD Negeri", "SMP", "Universitas", "Mushola"
  // PBB (Pajak Bumi & Bangunan)
  nopPbb?: string; // e.g. "12.71.010.001.001-0001.0"
  statusPbb?: StatusPbb;
  nominalPbb?: number; // e.g. 150000
  tahunPbb?: number; // e.g. 2026
  fotoRumahUrl?: string;
  catatan?: string;
  createdAt: string;
  updatedAt?: string;
  createdByName?: string;
}

export type KondisiJalanType = 'BAIK' | 'RUSAK_SEDANG' | 'RUSAK_BERAT';
export type KondisiDrainaseType = 'LANCAR' | 'TERSUMBAT' | 'TIDAK_ADA';

export interface RuasJalanLingkungan {
  id: string;
  lingkunganId: string;
  lingkunganNomor: number;
  namaJalan: string;
  panjangMeter: number;
  lebarMeter: number;
  jenisPerkerasan: 'Aspal Hotmix' | 'Rabat Beton' | 'Paving Block' | 'Tanah / Batu' | string;
  kondisiJalan: KondisiJalanType;
  kondisiDrainase: KondisiDrainaseType;
  titikKoordinat?: [number, number]; // center [lat, lng]
  garisKoordinat?: [number, number][]; // line vertices
  jumlahHunianRumah?: number;
  jumlahUsahaToko?: number;
  fotoJalanUrl?: string;
  catatan?: string;
  createdAt: string;
  updatedAt?: string;
  createdByName?: string;
}

