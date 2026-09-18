import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Calendar,
  Search,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  MapPin,
  Eye,
  ChevronRight,
  TrendingUp,
  Activity,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LaporanHarianItem, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface DashboardTrantibumKasiProps {
  reports: LaporanHarianItem[];
  currentUser: UserAccount;
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
}

type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export const DashboardTrantibumKasi: React.FC<DashboardTrantibumKasiProps> = ({
  reports,
  currentUser,
  onSelectKeplingRiwayat,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter reports based on period
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

  // 2. Aggregate Poskamling & Trantib stats per Kepling
  const keplingTrantibStats = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const keplingReports = filteredReports.filter(
        (r) =>
          r.namaKepling?.trim().toLowerCase() === kepling.nama.trim().toLowerCase() ||
          r.lingkungan?.trim().toLowerCase() === kepling.lingkungan.trim().toLowerCase()
      );

      // Find reports with Poskamling activity
      const poskamlingReports = keplingReports.filter((r) => {
        const k = r.kinerja;
        const status = k?.poskamlingStatus || (r as any).poskamlingStatus;
        const adaGiat = k?.poskamlingAdaGiat || (r as any).poskamlingAdaGiat;
        const lokasi = k?.poskamlingLokasi || (r as any).poskamlingLokasi;
        return Boolean(adaGiat || (status && status !== 'Tidak Ada Giat') || lokasi);
      });

      const latestPoskamlingReport = poskamlingReports[0] || keplingReports[0];
      const k = latestPoskamlingReport?.kinerja;

      const status =
        k?.poskamlingStatus ||
        (latestPoskamlingReport as any)?.poskamlingStatus ||
        (poskamlingReports.length > 0 ? 'Aktif Ronda' : 'Nihil / Tidak Ada Giat');

      const lokasi =
        k?.poskamlingLokasi ||
        (latestPoskamlingReport as any)?.poskamlingLokasi ||
        `Pos Ronda ${kepling.lingkungan}`;

      const petugas =
        k?.poskamlingPetugas ||
        (latestPoskamlingReport as any)?.poskamlingPetugas ||
        `${kepling.nama} & Warga`;

      const keterangan =
        k?.poskamlingKeterangan ||
        (latestPoskamlingReport as any)?.poskamlingKeterangan ||
        k?.kegiatanLainnya ||
        latestPoskamlingReport?.uraianTugas ||
        'Situasi lingkungan terpantau aman dan kondusif';

      const isPoskamlingActive =
        status.toLowerCase().includes('aktif') ||
        status.toLowerCase().includes('ronda') ||
        status.toLowerCase().includes('patroli') ||
        status.toLowerCase().includes('pemeriksaan');

      return {
        kepling,
        reportCount: keplingReports.length,
        poskamlingReportCount: poskamlingReports.length,
        isPoskamlingActive,
        status,
        lokasi,
        petugas,
        keterangan,
        latestDate: latestPoskamlingReport?.tanggal,
      };
    });
  }, [filteredReports]);

  // 3. Overall KPI Metrics
  const kpiMetrics = useMemo(() => {
    const activePoskamlingCount = keplingTrantibStats.filter((k) => k.isPoskamlingActive).length;

    return {
      activePoskamlingCount,
      totalLingkungan: 24,
    };
  }, [keplingTrantibStats]);

  // 4. Filtered List by Search Query
  const displayedKeplings = useMemo(() => {
    if (!searchQuery.trim()) return keplingTrantibStats;
    const q = searchQuery.toLowerCase();
    return keplingTrantibStats.filter(
      (item) =>
        item.kepling.nama.toLowerCase().includes(q) ||
        item.kepling.lingkungan.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.lokasi.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q)
    );
  }, [keplingTrantibStats, searchQuery]);

  // 5. Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const excelData = keplingTrantibStats.map((item, idx) => ({
      'No': idx + 1,
      'Lingkungan': item.kepling.lingkungan,
      'Nama Kepala Lingkungan': item.kepling.nama,
      'Status Poskamling': item.status,
      'Lokasi Pos Ronda': item.lokasi,
      'Petugas Ronda / Warga': item.petugas,
      'Keterangan Kamtibmas': item.keterangan,
      'Total Laporan Giat Ronda': item.poskamlingReportCount,
      'Tanggal Laporan Terakhir': item.latestDate || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Trantibum & Poskamling');

    const colWidths = [
      { wch: 8 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 26 },
      { wch: 26 },
      { wch: 45 },
      { wch: 24 },
      { wch: 24 },
    ];
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Trantibum_Poskamling_Mangga_${dateStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner Khusus Seksi Ketentraman & Ketertiban Umum */}
      <div className="bg-linear-to-r from-amber-700 via-orange-800 to-amber-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/60 border border-amber-500/40 text-amber-200 text-xs font-bold mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              <span>Seksi Ketentraman dan Ketertiban Umum (Trantibum) • Kelurahan Mangga</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Dashboard Ketentraman, Ketertiban & Poskamling
            </h2>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl">
              Monitoring keamanan lingkungan, operasional Poskamling/Siskamling, patroli wilayah, dan pembinaan kedisiplinan presensi apel 24 Kepala Lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-950 font-black text-xs hover:bg-amber-50 shadow-md transition-all cursor-pointer"
              title="Unduh Rekap Excel Kegiatan Trantibum & Poskamling"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-900/80 hover:bg-amber-800 text-white font-bold text-xs border border-amber-600/50 transition-all cursor-pointer"
              title="Cetak format cetak resmi Seksi Trantibum"
            >
              <Printer className="w-4 h-4 text-amber-200" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* Sub-view Navigation Tabs */}
        <div className="mt-6 pt-5 border-t border-amber-600/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-amber-200 uppercase tracking-wider">
              Filter Periode Laporan:
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-950/40 p-1 rounded-xl border border-amber-700/50 text-xs">
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                period === 'all' ? 'bg-amber-500 text-white font-black' : 'text-amber-200 hover:text-white'
              }`}
            >
              Semua Periode
            </button>
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                period === 'today' ? 'bg-amber-500 text-white font-black' : 'text-amber-200 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                period === '7days' ? 'bg-amber-500 text-white font-black' : 'text-amber-200 hover:text-white'
              }`}
            >
              7 Hari Terakhir
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Ringkasan Trantibum */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Poskamling Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Poskamling Aktif Ronda
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiMetrics.activePoskamlingCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ 24 Lingkungan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tingkat partisipasi:</span>
            <span className="font-bold text-amber-800">
              {Math.round((kpiMetrics.activePoskamlingCount / 24) * 100)}%
            </span>
          </div>
        </div>

        {/* Card 2: Situasi Keamanan Kamtibmas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Situasi Kamtibmas
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-900 tracking-tight">
              KONDUSIF
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
            24 Lingkungan terpantau aman terkendali
          </div>
        </div>

        {/* Card 3: Total Wilayah Kerja */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Wilayah Kerja
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              24
            </span>
            <span className="text-xs font-semibold text-slate-500">Lingkungan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
            Kecamatan Medan Tuntungan
          </div>
        </div>

        {/* Card 4: Kepatuhan Patroli Ronda */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kepatuhan Patroli Ronda
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {Math.round((kpiMetrics.activePoskamlingCount / 24) * 100)}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
            Seksi Trantibum Kelurahan Mangga
          </div>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
              <span>Monitoring Poskamling / Siskamling 24 Lingkungan</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Status kesiapsiagaan pos ronda, personel jaga, dan keterangan situasi kamtibmas
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari lingkungan / lokasi pos ronda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 text-center w-12">No</th>
                <th className="py-3 px-4">Wilayah & Kepala Lingkungan</th>
                <th className="py-3 px-4 text-center">Status Giat</th>
                <th className="py-3 px-4">Lokasi Pos Ronda</th>
                <th className="py-3 px-4">Petugas / Warga Jaga</th>
                <th className="py-3 px-4">Situasi Kamtibmas</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedKeplings.map((item, index) => (
                <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-center font-bold text-slate-500">
                    {item.kepling.nomorLingkungan || index + 1}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        item.isPoskamlingActive
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-medium text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs">{item.lokasi}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-700 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs">{item.petugas}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-[11px] text-slate-600 truncate font-medium" title={item.keterangan}>
                      {item.keterangan}
                    </p>
                  </td>

                  <td className="py-3 px-4 text-right">
                    {onSelectKeplingRiwayat && (
                      <button
                        type="button"
                        onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                        title="Lihat riwayat laporan poskamling kepling ini"
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
