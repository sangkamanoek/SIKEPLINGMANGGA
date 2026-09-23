import React, { useState, useMemo, useEffect } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
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
import { GrafikTrenBulanan } from './GrafikTrenBulanan';
import { isReportMatchingKepling, getReportIsoDate } from '../lib/formatter';
import {
  Map,
  MapPin,
  Compass,
  Layers,
  Navigation,
  ExternalLink,
  Trash,
  Home,
  Check,
  Phone,
  Coins,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import {
  getLocalHouses,
  getLocalRoads,
  getLocalPolygons,
  subscribeWebgisData,
} from '../lib/webgisService';
import {
  computeLingkunganPemetaanStats,
  computeKelurahanPemetaanOverview,
} from '../lib/pemetaanStatsHelper';
import { TitikRumahBangunan, RuasJalanLingkungan, LingkunganPolygon } from '../types';
import {
  AVAILABLE_PBB_YEARS,
  DEFAULT_PBB_YEAR,
  getLocalSpptForYear,
  computePbbOverview,
  subscribePbbSpptFromFirestore,
  fetchPbbSpptFromFirestore,
} from '../lib/pbbService';
import { SpptPbbItem } from '../data/pbbSampleData';

interface DashboardCapaianKeplingProps {
  reports: LaporanHarianItem[];
  activeAccount: UserAccount;
  mode: 'kepling' | 'super_admin';
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
  onOpenReportDetail?: (report: LaporanHarianItem) => void;
  onNavigateToForm?: () => void;
  onNavigateToPemetaan?: (lingkunganNomor?: number) => void;
  onOpenRekapPbb?: () => void;
}

type PeriodFilter = 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'ALL';

export const DashboardCapaianKepling: React.FC<DashboardCapaianKeplingProps> = ({
  reports,
  activeAccount,
  mode,
  onSelectKeplingRiwayat,
  onOpenReportDetail,
  onNavigateToForm,
  onNavigateToPemetaan,
  onOpenRekapPbb,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('THIS_MONTH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKeplingCard, setSelectedKeplingCard] = useState<string | null>(null);

  // WebGIS Data State for Real-time Spatial Integration
  const [gisHouses, setGisHouses] = useState<TitikRumahBangunan[]>(getLocalHouses);
  const [gisRoads, setGisRoads] = useState<RuasJalanLingkungan[]>(getLocalRoads);
  const [gisPolygons, setGisPolygons] = useState<LingkunganPolygon[]>(getLocalPolygons);

  useEffect(() => {
    const unsub = subscribeWebgisData(
      (p) => setGisPolygons(p),
      (h) => setGisHouses(h),
      (r) => setGisRoads(r)
    );
    return () => unsub();
  }, []);

  // Compute Pemetaan Stats for Kepling
  const myLingkunganStats = useMemo(() => {
    return computeLingkunganPemetaanStats(
      activeAccount.nomorLingkungan || 1,
      gisHouses,
      gisRoads,
      gisPolygons
    );
  }, [activeAccount.nomorLingkungan, gisHouses, gisRoads, gisPolygons]);

  // Compute Pemetaan Stats for Super Admin
  const kelurahanPemetaanOverview = useMemo(() => {
    return computeKelurahanPemetaanOverview(gisHouses, gisRoads, gisPolygons);
  }, [gisHouses, gisRoads, gisPolygons]);

  // Target & Capaian Management State
  const [targetsMap, setTargetsMap] = useState<TargetsCapaianMap>(getDefaultTargetsCapaianMap);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [editingKepling, setEditingKepling] = useState<UserAccount | null>(null);

  // Real-time SPPT & Realisasi PBB State
  const [pbbYear, setPbbYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sikepling_pbb_selected_year');
      if (saved) {
        const num = parseInt(saved, 10);
        if (AVAILABLE_PBB_YEARS.includes(num)) return num;
      }
    } catch {}
    return DEFAULT_PBB_YEAR;
  });
  const [spptList, setSpptList] = useState<SpptPbbItem[]>(() => getLocalSpptForYear(pbbYear));
  const [isSyncingPbb, setIsSyncingPbb] = useState(false);

  useEffect(() => {
    setSpptList(getLocalSpptForYear(pbbYear));
    fetchPbbSpptFromFirestore(pbbYear).then((items) => {
      if (Array.isArray(items)) setSpptList(items);
    }).catch(() => {});
    const unsub = subscribePbbSpptFromFirestore(pbbYear, (items) => {
      if (Array.isArray(items)) setSpptList(items);
    });
    return () => unsub();
  }, [pbbYear]);

  const handleManualSyncPbb = async () => {
    setIsSyncingPbb(true);
    try {
      const items = await fetchPbbSpptFromFirestore(pbbYear);
      if (Array.isArray(items)) {
        setSpptList(items);
      }
    } catch {} finally {
      setIsSyncingPbb(false);
    }
  };

  const pbbOverview = useMemo(() => {
    return computePbbOverview(spptList, pbbYear);
  }, [spptList, pbbYear]);

  const myPbbStats = useMemo(() => {
    return pbbOverview.lingkunganSummaries.find(lk => lk.lingkungan === (activeAccount.nomorLingkungan || 1));
  }, [pbbOverview, activeAccount.nomorLingkungan]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

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
    // Ambil realisasi PBB riil dari data SPPT (Wajib Pajak yang berstatus Sudah Bayar)
    const pbbFromSppt = myPbbStats ? myPbbStats.wpLunas : 0;

    let reportedPbb = 0;
    let totalPerlinsos = 0;
    let totalIkd = 0;
    let totalBpjs = 0;

    myReports.forEach((r) => {
      reportedPbb += Number(r.kinerja?.opsirPbbWp) || 0;
      totalPerlinsos += Number(r.kinerja?.perlinsosKk) || 0;
      totalIkd += Number(r.kinerja?.ikdOrang) || 0;
      totalBpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
    });

    const uniqueDays = new Set(myReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));
    const allUniqueDays = new Set(myAllTimeReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));

    return {
      totalPbb: myPbbStats !== undefined ? pbbFromSppt : reportedPbb,
      totalPerlinsos,
      totalIkd,
      totalBpjs,
      laporanCount: myReports.length,
      hariMelapor: uniqueDays.size,
      totalHariMelaporAllTime: allUniqueDays.size,
    };
  }, [myReports, myAllTimeReports, myPbbStats]);

  // Raw reported stats map for modal and calculations
  const reportedStatsMap = useMemo(() => {
    const map: Record<
      string,
      { pbb: number; perlinsos: number; ikd: number; bpjs: number; reportCount: number }
    > = {};

    KEPLING_ACCOUNTS.forEach((k) => {
      const kReports = filteredReportsByPeriod.filter((r) => isReportMatchingKepling(r, k));

      let pbbReported = 0;
      let perlinsos = 0;
      let ikd = 0;
      let bpjs = 0;

      kReports.forEach((r) => {
        pbbReported += Number(r.kinerja?.opsirPbbWp) || 0;
        perlinsos += Number(r.kinerja?.perlinsosKk) || 0;
        ikd += Number(r.kinerja?.ikdOrang) || 0;
        bpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
      });

      // Ambil Realisasi PBB riil dari data SPPT (Wajib Pajak yang berstatus Sudah Bayar di Lingkungan ini)
      const lkNum = k.nomorLingkungan;
      const lkSummary = pbbOverview.lingkunganSummaries.find((s) => s.lingkungan === lkNum);
      const pbb = lkSummary !== undefined ? lkSummary.wpLunas : pbbReported;

      map[k.id] = {
        pbb,
        perlinsos,
        ikd,
        bpjs,
        reportCount: kReports.length,
      };
    });

    return map;
  }, [filteredReportsByPeriod, pbbOverview.lingkunganSummaries]);

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
      const targetBpjs = targetConfig?.targetBpjs ?? 10;

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
    const todayStr = new Date().toISOString().split('T')[0];
    printOfficialDocument('lembar-cetak-rekap-capaian', `REKAP_CAPAIAN_KINERJA_KEPLING_${todayStr}`);
  };

  return (
    <div id="lembar-cetak-rekap-capaian" className="space-y-6">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-emerald-950/80 p-1.5 rounded-2xl border border-emerald-600/50 shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => setPeriod('TODAY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'TODAY'
                  ? 'bg-white text-emerald-950 shadow-md'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7_DAYS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === '7_DAYS'
                  ? 'bg-white text-emerald-950 shadow-md'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setPeriod('THIS_MONTH')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'THIS_MONTH'
                  ? 'bg-white text-emerald-950 shadow-md'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'ALL'
                  ? 'bg-white text-emerald-950 shadow-md'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
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
                className="px-3.5 py-1.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-amber-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ml-1 border border-amber-200"
                title="Atur Target PERLINSOS dan Edit Capaian 24 Kepling"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-950" />
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
                {/* 1. Realisasi PBB (Terkoneksi Master SPPT) */}
                <div
                  onClick={() => onOpenRekapPbb && onOpenRekapPbb()}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
                  title="Klik untuk membuka detail Rekapitulasi & SPPT PBB"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        1. Realisasi PBB ({pbbYear})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                        SPPT Riil
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-900 tracking-tight">
                        {effectiveMyKinerja.pbb}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        / {myPbbStats ? myPbbStats.totalWp : (activeTargetConfig?.targetPbb || 100)} WP Lunas
                      </span>
                    </div>

                    {/* Progress Bar PBB */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-emerald-950 font-black">Realisasi Nominal</span>
                        <span className="text-emerald-800 font-black">
                          {myPbbStats ? `${myPbbStats.persentaseRealisasi.toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, myPbbStats ? myPbbStats.persentaseRealisasi : 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 truncate font-medium">
                      {myPbbStats
                        ? `${formatRupiah(myPbbStats.realisasiNominal)} dari target ${formatRupiah(myPbbStats.targetNominal)}`
                        : 'Wajib Pajak yang telah melunasi PBB.'}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{myPbbStats ? `${myPbbStats.wpLunas} WP Lunas (${myPbbStats.persentaseWpLunas.toFixed(1)}%)` : 'Data SPPT PBB'}</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Buka Rekap <ChevronRight className="w-3 h-3" />
                    </span>
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
                    <span>Target: {activeTargetConfig?.targetBpjs || 10} Org</span>
                    <span className="text-amber-700 font-bold">Perlindungan Kerja</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* REALISASI PBB-P2 (DATABASE SPPT RESMI)                                   */}
          {/* ========================================================================= */}
          {myPbbStats && (
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-6 text-white border border-emerald-800/60 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider">
                        Realisasi PBB-P2 Resmi
                      </span>
                      <span className="text-xs text-emerald-300 font-bold">Database SPPT {pbbYear}</span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      Status Capaian Ketetapan PBB {activeAccount.lingkungan}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-emerald-900/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">Tahun:</span>
                    <select
                      value={pbbYear}
                      onChange={(e) => {
                        const yr = parseInt(e.target.value, 10);
                        setPbbYear(yr);
                        try {
                          localStorage.setItem('sikepling_pbb_selected_year', String(yr));
                        } catch {}
                      }}
                      className="bg-transparent text-amber-300 text-xs font-black focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_PBB_YEARS.map((yr) => (
                        <option key={yr} value={yr} className="bg-slate-900 text-white font-bold">
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualSyncPbb}
                    disabled={isSyncingPbb}
                    title="Sinkronkan data PBB dari Server Buffer & Cloud Firestore"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold border border-emerald-500/50 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPbb ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
                    <span className="hidden sm:inline">{isSyncingPbb ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Target Ketetapan</span>
                  <span className="text-lg font-black text-white block mt-0.5">{formatRupiah(myPbbStats.targetNominal)}</span>
                </div>
                <div className="bg-emerald-800/40 p-4 rounded-2xl border border-emerald-500/30">
                  <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest block">Realisasi Lunas</span>
                  <span className="text-lg font-black text-amber-300 block mt-0.5">{formatRupiah(myPbbStats.realisasiNominal)}</span>
                  <div className="mt-2 w-full bg-emerald-950 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full" 
                      style={{ width: `${Math.min(myPbbStats.persentaseRealisasi, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">WP Lunas</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-black text-white">{myPbbStats.wpLunas}</span>
                    <span className="text-xs text-slate-400">/ {myPbbStats.totalWp} SPPT</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 mt-2 font-bold">
                    <span>Kepatuhan:</span>
                    <span>{myPbbStats.persentaseWpLunas.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                <p className="text-[11px] text-slate-400 italic">
                  * Data disinkronisasi langsung dari database SPPT resmi Kelurahan Mangga secara real-time.
                </p>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-all border border-white/10 flex items-center gap-1.5"
                  onClick={() => onOpenRekapPbb?.()}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Lihat Rincian Daftar SPPT</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HASIL PEMETAAN SPASIAL & POTENSI LINGKUNGAN (WEBGIS, DEMOGRAFI & WRS)     */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-sm overflow-hidden">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-5 sm:p-6 text-white relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                    <Map className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                        WebGIS & Pemetaan Spasial
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        myLingkunganStats.hasPolygon
                          ? 'bg-emerald-900/80 text-emerald-200 border-emerald-600/60'
                          : 'bg-amber-950/80 text-amber-200 border-amber-500/50'
                      }`}>
                        {myLingkunganStats.hasPolygon
                          ? `✓ Batas Poligon Terpetakan (${myLingkunganStats.polygonPointsCount} Sudut)`
                          : '⚠ Batas Poligon Belum Digambar'}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                      Hasil Pemetaan Spasial & Potensi {activeAccount.lingkungan}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Kelurahan Mangga • Terintegrasi langsung dengan Peta Spasial, Wajib Retribusi Sampah (WRS), & PBB
                    </p>
                  </div>
                </div>

                {onNavigateToPemetaan && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPemetaan(activeAccount.nomorLingkungan)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-md shrink-0"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Buka Peta WebGIS Lingkungan</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 6 Key Pemetaan Summary Cards */}
            <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Titik Rumah & Bangunan */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Titik Rumah Terpetakan
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Home className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {myLingkunganStats.totalRumah}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">Bangunan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {myLingkunganStats.totalRumah > 0
                        ? `Memiliki titik koordinat GPS akurat di ${activeAccount.lingkungan}`
                        : 'Belum ada titik rumah yang dipetakan di peta'}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Bansos Terdata:</span>
                    <strong className="text-emerald-700 font-bold">{myLingkunganStats.bansosKk} KK</strong>
                  </div>
                </div>

                {/* 2. Demografi Kependudukan */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                      Demografi Penduduk
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-blue-950">
                      {myLingkunganStats.totalJiwa}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">Jiwa</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      L: <strong className="text-slate-800">{myLingkunganStats.totalLakiLaki}</strong> • P: <strong className="text-slate-800">{myLingkunganStats.totalPerempuan}</strong> Jiwa
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Anak: {myLingkunganStats.totalAnak}</span>
                    <span className="text-slate-500">Lansia: <strong className="text-slate-800">{myLingkunganStats.totalLansia}</strong></span>
                  </div>
                </div>

                {/* 3. Status KK (KTP Mangga vs Luar) */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                      Status KK Warga
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-purple-950">
                      {myLingkunganStats.persenKkMangga}%
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">KTP Mangga</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {myLingkunganStats.kkMangga} KK Asli • {myLingkunganStats.kkLuar} KK Luar/Pendatang
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Total KK Terdata:</span>
                    <strong className="text-purple-800 font-bold">{myLingkunganStats.totalRumah} KK</strong>
                  </div>
                </div>

                {/* 4. Kepatuhan WRS (Retribusi Sampah) */}
                <div className="bg-white rounded-xl p-4 border-2 border-amber-300 shadow-2xs hover:border-amber-400 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider">
                      Wajib Retribusi Sampah (WRS)
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-amber-950">
                      {myLingkunganStats.wrsAktif}
                      <span className="text-xs font-semibold text-amber-800 ml-1.5">
                        Aktif ({myLingkunganStats.persenWrsAktif}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Mandiri: {myLingkunganStats.wrsMandiri} • Belum: {myLingkunganStats.wrsBelum}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Potensi Retribusi:</span>
                    <strong className="text-emerald-800 font-black">
                      Rp {myLingkunganStats.potensiRetribusiWrs.toLocaleString('id-ID')}/bln
                    </strong>
                  </div>
                </div>

                {/* 5. Status PBB */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      Status Pajak PBB
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                      {myLingkunganStats.pbbLunas}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">
                        Lunas ({myLingkunganStats.persenPbbLunas}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Belum Lunas: {myLingkunganStats.pbbBelumLunas} • Bebas Pajak: {myLingkunganStats.pbbBebas}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Nominal Terdata:</span>
                    <strong className="text-emerald-700 font-bold">
                      Rp {myLingkunganStats.totalNominalPbb.toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                {/* 6. Ruas Jalan & Gang */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-teal-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                      Infrastruktur Jalan & Gang
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Navigation className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-2xl sm:text-3xl font-black text-teal-900">
                      {myLingkunganStats.totalRuasJalan}
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">Ruas</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Total Panjang: <strong className="text-slate-800">{myLingkunganStats.totalPanjangJalanMeter}</strong> meter
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Kondisi:</span>
                    <span className="text-xs">
                      <strong className="text-emerald-700">{myLingkunganStats.jalanBaik} Baik</strong>
                      {' • '}
                      <strong className="text-rose-600">{myLingkunganStats.jalanRusak} Rusak</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat / Daftar Rumah Terpetakan Terbaru */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Titik Rumah Warga Terpetakan ({myLingkunganStats.totalRumah} Data)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Data spasial rumah warga yang telah didata oleh {activeAccount.nama} di {activeAccount.lingkungan}
                  </p>
                </div>
                {onNavigateToPemetaan && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPemetaan(activeAccount.nomorLingkungan)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>Buka Semua di WebGIS</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {myLingkunganStats.recentHouses.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 space-y-2">
                  <Home className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">
                    Belum ada titik rumah yang dipetakan untuk {activeAccount.lingkungan}.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Gunakan fitur Pemetaan WebGIS untuk menandai titik rumah warga door-to-door, mencatat status WRS, PBB, dan demografi keluarga.
                  </p>
                  {onNavigateToPemetaan && (
                    <button
                      type="button"
                      onClick={() => onNavigateToPemetaan(activeAccount.nomorLingkungan)}
                      className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Mulai Petakan Rumah Sekarang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {myLingkunganStats.recentHouses.slice(0, 5).map((house) => (
                    <div
                      key={house.id}
                      className="p-3.5 sm:p-4 hover:bg-emerald-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {house.namaKepalaKeluarga || 'Tanpa Nama KK'}
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            house.isKkMangga !== false
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {house.isKkMangga !== false ? 'KTP Mangga' : 'KTP Luar'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            house.statusWrs === 'AKTIF'
                              ? 'bg-emerald-100 text-emerald-800'
                              : house.statusWrs === 'MANDIRI'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            WRS: {house.statusWrs || 'BELUM'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            house.statusPbb === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            PBB: {house.statusPbb || 'BELUM'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {house.alamat || house.namaJalan || 'Alamat belum dispesifikasi'}
                          {house.nomorRumah ? ` No. ${house.nomorRumah}` : ''}
                          {house.namaGang ? ` (${house.namaGang})` : ''}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>Jiwa: {house.jumlahJiwa || (Number(house.jumlahLakiLaki || 0) + Number(house.jumlahPerempuan || 0)) || 1} orang</span>
                          <span>•</span>
                          <span>
                            Koordinat:{' '}
                            {(() => {
                              const rawLat = house.lat ?? (house as any).latitude;
                              const rawLng = house.lng ?? (house as any).longitude;
                              const numLat = typeof rawLat === 'number' ? rawLat : (rawLat ? parseFloat(String(rawLat)) : NaN);
                              const numLng = typeof rawLng === 'number' ? rawLng : (rawLng ? parseFloat(String(rawLng)) : NaN);
                              return !isNaN(numLat) && !isNaN(numLng)
                                ? `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`
                                : 'Belum ditentukan';
                            })()}
                          </span>
                        </div>
                      </div>

                      {onNavigateToPemetaan && (
                        <button
                          type="button"
                          onClick={() => onNavigateToPemetaan(activeAccount.nomorLingkungan)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1 shrink-0"
                          title="Buka titik ini di Peta WebGIS"
                        >
                          <Compass className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Peta</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grafik Batang Tren Laporan Bulanan (Recharts) */}
          <GrafikTrenBulanan
            reports={reports}
            activeAccount={activeAccount}
            mode="kepling"
            title={`Tren Jumlah Laporan Selesai per Bulan (${activeAccount.lingkungan})`}
          />

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

            {/* Total PBB Kelurahan (Terkoneksi Realisasi PBB SPPT) */}
            <div
              onClick={() => onOpenRekapPbb && onOpenRekapPbb()}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-xs cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group"
              title="Klik untuk membuka Rekapitulasi Realisasi PBB Kelurahan"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase block">
                  Realisasi PBB ({pbbYear})
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  {pbbOverview.persentaseRealisasiNominal.toFixed(1)}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">
                {pbbOverview.totalWpLunas}
                <span className="text-xs font-semibold text-slate-500 ml-1">WP Lunas</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                {formatRupiah(pbbOverview.totalRealisasiNominal)}
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

          {/* Grafik Batang Tren Laporan Bulanan Seluruh Lingkungan (Recharts) */}
          <GrafikTrenBulanan
            reports={reports}
            activeAccount={activeAccount}
            mode="super_admin"
          />

          {/* ========================================================================= */}
          {/* REKAPITULASI HASIL PEMETAAN SPASIAL 24 LINGKUNGAN (WEBGIS & WRS)         */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-5 sm:p-7 text-white border border-emerald-800/40 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-emerald-800/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center font-black shrink-0 shadow-inner">
                  <Map className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                      WebGIS Spasial Kelurahan
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded border border-white/15">
                      {kelurahanPemetaanOverview.totalLingkunganTerpetakan} dari 24 Lingkungan Aktif
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                    Rekapitulasi Hasil Pemetaan WebGIS & WRS 24 Lingkungan
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Data spasial titik bangunan warga, kepatuhan Wajib Retribusi Sampah (WRS), dan demografi se-Kelurahan Mangga
                  </p>
                </div>
              </div>

              {onNavigateToPemetaan && (
                <button
                  type="button"
                  onClick={() => onNavigateToPemetaan()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-md shrink-0 self-start md:self-auto"
                >
                  <Compass className="w-4 h-4" />
                  <span>Buka Peta WebGIS Kelurahan</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
            </div>

            {/* Quick KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                  Rumah Terpetakan
                </span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {kelurahanPemetaanOverview.totalRumahAll}
                  <span className="text-xs font-normal text-slate-300 ml-1">Rumah</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Titik GPS akurat
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-blue-300 uppercase block">
                  Total Penduduk
                </span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {kelurahanPemetaanOverview.totalJiwaAll}
                  <span className="text-xs font-normal text-slate-300 ml-1">Jiwa</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  L: {kelurahanPemetaanOverview.totalLakiLakiAll} • P: {kelurahanPemetaanOverview.totalPerempuanAll}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-purple-300 uppercase block">
                  Status KK
                </span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {kelurahanPemetaanOverview.persenKkManggaAll}%
                  <span className="text-xs font-normal text-slate-300 ml-1">KTP Mangga</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  {kelurahanPemetaanOverview.totalKkManggaAll} Asli / {kelurahanPemetaanOverview.totalKkLuarAll} Luar
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-amber-300 uppercase block">
                  WRS Aktif
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                  {kelurahanPemetaanOverview.totalWrsAktifAll}
                  <span className="text-xs font-normal text-slate-300 ml-1">
                    ({kelurahanPemetaanOverview.persenWrsAktifAll}%)
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Rp {kelurahanPemetaanOverview.potensiRetribusiWrsAll.toLocaleString('id-ID')}/bln
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                  PBB Lunas
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                  {kelurahanPemetaanOverview.totalPbbLunasAll}
                  <span className="text-xs font-normal text-slate-300 ml-1">
                    ({kelurahanPemetaanOverview.persenPbbLunasAll}%)
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Rp {kelurahanPemetaanOverview.totalNominalPbbAll.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                <span className="text-[10px] font-bold text-teal-300 uppercase block">
                  Ruas Jalan & Gang
                </span>
                <div className="text-xl sm:text-2xl font-black text-teal-300 mt-1">
                  {kelurahanPemetaanOverview.totalRuasJalanAll}
                  <span className="text-xs font-normal text-slate-300 ml-1">Ruas</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  {kelurahanPemetaanOverview.totalPanjangJalanMeterAll} Meter terdata
                </p>
              </div>
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
                    {(() => {
                      const lingStats = kelurahanPemetaanOverview.perLingkunganMap[item.kepling.id];
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                          <span>{item.kepling.lingkungan}</span>
                          {lingStats && lingStats.totalRumah > 0 && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                              {lingStats.totalRumah} Rumah
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
                    <div
                      onClick={() => onOpenRekapPbb && onOpenRekapPbb()}
                      className="bg-emerald-50/70 hover:bg-emerald-100 p-1.5 rounded-lg border border-emerald-200/80 cursor-pointer transition-colors"
                      title={`Klik untuk lihat Rekapitulasi SPPT PBB Lingkungan ${item.kepling.nomorLingkungan}`}
                    >
                      <span className="text-[9px] text-emerald-700 block font-normal md:hidden">PBB Lunas</span>
                      <span className="text-emerald-800 font-black">{item.pbb} WP</span>
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

                  {/* Aksi Buttons: Edit Target & Riwayat & Peta */}
                  <div className="col-span-1 flex items-center justify-end gap-1.5 w-full md:w-auto">
                    {onNavigateToPemetaan && (
                      <button
                        type="button"
                        onClick={() => onNavigateToPemetaan(item.kepling.nomorLingkungan)}
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer border border-emerald-200"
                        title={`Buka Peta WebGIS ${item.kepling.lingkungan}`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                      </button>
                    )}

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
