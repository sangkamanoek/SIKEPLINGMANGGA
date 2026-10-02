import { KepalaSeksiProfile, KepalaSeksiRole } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/safeStorage';

const KASI_PROFILES_LOCAL_KEY = 'sikepling_kasi_profiles_v1';
const KASI_FIRESTORE_COLLECTION = 'kasi_profiles';

export const DEFAULT_KASI_PEMERINTAHAN: KepalaSeksiProfile = {
  id: 'kasi_pemerintahan',
  role: 'kasi_pemerintahan',
  namaSeksi: 'Seksi Tata Pemerintahan',
  singkatan: 'Kasi Tata Pemerintahan (PBB, IKD & Apel)',
  namaPejabat: 'KASI TATA PEMERINTAHAN',
  nip: '19780512 200801 1 005',
  telepon: '0812-6011-2345',
  usernameUtama: 'kasi_pemerintahan',
  usernameAliases: [
    'kasi_pemerintahan',
    'kasipemerintahan',
    'pemerintahan',
    'kasi_pem',
    'kasipem',
    'pbb',
    'admin_pbb',
    'kasi_pbb',
    'kasipbb',
    'pem_mangga',
    'pemerintahan_mangga',
  ],
  passwordDefault: 'pem_mangga2026',
  iconKey: 'pemerintahan',
  tupoksiRingkas:
    'Melaksanakan perumusan kebijakan teknis, pengoordinasian, pembinaan, pemantauan, dan evaluasi penyelenggaraan tata pemerintahan kelurahan, optimalisasi realisasi PBB-P2, percepatan aktivasi IKD, penatausahaan registrasi kependudukan, serta penegakan disiplin apel 24 Kepala Lingkungan.',
  bidangTugas: [
    {
      judul: '1. Pengelolaan & Optimalisasi PBB-P2 (Pajak Bumi dan Bangunan)',
      deskripsi:
        'Mengkoordinasikan dan memonitor penyerahan SPPT PBB ke wajib pajak di 24 Lingkungan, pencatatan realisasi Opsir PBB, penagihan piutang pajak, serta rekonsiliasi data wajib pajak bersama Bapenda Kota Medan.',
      poinPenting: [
        'Pendistribusian dan verifikasi penyampaian SPPT PBB buku 1, 2, dan 3 ke 24 Kepling.',
        'Monitoring penagihan door-to-door dan pelaporan penerimaan Opsir PBB harian.',
        'Pengecekan objek pajak potensial dan sinkronisasi Wajib Retribusi Sampah (WRS).',
        'Penerbitan rekapitulasi capaian realisasi PBB per lingkungan dan evaluasi bulanan.',
      ],
    },
    {
      judul: '2. Akselerasi Identitas Kependudukan Digital (IKD)',
      deskripsi:
        'Mendorong dan mengawasi implementasi aktivasi aplikasi IKD (KTP Digital) bagi seluruh warga di Kelurahan Mangga secara terukur per lingkungan.',
      poinPenting: [
        'Sosialisasi berkala aktivasi IKD kepada warga bersama Kepala Lingkungan.',
        'Monitoring capaian target bulanan aktivasi IKD per lingkungan.',
        'Fasilitasi pelayanan jemput bola aktivasi IKD di kantor kelurahan dan titik kumpul warga.',
      ],
    },
    {
      judul: '3. Penatausahaan Kependudukan & Database Keluarga',
      deskripsi:
        'Pengelolaan basis data keluarga (KK), Nomor Induk Kependudukan (NIK), buku register kependudukan, serta surat-surat pengantar/keterangan resmi.',
      poinPenting: [
        'Sinkronisasi Master Database Keluarga Kelurahan Mangga (24 Lingkungan).',
        'Pencatatan mutasi penduduk (kelahiran, kematian, pindah datang/keluar).',
        'Validasi data warga dan integrasi data spasial rumah/bangunan kelurahan.',
      ],
    },
    {
      judul: '4. Presensi & Disiplin Apel Aparatur Kelurahan',
      deskripsi:
        'Pengawasan kedisiplinan dan absensi apel pagi setiap hari kerja bagi 24 Kepala Lingkungan dan seluruh pegawai ASN/Non-ASN Kelurahan Mangga.',
      poinPenting: [
        'Pencatatan presensi apel pagi disertai foto selfie dan koordinat GPS resmi.',
        'Rekapitulasi status kehadiran: Hadir, Izin, Sakit, Dinas Luar, atau Alpa.',
        'Penyusunan laporan berkala disiplin aparatur untuk evaluasi Lurah dan Camat.',
      ],
    },
    {
      judul: '5. Ketatawilayahan & Pembinaan Kepala Lingkungan',
      deskripsi:
        'Pembinaan administrasi kantor lingkungan, batas-batas wilayah lingkungan, serta fasilitasi agenda demokrasi/musyawarah wilayah.',
      poinPenting: [
        'Pembinaan ketertiban buku kerja dan buku register 24 Kepala Lingkungan.',
        'Fasilitasi penegasan batas lingkungan dan pemetaan batas wilayah kerja.',
        'Pengawalan teknis penyelenggaraan Pemilu, Pilkada, dan pemilihan Kepala Lingkungan.',
      ],
    },
  ],
  indikatorKinerja: [
    { label: 'Realisasi Target PBB-P2', target: '100%', satuan: 'Target SPPT / Buku Ketetapan' },
    { label: 'Target IKD Warga', target: '50 - 100', satuan: 'Orang / Bulan per Lingkungan' },
    { label: 'Tingkat Kehadiran Apel Kepling', target: '≥ 95%', satuan: 'Presensi Bulanan' },
    { label: 'Ketepatan Laporan Harian Kepling', target: '100%', satuan: '24 Lingkungan Aktif' },
  ],
  fiturAplikasi: [
    {
      namaFitur: 'Dashboard PBB Kasi',
      kegunaan: 'Monitoring leaderboard penerimaan Opsir PBB dan capaian target per Kepling.',
    },
    {
      namaFitur: 'Rekap & Realisasi PBB-P2',
      kegunaan: 'Import CSV SPPT Bapenda, pencatatan lunas, dan ekspor lembar rekapitulasi resmi.',
    },
    {
      namaFitur: 'Database Keluarga & Registrasi',
      kegunaan: 'Pencarian NIK, nomor KK, verifikasi data anggota keluarga, dan cetak register.',
    },
    {
      namaFitur: 'Presensi Apel Kepling',
      kegunaan: 'Verifikasi foto kehadiran selfie, koordinat GPS, dan laporan rekap apel mingguan.',
    },
  ],
};

