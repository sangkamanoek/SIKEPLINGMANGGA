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
  poskamlingJumlahPetugas?: number | string; // e.g. 4 or '4 Orang'
  poskamlingJamOperasional?: string; // e.g. '21.00 - 04.00 WIB'
  poskamlingKeterangan?: string; // e.g. 'Patroli lingkungan berjalan aman dan kondusif'

  // Tugas Tambahan POSYANDU & LAYANAN KESEHATAN WARGA
  posyanduAdaGiat?: boolean;
  posyanduNama?: string; // e.g. 'Posyandu Melati Lingkungan IV'
  posyanduLokasi?: string; // e.g. 'Balai Warga Jl. Bunga Rinte No. 12'
  posyanduJumlahPetugasKader?: number | string; // e.g. '5 Kader + 1 Bidan Kelurahan'
  posyanduJumlahWargaTotal?: number | string; // Total kumulatif warga dilayani
  // Rincian Kelompok Usia Lengkap dari 0 Tahun sampai Lansia
  posyanduBayi02Tahun?: number | string; // Usia 0 - 2 Tahun (0-23 bulan / Baduta & Imunisasi)
  posyanduBalita25Tahun?: number | string; // Usia 2 - 5 Tahun (24-59 bulan / Balita & Stunting)
  posyanduAnak612Tahun?: number | string; // Usia 6 - 12 Tahun (Pra-Sekolah & Anak Sekolah)
  posyanduRemaja1318Tahun?: number | string; // Usia 13 - 18 Tahun (Remaja & Konseling)
  posyanduDewasaIbuHamil1959Tahun?: number | string; // Usia 19 - 59 Tahun (Ibu Hamil, Busui, Usia Produktif)
  posyanduLansia60TahunKeatas?: number | string; // Usia 60+ Tahun (Lansia / Lanjut Usia & PTM)
  posyanduJenisLayanan?: string[]; // ['Penimbangan & Pengukuran Stunting', 'Imunisasi Lengkap', 'Pemberian Vitamin A & Obat Cacing', 'PMT Balita/Bumil', 'Pemeriksaan ANC Bumil', 'Skrining Lansia & PTM', 'Integrasi Layanan Primer (ILP)']
  posyanduKeterangan?: string; // Catatan hasil posyandu
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
  namaFile?: string;
  timestamp: string;
  kategori?: 'poskamling' | 'posyandu' | 'pbb' | 'perlinsos' | 'ikd' | 'bpjs' | 'apel' | 'umum' | 'infrastruktur' | 'lainnya' | string;
  keterangan?: string;
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
  petugasNama?: string;
  petugasRole?: string;
  tanggalLaporan?: string;
  lingkungan?: string | number;
  uraianTugas?: string;
  catatanUmum?: string;
  nomorWaAtasan?: string;
  namaAtasan?: string;
  createdAt: string;
  updatedAt?: string;
  sheetRowIndex?: number;
  spreadsheetUrl?: string;
}

