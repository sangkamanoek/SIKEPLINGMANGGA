import React, { useState } from 'react';
import {
  Copy,
  Check,
  Share2,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Users,
  Building2,
  Coins,
  ChevronRight,
  TrendingUp,
  X,
  Eye,
} from 'lucide-react';
import { KelurahanPbbOverview, formatRekapPbbWaText } from '../lib/pbbService';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface RekapCapaianPbb24LingkunganProps {
  overview: KelurahanPbbOverview;
  selectedYear: number;
  onSelectLingkungan?: (lingkunganNum: number) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  defaultViewMode?: 'grid' | 'table';
  isCompact?: boolean;
}

export const RekapCapaianPbb24Lingkungan: React.FC<RekapCapaianPbb24LingkunganProps> = ({
  overview,
  selectedYear,
  onSelectLingkungan,
  onShowToast,
  defaultViewMode = 'grid',
  isCompact = false,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(defaultViewMode);
  const [copiedWa, setCopiedWa] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Generate WA formatted text
  const waText = React.useMemo(() => {
    return formatRekapPbbWaText(overview, selectedYear);
  }, [overview, selectedYear]);

  // Handler Salin WA
  const handleCopyWa = () => {
    try {
      navigator.clipboard.writeText(waText);
      setCopiedWa(true);
      if (onShowToast) {
        onShowToast('Teks Rekap Capaian PBB 24 Lingkungan berhasil disalin! Siap dibagikan ke grup WhatsApp.', 'success');
      }
      setTimeout(() => setCopiedWa(false), 3000);
    } catch (err) {
      console.error(err);
      if (onShowToast) {
        onShowToast('Gagal menyalin teks ke clipboard.', 'error');
      }
    }
  };

  // Open WhatsApp directly with text
  const handleShareToWhatsApp = () => {
    try {
      const encoded = encodeURIComponent(waText);
      const url = `https://api.whatsapp.com/send?text=${encoded}`;
      window.open(url, '_blank');
    } catch {
      handleCopyWa();
    }
  };

  // 24 Lingkungan sorted strictly 1 to 24
  const sortedLingkungan = React.useMemo(() => {
    return [...overview.lingkunganSummaries].sort((a, b) => a.lingkungan - b.lingkungan);
  }, [overview.lingkunganSummaries]);

  // Format currency helpers
  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
  };

  const formatCompactRp = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)} Rb`;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  // Stats calculation
  const highCount = sortedLingkungan.filter((i) => i.persentaseWpLunas >= 80).length;
  const mediumCount = sortedLingkungan.filter((i) => i.persentaseWpLunas >= 50 && i.persentaseWpLunas < 80).length;
  const lowCount = sortedLingkungan.filter((i) => i.persentaseWpLunas > 0 && i.persentaseWpLunas < 50).length;
  const zeroCount = sortedLingkungan.filter((i) => i.persentaseWpLunas === 0).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
      {/* Header Panel */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-emerald-50/20 to-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Rekap Resmi 24 Lingkungan
              </span>
              <span className="text-xs text-slate-500 font-semibold">Tahun Pajak {selectedYear}</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>Rekap Total Capaian Kepatuhan PBB 24 Lingkungan</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Persentase Kepatuhan Wajib Pajak (<strong className="text-slate-700">WP Lunas / Total Target WP</strong>) diurutkan nomor Lingkungan 1 sampai dengan 24 untuk pelaporan berkala pimpinan.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl border border-slate-300/50 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan dalam kartu grid visual"
              >
                Grid Kartu (24 LK)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan dalam tabel berurutan"
              >
                Tabel Ringkas
              </button>
            </div>

            {/* Tombol Pratinjau Teks WA */}
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold border border-slate-300/70 transition-all cursor-pointer"
              title="Lihat teks format WhatsApp sebelum dikirim"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Pratinjau WA</span>
            </button>

            {/* Tombol Salin Rekap PBB WA */}
            <button
              type="button"
              onClick={handleCopyWa}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer ${
                copiedWa
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 scale-102'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
              }`}
              title="Salin rekapitulasi capaian persentase PBB 24 Lingkungan ke format WhatsApp"
            >
              {copiedWa ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-emerald-200" />}
              <span>{copiedWa ? 'Tersalin!' : 'Salin Rekap PBB WA'}</span>
            </button>
          </div>
        </div>

        {/* Ringkasan Singkat Tingkat Kelurahan */}
        <div className="mt-4 pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>
                Total Kepatuhan WP:{' '}
                <strong className="text-slate-900 font-bold">
                  {overview.totalWpLunas.toLocaleString('id-ID')} / {overview.totalWp.toLocaleString('id-ID')} WP
                </strong>{' '}
                (<strong className="text-emerald-700 font-black">{overview.persentaseWpLunas.toFixed(1)}%</strong> Lunas)
              </span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>
                Realisasi Uang:{' '}
                <strong className="text-slate-900 font-bold">{formatCompactRp(overview.totalRealisasiNominal)}</strong>{' '}
                ({overview.persentaseRealisasiNominal.toFixed(1)}%)
              </span>
            </span>
          </div>

          {/* Kategori Distribusi Kepatuhan Lingkungan */}
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>≥80%: {highCount} LK</span>
            </span>
            <span className="inline-flex items-center gap-1 text-teal-700">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              <span>50-79%: {mediumCount} LK</span>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>&lt;50%: {lowCount} LK</span>
            </span>
            {zeroCount > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span>0%: {zeroCount} LK</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5">
        {viewMode === 'grid' ? (
          /* ==================================================== */
          /* GRID VIEW: 24 Cards, 1 to 24 */
          /* ==================================================== */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sortedLingkungan.map((item) => {
              const lkAccount = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === item.lingkungan);
              const namaKepling = lkAccount?.nama || 'Kepala Lingkungan';
              const pct = item.persentaseWpLunas;
              const isHigh = pct >= 75;
              const isMedium = pct >= 50 && pct < 75;
              const isLow = pct > 0 && pct < 50;

              return (
                <div
                  key={`rekap_grid_lk_${item.lingkungan}`}
                  onClick={() => onSelectLingkungan?.(item.lingkungan)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer group hover:shadow-md hover:-translate-y-0.5 ${
                    isHigh
                      ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/90'
                      : isMedium
                      ? 'bg-amber-50/40 hover:bg-amber-50 border-amber-200/80'
                      : isLow
                      ? 'bg-rose-50/60 hover:bg-rose-50 border-rose-200/90'
                      : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200'
                  }`}
                  title={`Klik untuk melihat detail SPPT Lingkungan ${item.lingkungan}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800 group-hover:text-emerald-800 transition-colors">
                      Lingkungan {item.lingkungan}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isHigh
                          ? 'bg-emerald-500'
                          : isMedium
                          ? 'bg-amber-500'
                          : isLow
                          ? 'bg-rose-500'
                          : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium" title={namaKepling}>
                    {namaKepling}
                  </p>

                  {/* Main Metric: Persentase Kepatuhan WP */}
                  <div className="mt-2 flex items-baseline justify-between">
                    <div
                      className={`text-lg sm:text-xl font-black ${
                        isHigh
                          ? 'text-emerald-700'
                          : isMedium
                          ? 'text-amber-700'
                          : isLow
                          ? 'text-rose-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {pct.toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">WP Lunas</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isHigh
                          ? 'bg-emerald-600'
                          : isMedium
                          ? 'bg-amber-500'
                          : isLow
                          ? 'bg-rose-500'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  {/* WP Count Ratio */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
                    <span>
                      {item.wpLunas} / {item.totalWp} WP
                    </span>
                    <span className="text-slate-500 font-normal">
                      {formatCompactRp(item.realisasiNominal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ==================================================== */
          /* TABLE VIEW: 24 Rows, 1 to 24 */
          /* ==================================================== */
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black tracking-wider uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-3.5">Wilayah & Kepala Lingkungan</th>
                  <th className="py-3 px-3.5 text-center">Target WP</th>
                  <th className="py-3 px-3.5 text-center">WP Lunas</th>
                  <th className="py-3 px-3.5 text-center w-48">Kepatuhan WP (%)</th>
                  <th className="py-3 px-3.5 text-right">Realisasi Uang (Rp)</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sortedLingkungan.map((item, idx) => {
                  const lkAccount = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === item.lingkungan);
                  const namaKepling = lkAccount?.nama || 'Kepala Lingkungan';
                  const pct = item.persentaseWpLunas;
                  const isHigh = pct >= 80;
                  const isMedium = pct >= 50 && pct < 80;
                  const isLow = pct > 0 && pct < 50;

                  return (
                    <tr
                      key={`rekap_table_lk_${item.lingkungan}`}
                      className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                      onClick={() => onSelectLingkungan?.(item.lingkungan)}
                    >
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-400 group-hover:text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                          Lingkungan {item.lingkungan}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">{namaKepling}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-semibold text-slate-600">
                        {item.totalWp} SPPT
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-emerald-700">
                        {item.wpLunas} SPPT
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-12 text-right font-black ${
                              isHigh
                                ? 'text-emerald-700'
                                : isMedium
                                ? 'text-teal-700'
                                : isLow
                                ? 'text-amber-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                          <div className="flex-1 bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isHigh
                                  ? 'bg-emerald-600'
                                  : isMedium
                                  ? 'bg-teal-600'
                                  : isLow
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-slate-700">
                        <div>{formatRupiah(item.realisasiNominal)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {item.persentaseRealisasi.toFixed(1)}% dari target
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isHigh
                              ? 'bg-emerald-100 text-emerald-800'
                              : isMedium
                              ? 'bg-teal-100 text-teal-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isHigh
                            ? 'Sangat Tinggi'
                            : isMedium
                            ? 'Tinggi'
                            : isLow
                            ? 'Berjalan'
                            : 'Belum Bayar'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-100 transition-all cursor-pointer"
                          title="Lihat detail SPPT"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                <tr>
                  <td colSpan={2} className="py-3 px-3.5 uppercase">
                    TOTAL KELURAHAN MANGGA:
                  </td>
                  <td className="py-3 px-3.5 text-center">{overview.totalWp.toLocaleString('id-ID')} SPPT</td>
                  <td className="py-3 px-3.5 text-center text-emerald-400">
                    {overview.totalWpLunas.toLocaleString('id-ID')} SPPT
                  </td>
                  <td className="py-3 px-3.5 text-center text-emerald-300">
                    {overview.persentaseWpLunas.toFixed(1)}% Kepatuhan
                  </td>
                  <td className="py-3 px-3.5 text-right text-amber-300">
                    {formatRupiah(overview.totalRealisasiNominal)}
                  </td>
                  <td colSpan={2} className="py-3 px-3.5 text-center text-emerald-400 font-bold">
                    24 LINGKUNGAN
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PRATINJAU FORMAT WHATSAPP */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-emerald-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black">Pratinjau Teks Rekap PBB WhatsApp</h4>
                  <p className="text-[11px] text-emerald-200">
                    Format resmi siap kirim ke WhatsApp Group Kelurahan Mangga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Preformatted WA Message */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50">
              <div className="bg-white rounded-xl border border-slate-200 p-4 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-all shadow-inner">
                {waText}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                Teks disusun urut Lingkungan 1 s/d 24 dengan rasio pelunasan WP terkini.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleShareToWhatsApp}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                  title="Buka langsung di WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Kirim ke WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWa}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer ${
                    copiedWa
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {copiedWa ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWa ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