export const DEFAULT_KASI_PEMBANGUNAN: KepalaSeksiProfile = {
  id: 'kasi_pembangunan',
  role: 'kasi_pembangunan',
  namaSeksi: 'Seksi Pembangunan dan Kesejahteraan Sosial',
  singkatan: 'Kasi Pembangunan & Kesos (Perlinsos, Posyandu, Infrastruktur)',
  namaPejabat: 'KASI PEMBANGUNAN & KESOS',
  nip: '19810915 201001 2 008',
  telepon: '0813-7522-6789',
  usernameUtama: 'kasi_pembangunan',
  usernameAliases: [
    'kasi_pembangunan',
    'kasipembangunan',
    'pembangunan',
    'kasi_bang',
    'kasibang',
    'perlinsos',
    'admin_perlinsos',
    'kasi_perlinsos',
    'kasiperlinsos',
    'kasi_kesos',
    'kasikesos',
    'pmk',
    'kasi_pmk',
    'pembangunan_mangga',
    'kesos_mangga',
  ],
  passwordDefault: 'bang_mangga2026',
  iconKey: 'pembangunan',
  tupoksiRingkas:
    'Melaksanakan penyiapan bahan kebijakan teknis, pengoordinasian, pemantauan, dan evaluasi pelaksanaan urusan pembangunan fisik/sarana prasarana lingkungan, verifikasi perlindungan sosial (Perlinsos/DTKS/Bansos), kesehatan masyarakat (Posyandu & Stunting), jaminan sosial tenaga kerja, serta pemberdayaan warga.',
  bidangTugas: [
    {
      judul: '1. Verifikasi Perlindungan Sosial (Perlinsos) & DTKS',
      deskripsi:
        'Pengawalan pendataan dan validasi lapangan profil keluarga penerima bantuan sosial pemerintah agar tepat sasaran dan transparan.',
      poinPenting: [
        'Verifikasi dan validasi data terpadu kesejahteraan sosial (DTKS / P3KE / desil 1-4).',
        'Monitoring penyaluran bansos PKH, BPNT, BLT BBM/Elpiji, dan bantuan pangan beras.',
        'Pencatatan status survei: warga bersedia, warga menolak bantuan, atau tidak di tempat.',
        'Penyusunan profil kemiskinan ekstrim per lingkungan untuk intervensi terpadu.',
      ],
    },
    {
      judul: '2. Kesehatan Masyarakat, Posyandu, & Pencegahan Stunting',
      deskripsi:
        'Monitoring pelayanan kesehatan dasar di tingkat lingkungan, posyandu balita dan lansia, serta percepatan program penurunan stunting anak.',
      poinPenting: [
        'Pemantauan jadwal dan keaktifan Posyandu Balita & Posyandu Lansia di 24 Lingkungan.',
        'Pencatatan data penimbangan balita, pemantauan kurva tumbuh kembang, dan kasus stunting.',
        'Koordinasi pendistribusian Makanan Tambahan (PMT) bersama Puskesmas Medan Tuntungan.',
      ],
    },
    {
      judul: '3. Perlindungan Jaminan Sosial Ketenagakerjaan (BPJS TK)',
      deskripsi:
        'Sosialisasi, pendataan, dan pengawalan program kepesertaan jaminan sosial ketenagakerjaan bagi pekerja sektor informal/rentan.',
      poinPenting: [
        'Pendataan pekerja rentan (buruh harian, pedagang kecil, pengemudi ojek, marbot/penggali kubur).',
        'Fasilitasi pendaftaran jaminan kecelakaan kerja (JKK) dan jaminan kematian (JKM).',
        'Pencatatan capaian kepesertaan per lingkungan sebagai laporan kinerja daerah.',
      ],
    },
    {
      judul: '4. Monitoring Infrastruktur Wilayah & Usulan Musrenbang',
      deskripsi:
        'Inventarisasi sarana prasarana fisik lingkungan, penyerapan aspirasi pembangunan, serta pengawasan perbaikan fasilitas umum.',
      poinPenting: [
        'Pendataan kondisi fisik jalan rusak, paving block, drainase/parit tersumbat, dan tanggul.',
        'Fasilitasi usulan prioritas Musrenbang (Musyawarah Perencanaan Pembangunan) Kelurahan.',
        'Monitoring usulan dan realisasi Bedah Rumah Tidak Layak Huni (RTLH) bagi warga miskin.',
      ],
    },
    {
      judul: '5. Pemberdayaan Masyarakat & Tim Penggerak PKK',
      deskripsi:
        'Pembinaan kelembagaan kemasyarakatan, kelompok swadaya masyarakat (KSM), kelompok tani kota, dan Tim Penggerak PKK Kelurahan Mangga.',
      poinPenting: [
        'Pendampingan kegiatan 10 Program Pokok PKK dan Dasawisma di tiap lingkungan.',
        'Pengembangan UMKM lokal, pelatihan keterampilan kerja warga, dan ekonomi kreatif.',
        'Penggerak gotong royong berkala (Jumat Bersih / Minggu Harmonis) di 24 lingkungan.',
      ],
    },
  ],
  indikatorKinerja: [
    { label: 'Capaian Verifikasi Perlinsos', target: '429 KK', satuan: 'Rata-rata per Lingkungan' },
    { label: 'Posyandu Aktif Terpantau', target: '100%', satuan: 'Posyandu Balita & Lansia' },
    { label: 'Zero Stunting Baru', target: '0 Kasus Baru', satuan: 'Intervensi Dini Balita' },
    { label: 'Inventarisasi Usulan Fisik', target: '24 Lingkungan', satuan: 'Terpetakan di WebGIS' },
  ],
  fiturAplikasi: [
    {
      namaFitur: 'Dashboard Perlinsos Kasi',
      kegunaan: 'Monitoring realisasi pendataan 429 KK, kategori survei, dan rekap kepesertaan BPJS.',
    },
    {
      namaFitur: 'Realisasi Pembangunan & Musrenbang',
      kegunaan: 'Pencatatan usulan fisik jalan, drainase, bedah rumah RTLH, dan galeri foto proyek.',
    },
    {
      namaFitur: 'Monitoring Posyandu & Gizi',
      kegunaan: 'Pencatatan agenda posyandu, rekap balita ditimbang, dan pencegahan stunting.',
    },
    {
      namaFitur: 'Pemetaan Spasial Kesejahteraan',
      kegunaan: 'Peta tematik titik rumah rentan dan keluarga penerima bansos di 24 Lingkungan.',
    },
  ],
};

