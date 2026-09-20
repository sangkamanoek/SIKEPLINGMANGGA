import React, { useState } from 'react';
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
  HelpCircle,
  MapPin,
  Layers,
  Search,
  Sparkles,
  LayoutGrid,
  Clock,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { UserAccount, LaporanHarianItem, AbsenApelItem } from '../types';

interface SmartHubDashboardProps {
  activeAccount: UserAccount;
  reports: LaporanHarianItem[];
  attendanceList: AbsenApelItem[];
  onNavigate: (tab: 'form' | 'capaian' | 'monitoring' | 'capaian_admin' | 'riwayat' | 'kunjungan' | 'dashboard_kasi' | 'kegiatan_khusus' | 'pemetaan' | 'rekap_pbb') => void;
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'gis' | 'laporan' | 'capaian' | 'absen'>('all');

  // Stats / Compliance Helpers
  const todayStr = new Date().toISOString().split('T')[0];
  
  const hasSubmittedReportToday = reports.some(
    (r) => r.petugasNama === activeAccount.nama && r.tanggalLaporan?.startsWith(todayStr)
  );

  const hasAbsenApelToday = attendanceList.some(
    (a) => a.accountId === activeAccount.id && a.tanggal?.startsWith(todayStr)
  );

  const todayReportsCount = reports.filter((r) => r.tanggalLaporan?.startsWith(todayStr)).length;
  const uniqueKeplingsWithReportsToday = new Set(
    reports
      .filter((r) => r.tanggalLaporan?.startsWith(todayStr))
      .map((r) => r.petugasNama)
  ).size;

  const todayApelCount = attendanceList.filter(
    (a) => a.tanggal.startsWith(todayStr) && a.status === 'Hadir'
  ).length;

  // Define menu items for UIX filtering
  const menuItems = [
    {
      id: 'pemetaan',
      title: isKepling ? 'Pemetaan Wilayah & WRS' : 'Peta Wilayah & WebGIS 24 Lingkungan',
      desc: 'Gambar poligon batas wilayah, tandai titik rumah warga, pantau Wajib Retribusi Sampah (WRS), bansos, & kondisi jalan.',
      category: 'gis',
      icon: '🗺️',
      badge: 'WEBGIS SPASIAL',
      badgeColor: 'bg-amber-400 text-slate-950',
      bgGradient: 'bg-gradient-to-r from-emerald-950 to-slate-900 text-white border-emerald-600/60',
      action: () => onNavigate('pemetaan')
    },
    {
      id: 'form',
      title: 'Formulir Laporan Harian',
      desc: 'Input kegiatan harian Kepala Lingkungan: trantib, infrastruktur, kebersihan, PBB, & kemasyarakatan.',
      category: 'laporan',
      icon: FileText,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badge: 'UTAMA',
      badgeColor: 'bg-red-100 text-red-800',
      action: () => onNavigate('form')
    },
    {
      id: 'kunjungan',
      title: 'Kunjungan Harian Warga',
      desc: 'Log & rekam interaksi sambang, silaturahmi, serta sosialisasi langsung ke rumah warga lingkungan.',
      category: 'laporan',
      icon: Users,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badge: 'SOSIAL',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      action: () => onNavigate('kunjungan')
    },
    {
      id: 'riwayat',
      title: isKepling ? 'Riwayat Laporan Saya' : 'Database Riwayat Laporan',
      desc: 'Pusat arsip pencarian, filter, edit, verifikasi, dan ekspor laporan harian seluruh lingkungan.',
      category: 'laporan',
      icon: History,
      iconBg: 'bg-slate-100 text-slate-700',
      badge: 'ARSIP',
      badgeColor: 'bg-slate-200 text-slate-800',
      action: () => onNavigate('riwayat')
    },
    {
      id: 'capaian',
      title: isKepling ? 'Dashboard Capaian Saya' : 'Kelola Target & Capaian 24 Kepling',
      desc: 'Grafik real-time realisasi target PBB, Perlinsos (DTKS), dan Trantibum secara transparan.',
      category: 'capaian',
      icon: Trophy,
      iconBg: 'bg-amber-50 text-amber-600',
      badge: 'TARGET',
      badgeColor: 'bg-amber-100 text-amber-800',
      action: () => onNavigate(isKepling ? 'capaian' : 'capaian_admin')
    },
    {
      id: 'pbb_lingkungan',
      title: isKepling ? `Data PBB Lingkungan ${activeAccount.nomorLingkungan || ''}` : 'Rekapitulasi Realisasi PBB 2026',
      desc: isKepling
        ? `Pantau target nominal PBB, daftar SPPT Wajib Pajak Lingkungan ${activeAccount.nomorLingkungan || ''}, dan tandai WP lunas.`
        : 'Rekapitulasi target dan realisasi penerimaan PBB-P2 Tahun 2026 di 24 Lingkungan Kelurahan Mangga.',
      category: 'capaian',
      icon: FileSpreadsheet,
      iconBg: 'bg-emerald-50 text-emerald-700',
      badge: isKepling ? 'PBB LINGKUNGAN' : 'PBB 2026',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      action: () => onNavigate('rekap_pbb')
    },
    {
      id: 'kegiatan_khusus',
      title: 'Absensi Kegiatan Khusus',
      desc: 'Absensi check-in kegiatan kelurahan dengan validasi koordinat GPS dan foto selfie kehadiran.',
      category: 'absen',
      icon: UserCheck,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badge: 'GPS ABSEN',
      badgeColor: 'bg-teal-100 text-teal-800',
      action: () => onNavigate('kegiatan_khusus')
    },
    ...(isAdmin ? [{
      id: 'monitoring',
      title: 'Monitoring 24 Kepling',
      desc: 'Pantau status keaktifan laporan harian, rekapitulasi apel pagi, dan peta interaktif kelurahan.',
      category: 'capaian',
      icon: ShieldCheck,
      iconBg: 'bg-amber-50 text-amber-600',
      badge: 'ADMIN',
      badgeColor: 'bg-rose-100 text-rose-800',
      action: () => onNavigate('monitoring')
    }] : []),
    ...(isKasi ? [{
      id: 'dashboard_kasi',
      title: 'Dashboard Bidang Sektoral',
      desc: 'Halaman khusus rekapitulasi data sektoral Anda (PBB / DTKS / Trantib) dengan akses verifikasi.',
      category: 'capaian',
      icon: Award,
      iconBg: 'bg-teal-50 text-teal-600',
      badge: 'KASI',
      badgeColor: 'bg-teal-100 text-teal-800',
      action: () => onNavigate('dashboard_kasi')
    }] : [])
  ];

