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
  Wifi,
  WifiOff,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { GoogleUser, SheetMetadata, UserAccount, isPkkRole } from '../types';
import { CURRENT_APP_VERSION, hasUnseenAppUpdate } from '../lib/appVersionService';

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
  onOpenUpdateModal?: () => void;
  portalMode?: 'kelurahan' | 'pkk';
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
  onOpenUpdateModal,
  portalMode,
}) => {
  const isPkk = isPkkRole(activeAccount.role) || portalMode === 'pkk';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [isHelperMenuOpen, setIsHelperMenuOpen] = useState(false);
  const helperMenuRef = useRef<HTMLDivElement | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    setHasNewUpdate(hasUnseenAppUpdate());
  }, []);

  useEffect(() => {
    let syncTimer: any;

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      // Trigger smooth 2.5s synchronization animation showing data transition to server
      syncTimer = setTimeout(() => {
        setIsSyncing(false);
      }, 2500);
    };

    const handleOffline = () => {
      if (syncTimer) clearTimeout(syncTimer);
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isBottom5Kepling, setIsBottom5Kepling] = useState<boolean>(false);

  useEffect(() => {
    const checkBottom5 = () => {
      try {
        const stored = localStorage.getItem('sikepling_bottom5_monthly_kepling_ids');
        if (stored && activeAccount.role === 'kepling') {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            setIsBottom5Kepling(list.includes(activeAccount.id));
          }
        } else {
          setIsBottom5Kepling(false);
        }
      } catch {}
    };
    checkBottom5();
    window.addEventListener('sikepling_bottom5_updated', checkBottom5);
    return () => window.removeEventListener('sikepling_bottom5_updated', checkBottom5);
  }, [activeAccount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (helperMenuRef.current && !helperMenuRef.current.contains(e.target as Node)) {
        setIsHelperMenuOpen(false);
      }
    };
    if (isMobileMenuOpen || isHelperMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen, isHelperMenuOpen]);
  return (
    <header className={`${isPkk ? 'bg-tosca-700' : 'bg-emerald-800'} text-white shadow-lg print:hidden transition-colors duration-500`}>
      {/* Top Banner with Medan Logo Replica and Tagline */}
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b ${isPkk ? 'border-tosca-600/60' : 'border-emerald-700/60'} text-xs`}>
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
          <span className={`hidden sm:inline-block text-xs font-semibold ${isPkk ? 'text-tosca-100/90' : 'text-emerald-100/90'} tracking-wide`}>
            #MedanUntukSemua • #SemuaUntukMedan
          </span>
        </div>

        {/* Indikator Status Resmi Aplikasi (Online/Offline Real-Time) */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSyncing ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-100 bg-amber-950/90 border border-amber-500/40 px-3 py-1 rounded-full shadow-md transition-all duration-300 transform scale-102">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>MENYINKRONKAN KE FIREBASE...</span>
            </span>
          ) : isOnline ? (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${isPkk ? 'text-tosca-100 bg-tosca-950/80 border-tosca-500/30' : 'text-emerald-100 bg-emerald-950/80 border-emerald-500/30'} px-3 py-1 rounded-full shadow-xs transition-all duration-300`}>
              <Wifi className={`w-3.5 h-3.5 ${isPkk ? 'text-tosca-400' : 'text-emerald-400'}`} />
              <span className={`w-2 h-2 rounded-full ${isPkk ? 'bg-tosca-400' : 'bg-emerald-400'} animate-pulse`} />
              <span>TERHUBUNG (ONLINE)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-100 bg-rose-950/90 border border-rose-500/40 px-3 py-1 rounded-full shadow-md animate-pulse transition-all duration-300">
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>OFFLINE (ANTREAN SINKRONISASI)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main App Title in Professional Polish layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
        {/* Brand & Identity (Left) */}
        <div className="flex items-center gap-3.5 sm:gap-4 shrink-0 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center p-1 shadow-md shrink-0 border border-white/20 overflow-hidden">
              <img
                src="/logo_pemko_medan.svg"
                alt="Logo Pemko Medan"
                className="w-full h-full object-contain scale-[1.05]"
              />
            </div>
            {isPkk && (
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center p-1 shadow-md shrink-0 border border-white/20 animate-fade-in overflow-hidden">
                <img
                  src="/logo_pkk.jpg"
                  alt="Logo PKK"
                  className="w-full h-full object-cover scale-[0.94] transform"
                />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md uppercase whitespace-nowrap">
                SI-MANGGA
              </h1>
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-sm border border-white/20 whitespace-nowrap ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-400 text-slate-950'
                    : activeAccount.role === 'kasi_pemerintahan'
                    ? 'bg-teal-400 text-teal-950'
                    : activeAccount.role === 'kasi_pembangunan'
                    ? 'bg-blue-400 text-blue-950'
                    : activeAccount.role === 'kasi_trantibum'
                    ? 'bg-orange-400 text-orange-950'
                    : activeAccount.role === 'ketua_pkk_kelurahan' ||
                      activeAccount.role === 'ketua_pokja' ||
                      activeAccount.role === 'ketua_pkk_lingkungan' ||
                      activeAccount.role === 'sekretaris_pkk'
                    ? 'bg-white text-tosca-800'
                    : isPkk ? 'bg-tosca-950 text-tosca-200 border border-tosca-600' : 'bg-emerald-950 text-emerald-200 border border-emerald-600'
                }`}
              >
                {activeAccount.role === 'super_admin'
                  ? 'PORTAL SUPER ADMIN'
                  : activeAccount.role === 'kasi_pemerintahan'
                  ? 'KASI TATA PEMERINTAHAN'
                  : activeAccount.role === 'kasi_pembangunan'
                  ? 'KASI PEMBANGUNAN'
                  : activeAccount.role === 'kasi_trantibum'
                  ? 'KASI TRANTIBUM'
                  : activeAccount.role === 'sekretaris_pkk'
                  ? 'SEKRETARIS TP-PKK'
                  : isPkk
                  ? 'PENGURUS TP-PKK KELURAHAN'
                  : 'KEPALA LINGKUNGAN'}
              </span>
            </div>
            <p className={`${isPkk ? 'text-tosca-100' : 'text-emerald-100'} text-[10px] sm:text-xs font-bold tracking-wider mt-1 leading-snug drop-shadow-xs uppercase`}>
              {activeAccount.role === 'super_admin'
                ? 'Sistem Informasi & Administrasi Kelurahan Mangga'
                : activeAccount.role === 'kasi_pemerintahan'
                ? 'Monitoring Realisasi Opsir PBB-P2 24 Lingkungan'
                : activeAccount.role === 'kasi_pembangunan'
                ? 'Monitoring Capaian Target Perlindungan Sosial (Perlinsos)'
                : activeAccount.role === 'kasi_trantibum'
                ? 'Monitoring Ketentraman, Ketertiban Umum & Poskamling'
                : activeAccount.role === 'ketua_pkk_kelurahan' ||
                  activeAccount.role === 'ketua_pokja' ||
                  activeAccount.role === 'ketua_pkk_lingkungan' ||
                  activeAccount.role === 'sekretaris_pkk'
                ? 'Portal Administrasi & Keuangan TP-PKK Kelurahan Mangga'
                : 'Sistem Informasi & Administrasi Kelurahan Mangga'}
            </p>
          </div>
        </div>

        {/* Header Actions Toolbar (Right) */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end w-auto">
          {onOpenAbsenApel &&
            activeAccount.role !== 'ketua_pkk_kelurahan' &&
            activeAccount.role !== 'ketua_pokja' &&
            activeAccount.role !== 'ketua_pkk_lingkungan' && (
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

          {/* Unified Help & Info Dropdown Menu Button */}
          {(onOpenUpdateModal || onOpenPPTModal || onOpenInstallModal) && (
            <div className="relative" ref={helperMenuRef}>
              <button
                type="button"
                onClick={() => setIsHelperMenuOpen(!isHelperMenuOpen)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-700/80 border border-emerald-500/40 text-emerald-100 font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                title="Pusat Bantuan, Info Rilis & Panduan Aplikasi"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Bantuan & Info</span>
                {hasNewUpdate && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />
              </button>

              {isHelperMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 text-left animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-[10px] font-black uppercase text-amber-400">Pusat Informasi & Panduan</p>
                    <p className="text-[11px] text-slate-300">Akses rilis, materi, & installer</p>
                  </div>

                  {onOpenUpdateModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHelperMenuOpen(false);
                        onOpenUpdateModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-amber-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>Info Rilis ({CURRENT_APP_VERSION})</span>
                      </div>
                      {hasNewUpdate && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </button>
                  )}

                  {onOpenPPTModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHelperMenuOpen(false);
                        onOpenPPTModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Presentation className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>Buku Panduan PPT</span>
                    </button>
                  )}

                  {onOpenInstallModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHelperMenuOpen(false);
                        onOpenInstallModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Pasang Aplikasi (APK)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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
              <div className="hidden sm:block min-w-0 max-w-[140px] sm:max-w-[180px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300 truncate leading-none flex items-center gap-1">
                  <span>{activeAccount.role === 'super_admin' ? 'SUPER ADMIN' : activeAccount.lingkungan}</span>
                  {isBottom5Kepling && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
                      🚨 TERBURUK
                    </span>
                  )}
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
                <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 text-left">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-[10px] font-black uppercase text-amber-400 flex items-center justify-between">
                      <span>{activeAccount.role === 'super_admin' ? 'SUPER ADMIN' : activeAccount.lingkungan}</span>
                      {isBottom5Kepling && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                          🚨 TERBURUK
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-bold text-white truncate">{activeAccount.nama}</p>
                    {isBottom5Kepling && (
                      <p className="text-[9px] text-red-300 font-bold mt-0.5">
                        🚨 Lencana: Kinerja Kepling Terburuk
                      </p>
                    )}
                  </div>

                  {onOpenUpdateModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenUpdateModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-amber-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>Pembaruan ({CURRENT_APP_VERSION})</span>
                      </div>
                      {hasNewUpdate && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </button>
                  )}

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
