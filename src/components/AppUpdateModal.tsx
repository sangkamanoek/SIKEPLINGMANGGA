import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  History,
  Tag,
  Calendar,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  CURRENT_RELEASE_DATE,
  APP_VERSION_HISTORY,
  VersionRelease,
  reloadAppWithLatestVersion,
  markAppVersionAsSeen,
} from '../lib/appVersionService';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ isOpen, onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<VersionRelease>(APP_VERSION_HISTORY[0]);
  const [isReloading, setIsReloading] = useState(false);

  if (!isOpen) return null;

  const handleCloseAndAcknowledge = () => {
    markAppVersionAsSeen();
    onClose();
  };

  const handleReload = async () => {
    setIsReloading(true);
    await reloadAppWithLatestVersion();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Gradient & Glowing Badge */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-xs tracking-wider">
                    {CURRENT_APP_VERSION}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                    <Calendar className="w-3 h-3 text-emerald-400" />
                    {CURRENT_RELEASE_DATE}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
                  Pembaruan Aplikasi SiKepling
                </h2>
              </div>
            </div>

            <button
              onClick={handleCloseAndAcknowledge}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-emerald-100/80 mt-3 relative z-10 leading-relaxed font-normal">
            Aplikasi Kepling Kelurahan Mangga telah diperbarui secara otomatis. Berikut ringkasan fitur baru dan peningkatan sistem terkini:
          </p>
        </div>

        {/* Version Selector Tabs if multiple versions */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap mr-1">
            <History className="w-3.5 h-3.5" /> Riwayat Rilis:
          </span>
          {APP_VERSION_HISTORY.map((v) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(v)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedVersion.version === v.version
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Tag className="w-3 h-3" />
              {v.version}
              {v.badge && (
                <span className="px-1.5 py-0.2 rounded-sm bg-amber-400 text-slate-950 text-[9px] font-black">
                  {v.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Release Title */}
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{selectedVersion.title}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedVersion.highlights.map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Categorized Changes */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Rincian Perubahan &amp; Peningkatan
            </h4>

            <div className="space-y-2.5">
              {selectedVersion.changes.map((item, idx) => {
                let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                if (item.category === 'PERBAIKAN') {
                  badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
                } else if (item.category === 'PENINGKATAN') {
                  badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
                }

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex items-start gap-3"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider shrink-0 mt-0.5 ${badgeClass}`}
                    >
                      {item.category}
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Offline & Realtime Sync Information Note */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-800">
                Pembaruan Berjalan Otomatis &amp; Mendukung Mode Offline
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Seluruh data Anda yang tersimpan di perangkat akan tetap aman. Jika ada kendala tampilan setelah pembaruan, klik tombol <strong>"Segarkan &amp; Muat Ulang"</strong> di bawah ini.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isReloading ? 'Menyegarkan...' : 'Segarkan & Muat Ulang'}</span>
          </button>

          <button
            onClick={handleCloseAndAcknowledge}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <span>Saya Mengerti &amp; Lanjutkan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