export const DEFAULT_KASI_TRANTIBUM: KepalaSeksiProfile = {
  id: 'kasi_trantibum',
  role: 'kasi_pemerintahan' as any, // replaced below
  namaSeksi: 'Seksi Ketenteraman dan Ketertiban Umum',
  singkatan: 'Kasi Trantibum & Linmas (Poskamling, Mediasi & 7 Bidang Trantib)',
  namaPejabat: 'KASI KETENTRAMAN & KETERTIBAN UMUM',
  nip: '19791104 200701 1 012',
  telepon: '0812-6543-9870',
  usernameUtama: 'kasi_trantibum',
  usernameAliases: [
    'kasi_trantibum',
    'kasitrantibum',
    'trantibum',
    'trantib',
    'kasi_trantib',
    'kasitrantib',
    'ketertiban',
    'kamtibmas',
    'poskamling',
    'linmas',
    'kasi_linmas',
    'kasilinmas',
    'trantibum_mangga',
    'trantib_mangga',
  ],
  passwordDefault: 'trantib_mangga2026',
  iconKey: 'trantibum',
  tupoksiRingkas:
    'Melaksanakan penyiapan perumusan kebijakan teknis, pengoordinasian, penegakan ketertiban umum dan ketenteraman masyarakat, pembinaan Satlinmas, pengawasan keaktifan Poskamling (Siskamling), mediasi perselisihan warga, penertiban kebersihan fasilitas publik, serta tanggap darurat bencana bersama Tiga Pilar (Kelurahan, Babinsa, Bhabinkamtibmas).',
  bidangTugas: [
    {
      judul: '1. Pengawasan Poskamling & Ronda Malam Swakarsa',
      deskripsi:
        'Pemantauan sistem keamanan lingkungan (Siskamling), kesiapan pos jaga, jadwal ronda malam warga, dan verifikasi dokumentasi patroli malam.',
      poinPenting: [
        'Monitoring keaktifan pos ronda malam di Lingkungan I sampai Lingkungan XXIV.',
        'Pengecekan kelengkapan buku mutasi jaga pos ronda dan nomor kontak darurat.',
        'Verifikasi dokumentasi patroli malam dan pelaporan situasi kondusif wilayah.',
      ],
    },
    {
      judul: '2. Pemantauan Kerusakan Fisik Infrastruktur & Keamanan Publik',
      deskripsi:
        'Patroli deteksi dini terhadap potensi bahaya fisik di ruang publik yang dapat mengganggu ketertiban umum dan keselamatan warga.',
      poinPenting: [
        'Deteksi pohon rimbun/lapuk yang rawan tumbang menimpa jalan atau kabel.',
        'Monitoring kabel listrik/telekomunikasi yang menjuntai rendah membahayakan pengendara.',
        'Pencatatan titik lubang jalan berbahaya dan koordinasi darurat dengan instansi terkait.',
      ],
    },
    {
      judul: '3. Fasilitasi Mediasi Perselisihan & Ketenteraman Warga',
      deskripsi:
        'Penyelesaian konflik warga, perselisihan tapal batas pekarangan, keributan ketertiban malam, dan sengketa sosial secara musyawarah kekeluargaan.',
      poinPenting: [
        'Pendampingan Kepala Lingkungan dalam mediasi perselisihan antar warga.',
        'Penyusunan berita acara mediasi damai secara tertulis bermaterai.',
        'Sinergi Tiga Pilar: bersama Bhabinkamtibmas Polsek dan Babinsa Koramil.',
      ],
    },
    {
      judul: '4. Kesiapsiagaan Posko Trantibum Kelurahan',
      deskripsi:
        'Pengendalian posko komando siaga ketertiban di kelurahan serta pengamanan kegiatan kemasyarakatan, hari besar, dan acara publik.',
      poinPenting: [
        'Piket siaga regu Trantibum kantor kelurahan menerima laporan pengaduan warga.',
        'Pengamanan kelancaran ibadah hari besar keagamaan dan perayaan nasional.',
        'Koordinasi patroli gabungan bersama Satpol PP Kecamatan Medan Tuntungan.',
      ],
    },
    {
      judul: '5. Pengawasan Posko Bersemi (Bersih, Sehat, Menawan)',
      deskripsi:
        'Pemantauan kebersihan dan kerapian posko bersemi per lingkungan serta pengawalan estetika tata ruang lingkungan hijau.',
      poinPenting: [
        'Pemeliharaan tanaman penghijauan dan ketertiban kawasan sekitar posko.',
        'Penertiban spanduk/baliho liar tanpa izin yang merusak estetika lingkungan.',
      ],
    },
    {
      judul: '6. Pengawasan Kebersihan & Penertiban Sampah Liar',
      deskripsi:
        'Patroli pencegahan dan penindakan pembuangan sampah sembarangan di pinggir jalan raya protokol, saluran air, dan tanah kosong.',
      poinPenting: [
        'Razia dan peringatan bagi warga/oknum yang membuang sampah sembarangan.',
        'Penertiban pedagang kaki lima (PKL) yang menutup trotoar jalan dan parit.',
        'Sosialisasi jam pembuangan sampah dan jadwal armada truk sampah Melati.',
      ],
    },
    {
      judul: '7. Pemantauan Faktor 74 & Tanggap Darurat Bencana',
      deskripsi:
        'Deteksi dini kerawanan kamtibmas khusus (minuman keras, narkoba, judi, tawuran pemuda) serta mitigasi bencana banjir/kebakaran.',
      poinPenting: [
        'Deteksi titik kumpul remaja yang berpotensi memicu tawuran dan balap liar malam.',
        'Kesiapsiagaan regu tanggap bencana banjir genangan dan pohon tumbang.',
        'Koordinasi cepat evakuasi dan pelaporan ke BPBD Kota Medan dan Dinas Pemadam.',
      ],
    },
  ],
  indikatorKinerja: [
    { label: 'Keaktifan Poskamling Malam', target: '24 Lingkungan', satuan: 'Pos Ronda Aktif' },
    { label: 'Penyelesaian Mediasi Warga', target: '100% Tuntas', satuan: 'Musyawarah Damai' },
    { label: 'Respon Cepat Aduan Trantib', target: '< 60 Menit', satuan: 'Tindak Lanjut Lapangan' },
    { label: 'Penertiban Titik Sampah Liar', target: 'Zero Titik Liar', satuan: 'Kawasan Bersih' },
  ],
  fiturAplikasi: [
    {
      namaFitur: 'Dashboard 7 Bidang Trantibum',
      kegunaan: 'Monitoring 7 bidang kerja: Poskamling, Infra, Mediasi, Posko Trantib, Bersemi, Sampah, Faktor 74.',
    },
    {
      namaFitur: 'Peta Spasial Poskamling',
      kegunaan: 'Visualisasi lokasi pos ronda, nomor kontak petugas jaga, dan status keaktifan.',
    },
    {
      namaFitur: 'Log Mediasi & Insiden Darurat',
      kegunaan: 'Pencatatan sengketa warga, berita acara kesepakatan damai, dan dokumentasi foto.',
    },
    {
      namaFitur: 'Cetak Rekap 7 Bidang Trantibum',
      kegunaan: 'Ekspor lembar laporan komprehensif ke format Excel (.xlsx) dan format cetak resmi.',
    },
  ],
};
DEFAULT_KASI_TRANTIBUM.role = 'kasi_trantibum';

