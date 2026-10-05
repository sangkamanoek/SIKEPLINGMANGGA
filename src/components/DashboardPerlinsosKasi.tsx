import React, { useState, useMemo } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
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
import { isReportMatchingKepling } from '../lib/formatter';
import {
  calculateEffectiveKinerja,
  DEFAULT_PERLINSOS_TARGETS,
  DEFAULT_PERLINSOS_BASELINES,
} from '../data/targetsData';
import { KunjunganHarianView } from './KunjunganHarianView';

interface DashboardPerlinsosKasiProps {
  reports: LaporanHarianItem[];
  targetsMap: TargetsCapaianMap;
  currentUser: UserAccount;
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
  onOpenKunjunganWarga?: () => void;
  onOpenDatabaseKeluarga?: () => void;
}

type PeriodFilter = 'all' | 'today' | '7days' | 'month';
type SubView = 'perlinsos' | 'posyandu' | 'kunjungan_warga' | 'bpjs';

export const DashboardPerlinsosKasi: React.FC<DashboardPerlinsosKasiProps> = ({
  reports,
  targetsMap,
  currentUser,
  onSelectKeplingRiwayat,
  onOpenKunjunganWarga,
  onOpenDatabaseKeluarga,
}) => {
  const [subView, setSubView] = useState<SubView>('perlinsos');
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
    return KEPLING_ACCOUNTS.map((kepling, index) => {
      const keplingReports = filteredReports.filter((r) => isReportMatchingKepling(r, kepling));

      // Reported Perlinsos KK
      const reportedKk = keplingReports.reduce((sum, r) => {
        const val = Number(r.kinerja?.perlinsosKk || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Reported BPJS TK
      const reportedBpjs = keplingReports.reduce((sum, r) => {
        const val = Number(r.kinerja?.bpjsKetenagakerjaanOrang || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Category breakdown
      let pendataanCount = 0;
      let pengecekanCount = 0;
      let verifikasiCount = 0;
      let menolakKk = 0;
      let tidakDiTempatKk = 0;

      keplingReports.forEach((r) => {
        const kat = (r.kinerja?.perlinsosKategoriKegiatan || '').toLowerCase();
        const kkVal = Number(r.kinerja?.perlinsosKk || 0);

        if (kat.includes('pendataan')) {
          pendataanCount += kkVal;
        } else if (kat.includes('pengecekan')) {
          pengecekanCount += kkVal;
        } else if (kat.includes('verifikasi')) {
          verifikasiCount += kkVal;
        }

        const mKk = Number(r.kinerja?.perlinsosMenolakKk || 0);
        const tKk = Number(r.kinerja?.perlinsosTidakDiTempatKk || 0);
        menolakKk += mKk;
        tidakDiTempatKk += tKk;

        if (kat.includes('menolak') && mKk === 0) {
          menolakKk += kkVal || 1;
        }
        if ((kat.includes('tempat') || kat.includes('tidak')) && tKk === 0) {
          tidakDiTempatKk += kkVal || 1;
        }
      });

      // Target configuration from targetsMap
      const targetConfig = targetsMap[kepling.id];
      const targetPerlinsos =
        targetConfig?.targetPerlinsos ??
        DEFAULT_PERLINSOS_TARGETS[index] ??
        300;

      // Use calculateEffectiveKinerja to get the exact matching cumulative stats
      const reported = {
        pbb: 0,
        perlinsos: reportedKk,
        ikd: 0,
        bpjs: reportedBpjs,
      };

      const effective = calculateEffectiveKinerja(reported, targetConfig, index);
      const totalPerlinsos = effective.perlinsos;
      const isOverridden = effective.isPerlinsosOverridden || effective.isOverridden;

      const perlinsosPercentage =
        targetPerlinsos > 0 ? Math.round((totalPerlinsos / targetPerlinsos) * 100) : 0;

      // Find latest Perlinsos report note
      const latestPerlinsosReport = [...keplingReports]
        .filter((r) => r.kinerja?.perlinsosKk && Number(r.kinerja?.perlinsosKk) > 0)
        .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0];

      const latestNote =
        latestPerlinsosReport?.kinerja?.perlinsosKeterangan ||
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
        perlinsosReportCount: keplingReports.filter((r) => Number(r.kinerja?.perlinsosKk || 0) > 0).length,
        latestNote,
        isOverridden,
      };
    });
  }, [filteredReports, targetsMap, period]);

  // 2.5. Aggregate Posyandu statistics per Kepling
  const keplingPosyanduStats = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const keplingReports = filteredReports.filter((r) => isReportMatchingKepling(r, kepling));
      const posyanduReports = keplingReports.filter(
        (r) => r.kinerja?.posyanduAdaGiat || r.kinerja?.posyanduNama || (r.kinerja?.posyanduJumlahWargaTotal && Number(r.kinerja?.posyanduJumlahWargaTotal) > 0)
      );
      const latestPosReport = posyanduReports[0] || keplingReports[0];
      const kin = latestPosReport?.kinerja;

      const posyanduNama = kin?.posyanduNama || (posyanduReports.length > 0 ? `Posyandu ${kepling.lingkungan}` : 'Posyandu Lingkungan');
      const posyanduLokasi = kin?.posyanduLokasi || `Balai Warga ${kepling.lingkungan}`;
      const posyanduKader = kin?.posyanduJumlahPetugasKader ? String(kin.posyanduJumlahPetugasKader) : '5 Kader';
      
      const totalWarga = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduJumlahWargaTotal) || 0), 0) || (Number(kin?.posyanduJumlahWargaTotal) || 0);
      const bayi02 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduBayi02Tahun) || 0), 0) || (Number(kin?.posyanduBayi02Tahun) || 0);
      const balita25 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduBalita25Tahun) || 0), 0) || (Number(kin?.posyanduBalita25Tahun) || 0);
      const anak612 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduAnak612Tahun) || 0), 0) || (Number(kin?.posyanduAnak612Tahun) || 0);
      const remaja1318 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduRemaja1318Tahun) || 0), 0) || (Number(kin?.posyanduRemaja1318Tahun) || 0);
      const dewasa1959 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduDewasaIbuHamil1959Tahun) || 0), 0) || (Number(kin?.posyanduDewasaIbuHamil1959Tahun) || 0);
      const lansia60 = posyanduReports.reduce((sum, r) => sum + (Number(r.kinerja?.posyanduLansia60TahunKeatas) || 0), 0) || (Number(kin?.posyanduLansia60TahunKeatas) || 0);
      
      const layanan = Array.isArray(kin?.posyanduJenisLayanan) && kin.posyanduJenisLayanan.length > 0
        ? kin.posyanduJenisLayanan
        : ['Penimbangan & Pengukuran Stunting', 'Imunisasi', 'Vitamin A'];
      const catatan = kin?.posyanduKeterangan || (posyanduReports.length > 0 ? 'Pelayanan posyandu berjalan tertib' : '-');

      return {
        kepling,
        hasActivity: posyanduReports.length > 0 || (Number(kin?.posyanduJumlahWargaTotal) || 0) > 0,
        posyanduNama,
        posyanduLokasi,
        posyanduKader,
        totalWarga,
        bayi02,
        balita25,
        anak612,
        remaja1318,
        dewasa1959,
        lansia60,
        layanan,
        catatan,
        reportCount: posyanduReports.length,
      };
    });
  }, [filteredReports]);

  // Posyandu Overall Totals
  const posyanduTotals = useMemo(() => {
    const totalWargaAll = keplingPosyanduStats.reduce((sum, k) => sum + k.totalWarga, 0);
    const totalBayi = keplingPosyanduStats.reduce((sum, k) => sum + k.bayi02, 0);
    const totalBalita = keplingPosyanduStats.reduce((sum, k) => sum + k.balita25, 0);
    const totalAnak = keplingPosyanduStats.reduce((sum, k) => sum + k.anak612, 0);
    const totalRemaja = keplingPosyanduStats.reduce((sum, k) => sum + k.remaja1318, 0);
    const totalDewasa = keplingPosyanduStats.reduce((sum, k) => sum + k.dewasa1959, 0);
    const totalLansia = keplingPosyanduStats.reduce((sum, k) => sum + k.lansia60, 0);
    const activePosyanduCount = keplingPosyanduStats.filter((k) => k.hasActivity).length;

    return {
      totalWargaAll,
      totalBayi,
      totalBalita,
      totalAnak,
      totalRemaja,
      totalDewasa,
      totalLansia,
      activePosyanduCount,
    };
  }, [keplingPosyanduStats]);

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
    printOfficialDocument('lembar-cetak-rekap-perlinsos', `REKAP_PERLINSOS_MANGGA_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div id="lembar-cetak-rekap-perlinsos" className="space-y-6 pb-12">
      {/* Header Banner Khusus Seksi Pembangunan */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
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
            {onOpenDatabaseKeluarga && (
              <button
                type="button"
                onClick={onOpenDatabaseKeluarga}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer border border-amber-300"
                title="Buka Database Master Data Keluarga (KK)"
              >
                <Users className="w-4 h-4 text-slate-950" />
                <span>Database Data Keluarga</span>
              </button>
            )}

            {onOpenKunjunganWarga && (
              <button
                type="button"
                onClick={onOpenKunjunganWarga}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer border border-sky-200"
                title="Buka Rekap Kunjungan Harian Warga"
              >
                <Users className="w-4 h-4 text-slate-950" />
                <span>Kunjungan Warga Rentan</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-950 font-black text-xs hover:bg-blue-50 shadow-md transition-all cursor-pointer border border-blue-200/60"
              title="Unduh Rekap Excel Perlinsos 24 Kepling"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-900/90 hover:bg-blue-800 text-white font-extrabold text-xs border border-blue-400/50 shadow-md transition-all cursor-pointer"
              title="Cetak format cetak resmi Seksi Pembangunan"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* Sub-view Navigation Tabs */}
        <div className="mt-6 pt-5 border-t border-blue-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-blue-950/80 p-1.5 rounded-xl border border-blue-700/60">
            <button
              type="button"
              onClick={() => setSubView('perlinsos')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                subView === 'perlinsos'
                  ? 'bg-white text-blue-950 shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>1. Giat Perlinsos & Bansos</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('posyandu')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                subView === 'posyandu'
                  ? 'bg-white text-rose-950 shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <span className="text-sm">👶🩺</span>
              <span>2. Posyandu & Layanan Kesehatan</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('kunjungan_warga')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                subView === 'kunjungan_warga'
                  ? 'bg-white text-blue-950 shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>3. Kunjungan Warga Lapangan</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('bpjs')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                subView === 'bpjs'
                  ? 'bg-white text-blue-950 shadow-md'
                  : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>4. BPJS Ketenagakerjaan</span>
            </button>
          </div>

          {(subView === 'perlinsos' || subView === 'bpjs' || subView === 'posyandu') && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-blue-950/80 p-1 rounded-xl border border-blue-700/60 text-xs">
                <button
                  type="button"
                  onClick={() => setPeriod('all')}
                  className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                    period === 'all'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
                  }`}
                >
                  Semua Waktu
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('today')}
                  className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                    period === 'today'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('7days')}
                  className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                    period === '7days'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('month')}
                  className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                    period === 'month'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-blue-100 hover:text-white hover:bg-white/10 font-bold'
                  }`}
                >
                  Bulan Ini
                </button>
              </div>
              <div className="text-xs text-blue-200 font-medium">
                Terekam dari <span className="font-bold text-white">{filteredReports.length}</span> laporan harian
              </div>
            </div>
          )}
        </div>
      </div>

      {subView === 'perlinsos' && (
        <>

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
            <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-50/80 to-indigo-50/50 border-2 border-blue-400 text-center relative overflow-hidden shadow-sm flex flex-col justify-between">
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
        </>
      )}

      {subView === 'posyandu' && (
        <div className="space-y-6">
          {/* Top Metric Banner Posyandu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 text-xl">
                🎯
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Warga Terlayani</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {posyanduTotals.totalWargaAll.toLocaleString('id-ID')} <span className="text-xs font-bold text-rose-700">Jiwa (0 Th - Lansia)</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 text-xl">
                👶
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bayi & Balita (Pantau Stunting)</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {(posyanduTotals.totalBayi + posyanduTotals.totalBalita).toLocaleString('id-ID')} <span className="text-xs font-bold text-amber-700">Anak (0-5 Th)</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 text-xl">
                👵
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lansia Terlayani (PTM)</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {posyanduTotals.totalLansia.toLocaleString('id-ID')} <span className="text-xs font-bold text-indigo-700">Jiwa (60+ Th)</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-xl">
                🏥
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posyandu Aktif Pelayanan</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {posyanduTotals.activePosyanduCount} <span className="text-xs font-bold text-slate-500">/ 24 Lingkungan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Rekapitulasi Pelayanan Posyandu 24 Lingkungan */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="text-xl">👶🩺</span>
                  <span>Rekapitulasi Pelayanan Posyandu & Kesehatan Warga 24 Lingkungan</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Data kumulatif warga terlayani dari usia 0 tahun (bayi/baduta), balita, anak, remaja, ibu hamil, hingga lansia
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari lingkungan / posyandu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4 text-center w-12">No</th>
                    <th className="py-3 px-4">Kepala Lingkungan</th>
                    <th className="py-3 px-4">Posyandu & Lokasi</th>
                    <th className="py-3 px-4 text-center">Kader</th>
                    <th className="py-3 px-4 text-center bg-rose-50/70 text-rose-950 font-black">Total Terlayani</th>
                    <th className="py-3 px-4">Rincian Kelompok Usia (0 Th - Lansia)</th>
                    <th className="py-3 px-4 max-w-xs">Jenis Layanan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {keplingPosyanduStats
                    .filter((item) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        item.kepling.nama.toLowerCase().includes(q) ||
                        item.kepling.lingkungan.toLowerCase().includes(q) ||
                        item.posyanduNama.toLowerCase().includes(q) ||
                        item.posyanduLokasi.toLowerCase().includes(q)
                      );
                    })
                    .map((item, index) => (
                      <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">
                          {index + 1}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{item.posyanduNama}</div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-xs">{item.posyanduLokasi}</div>
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                            {item.posyanduKader}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center bg-rose-50/40">
                          <span className="inline-block text-xs font-black px-3 py-1 rounded-full bg-rose-600 text-white shadow-2xs">
                            {item.totalWarga} Jiwa
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
                              👶 0-2Th: {item.bayi02}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
                              🧒 2-5Th: {item.balita25}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold">
                              👦 6-12Th: {item.anak612}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-900 text-[10px] font-bold">
                              🧑 13-18Th: {item.remaja1318}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold">
                              🤰 19-59Th: {item.dewasa1959}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold">
                              👵 60+Th: {item.lansia60}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-[10.5px] text-slate-600 font-medium line-clamp-2">
                            {item.layanan.join(', ')}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {onSelectKeplingRiwayat && (
                            <button
                              type="button"
                              onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition-colors cursor-pointer border border-rose-200"
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
      )}

      {subView === 'kunjungan_warga' && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Users className="w-4 h-4 text-blue-700" />
            <span>Sistem Pengawasan Kunjungan Warga Rentan Harian</span>
          </div>
          <KunjunganHarianView currentUser={currentUser} />
        </div>
      )}

      {subView === 'bpjs' && (
        <div className="space-y-6">
          {/* Top Metric Banner BPJS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total BPJS Ketenagakerjaan</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{overallTotals.totalBpjs} <span className="text-xs font-bold text-purple-700">Pekerja Rentan</span></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kepling Melaporkan BPJS</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{keplingPerlinsosStats.filter(k => k.reportedBpjs > 0).length} <span className="text-xs font-bold text-slate-500">/ 24 Lingkungan</span></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rata-Rata per Lingkungan</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{Math.round(overallTotals.totalBpjs / 24)} <span className="text-xs font-bold text-emerald-700">Orang / Lk</span></div>
              </div>
            </div>
          </div>

          {/* Tabel Detail BPJS Ketenagakerjaan 24 Kepling */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-700" />
                  <span>Pendataan BPJS Ketenagakerjaan Pekerja Rentan 24 Lingkungan</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Rekapitulasi jumlah pekerja rentan yang terdaftar perlindungan jaminan sosial BPJS Ketenagakerjaan
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari lingkungan / kepling..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4 text-center w-12">No</th>
                    <th className="py-3 px-4">Kepala Lingkungan</th>
                    <th className="py-3 px-4 text-center bg-purple-50/60 text-purple-950">Terdaftar BPJS TK</th>
                    <th className="py-3 px-4 text-center">Laporan Masuk</th>
                    <th className="py-3 px-4">Catatan Pendataan BPJS TK</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {[...keplingPerlinsosStats]
                    .sort((a, b) => b.reportedBpjs - a.reportedBpjs)
                    .filter((item) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        item.kepling.nama.toLowerCase().includes(q) ||
                        item.kepling.lingkungan.toLowerCase().includes(q)
                      );
                    })
                    .map((item, index) => (
                      <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">
                          {index + 1}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                        </td>

                        <td className="py-3 px-4 text-center bg-purple-50/30">
                          <span className="inline-block text-xs font-black px-3 py-1 rounded-full bg-purple-600 text-white shadow-2xs">
                            {item.reportedBpjs} Pekerja Rentan
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {item.reportCount} Laporan
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-[11px] text-slate-600 font-medium">
                            {item.latestNote !== '-' ? item.latestNote : 'Pendataan BPJS Ketenagakerjaan aktif di lingkungan'}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {onSelectKeplingRiwayat && (
                            <button
                              type="button"
                              onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition-colors cursor-pointer border border-purple-200"
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
      )}
    </div>
  );
};