export interface PosyanduReport {
  id: string;
  pkkLingkunganId: string; // ID of the PKK Lingkungan account
  namaPetugas: string;
  lingkungan: string;
  nomorLingkungan: number;
  tanggal: string; // ISO date YYYY-MM-DD
  posyanduNama: string;
  posyanduLokasi: string;
  posyanduJumlahPetugasKader: number | string;
  posyanduJumlahWargaTotal: number;
  posyanduBayi02Tahun: number;
  posyanduBalita25Tahun: number;
  posyanduAnak612Tahun: number;
  posyanduRemaja1318Tahun: number;
  posyanduDewasaIbuHamil1959Tahun: number;
  posyanduLansia60TahunKeatas: number;
  posyanduJenisLayanan: string[];
  posyanduKeterangan: string;
  dokumentasiFoto?: FotoDokumentasi[];
  createdAt: string;
  updatedAt?: string;
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
  rootFolderId?: string;
  rootFolderUrl?: string;
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
  | 'sekretaris'
  | 'kepling'
  | 'kasi_pemerintahan'
  | 'kasi_pembangunan'
  | 'kasi_trantibum'
  | 'petugas_bapenda'
  | 'ketua_pkk_kelurahan'
  | 'ketua_pokja'
  | 'ketua_pkk_lingkungan'
  | 'sekretaris_pkk';

export const isKelurahanAdmin = (role: UserRole | string): boolean => {
  return (
    role === 'super_admin' ||
    role === 'sekretaris' ||
    role === 'kasi_pemerintahan' ||
    role === 'kasi_pembangunan' ||
    role === 'kasi_trantibum' ||
    role === 'petugas_bapenda'
  );
};

export const isPkkRole = (role: UserRole | string): boolean => {
  return (
    role === 'ketua_pkk_kelurahan' ||
    role === 'ketua_pokja' ||
    role === 'ketua_pkk_lingkungan' ||
    role === 'sekretaris_pkk'
  );
};

export const isKelurahanRole = (role: UserRole | string): boolean => {
  return (
    role === 'kepling' ||
    role === 'sekretaris' ||
    role === 'kasi_pemerintahan' ||
    role === 'kasi_pembangunan' ||
    role === 'kasi_trantibum' ||
    role === 'petugas_bapenda'
  );
};

export type KepalaSeksiRole = 'kasi_pemerintahan' | 'kasi_pembangunan' | 'kasi_trantibum';

export interface KepalaSeksiBidangTugas {
  judul: string;
  deskripsi: string;
  poinPenting: string[];
}

export interface KepalaSeksiIndikator {
  label: string;
  target: string;
  satuan: string;
}

export interface KepalaSeksiFitur {
  namaFitur: string;
  kegunaan: string;
}

export interface KepalaSeksiProfile {
  id: string; // 'kasi_pemerintahan' | 'kasi_pembangunan' | 'kasi_trantibum'
  role: KepalaSeksiRole;
  namaSeksi: string; // e.g. "Seksi Tata Pemerintahan"
  singkatan: string; // e.g. "Kasi Tata Pemerintahan (PBB, IKD & Apel)"
  namaPejabat: string; // e.g. "KASI TATA PEMERINTAHAN"
  nip?: string;
  telepon?: string;
  usernameUtama: string; // 'kasi_pemerintahan'
  usernameAliases: string[];
  passwordDefault: string; // 'pem_mangga2026'
  iconKey: 'pemerintahan' | 'pembangunan' | 'trantibum';
  tupoksiRingkas: string;
  bidangTugas: KepalaSeksiBidangTugas[];
  indikatorKinerja: KepalaSeksiIndikator[];
  fiturAplikasi: KepalaSeksiFitur[];
  catatanOperasional?: string;
  updatedAt?: string;
}

export interface UserAccount {
  id: string;
  role: UserRole;
  lingkungan: string; // e.g. "Lingkungan I" or "Kantor Kelurahan"
  nama: string; // e.g. "Juan Prananta Purba" or "SUPER ADMIN"
  namaLengkap?: string;
  jabatan: string; // e.g. "Kepala Lingkungan I" or "Super Admin Kelurahan Mangga"
  kelurahan: string; // "Kelurahan Mangga"
  kecamatan: string; // "Kecamatan Medan Tuntungan"
  nomorLingkungan?: number; // 1 - 24, undefined for super admin
  password: string; // Password / PIN akun
  telepon?: string; // Optional contact number
  nip?: string; // NIP Pejabat ASN
  aliases?: string[];
  legacyPasswords?: string[];
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
  tanggal?: string;
  timestamp: string;
  createdAt?: string;
  fotoSelfieUrl?: string;
  lokasiGps?: string;
  catatan?: string;
}

export interface AbsenApelItem {
  id: string; // e.g. "absen_kepling_1_2026-09-13" or timestamp
  accountId: string; // e.g. "kepling_1" or "super_admin"
  keplingId?: string;
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

export type StatusWrs = 'AKTIF' | 'BELUM_MENOLAK' | 'MANDIRI' | 'BEBAS_WRS';
export type StatusPbb = 'LUNAS' | 'BELUM_LUNAS' | 'BEBAS_PAJAK';

export interface TitikRumahBangunan {
  id: string;
  lingkunganId: string; // "kepling_1"
  lingkunganNomor: number;
  namaJalan: string; // e.g. "Jl. Bunga Raya Gg. Melati"
  namaGang?: string;
  nomorRumah: string; // e.g. "No. 14A"
  alamat?: string;
  namaKepalaKeluarga: string;
  nikKk?: string;
  // Status Kartu Keluarga (KK) & Kewarganegaraan
  isKkMangga?: boolean; // true: KK Kelurahan Mangga, false: Bukan KK Mangga (Luar)
  asalKk?: string;
  kewarganegaraan?: 'WNI' | 'WNA' | string; // 'WNI' or 'WNA' (Warga Negara Asing)
  negaraAsalWna?: string; // Country of origin or passport info if WNA
  lat: number;
  lng: number;
  // Demografi
  jumlahJiwa: number;
  jumlahLakiLaki: number;
  jumlahPerempuan: number;
  jumlahLansia: number;
  jumlahAnak: number;
  pekerjaanKk: string;
  // Tingkat Kesejahteraan & Bansos (Data Utama)
  desilKesejahteraan?: string; // 'Desil 1 (Sangat Miskin)', 'Desil 2 (Miskin)', 'Desil 3 (Hampir Miskin)', 'Desil 4 (Rentan Miskin)', 'Desil 5 (Menengah Bawah)', 'Desil 6-10 (Mampu / Non-Desil)'
  desilBansos?: string; // fallback compatibility
  penerimaBansos: boolean;
  jenisBansos?: string[]; // ['PKH Medan Makmur', 'PKH Nasional', 'BPNT / Sembako', 'BLT / DBH', 'PBI-JK (BPJS Gratis)', 'Bedah Rumah / RTLH', 'PIP / Beasiswa', 'Lainnya']
  kategoriRentan?: boolean;
  
