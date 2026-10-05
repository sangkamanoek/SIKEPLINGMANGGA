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
  Sun,
  Activity,
  UserCheck,
  ShieldCheck,
  Radio,
  CalendarCheck,
} from 'lucide-react';
import {
  LaporanHarianItem,
  UserAccount,
  TargetsCapaianMap,
  KeplingTargetCapaian,
  AbsenApelItem,
  EventAttendance,
  type CustomEvent,
} from '../types';
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
  subscribeTargetsFromFirestore,
} from '../lib/targetsApi';
import { ModalEditTargetCapaian } from './ModalEditTargetCapaian';
import { GrafikTrenBulanan } from './GrafikTrenBulanan';
import { GrafikTrenMingguan } from './GrafikTrenMingguan';
import { isReportMatchingKepling, getReportIsoDate, isKunjunganMatchingKepling } from '../lib/formatter';
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

export type LeaderboardSortCriterion =
  | 'KOMPOSIT'
  | 'APEL'
  | 'KEGIATAN'
  | 'PERLINSOS'
  | 'PBB'
  | 'BPJS'
  | 'KUNJUNGAN'
  | 'POSKAMLING';

interface DashboardCapaianKeplingProps {
  reports: LaporanHarianItem[];
  activeAccount: UserAccount;
  mode: 'kepling' | 'super_admin';
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
  onOpenReportDetail?: (report: LaporanHarianItem) => void;
  onNavigateToForm?: () => void;
  onNavigateToPemetaan?: (lingkunganNomor?: number) => void;
  onOpenRekapPbb?: () => void;
  attendanceList?: AbsenApelItem[];
  eventAttendanceList?: EventAttendance[];
  customEvents?: CustomEvent[];
  kunjunganList?: any[];
}

type PeriodCategory = 'MINGGUAN' | 'BULANAN' | 'TAHUNAN' | 'HARIAN';

export type PeriodFilter =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | '7_DAYS'
  | 'WEEK_1'
  | 'WEEK_2'
  | 'WEEK_3'
  | 'WEEK_4'
  | 'THIS_MONTH'
  | 'THIS_YEAR'
  | 'ALL'
  | string;

const INDONESIAN_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Returns helper dates for current week, last week, and month bounds
 */
export function getPeriodDateBounds(referenceDate: Date = new Date()) {
  const now = new Date(referenceDate);
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  const todayIso = now.toISOString().split('T')[0];

  // Current Week Bounds (Monday to Sunday)
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const thisWeekStartIso = monday.toISOString().split('T')[0];
  const thisWeekEndIso = sunday.toISOString().split('T')[0];

  // Last Week Bounds
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);
  const lastSunday = new Date(sunday);
  lastSunday.setDate(sunday.getDate() - 7);

  const lastWeekStartIso = lastMonday.toISOString().split('T')[0];
  const lastWeekEndIso = lastSunday.toISOString().split('T')[0];

  // Seven days ago
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return {
    todayIso,
    currentYearMonth,
    thisWeekStartIso,
    thisWeekEndIso,
    lastWeekStartIso,
    lastWeekEndIso,
    sevenDaysAgo,
    year,
    month,
  };
}

/**
 * Validates if an ISO date string falls into the selected period
 */
export function checkDateInPeriod(dateIso: string, period: string, referenceDate: Date = new Date()): boolean {
  if (!dateIso) return true;
  const bounds = getPeriodDateBounds(referenceDate);

  if (period === 'TODAY' || period === 'HARIAN') {
    return dateIso === bounds.todayIso;
  }

  if (period === 'THIS_WEEK') {
    return dateIso >= bounds.thisWeekStartIso && dateIso <= bounds.thisWeekEndIso;
  }

  if (period === 'LAST_WEEK') {
    return dateIso >= bounds.lastWeekStartIso && dateIso <= bounds.lastWeekEndIso;
  }

  if (period === '7_DAYS') {
    return dateIso >= bounds.sevenDaysAgo && dateIso <= bounds.todayIso;
  }

  if (period === 'THIS_MONTH') {
    return dateIso.startsWith(bounds.currentYearMonth);
  }

  if (period === 'THIS_YEAR' || period === 'YEAR_2026') {
    return dateIso.startsWith('2026');
  }

  if (period === 'YEAR_2025') {
    return dateIso.startsWith('2025');
  }

  if (period === 'ALL') {
    return true;
  }

  // Week 1 to 4 of current month
  if (period === 'WEEK_1') {
    if (!dateIso.startsWith(bounds.currentYearMonth)) return false;
    const day = parseInt(dateIso.split('-')[2], 10);
    return day >= 1 && day <= 7;
  }
  if (period === 'WEEK_2') {
    if (!dateIso.startsWith(bounds.currentYearMonth)) return false;
    const day = parseInt(dateIso.split('-')[2], 10);
    return day >= 8 && day <= 14;
  }
  if (period === 'WEEK_3') {
    if (!dateIso.startsWith(bounds.currentYearMonth)) return false;
    const day = parseInt(dateIso.split('-')[2], 10);
    return day >= 15 && day <= 21;
  }
  if (period === 'WEEK_4') {
    if (!dateIso.startsWith(bounds.currentYearMonth)) return false;
    const day = parseInt(dateIso.split('-')[2], 10);
    return day >= 22;
  }

  // Specific Month (e.g. MONTH_2026-10, MONTH_2026-09)
  if (period.startsWith('MONTH_')) {
    const ym = period.replace('MONTH_', '');
    return dateIso.startsWith(ym);
  }

  // Specific Year (e.g. YEAR_2026)
  if (period.startsWith('YEAR_')) {
    const yr = period.replace('YEAR_', '');
    return dateIso.startsWith(yr);
  }

  return true;
}

export const getPeriodLabel = (p: string, referenceDate: Date = new Date()) => {
  const bounds = getPeriodDateBounds(referenceDate);
  const curMonthName = INDONESIAN_MONTH_NAMES[bounds.month] || 'Bulan Ini';

  if (p === 'TODAY') return 'Hari Ini';
  if (p === 'THIS_WEEK') return `Minggu Ini (${bounds.thisWeekStartIso} s/d ${bounds.thisWeekEndIso})`;
  if (p === 'LAST_WEEK') return `Minggu Lalu (${bounds.lastWeekStartIso} s/d ${bounds.lastWeekEndIso})`;
  if (p === '7_DAYS') return '7 Hari Terakhir';
  if (p === 'WEEK_1') return `Minggu I (1 - 7 ${curMonthName} ${bounds.year})`;
  if (p === 'WEEK_2') return `Minggu II (8 - 14 ${curMonthName} ${bounds.year})`;
  if (p === 'WEEK_3') return `Minggu III (15 - 21 ${curMonthName} ${bounds.year})`;
  if (p === 'WEEK_4') return `Minggu IV (22 - Akhir ${curMonthName} ${bounds.year})`;
  if (p === 'THIS_MONTH') return `Bulan Ini (${curMonthName} ${bounds.year})`;
  if (p === 'THIS_YEAR' || p === 'YEAR_2026') return 'Tahun 2026 (Tahunan)';
  if (p === 'YEAR_2025') return 'Tahun 2025 (Tahunan)';
  if (p === 'ALL') return 'Kumulatif (Semua Waktu)';
  
  if (p.startsWith('MONTH_')) {
    const ym = p.replace('MONTH_', '');
    const [y, m] = ym.split('-');
    const idx = parseInt(m, 10) - 1;
    return `Bulan ${INDONESIAN_MONTH_NAMES[idx] || m} ${y}`;
  }

  if (p.startsWith('YEAR_')) {
    const yr = p.replace('YEAR_', '');
    return `Tahun ${yr}`;
  }

  return p;
};

