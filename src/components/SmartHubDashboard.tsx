import React from 'react';
import {
  FileText,
  Award,
  Users,
  History,
  UserCheck,
  ShieldCheck,
  Trophy,
  Calendar,
  Compass,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { UserAccount, LaporanHarianItem, AbsenApelItem } from '../types';

interface SmartHubDashboardProps {
  activeAccount: UserAccount;
  reports: LaporanHarianItem[];
  attendanceList: AbsenApelItem[];
  onNavigate: (tab: 'form' | 'capaian' | 'monitoring' | 'capaian_admin' | 'riwayat' | 'kunjungan' | 'dashboard_kasi' | 'kegiatan_khusus') => void;
  onOpenAbsenApel: () => void;
  onOpenPPTModal: () => void;
}

export const SmartHubDashboard: React.FC<SmartHubDashboardProps> = ({
  activeAccount,
  reports,
  attendanceList,
  onNavigate,
  onOpenAbsenApel,
  onOpenPPTModal
}) => {
  const isKepling = activeAccount.role === 'kepling';
  const isAdmin = activeAccount.role === 'super_admin';
  const isKasi = activeAccount.role.startsWith('kasi_');

  // Stats / Compliance Helpers
  const todayStr = new Date().toISOString().split('T')[0];
  
  // 1. Kepling stats for today
  const hasSubmittedReportToday = reports.some(
    (r) => r.petugasNama === activeAccount.nama && r.tanggalLaporan?.startsWith(todayStr)
  );

  const hasAbsenApelToday = attendanceList.some(
    (a) => a.accountId === activeAccount.id && a.tanggal?.startsWith(todayStr)
  );

  const reportsCount = reports.filter((r) => r.petugasNama === activeAccount.nama).length;

  // 2. Admin stats for today
  const todayReportsCount = reports.filter((r) => r.tanggalLaporan?.startsWith(todayStr)).length;
  const uniqueKeplingsWithReportsToday = new Set(
    reports
      .filter((r) => r.tanggalLaporan?.startsWith(todayStr))
      .map((r) => r.petugasNama)
  ).size;

  const todayApelCount = attendanceList.filter(
    (a) => a.tanggal.startsWith(todayStr) && a.status === 'Hadir'
  ).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1 animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-6 border border-emerald-800 shadow-md relative overflow-hidden">
        {/* Subtle decorative grid lines */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/30">
              Pusat Kendali Aplikasi
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Selamat Datang Kembali, <span className="text-emerald-400">{activeAccount.nama}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
              {isKepling && `Anda login sebagai Kepala Lingkungan ${activeAccount.lingkungan}. Pantau dan laporkan kegiatan lapangan Anda secara tertib di sini.`}
              {isAdmin && "Anda memegang kendali penuh monitoring administrasi kelurahan Mangga. Kelola target, absensi, dan validasi seluruh 24 Kepala Lingkungan secara real-time."}
              {isKasi && `Selamat bekerja, Kasi Sektoral Kelurahan. Evaluasi dan verifikasi pencapaian target di bidang Anda secara taktis.`}
            </p>
          </div>

          {/* PPT Tutorial Button Shortcut */}
          <button
            onClick={onOpenPPTModal}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer self-start md:self-center"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Lihat Panduan Aplikasi</span>
          </button>
        </div>
      </div>

      {/* COMPLIANCE CHECKLIST FOR KEPLING */}
      {isKepling && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ClipboardList className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Target &amp; Kepatuhan Harian Anda</h3>
              <p className="text-[10px] text-slate-400 font-medium">Selesaikan seluruh agenda di bawah untuk memastikan rekam kinerja Anda hari ini tercatat dengan sempurna.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Task 1: Absen Apel */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
              hasAbsenApelToday
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/40 border-amber-200 text-amber-950'
            }`}>
              <div className="space-y-1">
                <p className="text-xs font-black">Absen Apel Pagi</p>
                <p className="text-[10px] opacity-80">{hasAbsenApelToday ? 'Selesai Dilakukan' : 'Belum Berpartisipasi'}</p>
              </div>
              {hasAbsenApelToday ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <button
                  onClick={onOpenAbsenApel}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black rounded shadow-xs uppercase cursor-pointer"
                >
                  Absen
                </button>
              )}
            </div>

            {/* Task 2: Laporan Harian */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
              hasSubmittedReportToday
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/40 border-rose-200 text-rose-950'
            }`}>
              <div className="space-y-1">
                <p className="text-xs font-black">Form Laporan Harian</p>
                <p className="text-[10px] opacity-80">{hasSubmittedReportToday ? 'Sudah Diinput Hari Ini' : 'Belum Ada Input Hari Ini'}</p>
              </div>
              {hasSubmittedReportToday ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <button
                  onClick={() => onNavigate('form')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black rounded shadow-xs uppercase cursor-pointer"
                >
                  Isi Form
                </button>
              )}
            </div>

            {/* Task 3: Kunjungan Warga */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-black">Kunjungan Warga</p>
                <p className="text-[10px] text-slate-500">Log Interaksi Harian</p>
              </div>
              <button
                onClick={() => onNavigate('kunjungan')}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[9px] font-black rounded shadow-xs uppercase cursor-pointer"
              >
                Buka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STATS FOR ADMIN */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Laporan Hari Ini</p>
            <p className="text-xl font-black text-emerald-800 mt-1">{todayReportsCount} Laporan</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Dari {uniqueKeplingsWithReportsToday}/24 Kepling</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kehadiran Apel Hari Ini</p>
            <p className="text-xl font-black text-amber-700 mt-1">{todayApelCount}/24 Hadir</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Sesi Apel Pagi Kelurahan</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Database Laporan</p>
            <p className="text-xl font-black text-slate-900 mt-1">{reports.length} Data</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Tersimpan di Cloud Firestore</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peta Pelayanan</p>
            <p className="text-xl font-black text-blue-700 mt-1">24 Lingkungan</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Kelurahan Mangga Prima</p>
          </div>
        </div>
      )}

      {/* MAIN NAVIGATION SHORTCUT CARDS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-emerald-800" />
          <h3 className="font-black text-slate-800 text-sm">Pilih Layanan &amp; Menu Navigasi</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* GROUP 1: PELAPORAN & ABSENSI (KEPLING / ADMIN) */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              {isKepling ? "Agenda & Pelaporan Lapangan" : "Monitoring Utama & Validasi"}
            </h4>

            {isKepling ? (
              <>
                {/* Kepling Form */}
                <div
                  onClick={() => onNavigate('form')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">Formulir Laporan Harian</span>
                      <span className="text-[8px] bg-red-100 text-red-800 px-1 rounded font-black">UTAMA</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Input aktivitas trantib, infrastruktur, kebersihan, &amp; kemasyarakatan.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>

                {/* Kepling Kunjungan */}
                <div
                  onClick={() => onNavigate('kunjungan')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Kunjungan Harian Warga</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Log / pencatatan interaksi, sambang, dan sosialisasi ke rumah warga.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>

                {/* Kepling Riwayat */}
                <div
                  onClick={() => onNavigate('riwayat')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <History className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Riwayat Laporan Saya</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Review, sunting, cari, dan kelola laporan-laporan terdahulu yang Anda kirim.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>
              </>
            ) : (
              <>
                {/* Admin Monitoring */}
                <div
                  onClick={() => onNavigate('monitoring')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-800 text-xs sm:text-sm">Monitoring 24 Kepling</span>
                      <span className="text-[8px] bg-red-100 text-red-800 px-1 rounded font-black">MONITOR</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Pantau status laporan harian, rekap apel pagi, dan peta interaktif kelurahan.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>

                {/* Admin Kunjungan */}
                <div
                  onClick={() => onNavigate('kunjungan')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Kunjungan Harian 24 Lingkungan</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Evaluasi persebaran lokasi dan foto sambang kepling di seluruh wilayah.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>

                {/* Admin Riwayat */}
                <div
                  onClick={() => onNavigate('riwayat')}
                  className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <History className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Database Riwayat Laporan</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Pusat pencarian, filter, edit, dan ekspor seluruh laporan kepling Kelurahan Mangga.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
                </div>
              </>
            )}
          </div>

          {/* GROUP 2: TARGETS, CAPAIAN & AGENDA KHUSUS */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              {isKepling ? "Dashboard Capaian & Agenda" : "Kasi Sektoral & Agenda Khusus"}
            </h4>

            {/* Capaian Sektor */}
            <div
              onClick={() => onNavigate(isKepling ? 'capaian' : 'capaian_admin')}
              className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">
                  {isKepling ? "Dashboard Capaian Saya" : "Kelola Target & Capaian 24 Kepling"}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isKepling
                    ? "Grafik real-time realisasi target PBB, Perlinsos (DTKS), dan Trantibum."
                    : "Update, ubah, dan pantau target sektoral untuk masing-masing dari 24 Kepling."}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
            </div>

            {/* Kegiatan Khusus (Absen) */}
            <div
              onClick={() => onNavigate('kegiatan_khusus')}
              className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-800 text-xs sm:text-sm">Absensi Kegiatan Khusus</span>
                  <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded font-black">BARU</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isKepling
                    ? "Lakukan check-in/absen dengan verifikasi GPS + foto selfie untuk undangan kelurahan."
                    : "Buat agenda kegiatan baru, kelola jadwal, dan lihat rekap absensi real-time kepling."}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
            </div>

            {/* Kasi Dashboard Tab (Visible Only to Kasi Roles) */}
            {isKasi && (
              <div
                onClick={() => onNavigate('dashboard_kasi')}
                className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5 animate-pulse"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Award className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Dashboard Bidang Sektoral</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Halaman khusus rekapitulasi data sektoral Anda (PBB / DTKS / Trantib).</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
              </div>
            )}

            {/* Admin Proxy Input (Helper for super_admin) */}
            {isAdmin && (
              <div
                onClick={() => onNavigate('form')}
                className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-slate-800 text-xs sm:text-sm block">Asistensi Input Laporan</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Bantu kepling menginput laporan harian dari dashboard pusat.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all self-center shrink-0" />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
