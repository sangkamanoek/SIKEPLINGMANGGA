import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Award,
  Filter,
  CheckCircle2,
  Users,
  CreditCard,
  Smartphone,
  Shield,
  Layers,
} from 'lucide-react';
import { LaporanHarianItem, UserAccount } from '../types';
import { isReportMatchingKepling, getReportIsoDate } from '../lib/formatter';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface GrafikTrenBulananProps {
  reports: LaporanHarianItem[];
  activeAccount?: UserAccount;
  mode: 'kepling' | 'super_admin';
  title?: string;
}

const BULAN_NAMES = [
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

const BULAN_SHORT = [
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

type ViewMode = 'laporan' | 'pilar';

export const GrafikTrenBulanan: React.FC<GrafikTrenBulananProps> = ({
  reports,
  activeAccount,
  mode,
  title,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-indexed

  // Super Admin kepling filter selection (default: all)
  const [selectedKeplingFilter, setSelectedKeplingFilter] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>('laporan');

  // Filter reports according to mode and kepling selection
  const relevantReports = useMemo(() => {
    if (mode === 'kepling') {
      if (!activeAccount) return [];
      return reports.filter((r) => isReportMatchingKepling(r, activeAccount));
    }
    // Super admin mode
    if (selectedKeplingFilter === 'all') {
      return reports;
    }
    const targetAccount = KEPLING_ACCOUNTS.find((k) => k.id === selectedKeplingFilter);
    if (!targetAccount) return reports;
    return reports.filter((r) => isReportMatchingKepling(r, targetAccount));
  }, [reports, mode, activeAccount, selectedKeplingFilter]);

  // Extract available years from reports
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    relevantReports.forEach((r) => {
      const dateIso = getReportIsoDate(r);
      if (dateIso && dateIso.length >= 4) {
        const y = parseInt(dateIso.substring(0, 4), 10);
        if (!isNaN(y) && y >= 2020 && y <= 2035) {
          years.add(y);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [relevantReports, currentYear]);

  // Generate monthly aggregation data for the selected year
  const monthlyData = useMemo(() => {
    // 12 months array
    const data = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      const yearMonth = `${selectedYear}-${monthNum}`;

      return {
        monthIndex: i,
        monthKey: yearMonth,
        bulan: BULAN_NAMES[i],
        shortBulan: BULAN_SHORT[i],
        tahun: selectedYear,
        isCurrentMonth: selectedYear === currentYear && i === currentMonthIdx,
        isFutureMonth:
          selectedYear > currentYear ||
          (selectedYear === currentYear && i > currentMonthIdx),
        jumlahLaporan: 0,
        pbb: 0,
        perlinsos: 0,
        ikd: 0,
        bpjs: 0,
        uniqueDays: new Set<string>(),
      };
    });

    relevantReports.forEach((r) => {
      const dateIso = getReportIsoDate(r);
      if (!dateIso || !dateIso.startsWith(`${selectedYear}-`)) return;

      const parts = dateIso.split('-');
      if (parts.length >= 2) {
        const monthIndex = parseInt(parts[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          const m = data[monthIndex];
          m.jumlahLaporan += 1;
          m.pbb += Number(r.kinerja?.opsirPbbWp) || 0;
          m.perlinsos += Number(r.kinerja?.perlinsosKk) || 0;
          m.ikd += Number(r.kinerja?.ikdOrang) || 0;
          m.bpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
          m.uniqueDays.add(dateIso);
        }
      }
    });

    return data.map((d) => ({
      ...d,
      hariAktif: d.uniqueDays.size,
    }));
  }, [relevantReports, selectedYear, currentYear, currentMonthIdx]);

  // Aggregate statistics for the selected year
  const stats = useMemo(() => {
    let totalLaporan = 0;
    let totalPbb = 0;
    let totalPerlinsos = 0;
    let totalIkd = 0;
    let totalBpjs = 0;
    let maxLaporanMonth = monthlyData[0];
    let activeMonthsCount = 0;

    monthlyData.forEach((m) => {
      totalLaporan += m.jumlahLaporan;
      totalPbb += m.pbb;
      totalPerlinsos += m.perlinsos;
      totalIkd += m.ikd;
      totalBpjs += m.bpjs;

      if (m.jumlahLaporan > 0) {
        activeMonthsCount += 1;
      }

      if (m.jumlahLaporan > maxLaporanMonth.jumlahLaporan) {
        maxLaporanMonth = m;
      }
    });

    // Average reports per active month or elapsed months
    const elapsedMonths =
      selectedYear < currentYear
        ? 12
        : selectedYear === currentYear
        ? currentMonthIdx + 1
        : 1;

    const avgLaporanPerMonth =
      elapsedMonths > 0 ? (totalLaporan / elapsedMonths).toFixed(1) : '0';

    return {
      totalLaporan,
      totalPbb,
      totalPerlinsos,
      totalIkd,
      totalBpjs,
      maxLaporanMonth,
      activeMonthsCount,
      avgLaporanPerMonth,
      elapsedMonths,
    };
  }, [monthlyData, selectedYear, currentYear, currentMonthIdx]);

  // Custom Tooltip for BarChart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {item.bulan} {item.tahun}
              </span>
            </div>
            {item.isCurrentMonth && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold text-[9px] border border-amber-400/30">
                Bulan Ini
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-200">
              <span className="font-semibold text-slate-300">Laporan Selesai:</span>
              <span className="font-black text-amber-300 text-sm">
                {item.jumlahLaporan} Laporan
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span>Hari Aktif Melapor:</span>
              <span className="font-bold text-white">{item.hariAktif} Hari</span>
            </div>
          </div>

          {/* Breakdown Pilar Kinerja */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-slate-400 block">PBB:</span>
              <span className="font-bold text-emerald-300">{item.pbb} WP</span>
            </div>
            <div className="bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-slate-400 block">Perlinsos:</span>
              <span className="font-bold text-blue-300">{item.perlinsos} KK</span>
            </div>
            <div className="bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-slate-400 block">IKD:</span>
              <span className="font-bold text-purple-300">{item.ikd} Org</span>
            </div>
            <div className="bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-slate-400 block">BPJS TK:</span>
              <span className="font-bold text-amber-300">{item.bpjs} Org</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                {title ||
                  (mode === 'kepling'
                    ? `Grafik Tren Laporan Bulanan ${activeAccount?.lingkungan || ''}`
                    : 'Grafik Tren Laporan Bulanan Seluruh Lingkungan')}
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                Tahun {selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi jumlah laporan kinerja yang diselesaikan setiap bulan untuk memantau konsistensi & produktivitas kerja
            </p>
          </div>
        </div>

        {/* Filter & View Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto print:hidden">
          {/* Super Admin Kepling Picker */}
          {mode === 'super_admin' && (
            <div className="relative">
              <select
                id="select-kepling-grafik"
                value={selectedKeplingFilter}
                onChange={(e) => setSelectedKeplingFilter(e.target.value)}
                className="text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-emerald-600 cursor-pointer"
              >
                <option value="all">Semua Lingkungan (Kelurahan)</option>
                {KEPLING_ACCOUNTS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.lingkungan} - {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === year
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Mode Switch (Jumlah Laporan vs Breakdown 4 Pilar) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('laporan')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'laporan'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan grafik batang jumlah laporan diselesaikan"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Jumlah Laporan</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pilar')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'pilar'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan perbandingan capaian 4 pilar kinerja per bulan"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>4 Pilar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Mini-Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Laporan Tahun Ini */}
        <div className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 rounded-2xl p-3.5 sm:p-4 transition-colors">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block">
            Total Laporan Selesai ({selectedYear})
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {stats.totalLaporan}
            <span className="text-xs font-semibold text-slate-500 ml-1">Laporan</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{stats.activeMonthsCount} dari 12 bulan terisi</span>
          </p>
        </div>

        {/* Rata-Rata Laporan per Bulan */}
        <div className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 rounded-2xl p-3.5 sm:p-4 transition-colors">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block">
            Rata-Rata Bulanan
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
            {stats.avgLaporanPerMonth}
            <span className="text-xs font-semibold text-slate-500 ml-1">Lap / Bln</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dihitung dari {stats.elapsedMonths} bulan berjalan
          </p>
        </div>

        {/* Bulan Terproduktif */}
        <div className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 rounded-2xl p-3.5 sm:p-4 transition-colors">
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase block">
            Bulan Paling Produktif
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-900 mt-1 line-clamp-1">
            {stats.maxLaporanMonth.jumlahLaporan > 0 ? (
              <>
                {stats.maxLaporanMonth.bulan}{' '}
                <span className="text-xs font-bold text-amber-700">
                  ({stats.maxLaporanMonth.jumlahLaporan} Lap)
                </span>
              </>
            ) : (
              <span className="text-slate-400 text-sm font-semibold">Belum Ada Data</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.maxLaporanMonth.jumlahLaporan > 0
              ? `Aktivitas tertinggi dengan ${stats.maxLaporanMonth.hariAktif} hari pelaporan`
              : 'Mulai input laporan harian'}
          </p>
        </div>

        {/* Total Akumulasi Kinerja 4 Pilar */}
        <div className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 rounded-2xl p-3.5 sm:p-4 transition-colors">
          <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase block">
            Total Capaian Terdata ({selectedYear})
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base sm:text-lg font-black text-blue-950">
              {stats.totalPerlinsos} <span className="text-[10px] text-slate-500 font-bold">KK</span>
            </span>
            <span className="text-xs text-slate-300 font-bold">•</span>
            <span className="text-base sm:text-lg font-black text-emerald-800">
              {stats.totalPbb} <span className="text-[10px] text-slate-500 font-bold">WP</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
            IKD: {stats.totalIkd} Org • BPJS: {stats.totalBpjs} Org
          </p>
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
            <span className="text-xs font-bold text-slate-800">
              {viewMode === 'laporan'
                ? `Grafik Batang Jumlah Laporan Selesai per Bulan (${selectedYear})`
                : `Grafik Perbandingan Kinerja Bulanan (${selectedYear})`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Arahkan kursor / sentuh batang grafik untuk melihat rincian detail bulanan
          </span>
        </div>

        {/* Responsive Recharts Container */}
        <div className="w-full h-72 sm:h-80 min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'laporan' ? (
              <BarChart
                data={monthlyData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="shortBulan"
                  stroke="#64748B"
                  tick={{ fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  stroke="#64748B"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="jumlahLaporan"
                  name="Jumlah Laporan Selesai"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.isCurrentMonth
                          ? '#047857' // Deep Emerald for current month
                          : entry.jumlahLaporan > 0
                          ? '#10B981' // Vibrant emerald for months with reports
                          : '#E2E8F0' // Light gray placeholder for months with 0
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={monthlyData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="shortBulan"
                  stroke="#64748B"
                  tick={{ fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  stroke="#64748B"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
                  iconType="circle"
                />
                <Bar
                  dataKey="jumlahLaporan"
                  name="Laporan Selesai"
                  fill="#047857"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="pbb"
                  name="Opsir PBB (WP)"
                  fill="#0D9488"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="perlinsos"
                  name="Perlinsos (KK)"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="ikd"
                  name="IKD (Org)"
                  fill="#7C3AED"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend / Status Note */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#047857]" />
              <span className="text-slate-600 font-semibold">Bulan Berjalan ({BULAN_NAMES[currentMonthIdx]})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#10B981]" />
              <span className="text-slate-600 font-semibold">Laporan Terisi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#E2E8F0]" />
              <span className="text-slate-400 font-semibold">Belum Ada Laporan (0)</span>
            </div>
          </div>

          <span className="text-slate-500 font-medium">
            Total {relevantReports.length} laporan historis dalam database
          </span>
        </div>
      </div>
    </div>
  );
};
