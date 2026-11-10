import React from 'react';
import {
  Home,
  Plus,
  FileText,
  Users,
  Compass,
  Award,
  ShieldCheck,
  Trophy,
  FileSpreadsheet,
  Wrench,
  ShieldAlert,
  Landmark,
  HeartHandshake,
  UserCheck,
  Wallet,
  Flower2,
} from 'lucide-react';
import { UserAccount, isPkkRole } from '../types';

export type AppTabType =
  | 'hub'
  | 'form'
  | 'capaian'
  | 'monitoring'
  | 'capaian_admin'
  | 'riwayat'
  | 'kunjungan'
  | 'dashboard_kasi'
  | 'kegiatan_khusus'
  | 'rekap_pbb'
  | 'realisasi_pembangunan'
  | 'keuangan_pkk'
  | 'kegiatan_pkk'
  | 'posyandu_pkk'
  | 'surat_kedinasan'
  | 'buku_pkk'
  | 'daftar_tugas_khusus'
  | 'agenda';


interface MobileBottomNavProps {
  activeTab: AppTabType;
  onSelectTab: (tab: AppTabType) => void;
  activeAccount: UserAccount;
  hasLaporToday?: boolean;
  unreadCounts?: Record<string, number>;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  activeAccount,
  hasLaporToday,
  unreadCounts,
}) => {
  const isKepling = activeAccount.role === 'kepling';
  const isAdmin = activeAccount.role === 'super_admin';
  const isKasiPem = activeAccount.role === 'kasi_pemerintahan';
  const isKasiBang = activeAccount.role === 'kasi_pembangunan';
  const isKasiTrantib = activeAccount.role === 'kasi_trantibum';
  const isBapenda = activeAccount.role === 'petugas_bapenda';
  const isPkk = isPkkRole(activeAccount.role);

  const renderBadge = (key: string) => {
    const count = unreadCounts?.[key] || 0;
    if (count <= 0) return null;
    return (
      <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-4 px-1 rounded-full text-[9px] font-black bg-rose-600 text-white flex items-center justify-center shadow-xs animate-pulse">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  if (isBapenda) {
    return null;
  }

  // Khusus Akun Tim Penggerak PKK (Pemisahan Hak Akses Mandiri)
    if (isPkk) {
      return (
        <aside
          aria-label="Menu Navigasi Cepat PKK"
          className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-pkk-teal border-t border-pkk-dark shadow-[0_-4px_16px_rgba(0,0,0,0.1)] px-2 pt-1.5 pb-safe"
        >
          <nav className="flex items-center justify-around max-w-lg mx-auto">
            {/* Tab 1: Beranda / Hub PKK */}
            <button
              type="button"
              onClick={() => onSelectTab('hub')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'hub' ? 'text-white font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <Home className={`w-5 h-5 ${activeTab === 'hub' ? 'stroke-[3]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight font-bold">Beranda</span>
            </button>
  
            {/* Tab 2: Kegiatan PKK */}
            <button
              type="button"
              onClick={() => onSelectTab('kegiatan_pkk')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'kegiatan_pkk' ? 'text-white font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <div className="relative">
                <FileText className={`w-5 h-5 ${activeTab === 'kegiatan_pkk' ? 'stroke-[3]' : 'stroke-[1.8]'}`} />
                {renderBadge('kegiatan_pkk')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-bold">Kegiatan</span>
            </button>
  
            {/* Center Action Button: Keuangan PKK (BKU) */}
            <div className="flex-1 flex justify-center -mt-6">
              <button
                type="button"
                onClick={() => onSelectTab('keuangan_pkk')}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer border-4 border-pkk-teal relative ${
                  activeTab === 'keuangan_pkk'
                    ? 'bg-white text-pkk-teal ring-4 ring-white/20'
                    : 'bg-amber-400 text-slate-900 hover:brightness-105'
                }`}
                title="Buku Kas Umum PKK"
              >
                <Wallet className="w-6 h-6 stroke-[3]" />
                {renderBadge('keuangan_pkk')}
                <span className="sr-only">Kas PKK</span>
              </button>
            </div>
  

          </nav>
        </aside>
      );
    }

  return (
    <aside
      aria-label="Menu Navigasi Cepat Ponsel"
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-safe"
    >
      <nav className="flex items-center justify-around max-w-lg mx-auto">
        {/* Tab 1: Beranda / Hub */}
        <button
          id="btn-mobile-nav-hub"
          type="button"
          onClick={() => onSelectTab('hub')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'hub'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Home className={`w-5 h-5 ${activeTab === 'hub' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            {isKepling && !hasLaporToday && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Beranda</span>
        </button>

        {/* 1. SEKSI TATA PEMERINTAHAN NAV BUTTONS */}
        {isKasiPem && (
          <>
            <button
              id="btn-mobile-nav-dashboard-pem"
              type="button"
              onClick={() => onSelectTab('dashboard_kasi')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'dashboard_kasi' ? 'text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className={`w-5 h-5 ${activeTab === 'dashboard_kasi' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">Sektoral</span>
            </button>

            {/* Center Action Button: PBB-P2 */}
            <div className="flex-1 flex justify-center -mt-4">
              <button
                id="btn-mobile-nav-pbb-center"
                type="button"
                onClick={() => onSelectTab('rekap_pbb')}
                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border-2 border-white ${
                  activeTab === 'rekap_pbb'
                    ? 'bg-gradient-to-tr from-emerald-800 to-teal-700 text-white ring-2 ring-emerald-500 ring-offset-2'
                    : 'bg-gradient-to-tr from-teal-700 to-emerald-600 text-white hover:brightness-105'
                }`}
                title="Realisasi PBB-P2 2026"
              >
                <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
                <span className="sr-only">PBB</span>
              </button>
            </div>



            <button
              id="btn-mobile-nav-riwayat-pem"
              type="button"
              onClick={() => onSelectTab('riwayat')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'riwayat' ? 'text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <FileText className={`w-5 h-5 ${activeTab === 'riwayat' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {renderBadge('riwayat')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Riwayat</span>
            </button>
          </>
        )}

        {/* 2. SEKSI PEMBANGUNAN & KESOS NAV BUTTONS */}
        {isKasiBang && (
          <>
            <button
              id="btn-mobile-nav-dashboard-bang"
              type="button"
              onClick={() => onSelectTab('dashboard_kasi')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'dashboard_kasi' ? 'text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className={`w-5 h-5 ${activeTab === 'dashboard_kasi' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">Perlinsos</span>
            </button>

            {/* Center Action Button: Realisasi Pembangunan */}
            <div className="flex-1 flex justify-center -mt-4">
              <button
                id="btn-mobile-nav-infra-center"
                type="button"
                onClick={() => onSelectTab('realisasi_pembangunan')}
                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border-2 border-white relative ${
                  activeTab === 'realisasi_pembangunan'
                    ? 'bg-gradient-to-tr from-blue-900 to-indigo-700 text-white ring-2 ring-blue-500 ring-offset-2'
                    : 'bg-gradient-to-tr from-blue-700 to-indigo-600 text-white hover:brightness-105'
                }`}
                title="Realisasi Pembangunan Fisik & Sarpras"
              >
                <Wrench className="w-5 h-5 stroke-[2.5]" />
                {renderBadge('realisasi_pembangunan')}
                <span className="sr-only">Infrastruktur</span>
              </button>
            </div>

            <button
              id="btn-mobile-nav-kunjungan-bang"
              type="button"
              onClick={() => onSelectTab('kunjungan')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'kunjungan' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Users className={`w-5 h-5 ${activeTab === 'kunjungan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {renderBadge('kunjungan')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Sambang</span>
            </button>

            <button
              id="btn-mobile-nav-riwayat-bang"
              type="button"
              onClick={() => onSelectTab('riwayat')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'riwayat' ? 'text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <FileText className={`w-5 h-5 ${activeTab === 'riwayat' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {renderBadge('riwayat')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Riwayat</span>
            </button>
          </>
        )}

        {/* 3. SEKSI TRANTIBUM & LINMAS NAV BUTTONS */}
        {isKasiTrantib && (
          <>
            <button
              id="btn-mobile-nav-dashboard-trantib"
              type="button"
              onClick={() => onSelectTab('dashboard_kasi')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'dashboard_kasi' ? 'text-amber-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className={`w-5 h-5 ${activeTab === 'dashboard_kasi' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">7 Bidang</span>
            </button>

            {/* Center Action Button: Kegiatan Patroli & Trantib */}
            <div className="flex-1 flex justify-center -mt-4">
              <button
                id="btn-mobile-nav-kegiatan-center"
                type="button"
                onClick={() => onSelectTab('kegiatan_khusus')}
                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border-2 border-white ${
                  activeTab === 'kegiatan_khusus'
                    ? 'bg-gradient-to-tr from-amber-700 to-orange-600 text-white ring-2 ring-amber-500 ring-offset-2'
                    : 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white hover:brightness-105'
                }`}
                title="Patroli Trantibum & Poskamling"
              >
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                <span className="sr-only">Patroli</span>
              </button>
            </div>

            <button
              id="btn-mobile-nav-kunjungan-trantib"
              type="button"
              onClick={() => onSelectTab('kunjungan')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'kunjungan' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Users className={`w-5 h-5 ${activeTab === 'kunjungan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {renderBadge('kunjungan')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Kunjungan</span>
            </button>

            <button
              id="btn-mobile-nav-riwayat-trantib"
              type="button"
              onClick={() => onSelectTab('riwayat')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'riwayat' ? 'text-amber-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <FileText className={`w-5 h-5 ${activeTab === 'riwayat' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {renderBadge('riwayat')}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Riwayat</span>
            </button>
          </>
        )}

        {/* 4. SUPER ADMIN & KEPLING (DEFAULT) */}
        {!isKasiPem && !isKasiBang && !isKasiTrantib && (
          <>
            {isKepling && (
              <button
                id="btn-mobile-nav-kunjungan"
                type="button"
                onClick={() => onSelectTab('kunjungan')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'kunjungan'
                    ? 'text-emerald-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Users className={`w-5 h-5 ${activeTab === 'kunjungan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {renderBadge('kunjungan')}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">Sambang</span>
              </button>
            )}

            {isAdmin && (
              <button
                id="btn-mobile-nav-monitoring"
                type="button"
                onClick={() => onSelectTab('monitoring')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'monitoring'
                    ? 'text-amber-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <ShieldCheck className={`w-5 h-5 ${activeTab === 'monitoring' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {renderBadge('monitoring')}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">Monitoring</span>
              </button>
            )}

            {/* Center Action Button */}
            <div className="flex-1 flex justify-center -mt-4">
              <button
                id="btn-mobile-nav-lapor-center"
                type="button"
                onClick={() => onSelectTab('form')}
                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer border-2 border-white ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-tr from-emerald-700 to-teal-600 text-white ring-2 ring-emerald-500 ring-offset-2'
                    : 'bg-gradient-to-tr from-amber-500 to-emerald-600 text-white hover:brightness-105'
                }`}
                title="Formulir Laporan Harian Kepling"
              >
                <Plus className="w-6 h-6 stroke-[3]" />
                <span className="sr-only">Lapor</span>
              </button>
            </div>

            <button
              id="btn-mobile-nav-pbb"
              type="button"
              onClick={() => onSelectTab('rekap_pbb')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'rekap_pbb'
                  ? 'text-emerald-700 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Landmark className={`w-5 h-5 ${activeTab === 'rekap_pbb' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">PBB</span>
            </button>

            {isKepling && (
              <button
                id="btn-mobile-nav-capaian"
                type="button"
                onClick={() => onSelectTab('capaian')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'capaian'
                    ? 'text-emerald-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trophy className={`w-5 h-5 ${activeTab === 'capaian' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight">Capaian</span>
              </button>
            )}

            {isAdmin && (
              <button
                id="btn-mobile-nav-capaian-admin"
                type="button"
                onClick={() => onSelectTab('capaian_admin')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'capaian_admin'
                    ? 'text-amber-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trophy className={`w-5 h-5 ${activeTab === 'capaian_admin' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight">Capaian</span>
              </button>
            )}
          </>
        )}
      </nav>
    </aside>
  );
};
