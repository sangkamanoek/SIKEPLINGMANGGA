import React, { useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Presentation, 
  CheckCircle2, 
  FileSpreadsheet, 
  Smartphone, 
  Lock, 
  FileText, 
  Share2, 
  Printer,
  Sparkles,
  HelpCircle,
  MapPin,
  Clock,
  ShieldCheck,
  Award,
  Users,
  Layers,
  Zap,
  Globe,
  Camera,
  Activity,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import pptxgen from 'pptxgenjs';
import { CURRENT_APP_VERSION, CURRENT_RELEASE_DATE } from '../lib/appVersionService';

interface PanduanPPTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PanduanPPTModal: React.FC<PanduanPPTModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const slidesData = [
    {
      title: "SI-KEPLING MANGGA PRIMA",
      subtitle: `Sistem Informasi Pelaporan Harian, Presensi Terpadu & WebGIS 24 Lingkungan (${CURRENT_APP_VERSION})`,
      category: "Buku Panduan Resmi Operasional",
      color: "from-emerald-800 via-teal-900 to-slate-950",
      content: (
        <div className="flex flex-col items-center text-center space-y-4 py-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-700 shadow-lg border border-emerald-300">
            <Presentation className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-800 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black mb-1.5 border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pemerintah Kota Medan • Kecamatan Medan Tuntungan</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Kelurahan Mangga</h3>
            <p className="text-emerald-700 font-bold text-xs sm:text-sm">Panduan Lengkap Tata Cara Penggunaan Aplikasi Bagi 24 Kepala Lingkungan &amp; Perangkat Kelurahan</p>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full max-w-lg text-left text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-slate-700">Versi: {CURRENT_APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              <span className="font-bold text-slate-700">24 Lingkungan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="font-bold text-slate-700">Offline-First</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "1. Hak Akses & Multi-Role Pengguna",
      subtitle: "Struktur peran akun dan tata cara login ke dalam sistem",
      category: "Struktur Akun & Login",
      color: "from-slate-900 via-emerald-950 to-teal-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700 text-xs py-1">
          <div className="bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-emerald-950 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Super Admin (Lurah)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Monitoring eksekutif 24 Kepling, radar kepatuhan, validasi rekapitulasi apel harian, manajemen target PBB, dan ekspor dokumen resmi.
            </p>
          </div>

          <div className="bg-teal-50/90 p-3.5 rounded-2xl border border-teal-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-teal-950 text-sm">
              <Award className="w-4 h-4 text-teal-700" />
              <span>Kasi Sektoral</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Dashboard khusus Kasi Pemerintahan (Trantibum), Kasi PMK (Perlinsos), dan Kasi Tata Pemerintahan untuk evaluasi capaian bidang.
            </p>
          </div>

          <div className="bg-amber-50/90 p-3.5 rounded-2xl border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
              <Users className="w-4 h-4 text-amber-700" />
              <span>24 Kepala Lingkungan</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Input laporan harian berfoto, sambang warga, presensi apel ber-GPS, data PBB lingkungan, dan pemetaan titik rumah WebGIS.
            </p>
          </div>

          <div className="md:col-span-3 bg-slate-900 text-white p-3 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span><strong>Password Bawaan:</strong> <code className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono">mangga[no_lingkungan]</code> (Contoh: <code className="text-emerald-300 font-mono">mangga21</code>)</span>
            </div>
            <span className="text-slate-300 italic">Disarankan segera ubah kata sandi melalui tombol profil.</span>
          </div>
        </div>
      )
    },
    {
      title: "2. Presensi Apel Pagi & Waktu Jaringan",
      subtitle: "Jadwal resmi, validasi GPS radius, kamera selfie, & anti-manipulasi jam",
      category: "Presensi Terpadu",
      color: "from-teal-900 via-emerald-900 to-slate-900",
      content: (
        <div className="space-y-2.5 py-1 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2 font-black text-emerald-900 text-xs">
                <Clock className="w-4 h-4 text-emerald-700" />
                <span>Jadwal Resmi Apel Pagi</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Berlaku <strong>Senin s/d Jumat, Pukul 07.30 – 08.30 WIB</strong>. Sabtu &amp; Minggu berstatus <em>Libur Akhir Pekan</em>.
              </p>
            </div>

            <div className="bg-slate-900 text-white p-3 rounded-2xl border border-emerald-500/40">
              <div className="flex items-center gap-2 font-black text-emerald-300 text-xs">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Waktu Jaringan Resmi (NTP Server)</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Waktu disinkronkan langsung dari server jaringan. <strong>Anti-manipulasi jam HP</strong> untuk menjamin keaslian presensi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Geofencing GPS
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Verifikasi koordinat di Kantor Kelurahan Mangga.</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-600" /> Foto Selfie Real-Time
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Kamera selfie depan langsung saat presensi.</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-600" /> Kegiatan Khusus
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Presensi event rapat/gotong royong kelurahan.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. Formulir Laporan Kegiatan Harian",
      subtitle: "Pengisian laporan kerja lapangan dengan dokumentasi foto & GPS",
      category: "Formulir Laporan",
      color: "from-emerald-800 to-green-950",
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="flex items-start gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
            <div>
              <p className="font-bold text-slate-900 text-xs">Upload Dokumentasi Foto (Hingga 8 Foto)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Sistem secara otomatis mengompres foto agar hemat kuota internet dan pengiriman berjalan secepat kilat.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
            <div>
              <p className="font-bold text-slate-900 text-xs">Pendeteksi GPS &amp; Nama Jalan Otomatis</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Sistem mendeteksi titik koordinat lintang/bujur dan nama jalan (*reverse geocoding*) secara presisi.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
            <div>
              <p className="font-bold text-slate-900 text-xs">Kategori Kegiatan &amp; Siskamling / Ronda</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Pilih bidang kegiatan: Trantibum, Kebersihan Lingkungan, Gotong Royong, Sosialisasi Warga, atau Pengawasan Ronda Malam.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "4. Kunjungan Warga & Opsi Perlinsos",
      subtitle: "Pencatatan interaksi sambang warga dan pendataan bansos",
      category: "Kunjungan & Perlinsos",
      color: "from-teal-800 via-emerald-950 to-slate-900",
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <p className="font-black text-emerald-950 text-xs flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              Fitur Sambang Warga (*Door-to-Door*)
            </p>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Mencatat kunjungan silaturahmi, sosialisasi program kelurahan, serta verifikasi data kesejahteraan keluarga di setiap lingkungan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300">
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] uppercase">SUDAH</span>
              <p className="text-[11px] text-emerald-900 font-bold mt-1.5">Sudah Terdata Bansos</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Warga telah terdaftar dalam DTKS / program bantuan sosial.</p>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-300">
              <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-[10px] uppercase">BELUM</span>
              <p className="text-[11px] text-amber-900 font-bold mt-1.5">Belum Terdata Bansos</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Warga belum menerima atau membutuhkan verifikasi kelayakan.</p>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-300">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] uppercase">MENOLAK</span>
              <p className="text-[11px] text-rose-900 font-bold mt-1.5">Menolak Bantuan (Baru)</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Warga secara sadar menolak bansos, dicatat nama &amp; alamat lengkapnya.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "5. Peta Spasial WebGIS 24 Lingkungan",
      subtitle: "Visualisasi batas poligon, sebaran rumah warga, faskes, & WRS",
      category: "WebGIS Spasial",
      color: "from-blue-900 via-emerald-950 to-slate-900",
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Poligon 24 Lingkungan</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Peta batas resmi wilayah setiap Lingkungan I s/d XXIV dengan navigasi interaktif (*zoom &amp; pan*).
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Titik Rumah &amp; Retribusi Sampah (WRS)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Penanda titik rumah warga, status WRS aktif/non-aktif, dan pemantauan kondisi fasilitas jalan.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex items-start gap-2.5 text-[11px] text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Klasifikasi Fasilitas Akurat &amp; Terpisah</p>
              <p className="text-slate-600 mt-0.5">
                Fasilitas Kesehatan (Puskesmas, Pustu, Posyandu, Klinik) telah terisolasi rapi dan tidak bercampur dengan fasilitas Sekolah/Pendidikan.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "6. Manajemen Realisasi Pajak PBB-P2",
      subtitle: "Monitoring target vs realisasi penerimaan PBB di 24 Lingkungan",
      category: "Pendapatan Daerah (PBB)",
      color: "from-emerald-900 via-teal-950 to-slate-900",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1 text-xs">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Rekapitulasi Target &amp; Realisasi PBB
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Memantau target nominal PBB, total SPPT Wajib Pajak, jumlah SPPT lunas, dan persentase capaian per lingkungan maupun agregat kelurahan.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              Penandaan SPPT Lunas Real-Time
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Kepling dapat mencari SPPT berdasarkan NOP atau Nama Wajib Pajak, lalu menandai status lunas saat warga melakukan pembayaran.
            </p>
          </div>

          <div className="sm:col-span-2 bg-slate-900 text-white p-3 rounded-2xl border border-slate-700 flex items-center justify-between text-[11px]">
            <span>📊 <strong>Dukungan Multi-Tahun:</strong> Pantau tren penerimaan PBB-P2 tahun 2024, 2025, hingga 2026.</span>
          </div>
        </div>
      )
    },
    {
      title: "7. Radar Monitoring & Evaluasi Kinerja",
      subtitle: "Pusat pantauan kepatuhan harian bagi Lurah dan Kasi Sektoral",
      category: "Monitoring Eksekutif",
      color: "from-slate-900 via-emerald-950 to-teal-950",
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <p className="font-black text-emerald-800 text-sm">Radar Tugas Kepling</p>
              <p className="text-[11px] text-slate-600 mt-1">Status langsung Kepling yang telah atau belum mengirim laporan &amp; presensi.</p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <p className="font-black text-teal-800 text-sm">Grafik Tren Bulanan</p>
              <p className="text-[11px] text-slate-600 mt-1">Visualisasi grafik kinerja dan keaktifan 24 Kepling dari bulan ke bulan.</p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <p className="font-black text-amber-800 text-sm">Deadline 23.30 WIB</p>
              <p className="text-[11px] text-slate-600 mt-1">Peringatan otomatis deadline pelaporan sebelum pergantian hari.</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-2 text-[11px] text-slate-700">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span><strong>Filter Fleksibel:</strong> Pencarian laporan berdasarkan tanggal, nomor lingkungan, nama Kepling, atau kata kunci kegiatan.</span>
          </div>
        </div>
      )
    },
    {
      title: "8. Ketahanan Data & Mode Offline-First",
      subtitle: "Sinkronisasi real-time berlapis: Firebase, Google Sheets, & IndexedDB",
      category: "Keandalan Sistem",
      color: "from-emerald-950 via-teal-900 to-slate-900",
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-slate-900 text-white p-3 rounded-2xl border border-emerald-500/40">
              <p className="font-black text-emerald-300 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Firebase Firestore
              </p>
              <p className="text-[10px] text-slate-300 mt-1">Database cloud utama sinkronisasi multi-perangkat.</p>
            </div>

            <div className="bg-slate-900 text-white p-3 rounded-2xl border border-teal-500/40">
              <p className="font-black text-teal-300 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400"></span> Google Sheets OAuth
              </p>
              <p className="text-[10px] text-slate-300 mt-1">Rekapitulasi otomatis ke spreadsheet pimpinan.</p>
            </div>

            <div className="bg-slate-900 text-white p-3 rounded-2xl border border-amber-500/40">
              <p className="font-black text-amber-300 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> IndexedDB 0ms
              </p>
              <p className="text-[10px] text-slate-300 mt-1">Penyimpanan lokal aman tanpa internet di lapangan.</p>
            </div>
          </div>

          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-[11px] text-emerald-950">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Jaminan 0% Kehilangan Data
            </p>
            <p className="text-slate-600 mt-0.5">
              Jika sinyal hilang saat bertugas di lapangan, data tetap tersimpan di memori HP dan otomatis terkirim begitu terhubung internet kembali.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "9. Format Cetak Resmi & Ekspor Excel",
      subtitle: "Kop surat resmi Pemko Medan, cetak PDF rapi, & ekspor spreadsheet",
      category: "Dokumentasi Resmi",
      color: "from-indigo-950 via-slate-900 to-emerald-950",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1 text-xs">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              Cetak PDF Format Resmi
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Dokumen tersusun standar dengan Kop Surat Resmi Kelurahan Mangga, tata letak foto 2 kolom yang presisi, rincian kegiatan, dan tanda tangan Kepling.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Ekspor Buku Rekap Excel (.xlsx)
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Unduh rekapitulasi kehadiran apel (harian, mingguan, bulanan), database laporan, dan status realisasi PBB ke file Microsoft Excel dengan satu klik.
            </p>
          </div>

          <div className="sm:col-span-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 text-[11px] text-emerald-900">
            <Share2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span><strong>Kirim WhatsApp Pimpinan:</strong> Bagikan format teks resmi ringkasan kegiatan langsung ke grup koordinasi.</span>
          </div>
        </div>
      )
    },
    {
      title: "10. Instalasi Aplikasi di HP (PWA)",
      subtitle: "Akses secepat aplikasi native di smartphone Android dan iPhone",
      category: "Instalasi & Mobile App",
      color: "from-emerald-900 via-teal-950 to-slate-950",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Ponsel Android (Google Chrome)
            </p>
            <ol className="text-[11px] text-slate-600 space-y-1 list-decimal pl-4">
              <li>Buka website aplikasi di Google Chrome.</li>
              <li>Klik ikon titik tiga (⋮) di kanan atas browser.</li>
              <li>Pilih menu <strong>"Tambahkan ke Layar Utama"</strong>.</li>
            </ol>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              Ponsel iPhone (Safari)
            </p>
            <ol className="text-[11px] text-slate-600 space-y-1 list-decimal pl-4">
              <li>Buka website aplikasi di browser Safari.</li>
              <li>Klik tombol <strong>Share / Bagikan</strong> (ikon kotak panah).</li>
              <li>Pilih menu <strong>"Tambah ke Layar Utama"</strong>.</li>
            </ol>
          </div>

          <div className="sm:col-span-2 bg-slate-900 text-white p-3 rounded-2xl border border-slate-700 flex items-center justify-between text-[11px]">
            <span>🔔 <strong>Info Pembaruan Otomatis:</strong> Aplikasi akan menampilkan banner dan popup <em>"Apa yang Baru"</em> setiap ada update fitur.</span>
          </div>
        </div>
      )
    },
    {
      title: "11. SOP & Alur Kerja Harian Kepling",
      subtitle: "Ringkasan panduan operasional dari pagi hingga malam hari",
      category: "SOP Operasional Kepling",
      color: "from-teal-900 via-emerald-950 to-slate-900",
      content: (
        <div className="space-y-2 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
              <p className="font-black text-emerald-950 text-xs">🌅 PAGI HARI (07.30 - 08.30)</p>
              <p className="text-[10px] text-slate-600 mt-1">Presensi Apel Pagi berfoto selfie &amp; GPS di Kantor Kelurahan.</p>
            </div>

            <div className="bg-teal-50 p-3 rounded-2xl border border-teal-200">
              <p className="font-black text-teal-950 text-xs">☀️ SIANG HARI (09.00 - 15.00)</p>
              <p className="text-[10px] text-slate-600 mt-1">Pelayanan warga, sambang rumah tangga, penertiban sampah/WRS, &amp; pemantauan PBB.</p>
            </div>

            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200">
              <p className="font-black text-indigo-950 text-xs">🌙 SORE/MALAM (s/d 23.30)</p>
              <p className="text-[10px] text-slate-600 mt-1">Pengisian laporan harian berfoto dan pengawasan ronda malam (Siskamling).</p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-2xl border border-emerald-500/40 flex items-center justify-between text-[11px]">
            <span className="font-bold text-emerald-300">"Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"</span>
            <div className="flex gap-1.5">
              <span className="bg-[#991B1B] text-white px-2 py-0.5 rounded text-[9px] font-bold">#MEDANUNTUKSEMUA</span>
              <span className="bg-[#1E3A8A] text-white px-2 py-0.5 rounded text-[9px] font-bold">#SEMUAUNTUKMEDAN</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Function to generate and download comprehensive professional PPTX file
  const handleDownloadPPT = async () => {
    try {
      setIsGenerating(true);
      const pptx = new pptxgen();

      pptx.author = "Kelurahan Mangga, Kota Medan";
      pptx.company = "Pemerintah Kota Medan";
      pptx.title = `Panduan Penggunaan SI-KEPLING MANGGA ${CURRENT_APP_VERSION}`;
      pptx.subject = "Buku Panduan Operasional Resmi 24 Kepala Lingkungan";

      // 16:9 Modern Widescreen Layout
      pptx.defineLayout({ name: 'WIDESCREEN', width: 13.33, height: 7.5 });
      pptx.layout = 'WIDESCREEN';

      // ==========================================
      // SLIDE 1: Cover Slide
      // ==========================================
      const s1 = pptx.addSlide();
      s1.background = { color: '064E3B' }; // Deep Emerald
      
      // Top accent bar
      s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: '10B981' } });
      
      s1.addText('PEMERINTAH KOTA MEDAN • KECAMATAN MEDAN TUNTUNGAN', {
        x: 1.0, y: 1.2, w: 11.33, h: 0.4,
        fontSize: 14, bold: true, color: '6EE7B7', align: 'center', charSpacing: 2
      });

      s1.addText('KELURAHAN MANGGA', {
        x: 1.0, y: 1.7, w: 11.33, h: 0.6,
        fontSize: 24, bold: true, color: 'ECFDF5', align: 'center', charSpacing: 4
      });

      s1.addText('SI-KEPLING MANGGA PRIMA', {
        x: 1.0, y: 2.6, w: 11.33, h: 1.0,
        fontSize: 40, bold: true, color: 'FFFFFF', align: 'center'
      });

      s1.addText(`Sistem Informasi Pelaporan Harian, Presensi Terpadu & WebGIS 24 Lingkungan (${CURRENT_APP_VERSION})`, {
        x: 1.0, y: 3.7, w: 11.33, h: 0.6,
        fontSize: 18, bold: false, color: 'A7F3D0', align: 'center'
      });

      // Bottom info card
      s1.addShape(pptx.ShapeType.roundRect, {
        x: 2.5, y: 4.8, w: 8.33, h: 1.4,
        fill: { color: '022C22' }, line: { color: '10B981', width: 1.5 }, rectRadius: 0.2
      });

      s1.addText([
        { text: 'BUKU PANDUAN RESMI OPERASIONAL\n', options: { fontSize: 13, bold: true, color: 'FCD34D' } },
        { text: 'Bagi Seluruh Kepala Lingkungan (Kepling I - XXIV) & Jajaran Perangkat Kelurahan\n', options: { fontSize: 11, color: 'E2E8F0' } },
        { text: `Rilis Pembaruan: ${CURRENT_RELEASE_DATE} • Edisi Modern Digital`, options: { fontSize: 10, italic: true, color: '94A3B8' } }
      ], { x: 2.6, y: 4.9, w: 8.13, h: 1.2, align: 'center' });

      s1.addText('#MEDANUNTUKSEMUA  •  #SEMUAUNTUKMEDAN', {
        x: 1.0, y: 6.8, w: 11.33, h: 0.4,
        fontSize: 12, bold: true, color: '34D399', align: 'center', charSpacing: 2
      });

      // Helper for slide template
      const addStandardSlideHeader = (slide: any, slideNumber: string, title: string, subtitle: string, category: string) => {
        // Dark top header bar
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.15, fill: { color: '0F172A' } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.15, w: 13.33, h: 0.05, fill: { color: '10B981' } });
        
        slide.addText(category.toUpperCase(), {
          x: 0.8, y: 0.15, w: 9.0, h: 0.25,
          fontSize: 10, bold: true, color: '34D399', charSpacing: 1.5
        });

        slide.addText(title, {
          x: 0.8, y: 0.4, w: 10.5, h: 0.4,
          fontSize: 20, bold: true, color: 'FFFFFF'
        });

        slide.addText(subtitle, {
          x: 0.8, y: 0.8, w: 10.5, h: 0.25,
          fontSize: 11, color: '94A3B8'
        });

        slide.addText(slideNumber, {
          x: 11.5, y: 0.3, w: 1.2, h: 0.6,
          fontSize: 26, bold: true, color: '334155', align: 'right'
        });

        // Bottom footer
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.1, w: 13.33, h: 0.4, fill: { color: 'F8FAFC' } });
        slide.addText('SI-KEPLING MANGGA PRIMA • KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN', {
          x: 0.8, y: 7.15, w: 8.0, h: 0.3,
          fontSize: 9, bold: true, color: '64748B'
        });
        slide.addText('#MEDANUNTUKSEMUA  #SEMUAUNTUKMEDAN', {
          x: 9.0, y: 7.15, w: 3.5, h: 0.3,
          fontSize: 9, bold: true, color: '059669', align: 'right'
        });
      };

      // ==========================================
      // SLIDE 2: Multi-Role System & Login
      // ==========================================
      const s2 = pptx.addSlide();
      addStandardSlideHeader(s2, '02', '1. Struktur Multi-Role & Akses Akun', 'Hak akses bertingkat dan prosedur autentikasi pengguna', 'Struktur Akun & Login');

      // 3 role cards
      s2.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 3.6, h: 3.8, fill: { color: 'ECFDF5' }, line: { color: '10B981', width: 1.2 }, rectRadius: 0.15 });
      s2.addText('SUPER ADMIN (LURAH / SEKLUR)', { x: 1.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 12, bold: true, color: '065F46' });
      s2.addText([
        { text: '• Monitoring Eksekutif 24 Kepling\n', options: { bold: true } },
        { text: '• Rekapitulasi Presensi Apel Pagi Harian\n' },
        { text: '• Manajemen Target & Realisasi PBB-P2\n' },
        { text: '• Verifikasi Laporan & Ekspor Excel/PDF\n' },
        { text: '• Pengaturan Akun & Password Kepling' }
      ], { x: 1.0, y: 2.15, w: 3.2, h: 2.9, fontSize: 11, color: '1E293B', lineSpacing: 18 });

      s2.addShape(pptx.ShapeType.roundRect, { x: 4.8, y: 1.5, w: 3.6, h: 3.8, fill: { color: 'F0FDFA' }, line: { color: '14B8A6', width: 1.2 }, rectRadius: 0.15 });
      s2.addText('KASI SEKTORAL KELURAHAN', { x: 5.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 12, bold: true, color: '115E59' });
      s2.addText([
        { text: '• Kasi Trantibum: Pantau ketertiban & siskamling\n', options: { bold: true } },
        { text: '• Kasi PMK: Evaluasi bansos & perlinsos DTKS\n' },
        { text: '• Kasi Tata Pemerintahan: Capaian PBB\n' },
        { text: '• Filter Laporan sesuai bidang tugas sektoral\n' },
        { text: '• Penilaian kinerja Kepling terpadu' }
      ], { x: 5.0, y: 2.15, w: 3.2, h: 2.9, fontSize: 11, color: '1E293B', lineSpacing: 18 });

      s2.addShape(pptx.ShapeType.roundRect, { x: 8.8, y: 1.5, w: 3.6, h: 3.8, fill: { color: 'FFFBEB' }, line: { color: 'F59E0B', width: 1.2 }, rectRadius: 0.15 });
      s2.addText('24 KEPALA LINGKUNGAN (KEPLING)', { x: 9.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 12, bold: true, color: '92400E' });
      s2.addText([
        { text: '• Presensi Apel Pagi Geotagged (07.30 - 08.30)\n', options: { bold: true } },
        { text: '• Input Laporan Harian & Multi-Foto\n' },
        { text: '• Sambang Rumah Warga & Cek Perlinsos\n' },
        { text: '• Monitoring SPPT PBB Lingkungan sendiri\n' },
        { text: '• Peta Spasial WebGIS Rumah Warga & WRS' }
      ], { x: 9.0, y: 2.15, w: 3.2, h: 2.9, fontSize: 11, color: '1E293B', lineSpacing: 18 });

      // Bottom Credentials Box
      s2.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 5.5, w: 11.6, h: 1.3, fill: { color: '0F172A' }, line: { color: '334155', width: 1 }, rectRadius: 0.15 });
      s2.addText([
        { text: 'PANDUAN LOGIN: ', options: { bold: true, color: 'FCD34D', fontSize: 12 } },
        { text: 'Buka web aplikasi -> Pilih Lingkungan Anda (contoh: Lingkungan XXI - Muhammad Shiddiq) -> Masukkan password bawaan: ', options: { color: 'FFFFFF', fontSize: 11 } },
        { text: 'mangga[nomor_lingkungan] ', options: { bold: true, color: '34D399', fontSize: 12 } },
        { text: '(Contoh: mangga21). Sangat disarankan segera ubah kata sandi melalui tombol profil akun.', options: { color: 'CBD5E1', fontSize: 11 } }
      ], { x: 1.0, y: 5.65, w: 11.2, h: 1.0 });

      // ==========================================
      // SLIDE 3: Presensi Apel & Network Time
      // ==========================================
      const s3 = pptx.addSlide();
      addStandardSlideHeader(s3, '03', '2. Presensi Apel Pagi & Waktu Jaringan Resmi', 'Jadwal kerja, geofencing GPS, selfie camera, & Network True Time Sync', 'Presensi Terpadu');

      s3.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1', width: 1 }, rectRadius: 0.15 });
      s3.addText('KETENTUAN RESMI APEL PAGI', { x: 1.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '0F172A' });
      s3.addText([
        { text: '• Jadwal Wajib: ', options: { bold: true, color: '059669' } },
        { text: 'Senin s/d Jumat, Pukul 07.30 - 08.30 WIB.\n\n' },
        { text: '• Libur Akhir Pekan: ', options: { bold: true, color: '3B82F6' } },
        { text: 'Sabtu & Minggu tidak ada kewajiban apel pagi.\n\n' },
        { text: '• Toleransi Waktu: ', options: { bold: true, color: 'DC2626' } },
        { text: 'Pukul 08.30 WIB form tertutup otomatis dan tercatat status "Tidak Mengikuti Apel".\n\n' },
        { text: '• Kategori Status: ', options: { bold: true, color: 'D97706' } },
        { text: 'Hadir, Izin, Sakit, Dinas Luar, atau Tidak Apel.' }
      ], { x: 1.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '334155', lineSpacing: 16 });

      s3.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: '0F172A' }, line: { color: '10B981', width: 1.5 }, rectRadius: 0.15 });
      s3.addText('FITUR KEAMANAN & ANTI-MANIPULASI', { x: 7.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '34D399' });
      s3.addText([
        { text: '1. Waktu Jaringan Resmi (NTP Server):\n', options: { bold: true, color: 'FCD34D' } },
        { text: 'Waktu dikunci dari server jaringan. Jika jam HP diubah manual, sistem otomatis menolak selisih dan tetap memakai waktu jaringan resmi.\n\n', options: { color: 'E2E8F0' } },
        { text: '2. Radius Validasi GPS (Geofencing):\n', options: { bold: true, color: '38BDF8' } },
        { text: 'Kehadiran hanya dapat dikirim jika Kepling berada di radius Halaman Kantor Kelurahan Mangga.\n\n', options: { color: 'E2E8F0' } },
        { text: '3. Kamera Selfie Depan Real-Time:\n', options: { bold: true, color: '4ADE80' } },
        { text: 'Foto langsung saat apel dengan tanda air timestamp dan lokasi terverifikasi.', options: { color: 'E2E8F0' } }
      ], { x: 7.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, lineSpacing: 15 });

      // ==========================================
      // SLIDE 4: Form Laporan Harian
      // ==========================================
      const s4 = pptx.addSlide();
      addStandardSlideHeader(s4, '04', '3. Pengisian Formulir Laporan Harian', 'Pelaporan kegiatan berbasis bukti visual, geotagging, dan klasifikasi tugas', 'Formulir Laporan');

      const formSteps = [
        { num: '1', title: 'Tanggal & Petugas', desc: 'Tanggal otomatis hari ini (dapat disesuaikan) dan nama Kepling terkunci sesuai akun aktif.' },
        { num: '2', title: 'Upload Hingga 8 Foto', desc: 'Kompresi cerdas otomatis di browser. Foto beresolusi tinggi dikompres cepat tanpa beban kuota.' },
        { num: '3', title: 'GPS & Deteksi Alamat', desc: 'Sistem membaca koordinat GPS dan otomatis mengisi nama jalan (*reverse geocoding*) di lapangan.' },
        { num: '4', title: 'Kategori & Deskripsi', desc: 'Pilih bidang: Kebersihan/Sampah, Trantibum, Gotong Royong, Sosialisasi, atau Ronda Malam/Siskamling.' }
      ];

      formSteps.forEach((st, idx) => {
        const xPos = 0.8 + idx * 2.95;
        s4.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.6, w: 2.8, h: 4.0, fill: { color: 'F8FAFC' }, line: { color: '10B981', width: 1.2 }, rectRadius: 0.15 });
        s4.addShape(pptx.ShapeType.ellipse, { x: xPos + 1.05, y: 1.85, w: 0.7, h: 0.7, fill: { color: '059669' } });
        s4.addText(st.num, { x: xPos + 1.05, y: 1.85, w: 0.7, h: 0.7, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center' });
        s4.addText(st.title, { x: xPos + 0.15, y: 2.7, w: 2.5, h: 0.4, fontSize: 12, bold: true, color: '0F172A', align: 'center' });
        s4.addText(st.desc, { x: xPos + 0.15, y: 3.2, w: 2.5, h: 2.2, fontSize: 10, color: '475569', align: 'center', lineSpacing: 15 });
      });

      s4.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 5.8, w: 11.6, h: 1.0, fill: { color: 'ECFDF5' }, line: { color: '059669', width: 1 }, rectRadius: 0.15 });
      s4.addText([
        { text: 'TIPS PENTING: ', options: { bold: true, color: '065F46', fontSize: 11 } },
        { text: 'Setiap laporan yang disimpan langsung muncul di radar monitoring Super Admin dan dapat dibagikan dengan format resmi ke grup WhatsApp Pimpinan.', options: { color: '1E293B', fontSize: 11 } }
      ], { x: 1.0, y: 5.95, w: 11.2, h: 0.7 });

      // ==========================================
      // SLIDE 5: Kunjungan Warga & Perlinsos
      // ==========================================
      const s5 = pptx.addSlide();
      addStandardSlideHeader(s5, '05', '4. Kunjungan Warga & Opsi Perlinsos Terbaru', 'Pendataan sambang warga door-to-door, DTKS, dan pencatatan status bansos', 'Kunjungan & Perlinsos');

      s5.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 3.6, h: 4.0, fill: { color: 'ECFDF5' }, line: { color: '10B981', width: 1.5 }, rectRadius: 0.15 });
      s5.addText('STATUS: SUDAH', { x: 1.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: '065F46' });
      s5.addText([
        { text: 'Warga Sudah Terdata Bansos\n\n', options: { bold: true, color: '047857' } },
        { text: '• Keluarga telah menerima program perlindungan sosial (PKH, BPNT, BLT, dll).\n\n' },
        { text: '• Kepling mencatat nama kepala keluarga dan nomor kontak saat silaturahmi.' }
      ], { x: 1.0, y: 2.2, w: 3.2, h: 3.0, fontSize: 11, color: '334155', lineSpacing: 16 });

      s5.addShape(pptx.ShapeType.roundRect, { x: 4.8, y: 1.5, w: 3.6, h: 4.0, fill: { color: 'FFFBEB' }, line: { color: 'F59E0B', width: 1.5 }, rectRadius: 0.15 });
      s5.addText('STATUS: BELUM', { x: 5.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: '92400E' });
      s5.addText([
        { text: 'Warga Belum Terdata Bansos\n\n', options: { bold: true, color: 'B45309' } },
        { text: '• Keluarga belum menerima bantuan sosial pemerintah.\n\n' },
        { text: '• Menjadi dasar rujukan usulan verifikasi kelayakan DTKS baru ke Kasi PMK/Perlinsos.' }
      ], { x: 5.0, y: 2.2, w: 3.2, h: 3.0, fontSize: 11, color: '334155', lineSpacing: 16 });

      s5.addShape(pptx.ShapeType.roundRect, { x: 8.8, y: 1.5, w: 3.6, h: 4.0, fill: { color: 'FFF1F2' }, line: { color: 'F43F5E', width: 1.5 }, rectRadius: 0.15 });
      s5.addText('STATUS: MENOLAK (BARU)', { x: 9.0, y: 1.7, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: '9F1239' });
      s5.addText([
        { text: 'Warga Menolak Bantuan\n\n', options: { bold: true, color: 'BE123C' } },
        { text: '• Warga secara sadar menolak bansos / merasa sudah mampu.\n\n' },
        { text: '• Kepling WAJIB mencatat Nama & Alamat lengkap warga yang menolak untuk akuntabilitas data.' }
      ], { x: 9.0, y: 2.2, w: 3.2, h: 3.0, fontSize: 11, color: '334155', lineSpacing: 16 });

      s5.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 5.7, w: 11.6, h: 1.1, fill: { color: '0F172A' }, line: { color: '334155', width: 1 }, rectRadius: 0.15 });
      s5.addText([
        { text: 'AKUNTABILITAS DATA PERLINSOS: ', options: { bold: true, color: 'FCD34D', fontSize: 11 } },
        { text: 'Fitur juga mencakup opsi pencatatan ', options: { color: 'FFFFFF', fontSize: 11 } },
        { text: '"Warga Tidak di Tempat" ', options: { bold: true, color: '38BDF8', fontSize: 11 } },
        { text: 'apabila rumah dalam keadaan kosong saat dikunjungi petugas Kepling.', options: { color: 'CBD5E1', fontSize: 11 } }
      ], { x: 1.0, y: 5.85, w: 11.2, h: 0.8 });

      // ==========================================
      // SLIDE 6: WebGIS 24 Lingkungan
      // ==========================================
      const s6 = pptx.addSlide();
      addStandardSlideHeader(s6, '06', '5. Peta Spasial WebGIS 24 Lingkungan', 'Pemetaan batas wilayah, titik rumah warga, WRS, dan klasifikasi faskes', 'WebGIS Spasial');

      s6.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F0FDF4' }, line: { color: '10B981', width: 1.2 }, rectRadius: 0.15 });
      s6.addText('KEMAMPUAN MODUL WEBGIS', { x: 1.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '065F46' });
      s6.addText([
        { text: '1. Batas Poligon 24 Lingkungan:\n', options: { bold: true, color: '047857' } },
        { text: 'Visualisasi garis batas resmi Lingkungan I s/d XXIV dengan navigasi interaktif.\n\n' },
        { text: '2. Penanda Titik Rumah Warga:\n', options: { bold: true, color: '047857' } },
        { text: 'Plotting titik koordinat rumah warga, nama kepala keluarga, dan jumlah jiwa.\n\n' },
        { text: '3. Wajib Retribusi Sampah (WRS):\n', options: { bold: true, color: '047857' } },
        { text: 'Tandai rumah yang telah/belum berlangganan angkutan sampah kelurahan.' }
      ], { x: 1.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '1E293B', lineSpacing: 16 });

      s6.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F8FAFC' }, line: { color: '3B82F6', width: 1.2 }, rectRadius: 0.15 });
      s6.addText('PEMISAHAN FASILITAS AKURAT', { x: 7.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '1E40AF' });
      s6.addText([
        { text: '• Fasilitas Kesehatan (Faskes):\n', options: { bold: true, color: '0284C7' } },
        { text: 'Puskesmas, Puskesmas Pembantu (Pustu), Posyandu, Klinik, dan Apotek dikelompokkan presisi pada kategori Kesehatan.\n\n' },
        { text: '• Fasilitas Pendidikan (Sekolah):\n', options: { bold: true, color: '4F46E5' } },
        { text: 'PAUD, TK, SD, SMP, SMA, SMK, dan Kampus terpisah secara mandiri.\n\n' },
        { text: '• Layer Tematik Tambahan:\n', options: { bold: true, color: '0D9488' } },
        { text: 'Pemantauan kondisi jalan (aspal/rusak/paving) dan titik rawan genangan air.' }
      ], { x: 7.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '1E293B', lineSpacing: 16 });

      // ==========================================
      // SLIDE 7: PBB-P2 Realisasi
      // ==========================================
      const s7 = pptx.addSlide();
      addStandardSlideHeader(s7, '07', '6. Rekapitulasi Realisasi Pajak PBB-P2', 'Monitoring penerimaan daerah, target SPPT, dan penandaan lunas real-time', 'Pendapatan Daerah (PBB)');

      s7.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1', width: 1 }, rectRadius: 0.15 });
      s7.addText('REKAPITULASI TARGET & REALISASI', { x: 1.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '0F172A' });
      s7.addText([
        { text: '• Target Nominal PBB:\n', options: { bold: true, color: '059669' } },
        { text: 'Menampilkan pagu target rupiah per-lingkungan dan total Kelurahan Mangga.\n\n' },
        { text: '• Realisasi Penerimaan:\n', options: { bold: true, color: '0D9488' } },
        { text: 'Kalkulasi otomatis persentase capaian (%) dan total uang pajak yang telah disetor.\n\n' },
        { text: '• Rekapitulasi 24 Lingkungan:\n', options: { bold: true, color: '4F46E5' } },
        { text: 'Tabel perbandingan capaian tertinggi hingga terendah untuk evaluasi mingguan.' }
      ], { x: 1.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '334155', lineSpacing: 16 });

      s7.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'ECFDF5' }, line: { color: '059669', width: 1.5 }, rectRadius: 0.15 });
      s7.addText('PENCARIAN & TANDAI SPPT LUNAS', { x: 7.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '065F46' });
      s7.addText([
        { text: '1. Pencarian Cepat SPPT:\n', options: { bold: true, color: '047857' } },
        { text: 'Cari Wajib Pajak berdasarkan NOP (Nomor Objek Pajak), Nama Wajib Pajak, atau Alamat Rumah.\n\n' },
        { text: '2. Tombol Verifikasi Lunas:\n', options: { bold: true, color: '047857' } },
        { text: 'Saat warga membayar, Kepling langsung menandai status lunas di HP.\n\n' },
        { text: '3. Multi-Tahun Pajak (2024 - 2026):\n', options: { bold: true, color: '047857' } },
        { text: 'Mendukung peralihan tahun pajak untuk pemantauan tunggakan piutang PBB.' }
      ], { x: 7.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '1E293B', lineSpacing: 16 });

      // ==========================================
      // SLIDE 8: Cetak PDF & Ekspor Excel
      // ==========================================
      const s8 = pptx.addSlide();
      addStandardSlideHeader(s8, '08', '7. Cetak Laporan PDF Resmi & Ekspor Excel', 'Standar format Pemko Medan, Kop Surat Kelurahan, & spreadsheet', 'Dokumentasi Resmi');

      s8.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'EEF2FF' }, line: { color: '6366F1', width: 1.2 }, rectRadius: 0.15 });
      s8.addText('CETAK DOKUMEN LAPORAN PDF', { x: 1.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '3730A3' });
      s8.addText([
        { text: '• Kop Surat Resmi Pemko Medan:\n', options: { bold: true, color: '4338CA' } },
        { text: 'Lengkap dengan logo Garuda/Pemko Medan dan alamat Kantor Kelurahan Mangga.\n\n' },
        { text: '• Tata Letak Foto 2 Kolom Presisi:\n', options: { bold: true, color: '4338CA' } },
        { text: 'Foto dokumentasi tersusun rapi otomatis dengan keterangan kegiatan.\n\n' },
        { text: '• Tanda Tangan Sah Kepala Lingkungan:\n', options: { bold: true, color: '4338CA' } },
        { text: 'Dilengkapi kolom tanda tangan resmi untuk arsip fisik dan audit inspektorat.' }
      ], { x: 1.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '1E293B', lineSpacing: 16 });

      s8.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F0FDF4' }, line: { color: '16A34A', width: 1.2 }, rectRadius: 0.15 });
      s8.addText('EKSPOR EXCEL & WHATSAPP SHARE', { x: 7.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '166534' });
      s8.addText([
        { text: '• Ekspor Spreadsheet (.xlsx):\n', options: { bold: true, color: '15803D' } },
        { text: 'Unduh rekapitulasi presensi apel (harian, mingguan, bulanan), database laporan, dan data PBB ke format Microsoft Excel.\n\n' },
        { text: '• Berbagi Format WhatsApp Resmi:\n', options: { bold: true, color: '15803D' } },
        { text: 'Satu klik tombol share untuk mengirim rangkuman kegiatan berformat rapi langsung ke grup WhatsApp Pimpinan.\n\n' },
        { text: '• Integrasi Google Drive / Sheets:\n', options: { bold: true, color: '15803D' } },
        { text: 'Sinkronisasi otomatis ke Google Workspace Kelurahan.' }
      ], { x: 7.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '1E293B', lineSpacing: 16 });

      // ==========================================
      // SLIDE 9: PWA & Update Notif
      // ==========================================
      const s9 = pptx.addSlide();
      addStandardSlideHeader(s9, '09', '8. Instalasi Aplikasi di HP & Pembaruan Otomatis', 'Teknologi Progressive Web App (PWA) & fitur notifikasi rilis versi', 'PWA & Pembaruan');

      s9.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1', width: 1 }, rectRadius: 0.15 });
      s9.addText('CARA PASANG DI HP ANDROID / IPHONE', { x: 1.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: '0F172A' });
      s9.addText([
        { text: 'Ponsel Android (Google Chrome):\n', options: { bold: true, color: '059669' } },
        { text: '1. Buka web aplikasi di Chrome.\n2. Klik ikon titik tiga (⋮) kanan atas.\n3. Pilih "Tambahkan ke Layar Utama".\n\n' },
        { text: 'Ponsel iPhone (Safari):\n', options: { bold: true, color: '2563EB' } },
        { text: '1. Buka web aplikasi di Safari.\n2. Klik tombol Share (ikon kotak panah).\n3. Pilih "Tambah ke Layar Utama".\n\n' },
        { text: 'Aplikasi akan muncul seperti aplikasi bawaan di menu HP!' }
      ], { x: 1.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, color: '334155', lineSpacing: 16 });

      s9.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.5, w: 5.6, h: 5.3, fill: { color: '0F172A' }, line: { color: 'F59E0B', width: 1.5 }, rectRadius: 0.15 });
      s9.addText('SISTEM NOTIFIKASI PEMBARUAN', { x: 7.1, y: 1.75, w: 5.0, h: 0.35, fontSize: 13, bold: true, color: 'FCD34D' });
      s9.addText([
        { text: '• Banner Notifikasi Pembaruan:\n', options: { bold: true, color: '34D399' } },
        { text: 'Muncul otomatis saat terdapat rilis fitur baru agar seluruh Kepling mengetahui pembaruan sistem.\n\n', options: { color: 'E2E8F0' } },
        { text: '• Modal "Apa yang Baru":\n', options: { bold: true, color: '38BDF8' } },
        { text: 'Menampilkan rincian fitur baru, perbaikan bug, dan peningkatan performa.\n\n', options: { color: 'E2E8F0' } },
        { text: '• Tombol Segarkan Cepat:\n', options: { bold: true, color: 'F472B6' } },
        { text: 'Memungkinkan pengguna membersihkan cache dan memuat versi terbaru seketika.', options: { color: 'E2E8F0' } }
      ], { x: 7.1, y: 2.2, w: 5.0, h: 4.3, fontSize: 11, lineSpacing: 16 });

      // ==========================================
      // SLIDE 10: SOP Alur Kerja & Closing
      // ==========================================
      const s10 = pptx.addSlide();
      s10.background = { color: '064E3B' }; // Deep Emerald

      s10.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: '10B981' } });
      
      s10.addText('RANGKUMAN ALUR KERJA HARIAN KEPLING', {
        x: 1.0, y: 0.8, w: 11.33, h: 0.5,
        fontSize: 22, bold: true, color: 'FFFFFF', align: 'center'
      });

      // 3 Timeline cards
      s10.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: 1.6, w: 3.5, h: 3.4, fill: { color: '022C22' }, line: { color: '10B981', width: 1.2 }, rectRadius: 0.15 });
      s10.addText('07.30 - 08.30 WIB', { x: 1.2, y: 1.8, w: 3.1, h: 0.35, fontSize: 13, bold: true, color: '34D399' });
      s10.addText('APEL PAGI TERPADU\n\nPresensi wajib di Kantor Kelurahan dengan validasi GPS, foto selfie, dan Waktu Jaringan Resmi.', {
        x: 1.2, y: 2.3, w: 3.1, h: 2.4, fontSize: 11, color: 'E2E8F0', lineSpacing: 16
      });

      s10.addShape(pptx.ShapeType.roundRect, { x: 4.9, y: 1.6, w: 3.5, h: 3.4, fill: { color: '022C22' }, line: { color: '14B8A6', width: 1.2 }, rectRadius: 0.15 });
      s10.addText('09.00 - 15.00 WIB', { x: 5.1, y: 1.8, w: 3.1, h: 0.35, fontSize: 13, bold: true, color: '2DD4BF' });
      s10.addText('SAMBANG WARGA & PBB\n\nPelayanan warga, silaturahmi door-to-door, pemantauan WRS sampah, dan penagihan/update SPPT PBB.', {
        x: 5.1, y: 2.3, w: 3.1, h: 2.4, fontSize: 11, color: 'E2E8F0', lineSpacing: 16
      });

      s10.addShape(pptx.ShapeType.roundRect, { x: 8.8, y: 1.6, w: 3.5, h: 3.4, fill: { color: '022C22' }, line: { color: 'F59E0B', width: 1.2 }, rectRadius: 0.15 });
      s10.addText('s/d 23.30 WIB', { x: 9.0, y: 1.8, w: 3.1, h: 0.35, fontSize: 13, bold: true, color: 'FCD34D' });
      s10.addText('LAPORAN & SISKAMLING\n\nPengisian laporan harian berfoto dan pemantauan ronda malam sebelum batas deadline harian.', {
        x: 9.0, y: 2.3, w: 3.1, h: 2.4, fontSize: 11, color: 'E2E8F0', lineSpacing: 16
      });

      s10.addText('"Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"', {
        x: 1.0, y: 5.4, w: 11.33, h: 0.5,
        fontSize: 18, italic: true, bold: true, color: 'A7F3D0', align: 'center'
      });

      s10.addText('#MEDANUNTUKSEMUA  •  #SEMUAUNTUKMEDAN', {
        x: 1.0, y: 6.3, w: 11.33, h: 0.4,
        fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', charSpacing: 2
      });

      // Download file
      await pptx.writeFile({ fileName: `Panduan_Penggunaan_SI_KEPLING_MANGGA_${CURRENT_APP_VERSION}.pptx` });
    } catch (err) {
      console.error('Error generating PPTX:', err);
      alert('Gagal mendownload PPTX. Silakan coba kembali.');
    } finally {
      setIsGenerating(false);
    }
  };

  const slide = slidesData[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 animate-scale-up">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between text-white border-b border-emerald-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <Presentation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-wide text-white">Slide Panduan Presentasi (PPT)</h3>
                <span className="px-2 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                  {CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-normal">Panduan Lengkap Operasional SI-KEPLING Kelurahan Mangga</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPPT}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              title="Download File PowerPoint (.pptx)"
            >
              <Download className={`w-3.5 h-3.5 ${isGenerating ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isGenerating ? 'Menyiapkan PPT...' : 'Download PPTX'}</span>
              <span className="sm:hidden">{isGenerating ? '...' : 'PPTX'}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Viewer Screen */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-100 flex flex-col justify-center custom-scrollbar">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-slate-200/90 overflow-hidden flex flex-col min-h-[380px] sm:min-h-[420px]">
            
            {/* Top Bar of Slide */}
            <div className={`bg-gradient-to-r ${slide.color} px-5 sm:px-6 py-3.5 sm:py-4 text-white flex justify-between items-center relative overflow-hidden shrink-0`}>
              <div className="relative z-10 pr-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-400/40 inline-block mb-1 font-mono">
                  {slide.category}
                </span>
                <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight tracking-tight text-white">{slide.title}</h2>
                <p className="text-[11px] sm:text-xs text-slate-200/90 mt-0.5 font-medium">{slide.subtitle}</p>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white/20 tracking-tighter shrink-0 font-mono">
                {String(currentSlide + 1).padStart(2, '0')}
              </span>
            </div>

            {/* Slide Main Content */}
            <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center overflow-y-auto">
              {slide.content}
            </div>

            {/* Slide Sub-Footer */}
            <div className="bg-slate-50 border-t border-slate-200/80 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span className="font-bold">SI-KEPLING MANGGA • KELURAHAN MANGGA</span>
              <div className="flex items-center gap-2 font-bold">
                <span className="text-[#991B1B]">#MEDANUNTUKSEMUA</span>
                <span className="text-slate-300">•</span>
                <span className="text-[#1E3A8A]">#SEMUAUNTUKMEDAN</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Slide Controls */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
              title="Slide Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1 sm:px-2 select-none">
              Slide <strong className="text-emerald-700 font-black">{currentSlide + 1}</strong> dari {slidesData.length}
            </span>
            <button
              onClick={() => setCurrentSlide((prev) => Math.min(slidesData.length - 1, prev + 1))}
              disabled={currentSlide === slidesData.length - 1}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
              title="Slide Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPPT}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PowerPoint (.pptx)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
