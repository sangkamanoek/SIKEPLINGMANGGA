import React from 'react';
import { ShieldCheck, ChevronDown, UserCheck, KeyRound, Smartphone, LogOut, UserCircle, Presentation } from 'lucide-react';
import { GoogleUser, SheetMetadata, UserAccount } from '../types';

interface HeaderBannerProps {
  user: GoogleUser | null;
  sheetMeta: SheetMetadata | null;
  isConnecting: boolean;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  activeAccount: UserAccount;
  onOpenAccountModal: () => void;
  onOpenInstallModal?: () => void;
  onOpenUbahPassword?: () => void;
  onOpenEditProfile?: () => void;
  onLogout?: () => void;
  onOpenPPTModal?: () => void;
  onOpenAbsenApel?: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  user,
  sheetMeta,
  isConnecting,
  onConnectGoogle,
  onDisconnectGoogle,
  activeAccount,
  onOpenAccountModal,
  onOpenInstallModal,
  onOpenUbahPassword,
  onOpenEditProfile,
  onLogout,
  onOpenPPTModal,
  onOpenAbsenApel,
}) => {
  return (
    <header className="bg-emerald-800 text-white shadow-lg print:hidden">
      {/* Top Banner with Medan Logo Replica and Tagline */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-700/60 text-xs">
        {/* Official Slogan Badge */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center rounded-md overflow-hidden shadow-xs text-[11px] font-black tracking-wider uppercase">
            <span className="bg-[#991B1B] text-white px-2 py-0.5">
              MEDAN
            </span>
            <span className="bg-[#1E3A8A] text-white px-2 py-0.5 tracking-normal font-bold">
              UNTUK SEMUA
            </span>
          </div>
          <span className="hidden sm:inline-block text-xs font-semibold text-emerald-100/90 tracking-wide">
            #MedanUntukSemua • #SemuaUntukMedan
          </span>
        </div>

        {/* Indikator Status Resmi Aplikasi */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-200 bg-emerald-900/60 border border-emerald-600/40 px-2.5 py-1 rounded-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistem Aktif & Terhubung
          </span>
        </div>
      </div>

      {/* Main App Title in Professional Polish layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-1.5 shadow-md shrink-0 border border-white/20">
            <img
              src="/logo_pemko_medan.svg"
              alt="Logo Pemko Medan"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-xs max-w-lg leading-tight uppercase">
                SI-KEPLING MANGGA
              </h1>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs self-start sm:self-auto ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-950 text-emerald-200 border border-emerald-600'
                }`}
              >
                {activeAccount.role === 'super_admin' ? 'PORTAL SUPER ADMIN' : 'APLIKASI KEPALA LINGKUNGAN'}
              </span>
            </div>
            <p className="text-emerald-100 text-[11px] sm:text-xs uppercase tracking-widest font-semibold mt-0.5">
              {activeAccount.role === 'super_admin'
                ? 'MONITORING LAPORAN KEGIATAN HARIAN KEPALA LINGKUNGAN'
                : `PELAPORAN HARIAN ${activeAccount.lingkungan.toUpperCase() || 'KEPALA LINGKUNGAN'}`} • KELURAHAN MANGGA
            </p>
          </div>
        </div>

        {/* Header Actions: Absen Apel Pagi, PPT Panduan, APK Install & Active Account Switcher */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto">
          {onOpenAbsenApel && (
            <button
              id="btn-open-absen-apel-header"
              type="button"
              onClick={onOpenAbsenApel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer shrink-0 border border-amber-300 animate-pulse-subtle"
              title="Absen Apel Pagi Kepling Kelurahan Mangga"
            >
              <UserCheck className="w-4 h-4 text-slate-950" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-slate-900/80 font-black leading-none">
                  PRESENSI
                </span>
                <span className="leading-tight">Absen Apel Pagi</span>
              </div>
            </button>
          )}

          {onOpenPPTModal && (
            <button
              id="btn-open-ppt-modal"
              type="button"
              onClick={onOpenPPTModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 border border-teal-500/50 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
              title="Buka Slide Presentation & Download File PowerPoint (.pptx) Panduan Kepling"
            >
              <Presentation className="w-4 h-4 text-emerald-300" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-teal-200 font-black leading-none">
                  File PPT
                </span>
                <span className="leading-tight">Panduan Kepling</span>
              </div>
            </button>
          )}

          {onOpenInstallModal && (
            <button
              id="btn-open-install-apk-modal"
              type="button"
              onClick={onOpenInstallModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
              title="Pasang aplikasi SI-KEPLING MANGGA di HP Android / iOS"
            >
              <Smartphone className="w-4 h-4 text-emerald-950" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-emerald-950/80 font-black leading-none">
                  APK Android
                </span>
                <span className="leading-tight">Pasang Aplikasi</span>
              </div>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <button
              id="btn-open-account-modal-header"
              type="button"
              onClick={activeAccount.role === 'super_admin' ? onOpenAccountModal : onOpenUbahPassword}
              className={`text-left sm:text-right p-2 sm:px-3 sm:py-2 rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer group ${
                activeAccount.role === 'super_admin'
                  ? 'bg-amber-950/70 border-amber-500/50 hover:bg-amber-900/80 text-white shadow-md'
                  : 'bg-emerald-900/80 border-emerald-600/60 hover:bg-emerald-850 text-white shadow-md'
              }`}
              title={activeAccount.role === 'super_admin' ? 'Klik untuk kelola akun atau lihat buku sandi' : 'Klik untuk ubah kata sandi profil'}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-emerald-700 text-emerald-100'
                }`}
              >
                {activeAccount.role === 'super_admin' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  activeAccount.nomorLingkungan || 'KL'
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded flex items-center gap-1 ${
                      activeAccount.role === 'super_admin'
                        ? 'bg-amber-400/30 text-amber-200'
                        : 'bg-emerald-700/60 text-emerald-200'
                    }`}
                  >
                    <KeyRound className="w-2.5 h-2.5 opacity-80" />
                    <span>{activeAccount.role === 'super_admin' ? 'SUPER ADMIN' : activeAccount.lingkungan}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-300 group-hover:text-white transition-transform" />
                </div>
                <div className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[190px]">
                  {activeAccount.nama}
                </div>
              </div>
            </button>

            {/* Edit Profile Action */}
            {onOpenEditProfile && (
              <button
                id="btn-open-edit-profile"
                type="button"
                onClick={onOpenEditProfile}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-600/50 text-emerald-200 hover:text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                title="Edit Profil Pengguna"
              >
                <UserCircle className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline font-bold text-xs">Edit Profil</span>
              </button>
            )}

            {/* Ubah Password Action */}
            {onOpenUbahPassword && (
              <button
                id="btn-open-ubah-password"
                type="button"
                onClick={onOpenUbahPassword}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-600/50 text-emerald-200 hover:text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                title="Ubah Kata Sandi (Password)"
              >
                <KeyRound className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline font-bold text-xs">Ubah Sandi</span>
              </button>
            )}

            {/* Logout Action */}
            {onLogout && (
              <button
                id="btn-logout-app"
                type="button"
                onClick={onLogout}
                className="p-2.5 rounded-xl bg-red-950/60 hover:bg-red-800 border border-red-500/50 text-red-200 hover:text-white shadow-md transition-all cursor-pointer flex items-center justify-center"
                title="Keluar dari Sistem (Logout)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