  // Sanitasi & Kesehatan Lingkungan Keluarga
  jambanKeluarga?: 'Jamban Sendiri (Leher Angsa / Septik SNI)' | 'Jamban Bersama / Komunal' | 'Jamban Cemplung / Plengsengan' | 'Tidak Memiliki Jamban (BABS)' | string;
  sumberAirMinum?: 'PDAM / Air Perpipaan' | 'Depot Isi Ulang' | 'Air Kemasan Bermerek' | 'Sumur Bor Terlindungi' | 'Sumur Gali' | 'Mata Air / Air Hujan' | string;
  sumberAirBersih?: 'PDAM Tirtanadi' | 'Sumur Bor Listrik' | 'Sumur Gali' | 'Sungai / Lainnya' | string;
  pembuanganSampahRumah?: 'Diangkut Petugas / WRS' | 'Bank Sampah / Daur Ulang' | 'Dibakar / Ditimbun Mandiri' | 'Dibuang Sembarangan' | string;
  statusStuntingRentan?: 'Ada Balita / Baduta Berisiko Stunting' | 'Ada Ibu Hamil KEK / Resti' | 'Bebas Risiko Stunting' | string;
  tempatAkhirTinja?: 'Tangki Septik / SPALD' | 'Saluran Terbuka / Parit' | 'Lubang Tanah / Lainnya' | string;
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
  kategoriBangunan?:
    | 'RUMAH_TINGGAL'
    | 'RUMAH_USAHA'
    | 'RUMAH_IBADAH'
    | 'SEKOLAH'
    | 'FASILITAS_KESEHATAN'
    | 'SPBU_STASIUN'
    | 'KANTOR_FASUM'
    | 'RUANG_PUBLIK_TAMAN'
    | 'PASAR_SARANA_EKONOMI';
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

export type JenisPembangunanType =
  | 'PERBAIKAN_JALAN'
  | 'PERBAIKAN_DRAINASE'
  | 'PERBAIKAN_LAMPU_LPJU'
  | 'PENAMBAHAN_TIANG_LPJU'
  | 'PEMASANGAN_PAVING_BLOK';

export type StatusRealisasiType =
  | 'USULAN'
  | 'PROSES_PENGERJAAN'
  | 'SELESAI_100%'
  | 'PEMELIHARAAN';

export interface RealisasiPembangunan {
  id: string;
  lingkunganId: string;
  lingkunganNomor: number;
  jenisPembangunan: JenisPembangunanType;
  namaProyek: string;
  lokasiDetail: string;
  sumberDana: 'APBD Kota Medan' | 'Dinas SDABMBK' | 'Dinas Perkim' | 'Dinas Perhubungan (Dishub)' | 'Pokir DPRD' | 'Dana Kelurahan' | 'Swadaya Masyarakat' | string;
  statusRealisasi: StatusRealisasiType;
  volumeRealisasi: string;
  biayaEstimasiRp?: number;
  realisasiBiayaRp?: number;
  persentaseFisik?: number;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  fotoSebelumUrl?: string;
  fotoProsesUrl?: string;
  fotoProsesList?: string[];
  fotoSesudahUrl?: string;
  fotoSebelumList?: string[];
  fotoSesudahList?: string[];
  titikKoordinat?: {
    lat: number;
    lng: number;
  };
  pelaksanaTeknis?: string;
  keterangan?: string;
  createdAt: string;
  updatedAt?: string;
  createdByName?: string;
}

export interface LaporanMonitoringInfrastruktur {
  id: string;
  nomorLaporan: string; // misal "158/MANGGA"
  subjek: string; // misal "LPJU Padam sebanyak 9 Titik"
  lokasi: string; // misal "Jl. Tali Air Kelurahan Mangga Kecamatan Medan Tuntungan"
  lingkunganNomor?: number;
  koordinatUrl?: string; // misal "https://maps.app.goo.gl/wVNAV1fu3ufn1ihy5?g_st=aw"
  tanggal: string; // misal "2026-09-30"
  pelapor: string; // misal "Fery Arapenta Tarigan"
  kategoriIsu?: 'LPJU / Penerangan' | 'Jalan Rusak / Berlubang' | 'Drainase / Parit Tersumbat' | 'Paving / Trotoar' | 'Lainnya' | string;
  statusTindakLanjut?: 'MENUNGGU_TINDAK_LANJUT' | 'SEDANG_DITANGANI' | 'SELESAI_DIPERBAIKI';
  keterangan?: string;
  instansiTujuan?: string; // misal "Dinas Perhubungan (Dishub) Kota Medan" / "Dinas SDABMBK"
  // Opsi Upload Foto sebanyak 3 dari angle yang berbeda:
  fotoAngle1Url?: string; // Angle 1 (Tampak Depan / Tiang Utama)
  fotoAngle1Label?: string;
  fotoAngle2Url?: string; // Angle 2 (Tampak Samping / Bentang Jalan)
  fotoAngle2Label?: string;
  fotoAngle3Url?: string; // Angle 3 (Tampak Luas / Detail Tambahan)
  fotoAngle3Label?: string;
  createdAt: string;
  updatedAt?: string;
}

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

// =========================================================================
// LAPORAN KEUANGAN TIM PENGGERAK PKK KELURAHAN MANGGA
// =========================================================================

export type JenisTransaksiPkk = 'PENERIMAAN' | 'PENGELUARAN';

export type PosAnggaranPkk =
  | 'SEKRETARIAT'
  | 'POKJA_I'
  | 'POKJA_II'
  | 'POKJA_III'
  | 'POKJA_IV'
  | 'UP2K'
  | 'BANTUAN_PEMERINTAH'
  | 'IURAN_KAS'
  | 'SWADAYA_SPONSOR'
  | 'LAINNYA';

export interface TransaksiKeuanganPkk {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nomorBukti?: string; // e.g. "BKM-01/PKK/X/2026" atau "BKK-01/PKK/X/2026"
  jenis: JenisTransaksiPkk;
  posAnggaran: PosAnggaranPkk;
  uraian: string; // Keterangan transaksi / rincian belanja
  jumlah: number; // Nominal Rupiah
  sumberDana?: string; // e.g. "APBD Kelurahan", "Iuran Kas Rutin", "UP2K PKK", "Swadaya"
  penerimaPenyetor?: string; // Nama pihak penyetor / penerima
  lingkunganNomor?: number; // 1-24 jika ada alokasi per lingkungan, 0 jika TP PKK Kelurahan
  lingkunganNama?: string;
  buktiFotoUrl?: string; // Lampiran foto nota belanja / kuitansi / bukti transfer
  catatan?: string;
  dibuatOlehNama?: string;
  dibuatOlehRole?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PokjaPkkType = 'SEKRETARIAT' | 'POKJA_I' | 'POKJA_II' | 'POKJA_III' | 'POKJA_IV' | 'PKK_LINGKUNGAN';

export interface LaporanKegiatanPkk {
  id: string;
  tanggal: string; // YYYY-MM-DD
  pokja: PokjaPkkType;
  namaKegiatan: string;
  kategoriProgram: string; // e.g. "Pola Asuh Anak", "UP2K", "HATINYA PKK", "Posyandu / PHBS", "Gotong Royong", dll.
  lokasi: string;
  lingkunganNomor?: number;
  lingkunganNama?: string;
  jumlahPeserta?: number;
  uraianHasil: string;
  tindakLanjut?: string;
  fotoDokumentasi?: FotoDokumentasi[];
  pelaporNama: string;
  pelaporRole: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KkAnggotaDasaWisma {
  id: string; // unique ID
  namaKepalaKeluarga: string;
  nomorKk?: string;
  nik?: string;
  alamat?: string;
  jumlahJiwa?: number;
  jumlahLakiLaki?: number;
  jumlahPerempuan?: number;
  jumlahBalita?: number;
  jumlahLansia?: number;
  sumberData?: 'MANUAL';
}

export interface KelompokDasaWisma {
  id: string;
  namaKelompok: string; // e.g. "Dasa Wisma Mawar 1"
  lingkunganNomor: number;
  lingkunganNama: string;
  namaKetuaDawis: string;
  teleponKetua?: string;
  rtRw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kotaKabupaten?: string;
  provinsi?: string;
  
