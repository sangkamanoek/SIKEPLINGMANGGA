import React from 'react';
import {
  Bell,
  Calendar,
  ClipboardList,
  Volume2,
  Smartphone,
  X,
  ArrowRight,
  Radio,
  CheckCircle,
} from 'lucide-react';
import { AlertNotificationItem } from '../hooks/useAgendaTugasRealtimeAlert';

interface KeplingAlertBannerProps {
  alert: AlertNotificationItem | null;
  onDismiss: () => void;
  onNavigateTab: (tab: any) => void;
  onReplayAlertSound: () => void;
}

export const KeplingAlertBanner: React.FC<KeplingAlertBannerProps> = ({
  alert,
  onDismiss,
  onNavigateTab,
  onReplayAlertSound,
}) => {
  if (!alert) return null;

  const isTugas = alert.type === 'tugas';

  return (
    <aside
      aria-label="Notifikasi Tugas dan Agenda Kelurahan"
      className="fixed top-4 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-xl z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl p-4 sm:p-5 shadow-2xl border-2 backdrop-blur-md transition-all ${
          isTugas
            ? 'bg-amber-500/95 text-slate-950 border-amber-400 shadow-amber-500/30 ring-4 ring-amber-400/20'
            : 'bg-emerald-600/95 text-white border-emerald-400 shadow-emerald-600/30 ring-4 ring-emerald-500/20'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left Icon with pulsating sound wave indicator */}
          <div className="relative shrink-0 mt-0.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${
                isTugas ? 'bg-slate-950 text-amber-300' : 'bg-white text-emerald-700'
              }`}
            >
              {isTugas ? (
                <ClipboardList className="w-6 h-6 animate-pulse" />
              ) : (
                <Calendar className="w-6 h-6 animate-pulse" />
              )}
            </div>
            {/* Audio wave pulse badge */}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 items-center justify-center">
                <Volume2 className="w-2.5 h-2.5 text-white" />
              </span>
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isTugas
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-white/20 text-white backdrop-blur-xs'
                }`}
              >
                <Radio className="w-3 h-3 animate-spin text-rose-400" />
                {alert.title}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isTugas ? 'bg-amber-600/30 text-slate-900' : 'bg-emerald-700/50 text-emerald-100'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Bunyi &amp; Getar HP</span>
              </span>
              <span className="text-[10px] opacity-75 font-mono ml-auto">
                {alert.timestamp}
              </span>
            </div>

            <h4
              className={`text-sm sm:text-base font-extrabold line-clamp-2 leading-tight ${
                isTugas ? 'text-slate-950' : 'text-white'
              }`}
            >
              {alert.subTitle}
            </h4>

            {alert.detail && (
              <p
                className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                  isTugas ? 'text-slate-900 font-medium' : 'text-emerald-50'
                }`}
              >
                {alert.detail}
              </p>
            )}

            {/* Quick Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  onNavigateTab(isTugas ? 'daftar_tugas_khusus' : 'agenda');
                  onDismiss();
                }}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                  isTugas
                    ? 'bg-slate-950 hover:bg-slate-900 text-amber-300'
                    : 'bg-white hover:bg-slate-100 text-emerald-800'
                }`}
              >
                <span>{isTugas ? 'Buka Tugas Khusus' : 'Buka Agenda'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onReplayAlertSound}
                title="Bunyikan & Getarkan Lagi"
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all ${
                  isTugas
                    ? 'bg-amber-600/30 hover:bg-amber-600/50 text-slate-950'
                    : 'bg-emerald-700/40 hover:bg-emerald-700/60 text-white'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ulangi Bunyi &amp; Getar</span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className={`ml-auto px-2 py-1.5 rounded-lg text-xs font-semibold opacity-75 hover:opacity-100 transition-all ${
                  isTugas ? 'text-slate-900' : 'text-white'
                }`}
              >
                Mengerti
              </button>
            </div>
          </div>

          {/* Close X Button */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup notifikasi"
            className={`p-1 rounded-lg shrink-0 transition-colors ${
              isTugas
                ? 'hover:bg-slate-950/10 text-slate-800'
                : 'hover:bg-white/20 text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
