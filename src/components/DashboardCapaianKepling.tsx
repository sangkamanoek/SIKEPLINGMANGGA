import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  FileCheck2,
  Calendar,
  Filter,
  Search,
  Users,
  Building2,
  Smartphone,
  Shield,
  CreditCard,
  Printer,
  ChevronRight,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Sliders,
  Target,
  Edit3,
} from 'lucide-react';
import { LaporanHarianItem, UserAccount, TargetsCapaianMap, KeplingTargetCapaian } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  getDefaultTargetsCapaianMap,
  DEFAULT_PERLINSOS_TARGETS,
  calculateEffectiveKinerja,
} from '../data/targetsData';
import {
  fetchTargetsCapaian,
  saveKeplingTargetCapaian,
  saveAllTargetsCapaian,
  resetTargetsCapaianToDefaults,
} from '../lib/targetsApi';
import { ModalEditTargetCapaian } from './ModalEditTargetCapaian';
import { isReportMatchingKepling, getReportIsoDate } from '../lib/formatter';

interface DashboardCapaianKeplingProps {
  reports: LaporanHarianItem[];
  activeAccount: UserAccount;
  mode: 'kepling' | 'super_admin';
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
  onOpenReportDetail?: (report: LaporanHarianItem) => void;
  onNavigateToForm?: () => void;
}

type PeriodFilter = 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'ALL';