  // Demografi & Kepala Keluarga
  namaKrt?: string; // Nama Kepala Rumah Tangga
  daftarKkAnggota?: KkAnggotaDasaWisma[]; // Daftar nama & profil Kepala Keluarga anggota Dasa Wisma (10-20 KK)
  jumlahKk: number;
  jumlahJiwa: number;
  jumlahLakiLaki?: number;
  jumlahPerempuan?: number;
  jumlahRumah?: number;
  jumlahKkDalamRumah?: number;
  
  // Kategori Khusus (Individu & Rekap)
  jumlahBalita: number;
  jumlahAnakSekolah?: number;
  jumlahLansia: number;
  jumlahPus?: number; // Pasangan Usia Subur
  jumlahWus?: number; // Wanita Usia Subur
  jumlahAkseptorKb?: number;
  jumlahIbuHamil: number;
  jumlahIbuMenyusui?: number;
  jumlahIbuNifas?: number;
  jumlahIbuMeninggal?: number;
  jumlahBayiMeninggal?: number;
  jumlahBalitaMeninggal?: number;
  jumlahButaAksara?: number; // 3 Buta (Baca, Tulis, Hitung)
  
  // Kesehatan, Sanitasi & Rumah Tangga
  makananPokok?: 'Beras' | 'Non-Beras' | string;
  sumberAirMinum?: string; // 'PDAM', 'Air Galon', 'Depot Isi Ulang', 'Sumur', etc.
  sumberAirBersih?: string; // 'PDAM', 'Sumur Bor/Terlindungi', 'Mata Air', 'Air Kemasan', 'Sungai'
  punyaJambanSehat: number;
  punyaTempatSampah?: number;
  punyaSpal: number;
  kriteriaRumah?: 'Layak Huni' | 'Tidak Layak Huni' | string;
  kriteriaRumahSehat?: number;
  kriteriaRumahKurangSehat?: number;
  stikerP4k?: 'Menempel' | 'Tidak Menempel' | string;
  
