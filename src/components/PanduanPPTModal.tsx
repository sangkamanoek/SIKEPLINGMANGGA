import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Presentation,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Share2,
  Printer,
  Sparkles,
  ShieldCheck,
  Award,
  Users,
  Camera,
  Activity,
  Calendar,
  AlertTriangle,
  Edit3,
  Wrench,
  Flower2,
  BookOpen,
  Wallet,
  KeyRound,
  ShieldAlert,
  Briefcase,
  UserCheck,
  Eye,
  Bell,
  Lock,
} from 'lucide-react';
import pptxgen from 'pptxgenjs';
import { CURRENT_APP_VERSION, CURRENT_RELEASE_DATE } from '../lib/appVersionService';

interface PanduanPPTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BANNER_IMAGE_PATH = '/assets/aistudio/image_d160190c.png';

const getImageBase64 = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

export const PanduanPPTModal: React.FC<PanduanPPTModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const slidesData = [
    {
      title: 'SI-MANGGA — Panduan Lengkap Semua Jenis Akun',
      subtitle: `Sistem Informasi & Administrasi Kelurahan Mangga (${CURRENT_APP_VERSION})`,
      category: 'Buku Panduan Operasional Resmi',
      color: 'from-emerald-900 via-teal-950 to-slate-950',
      content: (
        <div className="flex flex-col items-center text-center space-y-4 py-1">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-800 shadow-lg border border-emerald-400/40">
            <Presentation className="w-8 h-8 text-emerald-800" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 text-xs font-black mb-1.5 border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pemerintah Kota Medan • Kecamatan Medan Tuntungan</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              Kelurahan Mangga
            </h3>
            <p className="text-emerald-800 font-bold text-xs sm:text-sm mt-1 max-w-2xl mx-auto leading-relaxed">
              Petunjuk Teknis Lengkap &amp; Terperinci Penggunaan Aplikasi Berdasarkan Segregasi Tupoksi untuk Setiap Jenis Akun Pengguna
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-3xl text-left text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="bg-white p-2 rounded-xl border border-emerald-200">
              <p className="text-[10px] text-emerald-700 font-black uppercase">Pimpinan</p>
              <p className="font-bold text-slate-900 text-[11px]">Lurah (Super Admin) &amp; Seklur</p>
            </div>
            <div className="bg-white p-2 rounded-xl border border-teal-200">
              <p className="text-[10px] text-teal-700 font-black uppercase">3 Kasi Tersekat</p>
              <p className="font-bold text-slate-900 text-[11px]">Pemerintahan, Pemb., Trantib</p>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200">
              <p className="text-[10px] text-amber-700 font-black uppercase">Kewilayahan &amp; Mitra</p>
              <p className="font-bold text-slate-900 text-[11px]">24 Kepling &amp; Bapenda</p>
            </div>
            <div className="bg-white p-2 rounded-xl border border-rose-200">
              <p className="text-[10px] text-rose-700 font-black uppercase">Pemberdayaan</p>
              <p className="font-bold text-slate-900 text-[11px]">TP-PKK Kel, Pokja &amp; 24 Lingk.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
              Versi: <strong className="text-slate-900">{CURRENT_APP_VERSION}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
              Pembaruan: <strong className="text-slate-900">{CURRENT_RELEASE_DATE}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              Sinkronisasi Cloud Real-Time + Offline Cache
            </span>
          </div>
        </div>
      ),
    },
    {
      title: '1. Peta Segregasi Akun, Login & Keamanan Sandi',
      subtitle: 'Daftar lengkap 8 kelompok akun resmi beserta aturan batas akses menu masing-masing',
      category: 'Struktur Akun & Autentikasi',
      color: 'from-slate-950 via-emerald-950 to-teal-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-700">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <p className="font-black text-emerald-950 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Super Admin (Lurah)</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                ID: <code className="font-mono font-bold text-emerald-900">super_admin</code>. Akses penuh Kelurahan + PKK + menu eksklusif <strong>Kegiatan Lurah</strong> &amp; verifikasi Posko.
              </p>
            </div>

            <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-200">
              <p className="font-black text-sky-950 text-[11px] flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span>Sekretaris Lurah</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                ID: <code className="font-mono font-bold text-sky-900">sekretaris</code>. Koordinasi Monitoring, Agenda, Posko, Absensi PDF A4, Surat, PBB, Pembangunan (tanpa Kegiatan Lurah).
              </p>
            </div>

            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-200">
              <p className="font-black text-teal-950 text-[11px] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>3 Kasi (Tersekat Ketat)</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                <code className="font-mono font-bold">kasi_pemerintahan</code>, <code className="font-mono font-bold">kasi_pembangunan</code>, <code className="font-mono font-bold">kasi_trantibum</code>. Hanya buka menu tupoksi bidangnya.
              </p>
            </div>

            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <p className="font-black text-amber-950 text-[11px] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>24 Kepling</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                ID: <code className="font-mono font-bold text-amber-900">kepling_1</code>–<code className="font-mono font-bold">24</code>. Sandi awal: <code className="font-mono bg-white px-1 rounded">mangga01</code>–<code className="font-mono bg-white px-1 rounded">mangga24</code>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
              <p className="font-black text-indigo-950 text-[11px] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span>Petugas Bapenda (Pengawas Pajak)</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                ID: <code className="font-mono font-bold text-indigo-900">petugas_bapenda</code>. Akses khusus Read-Only (Lihat Saja) pada Realisasi PBB-P2 24 Lingkungan.
              </p>
            </div>

            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <p className="font-black text-rose-950 text-[11px] flex items-center gap-1.5">
                <Flower2 className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                <span>Tim Penggerak PKK (Kelurahan, Pokja &amp; Lingkungan)</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                ID: <code className="font-mono font-bold">ketua_pkk</code>, <code className="font-mono font-bold">sekretaris_pkk</code>, <code className="font-mono font-bold">pokja_1..4</code>, &amp; <code className="font-mono font-bold">pkk_lingkungan_1..24</code> (sandi awal <code className="font-mono bg-white px-1 rounded">pkkmangga01</code>–<code className="font-mono bg-white px-1 rounded">24</code>).
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-emerald-500/40 space-y-1">
            <p className="font-bold text-amber-300 text-[11px] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Prosedur Login &amp; Ganti Kata Sandi:</span>
            </p>
            <p className="text-[10.5px] text-slate-200 leading-relaxed">
              1) Pilih kelompok/nama akun di halaman Login &rarr; masukkan kata sandi resmi (hubungi Super Admin/Seklur untuk kredensial struktural). 2) Setelah masuk, klik profil di kanan atas &rarr; <strong>"Ubah Kata Sandi"</strong> untuk mengganti sandi bawaan agar akun aman.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '2. Panduan Akun Super Admin (Lurah) & Sekretaris Lurah',
      subtitle: 'Kontrol eksekutif kelurahan, Kegiatan Lurah eksklusif, Absensi Agenda A4 & Verifikasi Posko',
      category: 'Akun Pimpinan Kelurahan',
      color: 'from-emerald-950 via-slate-900 to-teal-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 space-y-1.5">
              <p className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Super Admin / Lurah (Akses Penuh + Eksklusif)</span>
              </p>
              <ul className="text-[10.5px] text-slate-700 space-y-1 list-disc pl-4 leading-relaxed">
                <li><strong>Kegiatan Lurah (Eksklusif):</strong> Hanya terlihat &amp; bisa dikelola Super Admin untuk mencatat agenda kedinasan Lurah berfoto.</li>
                <li><strong>Verifikasi Kehadiran Posko:</strong> Pada menu <em>Jadwal Posko</em>, Lurah dapat memverifikasi status hadir Kepling yang bertugas (jika Kepling hadir di lapangan namun lupa absen HP) &rarr; otomatis masuk Laporan Harian Kepling.</li>
                <li><strong>Monitoring &amp; Capaian Target:</strong> Pantau kepatuhan 24 Kepling, ekspor Excel, atur target, &amp; akses penuh modul TP-PKK.</li>
              </ul>
            </div>

            <div className="bg-sky-50 p-3 rounded-2xl border border-sky-200 space-y-1.5">
              <p className="font-black text-sky-950 text-xs flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-sky-700 shrink-0" />
                <span>Sekretaris Kelurahan / Seklur (Koordinasi)</span>
              </p>
              <ul className="text-[10.5px] text-slate-700 space-y-1 list-disc pl-4 leading-relaxed">
                <li><strong>Menu Aktif:</strong> Monitoring Laporan, Realisasi Pembangunan, Agenda Kelurahan, Jadwal Posko, Absensi Kepling, Capaian Target, Realisasi PBB, Surat Kedinasan, Kunjungan Warga, &amp; Arsip Riwayat.</li>
                <li><strong>Batasan Keamanan:</strong> Menu <em>Kegiatan Lurah</em> dan <em>Input Laporan Kepling</em> disembunyikan otomatis.</li>
                <li><strong>Surat Kedinasan:</strong> Kelola agenda surat masuk/keluar, undangan resmi, &amp; nomor register kelurahan.</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-emerald-500/40 flex items-start gap-2 text-[10.5px]">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-slate-200">
              <strong className="text-emerald-300">Agenda Kelurahan &amp; Absensi Kepling (Auto-Sync &amp; PDF 1 Lembar A4):</strong> Buat jadwal di <em>Agenda Kelurahan</em> &rarr; buka <em>Absensi Kepling</em> &rarr; tandai status <strong>Hadir / Izin / Sakit / Tidak Hadir</strong>. Kepling yang ditandai <strong>Hadir</strong> otomatis masuk ke <em>Laporan Harian</em> &amp; <em>Capaian Kinerja</em>. Klik Cetak PDF untuk mencetak 24 baris presisi <strong>1 lembar A4</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '3. Panduan Akun Kasi Tata Pemerintahan',
      subtitle: 'Segregasi tupoksi khusus bidang Pemerintahan, Pajak PBB-P2, IKD & Arsip Pemerintahan',
      category: 'Akun Kasi Tata Pemerintahan',
      color: 'from-blue-950 via-slate-900 to-emerald-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between gap-2">
            <div>
              <p className="font-black text-blue-950 text-xs">Menu Yang Dapat Diakses (4 Menu Tersekat)</p>
              <p className="text-[10.5px] text-blue-800 mt-0.5">
                Pusat Menu • Dashboard Pemerintahan • Realisasi PBB • Arsip Pemerintahan
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-blue-700 text-white font-mono text-[10px] font-bold shrink-0">
              kasi_pemerintahan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600 shrink-0" />
                <span>1. Dashboard Pemerintahan</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Pantau peringkat (leaderboard) realisasi PBB per lingkungan, capaian aktivasi Identitas Kependudukan Digital (IKD), dan indikator administrasi pertanahan/kependudukan.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>2. Realisasi PBB-P2</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Filter SPPT per Lingkungan I–XXIV (tahun 2024–2026), verifikasi SPPT Lunas vs Piutang, kelola pindah NOP antar lingkungan, serta ekspor rekapitulasi PBB ke Excel.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>3. Arsip Pemerintahan</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Tinjau laporan Kepling yang relevan dengan urusan Pemerintahan &amp; Administrasi Warga, cetak dokumen PDF, atau unduh arsip kegiatan bidang Pemerintahan.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-blue-500/40 text-[10.5px] leading-relaxed">
            <strong className="text-amber-300">Catatan Segregasi:</strong> Menu non-tupoksi seperti <em>Jadwal Posko</em>, <em>Realisasi Pembangunan</em>, <em>Kunjungan Warga</em>, <em>Kegiatan Lurah</em>, dan <em>Monitoring Umum</em> otomatis disembunyikan agar fokus kerja Kasi Tata Pemerintahan terjaga.
          </div>
        </div>
      ),
    },
    {
      title: '4. Panduan Akun Kasi Pembangunan & Kesos',
      subtitle: 'Segregasi tupoksi khusus Perlinsos, Sarpras Infrastruktur 0%-100% & Kunjungan Warga',
      category: 'Akun Kasi Pembangunan & Kesos',
      color: 'from-indigo-950 via-slate-900 to-teal-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 flex items-center justify-between gap-2">
            <div>
              <p className="font-black text-indigo-950 text-xs">Menu Yang Dapat Diakses (5 Menu Tersekat)</p>
              <p className="text-[10.5px] text-indigo-800 mt-0.5">
                Pusat Menu • Dashboard Kesos • Realisasi Pembangunan • Kunjungan Warga • Arsip Pembangunan
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-700 text-white font-mono text-[10px] font-bold shrink-0">
              kasi_pembangunan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-600 shrink-0" />
                <span>1. Dashboard Kesos</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Pantau ringkasan Perlinsos (429 KK/DTKS), progres Posyandu &amp; balita risiko stunting, serta pendataan kepesertaan BPJS Ketenagakerjaan pekerja rentan.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                <span>2. Realisasi Pembangunan</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Tambah/evaluasi proyek fisik (jalan, drainase u-ditch, paving, LPJU) dengan komparasi foto tahap <strong>0% (Awal)</strong>, <strong>50% (Proses)</strong>, dan <strong>100% (Selesai)</strong> plus cetak rekapitulasi APBD.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>3. Kunjungan Warga &amp; Arsip</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Verifikasi data sambang warga door-to-door dari 24 Kepling (status <strong>Sudah Bansos</strong>, <strong>Belum Bansos</strong>, <strong>Menolak</strong>) &amp; kelola Arsip Pembangunan.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-indigo-500/40 text-[10.5px] leading-relaxed">
            <strong className="text-amber-300">Catatan Segregasi:</strong> Akun Kasi Pembangunan tidak menampilkan menu PBB-P2, Jadwal Posko Trantib, Kegiatan Lurah, maupun laporan di luar bidang Pembangunan/Kesos.
          </div>
        </div>
      ),
    },
    {
      title: '5. Panduan Akun Kasi Trantibum & Linmas',
      subtitle: 'Segregasi tupoksi khusus 7 Bidang Trantibum, Jadwal Posko Malam & Arsip Keamanan',
      category: 'Akun Kasi Trantibum',
      color: 'from-rose-950 via-slate-900 to-amber-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center justify-between gap-2">
            <div>
              <p className="font-black text-rose-950 text-xs">Menu Yang Dapat Diakses (4 Menu Tersekat)</p>
              <p className="text-[10.5px] text-rose-800 mt-0.5">
                Pusat Menu • Dashboard Trantibum • Jadwal Posko • Arsip Trantibum
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-mono text-[10px] font-bold shrink-0">
              kasi_trantibum
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-xl border border-rose-200">
              <p className="font-black text-rose-900 text-[11px]">Posko Trantibum</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                <strong>21.00 WIB – Selesai</strong><br />Lokasi: <strong>Kantor Lurah</strong>
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-blue-200">
              <p className="font-black text-blue-900 text-[11px]">Posko Kewaspadaan Banjir</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                <strong>21.00 WIB – Selesai</strong><br />Lokasi: <strong>Taman Segitiga Lk. 9</strong>
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
              <p className="font-black text-emerald-900 text-[11px]">Posko Bersih Sampah Malam</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                <strong>20.00 WIB – Selesai</strong><br />Lokasi: <strong>Jalan Jamin Ginting</strong>
              </p>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
            <p className="font-black text-slate-900 text-[11px] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Cara Mengelola Jadwal Posko &amp; 7 Bidang Trantibum:</span>
            </p>
            <ol className="text-[10.5px] text-slate-600 space-y-0.5 list-decimal pl-4 leading-relaxed">
              <li>Buka menu <strong>Jadwal Posko</strong> &rarr; klik <strong>Buat Jadwal Posko</strong> &rarr; pilih jenis Posko &amp; tanggal.</li>
              <li>Centang <strong>Kepling bertugas secara manual</strong> (bebas pilih nomor lingkungan) &rarr; Simpan. Kepling ditunjuk langsung menerima <strong>Notifikasi Khusus</strong> di akunnya.</li>
              <li>Setelah posko selesai, klik <strong>Cetak PDF Daftar Hadir Posko</strong> resmi. Pantau juga <em>Dashboard Trantibum</em> (7 Bidang: Poskamling, Infra Publik, Mediasi, Posko, Bersemi, Sampah Liar, Faktor 74) &amp; <em>Arsip Trantibum</em>.</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      title: '6. Panduan Akun 24 Kepling (Bagian 1): Harian, Agenda & Posko',
      subtitle: 'Tugas pelaporan harian GPS sebelum 23.30 WIB, Auto-Sync Agenda & Absen Posko Kamera Langsung',
      category: 'Akun Kepala Lingkungan (I - XXIV)',
      color: 'from-emerald-900 to-teal-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl border border-emerald-200 space-y-1">
              <p className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>1. Input Laporan Harian</span>
              </p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Buka <strong>Input Laporan</strong> &rarr; pilih Bidang Tugas &rarr; unggah s/d 8 foto &rarr; tekan <strong>Deteksi Lokasi GPS</strong> untuk isi jalan otomatis &rarr; isi uraian &rarr; Kirim sebelum <strong>23.30 WIB</strong>.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-teal-200 space-y-1">
              <p className="font-black text-teal-950 text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                <span>2. Agenda Kelurahan</span>
              </p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Lihat jadwal apel/rapat/gotong royong resmi. Ketika Lurah atau Seklur mencatat Anda <strong>Hadir</strong>, sistem <strong>otomatis menginput ke Laporan Harian &amp; Capaian Kinerja</strong> Anda.
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-rose-200 space-y-1">
              <p className="font-black text-rose-950 text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>3. Absensi Jadwal Posko</span>
              </p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Anda <strong>hanya melihat jadwal akun sendiri</strong>. Terima notifikasi tugas &rarr; buka <strong>Jadwal Posko</strong> &rarr; klik Hadir &rarr; ambil <strong>Foto Kamera Langsung</strong> (anti-galeri) + jam HP otomatis!
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-emerald-500/40 space-y-1 text-[10.5px]">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Ketentuan Penting Absensi Posko Anti-Manipulasi:</span>
            </p>
            <p className="text-slate-200 leading-relaxed">
              • Unggah dari galeri dinonaktifkan — foto wajib diambil langsung dari kamera saat piket dan otomatis diberi watermark tanggal, jam HP, &amp; nama Posko.<br />
              • Kehadiran Posko (baik absen mandiri maupun verifikasi Lurah/Super Admin) otomatis tercatat sebagai <strong>Laporan Harian Kepling</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '7. Panduan Akun 24 Kepling (Bagian 2): Warga, PBB & Sarpras',
      subtitle: 'Penggunaan Kunjungan Warga (termasuk Edit & Menolak), Realisasi PBB, Pembangunan & Capaian',
      category: 'Akun Kepala Lingkungan (I - XXIV)',
      color: 'from-teal-900 via-emerald-950 to-slate-900',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1.5">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>4. Kunjungan Warga Door-to-Door</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Catat nama KK, alamat GPS, foto, dan status Perlinsos: <strong>SUDAH BANSOS</strong> (DTKS/PKH/BPNT), <strong>BELUM BANSOS</strong> (layak usul), atau <strong>MENOLAK BANSOS</strong> (menolak sadar).
              </p>
              <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1 font-semibold">
                <Edit3 className="w-3 h-3 shrink-0" />
                <span>Salah ketik? Klik tombol <strong>Edit (Kuning)</strong> pada kartu untuk koreksi tanpa hapus ulang.</span>
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1.5">
              <p className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                <span>5. Realisasi Pajak PBB-P2 Lingkungan</span>
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Buka <strong>Realisasi PBB</strong> &rarr; cari NOP atau Nama Wajib Pajak &rarr; klik tanda <strong>Lunas</strong> saat warga membayar. Jika objek pajak salah masuk lingkungan, gunakan fitur <strong>Pindah NOP</strong>.
              </p>
              <p className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 font-semibold">
                Progres nominal &amp; persentase lingkungan Anda langsung terhubung ke dashboard Pimpinan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-[10.5px]">
              <strong className="text-emerald-950">6. Realisasi Pembangunan:</strong> Pantau &amp; unggah foto progres proyek fisik di lingkungan Anda pada tahap <strong>0%</strong>, <strong>50%</strong>, hingga <strong>100%</strong> selesai.
            </div>
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[10.5px]">
              <strong className="text-amber-950">7. Capaian Target &amp; Arsip Riwayat:</strong> Cek poin kinerja bulanan (termasuk auto-sync Agenda &amp; Posko) dan cetak PDF/WA laporan Anda di <em>Arsip Riwayat</em>.
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '8. Panduan Akun Petugas Bapenda & Tim Penggerak PKK',
      subtitle: 'Pengawasan pajak daerah (Read-Only) & Portal mandiri 10 Program Pokok TP-PKK',
      category: 'Akun Bapenda & TP-PKK',
      color: 'from-rose-950 via-slate-900 to-indigo-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 space-y-1">
            <p className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>Akun Petugas Bapenda Kota Medan (petugas_bapenda) — Mode Lihat Saja</span>
            </p>
            <p className="text-[10.5px] text-slate-700 leading-relaxed">
              Hanya membuka <strong>Pusat Menu</strong> &amp; <strong>Realisasi PBB</strong>. Petugas dapat memantau realisasi SPPT Lunas, piutang PBB per Lingkungan I–XXIV, tahun pajak 2024–2026, serta mengunduh rekap Excel tanpa risiko mengubah data operasional kelurahan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <p className="font-bold text-rose-950 text-[11px] flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Kegiatan PKK</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Input laporan kegiatan berfoto &amp; GPS untuk Pokja I–IV serta PKK Lingkungan.
              </p>
            </div>

            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-200">
              <p className="font-bold text-teal-950 text-[11px] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Dasa Wisma &amp; Posyandu</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Rekap ibu hamil, balita, lansia, jamban sehat 24 Lingk. &amp; laporan Posyandu (Pokja IV).
              </p>
            </div>

            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <p className="font-bold text-emerald-950 text-[11px] flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Keuangan BKU</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Catat kas masuk/keluar, hitung saldo otomatis, &amp; cetak Buku Kas Umum resmi.
              </p>
            </div>

            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200">
              <p className="font-bold text-purple-950 text-[11px] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>6 Buku Wajib &amp; KTA</span>
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Buku Pengurus, Anggota, Agenda Surat, Notulen, Kas, Inventaris, &amp; Cetak KTA PKK.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-rose-500/40 text-[10.5px]">
            🌸 <strong className="text-rose-300">Portal Mandiri PKK:</strong> Akun PKK otomatis masuk ke mode Portal PKK bebas menu aparatur kelurahan; Super Admin dapat berpindah mode lewat tombol <strong>"PKK"</strong> di header atas.
          </div>
        </div>
      ),
    },
    {
      title: '9. Cetak PDF Resmi A4, Ekspor Excel & WhatsApp Share',
      subtitle: 'Standar cetak Kop Surat Pemko Medan, Absensi 1 Lembar A4, Daftar Hadir Posko & Laporan',
      category: 'Cetak & Pelaporan Resmi',
      color: 'from-indigo-950 via-slate-900 to-emerald-950',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 text-xs">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Cetak PDF Presisi Standar Dinas</span>
            </p>
            <ul className="text-[10.5px] text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
              <li><strong>Absensi Kepling (1 Lembar A4):</strong> Tabel 24 Kepling tersusun padat &amp; pas tepat 1 halaman A4 lengkap Kop Pemko Medan &amp; tanda tangan Lurah/Seklur.</li>
              <li><strong>Daftar Hadir Posko Malam:</strong> Mencantumkan nama Posko, jam hadir otomatis HP, bukti foto kamera ber-watermark, &amp; status verifikasi.</li>
              <li><strong>Laporan Harian &amp; KTA PKK:</strong> Tata letak foto 2 kolom rapi &amp; Kartu Tanda Anggota PKK presisi.</li>
            </ul>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
            <p className="font-black text-slate-900 text-xs flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Ekspor Excel (.xlsx) &amp; Salin WA Pimpinan</span>
            </p>
            <ul className="text-[10.5px] text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
              <li><strong>Rekap Excel 1-Klik:</strong> Tersedia di menu Monitoring, Realisasi PBB, Absensi Kepling, Kunjungan Warga, &amp; Pembangunan.</li>
              <li><strong>Salin Rekap WhatsApp:</strong> Gunakan tombol <em>Salin Rekap WA</em> pada Arsip/Laporan untuk mengirim teks terformat ke grup Pimpinan.</li>
              <li><strong>Notifikasi Tugas Real-Time:</strong> Alert suara &amp; banner khusus muncul otomatis saat Kepling ditunjuk pada Agenda atau Jadwal Posko.</li>
            </ul>
          </div>

          <div className="sm:col-span-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 text-[10.5px] text-emerald-950">
            <Share2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Tips Cetak Rapi:</strong> Gunakan tombol <em>Unduh PDF</em> bawaan aplikasi agar ukuran margin A4, kop surat, dan tabel 24 Kepling langsung tercetak 1 halaman utuh tanpa terpotong.
            </span>
          </div>
        </div>
      ),
    },
    {
      title: '10. SOP Harian Terpadu, Mode Offline & Penutup',
      subtitle: 'Alur operasional pagi hingga malam hari & komitmen pelayanan Kelurahan Mangga',
      category: 'SOP Operasional & Penutup',
      color: 'from-emerald-900 via-teal-950 to-slate-950',
      content: (
        <div className="space-y-2.5 py-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
              <p className="font-black text-emerald-950 text-xs">🌅 PAGI – SIANG (08.00–16.00)</p>
              <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                Agenda Kelurahan &amp; pengisian Absensi oleh Lurah/Seklur (auto-sync), sambang warga door-to-door, update SPPT PBB, &amp; dokumentasi pembangunan.
              </p>
            </div>

            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
              <p className="font-black text-amber-950 text-xs">🌙 PIKET POSKO (20.00 / 21.00)</p>
              <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                <strong>20.00:</strong> Posko Bersih Sampah (Jl. Jamin Ginting).<br />
                <strong>21.00:</strong> Posko Trantibum (Kantor Lurah) &amp; Posko Banjir (Taman Segitiga Lk. 9). Foto kamera langsung!
              </p>
            </div>

            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200">
              <p className="font-black text-indigo-950 text-xs">🕛 BATAS HARIAN (s/d 23.30)</p>
              <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                Pastikan seluruh Laporan Harian terunggah sebelum 23.30 WIB. Data tetap tersimpan aman di memori HP (IndexedDB) saat sinyal lemah &amp; tersinkron otomatis.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-2xl border border-emerald-500/40 space-y-1.5 text-[11px]">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Ringkasan Dukungan &amp; Penggunaan:</span>
            </p>
            <p className="text-slate-300 text-[10.5px] leading-relaxed">
              • Unduh file PowerPoint (<strong>.pptx</strong>) resmi kapan saja melalui tombol di bawah untuk bahan rapat, sosialisasi Kepling, maupun bimbingan teknis TP-PKK.<br />
              • Hubungi <strong>Super Admin (Lurah)</strong> atau <strong>Sekretaris Kelurahan</strong> apabila memerlukan reset kata sandi akun atau penyesuaian jadwal posko/agenda.
            </p>
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
              <span className="font-bold text-emerald-300 italic">
                "Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"
              </span>
              <div className="flex gap-1.5">
                <span className="bg-emerald-800 text-white px-2 py-0.5 rounded text-[9px] font-bold">#SIKEPLINGMANGGA</span>
                <span className="bg-teal-800 text-white px-2 py-0.5 rounded text-[9px] font-bold">#KELURAHANMANGGA</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleDownloadPPT = async () => {
    try {
      setDownloadError(null);
      setIsGenerating(true);

      const bannerBase64 = await getImageBase64(BANNER_IMAGE_PATH);

      const pptx = new pptxgen();
      pptx.author = 'Kelurahan Mangga, Kota Medan';
      pptx.company = 'Pemerintah Kota Medan';
      pptx.title = `Panduan Penggunaan SI-MANGGA ${CURRENT_APP_VERSION}`;
      pptx.subject = 'Panduan Lengkap Penggunaan Aplikasi Bagi Seluruh Jenis Akun SI-MANGGA';

      pptx.defineLayout({ name: 'WIDESCREEN', width: 13.33, height: 7.5 });
      pptx.layout = 'WIDESCREEN';

      const addStandardSlideHeader = (
        slide: pptxgen.Slide,
        slideNumber: string,
        title: string,
        subtitle: string,
        category: string
      ) => {
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.12, fill: { color: '0F172A' } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.12, w: 13.33, h: 0.05, fill: { color: '10B981' } });

        slide.addText(category.toUpperCase(), {
          x: 0.7,
          y: 0.14,
          w: 9.5,
          h: 0.24,
          fontSize: 9.5,
          bold: true,
          color: '34D399',
          charSpacing: 1.5,
        });

        slide.addText(title, {
          x: 0.7,
          y: 0.38,
          w: 10.6,
          h: 0.38,
          fontSize: 19,
          bold: true,
          color: 'FFFFFF',
        });

        slide.addText(subtitle, {
          x: 0.7,
          y: 0.77,
          w: 10.6,
          h: 0.25,
          fontSize: 10.5,
          color: '94A3B8',
        });

        slide.addText(slideNumber, {
          x: 11.4,
          y: 0.26,
          w: 1.25,
          h: 0.6,
          fontSize: 26,
          bold: true,
          color: '334155',
          align: 'right',
        });

        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.75, w: 13.33, h: 0.75, fill: { color: '022C22' } });

        if (bannerBase64) {
          slide.addImage({ data: bannerBase64, x: 4.66, y: 6.82, w: 4.0, h: 0.6 });
        } else {
          slide.addText('MEDAN UNTUK SEMUA', {
            x: 4.66,
            y: 6.95,
            w: 4.0,
            h: 0.35,
            fontSize: 12,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
          });
        }

        slide.addText('SI-MANGGA • KELURAHAN MANGGA', {
          x: 0.7,
          y: 6.95,
          w: 3.6,
          h: 0.35,
          fontSize: 9,
          bold: true,
          color: '6EE7B7',
        });
        slide.addText('#SIKEPLINGMANGGA  #KELURAHANMANGGA', {
          x: 9.0,
          y: 6.95,
          w: 3.6,
          h: 0.35,
          fontSize: 9,
          bold: true,
          color: '34D399',
          align: 'right',
        });
      };

      // ==========================================
      // SLIDE 1: Cover Resmi
      // ==========================================
      const s1 = pptx.addSlide();
      s1.background = { color: '064E3B' };
      s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: '10B981' } });

      s1.addText('PEMERINTAH KOTA MEDAN • KECAMATAN MEDAN TUNTUNGAN', {
        x: 0.8,
        y: 0.65,
        w: 11.73,
        h: 0.4,
        fontSize: 13,
        bold: true,
        color: '6EE7B7',
        align: 'center',
        charSpacing: 2,
      });

      s1.addText('KELURAHAN MANGGA', {
        x: 0.8,
        y: 1.15,
        w: 11.73,
        h: 0.55,
        fontSize: 23,
        bold: true,
        color: 'ECFDF5',
        align: 'center',
        charSpacing: 4,
      });

      s1.addText('SI-MANGGA', {
        x: 0.8,
        y: 1.85,
        w: 11.73,
        h: 0.9,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      });

      s1.addText(`Sistem Informasi & Administrasi Kelurahan Mangga (${CURRENT_APP_VERSION})`, {
        x: 0.8,
        y: 2.8,
        w: 11.73,
        h: 0.5,
        fontSize: 16,
        color: 'A7F3D0',
        align: 'center',
      });

      s1.addShape(pptx.ShapeType.roundRect, {
        x: 1.6,
        y: 3.55,
        w: 10.13,
        h: 1.9,
        fill: { color: '022C22' },
        line: { color: '10B981', width: 1.5 },
        rectRadius: 0.18,
      });

      s1.addText(
        [
          {
            text: 'PANDUAN OPERASIONAL LENGKAP UNTUK SETIAP JENIS AKUN\n',
            options: { fontSize: 13, bold: true, color: 'FCD34D' },
          },
          {
            text: 'Super Admin (Lurah) • Sekretaris Kelurahan • Kasi Tata Pemerintahan • Kasi Pembangunan & Kesos\n',
            options: { fontSize: 11, color: 'FFFFFF' },
          },
          {
            text: 'Kasi Trantibum & Linmas • 24 Kepala Lingkungan • Petugas Bapenda • Tim Penggerak PKK\n\n',
            options: { fontSize: 11, color: 'FFFFFF' },
          },
          {
            text: `Pembaruan Resmi: ${CURRENT_RELEASE_DATE} • Segregasi Tupoksi, Jadwal Posko Malam & Auto-Sync`,
            options: { fontSize: 10, italic: true, color: '94A3B8' },
          },
        ],
        { x: 1.8, y: 3.7, w: 9.73, h: 1.6, align: 'center', lineSpacing: 16 }
      );

      if (bannerBase64) {
        s1.addImage({ data: bannerBase64, x: 4.66, y: 5.75, w: 4.0, h: 0.65 });
      }

      s1.addText('#SIKEPLINGMANGGA  •  #KELURAHANMANGGA', {
        x: 0.8,
        y: 6.6,
        w: 11.73,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: '34D399',
        align: 'center',
        charSpacing: 2,
      });

      // ==========================================
      // SLIDE 2: Peta Segregasi Akun & Login
      // ==========================================
      const s2 = pptx.addSlide();
      addStandardSlideHeader(
        s2,
        '02',
        '1. Peta Segregasi Akun, Format Login & Keamanan Sandi',
        'Setiap peran hanya mengakses menu sesuai tupoksi resmi Kelurahan Mangga',
        'Struktur Akun & Autentikasi'
      );

      const roleCards = [
        {
          x: 0.7,
          y: 1.38,
          fill: 'ECFDF5',
          line: '10B981',
          titleColor: '065F46',
          title: 'SUPER ADMIN (LURAH)',
          body: 'ID: super_admin\nAkses penuh seluruh menu Kelurahan & PKK + menu eksklusif Kegiatan Lurah + Verifikasi Posko.',
        },
        {
          x: 3.75,
          y: 1.38,
          fill: 'F0F9FF',
          line: '0284C7',
          titleColor: '075985',
          title: 'SEKRETARIS LURAH',
          body: 'ID: sekretaris\nKoordinasi Monitoring, Agenda, Posko, Absensi A4, Surat, PBB, Pembangunan (tanpa Kegiatan Lurah).',
        },
        {
          x: 6.8,
          y: 1.38,
          fill: 'F0FDFA',
          line: '14B8A6',
          titleColor: '115E59',
          title: '3 KASI (TERSEKAT KETAT)',
          body: 'ID: kasi_pemerintahan, kasi_pembangunan, kasi_trantibum.\nMenu tersekat ketat sesuai tupoksi.',
        },
        {
          x: 9.85,
          y: 1.38,
          fill: 'FFFBEB',
          line: 'F59E0B',
          titleColor: '92400E',
          title: '24 KEPLING (I - XXIV)',
          body: 'ID: kepling_1 s/d kepling_24\nSandi awal: mangga01 – mangga24.\nLaporan, Agenda, Posko, Warga, PBB.',
        },
      ];

      roleCards.forEach((c) => {
        s2.addShape(pptx.ShapeType.roundRect, {
          x: c.x,
          y: c.y,
          w: 2.8,
          h: 2.3,
          fill: { color: c.fill },
          line: { color: c.line, width: 1.2 },
          rectRadius: 0.12,
        });
        s2.addText(c.title, {
          x: c.x + 0.14,
          y: c.y + 0.15,
          w: 2.52,
          h: 0.35,
          fontSize: 10.5,
          bold: true,
          color: c.titleColor,
        });
        s2.addText(c.body, {
          x: c.x + 0.14,
          y: c.y + 0.55,
          w: 2.52,
          h: 1.6,
          fontSize: 9.5,
          color: '1E293B',
          lineSpacing: 14,
        });
      });

      s2.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 3.85,
        w: 5.85,
        h: 1.45,
        fill: { color: 'EEF2FF' },
        line: { color: '6366F1', width: 1.2 },
        rectRadius: 0.12,
      });
      s2.addText('PETUGAS BAPENDA KOTA MEDAN (READ-ONLY)', {
        x: 0.88,
        y: 3.98,
        w: 5.5,
        h: 0.3,
        fontSize: 10.5,
        bold: true,
        color: '3730A3',
      });
      s2.addText(
        'ID: petugas_bapenda • Hanya mengakses Pusat Menu & Realisasi PBB-P2 secara Lihat Saja (tanpa ubah data operasional kelurahan) untuk monitoring dan unduh rekap pajak.',
        { x: 0.88, y: 4.32, w: 5.5, h: 0.85, fontSize: 9.5, color: '1E293B', lineSpacing: 14 }
      );

      s2.addShape(pptx.ShapeType.roundRect, {
        x: 6.8,
        y: 3.85,
        w: 5.85,
        h: 1.45,
        fill: { color: 'FFF1F2' },
        line: { color: 'F43F5E', width: 1.2 },
        rectRadius: 0.12,
      });
      s2.addText('TIM PENGGERAK PKK (PORTAL MANDIRI)', {
        x: 6.98,
        y: 3.98,
        w: 5.5,
        h: 0.3,
        fontSize: 10.5,
        bold: true,
        color: '9F1239',
      });
      s2.addText(
        'ID: ketua_pkk, sekretaris_pkk, pokja_1..4, pkk_lingkungan_1..24 (sandi awal pkkmangga01–24). Portal khusus Pokja I-IV, Dasa Wisma 24 Lingk., Posyandu, BKU & 6 Buku Wajib.',
        { x: 6.98, y: 4.32, w: 5.5, h: 0.85, fontSize: 9.5, color: '1E293B', lineSpacing: 14 }
      );

      s2.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.45,
        w: 11.95,
        h: 1.1,
        fill: { color: '0F172A' },
        line: { color: '334155', width: 1 },
        rectRadius: 0.12,
      });
      s2.addText(
        [
          { text: 'CARA LOGIN & UBAH SANDI: ', options: { bold: true, color: 'FCD34D', fontSize: 11 } },
          {
            text: '1) Pilih nama akun pada layar Login -> masukkan kata sandi (hubungi Super Admin/Seklur untuk kredensial struktural). 2) Setelah masuk, klik nama profil di pojok kanan atas -> pilih "Ubah Kata Sandi" untuk mengamankan akun Anda.',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.58, w: 11.55, h: 0.85, lineSpacing: 15 }
      );

      // ==========================================
      // SLIDE 3: Super Admin (Lurah) & Sekretaris
      // ==========================================
      const s3 = pptx.addSlide();
      addStandardSlideHeader(
        s3,
        '03',
        '2. Panduan Akun Super Admin (Lurah) & Sekretaris Lurah',
        'Pengawasan 24 Kepling, Kegiatan Lurah eksklusif, Absensi Agenda A4 & Verifikasi Posko',
        'Akun Pimpinan Kelurahan'
      );

      s3.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.4,
        w: 5.8,
        h: 3.7,
        fill: { color: 'ECFDF5' },
        line: { color: '10B981', width: 1.4 },
        rectRadius: 0.14,
      });
      s3.addText('SUPER ADMIN / LURAH (AKSES PENUH + EKSKLUSIF)', {
        x: 0.9,
        y: 1.58,
        w: 5.4,
        h: 0.35,
        fontSize: 11.5,
        bold: true,
        color: '065F46',
      });
      s3.addText(
        [
          { text: '• Menu Eksklusif Kegiatan Lurah:\n', options: { bold: true, color: '047857' } },
          { text: 'Hanya terlihat & dapat dikelola oleh Super Admin untuk mendokumentasikan agenda resmi Lurah beserta foto lapangan.\n\n' },
          { text: '• Verifikasi Kehadiran Jadwal Posko:\n', options: { bold: true, color: '047857' } },
          { text: 'Lurah dapat memverifikasi hadir Kepling di menu Jadwal Posko jika Kepling bertugas hadir namun lupa absen HP (otomatis masuk Laporan Harian).\n\n' },
          { text: '• Kendali Penuh Kelurahan & PKK:\n', options: { bold: true, color: '047857' } },
          { text: 'Akses Monitoring 24 Lingkungan, Capaian Target, Realisasi PBB, Pembangunan, Surat Kedinasan, & Portal TP-PKK.' },
        ],
        { x: 0.9, y: 2.0, w: 5.4, h: 2.95, fontSize: 10, color: '1E293B', lineSpacing: 14 }
      );

      s3.addShape(pptx.ShapeType.roundRect, {
        x: 6.83,
        y: 1.4,
        w: 5.8,
        h: 3.7,
        fill: { color: 'F0F9FF' },
        line: { color: '0284C7', width: 1.4 },
        rectRadius: 0.14,
      });
      s3.addText('SEKRETARIS KELURAHAN / SEKLUR (KOORDINASI)', {
        x: 7.03,
        y: 1.58,
        w: 5.4,
        h: 0.35,
        fontSize: 11.5,
        bold: true,
        color: '075985',
      });
      s3.addText(
        [
          { text: '• Menu Koordinasi Administrasi Lengkap:\n', options: { bold: true, color: '0369A1' } },
          { text: 'Monitoring Laporan, Realisasi Pembangunan, Agenda Kelurahan, Jadwal Posko, Absensi Kepling, Capaian Target, PBB, Surat Kedinasan, Kunjungan Warga, & Arsip.\n\n' },
          { text: '• Pembatasan Khusus:\n', options: { bold: true, color: '0369A1' } },
          { text: 'Tidak menampilkan menu Kegiatan Lurah (khusus Super Admin) maupun Formulir Input Laporan Kepling.\n\n' },
          { text: '• Tata Naskah Surat Kedinasan:\n', options: { bold: true, color: '0369A1' } },
          { text: 'Kelola penomoran surat, disposisi kegiatan, serta validasi rekap administrasi kelurahan.' },
        ],
        { x: 7.03, y: 2.0, w: 5.4, h: 2.95, fontSize: 10, color: '1E293B', lineSpacing: 14 }
      );

      s3.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.25,
        w: 11.93,
        h: 1.3,
        fill: { color: '0F172A' },
        line: { color: '10B981', width: 1 },
        rectRadius: 0.12,
      });
      s3.addText(
        [
          { text: 'AGENDA KELURAHAN & ABSENSI KEPLING (AUTO-SYNC + PDF 1 LEMBAR A4): ', options: { bold: true, color: '34D399', fontSize: 10.5 } },
          {
            text: 'Buat agenda di menu "Agenda Kelurahan" -> buka "Absensi Kepling" -> isi status Hadir/Izin/Sakit/Alpha. Setiap Kepling yang ditandai HADIR otomatis tercetak ke Laporan Harian & Capaian Kinerja Kepling. Klik "Unduh PDF" untuk mencetak tabel 24 Lingkungan tepat dalam 1 halaman A4 resmi.',
            options: { color: 'E2E8F0', fontSize: 10 },
          },
        ],
        { x: 0.9, y: 5.38, w: 11.53, h: 1.05, lineSpacing: 15 }
      );

      // ==========================================
      // SLIDE 4: Kasi Tata Pemerintahan
      // ==========================================
      const s4 = pptx.addSlide();
      addStandardSlideHeader(
        s4,
        '04',
        '3. Panduan Akun Kasi Tata Pemerintahan',
        'Segregasi tupoksi khusus Dashboard Pemerintahan, Realisasi PBB-P2, IKD & Arsip Pemerintahan',
        'Akun Kasi Tata Pemerintahan'
      );

      s4.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.38,
        w: 11.93,
        h: 0.75,
        fill: { color: 'EFF6FF' },
        line: { color: '3B82F6', width: 1.2 },
        rectRadius: 0.12,
      });
      s4.addText(
        'MENU AKTIF KASI TATA PEMERINTAHAN (4 MENU TERSEKAT):  Pusat Menu  •  Dashboard Pemerintahan  •  Realisasi PBB  •  Arsip Pemerintahan',
        { x: 0.9, y: 1.55, w: 11.53, h: 0.4, fontSize: 11, bold: true, color: '1E3A8A' }
      );

      const pemCards = [
        {
          x: 0.7,
          title: '1. DASHBOARD PEMERINTAHAN',
          color: '1D4ED8',
          fill: 'F8FAFC',
          text: '• Leaderboard Opsir PBB:\nPantau peringkat capaian pajak 24 Lingkungan secara real-time.\n\n• Kependudukan & IKD:\nMonitoring progres aktivasi Identitas Kependudukan Digital (IKD) & tertib administrasi wilayah.',
        },
        {
          x: 4.78,
          title: '2. REALISASI PBB-P2',
          color: '047857',
          fill: 'ECFDF5',
          text: '• Filter Tahun & Lingkungan:\nCek target vs realisasi per Lingkungan I–XXIV (tahun pajak 2024–2026).\n\n• Pindah NOP & Ekspor:\nVerifikasi perpindahan NOP antar lingkungan dan unduh buku rekap Excel PBB.',
        },
        {
          x: 8.86,
          title: '3. ARSIP PEMERINTAHAN',
          color: '4338CA',
          fill: 'EEF2FF',
          text: '• Arsip Laporan Bidang:\nAkses laporan Kepling terkait pelayanan surat pengantar, kependudukan, & pertanahan.\n\n• Cetak PDF / Rekap:\nUnduh dokumentasi kegiatan bidang Tata Pemerintahan.',
        },
      ];

      pemCards.forEach((card) => {
        s4.addShape(pptx.ShapeType.roundRect, {
          x: card.x,
          y: 2.3,
          w: 3.77,
          h: 3.1,
          fill: { color: card.fill },
          line: { color: 'CBD5E1', width: 1.2 },
          rectRadius: 0.12,
        });
        s4.addText(card.title, {
          x: card.x + 0.18,
          y: 2.48,
          w: 3.4,
          h: 0.35,
          fontSize: 11,
          bold: true,
          color: card.color,
        });
        s4.addText(card.text, {
          x: card.x + 0.18,
          y: 2.9,
          w: 3.4,
          h: 2.35,
          fontSize: 10,
          color: '1E293B',
          lineSpacing: 14.5,
        });
      });

      s4.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.55,
        w: 11.93,
        h: 0.98,
        fill: { color: '0F172A' },
        line: { color: '3B82F6', width: 1 },
        rectRadius: 0.12,
      });
      s4.addText(
        [
          { text: 'BATASAN HAK AKSES (SEGREGASI TUPOKSI): ', options: { bold: true, color: 'FCD34D', fontSize: 10.5 } },
          {
            text: 'Akun Kasi Tata Pemerintahan (kasi_pemerintahan) tidak dapat membuka menu Jadwal Posko Trantibum, Realisasi Pembangunan fisik, Kunjungan Warga Bansos, maupun Kegiatan Lurah.',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.68, w: 11.53, h: 0.75, lineSpacing: 14 }
      );

      // ==========================================
      // SLIDE 5: Kasi Pembangunan & Kesos
      // ==========================================
      const s5 = pptx.addSlide();
      addStandardSlideHeader(
        s5,
        '05',
        '4. Panduan Akun Kasi Pembangunan & Kesos',
        'Segregasi tupoksi khusus Perlinsos, Pembangunan Fisik 0%-50%-100%, & Kunjungan Warga',
        'Akun Kasi Pembangunan & Kesos'
      );

      s5.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.38,
        w: 11.93,
        h: 0.75,
        fill: { color: 'EEF2FF' },
        line: { color: '6366F1', width: 1.2 },
        rectRadius: 0.12,
      });
      s5.addText(
        'MENU AKTIF (5 MENU TERSEKAT):  Pusat Menu  •  Dashboard Kesos  •  Realisasi Pembangunan  •  Kunjungan Warga  •  Arsip Pembangunan',
        { x: 0.9, y: 1.55, w: 11.53, h: 0.4, fontSize: 11, bold: true, color: '312E81' }
      );

      const bangCards = [
        {
          x: 0.7,
          title: '1. DASHBOARD KESOS & PERLINSOS',
          color: 'BE123C',
          fill: 'FFF1F2',
          text: '• Data Perlinsos & DTKS:\nPantau verifikasi 429 KK penerima bantuan sosial.\n\n• Posyandu, Stunting & BPJS TK:\nRekap pemantauan gizi balita & kepesertaan BPJS Ketenagakerjaan pekerja rentan.',
        },
        {
          x: 4.78,
          title: '2. REALISASI PEMBANGUNAN',
          color: 'B45309',
          fill: 'FFFBEB',
          text: '• Komparasi Fisik 0% - 50% - 100%:\nKelola proyek jalan, drainase u-ditch, paving block, & LPJU beserta foto progres.\n\n• Rekap Anggaran APBD:\nFilter per tahun/lingkungan dan cetak laporan komparasi pembangunan.',
        },
        {
          x: 8.86,
          title: '3. KUNJUNGAN WARGA & ARSIP',
          color: '047857',
          fill: 'ECFDF5',
          text: '• Evaluasi Door-to-Door:\nTinjau hasil kunjungan Kepling (Sudah Bansos, Belum Bansos, Menolak Bansos).\n\n• Arsip Pembangunan:\nCek laporan kerja Kepling khusus bidang Fisik, Drainase, & Sosial.',
        },
      ];

      bangCards.forEach((card) => {
        s5.addShape(pptx.ShapeType.roundRect, {
          x: card.x,
          y: 2.3,
          w: 3.77,
          h: 3.1,
          fill: { color: card.fill },
          line: { color: 'CBD5E1', width: 1.2 },
          rectRadius: 0.12,
        });
        s5.addText(card.title, {
          x: card.x + 0.18,
          y: 2.48,
          w: 3.4,
          h: 0.35,
          fontSize: 11,
          bold: true,
          color: card.color,
        });
        s5.addText(card.text, {
          x: card.x + 0.18,
          y: 2.9,
          w: 3.4,
          h: 2.35,
          fontSize: 10,
          color: '1E293B',
          lineSpacing: 14.5,
        });
      });

      s5.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.55,
        w: 11.93,
        h: 0.98,
        fill: { color: '0F172A' },
        line: { color: '6366F1', width: 1 },
        rectRadius: 0.12,
      });
      s5.addText(
        [
          { text: 'BATASAN HAK AKSES (SEGREGASI TUPOKSI): ', options: { bold: true, color: 'FCD34D', fontSize: 10.5 } },
          {
            text: 'Akun Kasi Pembangunan (kasi_pembangunan) difokuskan pada Perlinsos & Sarpras; menu Realisasi PBB, Jadwal Posko Trantibum, Kegiatan Lurah, & Monitoring umum dinonaktifkan.',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.68, w: 11.53, h: 0.75, lineSpacing: 14 }
      );

      // ==========================================
      // SLIDE 6: Kasi Trantibum & Jadwal Posko
      // ==========================================
      const s6 = pptx.addSlide();
      addStandardSlideHeader(
        s6,
        '06',
        '5. Panduan Akun Kasi Trantibum & Linmas',
        'Segregasi tupoksi khusus 7 Bidang Trantibum, Jadwal Posko Malam & Arsip Trantibum',
        'Akun Kasi Trantibum'
      );

      s6.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.35,
        w: 11.93,
        h: 0.65,
        fill: { color: 'FFF1F2' },
        line: { color: 'F43F5E', width: 1.2 },
        rectRadius: 0.12,
      });
      s6.addText(
        'MENU AKTIF (4 MENU TERSEKAT):  Pusat Menu  •  Dashboard Trantibum (7 Bidang)  •  Jadwal Posko Malam  •  Arsip Trantibum',
        { x: 0.9, y: 1.48, w: 11.53, h: 0.38, fontSize: 11, bold: true, color: '9F1239' }
      );

      const poskoCards = [
        {
          x: 0.7,
          fill: 'FFF1F2',
          line: 'E11D48',
          title: 'POSKO TRANTIBUM',
          jam: 'Mulai Pukul 21.00 WIB s/d Selesai',
          lokasi: 'Lokasi: Kantor Lurah',
          ket: 'Apel malam, patroli siskamling, cegah kerumunan remaja/balap liar.',
        },
        {
          x: 4.78,
          fill: 'EFF6FF',
          line: '2563EB',
          title: 'POSKO KEWASPADAAN BANJIR',
          jam: 'Mulai Pukul 21.00 WIB s/d Selesai',
          lokasi: 'Lokasi: Taman Segitiga Lk. 9',
          ket: 'Pantau debit drainase, gorong-gorong, & kesiapsiagaan evakuasi.',
        },
        {
          x: 8.86,
          fill: 'ECFDF5',
          line: '059669',
          title: 'POSKO BERSIH SAMPAH MALAM',
          jam: 'Mulai Pukul 20.00 WIB s/d Selesai',
          lokasi: 'Lokasi: Jalan Jamin Ginting',
          ket: 'Pengawasan kebersihan & penertiban pembuangan sampah liar malam hari.',
        },
      ];

      poskoCards.forEach((p) => {
        s6.addShape(pptx.ShapeType.roundRect, {
          x: p.x,
          y: 2.15,
          w: 3.77,
          h: 2.15,
          fill: { color: p.fill },
          line: { color: p.line, width: 1.3 },
          rectRadius: 0.12,
        });
        s6.addText(p.title, { x: p.x + 0.16, y: 2.28, w: 3.45, h: 0.32, fontSize: 10.5, bold: true, color: '0F172A' });
        s6.addText(`${p.jam}\n${p.lokasi}\n\n${p.ket}`, {
          x: p.x + 0.16,
          y: 2.65,
          w: 3.45,
          h: 1.55,
          fontSize: 9.8,
          color: '334155',
          lineSpacing: 13.5,
        });
      });

      s6.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 4.45,
        w: 11.93,
        h: 2.1,
        fill: { color: '0F172A' },
        line: { color: 'F43F5E', width: 1 },
        rectRadius: 0.12,
      });
      s6.addText(
        [
          { text: 'LANGKAH PENGGUNAAN AKUN KASI TRANTIBUM:\n', options: { bold: true, color: 'FCD34D', fontSize: 11 } },
          {
            text: '1. Buat Jadwal Posko: Buka menu "Jadwal Posko" -> klik Buat Jadwal -> pilih Jenis Posko & tanggal -> centang Kepling bertugas secara MANUAL (tanpa preset shift) -> Simpan untuk mengirim notifikasi khusus ke HP Kepling ditunjuk.\n',
            options: { color: 'E2E8F0', fontSize: 10 },
          },
          {
            text: '2. Cetak Daftar Hadir Posko: Setelah posko selesai, klik "Cetak PDF Daftar Hadir Posko" lengkap dengan foto kamera langsung & jam hadir HP.\n',
            options: { color: 'E2E8F0', fontSize: 10 },
          },
          {
            text: '3. Segregasi Ketat: Menu Monitoring umum, Pembangunan, Capaian, PBB, Input Laporan, & Kunjungan Warga tidak tersedia bagi Kasi Trantibum.',
            options: { color: 'FDA4AF', fontSize: 10 },
          },
        ],
        { x: 0.9, y: 4.58, w: 11.53, h: 1.85, lineSpacing: 15 }
      );

      // ==========================================
      // SLIDE 7: 24 Kepling Bagian 1
      // ==========================================
      const s7 = pptx.addSlide();
      addStandardSlideHeader(
        s7,
        '07',
        '6. Panduan Akun 24 Kepling (Bag. 1): Laporan, Agenda & Posko',
        'Alur harian laporan GPS sebelum 23.30 WIB, Auto-Sync Agenda & Absen Posko Kamera Langsung',
        'Akun Kepala Lingkungan (I - XXIV)'
      );

      const kepCards1 = [
        {
          x: 0.7,
          fill: 'ECFDF5',
          line: '10B981',
          title: '1. INPUT LAPORAN HARIAN',
          body: '• Buka menu "Input Laporan".\n• Pilih kategori kegiatan.\n• Unggah s/d 8 foto (kompresi otomatis hemat kuota).\n• Tekan "Deteksi Lokasi GPS" agar nama jalan terisi otomatis.\n• Kirim sebelum pukul 23.30 WIB.',
        },
        {
          x: 4.78,
          fill: 'F0FDFA',
          line: '14B8A6',
          title: '2. AGENDA KELURAHAN',
          body: '• Buka menu "Agenda Kelurahan" untuk cek undangan rapat/apel/gotong royong.\n• AUTO-SYNC: Saat Lurah/Seklur menandai Anda HADIR di Absensi Agenda, laporan otomatis masuk ke Laporan Harian & Capaian Kinerja Anda!',
        },
        {
          x: 8.86,
          fill: 'FFF1F2',
          line: 'F43F5E',
          title: '3. ABSEN JADWAL POSKO',
          body: '• Kepling hanya melihat jadwal tugas akunnya sendiri + menerima notifikasi khusus.\n• Jam Kehadiran otomatis mengikuti WAKTU HP.\n• Foto Kehadiran wajib dari KAMERA LANGSUNG (anti-galeri) + watermark.\n• Otomatis masuk Laporan Harian.',
        },
      ];

      kepCards1.forEach((c) => {
        s7.addShape(pptx.ShapeType.roundRect, {
          x: c.x,
          y: 1.4,
          w: 3.77,
          h: 3.8,
          fill: { color: c.fill },
          line: { color: c.line, width: 1.3 },
          rectRadius: 0.14,
        });
        s7.addText(c.title, { x: c.x + 0.16, y: 1.58, w: 3.45, h: 0.35, fontSize: 11, bold: true, color: '0F172A' });
        s7.addText(c.body, {
          x: c.x + 0.16,
          y: 2.0,
          w: 3.45,
          h: 3.05,
          fontSize: 10,
          color: '1E293B',
          lineSpacing: 15,
        });
      });

      s7.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.35,
        w: 11.93,
        h: 1.18,
        fill: { color: '0F172A' },
        line: { color: '10B981', width: 1 },
        rectRadius: 0.12,
      });
      s7.addText(
        [
          { text: 'PENGAWASAN KETUA & ANTI-MANIPULASI: ', options: { bold: true, color: 'FCD34D', fontSize: 10.5 } },
          {
            text: 'Jika Kepling hadir piket Posko malam namun lupa melakukan absen mandiri di aplikasi, Super Admin (Lurah) dapat melakukan Verifikasi Kehadiran dari akunnya sehingga tetap tercatat sah pada Laporan Harian & PDF Daftar Hadir Posko.',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.5, w: 11.53, h: 0.9, lineSpacing: 14.5 }
      );

      // ==========================================
      // SLIDE 8: 24 Kepling Bagian 2
      // ==========================================
      const s8 = pptx.addSlide();
      addStandardSlideHeader(
        s8,
        '08',
        '7. Panduan Akun 24 Kepling (Bag. 2): Warga, PBB & Pembangunan',
        'Sambang warga door-to-door, tanda lunas SPPT PBB, dokumentasi fisik 0%-100% & Capaian',
        'Akun Kepala Lingkungan (I - XXIV)'
      );

      s8.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.4,
        w: 5.8,
        h: 3.7,
        fill: { color: 'ECFDF5' },
        line: { color: '10B981', width: 1.3 },
        rectRadius: 0.14,
      });
      s8.addText('4. KUNJUNGAN WARGA DOOR-TO-DOOR (PERLINSOS)', {
        x: 0.9,
        y: 1.58,
        w: 5.4,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: '065F46',
      });
      s8.addText(
        [
          { text: '• Catat Kunjungan: ', options: { bold: true } },
          { text: 'Masukkan nama KK, alamat GPS rumah, foto kunjungan, dan pilih status Perlinsos:\n' },
          { text: '  - SUDAH BANSOS (terdata DTKS/PKH/BPNT)\n', options: { color: '047857', bold: true } },
          { text: '  - BELUM BANSOS (usulan layak)\n', options: { color: 'B45309', bold: true } },
          { text: '  - MENOLAK BANSOS (menolak secara sadar)\n\n', options: { color: 'BE123C', bold: true } },
          { text: '• Tombol Edit (Kuning): ', options: { bold: true, color: '92400E' } },
          { text: 'Klik tombol Edit pada daftar kunjungan jika ada salah ketik nama/alamat/status tanpa perlu menghapus data.' },
        ],
        { x: 0.9, y: 2.0, w: 5.4, h: 2.95, fontSize: 10, color: '1E293B', lineSpacing: 14.5 }
      );

      s8.addShape(pptx.ShapeType.roundRect, {
        x: 6.83,
        y: 1.4,
        w: 5.8,
        h: 3.7,
        fill: { color: 'F8FAFC' },
        line: { color: '0D9488', width: 1.3 },
        rectRadius: 0.14,
      });
      s8.addText('5. REALISASI PBB-P2 & PEMBANGUNAN WILAYAH', {
        x: 7.03,
        y: 1.58,
        w: 5.4,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: '115E59',
      });
      s8.addText(
        [
          { text: '• Tandai SPPT PBB Lunas Real-Time:\n', options: { bold: true, color: '0F766E' } },
          { text: 'Buka menu Realisasi PBB -> ketik NOP atau Nama Wajib Pajak -> klik tombol Lunas saat warga membayar.\n\n' },
          { text: '• Fitur Pindah NOP Lingkungan:\n', options: { bold: true, color: '0F766E' } },
          { text: 'Pindahkan data SPPT yang alamat fisiknya berada di lingkungan lain secara tertib.\n\n' },
          { text: '• Realisasi Pembangunan (0% - 50% - 100%):\n', options: { bold: true, color: '0F766E' } },
          { text: 'Dokumentasikan proyek infrastruktur di lingkungan Anda mulai tahap awal hingga tuntas.' },
        ],
        { x: 7.03, y: 2.0, w: 5.4, h: 2.95, fontSize: 10, color: '1E293B', lineSpacing: 14.5 }
      );

      s8.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.25,
        w: 11.93,
        h: 1.25,
        fill: { color: '0F172A' },
        line: { color: '334155', width: 1 },
        rectRadius: 0.12,
      });
      s8.addText(
        [
          { text: 'CAPAIAN TARGET & ARSIP RIWAYAT KEPLING: ', options: { bold: true, color: 'FCD34D', fontSize: 10.5 } },
          {
            text: 'Pantau poin kinerja pribadi di menu "Capaian Target" (termasuk sinkronisasi otomatis Agenda & Posko), serta cetak laporan bulanan PDF atau bagikan rekap teks WhatsApp lewat menu "Arsip Riwayat".',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.42, w: 11.53, h: 0.9, lineSpacing: 15 }
      );

      // ==========================================
      // SLIDE 9: Petugas Bapenda & TP-PKK
      // ==========================================
      const s9 = pptx.addSlide();
      addStandardSlideHeader(
        s9,
        '09',
        '8. Panduan Akun Petugas Bapenda & Tim Penggerak PKK',
        'Pengawasan pajak daerah (Read-Only) serta portal mandiri 10 Program Pokok TP-PKK',
        'Akun Bapenda & TP-PKK'
      );

      s9.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.35,
        w: 11.93,
        h: 1.1,
        fill: { color: 'EEF2FF' },
        line: { color: '6366F1', width: 1.3 },
        rectRadius: 0.12,
      });
      s9.addText('AKUN PETUGAS BAPENDA KOTA MEDAN (petugas_bapenda — READ-ONLY)', {
        x: 0.9,
        y: 1.46,
        w: 11.53,
        h: 0.28,
        fontSize: 11,
        bold: true,
        color: '3730A3',
      });
      s9.addText(
        'Hanya memiliki akses Pusat Menu & Realisasi PBB. Digunakan untuk memantau target nominal, SPPT lunas vs piutang 24 Lingkungan (tahun 2024–2026), dan ekspor Excel PBB tanpa mengubah data kelurahan.',
        { x: 0.9, y: 1.78, w: 11.53, h: 0.55, fontSize: 10, color: '1E293B', lineSpacing: 14 }
      );

      const pkkCards = [
        {
          x: 0.7,
          fill: 'FFF1F2',
          line: 'F43F5E',
          title: 'KEGIATAN POKJA I - IV',
          body: '• Input foto & GPS kegiatan pembinaan moral, pendidikan/UP2K, pangan/sandang, & kesehatan.\n• Berlaku untuk akun Pokja I-IV & PKK Lingkungan.',
        },
        {
          x: 3.75,
          fill: 'F0FDFA',
          line: '14B8A6',
          title: 'DASA WISMA & POSYANDU',
          body: '• Rekap data ibu hamil, menyusui, balita, lansia, & jamban sehat 24 Lingk.\n• Laporan Posyandu khusus Pokja IV terintegrasi.',
        },
        {
          x: 6.8,
          fill: 'ECFDF5',
          line: '10B981',
          title: 'KEUANGAN PKK (BKU)',
          body: '• Pencatatan kas masuk & kas keluar dengan kalkulasi saldo otomatis.\n• Cetak Buku Kas Umum (BKU) standar pembukuan PKK.',
        },
        {
          x: 9.85,
          fill: 'F5F3FF',
          line: '8B5CF6',
          title: '6 BUKU WAJIB & KTA',
          body: '• Pengurus, Anggota, Agenda Surat, Notulen, Kas, & Inventaris.\n• Cetak Kartu Tanda Anggota (KTA) PKK format PDF presisi.',
        },
      ];

      pkkCards.forEach((c) => {
        s9.addShape(pptx.ShapeType.roundRect, {
          x: c.x,
          y: 2.65,
          w: 2.8,
          h: 2.75,
          fill: { color: c.fill },
          line: { color: c.line, width: 1.2 },
          rectRadius: 0.12,
        });
        s9.addText(c.title, { x: c.x + 0.14, y: 2.8, w: 2.52, h: 0.35, fontSize: 10.5, bold: true, color: '0F172A' });
        s9.addText(c.body, {
          x: c.x + 0.14,
          y: 3.22,
          w: 2.52,
          h: 2.05,
          fontSize: 9.5,
          color: '1E293B',
          lineSpacing: 14,
        });
      });

      s9.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 5.55,
        w: 11.93,
        h: 0.98,
        fill: { color: '0F172A' },
        line: { color: 'F43F5E', width: 1 },
        rectRadius: 0.12,
      });
      s9.addText(
        [
          { text: 'PORTAL MANDIRI TP-PKK: ', options: { bold: true, color: 'FDA4AF', fontSize: 10.5 } },
          {
            text: 'Akun Ketua/Sekretaris PKK, Ketua Pokja I–IV, dan 24 Ketua PKK Lingkungan otomatis masuk ke Portal PKK bebas menu aparatur kelurahan. Super Admin dapat berganti mode lewat tombol "PKK" di kanan atas.',
            options: { color: 'E2E8F0', fontSize: 10.5 },
          },
        ],
        { x: 0.9, y: 5.68, w: 11.53, h: 0.75, lineSpacing: 14 }
      );

      // ==========================================
      // SLIDE 10: Cetak PDF A4, Excel, SOP & Penutup
      // ==========================================
      const s10 = pptx.addSlide();
      s10.background = { color: '064E3B' };
      s10.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: '10B981' } });

      s10.addText('9 & 10. CETAK PDF RESMI A4, EKSPOR EXCEL & SOP HARIAN', {
        x: 0.7,
        y: 0.45,
        w: 11.93,
        h: 0.45,
        fontSize: 20,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      });

      s10.addText('Standar dokumen dinas Pemko Medan, mode offline IndexedDB & alur kerja aparatur', {
        x: 0.7,
        y: 0.9,
        w: 11.93,
        h: 0.3,
        fontSize: 11,
        color: 'A7F3D0',
        align: 'center',
      });

      const sopBoxes = [
        {
          x: 0.7,
          title: 'PAGI – SIANG (08.00–16.00)',
          color: '34D399',
          text: '• Agenda Kelurahan & Absensi Kepling (Auto-Sync).\n• Cetak Absensi 1 Lembar A4.\n• Sambang Warga, Update PBB & Progres Pembangunan.',
        },
        {
          x: 4.78,
          title: 'PIKET POSKO MALAM',
          color: 'FCD34D',
          text: '• 20.00 WIB: Posko Bersih Sampah (Jl. Jamin Ginting).\n• 21.00 WIB: Posko Trantibum (Kantor Lurah) & Banjir (Taman Segitiga Lk. 9).\n• Foto kamera langsung + jam HP!',
        },
        {
          x: 8.86,
          title: 'CETAK, EKSPOR & BATAS 23.30',
          color: '93C5FD',
          text: '• Laporan harian s/d 23.30 WIB.\n• Cetak PDF Kop Pemko Medan (Posko, Laporan, KTA PKK).\n• Ekspor Excel (.xlsx) & Salin WA Pimpinan. Data aman di IndexedDB.',
        },
      ];

      sopBoxes.forEach((b) => {
        s10.addShape(pptx.ShapeType.roundRect, {
          x: b.x,
          y: 1.4,
          w: 3.77,
          h: 3.15,
          fill: { color: '022C22' },
          line: { color: '10B981', width: 1.2 },
          rectRadius: 0.14,
        });
        s10.addText(b.title, {
          x: b.x + 0.18,
          y: 1.58,
          w: 3.4,
          h: 0.35,
          fontSize: 11.5,
          bold: true,
          color: b.color,
        });
        s10.addText(b.text, {
          x: b.x + 0.18,
          y: 2.02,
          w: 3.4,
          h: 2.35,
          fontSize: 10.5,
          color: 'E2E8F0',
          lineSpacing: 15,
        });
      });

      s10.addText('"Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"', {
        x: 0.8,
        y: 4.82,
        w: 11.73,
        h: 0.45,
        fontSize: 17,
        italic: true,
        bold: true,
        color: 'A7F3D0',
        align: 'center',
      });

      if (bannerBase64) {
        s10.addImage({ data: bannerBase64, x: 4.66, y: 5.5, w: 4.0, h: 0.65 });
      }

      s10.addText('#SIKEPLINGMANGGA  •  #KELURAHANMANGGA', {
        x: 0.8,
        y: 6.45,
        w: 11.73,
        h: 0.4,
        fontSize: 13,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        charSpacing: 2,
      });

      await pptx.writeFile({ fileName: `Panduan_Penggunaan_SI_MANGGA_${CURRENT_APP_VERSION}.pptx` });
    } catch (err) {
      console.error('Error generating PPTX:', err);
      setDownloadError('Gagal mengunduh berkas PPTX. Silakan coba kembali.');
    } finally {
      setIsGenerating(false);
    }
  };

  const slide = slidesData[currentSlide];

  return (
    <div className="modal-preview p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 animate-scale-up">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between text-white border-b border-emerald-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-wide text-white">
                  Slide Panduan Presentasi (PPT)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                  {CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-normal">
                Panduan Lengkap Semua Jenis Akun: Lurah, Seklur, 3 Kasi, 24 Kepling, Bapenda &amp; TP-PKK
              </p>
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

        {downloadError && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-rose-800 shrink-0">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{downloadError}</span>
            </span>
            <button
              type="button"
              onClick={() => setDownloadError(null)}
              className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer"
              aria-label="Tutup pesan kesalahan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Slide Selector Bar */}
        <div className="bg-slate-900 px-3 sm:px-5 py-2 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {slidesData.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                currentSlide === idx
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              title={s.title}
            >
              {String(idx + 1).padStart(2, '0')} • {s.category.split(' ')[0]}
              {s.category.split(' ')[1] ? ` ${s.category.split(' ')[1]}` : ''}
            </button>
          ))}
        </div>

        {/* Slide Viewer Screen */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-100 flex flex-col justify-center custom-scrollbar">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-slate-200/90 overflow-hidden flex flex-col min-h-[380px] sm:min-h-[420px]">
            {/* Top Bar of Slide */}
            <div
              className={`bg-gradient-to-r ${slide.color} px-5 sm:px-6 py-3.5 sm:py-4 text-white flex justify-between items-center relative overflow-hidden shrink-0`}
            >
              <div className="relative z-10 pr-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-400/40 inline-block mb-1 font-mono">
                  {slide.category}
                </span>
                <h2 className="text-base sm:text-xl font-black mt-0.5 leading-tight tracking-tight text-white">
                  {slide.title}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-200/90 mt-0.5 font-medium">{slide.subtitle}</p>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white/20 tracking-tighter shrink-0 font-mono">
                {String(currentSlide + 1).padStart(2, '0')}
              </span>
            </div>

            {/* Slide Main Content */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center overflow-y-auto">
              {slide.content}
            </div>

            {/* Slide Sub-Footer */}
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-tight text-[10px] text-emerald-400">
                  SI-MANGGA • KELURAHAN MANGGA
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-emerald-300 font-bold text-[10px] hidden sm:inline">#SIKEPLINGMANGGA</span>
              </div>

              <div className="h-7 sm:h-8 flex items-center justify-center overflow-hidden rounded-lg shadow-xs border border-emerald-500/40 bg-emerald-950/80 px-2 py-0.5 shrink-0">
                <img
                  src={BANNER_IMAGE_PATH}
                  alt="Medan Untuk Semua"
                  className="h-full w-auto object-contain max-h-7"
                />
              </div>

              <div className="flex items-center gap-2 font-bold text-[10px] text-emerald-400">
                <span>#KELURAHANMANGGA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Slide Controls */}
        <div className="bg-white px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Membuat PPTX...' : 'Unduh PowerPoint (.pptx)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