export const DEFAULT_KASI_PROFILES: Record<KepalaSeksiRole, KepalaSeksiProfile> = {
  kasi_pemerintahan: DEFAULT_KASI_PEMERINTAHAN,
  kasi_pembangunan: DEFAULT_KASI_PEMBANGUNAN,
  kasi_trantibum: DEFAULT_KASI_TRANTIBUM,
};

/**
 * Get all Kepala Seksi profiles with persistent local overrides
 */
export function getAllKasiProfiles(): KepalaSeksiProfile[] {
  const overrides = getLocalKasiOverrides();
  return (['kasi_pemerintahan', 'kasi_pembangunan', 'kasi_trantibum'] as KepalaSeksiRole[]).map(
    (role) => {
      const base = DEFAULT_KASI_PROFILES[role];
      const custom = overrides[role] || {};
      return {
        ...base,
        ...custom,
        usernameAliases: Array.from(new Set([...(base.usernameAliases || []), ...(custom.usernameAliases || [])])),
        bidangTugas: custom.bidangTugas && custom.bidangTugas.length > 0 ? custom.bidangTugas : base.bidangTugas,
        indikatorKinerja: custom.indikatorKinerja && custom.indikatorKinerja.length > 0 ? custom.indikatorKinerja : base.indikatorKinerja,
        fiturAplikasi: base.fiturAplikasi,
      };
    }
  );
}