  // Pemanfaatan Tanah Pekarangan (PTP) & Industri Rumah Tangga (UP2K)
  punyaToga: number;
  ptpPeternakan?: boolean;
  ptpPerikanan?: boolean;
  ptpWarungHidup?: boolean;
  ptpToga?: boolean;
  ptpTanamanKeras?: boolean;
  industriPangan?: boolean;
  industriSandang?: boolean;
  industriJasa?: boolean;
  industriKonveksi?: boolean;
  
  // Kegiatan Warga
  kegiatanPosyandu?: boolean;
  kegiatanBkb?: boolean;
  kegiatanTabulin?: boolean;
  kegiatanPaud?: boolean;
  kegiatanUp2kKoperasi?: boolean;
  
  kegiatanUtama?: string;
  validationWarnings?: string[];
  createdByName?: string;
  createdAt?: string;
  updatedAt: string;
}

export type JenisSuratKedinasan =
  | 'SURAT_MASUK'
  | 'SURAT_KELUAR'
  | 'NOTA_DINAS'
  | 'SURAT_EDARAN'
  | 'SURAT_KETERANGAN'
  | 'SK_LURAH'
  | 'UNDANGAN';

export interface SuratKedinasanItem {
  id: string;
  nomorSurat: string;
  tanggalSurat: string; // YYYY-MM-DD
  jenisSurat: JenisSuratKedinasan;
  perihal: string;
  kategori?: 'KELURAHAN' | 'PKK';
  asalSurat?: string; // Untuk surat masuk
  tujuanSurat?: string; // Untuk surat keluar
  sifat: 'BIASA' | 'PENTING' | 'RAHASIA' | 'SEGERA';
  status: 'DRAFT' | 'TERCATAT' | 'DISETUJUI' | 'DIARSIPKAN';
  isiRingkas: string;
  fileUrl?: string; // Attachment / scan PDF (Data URL or storage link)
  fileName?: string; // e.g. "Surat_Undangan_Rakor_005.pdf"
  fileSize?: number; // Size in bytes
  fileType?: string; // e.g. "application/pdf"
  penandatangan?: string;
  dibuatOlehNama?: string;
  dibuatOlehRole?: string;
  createdAt: string;
  updatedAt?: string;
}

export type StatusAgendaType = 'BELUM' | 'PROSES' | 'SELESAI' | 'BATAL';

export interface AgendaKelurahanItem {
  id: string;
  namaKegiatan: string;
  tanggalKegiatan: string; // YYYY-MM-DD
  jamKegiatan?: string; // e.g. "09:00 WIB"
  lokasi: string;
  peserta: string; // Target participants / audience
  statusSelesai: StatusAgendaType;
  catatan?: string; // Notes or additional descriptions
  fotoDokumenUrl?: string; // Optional photo/document image
  penanggungJawab?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt?: string;
}


