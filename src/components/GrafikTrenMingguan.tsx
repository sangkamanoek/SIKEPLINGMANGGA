import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  Users,
  Compass,
  Zap,
} from 'lucide-react';
import { LaporanHarianItem, UserAccount, AbsenApelItem } from '../types';
import { isReportMatchingKepling, getReportIsoDate, isKunjunganMatchingKepling } from '../lib/formatter';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface GrafikTrenMingguanProps {
  reports: LaporanHarianItem[];
  activeAccount: UserAccount;
  mode: 'kepling' | 'super_admin';
  attendanceList?: AbsenApelItem[];
  kunjunganList?: any[];
  title?: string;
}

interface WeeklyDataPoint {
  weekKey: string;
  label: string;
  rangeText: string;
  // Metrics
  compositeScore: number;
  perlinsos: number;
  pbb: number;
  kunjungan: number;
  laporanCount: number;
  apelHadir: number;
  apelTotal: number;
  apelRate: number;
  avgKelurahanScore?: number;
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

export const GrafikTrenMingguan: React.FC<GrafikTrenMingguanProps> = ({
  reports,
  activeAccount,
  mode,
  attendanceList = [],
  kunjunganList = [],
  title,
}) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [targetKeplingId, setTargetKeplingId] = useState<string>(
    mode === 'kepling' ? activeAccount.id : 'ALL'
  );
  const [activeMetricMode, setActiveMetricMode] = useState<
    'COMPOSITE' | 'ALL_INDICATORS' | 'PERLINSOS_PBB' | 'ATTENDANCE_VISIT'
  >('COMPOSITE');
  const [showBenchmark, setShowBenchmark] = useState<boolean>(true);

  // Daftar bulan yang tersedia
  const availableMonths = useMemo(() => {
    return BULAN_NAMES.map((name, idx) => ({
      value: idx + 1,
      label: name,
    }));
  }, []);

  // Filter kepling akun yang dianalisis
  const selectedKeplingAccount = useMemo(() => {
    if (mode === 'kepling') return activeAccount;
    if (targetKeplingId === 'ALL') return null;
    return KEPLING_ACCOUNTS.find((k) => k.id === targetKeplingId) || null;
  }, [mode, activeAccount, targetKeplingId]);