/**
 * Get a specific Kepala Seksi profile by role
 */
export function getKasiProfileByRole(role: KepalaSeksiRole | string): KepalaSeksiProfile {
  const normRole = (role || '').trim().toLowerCase() as KepalaSeksiRole;
  const base = DEFAULT_KASI_PROFILES[normRole] || DEFAULT_KASI_PEMERINTAHAN;
  const overrides = getLocalKasiOverrides();
  const custom = overrides[normRole] || {};

  return {
    ...base,
    ...custom,
    usernameAliases: Array.from(new Set([...(base.usernameAliases || []), ...(custom.usernameAliases || [])])),
    bidangTugas: custom.bidangTugas && custom.bidangTugas.length > 0 ? custom.bidangTugas : base.bidangTugas,
    indikatorKinerja: custom.indikatorKinerja && custom.indikatorKinerja.length > 0 ? custom.indikatorKinerja : base.indikatorKinerja,
    fiturAplikasi: base.fiturAplikasi,
  };
}

/**
 * Local storage helper
 */
function getLocalKasiOverrides(): Record<string, Partial<KepalaSeksiProfile>> {
  return safeGetLocalStorage<Record<string, Partial<KepalaSeksiProfile>>>(KASI_PROFILES_LOCAL_KEY, {});
}

