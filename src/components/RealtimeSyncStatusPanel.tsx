import React, { useState, useEffect } from 'react';
import {
  Database,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Cloud,
  ShieldCheck,
  Activity,
  Zap,
} from 'lucide-react';

interface RealtimeSyncStatusPanelProps {
  isFirebaseSyncing?: boolean;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  spreadsheetTitle?: string | null;
  onForceSyncAll?: () => Promise<void> | void;
  compact?: boolean;
}

export const RealtimeSyncStatusPanel: React.FC<RealtimeSyncStatusPanelProps> = ({
  isFirebaseSyncing = false,
  isGoogleConnected = false,
  googleUserEmail,
  spreadsheetTitle,
  onForceSyncAll,
  compact = false,
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSyncClick = async () => {
    setIsManualSyncing(true);
    try {
      if (onForceSyncAll) {
        await onForceSyncAll();
      }
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('Manual sync error:', err);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSyncActive = isFirebaseSyncing || isManualSyncing;

  return (
    <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Section Title & Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className={`w-3 h-3 rounded-full ${
              !isOnline
                ? 'bg-rose-500'
                : isSyncActive
                ? 'bg-amber-400 animate-ping'
                : 'bg-emerald-400 animate-pulse'
            }`} />
            <div className={`absolute w-3 h-3 rounded-full ${
              !isOnline
                ? 'bg-rose-500'
                : isSyncActive
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Status Sinkronisasi Real-Time</span>
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                !isOnline
                  ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                  : isSyncActive
                  ? 'bg-amber-950 text-amber-300 border border-amber-600/60 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
              }`}>
                {!isOnline ? 'Offline' : isSyncActive ? 'Sedang Sinkronisasi...' : 'Terhubung & Aktif'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Sinkronisasi data otomatis multi-layer • Terakhir diperbarui: <span className="text-slate-200 font-bold">{lastSyncTime} WIB</span>
            </p>
          </div>
        </div>

        {/* Middle: Service Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 md:py-0 border-t md:border-t-0 border-slate-800">
          {/* Service 1: Firebase Firestore */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 transition-all hover:border-slate-700">
            <div className={`p-2 rounded-lg shrink-0 ${isSyncActive ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-400 animate-pulse' : 'bg-amber-500/10 text-amber-400'}`}>
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSyncActive ? 'bg-amber-400 animate-ping' : isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="text-xs font-black text-slate-100 truncate">Firebase Firestore</span>
              </div>
              <span className={`text-[10px] font-bold block truncate ${isSyncActive ? 'text-amber-300 animate-pulse' : isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isSyncActive ? 'Sedang Sinkron...' : isOnline ? '🟢 Cloud DB Aktif' : '🔴 Terputus'}
              </span>
            </div>
          </div>

          {/* Service 2: Google Sheets */}
          <button
            type="button"
            onClick={() => {
              if (isGoogleConnected) {
                window.open('https://docs.google.com/spreadsheets/u/0/', '_blank');
              } else {
                window.dispatchEvent(new CustomEvent('google_auth_trigger_connect'));
              }
            }}
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 transition-all hover:border-emerald-500/50 cursor-pointer text-left w-full"
            title={isGoogleConnected ? 'Buka Google Sheets di tab baru' : 'Klik untuk Hubungkan Akun Google'}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isGoogleConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-black text-slate-100 truncate">Google Sheets</span>
              </div>
              <span className={`text-[10px] font-bold block truncate ${isGoogleConnected ? 'text-emerald-400' : 'text-amber-400 underline'}`}>
                {isGoogleConnected ? `🟢 ${spreadsheetTitle || 'Terhubung'}` : '🔗 Klik untuk Hubungkan'}
              </span>
            </div>
          </button>

          {/* Service 3: IndexedDB & Local Cache */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 transition-all hover:border-slate-700">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-black text-slate-100 truncate">IndexedDB</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold block truncate">
                🟢 0ms Offline Cache Aktif
              </span>
            </div>
          </div>
        </div>

        {/* Right: Force Sync Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={isSyncActive}
            className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
              isSyncActive
                ? 'bg-blue-950 text-blue-300 border border-blue-700/60 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/40 hover:scale-[1.02]'
            }`}
            title="Muat ulang dan sinkronkan seluruh data secara real-time dari server & database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncActive ? 'animate-spin text-blue-300' : 'text-white'}`} />
            <span>{isSyncActive ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
