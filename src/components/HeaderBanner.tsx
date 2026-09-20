import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  UserCheck,
  KeyRound,
  Smartphone,
  LogOut,
  UserCircle,
  Presentation,
  MoreVertical,
  X,
} from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
        {/* Brand & Identity (Left) */}
        <div className="flex items-center gap-3.5 sm:gap-4 shrink-0 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center p-1.5 shadow-md shrink-0 border border-white/20">
            <img
              src="/logo_pemko_medan.svg"
              alt="Logo Pemko Medan"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-xs uppercase whitespace-nowrap">
                SI-KEPLING MANGGA
              </h1>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs whitespace-nowrap ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-400 text-slate-950'
                    : activeAccount.role === 'kasi_pemerintahan'
                    ? 'bg-teal-400 text-teal-950 font-black'
                    : activeAccount.role === 'kasi_pembangunan'
                    ? 'bg-blue-400 text-blue-950 font-black'
                    : activeAccount.role === 'kasi_trantibum'
                    ? 'bg-orange-400 text-orange-950 font-black'
                    : 'bg-emerald-950 text-emerald-200 border border-emerald-600'
                }`}
              >
                {activeAccount.role === 'super_admin'
                  ? 'PORTAL SUPER ADMIN'
                  : activeAccount.role === 'kasi_pemerintahan'
                  ? 'KASI TATA PEMERINTAHAN (PBB)'
                  : activeAccount.role === 'kasi_pembangunan'
                  ? 'KASI PEMBANGUNAN (PERLINSOS)'
                  : activeAccount.role === 'kasi_trantibum'
                  ? 'KASI TRANTIBUM (KETERTIBAN)'
                  : 'APLIKASI KEPALA LINGKUNGAN'}
              </span>
            </div>
            <p className="text-emerald-100/90 text-[11px] sm:text-xs uppercase tracking-wider font-semibold mt-0.5 truncate max-w-xl">
              {activeAccount.role === 'super_admin'
                ? 'MONITORING LAPORAN KEGIATAN HARIAN KEPALA LINGKUNGAN'
                : activeAccount.role === 'kasi_pemerintahan'
                ? 'DASHBOARD LAPORAN & MONITORING REALISASI OPSIR PBB 24 LINGKUNGAN'
                : activeAccount.role === 'kasi_pembangunan'
                ? 'DASHBOARD LAPORAN & CAPAIAN TARGET PERLINDUNGAN SOSIAL (PERLINSOS)'
                : activeAccount.role === 'kasi_trantibum'
                ? 'DASHBOARD KETENTRAMAN, KETERTIBAN UMUM, POSKAMLING & KEDISIPLINAN'
                : `PELAPORAN HARIAN ${activeAccount.lingkungan.toUpperCase() || 'KEPALA LINGKUNGAN'} • KELURAHAN MANGGA`}
            </p>
          </div>
        </div>

        {/* Header Actions Toolbar (Right) */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end w-auto">
          {onOpenAbsenApel && (
            <button
              id="btn-open-absen-apel-header"
              type="button"
              onClick={onOpenAbsenApel}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer shrink-0 border border-amber-300 hover:scale-[1.02] active:scale-[0.98]"
              title="Absen Apel Pagi Kepling Kelurahan Mangga"
            >
              <UserCheck className="w-4 h-4 text-slate-950 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-900/80 font-black leading-none">
                  PRESENSI
                </span>
                <span className="leading-tight whitespace-nowrap text-[11px] sm:text-xs">
                  Apel Pagi
                </span>
              </div>
            </button>
          )}

          {onOpenPPTModal && (
            <button
              id="btn-open-ppt-modal"
              type="button"
              onClick={onOpenPPTModal}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 border border-teal-500/50 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              title="Buka Slide Presentation & Download File PowerPoint (.pptx) Panduan Kepling"
            >
              <Presentation className="w-4 h-4 text-emerald-300 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-teal-200 font-black leading-none">
                  FILE PPT
                </span>
                <span className="leading-tight whitespace-nowrap">Panduan Kepling</span>
              </div>
            </button>
          )}

          {onOpenInstallModal && (
            <button
              id="btn-open-install-apk-modal"
              type="button"
              onClick={onOpenInstallModal}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-600/60 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              title="Pasang aplikasi SI-KEPLING MANGGA di HP Android / iOS"
            >
              <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-emerald-200 font-black leading-none">
                  APK ANDROID
                </span>
                <span className="leading-tight whitespace-nowrap">Pasang Aplikasi</span>
              </div>
            </button>
          )}

          {/* Unified User Account Profile Card & Quick Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-emerald-950/70 border border-emerald-600/60 shadow-md shrink-0">
            <button
              id="btn-open-account-modal-header"
              type="button"
              onClick={activeAccount.role === 'super_admin' ? onOpenAccountModal : onOpenUbahPassword}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg hover:bg-emerald-800/80 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer group text-left"
              title={activeAccount.role === 'super_admin' ? 'Klik untuk kelola akun atau lihat buku sandi' : 'Klik untuk ubah kata sandi profil'}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-emerald-700 text-emerald-100'
                }`}
              >
                {activeAccount.role === 'super_admin' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  activeAccount.nomorLingkungan || 'KL'
                )}
              </div>
              <div className="hidden sm:block min-w-0 max-w-[120px] sm:max-w-[150px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300 truncate leading-none">
                  {activeAccount.role === 'super_admin' ? 'SUPER ADMIN' : activeAccount.lingkungan}
                </div>
                <div className="text-xs font-bold text-white truncate leading-tight mt-0.5">
                  {activeAccount.nama}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-300 group-hover:text-white transition-transform shrink-0" />
            </button>

            {/* Desktop Quick Icon Buttons */}
            <div className="hidden md:flex items-center gap-1 border-l border-emerald-700/60 pl-1 pr-1">
              {onOpenEditProfile && (
                <button
                  id="btn-open-edit-profile"
                  type="button"
                  onClick={onOpenEditProfile}
                  className="p-1.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-600/50 text-emerald-200 hover:text-white transition-all cursor-pointer"
                  title="Edit Profil Pengguna"
                  aria-label="Edit Profil"
                >
                  <UserCircle className="w-4 h-4 text-emerald-300" />
                </button>
              )}

              {onOpenUbahPassword && (
                <button
                  id="btn-open-ubah-password"
                  type="button"
                  onClick={onOpenUbahPassword}
                  className="p-1.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-600/50 text-emerald-200 hover:text-white transition-all cursor-pointer"
                  title="Ubah Kata Sandi (Password)"
                  aria-label="Ubah Sandi"
                >
                  <KeyRound className="w-4 h-4 text-amber-300" />
                </button>
              )}

              {onLogout && (
                <button
                  id="btn-logout-app"
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-800 border border-red-500/50 text-red-200 hover:text-white transition-all cursor-pointer"
                  title="Keluar dari Sistem (Logout)"
                  aria-label="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile Overflow Menu Toggle Button */}
            <div className="md:hidden relative" ref={mobileMenuRef}>
              <button
                id="btn-mobile-header-menu"
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 rounded-lg hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors cursor-pointer"
                title="Menu Lainnya"
                aria-label="Menu Opsi Lainnya"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
              </button>

              {/* Mobile Dropdown Popover */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 text-left">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-[10px] font-black uppercase text-amber-400">
                      {activeAccount.role === 'super_admin' ? 'SUPER ADMIN' : activeAccount.lingkungan}
                    </p>
                    <p className="text-xs font-bold text-white truncate">{activeAccount.nama}</p>
                  </div>

                  {onOpenPPTModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenPPTModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Presentation className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Buku Panduan PPT</span>
                    </button>
                  )}

                  {onOpenInstallModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenInstallModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Pasang Aplikasi (APK)</span>
                    </button>
                  )}

                  {onOpenEditProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenEditProfile();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <UserCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Edit Profil Pengguna</span>
                    </button>
                  )}

                  {onOpenUbahPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenUbahPassword();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Ubah Kata Sandi</span>
                    </button>
                  )}

                  {onLogout && (
                    <div className="pt-1 mt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
