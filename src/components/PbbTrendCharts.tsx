import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Coins,
  Users,
  Target,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { SpptPbbItem } from '../data/pbbSampleData';

interface PbbTrendChartsProps {
  selectedYear: number;
  selectedLingkungan: string;
  onSelectLingkungan: (ling: string) => void;
  spptList: SpptPbbItem[];
  summaryByLingkungan: Array<{
    lingkungan: number;
    totalWp: number;
    wpLunas: number;
    wpBelumLunas: number;
    targetNominal: number;
    realisasiNominal: number;
    sisaNominal: number;
    persentaseRealisasi: number;
    persentaseWpLunas: number;
  }>;
  kelurahanTotals: {
    targetNominal: number;
    realisasiNominal: number;
    sisaNominal: number;
    totalWp: number;
    wpLunas: number;
    wpBelumLunas: number;
    persentaseRealisasi: number;
    persentaseWpLunas: number;
  };
  isKepling?: boolean;
  keplingLingkunganNum?: number;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

const formatShortRupiah = (val: number): string => {
  if (val >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
  }
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(0)} Jt`;
  }
  if (val >= 1_000) {
    return `Rp ${(val / 1_000).toFixed(0)} Rb`;
  }
  return `Rp ${val}`;
};

export const PbbTrendCharts: React.FC<PbbTrendChartsProps> = ({
  selectedYear,
  selectedLingkungan,
  onSelectLingkungan,
  spptList,
  summaryByLingkungan,
  kelurahanTotals,
  isKepling,
  keplingLingkunganNum,
}) => {
  const [chartMode, setChartMode] = useState<'nominal' | 'wp' | 'perbandingan'>('nominal');
  const [viewType, setViewType] = useState<'kumulatif' | 'bulanan'>('kumulatif');

  // Active Lingkungan Data
  const currentTargetNominal = useMemo(() => {
    if (selectedLingkungan === 'all') {
      return kelurahanTotals.targetNominal;
    }
    const lingNum = parseInt(selectedLingkungan, 10);
    const item = summaryByLingkungan.find((s) => s.lingkungan === lingNum);
    return item?.targetNominal || 0;
  }, [selectedLingkungan, kelurahanTotals, summaryByLingkungan]);

  const currentRealisasiNominal = useMemo(() => {
    if (selectedLingkungan === 'all') {
      return kelurahanTotals.realisasiNominal;
    }
    const lingNum = parseInt(selectedLingkungan, 10);
    const item = summaryByLingkungan.find((s) => s.lingkungan === lingNum);
    return item?.realisasiNominal || 0;
  }, [selectedLingkungan, kelurahanTotals, summaryByLingkungan]);

  const currentTotalWp = useMemo(() => {
    if (selectedLingkungan === 'all') {
      return kelurahanTotals.totalWp;
    }
    const lingNum = parseInt(selectedLingkungan, 10);
    const item = summaryByLingkungan.find((s) => s.lingkungan === lingNum);
    return item?.totalWp || 0;
  }, [selectedLingkungan, kelurahanTotals, summaryByLingkungan]);

  const currentWpLunas = useMemo(() => {
    if (selectedLingkungan === 'all') {
      return kelurahanTotals.wpLunas;
    }
    const lingNum = parseInt(selectedLingkungan, 10);
    const item = summaryByLingkungan.find((s) => s.lingkungan === lingNum);
    return item?.wpLunas || 0;
  }, [selectedLingkungan, kelurahanTotals, summaryByLingkungan]);

  // Generate 12-Month Progression Data
  // Weighs payment distribution realistically across Jan-Sep with historical seasonality (Jatuh Tempo Aug/Sep)
  const monthlyData = useMemo(() => {
    const monthlyWeights = [0.04, 0.05, 0.08, 0.09, 0.12, 0.14, 0.16, 0.18, 0.14, 0, 0, 0];
    const totalWeightsPassed = monthlyWeights.slice(0, 9).reduce((a, b) => a + b, 0); // 1.00

    let runningNominal = 0;
    let runningWp = 0;
    const targetBulananIdeal = currentTargetNominal / 12;
    const targetWpBulananIdeal = currentTotalWp / 12;

    return MONTH_NAMES.map((month, idx) => {
      const isPastOrCurrentMonth = idx <= 8; // Jan s/d Sep
      const isCurrentMonth = idx === 8; // September

      // Monthly Realization Calculation
      const monthlyNominal = isPastOrCurrentMonth
        ? Math.round((currentRealisasiNominal * (monthlyWeights[idx] / totalWeightsPassed)))
        : 0;
      const monthlyWp = isPastOrCurrentMonth
        ? Math.round((currentWpLunas * (monthlyWeights[idx] / totalWeightsPassed)))
        : 0;

      runningNominal += monthlyNominal;
      runningWp += monthlyWp;

      // Cumulative target trajectory (1/12, 2/12, ..., 12/12)
      const targetKumulatifNominal = Math.round(currentTargetNominal * ((idx + 1) / 12));
      const targetKumulatifWp = Math.round(currentTotalWp * ((idx + 1) / 12));

      return {
        month: MONTH_SHORT[idx],
        fullName: month,
        isPastOrCurrentMonth,
        isCurrentMonth,
        // Monthly Metrics
        realisasiBulanan: monthlyNominal,
        targetBulanan: Math.round(targetBulananIdeal),
        realisasiWpBulanan: monthlyWp,
        targetWpBulanan: Math.round(targetWpBulananIdeal),
        // Cumulative Metrics
        realisasiKumulatif: isPastOrCurrentMonth ? runningNominal : null,
        targetKumulatif: targetKumulatifNominal,
        realisasiWpKumulatif: isPastOrCurrentMonth ? runningWp : null,
        targetWpKumulatif: targetKumulatifWp,
        // Gap
        gapNominal: isPastOrCurrentMonth ? targetKumulatifNominal - runningNominal : null,
        persentasePencapaian:
          currentTargetNominal > 0 ? (runningNominal / currentTargetNominal) * 100 : 0,
      };
    });
  }, [currentTargetNominal, currentRealisasiNominal, currentTotalWp, currentWpLunas]);

  // Leaderboard / Lingkungan Comparison Data for Recharts
  const comparisonData = useMemo(() => {
    return summaryByLingkungan.map((item) => ({
      name: `Lk ${item.lingkungan}`,
      lingkungan: item.lingkungan,
      targetNominal: item.targetNominal,
      realisasiNominal: item.realisasiNominal,
      persentase: item.persentaseRealisasi,
      totalWp: item.totalWp,
      wpLunas: item.wpLunas,
      persentaseWp: item.persentaseWpLunas,
    }));
  }, [summaryByLingkungan]);

  const persentaseCapaianAktif =
    currentTargetNominal > 0 ? (currentRealisasiNominal / currentTargetNominal) * 100 : 0;
  const persentaseWpAktif =
    currentTotalWp > 0 ? (currentWpLunas / currentTotalWp) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Controller Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Visualisasi &amp; Tren Realisasi PBB-P2 Tahun {selectedYear}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedLingkungan === 'all'
                    ? 'Progres realisasi kumulatif bulanan se-Kelurahan Mangga (24 Lingkungan)'
                    : `Monitoring tren dan progres bulanan khusus Lingkungan ${selectedLingkungan}`}
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Mode & Filter Lingkungan */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Lingkungan Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Wilayah:</span>
              <select
                value={selectedLingkungan}
                onChange={(e) => onSelectLingkungan(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 font-black rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Lingkungan (1 - 24)</option>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Lingkungan {n} {isKepling && keplingLingkunganNum === n ? '👑 (Saya)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMode('nominal')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'nominal'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Nominal (Rp)</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('wp')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'wp'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Wajib Pajak (WP)</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('perbandingan')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'perbandingan'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>24 Lingkungan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Trend KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Target Ketetapan</span>
            <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
              {chartMode === 'wp'
                ? `${currentTotalWp.toLocaleString('id-ID')} WP`
                : formatRupiah(currentTargetNominal)}
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">Tahun {selectedYear}</span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Realisasi Berjalan</span>
            <div className="text-sm sm:text-base font-black text-emerald-900 mt-0.5">
              {chartMode === 'wp'
                ? `${currentWpLunas.toLocaleString('id-ID')} WP`
                : formatRupiah(currentRealisasiNominal)}
            </div>
            <span className="text-[10px] font-bold text-emerald-700">
              {chartMode === 'wp'
                ? `${persentaseWpAktif.toFixed(1)}% Lunas`
                : `${persentaseCapaianAktif.toFixed(2)}% Terkumpul`}
            </span>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Sisa Terutang</span>
            <div className="text-sm sm:text-base font-black text-amber-900 mt-0.5">
              {chartMode === 'wp'
                ? `${(currentTotalWp - currentWpLunas).toLocaleString('id-ID')} WP`
                : formatRupiah(Math.max(0, currentTargetNominal - currentRealisasiNominal))}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold">
              {(100 - (chartMode === 'wp' ? persentaseWpAktif : persentaseCapaianAktif)).toFixed(1)}% Menunggu
            </span>
          </div>

          <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-200/80">
            <span className="text-[11px] font-bold text-teal-800 uppercase">Target Rata-rata / Bulan</span>
            <div className="text-sm sm:text-base font-black text-teal-900 mt-0.5">
              {chartMode === 'wp'
                ? `${Math.round(currentTotalWp / 12)} WP / Bln`
                : formatShortRupiah(currentTargetNominal / 12)}
            </div>
            <span className="text-[10px] text-teal-700 font-semibold">Pace Ideal 12 Bulan</span>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      {chartMode !== 'perbandingan' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                {chartMode === 'nominal'
                  ? `Grafik Tren Realisasi Penerimaan (Rp) vs Target Tahunan`
                  : `Grafik Tren Realisasi Jumlah Wajib Pajak (WP) Lunas vs Target`}
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                {viewType === 'kumulatif'
                  ? 'Garis target kumulatif bertahap menunjukkan jalur capaian target menuju akhir tahun'
                  : 'Menampilkan volume penerimaan per masing-masing bulan'}
              </p>
            </div>

            {/* Toggle View: Kumulatif vs Bulanan */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewType('kumulatif')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewType === 'kumulatif'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Akumulasi Kumulatif
              </button>
              <button
                type="button"
                onClick={() => setViewType('bulanan')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewType === 'bulanan'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Realisasi Bulanan
              </button>
            </div>
          </div>

          {/* Recharts Component Container */}
          <div className="w-full h-80 sm:h-96 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'kumulatif' ? (
                <ComposedChart
                  data={monthlyData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="realisasiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    tickFormatter={(val) =>
                      chartMode === 'nominal' ? formatShortRupiah(val) : `${val} WP`
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[200px]">
                            <div className="font-black text-amber-300 border-b border-slate-700 pb-1 flex items-center justify-between">
                              <span>Bulan: {data.fullName} {selectedYear}</span>
                              {data.isCurrentMonth && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 text-[10px]">
                                  Bulan Ini
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                <span>Realisasi Kumulatif:</span>
                              </span>
                              <span className="font-black text-emerald-400">
                                {chartMode === 'nominal'
                                  ? data.realisasiKumulatif !== null
                                    ? formatRupiah(data.realisasiKumulatif)
                                    : 'Belum ada data'
                                  : data.realisasiWpKumulatif !== null
                                  ? `${data.realisasiWpKumulatif.toLocaleString('id-ID')} WP`
                                  : 'Belum ada data'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span>Target Kumulatif:</span>
                              </span>
                              <span className="font-bold text-amber-300">
                                {chartMode === 'nominal'
                                  ? formatRupiah(data.targetKumulatif)
                                  : `${data.targetWpKumulatif.toLocaleString('id-ID')} WP`}
                              </span>
                            </div>
                            {data.realisasiKumulatif !== null && (
                              <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                                <span>% Capaian Target:</span>
                                <span className="font-black text-white">
                                  {data.persentasePencapaian.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12, fontWeight: 600 }}
                    formatter={(value) => {
                      if (value === 'realisasiKumulatif' || value === 'realisasiWpKumulatif') {
                        return chartMode === 'nominal' ? 'Realisasi Berjalan (Rp)' : 'Realisasi WP Lunas';
                      }
                      if (value === 'targetKumulatif' || value === 'targetWpKumulatif') {
                        return chartMode === 'nominal' ? 'Target Kumulatif (Rp)' : 'Target Kumulatif (WP)';
                      }
                      return value;
                    }}
                  />
                  {/* Area Realisasi */}
                  <Area
                    type="monotone"
                    dataKey={chartMode === 'nominal' ? 'realisasiKumulatif' : 'realisasiWpKumulatif'}
                    name={chartMode === 'nominal' ? 'realisasiKumulatif' : 'realisasiWpKumulatif'}
                    fill="url(#realisasiGrad)"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                  {/* Line Target */}
                  <Line
                    type="monotone"
                    dataKey={chartMode === 'nominal' ? 'targetKumulatif' : 'targetWpKumulatif'}
                    name={chartMode === 'nominal' ? 'targetKumulatif' : 'targetWpKumulatif'}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  {/* Reference Line for Target Tahunan Full */}
                  <ReferenceLine
                    y={chartMode === 'nominal' ? currentTargetNominal : currentTotalWp}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{
                      value: `Target Penuh: ${
                        chartMode === 'nominal'
                          ? formatShortRupiah(currentTargetNominal)
                          : `${currentTotalWp} WP`
                      }`,
                      fill: '#dc2626',
                      fontSize: 11,
                      fontWeight: 700,
                      position: 'top',
                    }}
                  />
                </ComposedChart>
              ) : (
                <BarChart
                  data={monthlyData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    tickFormatter={(val) =>
                      chartMode === 'nominal' ? formatShortRupiah(val) : `${val} WP`
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 min-w-[180px]">
                            <div className="font-bold text-amber-300 border-b border-slate-700 pb-1">
                              {data.fullName} {selectedYear}
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>Penerimaan Bulan Ini:</span>
                              <span className="font-black">
                                {chartMode === 'nominal'
                                  ? formatRupiah(data.realisasiBulanan)
                                  : `${data.realisasiWpBulanan} WP`}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-amber-300">
                              <span>Target Rata-rata:</span>
                              <span className="font-bold">
                                {chartMode === 'nominal'
                                  ? formatRupiah(data.targetBulanan)
                                  : `${data.targetWpBulanan} WP`}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12, fontWeight: 600 }}
                    formatter={(value) => {
                      if (value === 'realisasiBulanan' || value === 'realisasiWpBulanan') {
                        return chartMode === 'nominal' ? 'Realisasi Bulanan (Rp)' : 'Realisasi WP Bulanan';
                      }
                      if (value === 'targetBulanan' || value === 'targetWpBulanan') {
                        return chartMode === 'nominal' ? 'Target Rata-rata (Rp)' : 'Target WP Rata-rata';
                      }
                      return value;
                    }}
                  />
                  <Bar
                    dataKey={chartMode === 'nominal' ? 'realisasiBulanan' : 'realisasiWpBulanan'}
                    name={chartMode === 'nominal' ? 'realisasiBulanan' : 'realisasiWpBulanan'}
                    fill="#059669"
                    radius={[6, 6, 0, 0]}
                  >
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isCurrentMonth ? '#047857' : '#10b981'}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey={chartMode === 'nominal' ? 'targetBulanan' : 'targetWpBulanan'}
                    name={chartMode === 'nominal' ? 'targetBulanan' : 'targetWpBulanan'}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f59e0b' }}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* 24 Lingkungan Comparative Chart */
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                Grafik Perbandingan Realisasi vs Target 24 Lingkungan
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Peringkat capaian penerimaan PBB-P2 dari Lingkungan 1 sampai dengan Lingkungan 24
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Terbayar
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Target
              </span>
            </div>
          </div>

          <div className="w-full h-96 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={(val) => formatShortRupiah(val)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 min-w-[200px]">
                          <div className="font-black text-amber-300 border-b border-slate-700 pb-1">
                            Lingkungan {data.lingkungan}
                          </div>
                          <div className="flex justify-between items-center text-slate-200">
                            <span>Target PBB:</span>
                            <span className="font-bold">{formatRupiah(data.targetNominal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-400">
                            <span>Realisasi Terbayar:</span>
                            <span className="font-black">{formatRupiah(data.realisasiNominal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-amber-300">
                            <span>% Capaian Nominal:</span>
                            <span className="font-black">{data.persentase.toFixed(2)}%</span>
                          </div>
                          <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                            <span>Wajib Pajak:</span>
                            <span className="text-white font-bold">
                              {data.wpLunas} / {data.totalWp} WP ({data.persentaseWp.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 12, fontWeight: 600 }}
                  formatter={(value) => (value === 'realisasiNominal' ? 'Realisasi Terbayar (Rp)' : 'Target Ketetapan (Rp)')}
                />
                <Bar
                  dataKey="realisasiNominal"
                  name="realisasiNominal"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                >
                  {comparisonData.map((entry, index) => (
                    <Cell
                      key={`comp-${index}`}
                      fill={
                        selectedLingkungan !== 'all' && entry.lingkungan === parseInt(selectedLingkungan, 10)
                          ? '#047857'
                          : entry.persentase >= 50
                          ? '#10b981'
                          : '#059669'
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="targetNominal"
                  name="targetNominal"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                  opacity={0.6}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 24 Lingkungan WP Comparative Chart */}
      {selectedLingkungan === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <span>Grafik Perbandingan Jumlah Wajib Pajak (Target WP vs WP Lunas) per Lingkungan</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Membandingkan total target Wajib Pajak (SPPT) terdaftar dengan jumlah Wajib Pajak yang sudah melunasi pembayaran PBB di 24 lingkungan
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-teal-600 inline-block" /> WP Lunas
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Total Target WP
              </span>
            </div>
          </div>

          <div className="w-full h-80 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 20, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 min-w-[210px]">
                          <div className="font-black text-amber-300 border-b border-slate-700 pb-1">
                            Lingkungan {data.lingkungan}
                          </div>
                          <div className="flex justify-between items-center text-slate-200">
                            <span>Total Target WP:</span>
                            <span className="font-bold">{data.totalWp.toLocaleString('id-ID')} WP</span>
                          </div>
                          <div className="flex justify-between items-center text-teal-400">
                            <span>WP Lunas (Sudah Bayar):</span>
                            <span className="font-black">{data.wpLunas.toLocaleString('id-ID')} WP</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-300">
                            <span>Sisa WP Belum Lunas:</span>
                            <span className="font-bold">{(data.totalWp - data.wpLunas).toLocaleString('id-ID')} WP</span>
                          </div>
                          <div className="pt-1.5 mt-1 border-t border-slate-800 text-[11px] text-amber-300 flex justify-between">
                            <span>Rasio Pelunasan WP:</span>
                            <span className="font-extrabold">{data.persentaseWp.toFixed(2)}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 11, fontWeight: 600 }}
                  formatter={(value) => (value === 'wpLunas' ? 'Wajib Pajak Lunas (Sudah Bayar)' : 'Total Target Wajib Pajak (SPPT)')}
                />
                <Bar
                  dataKey="wpLunas"
                  name="wpLunas"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                >
                  {comparisonData.map((entry, index) => (
                    <Cell
                      key={`comp-wp-${index}`}
                      fill={
                        entry.persentaseWp >= 80
                          ? '#0d9488'
                          : entry.persentaseWp >= 50
                          ? '#14b8a6'
                          : '#0284c7'
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="totalWp"
                  name="totalWp"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                  opacity={0.6}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Evaluasi & Analisis Strategis Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-3">
        <div className="flex items-center gap-2 text-amber-300 font-black text-sm uppercase tracking-wide">
          <Info className="w-4 h-4" />
          <span>Analisis Kinerja &amp; Rencana Aksi Pemungutan</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-emerald-100 leading-relaxed">
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-xs border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Status Realisasi</span>
            </span>
            <p className="text-slate-200 text-xs">
              Realisasi {selectedLingkungan === 'all' ? 'Kelurahan Mangga' : `Lingkungan ${selectedLingkungan}`} telah mencapai{' '}
              <strong className="text-amber-300">{persentaseCapaianAktif.toFixed(2)}%</strong> dari total target ketetapan {selectedYear}.
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-xs border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-400" />
              <span>Target Bulanan</span>
            </span>
            <p className="text-slate-200 text-xs">
              Diperlukan rata-rata penghimpunan{' '}
              <strong className="text-amber-300">
                {formatShortRupiah(Math.max(0, currentTargetNominal - currentRealisasiNominal) / 3)} / bulan
              </strong>{' '}
              pada triwulan akhir untuk mencapai 100% target tahunan.
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-xs border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-teal-300" />
              <span>Pendekatan Wajib Pajak</span>
            </span>
            <p className="text-slate-200 text-xs">
              Kepling dapat menggunakan fitur <em>Detail SPPT</em> untuk mendata NOP yang belum lunas dan melakukan kunjungan langsung secara bertahap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
