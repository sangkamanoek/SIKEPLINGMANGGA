import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X, RefreshCw, Zap } from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  hasUnseenAppUpdate,
  isUpdateBannerDismissed,
  dismissUpdateBanner,
  reloadAppWithLatestVersion,
} from '../lib/appVersionService';

interface AppUpdateToastBannerProps {
  onOpenDetails: () => void;
}

export const AppUpdateToastBanner: React.FC<AppUpdateToastBannerProps> = ({ onOpenDetails }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Show banner if there's an unseen update and not dismissed
    if (hasUnseenAppUpdate() && !isUpdateBannerDismissed()) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    dismissUpdateBanner();
    setIsVisible(false);
  };

  const handleReload = async () => {
    setIsReloading(true);
    await reloadAppWithLatestVersion();
  };

  return (
    <aside
      aria-label="Notifikasi Pembaruan Aplikasi"
      className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 max-w-md w-[calc(100%-1.5rem)] sm:w-auto bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-emerald-500/40 animate-slide-up transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.2 rounded-full font-mono">
              UPDATE {CURRENT_APP_VERSION}
            </span>
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Fitur Baru Tersedia
            </span>
          </div>

          <p className="text-xs font-bold text-white mt-1 leading-snug">
            Pembaruan SI-MANGGA: Opsi Perlinsos Menolak &amp; Perbaikan Spasial WebGIS
          </p>

          <p className="text-[11px] text-slate-300 mt-0.5 font-normal line-clamp-1">
            Klik untuk melihat catatan rilis lengkap dan optimasi sistem.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={onOpenDetails}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all shadow-xs"
            >
              <span>Lihat Apa yang Baru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleReload}
              disabled={isReloading}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
              title="Segarkan & Muat Ulang"
            >
              <RefreshCw className={`w-3 h-3 ${isReloading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors shrink-0"
          title="Tutup Notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