function setLocalKasiOverrides(data: Record<string, Partial<KepalaSeksiProfile>>): void {
  safeSetLocalStorage(KASI_PROFILES_LOCAL_KEY, JSON.stringify(data));
}

/**
 * Save / Update a Kepala Seksi profile locally and to Firestore
 */
export async function saveKasiProfile(
  role: KepalaSeksiRole,
  updates: Partial<KepalaSeksiProfile>
): Promise<boolean> {
  try {
    const currentOverrides = getLocalKasiOverrides();
    const existing = currentOverrides[role] || {};
    const merged: Partial<KepalaSeksiProfile> = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    currentOverrides[role] = merged;
    setLocalKasiOverrides(currentOverrides);

    // Also update account profile if name/phone changed
    try {
      const docRef = doc(db, KASI_FIRESTORE_COLLECTION, role);
      await setDoc(docRef, merged, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, KASI_FIRESTORE_COLLECTION);
    }

    return true;
  } catch (err) {
    console.error('Failed to save Kasi profile:', err);
    return false;
  }
}

/**
 * Reset a Kepala Seksi profile back to system defaults
 */
export async function resetKasiProfileToDefault(role: KepalaSeksiRole): Promise<boolean> {
  try {
    const currentOverrides = getLocalKasiOverrides();
    delete currentOverrides[role];
    setLocalKasiOverrides(currentOverrides);

    try {
      const docRef = doc(db, KASI_FIRESTORE_COLLECTION, role);
      await setDoc(docRef, { ...DEFAULT_KASI_PROFILES[role], isReset: true, updatedAt: new Date().toISOString() });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, KASI_FIRESTORE_COLLECTION);
    }

    return true;
  } catch (err) {
    console.error('Failed to reset Kasi profile:', err);
    return false;
  }
}

/**
 * Fetch and sync Kasi profiles from Firestore
 */
export async function syncKasiProfilesWithServer(): Promise<void> {
  try {
    const colRef = collection(db, KASI_FIRESTORE_COLLECTION);
    const snap = await getDocs(colRef);
    if (snap.empty) return;

    const current = getLocalKasiOverrides();
    snap.forEach((d) => {
      const data = d.data() as Partial<KepalaSeksiProfile>;
      if (data && d.id) {
        current[d.id] = {
          ...current[d.id],
          ...data,
        };
      }
    });

    setLocalKasiOverrides(current);
  } catch (err) {
    // Graceful fallback to local cache
  }
}