export const DashboardCapaianKepling: React.FC<DashboardCapaianKeplingProps> = ({
  reports,
  activeAccount,
  mode,
  onSelectKeplingRiwayat,
  onOpenReportDetail,
  onNavigateToForm,
  onNavigateToPemetaan,
  onOpenRekapPbb,
  attendanceList = [],
  eventAttendanceList = [],
  customEvents = [],
  kunjunganList = [],
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('THIS_MONTH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKeplingCard, setSelectedKeplingCard] = useState<string | null>(null);
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSortCriterion>('KOMPOSIT');

  const isPbbAllowed = useMemo(() => {
    return (
      activeAccount.role === 'super_admin' ||
      activeAccount.role === 'kasi_pemerintahan' ||
      activeAccount.role === 'petugas_bapenda' ||
      activeAccount.role === 'kepling'
    );
  }, [activeAccount.role]);

  useEffect(() => {
    if (!isPbbAllowed && leaderboardSort === 'PBB') {
      setLeaderboardSort('KOMPOSIT');
    }
  }, [isPbbAllowed, leaderboardSort]);

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

  // Load targets & capaian from server / local on mount, and listen to real-time updates
  useEffect(() => {
    let isMounted = true;
    fetchTargetsCapaian().then((data) => {
      if (isMounted && data) {
        setTargetsMap(data);
      }
    });
    const unsub = subscribeTargetsFromFirestore((data) => {
      if (isMounted && data && Object.keys(data).length > 0) {
        setTargetsMap((prev) => ({ ...prev, ...data }));
      }
    });
    return () => {
      isMounted = false;
      unsub();
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
  const now = useMemo(() => new Date(), []);
  const bounds = useMemo(() => getPeriodDateBounds(now), [now]);
  const todayIso = bounds.todayIso;
  const currentYearMonth = bounds.currentYearMonth;

  // 1. Filter reports by selected period
  const filteredReportsByPeriod = useMemo(() => {
    return reports.filter((r) => {
      const dateIso = getReportIsoDate(r);
      return checkDateInPeriod(dateIso, period, now);
    });
  }, [reports, period, now]);

  // 2. Filter Apel Pagi records strictly by selected period
  const filteredAttendanceByPeriod = useMemo(() => {
    return (attendanceList || []).filter((a) => {
      const dateIso = a.tanggal || (a.createdAt ? a.createdAt.split('T')[0] : '');
      return checkDateInPeriod(dateIso, period, now);
    });
  }, [attendanceList, period, now]);

  // Tanggal Apel Pagi yang tercatat secara global pada periode terpilih
  const distinctApelDatesInPeriod = useMemo(() => {
    const dates = new Set<string>();
    filteredAttendanceByPeriod.forEach((a) => {
      if (a.tanggal) dates.add(a.tanggal);
    });
    filteredReportsByPeriod.forEach((r) => {
      if (r.absenApel?.status === 'Hadir' || r.absenApel?.status === 'Dinas Luar') {
        const iso = getReportIsoDate(r);
        if (iso) dates.add(iso);
      }
    });
    return dates;
  }, [filteredAttendanceByPeriod, filteredReportsByPeriod]);

  // 3. Filter Event Attendance by selected period
  const filteredEventAttendanceByPeriod = useMemo(() => {
    return (eventAttendanceList || []).filter((e) => {
      const dateIso = (e as any).tanggal || (e.createdAt ? e.createdAt.split('T')[0] : '');
      return checkDateInPeriod(dateIso, period, now);
    });
  }, [eventAttendanceList, period, now]);

  // 4. Filter Custom Events by selected period
  const filteredCustomEventsByPeriod = useMemo(() => {
    return (customEvents || []).filter((ev) => {
      const dateIso = (ev as any).tanggal || '';
      return checkDateInPeriod(dateIso, period, now);
    });
  }, [customEvents, period, now]);

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

  // Memori Kunjungan Harian (prioritas props, fallback localStorage tanpa network query)
  const effectiveKunjunganList = useMemo(() => {
    if (Array.isArray(kunjunganList) && kunjunganList.length > 0) return kunjunganList;
    try {
      const stored = localStorage.getItem('sikepling_kunjungan_harian_list_v1');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }, [kunjunganList]);

  // Filter Kunjungan Warga berdasarkan Periode Terpilih
  const filteredKunjunganByPeriod = useMemo(() => {
    return effectiveKunjunganList.filter((kj: any) => {
      if (!kj) return false;
      const dateIso =
        getReportIsoDate(kj) ||
        (kj.tanggal && String(kj.tanggal).match(/^\d{4}-\d{2}-\d{2}$/) ? String(kj.tanggal) : '') ||
        (kj.createdAt ? String(kj.createdAt).split('T')[0] : '');
      return checkDateInPeriod(dateIso, period, now);
    });
  }, [effectiveKunjunganList, period, now]);

  // Aggregasi untuk Seluruh 24 Kepling (7 Kriteria Kinerja Terpadu)
  const keplingSummaryList = useMemo(() => {
    // Dynamic Poskamling target based on period:
    // Mingguan/Harian: 2 giat per minggu; Tahunan: 96 giat; Bulanan: 8 giat
    const isWeeklyOrDaily =
      period === 'TODAY' ||
      period === 'THIS_WEEK' ||
      period === 'LAST_WEEK' ||
      period === '7_DAYS' ||
      period.startsWith('WEEK_');
    const isYearlyOrAll = period === 'THIS_YEAR' || period.startsWith('YEAR_') || period === 'ALL';
    const targetPoskamlingPeriod = isWeeklyOrDaily ? 2 : isYearlyOrAll ? 96 : 8;

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
      
      // Ambil data realisasi SPPT PBB untuk lingkungan ini
      const lkNum = k.nomorLingkungan || (index + 1);
      const lkSummary = pbbOverview.lingkunganSummaries.find((s) => s.lingkungan === lkNum);

      // Target PBB (WP): Prioritaskan target riil dari SPPT PBB (totalWp) yang tersinkronisasi (misal: 255 WP untuk Lk XXII).
      const targetPbb =
        (targetConfig?.targetPbb && targetConfig.targetPbb !== 100)
          ? targetConfig.targetPbb
          : (lkSummary && lkSummary.totalWp > 0)
          ? lkSummary.totalWp
          : (targetConfig?.targetPbb || 100);

      const targetIkd = targetConfig?.targetIkd ?? 50;
      const targetBpjs = (targetConfig?.targetBpjs && targetConfig.targetBpjs >= 50) ? targetConfig.targetBpjs : 50;

      // Hitung Capaian Efektif (Realisasi dari Laporan atau Override Super Admin)
      const effective = calculateEffectiveKinerja(reported, targetConfig);

      const uniqueDays = new Set(kReports.map((r) => r.createdAt?.split('T')[0] || r.tanggal));

      // 1. TINGKAT KEHADIRAN APEL PAGI (Bobot 15%) - Dihitung murni dalam periode yang dipilih
      const kApelRecords = filteredAttendanceByPeriod.filter(
        (a) =>
          a.accountId === k.id ||
          a.nomorLingkungan === k.nomorLingkungan ||
          a.namaKepling?.trim().toLowerCase() === k.nama.trim().toLowerCase()
      );
      const kApelHadirList = kApelRecords.filter((a) => a.status === 'Hadir' || a.status === 'Dinas Luar');

      // Kumpulkan tanggal-tanggal unik kehadiran apel kepling ini pada periode berjalan
      const uniqueApelHadirDates = new Set<string>();
      kApelHadirList.forEach((a) => {
        if (a.tanggal) uniqueApelHadirDates.add(a.tanggal);
        else if (a.createdAt) uniqueApelHadirDates.add(a.createdAt.split('T')[0]);
      });
      kReports.forEach((r) => {
        if (r.absenApel?.status === 'Hadir' || r.absenApel?.status === 'Dinas Luar') {
          const iso = getReportIsoDate(r);
          if (iso) uniqueApelHadirDates.add(iso);
        }
      });
      const totalApelHadir = uniqueApelHadirDates.size;

      // Total sesi apel yang terselenggara di Kelurahan pada periode terpilih
      const totalApelSessions = distinctApelDatesInPeriod.size > 0
        ? distinctApelDatesInPeriod.size
        : (totalApelHadir > 0 ? totalApelHadir : 1);

      const apelPercentage = totalApelSessions > 0
        ? Math.min(100, Math.round((totalApelHadir / totalApelSessions) * 100))
        : (totalApelHadir > 0 ? 100 : 100);

      // 2. KEHADIRAN KEGIATAN KHUSUS (Bobot 15%) - Dihitung murni dalam periode yang dipilih
      const kEventRecords = filteredEventAttendanceByPeriod.filter(
        (e) =>
          e.accountId === k.id ||
          e.nomorLingkungan === k.nomorLingkungan ||
          e.namaKepling?.trim().toLowerCase() === k.nama.trim().toLowerCase()
      );
      const kegiatanHadir = kEventRecords.filter((e) => e.status === 'Hadir' || e.status === 'Dinas Luar').length;
      const relevantEvents = filteredCustomEventsByPeriod.filter(
        (ev) => ev.required || !ev.targetKeplingIds?.length || ev.targetKeplingIds.includes(k.id)
      );
      const kegiatanPercentage =
        relevantEvents.length > 0 ? Math.min(100, Math.round((kegiatanHadir / relevantEvents.length) * 100)) : 100;

      // 3. CAPAIAN PERLINSOS (Bobot 20%)
      const perlinsosPercentage =
        targetPerlinsos > 0 ? Math.round((effective.perlinsos / targetPerlinsos) * 100) : 0;

      // 4. REALISASI PBB (Bobot 20%)
      const pbbPercentage =
        targetPbb > 0
          ? Math.round((effective.pbb / targetPbb) * 100)
          : (lkSummary && lkSummary.persentaseWpLunas > 0)
          ? Math.round(lkSummary.persentaseWpLunas)
          : 0;

      // 5. BPJS KETENAGAKERJAAN (Bobot 10%)
      const bpjsPercentage = targetBpjs > 0 ? Math.round((effective.bpjs / targetBpjs) * 100) : 0;

      // 6. KUNJUNGAN HARIAN (Bobot 10%)
      const kKunjunganRecords = filteredKunjunganByPeriod.filter((kj: any) =>
        isKunjunganMatchingKepling(kj, k)
      );
      const targetKunjunganHarian = targetPerlinsos;
      const totalKunjungan = kKunjunganRecords.length;
      const kunjunganPercentage =
        targetPerlinsos > 0
          ? Math.round((totalKunjungan / targetPerlinsos) * 100)
          : 0;

      // 7. POSKAMLING / SISKAMLING (Bobot 10%)
      const poskamlingGiatReports = kReports.filter(
        (r) =>
          r.kinerja?.poskamlingAdaGiat === true ||
          (r.kinerja?.poskamlingStatus && r.kinerja.poskamlingStatus !== 'Tidak Ada') ||
          r.dokumentasiFoto?.some((f) => f.kategori === 'poskamling')
      );
      const targetPoskamlingBulan = targetPoskamlingPeriod;
      const poskamlingCount = poskamlingGiatReports.length;
      const poskamlingPercentage = Math.min(100, Math.round((poskamlingCount / targetPoskamlingBulan) * 100));

      // SKOR KOMPOSIT 7 KRITERIA TERPADU (Indeks Kinerja Kepling / IKKT - Skala 100 Poin)
      // Bobot Resmi:
      // Apel (15%) + Kegiatan (15%) + Perlinsos (20%) + PBB (20%) + BPJS (10%) + Kunjungan (10%) + Poskamling (10%) = 100%
      const compositeScoreRaw =
        Math.min(100, apelPercentage) * 0.15 +
        Math.min(100, kegiatanPercentage) * 0.15 +
        Math.min(110, perlinsosPercentage) * 0.2 +
        Math.min(110, pbbPercentage) * 0.2 +
        Math.min(100, bpjsPercentage) * 0.1 +
        Math.min(100, kunjunganPercentage) * 0.1 +
        Math.min(100, poskamlingPercentage) * 0.1;

      const compositeScore = Math.min(100, Math.round(compositeScoreRaw));
      const compositeScoreDecimal = Number(compositeScoreRaw.toFixed(1));

      return {
        kepling: k,
        reportCount: kReports.length,
        hariMelapor: uniqueDays.size,
        // Pilar Dasar
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
        pbbPercentage,
        bpjsPercentage,
        // 7 Kriteria Kinerja
        totalApelHadir,
        totalApelSessions,
        apelPercentage,
        kegiatanHadir,
        relevantEventsCount: relevantEvents.length,
        kegiatanPercentage,
        totalKunjungan,
        targetKunjunganHarian,
        kunjunganPercentage,
        poskamlingCount,
        targetPoskamlingBulan,
        poskamlingPercentage,
        // Skor Komposit
        compositeScore,
        compositeScoreDecimal,
        score: compositeScore,
        isPerlinsosOverridden: effective.isPerlinsosOverridden,
        isOverridden: effective.isOverridden,
        catatanPenyesuaian: targetConfig?.catatanPenyesuaian || '',
        latestReport: kReports[0] || null,
      };
    });
  }, [
    period,
    filteredReportsByPeriod,
    reportedStatsMap,
    targetsMap,
    filteredAttendanceByPeriod,
    distinctApelDatesInPeriod,
    filteredEventAttendanceByPeriod,
    filteredCustomEventsByPeriod,
    filteredKunjunganByPeriod,
    pbbOverview.lingkunganSummaries,
  ]);

  // Sorted leaderboard - Mendukung Pengurutan Komposit 7 Kriteria & Kriteria Spesifik
  const sortedLeaderboard = useMemo(() => {
    return [...keplingSummaryList].sort((a, b) => {
      if (leaderboardSort === 'APEL') {
        if (b.apelPercentage !== a.apelPercentage) return b.apelPercentage - a.apelPercentage;
        if (b.totalApelHadir !== a.totalApelHadir) return b.totalApelHadir - a.totalApelHadir;
      } else if (leaderboardSort === 'KEGIATAN') {
        if (b.kegiatanPercentage !== a.kegiatanPercentage) return b.kegiatanPercentage - a.kegiatanPercentage;
        if (b.kegiatanHadir !== a.kegiatanHadir) return b.kegiatanHadir - a.kegiatanHadir;
      } else if (leaderboardSort === 'PERLINSOS') {
        if (b.perlinsosPercentage !== a.perlinsosPercentage) return b.perlinsosPercentage - a.perlinsosPercentage;
        if (b.perlinsos !== a.perlinsos) return b.perlinsos - a.perlinsos;
      } else if (leaderboardSort === 'PBB') {
        if (b.pbbPercentage !== a.pbbPercentage) return b.pbbPercentage - a.pbbPercentage;
        if (b.pbb !== a.pbb) return b.pbb - a.pbb;
      } else if (leaderboardSort === 'BPJS') {
        if (b.bpjsPercentage !== a.bpjsPercentage) return b.bpjsPercentage - a.bpjsPercentage;
        if (b.bpjs !== a.bpjs) return b.bpjs - a.bpjs;
      } else if (leaderboardSort === 'KUNJUNGAN') {
        if (b.totalKunjungan !== a.totalKunjungan) return b.totalKunjungan - a.totalKunjungan;
        if (b.kunjunganPercentage !== a.kunjunganPercentage) return b.kunjunganPercentage - a.kunjunganPercentage;
      } else if (leaderboardSort === 'POSKAMLING') {
        if (b.poskamlingCount !== a.poskamlingCount) return b.poskamlingCount - a.poskamlingCount;
        if (b.poskamlingPercentage !== a.poskamlingPercentage) return b.poskamlingPercentage - a.poskamlingPercentage;
      } else {
        // 'KOMPOSIT' (Default: 7 Kriteria Terpadu)
        if (b.compositeScoreDecimal !== a.compositeScoreDecimal) {
          return b.compositeScoreDecimal - a.compositeScoreDecimal;
        }
      }

      // Tie-breakers
      if (b.compositeScoreDecimal !== a.compositeScoreDecimal) return b.compositeScoreDecimal - a.compositeScoreDecimal;
      if (b.perlinsosPercentage !== a.perlinsosPercentage) return b.perlinsosPercentage - a.perlinsosPercentage;
      if (b.pbb !== a.pbb) return b.pbb - a.pbb;
      if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
      return (a.kepling.nomorLingkungan || 0) - (b.kepling.nomorLingkungan || 0);
    });
  }, [keplingSummaryList, leaderboardSort]);

  // 1. Peringkat Resmi Komposit Bulanan 24 Kepling (Murni skor bulanan tanpa pengaruh toggle sortir kolom sementara)
  const monthlyCompositeRanking = useMemo(() => {
    return [...keplingSummaryList].sort((a, b) => {
      if (b.compositeScoreDecimal !== a.compositeScoreDecimal) {
        return b.compositeScoreDecimal - a.compositeScoreDecimal;
      }
      if (b.pbbPercentage !== a.pbbPercentage) return b.pbbPercentage - a.pbbPercentage;
      if (b.perlinsosPercentage !== a.perlinsosPercentage) return b.perlinsosPercentage - a.perlinsosPercentage;
      if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
      return (a.kepling.nomorLingkungan || 0) - (b.kepling.nomorLingkungan || 0);
    });
  }, [keplingSummaryList]);

  // 2. 5 Akun Kepling dengan Nilai Capaian Terendah Setiap Bulannya (5 Terbawah)
  const monthlyBottom5Accounts = useMemo(() => {
    if (monthlyCompositeRanking.length <= 5) return monthlyCompositeRanking;
    return monthlyCompositeRanking.slice(-5);
  }, [monthlyCompositeRanking]);

  const monthlyBottom5Ids = useMemo(() => {
    return new Set(monthlyBottom5Accounts.map((item) => item.kepling.id));
  }, [monthlyBottom5Accounts]);

  const monthlyBottom5NomorLingkungan = useMemo(() => {
    return new Set(monthlyBottom5Accounts.map((item) => item.kepling.nomorLingkungan));
  }, [monthlyBottom5Accounts]);

  // Simpan status 5 terbawah bulanan ke localStorage untuk disinkronkan ke seluruh profil akun pengguna
  useEffect(() => {
    try {
      const b5Array = Array.from(monthlyBottom5Ids);
      localStorage.setItem('sikepling_bottom5_monthly_kepling_ids', JSON.stringify(b5Array));
      window.dispatchEvent(new CustomEvent('sikepling_bottom5_updated', { detail: b5Array }));
    } catch {}
  }, [monthlyBottom5Ids]);

  // Indeks Kinerja & Peringkat Kepling yang sedang login (untuk Lencana Akun Kepling)
  const myPerformanceData = useMemo(() => {
    if (mode !== 'kepling') return null;
    const idx = monthlyCompositeRanking.findIndex(
      (item) =>
        item.kepling.id === activeAccount.id ||
        item.kepling.nomorLingkungan === activeAccount.nomorLingkungan ||
        item.kepling.nama.trim().toLowerCase() === activeAccount.nama.trim().toLowerCase()
    );
    if (idx === -1) return null;
    const item = monthlyCompositeRanking[idx];
    const rank = idx + 1;
    // Logika 5 Akun Capaian Terendah Setiap Bulannya:
    const isBottom5 =
      monthlyBottom5Ids.has(item.kepling.id) ||
      (item.kepling.nomorLingkungan ? monthlyBottom5NomorLingkungan.has(item.kepling.nomorLingkungan) : false) ||
      rank >= 20;
    const isTop3 = rank <= 3;
    const isTop10 = rank <= 10;

    return {
      rank,
      totalKepling: monthlyCompositeRanking.length || 24,
      item,
      isBottom5,
      isTop3,
      isTop10,
      score: item.compositeScoreDecimal,
    };
  }, [monthlyCompositeRanking, monthlyBottom5Ids, monthlyBottom5NomorLingkungan, activeAccount, mode]);

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
    let totalTargetBpjs = 0;
    let totalKunjunganSum = 0;
    let totalApelHadir = 0;
    let totalReports = filteredReportsByPeriod.length;

    keplingSummaryList.forEach((item) => {
      totalPbb += item.pbb;
      totalPerlinsos += item.perlinsos;
      totalTargetPerlinsos += item.targetPerlinsos;
      totalIkd += item.ikd;
      totalBpjs += item.bpjs;
      totalTargetBpjs += item.targetBpjs;
      totalKunjunganSum += item.totalKunjungan;
      totalApelHadir += item.totalApelHadir;
    });

    const totalKunjungan = Math.max(totalKunjunganSum, filteredKunjunganByPeriod.length);

    const activeKeplingCount = keplingSummaryList.filter((k) => k.reportCount > 0).length;
    const kepatuhanRate = Math.round((activeKeplingCount / 24) * 100);
    const perlinsosPercentage =
      totalTargetPerlinsos > 0
        ? Math.round((totalPerlinsos / totalTargetPerlinsos) * 100)
        : 0;
    const bpjsPercentage =
      totalTargetBpjs > 0 ? Math.round((totalBpjs / totalTargetBpjs) * 100) : 0;
    const kunjunganPercentage =
      totalTargetPerlinsos > 0
        ? Math.round((totalKunjungan / totalTargetPerlinsos) * 100)
        : 0;

    const totalApelSessions = distinctApelDatesInPeriod.size > 0 ? distinctApelDatesInPeriod.size : 1;
    const totalExpectedApel = totalApelSessions * 24;
    const apelRatePercentage =
      totalExpectedApel > 0 ? Math.min(100, Math.round((totalApelHadir / totalExpectedApel) * 100)) : 100;

    return {
      totalPbb,
      totalPerlinsos,
      totalTargetPerlinsos,
      perlinsosPercentage,
      totalIkd,
      totalBpjs,
      totalTargetBpjs,
      bpjsPercentage,
      totalKunjungan,
      kunjunganPercentage,
      totalApelHadir,
      totalApelSessions,
      apelRatePercentage,
      totalReports,
      activeKeplingCount,
      kepatuhanRate,
    };
  }, [filteredReportsByPeriod, keplingSummaryList, distinctApelDatesInPeriod]);

  const handlePrint = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    printOfficialDocument('lembar-cetak-rekap-capaian', `REKAP_CAPAIAN_KINERJA_KEPLING_${todayStr}`);
  };

  return (
    <div id="lembar-cetak-rekap-capaian" className="space-y-6">
      {/* Top Title & Header Card - Deep Emerald Executive Theme */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-extrabold uppercase tracking-wider shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA • Dashboard Capaian Kinerja</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
              {mode === 'kepling' ? (
                <span>Capaian Kinerja {activeAccount.lingkungan}</span>
              ) : (
                <span>Rekapitulasi Capaian 24 Kepala Lingkungan</span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed font-medium">
              {mode === 'kepling'
                ? `Pantau akumulasi pencapaian 4 pilar kinerja harian Anda (PBB, Perlinsos, IKD, dan BPJS Ketenagakerjaan) sebagai wujud pelayanan prima warga.`
                : `Monitoring evaluasi pencapaian 4 pilar kinerja seluruh 24 Lingkungan di Kelurahan Mangga Kecamatan Medan Tuntungan.`}
            </p>
          </div>

          {/* Period Filter Buttons - Perminggu, Perbulan, Pertahun, Hari Ini */}
          <div className="flex flex-col gap-2 bg-emerald-950/90 p-2.5 rounded-2xl border border-emerald-600/60 shrink-0 print:hidden shadow-lg max-w-full">
            {/* Primary Category Selector */}
            <div className="flex items-center gap-1 bg-emerald-900/90 p-1 rounded-xl border border-emerald-700/70 overflow-x-auto">
              <button
                type="button"
                onClick={() => setPeriod('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  period === 'THIS_WEEK' || period === 'LAST_WEEK' || period === '7_DAYS' || period.startsWith('WEEK_')
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-102'
                    : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Minggu</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriod('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  period === 'THIS_MONTH' || period.startsWith('MONTH_')
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-102'
                    : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Per Bulan</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriod('THIS_YEAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  period === 'THIS_YEAR' || period.startsWith('YEAR_') || period === 'ALL'
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-102'
                    : 'text-emerald-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Per Tahun</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriod('TODAY')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  period === 'TODAY'
                    ? 'bg-white text-emerald-950 shadow-md'
                    : 'text-emerald-200 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Hari Ini</span>
              </button>
            </div>

            {/* Secondary Sub-Period Dropdown & Quick Selection */}
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-900 text-white border border-emerald-500/80 focus:outline-amber-400 cursor-pointer shadow-inner"
              >
                <optgroup label="📅 Peringkat Per Minggu">
                  <option value="THIS_WEEK">🌟 Minggu Ini (Berjalan)</option>
                  <option value="LAST_WEEK">⏳ Minggu Lalu</option>
                  <option value="7_DAYS">⏱️ 7 Hari Terakhir</option>
                  <option value="WEEK_1">🔹 Minggu I (Tgl 1 - 7)</option>
                  <option value="WEEK_2">🔹 Minggu II (Tgl 8 - 14)</option>
                  <option value="WEEK_3">🔹 Minggu III (Tgl 15 - 21)</option>
                  <option value="WEEK_4">🔹 Minggu IV (Tgl 22 - Akhir Bulan)</option>
                </optgroup>
                <optgroup label="🗓️ Peringkat Per Bulan">
                  <option value="THIS_MONTH">🌟 Bulan Ini (Oktober 2026)</option>
                  <option value="MONTH_2026-09">🍂 Bulan September 2026</option>
                  <option value="MONTH_2026-08">☀️ Bulan Agustus 2026</option>
                  <option value="MONTH_2026-07">🌴 Bulan Juli 2026</option>
                  <option value="MONTH_2026-06">🌿 Bulan Juni 2026</option>
                  <option value="MONTH_2026-05">🌱 Bulan Mei 2026</option>
                  <option value="MONTH_2026-04">🌷 Bulan April 2026</option>
                  <option value="MONTH_2026-03">🌸 Bulan Maret 2026</option>
                  <option value="MONTH_2026-02">❄️ Bulan Februari 2026</option>
                  <option value="MONTH_2026-01">🎯 Bulan Januari 2026</option>
                </optgroup>
                <optgroup label="🏆 Peringkat Per Tahun">
                  <option value="THIS_YEAR">🌟 Tahun 2026 (Akumulasi Tahunan)</option>
                  <option value="YEAR_2025">📜 Tahun 2025</option>
                  <option value="ALL">🏆 Kumulatif (Sepanjang Waktu)</option>
                </optgroup>
                <optgroup label="⚡ Harian">
                  <option value="TODAY">⚡ Hari Ini</option>
                </optgroup>
              </select>

              {mode === 'super_admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKepling(null);
                    setIsModalEditOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-amber-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-amber-200"
                  title="Atur Target PERLINSOS dan Edit Capaian 24 Kepling"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-950" />
                  <span>Target</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer hidden sm:block shrink-0"
                title="Cetak Rekapitulasi Capaian"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                    {activeAccount.lingkungan}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Kelurahan Mangga
                  </span>
                  {myPerformanceData && (
                    myPerformanceData.isBottom5 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-600 text-white font-black animate-pulse flex items-center gap-1 shadow-xs">
                        🚨 KINERJA KEPLING TERBURUK
                      </span>
                    ) : myPerformanceData.rank === 1 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center gap-1 shadow-xs">
                        🥇 KEPLING TERBAIK I
                      </span>
                    ) : myPerformanceData.rank === 2 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-300 text-slate-900 font-black flex items-center gap-1 shadow-xs">
                        🥈 KEPLING TERBAIK II
                      </span>
                    ) : myPerformanceData.rank === 3 ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-black flex items-center gap-1 shadow-xs">
                        🥉 KEPLING TERBAIK III
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300">
                        Peringkat #{myPerformanceData.rank} dari 24
                      </span>
                    )
                  )}
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

          {/* ========================================================================= */}
          {/* LENCANA INDEKS KINERJA KEPLING RESMI (DENGAN PERINGKAT & EVALUASI KHUSUS) */}
          {/* ========================================================================= */}
          {myPerformanceData && (
            <div
              className={`rounded-3xl p-5 sm:p-6 border-2 shadow-xl relative overflow-hidden transition-all ${
                myPerformanceData.isBottom5
                  ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white border-red-400 shadow-red-600/25 ring-2 ring-red-400'
                  : myPerformanceData.rank === 1
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 border-amber-300 shadow-amber-500/20 ring-2 ring-amber-300'
                  : myPerformanceData.rank === 2
                  ? 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 text-slate-900 border-slate-400 shadow-md ring-2 ring-slate-300'
                  : myPerformanceData.rank === 3
                  ? 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-white border-amber-400 shadow-md ring-2 ring-amber-400'
                  : myPerformanceData.rank <= 10
                  ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white border-emerald-400 shadow-emerald-700/20'
                  : 'bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-900 text-white border-slate-700 shadow-md'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl shadow-lg shrink-0 border-2 ${
                      myPerformanceData.isBottom5
                        ? 'bg-white text-red-700 border-red-300 animate-bounce'
                        : myPerformanceData.rank === 1
                        ? 'bg-slate-950 text-amber-400 border-amber-300'
                        : myPerformanceData.rank === 2
                        ? 'bg-slate-800 text-slate-100 border-slate-400'
                        : myPerformanceData.rank === 3
                        ? 'bg-white text-amber-800 border-amber-300'
                        : 'bg-white/10 text-white border-white/20'
                    }`}
                  >
                    {myPerformanceData.isBottom5
                      ? '⚠️'
                      : myPerformanceData.rank === 1
                      ? '🥇'
                      : myPerformanceData.rank === 2
                      ? '🥈'
                      : myPerformanceData.rank === 3
                      ? '🥉'
                      : myPerformanceData.rank <= 10
                      ? '⭐'
                      : '📊'}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm inline-flex items-center gap-1.5 ${
                          myPerformanceData.isBottom5
                            ? 'bg-white text-red-700 border-2 border-red-300'
                            : myPerformanceData.rank === 1
                            ? 'bg-slate-950 text-amber-300 border border-amber-400'
                            : myPerformanceData.rank === 2
                            ? 'bg-slate-900 text-slate-100 border border-slate-400'
                            : myPerformanceData.rank === 3
                            ? 'bg-white text-amber-900 border border-amber-300'
                            : myPerformanceData.rank <= 10
                            ? 'bg-emerald-400 text-emerald-950 font-black'
                            : 'bg-blue-400 text-slate-950 font-black'
                        }`}
                      >
                        {myPerformanceData.isBottom5 && '🚨 LENCANA: KINERJA KEPLING TERBURUK'}
                        {myPerformanceData.rank === 1 && '🥇 LENCANA: KEPLING TERBAIK I'}
                        {myPerformanceData.rank === 2 && '🥈 LENCANA: KEPLING TERBAIK II'}
                        {myPerformanceData.rank === 3 && '🥉 LENCANA: KEPLING TERBAIK III'}
                        {myPerformanceData.rank > 3 && myPerformanceData.rank <= 10 && '⭐ LENCANA: KINERJA SANGAT BAIK'}
                        {myPerformanceData.rank > 10 && !myPerformanceData.isBottom5 && '🔷 LENCANA: KINERJA CUKUP'}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          myPerformanceData.isBottom5
                            ? 'bg-red-950/70 text-red-200 border border-red-300/40'
                            : 'bg-black/20 text-white/90 border border-white/20'
                        }`}
                      >
                        Peringkat {myPerformanceData.rank} dari {myPerformanceData.totalKepling} Kepling
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-300 text-amber-950 border border-amber-400 flex items-center gap-1 shadow-2xs">
                        <Calendar className="w-3 h-3 text-amber-950" />
                        Periode: {getPeriodLabel(period)}
                      </span>
                    </div>

                    <h4 className="text-lg sm:text-xl font-black tracking-tight">
                      {myPerformanceData.isBottom5 ? (
                        <span className="text-white">
                          Status Evaluasi Khusus: Peringkat {myPerformanceData.rank} (5 Terbawah)
                        </span>
                      ) : (
                        <span>
                          Indeks Kinerja Kepling Terpadu: Peringkat {myPerformanceData.rank}
                        </span>
                      )}
                    </h4>

                    <p
                      className={`text-xs max-w-2xl leading-relaxed ${
                        myPerformanceData.isBottom5
                          ? 'text-red-100 font-medium'
                          : myPerformanceData.rank === 1
                          ? 'text-slate-900 font-medium'
                          : 'text-white/80'
                      }`}
                    >
                      {myPerformanceData.isBottom5
                        ? 'Akumulasi skor kinerja bulanan Anda berada di 5 peringkat terbawah dari 24 Kepala Lingkungan. Sangat disarankan untuk segera meningkatkan kehadiran apel pagi, percepatan realisasi PBB, pemutakhiran data perlinsos, serta patroli ronda poskamling warga.'
                        : myPerformanceData.rank === 1
                        ? 'Selamat! Anda memimpin peringkat kinerja tertinggi se-Kelurahan Mangga pada periode ini. Pertahankan keteladanan dalam kedisiplinan dan pelayanan masyarakat.'
                        : myPerformanceData.rank <= 3
                        ? 'Luar biasa! Anda berada di podium 3 besar Kepala Lingkungan terbaik se-Kelurahan Mangga pada periode ini.'
                        : myPerformanceData.rank <= 10
                        ? 'Kinerja Anda sangat baik dan berada di zona 10 besar keaktifan lingkungan se-Kelurahan Mangga.'
                        : 'Kinerja Anda dalam kategori cukup. Tingkatkan keaktifan apel dan penyelesaian target untuk mencapai zona 10 besar.'}
                    </p>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-center min-w-[140px] shrink-0 border shadow-md ${
                    myPerformanceData.isBottom5
                      ? 'bg-red-950/80 border-red-400/60 text-white'
                      : myPerformanceData.rank === 1
                      ? 'bg-slate-950 text-white border-amber-400'
                      : myPerformanceData.rank === 2
                      ? 'bg-slate-900 text-white border-slate-400'
                      : myPerformanceData.rank === 3
                      ? 'bg-amber-950 text-white border-amber-400'
                      : 'bg-black/30 border-white/20 text-white'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                    Skor Indeks Kinerja
                  </span>
                  <div className="text-3xl font-black tracking-tight mt-0.5">
                    {myPerformanceData.score}
                    <span className="text-xs font-bold ml-1 opacity-70">/100 Poin</span>
                  </div>
                  <span
                    className={`inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      myPerformanceData.isBottom5
                        ? 'bg-red-600 text-white'
                        : myPerformanceData.rank <= 3
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : myPerformanceData.rank <= 10
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {myPerformanceData.isBottom5 ? '⚠️ 5 Terbawah' : `Top #${myPerformanceData.rank}`}
                  </span>
                </div>
              </div>

              {/* 7 Indikator Breakdown Mini Bar untuk Kepling */}
              {myPerformanceData.item && (
                <div
                  className={`mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[10px] ${
                    myPerformanceData.isBottom5
                      ? 'border-red-400/40'
                      : myPerformanceData.rank === 1
                      ? 'border-amber-600/40'
                      : 'border-white/10'
                  }`}
                >
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">🌅 Apel</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.apelPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">👥 Kegiatan</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.kegiatanPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">📋 Perlinsos</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.perlinsosPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">💰 PBB</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.pbbPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">🛡️ BPJS TK</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.bpjsPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">🏠 Kunjungan</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.kunjunganPercentage}%</strong>
                  </div>
                  <div className="bg-black/20 p-2 rounded-xl text-center">
                    <span className="block opacity-80 font-bold">🔦 Ronda</span>
                    <strong className="text-xs block mt-0.5">{myPerformanceData.item.poskamlingPercentage}%</strong>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    <span>Target: {(activeTargetConfig?.targetBpjs && activeTargetConfig.targetBpjs >= 50) ? activeTargetConfig.targetBpjs : 50} Org</span>
                    <span className="text-amber-700 font-bold">Perlindungan Kerja</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* REALISASI PBB-P2 (DATABASE SPPT RESMI)                                   */}
          {/* ========================================================================= */}
          {isPbbAllowed && myPbbStats && (
            <div className="bg-white rounded-3xl p-6 text-slate-900 border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black shadow-2xs shrink-0">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase tracking-wider">
                        Realisasi PBB-P2 Resmi
                      </span>
                      <span className="text-xs text-emerald-800 font-bold">Database SPPT {pbbYear}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">
                      Status Capaian Ketetapan PBB {activeAccount.lingkungan}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">Tahun:</span>
                    <select
                      value={pbbYear}
                      onChange={(e) => {
                        const yr = parseInt(e.target.value, 10);
                        setPbbYear(yr);
                        try {
                          localStorage.setItem('sikepling_pbb_selected_year', String(yr));
                        } catch {}
                      }}
                      className="bg-transparent text-emerald-800 text-xs font-black focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_PBB_YEARS.map((yr) => (
                        <option key={yr} value={yr} className="bg-white text-slate-900 font-bold">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPbb ? 'animate-spin text-white' : 'text-white'}`} />
                    <span className="hidden sm:inline">{isSyncingPbb ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Target Ketetapan</span>
                  <span className="text-lg font-black text-slate-900 block mt-0.5">{formatRupiah(myPbbStats.targetNominal)}</span>
                </div>
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Realisasi Lunas</span>
                  <span className="text-lg font-black text-emerald-950 block mt-0.5">{formatRupiah(myPbbStats.realisasiNominal)}</span>
                  <div className="mt-2 w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full" 
                      style={{ width: `${Math.min(myPbbStats.persentaseRealisasi, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">WP Lunas</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-black text-slate-900">{myPbbStats.wpLunas}</span>
                    <span className="text-xs text-slate-500">/ {myPbbStats.totalWp} SPPT</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 mt-2 font-bold">
                    <span>Kepatuhan:</span>
                    <span>{myPbbStats.persentaseWpLunas.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-500 italic">
                  * Data disinkronisasi langsung dari database SPPT resmi Kelurahan Mangga secara real-time.
                </p>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
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

          {/* Grafik Garis Tren Mingguan Selama Satu Bulan Terakhir (Recharts) */}
          <GrafikTrenMingguan
            reports={reports}
            activeAccount={activeAccount}
            mode="kepling"
            attendanceList={attendanceList}
            kunjunganList={kunjunganList}
            title={`Tren Capaian & Konsistensi Kinerja Mingguan (${activeAccount.lingkungan})`}
          />

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
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
            {isPbbAllowed && (
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
            )}

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
            <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-teal-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black text-teal-900 uppercase block">
                  Total BPJS TK
                </span>
                <span className="text-[10px] bg-teal-100 text-teal-900 font-black px-1.5 py-0.5 rounded">
                  {kelurahanTotals.bpjsPercentage}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-teal-950 mt-1">
                {kelurahanTotals.totalBpjs}
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  / {kelurahanTotals.totalTargetBpjs} Orang
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, kelurahanTotals.bpjsPercentage)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Target 24 Lingk: {kelurahanTotals.totalTargetBpjs} Orang
              </p>
            </div>

            {/* Total Kunjungan Warga (Door-to-Door) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-amber-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black text-amber-900 uppercase block">
                  Total Kunjungan
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded">
                  {kelurahanTotals.kunjunganPercentage}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-1">
                {kelurahanTotals.totalKunjungan}
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  / {kelurahanTotals.totalTargetPerlinsos} KK
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, kelurahanTotals.kunjunganPercentage)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Door-to-Door Warga
              </p>
            </div>

            {/* Absensi Apel Pagi */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black text-emerald-900 uppercase block">
                  Absensi Apel Pagi
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded">
                  {kelurahanTotals.apelRatePercentage}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">
                {kelurahanTotals.totalApelHadir}
                <span className="text-xs font-semibold text-slate-500 ml-1">Hadir</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Dari {kelurahanTotals.totalApelSessions} Sesi Apel
              </p>
            </div>
          </div>

          {/* Grafik Garis Tren Mingguan Seluruh Lingkungan / Per Kepling (Recharts) */}
          <GrafikTrenMingguan
            reports={reports}
            activeAccount={activeAccount}
            mode="super_admin"
            attendanceList={attendanceList}
            kunjunganList={kunjunganList}
            title="Tren & Konsistensi Capaian Mingguan Se-Kelurahan Mangga"
          />

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

          {/* Leaderboard & Ranking Section - 7 Kriteria Terpadu */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base sm:text-xl tracking-tight">
                      Rangking & Leaderboard 24 Kepling
                    </h3>
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        leaderboardSort === 'KOMPOSIT'
                          ? 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                          : leaderboardSort === 'APEL'
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : leaderboardSort === 'KEGIATAN'
                          ? 'bg-indigo-100 text-indigo-950 border-indigo-300'
                          : leaderboardSort === 'PERLINSOS'
                          ? 'bg-blue-100 text-blue-950 border-blue-300'
                          : leaderboardSort === 'PBB'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : leaderboardSort === 'BPJS'
                          ? 'bg-teal-100 text-teal-900 border-teal-300'
                          : leaderboardSort === 'KUNJUNGAN'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-purple-100 text-purple-900 border-purple-300'
                      }`}
                    >
                      {leaderboardSort === 'KOMPOSIT' && '⭐ 7 Kriteria Terpadu (Skor Komposit)'}
                      {leaderboardSort === 'APEL' && '🌅 Kehadiran Apel Pagi (15%)'}
                      {leaderboardSort === 'KEGIATAN' && '👥 Kehadiran Kegiatan (15%)'}
                      {leaderboardSort === 'PERLINSOS' && '📋 Capaian Perlinsos (20%)'}
                      {leaderboardSort === 'PBB' && '💰 Realisasi PBB (20%)'}
                      {leaderboardSort === 'BPJS' && '🛡️ BPJS Ketenagakerjaan (10%)'}
                      {leaderboardSort === 'KUNJUNGAN' && '🏠 Kunjungan Harian (10%)'}
                      {leaderboardSort === 'POSKAMLING' && '🔦 Poskamling / Siskamling (10%)'}
                    </span>

                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>{getPeriodLabel(period, now)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                    Peringkat resmi terpadu untuk periode <strong>{getPeriodLabel(period, now)}</strong> dihitung dari <strong>7 Kriteria Kinerja</strong>: Kehadiran Apel Pagi (15%), Kehadiran Kegiatan Khusus (15%), Capaian Perlinsos (20%), Realisasi PBB (20%), BPJS TK (10%), Kunjungan Harian (10%), dan Poskamling (10%).
                  </p>
                </div>
              </div>

              {/* Action and Search Box */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKepling(null);
                    setIsModalEditOpen(true);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
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

            {/* Filter & Kriteria Selection Toolbar */}
            <div className="mt-4 pt-3 border-t border-slate-100 print:hidden">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Pilih Urutan Peringkat Berdasarkan Kriteria:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setLeaderboardSort('KOMPOSIT')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'KOMPOSIT'
                      ? 'bg-amber-400 text-slate-950 shadow-sm ring-2 ring-amber-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>7 Kriteria Terpadu (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('APEL')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'APEL'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Apel Pagi (15%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('KEGIATAN')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'KEGIATAN'
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Kegiatan (15%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('PERLINSOS')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'PERLINSOS'
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Perlinsos (20%)</span>
                </button>

                {isPbbAllowed && (
                  <button
                    type="button"
                    onClick={() => setLeaderboardSort('PBB')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      leaderboardSort === 'PBB'
                        ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400 scale-102'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Realisasi PBB (20%)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('BPJS')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'BPJS'
                      ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>BPJS TK (10%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('KUNJUNGAN')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'KUNJUNGAN'
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Kunjungan (10%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSort('POSKAMLING')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    leaderboardSort === 'POSKAMLING'
                      ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300 scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Poskamling (10%)</span>
                </button>
              </div>
            </div>

            {/* Top 3 Podium Highlights with 7 Kriteria Breakdowns */}
            {sortedLeaderboard.length >= 3 && !searchQuery && (
              <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Juara 2 */}
                <div className="p-4 bg-gradient-to-b from-slate-50 to-slate-100/70 rounded-2xl border border-slate-200 text-center relative overflow-hidden order-2 md:order-1 flex flex-col justify-between shadow-2xs">
                  <div>
                    <span className="inline-block px-3 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-black uppercase mb-2 shadow-2xs">
                      🥈 Peringkat 2
                    </span>
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                      {sortedLeaderboard[1].compositeScoreDecimal}
                      <span className="text-xs font-bold text-slate-500 ml-1">/100 Poin</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-0.5 mb-2">
                      Indeks Kinerja Kepling Terpadu
                    </div>

                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-800 font-black text-sm mx-auto flex items-center justify-center mb-1 shadow-2xs">
                      {sortedLeaderboard[1].kepling.nomorLingkungan}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {sortedLeaderboard[1].kepling.nama}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {sortedLeaderboard[1].kepling.lingkungan}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-[10px] text-left">
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">🌅 Apel</span>
                      <strong className="text-emerald-700">{sortedLeaderboard[1].apelPercentage}%</strong> ({sortedLeaderboard[1].totalApelHadir} Hari)
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">👥 Kegiatan</span>
                      <strong className="text-indigo-700">{sortedLeaderboard[1].kegiatanPercentage}%</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">📋 Perlinsos</span>
                      <strong className="text-blue-700">{sortedLeaderboard[1].perlinsosPercentage}%</strong> ({sortedLeaderboard[1].perlinsos} KK)
                    </div>
                    {isPbbAllowed && (
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">💰 PBB</span>
                        <strong className="text-emerald-800">{sortedLeaderboard[1].pbbPercentage}%</strong> ({sortedLeaderboard[1].pbb}/{sortedLeaderboard[1].targetPbb} WP)
                      </div>
                    )}
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">🛡️ BPJS TK</span>
                      <strong className="text-teal-800">{sortedLeaderboard[1].bpjsPercentage}%</strong> ({sortedLeaderboard[1].bpjs} Org)
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">🏠 Kunjungan</span>
                      <strong className="text-amber-800">{sortedLeaderboard[1].totalKunjungan} KK</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100 col-span-2">
                      <span className="text-slate-400 block font-medium">🔦 Poskamling</span>
                      <strong className="text-purple-800">{sortedLeaderboard[1].poskamlingCount} Giat</strong>
                    </div>
                  </div>
                </div>

                {/* Juara 1 (Podium Tertinggi) */}
                <div className="p-5 bg-gradient-to-b from-amber-50 to-amber-100/70 rounded-2xl border-2 border-amber-400 text-center relative overflow-hidden shadow-md order-1 md:order-2 flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase mb-2 shadow-xs">
                      🥇 Peringkat 1 Terbaik
                    </span>
                    <div className="text-4xl font-black text-amber-950 tracking-tight">
                      {sortedLeaderboard[0].compositeScoreDecimal}
                      <span className="text-sm font-bold text-amber-800 ml-1">/100 Poin</span>
                    </div>
                    <div className="text-xs font-bold text-amber-900 mt-0.5 mb-2">
                      Indeks Kinerja Kepling Terpadu
                    </div>

                    <div className="w-12 h-12 rounded-full bg-amber-400 text-slate-950 font-black text-base mx-auto flex items-center justify-center mb-1.5 shadow-sm ring-2 ring-amber-300">
                      {sortedLeaderboard[0].kepling.nomorLingkungan}
                    </div>
                    <h4 className="font-black text-slate-900 text-base truncate">
                      {sortedLeaderboard[0].kepling.nama}
                    </h4>
                    <p className="text-xs text-amber-950 font-bold">
                      {sortedLeaderboard[0].kepling.lingkungan}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-amber-200 grid grid-cols-2 gap-1.5 text-[10px] text-left">
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 block font-medium">🌅 Apel</span>
                      <strong className="text-emerald-700 font-bold">{sortedLeaderboard[0].apelPercentage}%</strong> ({sortedLeaderboard[0].totalApelHadir} Hari)
                    </div>
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 block font-medium">👥 Kegiatan</span>
                      <strong className="text-indigo-700 font-bold">{sortedLeaderboard[0].kegiatanPercentage}%</strong>
                    </div>
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 block font-medium">📋 Perlinsos</span>
                      <strong className="text-blue-700 font-bold">{sortedLeaderboard[0].perlinsosPercentage}%</strong> ({sortedLeaderboard[0].perlinsos} KK)
                    </div>
                    {isPbbAllowed && (
                      <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                        <span className="text-amber-800 block font-medium">💰 PBB</span>
                        <strong className="text-emerald-800 font-bold">{sortedLeaderboard[0].pbbPercentage}%</strong> ({sortedLeaderboard[0].pbb}/{sortedLeaderboard[0].targetPbb} WP)
                      </div>
                    )}
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 block font-medium">🛡️ BPJS TK</span>
                      <strong className="text-teal-800 font-bold">{sortedLeaderboard[0].bpjsPercentage}%</strong> ({sortedLeaderboard[0].bpjs} Org)
                    </div>
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 block font-medium">🏠 Kunjungan</span>
                      <strong className="text-amber-900 font-bold">{sortedLeaderboard[0].totalKunjungan} KK</strong>
                    </div>
                    <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200 col-span-2">
                      <span className="text-amber-800 block font-medium">🔦 Poskamling</span>
                      <strong className="text-purple-800 font-bold">{sortedLeaderboard[0].poskamlingCount} Giat</strong>
                    </div>
                  </div>
                </div>

                {/* Juara 3 */}
                <div className="p-4 bg-gradient-to-b from-amber-50/40 to-orange-50/50 rounded-2xl border border-amber-200 text-center relative overflow-hidden order-3 flex flex-col justify-between shadow-2xs">
                  <div>
                    <span className="inline-block px-3 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black uppercase mb-2 shadow-2xs">
                      🥉 Peringkat 3
                    </span>
                    <div className="text-3xl font-black text-amber-950 tracking-tight">
                      {sortedLeaderboard[2].compositeScoreDecimal}
                      <span className="text-xs font-bold text-amber-800 ml-1">/100 Poin</span>
                    </div>
                    <div className="text-[11px] font-semibold text-amber-900 mt-0.5 mb-2">
                      Indeks Kinerja Kepling Terpadu
                    </div>

                    <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-950 font-black text-sm mx-auto flex items-center justify-center mb-1 shadow-2xs">
                      {sortedLeaderboard[2].kepling.nomorLingkungan}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {sortedLeaderboard[2].kepling.nama}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {sortedLeaderboard[2].kepling.lingkungan}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-amber-200 grid grid-cols-2 gap-1.5 text-[10px] text-left">
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-slate-400 block font-medium">🌅 Apel</span>
                      <strong className="text-emerald-700">{sortedLeaderboard[2].apelPercentage}%</strong> ({sortedLeaderboard[2].totalApelHadir} Hari)
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-slate-400 block font-medium">👥 Kegiatan</span>
                      <strong className="text-indigo-700">{sortedLeaderboard[2].kegiatanPercentage}%</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-slate-400 block font-medium">📋 Perlinsos</span>
                      <strong className="text-blue-700">{sortedLeaderboard[2].perlinsosPercentage}%</strong> ({sortedLeaderboard[2].perlinsos} KK)
                    </div>
                    {isPbbAllowed && (
                      <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                        <span className="text-slate-400 block font-medium">💰 PBB</span>
                        <strong className="text-emerald-800">{sortedLeaderboard[2].pbbPercentage}%</strong> ({sortedLeaderboard[2].pbb}/{sortedLeaderboard[2].targetPbb} WP)
                      </div>
                    )}
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-slate-400 block font-medium">🛡️ BPJS TK</span>
                      <strong className="text-teal-800">{sortedLeaderboard[2].bpjsPercentage}%</strong> ({sortedLeaderboard[2].bpjs} Org)
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-slate-400 block font-medium">🏠 Kunjungan</span>
                      <strong className="text-amber-800">{sortedLeaderboard[2].totalKunjungan} KK</strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-amber-100 col-span-2">
                      <span className="text-slate-400 block font-medium">🔦 Poskamling</span>
                      <strong className="text-purple-800">{sortedLeaderboard[2].poskamlingCount} Giat</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List / Table of All 24 Kepling Performance (7 Kriteria Terpadu) */}
            <div className="divide-y divide-slate-100 mt-4 overflow-x-auto">
              <div className="hidden xl:grid grid-cols-12 gap-2 py-2 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider items-center bg-slate-50/70 rounded-xl mb-1">
                <div className="col-span-1 text-center">Rank</div>
                <div className={`text-left ${isPbbAllowed ? 'col-span-2' : 'col-span-3'}`}>Kepala Lingkungan</div>
                <div className="col-span-1 text-center bg-amber-100/70 text-amber-950 py-1 rounded-md font-black">
                  Skor IKKT
                </div>
                <div className="col-span-1 text-center">🌅 Apel (15%)</div>
                <div className="col-span-1 text-center">👥 Giat (15%)</div>
                <div className="col-span-1 text-center">📋 Perlinsos (20%)</div>
                {isPbbAllowed && (
                  <div className="col-span-1 text-center">💰 PBB (20%)</div>
                )}
                <div className="col-span-1 text-center">🛡️ BPJS (10%)</div>
                <div className="col-span-1 text-center">🏠 Kunjungan (10%)</div>
                <div className="col-span-1 text-center">🔦 Poskamling (10%)</div>
                <div className="col-span-1 text-right">Aksi</div>
              </div>

              {displayedKeplingCards.map((item, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                const scoreColorClass =
                  item.compositeScoreDecimal >= 85
                    ? 'bg-emerald-600 text-white'
                    : item.compositeScoreDecimal >= 70
                    ? 'bg-blue-600 text-white'
                    : item.compositeScoreDecimal >= 50
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white';

                return (
                  <div
                    key={item.kepling.id}
                    className="py-3 px-3 hover:bg-slate-50/80 rounded-xl transition-colors flex flex-col xl:grid xl:grid-cols-12 gap-2 xl:gap-2 items-start xl:items-center text-xs"
                  >
                    {/* Rank Badge & Kepling Info (Mobile + Desktop) */}
                    <div className="col-span-1 flex items-center gap-2 xl:justify-center w-full xl:w-auto justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const rankNum = index + 1;
                          const isBottom5Rank = rankNum >= 20;
                          return (
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                isTop1
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                                  : isTop2
                                  ? 'bg-slate-300 text-slate-900'
                                  : isTop3
                                  ? 'bg-amber-200 text-amber-950'
                                  : isBottom5Rank
                                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                              title={isBottom5Rank ? 'Peringkat 5 Terbawah - Kinerja Kepling Terburuk' : `Peringkat #${rankNum}`}
                            >
                              {rankNum}
                            </span>
                          );
                        })()}
                        <div className="xl:hidden">
                          <span className="font-bold text-slate-900 block">
                            {item.kepling.lingkungan} • {item.kepling.nama}
                          </span>
                          {(index + 1) >= 20 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-800 border border-red-300 mt-0.5">
                              🚨 KINERJA KEPLING TERBURUK
                            </span>
                          ) : isTop1 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 mt-0.5">
                              🥇 KEPLING TERBAIK I
                            </span>
                          ) : null}
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {item.reportCount} Laporan ({item.hariMelapor} Hari)
                          </span>
                        </div>
                      </div>

                      {/* Mobile Badge Skor */}
                      <div className="xl:hidden flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full font-black text-xs ${scoreColorClass}`}>
                          {item.compositeScoreDecimal}
                        </span>
                      </div>
                    </div>

                    {/* Info Kepling (Desktop) */}
                    <div className={`${isPbbAllowed ? 'col-span-2' : 'col-span-3'} hidden xl:block`}>
                      <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
                        <span>{item.kepling.nama}</span>
                        {item.isOverridden && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Capaian disesuaikan Super Admin" />
                        )}
                        {(index + 1) >= 20 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-800 border border-red-300 shadow-2xs">
                            🚨 TERBURUK
                          </span>
                        )}
                        {isTop1 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                            🥇 TERBAIK I
                          </span>
                        )}
                        {isTop2 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-800 border border-slate-300 shadow-2xs">
                            🥈 TERBAIK II
                          </span>
                        )}
                        {isTop3 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                            🥉 TERBAIK III
                          </span>
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

                    {/* Skor Komposit Terpadu (IKKT) */}
                    <div className="col-span-1 hidden xl:flex items-center justify-center">
                      <span className={`px-2.5 py-1 rounded-full font-black text-xs shadow-2xs ${scoreColorClass}`}>
                        {item.compositeScoreDecimal}
                      </span>
                    </div>

                    {/* 1. Apel Pagi */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">🌅 Apel Pagi (15%)</div>
                      <span
                        className={`inline-block font-black px-1.5 py-0.5 rounded text-[11px] ${
                          item.apelPercentage >= 90
                            ? 'text-emerald-700 bg-emerald-50'
                            : item.apelPercentage >= 70
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}
                      >
                        {item.apelPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">{item.totalApelHadir} Hari</span>
                    </div>

                    {/* 2. Kegiatan Khusus */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">👥 Kegiatan (15%)</div>
                      <span
                        className={`inline-block font-black px-1.5 py-0.5 rounded text-[11px] ${
                          item.kegiatanPercentage >= 90
                            ? 'text-indigo-700 bg-indigo-50'
                            : item.kegiatanPercentage >= 70
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}
                      >
                        {item.kegiatanPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">{item.kegiatanHadir} Hadir</span>
                    </div>

                    {/* 3. Perlinsos */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">📋 Perlinsos (20%)</div>
                      <span
                        className={`inline-block font-black px-1.5 py-0.5 rounded text-[11px] ${
                          item.perlinsosPercentage >= 100
                            ? 'text-emerald-700 bg-emerald-50'
                            : item.perlinsosPercentage >= 50
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}
                      >
                        {item.perlinsosPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate" title={`${item.perlinsos} dari ${item.targetPerlinsos} KK`}>
                        {item.perlinsos}/{item.targetPerlinsos} KK
                      </span>
                    </div>

                    {/* 4. Realisasi PBB */}
                    {isPbbAllowed && (
                      <div
                        onClick={() => onOpenRekapPbb && onOpenRekapPbb()}
                        className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
                        title="Klik untuk membuka Rekapitulasi SPPT PBB"
                      >
                        <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">💰 PBB (20%)</div>
                        <span className="inline-block font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                          {item.pbbPercentage}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block truncate" title={`${item.pbb} dari target ${item.targetPbb} WP`}>
                          {item.pbb}/{item.targetPbb} WP
                        </span>
                      </div>
                    )}

                    {/* 5. BPJS Ketenagakerjaan */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">🛡️ BPJS TK (10%)</div>
                      <span className="inline-block font-black text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded text-[11px]">
                        {item.bpjsPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">{item.bpjs} Org</span>
                    </div>

                    {/* 6. Kunjungan Harian */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">🏠 Kunjungan (10%)</div>
                      <span className="inline-block font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
                        {item.kunjunganPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate" title={`${item.totalKunjungan} dari target ${item.targetPerlinsos} KK Perlinsos`}>
                        {item.totalKunjungan}/{item.targetPerlinsos} KK
                      </span>
                    </div>

                    {/* 7. Poskamling */}
                    <div className="col-span-1 w-full xl:w-auto text-center bg-slate-50 xl:bg-transparent p-1.5 xl:p-0 rounded-lg">
                      <div className="text-[10px] text-slate-400 font-bold xl:hidden mb-0.5">🔦 Poskamling (10%)</div>
                      <span className="inline-block font-black text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
                        {item.poskamlingPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">{item.poskamlingCount} Giat</span>
                    </div>

                    {/* Aksi Buttons */}
                    <div className="col-span-1 flex items-center justify-end gap-1.5 w-full xl:w-auto pt-2 xl:pt-0 border-t xl:border-0 border-slate-100">
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
                );
              })}
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