  // Kalkulasi data mingguan untuk bulan dan tahun terpilih
  const weeklyTrendData = useMemo<WeeklyDataPoint[]>(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Definisikan 4 - 5 interval mingguan dalam 1 bulan kalender
    const weekDefinitions = [
      { key: 'W1', label: 'Minggu I', startDay: 1, endDay: 7 },
      { key: 'W2', label: 'Minggu II', startDay: 8, endDay: 14 },
      { key: 'W3', label: 'Minggu III', startDay: 15, endDay: 21 },
      { key: 'W4', label: 'Minggu IV', startDay: 22, endDay: Math.min(28, daysInMonth) },
    ];

    if (daysInMonth > 28) {
      weekDefinitions.push({
        key: 'W5',
        label: 'Minggu V',
        startDay: 29,
        endDay: daysInMonth,
      });
    }

    const monthShort = BULAN_NAMES[selectedMonth - 1]?.substring(0, 3) || '';

    // Hitung per minggu
    return weekDefinitions.map((w) => {
      const rangeText = `${w.startDay} - ${w.endDay} ${monthShort}`;

      // Helper date checker
      const isDateInWeek = (dateStr?: string) => {
        if (!dateStr) return false;
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return false;
          return (
            d.getFullYear() === selectedYear &&
            d.getMonth() + 1 === selectedMonth &&
            d.getDate() >= w.startDay &&
            d.getDate() <= w.endDay
          );
        } catch {
          return false;
        }
      };

      // 1. Laporan pada minggu ini
      const weekReports = reports.filter((r) => {
        const iso = getReportIsoDate(r);
        return isDateInWeek(iso);
      });

      // Target kepling filter
      const targetReports = selectedKeplingAccount
        ? weekReports.filter((r) => isReportMatchingKepling(r, selectedKeplingAccount))
        : weekReports;

      // 2. Absensi pada minggu ini
      const weekAttendance = attendanceList.filter((a) => isDateInWeek(a.date));
      const targetAttendance = selectedKeplingAccount
        ? weekAttendance.filter(
            (a) =>
              a.accountId === selectedKeplingAccount.id ||
              a.nomorLingkungan === selectedKeplingAccount.nomorLingkungan ||
              a.namaKepling?.trim().toLowerCase() === selectedKeplingAccount.nama.trim().toLowerCase()
          )
        : weekAttendance;

      // 3. Kunjungan pada minggu ini
      const weekKunjungan = kunjunganList.filter((k) => isDateInWeek(k.tanggal || k.createdAt));
      const targetKunjungan = selectedKeplingAccount
        ? weekKunjungan.filter((k) => isKunjunganMatchingKepling(k, selectedKeplingAccount))
        : weekKunjungan;

      // Metrik Agregat
      let totalPerlinsos = 0;
      let totalPbb = 0;
      let poskamlingCount = 0;

      targetReports.forEach((r) => {
        totalPerlinsos += Number(r.kinerja?.perlinsos || 0);
        totalPbb += Number(r.kinerja?.pbb || 0);
        if (
          r.kinerja?.poskamlingAdaGiat === true ||
          (r.kinerja?.poskamlingStatus && r.kinerja.poskamlingStatus !== 'Tidak Ada') ||
          r.dokumentasiFoto?.some((f) => f.kategori === 'poskamling')
        ) {
          poskamlingCount++;
        }
      });

      const uniqueApelDays = new Set(
        weekAttendance.map((a) => a.date?.split('T')[0]).filter(Boolean)
      );
      const apelTotal = uniqueApelDays.size > 0 ? uniqueApelDays.size : Math.min(5, w.endDay - w.startDay + 1);
      const apelHadir = targetAttendance.filter(
        (a) => a.status === 'Hadir' || a.status === 'Dinas Luar'
      ).length;
      const apelRate = apelTotal > 0 ? Math.min(100, Math.round((apelHadir / apelTotal) * 100)) : 100;

      // Kunjungan
      const kunjunganCount = targetKunjungan.length;

      // Perhitungan Skor Mingguan (0 - 100)
      // Normalisasi skor mingguan proporsional
      const targetPerlinsosMinggu = selectedKeplingAccount ? 25 : 25 * 24; // ~100 KK per bulan / 4 minggu
      const targetPbbMinggu = selectedKeplingAccount ? 20 : 20 * 24;
      const targetKunjunganMinggu = selectedKeplingAccount ? 15 : 15 * 24;
      const targetPoskamlingMinggu = selectedKeplingAccount ? 2 : 2 * 24;

      const pPerlinsos = targetPerlinsosMinggu > 0 ? Math.min(100, (totalPerlinsos / targetPerlinsosMinggu) * 100) : 0;
      const pPbb = targetPbbMinggu > 0 ? Math.min(100, (totalPbb / targetPbbMinggu) * 100) : 0;
      const pKunjungan = targetKunjunganMinggu > 0 ? Math.min(100, (kunjunganCount / targetKunjunganMinggu) * 100) : 0;
      const pPoskamling = targetPoskamlingMinggu > 0 ? Math.min(100, (poskamlingCount / targetPoskamlingMinggu) * 100) : 0;

      const compScore = Math.min(
        100,
        Math.round(
          apelRate * 0.25 +
            pPerlinsos * 0.25 +
            pPbb * 0.2 +
            pKunjungan * 0.15 +
            pPoskamling * 0.15
        )
      );

      // Hitung Benchmark Kelurahan (Rata-rata 24 Lingkungan)
      const allWeekPerlinsos = weekReports.reduce((s, r) => s + (Number(r.kinerja?.perlinsos) || 0), 0) / 24;
      const allWeekPbb = weekReports.reduce((s, r) => s + (Number(r.kinerja?.pbb) || 0), 0) / 24;
      const allWeekApelHadir = weekAttendance.filter((a) => a.status === 'Hadir' || a.status === 'Dinas Luar').length / 24;
      const allWeekApelRate = apelTotal > 0 ? Math.min(100, Math.round((allWeekApelHadir / apelTotal) * 100)) : 80;

      const benchmarkScore = Math.min(
        100,
        Math.round(
          allWeekApelRate * 0.25 +
            Math.min(100, (allWeekPerlinsos / 25) * 100) * 0.25 +
            Math.min(100, (allWeekPbb / 20) * 100) * 0.2 +
            Math.min(100, ((weekKunjungan.length / 24) / 15) * 100) * 0.15 +
            70 * 0.15
        )
      );

      return {
        weekKey: w.key,
        label: w.label,
        rangeText,
        compositeScore: compScore,
        perlinsos: totalPerlinsos,
        pbb: totalPbb,
        kunjungan: kunjunganCount,
        laporanCount: targetReports.length,
        apelHadir,
        apelTotal,
        apelRate,
        avgKelurahanScore: benchmarkScore,
      };
    });
  }, [
    reports,
    attendanceList,
    kunjunganList,
    selectedYear,
    selectedMonth,
    selectedKeplingAccount,
  ]);

  // Evaluasi Konsistensi Mingguan
  const consistencyStats = useMemo(() => {
    const scores = weeklyTrendData.map((d) => d.compositeScore);
    if (scores.length === 0) return { avg: 0, status: 'Belum Ada Data', variance: 0, trend: 'STABLE' };

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const spread = max - min;

    const firstWeek = scores[0];
    const lastWeek = scores[scores.length - 1];
    const diff = lastWeek - firstWeek;

    let trendText = 'Konsisten & Stabil';
    let trendColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    let trendIcon = Activity;

    if (diff >= 10) {
      trendText = `Tren Meningkat (+${diff} Poin) 📈`;
      trendColor = 'text-emerald-800 bg-emerald-100 border-emerald-300';
    } else if (diff <= -10) {
      trendText = `Tren Menurun (${diff} Poin) ⚠️`;
      trendColor = 'text-amber-800 bg-amber-50 border-amber-300';
      trendIcon = AlertTriangle;
    } else if (spread <= 8) {
      trendText = 'Sangat Stabil & Konsisten ⭐';
      trendColor = 'text-blue-800 bg-blue-50 border-blue-200';
      trendIcon = CheckCircle2;
    }

    return {
      avg,
      min,
      max,
      spread,
      trendText,
      trendColor,
      trendIcon,
      diff,
    };
  }, [weeklyTrendData]);

  const monthLabel = BULAN_NAMES[selectedMonth - 1] || 'Bulan Ini';

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-5">
      {/* Header & Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Monitoring Tren Mingguan
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {monthLabel} {selectedYear}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title ||
              `Konsistensi Kinerja Mingguan: ${
                selectedKeplingAccount
                  ? `${selectedKeplingAccount.nama} (${selectedKeplingAccount.lingkungan})`
                  : 'Rata-Rata Seluruh 24 Lingkungan'
              }`}
          </h3>
          <p className="text-xs text-slate-500">
            Visualisasi fluktuasi capaian kinerja per minggu (Minggu I s/d Minggu IV/V) untuk evaluasi stabilitas pelayanan.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Pilih Bulan */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer pr-1"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector Kepling jika mode super_admin */}
          {mode === 'super_admin' && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={targetKeplingId}
                onChange={(e) => setTargetKeplingId(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">🌐 Seluruh 24 Lingkungan</option>
                {KEPLING_ACCOUNTS.map((k) => (
                  <option key={k.id} value={k.id}>
                    Lingk. {k.nomorLingkungan} - {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Benchmark Kelurahan */}
          <button
            type="button"
            onClick={() => setShowBenchmark(!showBenchmark)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showBenchmark
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Tampilkan / Sembunyikan garis pembanding rata-rata 24 Lingkungan Kelurahan Mangga"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>Benchmark Kelurahan</span>
          </button>
        </div>
      </div>

      {/* Metric Mode Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveMetricMode('COMPOSITE')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMetricMode === 'COMPOSITE'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Indeks Kinerja Komposit (0-100 Poin)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMetricMode('PERLINSOS_PBB')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMetricMode === 'PERLINSOS_PBB'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Perlinsos & Realisasi PBB</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMetricMode('ATTENDANCE_VISIT')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMetricMode === 'ATTENDANCE_VISIT'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Apel Pagi & Kunjungan Warga</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMetricMode('ALL_INDICATORS')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMetricMode === 'ALL_INDICATORS'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Semua Indikator Terpadu</span>
        </button>
      </div>

      {/* Summary KPI Cards Konsistensi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Rata-rata Skor Mingguan
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
            {consistencyStats.avg}
            <span className="text-xs font-semibold text-slate-500">/ 100</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">
            Bulan {monthLabel}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Penyebaran / Fluktuasi
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            ±{consistencyStats.spread}{' '}
            <span className="text-xs font-semibold text-slate-500">Poin</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Min: {consistencyStats.min} • Max: {consistencyStats.max}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 col-span-2 sm:col-span-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Analisis Konsistensi Kinerja
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${consistencyStats.trendColor}`}
            >
              <consistencyStats.trendIcon className="w-3.5 h-3.5 shrink-0" />
              {consistencyStats.trendText}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {consistencyStats.spread <= 8
              ? 'Kinerja mingguan sangat stabil dan terjaga merata di setiap minggu.'
              : consistencyStats.diff >= 0
              ? 'Kinerja menunjukkan tren positif yang meningkat menuju akhir bulan.'
              : 'Terjadi penurunan di minggu tertentu, periksa ritme pelaporan dan pendataan.'}
          </p>
        </div>
      </div>

      {/* Main Recharts Line Chart */}
      <div className="h-72 sm:h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={weeklyTrendData}
            margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              domain={[0, activeMetricMode === 'PERLINSOS_PBB' ? 'auto' : 100]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload as WeeklyDataPoint;
                return (
                  <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl border border-slate-800 text-xs min-w-[210px] space-y-2">
                    <div className="border-b border-slate-800 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{label}</span>
                        <span className="text-[10px] text-slate-400">{point?.rangeText}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Skor Komposit:
                        </span>
                        <span className="font-bold text-white text-sm">
                          {point?.compositeScore} Poin
                        </span>
                      </div>

                      {showBenchmark && point?.avgKelurahanScore !== undefined && (
                        <div className="flex items-center justify-between text-amber-300 text-[11px]">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            Rata2 Kelurahan:
                          </span>
                          <span className="font-bold">{point.avgKelurahanScore} Poin</span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span>📋 Perlinsos:</span>
                          <span className="font-bold text-white">{point?.perlinsos} KK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>💰 Realisasi PBB:</span>
                          <span className="font-bold text-white">{point?.pbb} WP</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🌅 Apel Pagi:</span>
                          <span className="font-bold text-white">{point?.apelRate}% ({point?.apelHadir}/{point?.apelTotal})</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🏠 Kunjungan:</span>
                          <span className="font-bold text-white">{point?.kunjungan} Rumah</span>
                        </div>
                        <div className="flex justify-between">
                          <span>📝 Laporan Masuk:</span>
                          <span className="font-bold text-white">{point?.laporanCount} Dok</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '10px' }}
            />

            {/* Target 80 Garis Referensi Standar Baik */}
            {activeMetricMode === 'COMPOSITE' && (
              <ReferenceLine
                y={80}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Standar Optimal (80)',
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Benchmark Rata-Rata Kelurahan (Garis Emas Putus-Putus) */}
            {showBenchmark && (activeMetricMode === 'COMPOSITE' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="avgKelurahanScore"
                name="Rata-rata 24 Lingkungan"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Garis Skor Komposit Utama */}
            {(activeMetricMode === 'COMPOSITE' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="compositeScore"
                name="Skor Komposit (%)"
                stroke="#059669"
                strokeWidth={3.5}
                dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#059669', strokeWidth: 2 }}
              />
            )}

            {/* Garis Perlinsos */}
            {(activeMetricMode === 'PERLINSOS_PBB' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="perlinsos"
                name="Perlinsos (KK)"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563eb' }}
              />
            )}

            {/* Garis PBB */}
            {(activeMetricMode === 'PERLINSOS_PBB' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="pbb"
                name="Realisasi PBB (WP)"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#8b5cf6' }}
              />
            )}

            {/* Garis Apel */}
            {(activeMetricMode === 'ATTENDANCE_VISIT' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="apelRate"
                name="Kehadiran Apel (%)"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0284c7' }}
              />
            )}

            {/* Garis Kunjungan Warga */}
            {(activeMetricMode === 'ATTENDANCE_VISIT' || activeMetricMode === 'ALL_INDICATORS') && (
              <Line
                type="monotone"
                dataKey="kunjungan"
                name="Kunjungan Warga"
                stroke="#d97706"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#d97706' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rincian Tabel Mingguan di Bawah Grafik */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="text-[10px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="px-3.5 py-2.5">Minggu</th>
              <th className="px-3.5 py-2.5">Rentang Tanggal</th>
              <th className="px-3.5 py-2.5 text-center">Skor Komposit</th>
              <th className="px-3.5 py-2.5 text-center">Perlinsos</th>
              <th className="px-3.5 py-2.5 text-center">PBB</th>
              <th className="px-3.5 py-2.5 text-center">Apel</th>
              <th className="px-3.5 py-2.5 text-center">Kunjungan</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {weeklyTrendData.map((w, idx) => {
              const isTopWeek = w.compositeScore === consistencyStats.max && w.compositeScore > 0;
              return (
                <tr
                  key={w.weekKey}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isTopWeek ? 'bg-emerald-50/40 font-medium' : ''
                  }`}
                >
                  <td className="px-3.5 py-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                    {w.label}
                    {isTopWeek && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold">
                        Tertinggi
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-500">{w.rangeText}</td>
                  <td className="px-3.5 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                        w.compositeScore >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : w.compositeScore >= 60
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {w.compositeScore}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                    {w.perlinsos} KK
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                    {w.pbb} WP
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                    {w.apelRate}% ({w.apelHadir}/{w.apelTotal})
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                    {w.kunjungan}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    {w.compositeScore >= 80 ? (
                      <span className="text-emerald-700 font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Optimal
                      </span>
                    ) : w.compositeScore >= 60 ? (
                      <span className="text-blue-700 font-semibold">Cukup</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Perlu Perhatian Khusus</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