  const filteredMenus = menuItems.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1 animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-6 border border-emerald-800/80 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Pusat Kendali Modern SI-KEPLING</span>
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700">
                {activeAccount.jabatan}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Selamat Datang, <span className="text-emerald-400">{activeAccount.nama}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
              {isKepling && `Kepala Lingkungan ${activeAccount.lingkungan} Kelurahan Mangga, Kec. Medan Tuntungan.`}
              {isAdmin && "Dashboard Eksekutif Super Admin Kelurahan Mangga. Kelola seluruh 24 lingkungan secara real-time."}
              {isKasi && "Dashboard Kasi Sektoral. Evaluasi, verifikasi, dan pantau capaian kinerja di bidang Anda."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenPPTModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Panduan Aplikasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* COMPLIANCE CHECKLIST FOR KEPLING */}
      {isKepling && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">Radar Tugas &amp; Kepatuhan Harian</h3>
                <p className="text-[11px] text-slate-500 font-medium">Pantau 2 agenda wajib sebelum batas waktu berakhir hari ini.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              <span>Hari Ini:</span>
              <span className="text-emerald-800 font-black">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Kartu 1: Absen Apel Pagi */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                hasAbsenApelToday
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                  : 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs ring-1 ring-amber-400/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider">1. Absen Apel Pagi</span>
                    {!hasAbsenApelToday && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 animate-pulse">
                        WAJIB
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold mt-1 opacity-90">
                    {hasAbsenApelToday ? '✅ Sudah Terverifikasi Hadir' : '⚠️ Jam 07.45 - 08.00 WIB di Kantor Lurah'}
                  </p>
                </div>
                {hasAbsenApelToday ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                )}
              </div>

              {hasAbsenApelToday ? (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                  <span>Presensi Tercatat</span>
                  <button
                    onClick={onOpenAbsenApel}
                    className="underline hover:text-emerald-950 cursor-pointer"
                  >
                    Lihat Bukti
                  </button>
                </div>
              ) : (
                <button
                  id="btn-radar-absen-sekarang"
                  onClick={onOpenAbsenApel}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 text-xs font-black rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Ambil Absen Apel Sekarang</span>
                </button>
              )}
            </div>

            {/* Kartu 2: Formulir Laporan Harian */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                hasSubmittedReportToday
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                  : 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider">2. Laporan Harian</span>
                    {!hasSubmittedReportToday && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white">
                        BELUM KIRIM
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold mt-1 opacity-90">
                    {hasSubmittedReportToday
                      ? '✅ 1 Laporan Harian Lengkap Terkirim'
                      : '📝 Wajib 6 Foto Kegiatan Lapangan'}
                  </p>
                </div>
                {hasSubmittedReportToday ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                )}
              </div>

              {hasSubmittedReportToday ? (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                  <span>Tersimpan di Cloud</span>
                  <button
                    onClick={() => onNavigate('form')}
                    className="underline hover:text-emerald-950 cursor-pointer"
                  >
                    + Lapor Lagi
                  </button>
                </div>
              ) : (
                <button
                  id="btn-radar-lapor-sekarang"
                  onClick={() => onNavigate('form')}
                  className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white text-xs font-black rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Isi &amp; Kirim Laporan</span>
                </button>
              )}
            </div>

            {/* Kartu 3: Sambang Warga & Pemetaan */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/90 text-slate-800 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">3. Sambang &amp; Peta GIS</span>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">Plotting rumah warga, tagihan PBB &amp; WRS sampah.</p>
                </div>
                <Users className="w-5 h-5 text-emerald-700 shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onNavigate('kunjungan')}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg shadow-2xs text-center cursor-pointer active:scale-98"
                >
                  👥 Sambang
                </button>
                <button
                  onClick={() => onNavigate('pemetaan')}
                  className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-2xs text-center cursor-pointer active:scale-98"
                >
                  🗺️ Peta WRS
                </button>
              </div>
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

      {/* REBUILT UIX: NAVIGATION MENU HUB WITH SEARCH & CATEGORY TABS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-black text-slate-800 text-sm">Pusat Navigasi &amp; Layanan Menu</h3>
              <p className="text-[10px] text-slate-400">Temukan seluruh modul sistem dengan cepat melalui filter kategori atau pencarian.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu / layanan..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: '🌟 Semua Menu' },
            { id: 'gis', label: '🗺️ WebGIS & Pemetaan' },
            { id: 'laporan', label: '📝 Pelaporan & Arsip' },
            { id: 'capaian', label: '📊 Capaian & Target' },
            { id: 'absen', label: '👤 Absensi GPS' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Menu Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMenus.map((menu) => {
            const isSpecialGis = menu.id === 'pemetaan';
            return (
              <div
                key={menu.id}
                onClick={menu.action}
                className={`group p-4.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                  isSpecialGis
                    ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white border-emerald-600/70 hover:border-emerald-400 shadow-md hover:shadow-lg'
                    : 'bg-white border-slate-200/90 hover:border-emerald-500 hover:shadow-md'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold transition-transform group-hover:scale-110 shadow-xs ${
                  isSpecialGis
                    ? 'bg-emerald-800/80 border border-emerald-500/50 text-white'
                    : menu.iconBg || 'bg-emerald-50 text-emerald-600'
                }`}>
                  {typeof menu.icon === 'string' ? menu.icon : React.createElement(menu.icon, { className: 'w-5 h-5' })}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-black text-xs sm:text-sm ${isSpecialGis ? 'text-emerald-300' : 'text-slate-800'}`}>
                      {menu.title}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider ${menu.badgeColor}`}>
                      {menu.badge}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${isSpecialGis ? 'text-slate-300' : 'text-slate-500'}`}>
                    {menu.desc}
                  </p>
                </div>

                <ArrowRight className={`w-4 h-4 self-center shrink-0 transition-transform group-hover:translate-x-1 ${
                  isSpecialGis ? 'text-emerald-400' : 'text-slate-300 group-hover:text-emerald-600'
                }`} />
              </div>
            );
          })}

          {filteredMenus.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-400 font-medium">Tidak ada menu atau layanan yang cocok dengan kata kunci "{searchQuery}".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

