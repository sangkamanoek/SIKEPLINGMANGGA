import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  HeartHandshake,
  Users,
  Calendar,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  TrendingUp,
  Award,
  AlertTriangle,
  UserX,
  Building2,
  Heart,
  ChevronRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LaporanHarianItem, TargetsCapaianMap, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface DashboardPerlinsosKasiProps {
  reports: LaporanHarianItem[];
  targetsMap: TargetsCapaianMap;
  currentUser: UserAccount;
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
  onOpenKunjunganWarga?: () => void;
}

type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export const DashboardPerlinsosKasi: React.FC<DashboardPerlinsosKasiProps> = ({
  reports,
  targetsMap,
  currentUser,
  onSelectKeplingRiwayat,
  onOpenKunjunganWarga,
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

  // 2. Aggregate Perlinsos stats per Kepling
  const keplingPerlinsosStats = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const keplingReports = filteredReports.filter(
        (r) =>
          r.namaKepling?.trim().toLowerCase() === kepling.nama.trim().toLowerCase() ||
          r.lingkungan?.trim().toLowerCase() === kepling.lingkungan.trim().toLowerCase()
      );

      // Reported Perlinsos KK
      const reportedKk = keplingReports.reduce((sum, r) => {
        const val = Number(r.perlinsosKk || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Reported BPJS TK
      const reportedBpjs = keplingReports.reduce((sum, r) => {
        const val = Number(r.bpjsKetenagakerjaan || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Category breakdown
      let pendataanCount = 0;
      let pengecekanCount = 0;
      let verifikasiCount = 0;
      let menolakKk = 0;
      let tidakDiTempatKk = 0;

      keplingReports.forEach((r) => {
        if (r.kategoriPerlinsos === 'pendataan') pendataanCount += Number(r.perlinsosKk || 0);
        if (r.kategoriPerlinsos === 'pengecekan') pengecekanCount += Number(r.perlinsosKk || 0);
        if (r.kategoriPerlinsos === 'verifikasi') verifikasiCount += Number(r.perlinsosKk || 0);
        if (r.wargaMenolak) menolakKk += Number(r.wargaMenolakCount || 1);
        if (r.wargaTidakDiTempat) tidakDiTempatKk += Number(r.wargaTidakDiTempatCount || 1);
      });

      // Target configuration from targetsMap
      const targetConfig = targetsMap[kepling.id];
      const targetPerlinsos = targetConfig?.targetPerlinsos || 300; // default 300 KK

      // Total Perlinsos (with admin baseline override if in all-time view)
      let totalPerlinsos = reportedKk;
      let isOverridden = false;
      if (period === 'all' && targetConfig?.capaianPerlinsosManual !== undefined) {
        totalPerlinsos = targetConfig.capaianPerlinsosManual;
        isOverridden = true;
      }

      const perlinsosPercentage =
        targetPerlinsos > 0 ? Math.round((totalPerlinsos / targetPerlinsos) * 100) : 0;

      // Find latest Perlinsos report note
      const latestPerlinsosReport = [...keplingReports]
        .filter((r) => r.perlinsosKk && Number(r.perlinsosKk) > 0)
        .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0];

      const latestNote =
        latestPerlinsosReport?.uraianPerlinsos ||
        latestPerlinsosReport?.uraianTugas ||
        latestPerlinsosReport?.catatanUmum ||
        '-';

      return {
        kepling,
        reportedKk,
        totalPerlinsos,
        targetPerlinsos,
        perlinsosPercentage,
        reportedBpjs,
        pendataanCount,
        pengecekanCount,
        verifikasiCount,
        menolakKk,
        tidakDiTempatKk,
        reportCount: keplingReports.length,
        perlinsosReportCount: keplingReports.filter((r) => Number(r.perlinsosKk || 0) > 0).length,
        latestNote,
        isOverridden,
      };
    });
  }, [filteredReports, targetsMap, period]);

  // 3. Overall Totals
  const overallTotals = useMemo(() => {
    const totalKk = keplingPerlinsosStats.reduce((sum, k) => sum + k.totalPerlinsos, 0);
    const totalTarget = keplingPerlinsosStats.reduce((sum, k) => sum + k.targetPerlinsos, 0);
    const totalBpjs = keplingPerlinsosStats.reduce((sum, k) => sum + k.reportedBpjs, 0);
    const totalMenolak = keplingPerlinsosStats.reduce((sum, k) => sum + k.menolakKk, 0);
    const totalTidakDiTempat = keplingPerlinsosStats.reduce((sum, k) => sum + k.tidakDiTempatKk, 0);
    const overallPercentage = totalTarget > 0 ? Math.round((totalKk / totalTarget) * 100) : 0;
    const activeKeplingCount = keplingPerlinsosStats.filter((k) => k.totalPerlinsos > 0).length;

    return {
      totalKk,
      totalTarget,
      totalBpjs,
      totalMenolak,
      totalTidakDiTempat,
      overallPercentage,
      activeKeplingCount,
    };
  }, [keplingPerlinsosStats]);

  // 4. Sorted Leaderboard (highest % first)
  const sortedLeaderboard = useMemo(() => {
    return [...keplingPerlinsosStats].sort((a, b) => {
      if (b.perlinsosPercentage !== a.perlinsosPercentage) {
        return b.perlinsosPercentage - a.perlinsosPercentage;
      }
      return b.totalPerlinsos - a.totalPerlinsos;
    });
  }, [keplingPerlinsosStats]);

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
    const excelData = sortedLeaderboard.map((item, idx) => ({
      'No / Peringkat': idx + 1,
      'Lingkungan': item.kepling.lingkungan,
      'Nama Kepala Lingkungan': item.kepling.nama,
      'Realisasi Perlinsos (KK)': item.totalPerlinsos,
      'Target Perlinsos (KK)': item.targetPerlinsos,
      'Persentase Capaian (%)': `${item.perlinsosPercentage}%`,
      'BPJS Ketenagakerjaan (Org)': item.reportedBpjs,
      'Warga Menolak (KK)': item.menolakKk,
      'Warga Tidak di Tempat (KK)': item.tidakDiTempatKk,
      'Jumlah Laporan Masuk': item.reportCount,
      'Keterangan Realisasi Terakhir': item.latestNote,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekapitulasi Perlinsos');

    const colWidths = [
      { wch: 15 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 26 },
      { wch: 20 },
      { wch: 25 },
      { wch: 22 },
      { wch: 45 },
    ];
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Perlinsos_Kelurahan_Mangga_${dateStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner Khusus Seksi Pembangunan */}
      <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-800/60 border border-blue-500/40 text-blue-200 text-xs font-bold mb-3">
              <HeartHandshake className="w-3.5 h-3.5 text-blue-300" />
              <span>Seksi Pembangunan & Pemberdayaan Masyarakat • Kelurahan Mangga</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Dashboard Laporan Perlindungan Sosial (PERLINSOS)
            </h2>
            <p className="text-blue-100/90 text-sm mt-1 max-w-2xl">
              Monitoring capaian target pendataan KK rentan, verifikasi bansos, data warga menolak, dan perlindungan BPJS Ketenagakerjaan 24 Lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenKunjunganWarga && (
              <button
                type="button"
                onClick={onOpenKunjunganWarga}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all cursor-pointer border border-blue-400/40"
                title="Buka Rekap Kunjungan Harian Warga"
              >
                <Users className="w-4 h-4 text-blue-200" />
                <span>Kunjungan Warga Rentan</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-950 font-black text-xs hover:bg-blue-50 shadow-md transition-all cursor-pointer"
              title="Unduh Rekap Excel Perlinsos 24 Kepling"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-800/80 hover:bg-blue-700/80 text-white font-bold text-xs border border-blue-500/40 transition-all cursor-pointer"
              title="Cetak format cetak resmi Seksi Pembangunan"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* Filter Periode */}
        <div className="mt-6 pt-5 border-t border-blue-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-blue-950/50 p-1 rounded-xl border border-blue-700/60">
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'all'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'today'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === '7days'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'month'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <div className="text-xs text-blue-200 font-medium">
            Terekam dari <span className="font-bold text-white">{filteredReports.length}</span> laporan harian
          </div>
        </div>
      </div>

      {/* KPI Cards Ringkasan Perlinsos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Realisasi KK */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Realisasi Perlinsos
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.totalKk.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-blue-700">Kepala Keluarga (KK)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Target Kelurahan:</span>
            <span className="font-bold text-slate-800">{overallTotals.totalTarget.toLocaleString('id-ID')} KK</span>
          </div>
        </div>

        {/* Card 2: Persentase Capaian Target */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Persentase Capaian
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
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
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(overallTotals.overallPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Warga Menolak / Tidak di Tempat */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kendala Pendataan
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-black text-amber-900">
                {overallTotals.totalMenolak}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 ml-1">Menolak</span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-2xl font-black text-slate-700">
                {overallTotals.totalTidakDiTempat}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 ml-1">Tdk di tempat</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
            Perlu tindak lanjut verifikasi ulang kepling
          </div>
        </div>

        {/* Card 4: BPJS Ketenagakerjaan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              BPJS Ketenagakerjaan
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {overallTotals.totalBpjs}
            </span>
            <span className="text-xs font-semibold text-slate-500">Pekerja Rentan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Kepling aktif:</span>
            <span className="font-bold text-slate-800">{overallTotals.activeKeplingCount} / 24</span>
          </div>
        </div>
      </div>

      {/* Podium Top 3 Kepling Perlinsos */}
      {sortedLeaderboard.length >= 3 && sortedLeaderboard[0].totalPerlinsos > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-black text-slate-900">
              Top 3 Kepling Capaian Perlinsos Tertinggi
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Juara 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-black mb-3">
                  🥈 Peringkat 2
                </span>
                <div className="text-3xl font-black text-blue-900">
                  {sortedLeaderboard[1].perlinsosPercentage}%
                </div>
                <div className="text-xs font-bold text-slate-600 mt-1">
                  {sortedLeaderboard[1].totalPerlinsos} / {sortedLeaderboard[1].targetPerlinsos} KK
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">{sortedLeaderboard[1].kepling.nama}</h4>
                <p className="text-xs text-slate-500 font-semibold">{sortedLeaderboard[1].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                BPJS TK: <strong>{sortedLeaderboard[1].reportedBpjs} Org</strong>
              </div>
            </div>

            {/* Juara 1 */}
            <div className="p-5 rounded-2xl bg-linear-to-b from-blue-50/80 to-indigo-50/50 border-2 border-blue-400 text-center relative overflow-hidden shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block px-3.5 py-1 rounded-full bg-blue-600 text-white text-xs font-black mb-3 shadow-xs">
                  🥇 PERINGKAT 1 TERTINGGI
                </span>
                <div className="text-4xl font-black text-blue-950">
                  {sortedLeaderboard[0].perlinsosPercentage}%
                </div>
                <div className="text-sm font-black text-blue-800 mt-1">
                  {sortedLeaderboard[0].totalPerlinsos} / {sortedLeaderboard[0].targetPerlinsos} KK
                </div>
                <h4 className="font-black text-slate-900 text-base mt-2">{sortedLeaderboard[0].kepling.nama}</h4>
                <p className="text-xs text-blue-800 font-bold">{sortedLeaderboard[0].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-200 text-xs text-slate-600 font-semibold">
                BPJS TK: <strong>{sortedLeaderboard[0].reportedBpjs} Org</strong> • {sortedLeaderboard[0].reportCount} Laporan
              </div>
            </div>

            {/* Juara 3 */}
            <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 text-center flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-black mb-3">
                  🥉 Peringkat 3
                </span>
                <div className="text-3xl font-black text-amber-950">
                  {sortedLeaderboard[2].perlinsosPercentage}%
                </div>
                <div className="text-xs font-bold text-slate-600 mt-1">
                  {sortedLeaderboard[2].totalPerlinsos} / {sortedLeaderboard[2].targetPerlinsos} KK
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">{sortedLeaderboard[2].kepling.nama}</h4>
                <p className="text-xs text-slate-500 font-semibold">{sortedLeaderboard[2].kepling.lingkungan}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 text-xs text-slate-500">
                BPJS TK: <strong>{sortedLeaderboard[2].reportedBpjs} Org</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Detail Realisasi Perlinsos 24 Kepling */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-blue-700" />
              <span>Rekapitulasi Capaian Perlinsos 24 Kepala Lingkungan</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Urutan berdasarkan persentase ketercapaian target perlindungan sosial tertinggi
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari lingkungan / nama kepling..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Kepala Lingkungan</th>
                <th className="py-3 px-4 text-center bg-blue-50/60 text-blue-950">Capaian Perlinsos (%)</th>
                <th className="py-3 px-4 text-center">Realisasi / Target</th>
                <th className="py-3 px-4 text-center">BPJS TK</th>
                <th className="py-3 px-4 text-center">Menolak / Tdk Ditempat</th>
                <th className="py-3 px-4">Catatan Lapangan Terakhir</th>
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

                  <td className="py-3 px-4 text-center bg-blue-50/30">
                    <span
                      className={`inline-block text-xs font-black px-2.5 py-1 rounded-full ${
                        item.perlinsosPercentage >= 100
                          ? 'bg-emerald-600 text-white'
                          : item.perlinsosPercentage >= 50
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {item.perlinsosPercentage}%
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="text-xs font-bold text-slate-800">
                      {item.totalPerlinsos} <span className="text-slate-400 font-normal">/ {item.targetPerlinsos} KK</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      {item.reportedBpjs} Org
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.menolakKk > 0 || item.tidakDiTempatKk > 0 ? (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {item.menolakKk} T / {item.tidakDiTempatKk} N
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">-</span>
                    )}
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-[11px] text-slate-600 truncate font-medium" title={item.latestNote}>
                      {item.latestNote}
                    </p>
                  </td>

                  <td className="py-3 px-4 text-right">
                    {onSelectKeplingRiwayat && (
                      <button
                        type="button"
                        onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition-colors cursor-pointer border border-blue-200"
                        title="Lihat riwayat laporan Perlinsos kepling ini"
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
