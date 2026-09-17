import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Calendar,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Award,
  ChevronRight,
  ExternalLink,
  Users,
  Building2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LaporanHarianItem, TargetsCapaianMap, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface DashboardPbbKasiProps {
  reports: LaporanHarianItem[];
  targetsMap: TargetsCapaianMap;
  currentUser: UserAccount;
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
}

type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export const DashboardPbbKasi: React.FC<DashboardPbbKasiProps> = ({
  reports,
  targetsMap,
  currentUser,
  onSelectKeplingRiwayat,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter reports based on selected period
  const filteredReports = useMemo(() => {
    if (period === 'all') return reports;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return reports.filter((r) => {
      if (!r.tanggal) return false;
      const reportDate = r.tanggal.split('T')[0];

      if (period === 'today') {
        return reportDate === todayStr;
      }

      if (period === '7days') {
        const diffTime = now.getTime() - new Date(reportDate).getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      if (period === 'month') {
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return reportDate.startsWith(currentMonth);
      }

      return true;
    });
  }, [reports, period]);

  // 2. Aggregate PBB stats per Kepling
  const keplingPbbStats = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const keplingReports = filteredReports.filter(
        (r) =>
          r.namaKepling?.trim().toLowerCase() === kepling.nama.trim().toLowerCase() ||
          r.lingkungan?.trim().toLowerCase() === kepling.lingkungan.trim().toLowerCase()
      );

      // Total WP from reports in this period
      const reportedPbbWp = keplingReports.reduce((sum, r) => {
        const val = Number(r.opsirPbbWp || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Target configuration from targetsMap
      const targetConfig = targetsMap[kepling.id];
      const targetPbb = targetConfig?.targetPbb || 100; // default 100 WP

      // Total PBB (with admin baseline override if in all-time view)
      let totalPbb = reportedPbbWp;
      let isOverridden = false;
      if (period === 'all' && targetConfig?.capaianPbbManual !== undefined) {
        totalPbb = targetConfig.capaianPbbManual;
        isOverridden = true;
      }

      const pbbPercentage = targetPbb > 0 ? Math.round((totalPbb / targetPbb) * 100) : 0;

      // Find latest PBB note
      const latestPbbReport = [...keplingReports]
        .filter((r) => r.opsirPbbWp && Number(r.opsirPbbWp) > 0)
        .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0];

      const latestNote =
        latestPbbReport?.uraianPbb ||
        latestPbbReport?.uraianTugas ||
        latestPbbReport?.catatanUmum ||
        '-';

      return {
        kepling,
        reportedPbbWp,
        totalPbb,
        targetPbb,
        pbbPercentage,
        reportCount: keplingReports.length,
        pbbReportCount: keplingReports.filter((r) => Number(r.opsirPbbWp || 0) > 0).length,
        latestNote,
        latestDate: keplingReports[0]?.tanggal,
        isOverridden,
      };
    });
  }, [filteredReports, targetsMap, period]);

  // 3. Overall Totals
  const overallTotals = useMemo(() => {
    const totalWp = keplingPbbStats.reduce((sum, k) => sum + k.totalPbb, 0);
    const totalTarget = keplingPbbStats.reduce((sum, k) => sum + k.targetPbb, 0);
    const activeKeplingCount = keplingPbbStats.filter((k) => k.totalPbb > 0).length;
    const overallPercentage = totalTarget > 0 ? Math.round((totalWp / totalTarget) * 100) : 0;
    const avgWpPerKepling = Math.round(totalWp / 24);

    return {
      totalWp,
      totalTarget,
      activeKeplingCount,
      overallPercentage,
      avgWpPerKepling,
    };
  }, [keplingPbbStats]);

  // 4. Sorted Leaderboard (highest PBB first)
  const sortedLeaderboard = useMemo(() => {
    return [...keplingPbbStats].sort((a, b) => {
      if (b.totalPbb !== a.totalPbb) return b.totalPbb - a.totalPbb;
      return (a.kepling.nomorLingkungan || 0) - (b.kepling.nomorLingkungan || 0);
    });
  }, [keplingPbbStats]);

  // 5. Filtered list by search query
  const displayedKeplings = useMemo(() => {
    if (!searchQuery.trim()) return sortedLeaderboard;
    const q = searchQuery.toLowerCase();
    return sortedLeaderboard.filter(
      (item) =>
        item.kepling.nama.toLowerCase().includes(q) ||
        item.kepling.lingkungan.toLowerCase().includes(q) ||
        item.latestNote.toLowerCase().includes(q)
    );
  }, [sortedLeaderboard, searchQuery]);

  // 6. Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const periodLabel =
      period === 'today'
        ? 'Hari Ini'
        : period === '7days'
        ? '7 Hari Terakhir'
        : period === 'month'
        ? 'Bulan Ini'
        : 'Semua Periode';

    const excelData = sortedLeaderboard.map((item, idx) => ({
      'No / Peringkat': idx + 1,
      'Lingkungan': item.kepling.lingkungan,
      'Nama Kepala Lingkungan': item.kepling.nama,
      'Realisasi Opsir PBB (WP)': item.totalPbb,
      'Target PBB (WP)': item.targetPbb,
      'Persentase Capaian (%)': `${item.pbbPercentage}%`,
      'Jumlah Laporan Masuk': item.reportCount,
      'Laporan Berisi PBB': item.pbbReportCount,
      'Keterangan Realisasi PBB Terakhir': item.latestNote,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekapitulasi PBB');

    // Auto-fit column widths
    const colWidths = [
      { wch: 15 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 45 },
    ];
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_PBB_Kelurahan_Mangga_${dateStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner Khusus Seksi Pemerintahan */}
      <div className="bg-linear-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold mb-3">
              <Landmark className="w-3.5 h-3.5 text-emerald-300" />
              <span>Seksi Tata Pemerintahan • Kelurahan Mangga</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Dashboard Laporan Pajak Bumi & Bangunan (PBB)
            </h2>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-2xl">
              Monitoring realisasi opsir PBB, pelaporan penyampaian SPPT, dan penagihan Wajib Pajak (WP) oleh 24 Kepala Lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-950 font-black text-xs hover:bg-emerald-50 shadow-md transition-all cursor-pointer"
              title="Unduh Rekap Excel Laporan PBB 24 Kepling"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Ekspor Rekap Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600/80 text-white font-bold text-xs border border-emerald-500/40 transition-all cursor-pointer"
              title="Cetak format cetak resmi Seksi Pemerintahan"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* Filter Periode */}
        <div className="mt-6 pt-5 border-t border-emerald-700/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-950/40 p-1 rounded-xl border border-emerald-700/60">
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'all'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'today'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === '7days'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'month'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <div className="text-xs text-emerald-200 font-medium">
            Menampilkan data dari <span className="font-bold text-white">{filteredReports.length}</span> laporan harian
          </div>
        </div>
      </div>

      {/* KPI Cards Ringkasan PBB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Realisasi WP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Realisasi PBB
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.totalWp.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-emerald-700">Wajib Pajak (WP)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Target Kelurahan:</span>
            <span className="font-bold text-slate-800">{overallTotals.totalTarget.toLocaleString('id-ID')} WP</span>
          </div>
        </div>

        {/* Card 2: Persentase Ketercapaian */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Capaian Target PBB
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.overallPercentage}%
            </span>
            <span className="text-xs font-semibold text-slate-500">tercapai</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 w-full">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(overallTotals.overallPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Kepling Aktif PBB */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kepling Melaporkan PBB
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.activeKeplingCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ 24 Lingkungan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tingkat partisipasi:</span>
            <span className="font-bold text-blue-800">
              {Math.round((overallTotals.activeKeplingCount / 24) * 100)}%
            </span>
          </div>
        </div>

        {/* Card 4: Rata-rata WP per Lingkungan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rata-rata Realisasi
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.avgWpPerKepling}
            </span>
            <span className="text-xs font-semibold text-slate-500">WP / Lingkungan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tertinggi:</span>
            <span className="font-bold text-amber-800">
              {sortedLeaderboard[0]?.kepling.lingkungan} ({sortedLeaderboard[0]?.totalPbb} WP)
            </span>
          </div>
        </div>
      </div>

      {/* Podium Top 3 Kepling PBB */}
      {sortedLeaderboard.length >= 3 && sortedLeaderboard[0].totalPbb > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-slate-900">
              Top 3 Kepling Peraih Opsir PBB Terbanyak
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Juara 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-black mb-3">
                  🥈 Peringkat 2
                </span>
                <div className="text-3xl font-black text-slate-800">
                  {sortedLeaderboard[1].totalPbb} <span className="text-sm font-bold text-slate-400">WP</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">{sortedLeaderboard[1].kepling.nama}</h4>
                <p className="text-xs text-slate-500 font-semibold">{sortedLeaderboard[1].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                Target: <strong>{sortedLeaderboard[1].targetPbb} WP</strong> ({sortedLeaderboard[1].pbbPercentage}%)
              </div>
            </div>

            {/* Juara 1 */}
            <div className="p-5 rounded-2xl bg-linear-to-b from-amber-50/70 to-emerald-50/40 border-2 border-amber-300 text-center relative overflow-hidden shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black mb-3 shadow-xs">
                  🥇 PERINGKAT 1 TERBAIK
                </span>
                <div className="text-4xl font-black text-emerald-900">
                  {sortedLeaderboard[0].totalPbb} <span className="text-base font-bold text-emerald-600">WP</span>
                </div>
                <h4 className="font-black text-slate-900 text-base mt-2">{sortedLeaderboard[0].kepling.nama}</h4>
                <p className="text-xs text-emerald-800 font-bold">{sortedLeaderboard[0].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 text-xs text-slate-600 font-semibold">
                Target: <strong>{sortedLeaderboard[0].targetPbb} WP</strong> ({sortedLeaderboard[0].pbbPercentage}%) • {sortedLeaderboard[0].reportCount} Laporan
              </div>
            </div>

            {/* Juara 3 */}
            <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 text-center flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-black mb-3">
                  🥉 Peringkat 3
                </span>
                <div className="text-3xl font-black text-amber-950">
                  {sortedLeaderboard[2].totalPbb} <span className="text-sm font-bold text-amber-700">WP</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">{sortedLeaderboard[2].kepling.nama}</h4>
                <p className="text-xs text-slate-500 font-semibold">{sortedLeaderboard[2].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 text-xs text-slate-500">
                Target: <strong>{sortedLeaderboard[2].targetPbb} WP</strong> ({sortedLeaderboard[2].pbbPercentage}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Detail Realisasi PBB 24 Kepling */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-700" />
              <span>Rekapitulasi Realisasi PBB 24 Kepala Lingkungan</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Urutan berdasarkan jumlah perolehan Wajib Pajak (WP) tertinggi
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari lingkungan / nama kepling..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Kepala Lingkungan</th>
                <th className="py-3 px-4 text-center bg-emerald-50/60 text-emerald-900">Realisasi PBB (WP)</th>
                <th className="py-3 px-4 text-center">Target & Capaian</th>
                <th className="py-3 px-4">Keterangan / Uraian Terakhir</th>
                <th className="py-3 px-4 text-center">Status Lapor</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedKeplings.map((item, index) => (
                <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                        index === 0
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                          : index === 1
                          ? 'bg-slate-300 text-slate-900'
                          : index === 2
                          ? 'bg-amber-200 text-amber-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                  </td>

                  <td className="py-3 px-4 text-center bg-emerald-50/30">
                    <div className="text-sm font-black text-emerald-900">
                      {item.totalPbb} <span className="text-[10px] font-bold text-emerald-700">WP</span>
                    </div>
                    {item.isOverridden && (
                      <span className="text-[9px] text-amber-600 font-semibold">(Manual Admin)</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="text-[11px] font-bold text-slate-700">
                      {item.totalPbb} / {item.targetPbb} WP
                    </div>
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${Math.min(item.pbbPercentage, 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-emerald-800 mt-0.5">
                      {item.pbbPercentage}%
                    </div>
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-[11px] text-slate-600 truncate font-medium" title={item.latestNote}>
                      {item.latestNote}
                    </p>
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.reportCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{item.reportCount} Laporan</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 font-semibold text-[11px]">
                        Belum Lapor
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    {onSelectKeplingRiwayat && (
                      <button
                        type="button"
                        onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
                        title="Lihat riwayat laporan PBB kepling ini"
                      >
                        Riwayat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
