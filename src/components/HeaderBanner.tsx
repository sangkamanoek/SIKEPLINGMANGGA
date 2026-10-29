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
  RefreshCw,
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
  onOpenSyncVerification?: () => void;
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
  const isPkk = activeAccount ? isPkkRole(activeAccount.role) || portalMode === 'pkk' : portalMode === 'pkk';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [isHelperMenuOpen, setIsHelperMenuOpen] = useState(false);
  const helperMenuRef = useRef<HTMLDivElement | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_drive_root_folder_id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setRootFolderId(localStorage.getItem('google_drive_root_folder_id'));
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('google_drive_folder_sync', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('google_drive_folder_sync', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsIframe(window.self !== window.top);
    }
  }, []);

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
      {activeAccount.role === 'super_admin' && isIframe && !user && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-center text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-2 border-b border-amber-600/50 animate-pulse">
          <span className="flex items-center gap-1">⚠️ <span className="font-extrabold uppercase">Penting:</span> Browser memblokir popup Google di panel preview. Buka di tab baru untuk menghubungkan Google.</span>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-950 hover:bg-slate-900 text-white font-extrabold px-3 py-1 rounded-lg text-[11px] shadow-md hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1 whitespace-nowrap"
          >
            Buka di Tab Baru ↗
          </a>
        </div>
      )}
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
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-200 bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 rounded">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Sinkronisasi Cloud...</span>
            </span>
          ) : isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Terhubung (Online)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-200 bg-rose-950/70 border border-rose-500/40 px-2.5 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Offline (Tersimpan Lokal)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main App Title in Professional Polish layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
        {/* Brand & Identity (Left) */}
        <div className="flex items-center gap-3.5 sm:gap-4 shrink-0 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xs shrink-0 border border-white/20 overflow-hidden">
              <img
                src="/logo_pemko_medan.svg"
                alt="Logo Pemko Medan"
                className="w-full h-full object-contain"
              />
            </div>
            {isPkk && (
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xs shrink-0 border border-white/20 overflow-hidden">
                <img
                  src="/logo_pkk.jpg"
                  alt="Logo PKK"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase whitespace-nowrap">
                SI-MANGGA
              </h1>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${
                  activeAccount.role === 'super_admin'
                    ? 'bg-amber-400/90 text-slate-950 border-amber-300'
                    : activeAccount.role === 'kasi_pemerintahan'
                    ? 'bg-teal-500/20 text-teal-200 border-teal-500/40'
                    : activeAccount.role === 'kasi_pembangunan'
                    ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
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
        <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0">
          {onOpenAbsenApel && !isPkkRole(activeAccount.role) && (
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

          {/* Google Connection Status Button */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-100 font-bold text-xs shadow-xs">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.235 15.423 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.977 0-.746-.08-1.32-.176-1.742l-10.617-.478z"/>
                </svg>
                <div className="flex flex-col text-left">
                  <span className="text-[8px] uppercase tracking-wider text-emerald-400 leading-none font-extrabold">GOOGLE TERHUBUNG</span>
                  <span className="text-[10px] text-white truncate max-w-[100px] font-bold" title={user.email || ''}>{user.displayName || user.email}</span>
                </div>
                {rootFolderId ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${rootFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-1.5 py-0.5 rounded bg-emerald-800/80 hover:bg-emerald-700 hover:text-white text-[9px] text-emerald-200 font-extrabold transition-colors whitespace-nowrap"
                    title="Buka folder SI_MANGGA_DATA_CENTER di Google Drive"
                  >
                    📂 Folder Drive
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('google_drive_trigger_resync'));
                    }}
                    className="px-1.5 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 hover:text-white text-[9px] text-amber-200 font-extrabold transition-colors whitespace-nowrap cursor-pointer"
                    title="Buat / sinkronkan folder SI_MANGGA_DATA_CENTER sekarang"
                  >
                    🔄 Buat Folder
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDisconnectGoogle}
                  className="ml-1 px-1.5 py-0.5 rounded bg-red-950/40 hover:bg-red-900/60 text-[9px] text-red-300 hover:text-red-100 font-extrabold transition-colors cursor-pointer"
                  title="Putuskan Hubungan Google"
                >
                  Putuskan
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogle}
                disabled={isConnecting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                title="Hubungkan ke Google Sheets & Calendar"
              >
                {isConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.235 15.423 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.977 0-.746-.08-1.32-.176-1.742l-10.617-.478z"/>
                  </svg>
                )}
                <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Google'}</span>
              </button>
            )}
          </div>

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

                  {onOpenSyncVerification && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHelperMenuOpen(false);
                        onOpenSyncVerification();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Verifikasi & Cek Data Cloud</span>
                    </button>
                  )}

                  {/* New Sync Metadata Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsHelperMenuOpen(false);
                      window.location.reload(); // Force app refresh to re-sync everything
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sinkronisasi Ulang Google</span>
                  </button>

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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer border border-red-500 shadow-xs"
                  title="Keluar dari Sistem (Logout)"
                  aria-label="Keluar dari Sistem"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Keluar</span>
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

                  {/* Google Connection Status on Mobile */}
                  <div className="px-3 py-2 border-b border-slate-800 mb-1.5 bg-slate-950/40 rounded-xl">
                    <p className="text-[9px] font-black uppercase text-slate-400">Status Google</p>
                    {user ? (
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <span className="text-[11px] text-emerald-400 font-bold truncate max-w-[100px]" title={user.email || ''}>{user.displayName || user.email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            onDisconnectGoogle();
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                        >
                          Putuskan
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onConnectGoogle();
                        }}
                        disabled={isConnecting}
                        className="w-full mt-1.5 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.235 15.423 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.977 0-.746-.08-1.32-.176-1.742l-10.617-.478z"/>
                        </svg>
                        <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Google'}</span>
                      </button>
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