export const DashboardCapaianKepling: React.FC<DashboardCapaianKeplingProps> = ({
  reports,
  activeAccount,
  mode,
  onSelectKeplingRiwayat,
  onOpenReportDetail,
  onNavigateToForm,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('THIS_MONTH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKeplingCard, setSelectedKeplingCard] = useState<string | null>(null);

  // Target & Capaian Management State
  const [targetsMap, setTargetsMap] = useState<TargetsCapaianMap>(getDefaultTargetsCapaianMap);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [editingKepling, setEditingKepling] = useState<UserAccount | null>(null);

  // Load targets & capaian from server / local on mount
  useEffect(() => {
    let isMounted = true;
    fetchTargetsCapaian().then((data) => {
      if (isMounted && data) {
        setTargetsMap(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveKeplingTarget = async (
    item: Partial<KeplingTargetCapaian> & { keplingId: string }
  ) => {
    const updated = await saveKeplingTargetCapaian(item);
    setTargetsMap(updated);
  };

  const handleSaveAllTargets = async (allMap: TargetsCapaianMap) => {
    const updated = await saveAllTargetsCapaian(allMap);
    setTargetsMap(updated);
  };

  const handleResetDefaults = async () => {
    const updated = await resetTargetsCapaianToDefaults();
    setTargetsMap(updated);
  };

  // Helper date calculations
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter reports by selected period
  const filteredReportsByPeriod = useMemo(() => {
    return reports.filter((r) => {
      const dateIso = getReportIsoDate(r);
      if (period === 'TODAY') {
        return dateIso === todayIso;
      }
      if (period === '7_DAYS') {
        return dateIso >= sevenDaysAgo;
      }
      if (period === 'THIS_MONTH') {
        return dateIso ? dateIso.startsWith(currentYearMonth) : true;
      }
      return true; // ALL
    });
  }, [reports, period, todayIso, sevenDaysAgo, currentYearMonth]);

  // Kepling specific reports
  const myReports = useMemo(() => {
    if (mode !== 'kepling') return [];
    return filteredReportsByPeriod.filter((r) => isReportMatchingKepling(r, activeAccount));
  }, [filteredReportsByPeriod, activeAccount, mode]);

  // All time Kepling reports (for calculating total days logged)
  const myAllTimeReports = useMemo(() => {
    if (mode !== 'kepling') return [];
    return reports.filter((r) => isReportMatchingKepling(r, activeAccount));
  }, [reports, activeAccount, mode]);

  // Capaian aggregasi untuk Single Kepling
  const myStats = useMemo(() => {
    let totalPbb = 0;
    let totalPerlinsos = 0;
    let totalIkd = 0;
    let totalBpjs = 0;

    myReports.forEach((r) => {
      totalPbb += Number(r.kinerja?.opsirPbbWp) || 0;
      totalPerlinsos += Number(r.kinerja?.perlinsosKk) || 0;
      totalIkd += Number(r.kinerja?.ikdOrang) || 0;
      totalBpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
    });

    const uniqueDays = new Set(myReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));
    const allUniqueDays = new Set(myAllTimeReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));

    return {
      totalPbb,
      totalPerlinsos,
      totalIkd,
      totalBpjs,
      laporanCount: myReports.length,
      hariMelapor: uniqueDays.size,
      totalHariMelaporAllTime: allUniqueDays.size,
    };
  }, [myReports, myAllTimeReports]);

  // Raw reported stats map for modal and calculations
  const reportedStatsMap = useMemo(() => {
    const map: Record<
      string,
      { pbb: number; perlinsos: number; ikd: number; bpjs: number; reportCount: number }
    > = {};

    KEPLING_ACCOUNTS.forEach((k) => {
      const kReports = filteredReportsByPeriod.filter((r) => isReportMatchingKepling(r, k));

      let pbb = 0;
      let perlinsos = 0;
      let ikd = 0;
      let bpjs = 0;

      kReports.forEach((r) => {
        pbb += Number(r.kinerja?.opsirPbbWp) || 0;
        perlinsos += Number(r.kinerja?.perlinsosKk) || 0;
        ikd += Number(r.kinerja?.ikdOrang) || 0;
        bpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
      });

      map[k.id] = {
        pbb,
        perlinsos,
        ikd,
        bpjs,
        reportCount: kReports.length,
      };
    });

    return map;
  }, [filteredReportsByPeriod]);

  // Aggregasi untuk Seluruh 24 Kepling (Menggabungkan Laporan Riil + Override Super Admin)
  const keplingSummaryList = useMemo(() => {
    return KEPLING_ACCOUNTS.map((k, index) => {
      const kReports = filteredReportsByPeriod.filter((r) => isReportMatchingKepling(r, k));

      const reported = reportedStatsMap[k.id] || {
        pbb: 0,
        perlinsos: 0,
        ikd: 0,
        bpjs: 0,
        reportCount: 0,
      };

      const targetConfig = targetsMap[k.id];
      const targetPerlinsos =
        targetConfig?.targetPerlinsos ??
        DEFAULT_PERLINSOS_TARGETS[(k.nomorLingkungan || index + 1) - 1] ??
        300;
      const targetPbb = targetConfig?.targetPbb ?? 100;
      const targetIkd = targetConfig?.targetIkd ?? 50;
      const targetBpjs = targetConfig?.targetBpjs ?? 25;

      // Hitung Capaian Efektif (Realisasi dari Laporan atau Override Super Admin)
      const effective = calculateEffectiveKinerja(reported, targetConfig);

      const uniqueDays = new Set(kReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));
      const score =
        kReports.length * 10 +
        effective.pbb * 2 +
        effective.perlinsos * 2 +
        effective.ikd * 3 +
        effective.bpjs * 3;

      const perlinsosPercentage =
        targetPerlinsos > 0 ? Math.round((effective.perlinsos / targetPerlinsos) * 100) : 0;

      return {
        kepling: k,
        reportCount: kReports.length,
        hariMelapor: uniqueDays.size,
        pbb: effective.pbb,
        perlinsos: effective.perlinsos,
        ikd: effective.ikd,
        bpjs: effective.bpjs,
        reportedPerlinsos: reported.perlinsos,
        targetPerlinsos,
        targetPbb,
        targetIkd,
        targetBpjs,
        perlinsosPercentage,
        isPerlinsosOverridden: effective.isPerlinsosOverridden,
        isOverridden: effective.isOverridden,
        catatanPenyesuaian: targetConfig?.catatanPenyesuaian || '',
        score,
        latestReport: kReports[0] || null,
      };
    });
  }, [filteredReportsByPeriod, reportedStatsMap, targetsMap]);

  // Sorted leaderboard - Diurutkan berdasarkan persentase capaian target Perlinsos
  const sortedLeaderboard = useMemo(() => {
    return [...keplingSummaryList].sort((a, b) => {
      // 1. Urutan utama: Persentase capaian Perlinsos tertinggi ke terendah
      if (b.perlinsosPercentage !== a.perlinsosPercentage) {
        return b.perlinsosPercentage - a.perlinsosPercentage;
      }
      // 2. Tie-breaker 1: Jumlah realisasi Perlinsos (KK)
      if (b.perlinsos !== a.perlinsos) {
        return b.perlinsos - a.perlinsos;
      }
      // 3. Tie-breaker 2: Jumlah laporan yang dikirim
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      // 4. Tie-breaker 3: Nomor lingkungan
      return (a.kepling.nomorLingkungan || 0) - (b.kepling.nomorLingkungan || 0);
    });
  }, [keplingSummaryList]);

  // Filtered kepling cards for display
  const displayedKeplingCards = useMemo(() => {
    if (!searchQuery.trim()) return sortedLeaderboard;
    const q = searchQuery.toLowerCase();
    return sortedLeaderboard.filter(
      (item) =>
        item.kepling.nama.toLowerCase().includes(q) ||
        item.kepling.lingkungan.toLowerCase().includes(q) ||
        item.kepling.jabatan.toLowerCase().includes(q)
    );
  }, [sortedLeaderboard, searchQuery]);

  // Total agregat kelurahan
  const kelurahanTotals = useMemo(() => {
    let totalPbb = 0;
    let totalPerlinsos = 0;
    let totalTargetPerlinsos = 0;
    let totalIkd = 0;
    let totalBpjs = 0;
    let totalReports = filteredReportsByPeriod.length;

    keplingSummaryList.forEach((item) => {
      totalPbb += item.pbb;
      totalPerlinsos += item.perlinsos;
      totalTargetPerlinsos += item.targetPerlinsos;
      totalIkd += item.ikd;
      totalBpjs += item.bpjs;
    });

    const activeKeplingCount = keplingSummaryList.filter((k) => k.reportCount > 0).length;
    const kepatuhanRate = Math.round((activeKeplingCount / 24) * 100);
    const perlinsosPercentage =
      totalTargetPerlinsos > 0
        ? Math.round((totalPerlinsos / totalTargetPerlinsos) * 100)
        : 0;

    return {
      totalPbb,
      totalPerlinsos,
      totalTargetPerlinsos,
      perlinsosPercentage,
      totalIkd,
      totalBpjs,
      totalReports,
      activeKeplingCount,
      kepatuhanRate,
    };
  }, [filteredReportsByPeriod, keplingSummaryList]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Header Card */}
      <div className="bg-linear-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 border border-emerald-500/40 text-emerald-100 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA • Dashboard Capaian Kinerja</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {mode === 'kepling' ? (
                <span>Capaian Kinerja {activeAccount.lingkungan}</span>
              ) : (
                <span>Rekapitulasi Capaian 24 Kepala Lingkungan</span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              {mode === 'kepling'
                ? `Pantau akumulasi pencapaian 4 pilar kinerja harian Anda (PBB, Perlinsos, IKD, dan BPJS Ketenagakerjaan) sebagai wujud pelayanan prima warga.`
                : `Monitoring evaluasi pencapaian 4 pilar kinerja seluruh 24 Lingkungan di Kelurahan Mangga Kecamatan Medan Tuntungan.`}
            </p>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-emerald-950/60 p-1.5 rounded-2xl border border-emerald-600/40 shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => setPeriod('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'TODAY'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7_DAYS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === '7_DAYS'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setPeriod('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'THIS_MONTH'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'ALL'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              Semua
            </button>

            {mode === 'super_admin' && (
              <button
                type="button"
                onClick={() => {
                  setEditingKepling(null);
                  setIsModalEditOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ml-1"
                title="Atur Target PERLINSOS dan Edit Capaian 24 Kepling"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Target & Capaian</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1 cursor-pointer hidden sm:block"
              title="Cetak Rekapitulasi Capaian"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VIEW KEPLING (SINGLE KEPLING ACHIEVEMENTS)                            */}
      {/* ========================================================================= */}
      {mode === 'kepling' && (
        <div className="space-y-6">
          {/* Profile Card & Keaktifan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                {activeAccount.nomorLingkungan || 'KL'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                    {activeAccount.lingkungan}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Kelurahan Mangga
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeAccount.nama}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeAccount.jabatan}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center flex-1 sm:flex-none sm:min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Hari Lapor Periode Ini
                </span>
                <span className="text-lg font-black text-emerald-700">
                  {myStats.hariMelapor} <span className="text-xs font-semibold text-slate-500">Hari</span>
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center flex-1 sm:flex-none sm:min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Laporan Dibuat
                </span>
                <span className="text-lg font-black text-slate-900">
                  {myStats.laporanCount} <span className="text-xs font-semibold text-slate-500">Lap</span>
                </span>
              </div>
              {onNavigateToForm && (
                <button
                  type="button"
                  onClick={onNavigateToForm}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer hidden md:flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Input Laporan</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Pilar Kinerja Cards */}
          {(() => {
            const activeTargetConfig = targetsMap[activeAccount.id];
            const activeTargetPerlinsos =
              activeTargetConfig?.targetPerlinsos ??
              DEFAULT_PERLINSOS_TARGETS[(activeAccount.nomorLingkungan || 1) - 1] ??
              300;
            const effectiveMyKinerja = calculateEffectiveKinerja(
              {
                pbb: myStats.totalPbb,
                perlinsos: myStats.totalPerlinsos,
                ikd: myStats.totalIkd,
                bpjs: myStats.totalBpjs,
              },
              activeTargetConfig
            );
            const myPerlinsosPct =
              activeTargetPerlinsos > 0
                ? ((effectiveMyKinerja.perlinsos / activeTargetPerlinsos) * 100).toFixed(1)
                : '0';
            const sisaTargetPerlinsos = Math.max(0, activeTargetPerlinsos - effectiveMyKinerja.perlinsos);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Opsir PBB */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      1. Opsir PBB
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                      {effectiveMyKinerja.pbb}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">WP</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Wajib Pajak yang telah membayarkan / dihimbau PBB.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Rata-rata: {(effectiveMyKinerja.pbb / (myStats.hariMelapor || 1)).toFixed(1)} WP / hari</span>
                    <span className="text-emerald-700 font-bold">Terus Tingkatkan</span>
                  </div>
                </div>

                {/* 2. Perlinsos (Dengan Target & Capaian Resmi) */}
                <div className="bg-white rounded-2xl p-5 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-blue-900 uppercase tracking-wider">
                        2. Perlinsos
                      </span>
                      {effectiveMyKinerja.isPerlinsosOverridden && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black" title="Capaian disesuaikan Super Admin">
                          Koreksi Admin
                        </span>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-900 tracking-tight">
                        {effectiveMyKinerja.perlinsos}
                      </span>
                      <span className="text-sm font-bold text-slate-400">
                        / {activeTargetPerlinsos} KK
                      </span>
                    </div>

                    {/* Progress Bar Target */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-blue-950 font-black">Capaian Target</span>
                        <span className="text-blue-800 font-black">{myPerlinsosPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            Number(myPerlinsosPct) >= 100
                              ? 'bg-emerald-500'
                              : Number(myPerlinsosPct) >= 50
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, Number(myPerlinsosPct)))}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2">
                      {sisaTargetPerlinsos === 0
                        ? '🎉 Luar biasa! Target PERLINSOS Lingkungan ini telah terpenuhi.'
                        : `Sisa target yang harus dipenuhi: ${sisaTargetPerlinsos} KK lagi.`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Target: {activeTargetPerlinsos} KK</span>
                    <span className={`font-bold ${Number(myPerlinsosPct) >= 100 ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {Number(myPerlinsosPct) >= 100 ? 'Target Tercapai' : 'On Track'}
                    </span>
                  </div>
                </div>

                {/* 3. IKD */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                      3. Identitas Digital (IKD)
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                      {effectiveMyKinerja.ikd}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">Orang</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Warga yang berhasil aktivasi KTP Digital (IKD).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Target: {activeTargetConfig?.targetIkd || 50} Org</span>
                    <span className="text-purple-700 font-bold">Aktivasi IKD</span>
                  </div>
                </div>

                {/* 4. BPJS Ketenagakerjaan */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      4. BPJS TK
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                      {effectiveMyKinerja.bpjs}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">Orang</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pekerja rentan / mandiri teredukasi dan terdaftar.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Target: {activeTargetConfig?.targetBpjs || 25} Org</span>
                    <span className="text-amber-700 font-bold">Perlindungan Kerja</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Riwayat Capaian Harian Kepling Terbaru */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Rincian Capaian Laporan Terbaru ({myReports.length} Laporan Periode Ini)
                </h3>
              </div>
              {onSelectKeplingRiwayat && (
                <button
                  type="button"
                  onClick={() => onSelectKeplingRiwayat(activeAccount.nama)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Lihat Semua Riwayat →
                </button>
              )}
            </div>

            {myReports.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-xs font-bold text-slate-700">
                  Belum ada laporan untuk periode {period === 'TODAY' ? 'Hari Ini' : period === '7_DAYS' ? '7 Hari Terakhir' : 'Bulan Ini'}.
                </p>
                <p className="text-[11px] text-slate-400">
                  Silakan buka formulir laporan dan input kinerja harian Anda hari ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.slice(0, 5).map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => onOpenReportDetail && onOpenReportDetail(rep)}
                    className="p-4 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {rep.hari}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {rep.tanggal}
                        </span>
                      </div>
                      {rep.kinerja?.kegiatanLainnya && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                          {rep.kinerja.kegiatanLainnya}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold text-slate-700">
                      <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">PBB</span>
                        <span className="text-emerald-700">{rep.kinerja?.opsirPbbWp || '0'} WP</span>
                      </div>
                      <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">PERLINSOS</span>
                        <span className="text-blue-700">{rep.kinerja?.perlinsosKk || '0'} KK</span>
                      </div>
                      <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">IKD</span>
                        <span className="text-purple-700">{rep.kinerja?.ikdOrang || '0'} Orang</span>
                      </div>
                      <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">BPJS TK</span>
                        <span className="text-amber-700">{rep.kinerja?.bpjsKetenagakerjaanOrang || '0'} Orang</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIEW SUPER ADMIN (ALL 24 KEPLING ACHIEVEMENTS & LEADERBOARD)          */}
      {/* ========================================================================= */}
      {mode === 'super_admin' && (
        <div className="space-y-6">
          {/* Kelurahan Aggregation Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Laporan */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block">
                Total Laporan Masuk
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {kelurahanTotals.totalReports}
                <span className="text-xs font-semibold text-slate-500 ml-1">Lap</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                {kelurahanTotals.activeKeplingCount} dari 24 Kepling aktif
              </p>
            </div>

            {/* Total PBB Kelurahan */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase block">
                Total Opsir PBB
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
                {kelurahanTotals.totalPbb}
                <span className="text-xs font-semibold text-slate-500 ml-1">WP</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Akumulasi Kelurahan Mangga
              </p>
            </div>

            {/* Total Perlinsos (Target vs Realisasi Kelurahan) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-blue-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black text-blue-900 uppercase block">
                  Total Perlinsos
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-1.5 py-0.5 rounded">
                  {kelurahanTotals.perlinsosPercentage}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-950 mt-1">
                {kelurahanTotals.totalPerlinsos}
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  / {kelurahanTotals.totalTargetPerlinsos} KK
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, kelurahanTotals.perlinsosPercentage)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Target 24 Lingk: {kelurahanTotals.totalTargetPerlinsos} KK
              </p>
            </div>

            {/* Total IKD */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-purple-700 uppercase block">
                Total IKD Warga
              </span>
              <div className="text-2xl sm:text-3xl font-black text-purple-800 mt-1">
                {kelurahanTotals.totalIkd}
                <span className="text-xs font-semibold text-slate-500 ml-1">Orang</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Aktivasi KTP Digital
              </p>
            </div>

            {/* Total BPJS Ketenagakerjaan */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase block">
                Total BPJS TK
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">
                {kelurahanTotals.totalBpjs}
                <span className="text-xs font-semibold text-slate-500 ml-1">Orang</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Pekerja Rentan Terdata
              </p>
            </div>
          </div>

          {/* Leaderboard & Ranking Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base sm:text-lg">
                      Rangking & Leaderboard 24 Kepling
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full border border-blue-200">
                      Urutan Persentase Perlinsos
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Peringkat resmi 24 Kepala Lingkungan diurutkan dari persentase capaian target PERLINSOS tertinggi
                  </p>
                </div>
              </div>

              {/* Action and Search Box */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKepling(null);
                    setIsModalEditOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
                  title="Atur Target PERLINSOS dan Edit Capaian 24 Kepling"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-300" />
                  <span>Kelola Target & Capaian</span>
                </button>

                <div className="relative flex-1 sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari kepling / lingkungan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-600 focus:bg-white transition-all font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Top 3 Podium Highlights */}
            {sortedLeaderboard.length >= 3 && !searchQuery && (
              <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Juara 2 */}
                <div className="p-4 bg-linear-to-b from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 text-center relative overflow-hidden order-2 sm:order-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase mb-1.5">
                    🥈 Peringkat 2 Perlinsos
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-blue-900 tracking-tight">
                    {sortedLeaderboard[1].perlinsosPercentage}%
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mb-2">
                    {sortedLeaderboard[1].perlinsos} / {sortedLeaderboard[1].targetPerlinsos} KK
                  </div>

                  <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-800 font-black text-xs mx-auto flex items-center justify-center mb-1 shadow-2xs">
                    {sortedLeaderboard[1].kepling.nomorLingkungan}
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                    {sortedLeaderboard[1].kepling.nama}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {sortedLeaderboard[1].kepling.lingkungan}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Laporan</span>
                      <strong className="text-slate-800">{sortedLeaderboard[1].reportCount} Lap</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">PBB</span>
                      <strong className="text-emerald-700">{sortedLeaderboard[1].pbb} WP</strong>
                    </div>
                  </div>
                </div>

                {/* Juara 1 */}
                <div className="p-5 bg-linear-to-b from-amber-50 to-amber-100/60 rounded-2xl border-2 border-amber-400 text-center relative overflow-hidden shadow-sm order-1 sm:order-2">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase mb-1.5 shadow-xs">
                    🥇 Peringkat 1 Perlinsos
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-blue-950 tracking-tight">
                    {sortedLeaderboard[0].perlinsosPercentage}%
                  </div>
                  <div className="text-xs font-black text-amber-900 mb-2">
                    Capaian: {sortedLeaderboard[0].perlinsos} dari {sortedLeaderboard[0].targetPerlinsos} KK
                  </div>

                  <div className="w-11 h-11 rounded-full bg-amber-400 text-slate-950 font-black text-sm mx-auto flex items-center justify-center mb-1.5 shadow-sm">
                    {sortedLeaderboard[0].kepling.nomorLingkungan}
                  </div>
                  <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">
                    {sortedLeaderboard[0].kepling.nama}
                  </h4>
                  <p className="text-xs text-amber-900 font-bold">
                    {sortedLeaderboard[0].kepling.lingkungan}
                  </p>
                  <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-4 gap-1 text-[11px]">
                    <div>
                      <span className="text-[9px] text-amber-800 block">Laporan</span>
                      <strong className="text-slate-900">{sortedLeaderboard[0].reportCount}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-800 block">PBB</span>
                      <strong className="text-emerald-800">{sortedLeaderboard[0].pbb}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-blue-800 block">Perlinsos</span>
                      <strong className="text-blue-800">{sortedLeaderboard[0].perlinsos}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-purple-800 block">IKD</span>
                      <strong className="text-purple-800">{sortedLeaderboard[0].ikd}</strong>
                    </div>
                  </div>
                </div>

                {/* Juara 3 */}
                <div className="p-4 bg-linear-to-b from-amber-50/50 to-orange-50/40 rounded-2xl border border-amber-200/80 text-center relative overflow-hidden order-3">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase mb-1.5">
                    🥉 Peringkat 3 Perlinsos
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-blue-900 tracking-tight">
                    {sortedLeaderboard[2].perlinsosPercentage}%
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mb-2">
                    {sortedLeaderboard[2].perlinsos} / {sortedLeaderboard[2].targetPerlinsos} KK
                  </div>

                  <div className="w-9 h-9 rounded-full bg-amber-200 text-amber-900 font-black text-xs mx-auto flex items-center justify-center mb-1 shadow-2xs">
                    {sortedLeaderboard[2].kepling.nomorLingkungan}
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                    {sortedLeaderboard[2].kepling.nama}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {sortedLeaderboard[2].kepling.lingkungan}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-amber-200/60 grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Laporan</span>
                      <strong className="text-slate-800">{sortedLeaderboard[2].reportCount} Lap</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">IKD</span>
                      <strong className="text-purple-700">{sortedLeaderboard[2].ikd} Org</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List / Table of All 24 Kepling Performance */}
            <div className="divide-y divide-slate-100 mt-4">
              <div className="hidden md:grid grid-cols-12 gap-3 py-2 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider items-center">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-3">Kepala Lingkungan</div>
                <div className="col-span-2 text-center bg-blue-50/80 text-blue-900 py-1 rounded-md font-black">
                  Rangking Perlinsos (%)
                </div>
                <div className="col-span-2 text-center">Status Lapor</div>
                <div className="col-span-3 grid grid-cols-3 text-center">
                  <span>PBB</span>
                  <span>IKD</span>
                  <span>BPJS TK</span>
                </div>
                <div className="col-span-1 text-right">Aksi</div>
              </div>

              {displayedKeplingCards.map((item, index) => (
                <div
                  key={item.kepling.id}
                  className="py-3 px-3 hover:bg-slate-50/80 rounded-xl transition-colors flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-start md:items-center"
                >
                  {/* Rank Badge */}
                  <div className="col-span-1 flex items-center gap-2 md:justify-center">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        index === 0
                          ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300'
                          : index === 1
                          ? 'bg-slate-300 text-slate-900'
                          : index === 2
                          ? 'bg-amber-200 text-amber-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="md:hidden font-bold text-xs text-slate-800">
                      {item.kepling.lingkungan} • {item.kepling.nama}
                    </span>
                  </div>

                  {/* Info Kepling */}
                  <div className="col-span-3 hidden md:block">
                    <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                      <span>{item.kepling.nama}</span>
                      {item.isOverridden && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Capaian disesuaikan Super Admin" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {item.kepling.lingkungan}
                    </div>
                  </div>

                  {/* Perlinsos: Capaian & Target & Persentase (Kolom Utama Ranking) */}
                  <div className="col-span-2 w-full md:w-auto text-center bg-blue-50/40 p-2 rounded-xl border border-blue-100/80">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          item.perlinsosPercentage >= 100
                            ? 'bg-emerald-600 text-white'
                            : item.perlinsosPercentage >= 50
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {item.perlinsosPercentage}%
                      </span>
                      {item.isPerlinsosOverridden && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Capaian disesuaikan Admin" />
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 mt-1">
                      {item.perlinsos} <span className="text-slate-400 font-normal">/ {item.targetPerlinsos} KK</span>
                    </div>
                  </div>

                  {/* Status Lapor Periode Ini */}
                  <div className="col-span-2 text-center w-full md:w-auto">
                    {item.reportCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{item.reportCount} Lap ({item.hariMelapor} Hari)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 text-[11px] font-semibold">
                        Belum Lapor
                      </span>
                    )}
                  </div>

                  {/* 3 Pilar Metrics: PBB, IKD, BPJS */}
                  <div className="col-span-3 grid grid-cols-3 gap-1.5 text-center w-full text-xs font-bold">
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-normal md:hidden">PBB</span>
                      <span className="text-emerald-700">{item.pbb} WP</span>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-normal md:hidden">IKD</span>
                      <span className="text-purple-700">{item.ikd} Org</span>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-normal md:hidden">BPJS TK</span>
                      <span className="text-amber-700">{item.bpjs} Org</span>
                    </div>
                  </div>

                  {/* Aksi Buttons: Edit Target & Riwayat */}
                  <div className="col-span-1 flex items-center justify-end gap-1.5 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKepling(item.kepling);
                        setIsModalEditOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer border border-amber-200"
                      title="Edit Target PERLINSOS atau Total Capaian Kepling ini"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-700" />
                    </button>

                    {onSelectKeplingRiwayat && (
                      <button
                        type="button"
                        onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer text-center"
                        title="Lihat riwayat laporan kepling ini"
                      >
                        Riwayat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola Target & Capaian Kepling (Super Admin) */}
      {isModalEditOpen && (
        <ModalEditTargetCapaian
          isOpen={isModalEditOpen}
          onClose={() => {
            setIsModalEditOpen(false);
            setEditingKepling(null);
          }}
          selectedKeplingAccount={editingKepling}
          targetsMap={targetsMap}
          reportedStatsMap={reportedStatsMap}
          onSaveKepling={handleSaveKeplingTarget}
          onSaveAll={handleSaveAllTargets}
          onResetDefaults={handleResetDefaults}
        />
      )}
    </div>
  );
};
