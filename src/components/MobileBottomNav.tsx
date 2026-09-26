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
} from 'lucide-react';
import { UserAccount } from '../types';

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
  | 'pemetaan';

interface MobileBottomNavProps {
  activeTab: AppTabType;
  onSelectTab: (tab: AppTabType) => void;
  activeAccount: UserAccount;
  hasAbsenToday?: boolean;
  hasLaporToday?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  activeAccount,
  hasAbsenToday,
  hasLaporToday,
}) => {
  const isKepling = activeAccount.role === 'kepling';
  const isAdmin = activeAccount.role === 'super_admin';
  const isKasi = activeAccount.role.startsWith('kasi_');
  const isBapenda = activeAccount.role === 'petugas_bapenda';

  if (isBapenda) {
    return null;
  }

  return (
    <aside
      aria-label="Menu Navigasi Cepat Ponsel"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-safe"
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
            {isKepling && (!hasAbsenToday || !hasLaporToday) && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Beranda</span>
        </button>

        {/* Tab 2: Contextual (Kunjungan untuk Kepling/Admin, Sektoral untuk Kasi) */}
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
            <Users className={`w-5 h-5 ${activeTab === 'kunjungan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
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
            <ShieldCheck className={`w-5 h-5 ${activeTab === 'monitoring' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Monitoring</span>
          </button>
        )}

        {isKasi && (
          <button
            id="btn-mobile-nav-sektoral"
            type="button"
            onClick={() => onSelectTab('dashboard_kasi')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
              activeTab === 'dashboard_kasi'
                ? 'text-teal-700 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className={`w-5 h-5 ${activeTab === 'dashboard_kasi' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Sektoral</span>
          </button>
        )}

        {/* Tab 3: CENTER ACTION BUTTON (LAPOR / FORM) */}
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

        {/* Tab 4: Peta Spasial / WebGIS */}
        <button
          id="btn-mobile-nav-pemetaan"
          type="button"
          onClick={() => onSelectTab('pemetaan')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'pemetaan'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'pemetaan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Peta GIS</span>
        </button>

        {/* Tab 5: Capaian / Riwayat */}
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

        {isKasi && (
          <button
            id="btn-mobile-nav-riwayat-kasi"
            type="button"
            onClick={() => onSelectTab('riwayat')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'text-teal-700 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className={`w-5 h-5 ${activeTab === 'riwayat' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Riwayat</span>
          </button>
        )}
      </nav>
    </aside>
  );
};
