import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ChevronDown, ChevronUp, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { NikDuplicateCheckResult, NopDuplicateCheckResult, KkDuplicateCheckResult, formatNopDisplay } from '../lib/duplicateCheckService';

interface DuplicateCheckBadgeProps {
  type: 'nik' | 'nop' | 'kk';
  result: NikDuplicateCheckResult | NopDuplicateCheckResult | KkDuplicateCheckResult;
  isChecking?: boolean;
  onViewDetail?: (record: any) => void;
  className?: string;
}

export const DuplicateCheckBadge: React.FC<DuplicateCheckBadgeProps> = ({
  type,
  result,
  isChecking = false,
  onViewDetail,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (result.severity === 'idle' && !isChecking) {
    return null;
  }

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Checking state spinner
  if (isChecking) {
    return (
      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold animate-pulse ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Memeriksa duplikasi data realtime...</span>
      </div>
    );
  }

  // Success state (Unique)
  if (result.severity === 'success') {
    return (
      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-lg ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="truncate">{result.message}</span>
      </div>
    );
  }

  // Info state
  if (result.severity === 'info') {
    return (
      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] text-sky-700 font-medium bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg ${className}`}>
        <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        <span className="truncate">{result.message}</span>
      </div>
    );
  }

  // Warning or Error state (Duplicates found)
  const isError = result.severity === 'error';
  const bgColor = isError ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900';
  const iconColor = isError ? 'text-rose-600' : 'text-amber-600';

  // Extract matches for detail dropdown
  let matchesCount = 0;
  let matchesList: any[] = [];
  if ('matches' in result && Array.isArray(result.matches)) {
    matchesCount = result.matches.length;
    matchesList = result.matches;
  } else if ('spptMatches' in result && 'kkMatches' in result) {
    matchesCount = (result.spptMatches?.length || 0) + (result.kkMatches?.length || 0);
    matchesList = [...(result.spptMatches || []), ...(result.kkMatches || [])];
  }

  return (
    <div className={`mt-1.5 rounded-xl border text-xs overflow-hidden transition-all duration-200 shadow-2xs ${bgColor} ${className}`}>
      {/* Header alert summary */}
      <div
        onClick={() => matchesCount > 0 && setIsExpanded(!isExpanded)}
        className={`px-3 py-2 flex items-start justify-between gap-2 ${matchesCount > 0 ? 'cursor-pointer hover:bg-black/5' : ''}`}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isError ? (
            <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
          ) : (
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-black text-[11px] flex items-center gap-1.5 flex-wrap">
              <span>{isError ? 'DUPLIKASI TERDETEKSI' : 'PERHATIAN DATA'}</span>
              {matchesCount > 1 && (
                <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-full text-[10px] font-mono font-bold">
                  {matchesCount} Rekor
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium leading-tight mt-0.5 opacity-90">{result.message}</p>
          </div>
        </div>

        {matchesCount > 0 && (
          <button
            type="button"
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 transition-colors shrink-0"
            title={isExpanded ? 'Sembunyikan detail' : 'Lihat detail duplikasi'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded Match Cards */}
      {isExpanded && matchesCount > 0 && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-black/5 bg-white/60">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Rincian Data yang Bertabrakan:
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {matchesList.map((item, idx) => {
              const isSppt = 'namaWp' in item;
              const title = isSppt ? item.namaWp : item.nama || item.namaKepalaKeluarga;
              const subtitle = isSppt
                ? `Lingkungan ${item.lingkungan} - ${item.alamatOp} (PBB: Rp ${(item.pbbTerutang || 0).toLocaleString('id-ID')})`
                : `${item.lingkunganNama || `Lingkungan ${item.lingkunganNomor}`} - ${item.namaJalan || item.alamatLengkap || '-'} (${item.role || 'Kepala Keluarga'})`;

              return (
                <div
                  key={idx}
                  className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <span>{title}</span>
                      {isSppt && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-bold">
                          SPPT {item.status || 'Belum Bayar'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{subtitle}</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(isSppt ? item.nop : item.nik || item.nomorKk, e)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Salin ID"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {onViewDetail && (
                      <button
                        type="button"
                        onClick={() => onViewDetail(item)}
                        className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-0.5 text-[10px] font-bold px-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Buka</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
