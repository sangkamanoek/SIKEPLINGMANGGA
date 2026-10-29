import React, { useState } from 'react';
import { Cloud, DownloadCloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { pullAllDataFromFirestore } from '../lib/globalSyncService';

export interface RealtimeSyncStatusPanelProps {
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  spreadsheetTitle?: string | null;
  onForceSyncAll?: () => void | Promise<void>;
  [key: string]: any;
}

export const RealtimeSyncStatusPanel: React.FC<RealtimeSyncStatusPanelProps> = () => {
  const [isPulling, setIsPulling] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handlePullCloud = async () => {
    if (!window.confirm('Ambil seluruh data dari Cloud Firestore? Data lokal Anda akan diperbarui dengan data terbaru dari server.')) return;
    
    setIsPulling(true);
    setStatus('idle');
    try {
      const res = await pullAllDataFromFirestore((msg) => setProgressMsg(msg));
      if (res.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setIsPulling(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${status === 'success' ? 'bg-emerald-100 text-emerald-600' : status === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-tosca-100 text-tosca-600'}`}>
          {isPulling ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : status === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Cloud className="w-5 h-5" />
          )}
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Sinkronisasi Cloud</h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase">
            {isPulling ? progressMsg : status === 'success' ? 'Sinkronisasi Berhasil' : status === 'error' ? 'Sinkronisasi Gagal' : 'Terhubung dengan Firestore Realtime'}
          </p>
        </div>
      </div>

      <button
        onClick={handlePullCloud}
        disabled={isPulling}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <DownloadCloud className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
        <span>{isPulling ? 'Sedang Menarik...' : 'Tarik Data dari Cloud'}</span>
      </button>
    </div>
  );
};
