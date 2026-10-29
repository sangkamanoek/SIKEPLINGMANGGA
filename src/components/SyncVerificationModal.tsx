import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Calendar,
  MapPin,
  ArrowRightLeft,
} from 'lucide-react';
import { LaporanHarianItem, UserAccount } from '../types';
import { compareLocalVsServerReports, ReportDiffResult, saveReportToServer } from '../lib/reportsApi';

interface SyncVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  localReports: LaporanHarianItem[];
  currentUser: UserAccount;
  onSyncComplete: (updatedReports: LaporanHarianItem[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SyncVerificationModal: React.FC<SyncVerificationModalProps> = ({
  isOpen,
  onClose,
  localReports,
  currentUser,
  onSyncComplete,
  showToast,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diffResult, setDiffResult] = useState<ReportDiffResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'localOnly' | 'serverOnly' | 'conflicted'>('all');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const runVerification = async () => {
    setIsLoading(true);
    try {
      const res = await compareLocalVsServerReports(localReports);
      setDiffResult(res);
      showToast('Pemeriksaan sinkronisasi data selesai!', 'success');
    } catch (err) {
      showToast('Gagal memeriksa data server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runVerification();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePushAllLocal = async () => {
    if (!diffResult) return;
    setIsProcessing(true);
    try {
      let count = 0;
      for (const item of diffResult.localOnly) {
        const ok = await saveReportToServer(item);
        if (ok) count++;
      }
      showToast(`Berhasil menyinkronkan ${count} laporan lokal ke server!`, 'success');
      await runVerification();
      const fresh = await compareLocalVsServerReports(localReports);
      const mergedMap = new Map<string, LaporanHarianItem>();
      localReports.forEach(r => mergedMap.set(r.id, r));
      fresh.serverOnly.forEach(r => mergedMap.set(r.id, r));
      onSyncComplete(Array.from(mergedMap.values()));
    } catch (e) {
      showToast('Gagal mengirim data lokal ke server.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePullAllServer = async () => {
    if (!diffResult) return;
    setIsProcessing(true);
    try {
      const mergedMap = new Map<string, LaporanHarianItem>();
      localReports.forEach(r => mergedMap.set(r.id, r));
      diffResult.serverOnly.forEach(r => mergedMap.set(r.id, r));
      const updated = Array.from(mergedMap.values());
      onSyncComplete(updated);
      showToast('Berhasil menarik data server ke perangkat lokal!', 'success');
      await runVerification();
    } catch (e) {
      showToast('Gagal menarik data dari server.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalIssues = (diffResult?.localOnly.length || 0) + (diffResult?.serverOnly.length || 0) + (diffResult?.conflicted.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-tosca-500/20 border border-tosca-400/30 flex items-center justify-center text-tosca-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide">VERIFIKASI & SINKRONISASI DATA LAPORAN</h2>
              <p className="text-xs text-slate-400">Bandingkan status penyimpanan Lokal (LocalStorage) dengan Server Cloud (Firestore)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runVerification}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-tosca-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Memeriksa...' : 'Periksa Ulang Data'}</span>
            </button>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Status: {totalIssues === 0 ? '✨ Semua Data Sinkron' : `⚠️ Ditemukan ${totalIssues} Perbedaan`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {diffResult && diffResult.localOnly.length > 0 && (
              <button
                type="button"
                onClick={handlePushAllLocal}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-tosca-700/20 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Kirim Semua Lokal ke Server ({diffResult.localOnly.length})</span>
              </button>
            )}
            {diffResult && diffResult.serverOnly.length > 0 && (
              <button
                type="button"
                onClick={handlePullAllServer}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tarik Server ke Lokal ({diffResult.serverOnly.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs Filter */}
        {diffResult && (
          <div className="flex border-b border-slate-200 px-6 bg-white shrink-0 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`py-3 px-4 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'all' ? 'border-tosca-600 text-tosca-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({ (diffResult.localOnly.length + diffResult.serverOnly.length + diffResult.synced.length + diffResult.conflicted.length) })
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('localOnly')}
              className={`py-3 px-4 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'localOnly' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Hanya di Lokal</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {diffResult.localOnly.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('serverOnly')}
              className={`py-3 px-4 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'serverOnly' ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Hanya di Server</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                {diffResult.serverOnly.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('conflicted')}
              className={`py-3 px-4 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'conflicted' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Konflik Data</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                {diffResult.conflicted.length}
              </span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-tosca-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Sedang membandingkan data perangkat lokal dengan server cloud...</p>
            </div>
          ) : !diffResult ? (
            <div className="py-20 text-center text-slate-400 text-xs">Tekan "Periksa Ulang Data" untuk memulai verifikasi.</div>
          ) : totalIssues === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-emerald-200 p-8 shadow-2xs">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Semua Data Telah Sinkron!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ada perbedaan antara catatan laporan di perangkat lokal dan database server cloud.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'all' && (
                <>
                  {diffResult.localOnly.map((item) => (
                    <ReportDiffCard key={item.id} item={item} status="localOnly" onSync={runVerification} showToast={showToast} />
                  ))}
                  {diffResult.serverOnly.map((item) => (
                    <ReportDiffCard key={item.id} item={item} status="serverOnly" onSync={runVerification} showToast={showToast} />
                  ))}
                  {diffResult.conflicted.map((c) => (
                    <ReportConflictCard key={c.local.id} conflict={c} onSync={runVerification} showToast={showToast} />
                  ))}
                </>
              )}

              {activeTab === 'localOnly' && (
                diffResult.localOnly.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Tidak ada laporan yang hanya ada di lokal.</p>
                ) : (
                  diffResult.localOnly.map((item) => (
                    <ReportDiffCard key={item.id} item={item} status="localOnly" onSync={runVerification} showToast={showToast} />
                  ))
                )
              )}

              {activeTab === 'serverOnly' && (
                diffResult.serverOnly.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Tidak ada laporan yang hanya ada di server.</p>
                ) : (
                  diffResult.serverOnly.map((item) => (
                    <ReportDiffCard key={item.id} item={item} status="serverOnly" onSync={runVerification} showToast={showToast} />
                  ))
                )
              )}

              {activeTab === 'conflicted' && (
                diffResult.conflicted.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Tidak ada konflik data.</p>
                ) : (
                  diffResult.conflicted.map((c) => (
                    <ReportConflictCard key={c.local.id} conflict={c} onSync={runVerification} showToast={showToast} />
                  ))
                )
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium">
            💡 Verifikasi rutin membantu mencegah selisih rekapitulasi capaian kinerja Kepling.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-md"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

interface ReportDiffCardProps {
  item: LaporanHarianItem;
  status: 'localOnly' | 'serverOnly';
  onSync: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ReportDiffCard: React.FC<ReportDiffCardProps> = ({ item, status, onSync, showToast }) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (status === 'localOnly') {
        const ok = await saveReportToServer(item);
        if (ok) {
          showToast(`Laporan ${item.nomorLaporan || item.id} berhasil dikirim ke server!`, 'success');
          onSync();
        } else {
          showToast('Gagal mengirim laporan ke server.', 'error');
        }
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat menyinkronkan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-4 rounded-2xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
      status === 'localOnly' ? 'border-amber-300 bg-amber-50/30' : 'border-blue-300 bg-blue-50/30'
    }`}>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
            status === 'localOnly' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'
          }`}>
            {status === 'localOnly' ? 'Belum Terkirim ke Server (Lokal Saja)' : 'Baru di Server (Belum di Perangkat Ini)'}
          </span>
          <span className="text-xs font-bold text-slate-900">{item.jabatan || item.namaKepling}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {item.tanggal}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {item.kelurahan || 'Kelurahan Mangga'}</span>
          <span className="font-mono text-[11px] text-slate-400">ID: {item.id}</span>
        </div>
        <p className="text-xs text-slate-700 line-clamp-1 bg-white p-2 rounded-lg border border-slate-200 mt-1">
          {item.kegiatanLainnya || item.kinerja?.kegiatanLainnya || 'Laporan Harian Kepling'}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {status === 'localOnly' && (
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{loading ? 'Mengirim...' : 'Kirim ke Server'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface ReportConflictCardProps {
  conflict: { local: LaporanHarianItem; server: LaporanHarianItem };
  onSync: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ReportConflictCard: React.FC<ReportConflictCardProps> = ({ conflict, onSync, showToast }) => {
  const [loading, setLoading] = useState(false);

  const handleResolve = async (useLocal: boolean) => {
    setLoading(true);
    try {
      const target = useLocal ? conflict.local : conflict.server;
      const ok = await saveReportToServer(target);
      if (ok) {
        showToast('Konflik data berhasil diselesaikan!', 'success');
        onSync();
      } else {
        showToast('Gagal menyelesaikan konflik.', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50/30 flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
          ⚠️ Konflik Data (Versi Lokal vs Versi Server Berbeda)
        </span>
        <span className="text-xs font-bold text-slate-700">ID: {conflict.local.id}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase">Versi Di Perangkat Lokal</span>
          <p className="text-xs font-bold text-slate-900">{conflict.local.namaKepling} ({conflict.local.tanggal})</p>
          <p className="text-[11px] text-slate-600 line-clamp-2">{conflict.local.kegiatanLainnya || 'Catatan lokal'}</p>
          <button
            type="button"
            onClick={() => handleResolve(true)}
            disabled={loading}
            className="mt-2 w-full py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer"
          >
            Gunakan Versi Lokal (Timpa Server)
          </button>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold text-blue-700 uppercase">Versi Di Server Cloud</span>
          <p className="text-xs font-bold text-slate-900">{conflict.server.namaKepling} ({conflict.server.tanggal})</p>
          <p className="text-[11px] text-slate-600 line-clamp-2">{conflict.server.kegiatanLainnya || 'Catatan server'}</p>
          <button
            type="button"
            onClick={() => handleResolve(false)}
            disabled={loading}
            className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer"
          >
            Gunakan Versi Server (Timpa Lokal)
          </button>
        </div>
      </div>
    </div>
  );
};
