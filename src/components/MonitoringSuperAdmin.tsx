import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Users,
  FileText,
  Building,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  KeyRound,
  RefreshCw,
  Trash2,
  AlertTriangle,
  X,
  Trophy,
  FileSpreadsheet,
  Copy,
  Check,
  Sparkles,
  Layers,
  Clock,
  Map as MapIcon,
  MapPin,
  Compass,
  Navigation,
  Download,
  Home,
  Phone,
  Filter,
  Coins,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LaporanHarianItem,
  SheetMetadata,
  UserAccount,
  TitikRumahBangunan,
  RuasJalanLingkungan,
  LingkunganPolygon,
} from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  formatTanggalIndonesia,
  getTodayLocalIso,
  isReportMatchingKepling,
  isReportMatchingDate,
  getReportIsoDate,
} from '../lib/formatter';
import {
  getLocalHouses,
  getLocalRoads,
  getLocalPolygons,
  subscribeWebgisData,
} from '../lib/webgisService';
import {
  computeKelurahanPemetaanOverview,
  LingkunganPemetaanStats,
} from '../lib/pemetaanStatsHelper';
import {
  AVAILABLE_PBB_YEARS,
  DEFAULT_PBB_YEAR,
  getLocalSpptForYear,
  computePbbOverview,
  subscribePbbSpptFromFirestore,
} from '../lib/pbbService';
import { SpptPbbItem } from '../data/pbbSampleData';

interface MonitoringSuperAdminProps {
  reports: LaporanHarianItem[];
  onSelectReport: (report: LaporanHarianItem) => void;
  onDraftForKepling: (kepling: UserAccount) => void;
  onSwitchToRiwayat: (keplingName: string) => void;
  onOpenCredentialBook?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onResetReports?: () => Promise<void>;
  onSeedInitialReports?: () => Promise<void>;
  onOpenCapaianDashboard?: () => void;
  onOpenPemetaan?: (lingkunganNomor?: number) => void;
  onOpenPbb?: () => void;
  sheetMeta?: SheetMetadata | null;
}

export const MonitoringSuperAdmin: React.FC<MonitoringSuperAdminProps> = ({
  reports,
  onSelectReport,
  onDraftForKepling,
  onSwitchToRiwayat,
  onOpenCredentialBook,
  onRefresh,
  isRefreshing,
  onResetReports,
  onSeedInitialReports,
  onOpenCapaianDashboard,
  onOpenPemetaan,
  onOpenPbb,
  sheetMeta,
}) => {
  const todayIso = getTodayLocalIso();

  // Tab mode for Monitoring Dashboard: Laporan Harian vs Realisasi PBB vs Hasil Pemetaan Spasial
  const [activeMainTab, setActiveMainTab] = useState<'LAPORAN' | 'PBB_REALISASI' | 'PEMETAAN'>('LAPORAN');

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
  const [pbbSearch, setPbbSearch] = useState<string>('');

  useEffect(() => {
    setSpptList(getLocalSpptForYear(pbbYear));
    const unsub = subscribePbbSpptFromFirestore(pbbYear, (items) => {
      if (items && items.length > 0) setSpptList(items);
    });
    return () => unsub();
  }, [pbbYear]);

  const pbbOverview = useMemo(() => {
    return computePbbOverview(spptList, pbbYear);
  }, [spptList, pbbYear]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // WebGIS Data Real-time State
  const [gisHouses, setGisHouses] = useState<TitikRumahBangunan[]>(getLocalHouses);
  const [gisRoads, setGisRoads] = useState<RuasJalanLingkungan[]>(getLocalRoads);
  const [gisPolygons, setGisPolygons] = useState<LingkunganPolygon[]>(getLocalPolygons);
  const [pemetaanSearch, setPemetaanSearch] = useState<string>('');
  const [pemetaanFilterStatus, setPemetaanFilterStatus] = useState<'ALL' | 'HAS_HOUSES' | 'NO_HOUSES'>('ALL');

  useEffect(() => {
    const unsub = subscribeWebgisData(
      (p) => setGisPolygons(p),
      (h) => setGisHouses(h),
      (r) => setGisRoads(r)
    );
    return () => unsub();
  }, []);

  // Compute Pemetaan 24 Lingkungan Overview
  const kelurahanPemetaan = useMemo(() => {
    return computeKelurahanPemetaanOverview(gisHouses, gisRoads, gisPolygons);
  }, [gisHouses, gisRoads, gisPolygons]);

  // Filtered Pemetaan Lingkungan List for Table
  const filteredPemetaanLingkunganList = useMemo(() => {
    return kelurahanPemetaan.perLingkunganList.filter((item) => {
      const matchSearch =
        pemetaanSearch === '' ||
        item.lingkunganNama.toLowerCase().includes(pemetaanSearch.toLowerCase()) ||
        item.keplingNama.toLowerCase().includes(pemetaanSearch.toLowerCase()) ||
        String(item.lingkunganNomor).includes(pemetaanSearch);

      if (!matchSearch) return false;

      if (pemetaanFilterStatus === 'HAS_HOUSES') {
        return item.totalRumah > 0;
      }
      if (pemetaanFilterStatus === 'NO_HOUSES') {
        return item.totalRumah === 0;
      }
      return true;
    });
  }, [kelurahanPemetaan.perLingkunganList, pemetaanSearch, pemetaanFilterStatus]);

  // Export Excel Pemetaan function
  const handleExportExcelPemetaan = () => {
    const data = kelurahanPemetaan.perLingkunganList.map((item, idx) => ({
      'No': idx + 1,
      'Lingkungan': item.lingkunganNama,
      'Nama Kepling': item.keplingNama,
      'No Telepon': item.keplingTelepon || '-',
      'Batas Poligon': item.hasPolygon ? 'Sudah Ada' : 'Belum Ada',
      'Titik Rumah Terpetakan': item.totalRumah,
      'Total Jiwa': item.totalJiwa,
      'Laki-laki': item.totalLakiLaki,
      'Perempuan': item.totalPerempuan,
      'Anak-anak': item.totalAnak,
      'Lansia': item.totalLansia,
      'KK KTP Mangga': item.kkMangga,
      'KK Luar': item.kkLuar,
      '% KK Mangga': `${item.persenKkMangga}%`,
      'WRS Aktif': item.wrsAktif,
      'WRS Mandiri': item.wrsMandiri,
      'WRS Belum': item.wrsBelum,
      '% WRS Aktif': `${item.persenWrsAktif}%`,
      'Potensi Retribusi WRS (Rp/Bln)': item.potensiRetribusiWrs,
      'PBB Lunas': item.pbbLunas,
      'PBB Belum Lunas': item.pbbBelumLunas,
      '% PBB Lunas': `${item.persenPbbLunas}%`,
      'Nominal PBB (Rp)': item.totalNominalPbb,
      'Penerima Bansos (KK)': item.bansosKk,
      'Ruas Jalan/Gang': item.totalRuasJalan,
      'Panjang Jalan (Meter)': item.totalPanjangJalanMeter,
      'Jalan Baik': item.jalanBaik,
      'Jalan Rusak': item.jalanRusak,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pemetaan 24 Lingkungan');
    XLSX.writeFile(wb, `Rekap_Pemetaan_WebGIS_Kelurahan_Mangga_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Extract all distinct dates available in reports, with report counts
  const availableDates = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    const map = new Map<string, { count: number; dateStr: string; hari: string }>();
    reports.forEach((r) => {
      const iso = getReportIsoDate(r);
      if (iso) {
        const existing = map.get(iso);
        if (existing) {
          existing.count++;
        } else {
          map.set(iso, {
            count: 1,
            dateStr: r.tanggal || iso,
            hari: r.hari || '',
          });
        }
      }
    });
    return Array.from(map.entries())
      .map(([iso, data]) => ({
        iso,
        count: data.count,
        dateStr: data.dateStr,
        hari: data.hari,
        label: `${data.hari ? data.hari + ', ' : ''}${data.dateStr} (${data.count} Laporan)`,
      }))
      .sort((a, b) => b.iso.localeCompare(a.iso));
  }, [reports]);

  // Latest date that actually contains reports
  const latestAvailableDate = useMemo(() => {
    return availableDates[0]?.iso || '';
  }, [availableDates]);

  // Check if today has any submitted reports
  const hasReportsToday = useMemo(() => {
    if (!reports || reports.length === 0) return false;
    return reports.some((r) => isReportMatchingDate(r, todayIso));
  }, [reports, todayIso]);

  // View Mode: 'DAILY' (per date), 'LATEST_PER_KEPLING' (status terkini tiap kepling), or 'ALL' (semua tanggal)
  const [viewMode, setViewMode] = useState<'DAILY' | 'LATEST_PER_KEPLING' | 'ALL'>('DAILY');

  // Initial date selection logic: default to today if reports exist today, otherwise auto-switch to latest date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (!reports || reports.length === 0) return todayIso;
    const hasToday = reports.some((r) => isReportMatchingDate(r, todayIso));
    if (hasToday) return todayIso;
    return latestAvailableDate || todayIso;
  });

  // Auto-switch selectedDate once reports arrive if today is currently empty but database has past reports
  const hasAutoSwitchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasAutoSwitchedRef.current && reports && reports.length > 0) {
      const hasToday = reports.some((r) => isReportMatchingDate(r, todayIso));
      if (!hasToday && latestAvailableDate && selectedDate === todayIso) {
        hasAutoSwitchedRef.current = true;
        setSelectedDate(latestAvailableDate);
      }
    }
  }, [reports, todayIso, latestAvailableDate, selectedDate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'PENDING'>('ALL');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  // Map of every Kepling to their most recent report across the ENTIRE database
  const keplingLatestReportMap = useMemo(() => {
    const map = new Map<string, LaporanHarianItem>();
    KEPLING_ACCOUNTS.forEach((k) => {
      // Find all reports matching this kepling
      const matching = reports.filter((r) => isReportMatchingKepling(r, k));
      if (matching.length > 0) {
        // Sort descending by date/createdAt
        matching.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        map.set(k.id, matching[0]);
      }
    });
    return map;
  }, [reports]);

  // Reports matching the selected date (for DAILY mode)
  const reportsOnDate = useMemo(() => {
    return reports.filter((r) => {
      if (!selectedDate) return true;
      return isReportMatchingDate(r, selectedDate);
    });
  }, [reports, selectedDate]);

  // Active Kepling Report Map based on current viewMode
  const activeKeplingReportMap = useMemo(() => {
    if (viewMode === 'LATEST_PER_KEPLING') {
      return keplingLatestReportMap;
    }

    // Otherwise DAILY or ALL
    const map = new Map<string, LaporanHarianItem>();
    KEPLING_ACCOUNTS.forEach((k) => {
      const match = reportsOnDate.find((r) => isReportMatchingKepling(r, k));
      if (match) {
        map.set(k.id, match);
      }
    });
    return map;
  }, [viewMode, keplingLatestReportMap, reportsOnDate]);

  // Aggregate metrics
  const stats = useMemo(() => {
    let totalPbb = 0;
    let totalPerlinsos = 0;
    let totalIkd = 0;
    let totalBpjs = 0;
    let submittedCount = 0;

    KEPLING_ACCOUNTS.forEach((k) => {
      const rep = activeKeplingReportMap.get(k.id);
      if (rep) {
        submittedCount++;
        totalPbb += Number(rep.kinerja?.opsirPbbWp) || 0;
        totalPerlinsos += Number(rep.kinerja?.perlinsosKk) || 0;
        totalIkd += Number(rep.kinerja?.ikdOrang) || 0;
        totalBpjs += Number(rep.kinerja?.bpjsKetenagakerjaanOrang) || 0;
      }
    });

    const pendingCount = KEPLING_ACCOUNTS.length - submittedCount;
    const completionPct = Math.round((submittedCount / KEPLING_ACCOUNTS.length) * 100);

    return {
      totalKepling: KEPLING_ACCOUNTS.length,
      submittedCount,
      pendingCount,
      completionPct,
      totalPbb,
      totalPerlinsos,
      totalIkd,
      totalBpjs,
    };
  }, [activeKeplingReportMap]);

  // Filtered kepling list
  const filteredList = useMemo(() => {
    return KEPLING_ACCOUNTS.filter((k) => {
      const isSubmitted = activeKeplingReportMap.has(k.id);

      if (statusFilter === 'SUBMITTED' && !isSubmitted) return false;
      if (statusFilter === 'PENDING' && isSubmitted) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = k.nama.toLowerCase().includes(term);
        const matchesLingkungan = k.lingkungan.toLowerCase().includes(term);
        return matchesName || matchesLingkungan;
      }

      return true;
    });
  }, [activeKeplingReportMap, statusFilter, searchTerm]);

  const handleCopyRekapWA = () => {
    let tglLabel = 'Semua Tanggal';
    if (viewMode === 'LATEST_PER_KEPLING') {
      tglLabel = 'Status Terkini (Laporan Terakhir Masing-Masing Lingkungan)';
    } else if (selectedDate) {
      tglLabel = formatTanggalIndonesia(new Date(selectedDate + 'T00:00:00'));
    }

    let text = `*REKAPITULASI PENGIRIMAN LAPORAN HARIAN KEPLING*\n`;
    text += `*KELURAHAN MANGGA - KECAMATAN MEDAN TUNTUNGAN*\n`;
    text += `📅 Periode/Tanggal: ${tglLabel}\n`;
    text += `📊 Progress: ${stats.submittedCount}/${stats.totalKepling} Lingkungan (${stats.completionPct}%)\n\n`;
    text += `*STATUS PELAPORAN 24 LINGKUNGAN:*\n`;

    KEPLING_ACCOUNTS.forEach((k) => {
      const rep = activeKeplingReportMap.get(k.id);
      if (rep) {
        const tglText = rep.tanggal ? ` [${rep.tanggal}]` : '';
        text += `✅ ${k.lingkungan} (${k.nama})${tglText} - SUDAH LAPOR\n`;
        text += `   - PBB: ${rep.kinerja?.opsirPbbWp || 0} WP | Perlinsos: ${rep.kinerja?.perlinsosKk || 0} KK | IKD: ${rep.kinerja?.ikdOrang || 0} Jiwa | BPJS: ${rep.kinerja?.bpjsKetenagakerjaanOrang || 0} Jiwa\n`;
      } else {
        const latestRep = keplingLatestReportMap.get(k.id);
        const prevNote = latestRep?.tanggal ? ` (Laporan Terakhir: ${latestRep.tanggal})` : ' (Belum Pernah Lapor)';
        text += `❌ ${k.lingkungan} (${k.nama}) - BELUM LAPOR${prevNote}\n`;
      }
    });

    text += `\n*TOTAL REALISASI ENUMERASI:*\n`;
    text += `- Opsir PBB: ${stats.totalPbb} WP\n`;
    text += `- Perlinsos Bansos: ${stats.totalPerlinsos} KK\n`;
    text += `- IKD Kependudukan: ${stats.totalIkd} Jiwa\n`;
    text += `- BPJS Ketenagakerjaan: ${stats.totalBpjs} Jiwa\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 3000);
    });
  };

  const handleTriggerSeed = async () => {
    if (!onSeedInitialReports) return;
    setIsSeeding(true);
    try {
      await onSeedInitialReports();
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                  Panel Pengawasan Super Admin
                </span>
                <span className="text-xs text-emerald-200 font-medium">
                  24 Lingkungan Aktif
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                Monitoring Laporan Harian 24 Kepala Lingkungan
              </h2>
              <p className="text-xs text-slate-300 font-normal mt-0.5">
                Kelurahan Mangga • Kecamatan Medan Tuntungan • Total Database: <strong>{reports.length} Laporan</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onOpenCapaianDashboard && (
              <button
                type="button"
                onClick={onOpenCapaianDashboard}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-md"
                title="Buka Dashboard Capaian Kinerja 24 Kepling"
              >
                <Trophy className="w-4 h-4" />
                <span>Dashboard Capaian</span>
              </button>
            )}

            {onOpenPemetaan && (
              <button
                type="button"
                onClick={() => onOpenPemetaan()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors cursor-pointer shadow-md border border-emerald-400/40"
                title="Buka Peta Spasial WebGIS Kelurahan Mangga"
              >
                <Compass className="w-4 h-4 text-emerald-200" />
                <span>Peta WebGIS</span>
              </button>
            )}

            {onSeedInitialReports && (
              <button
                type="button"
                onClick={handleTriggerSeed}
                disabled={isSeeding || isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 text-xs font-black transition-colors cursor-pointer shadow-md disabled:opacity-50"
                title="Muat / Pulihkan data laporan resmi 24 Kepling ke database"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isSeeding ? 'animate-spin' : ''}`} />
                <span>{isSeeding ? 'Memuat...' : 'Muat Laporan 24 Kepling'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyRekapWA}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-md ${
                copiedWa
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/30'
              }`}
              title="Salin ringkasan rekapitulasi status pengiriman 24 Kepling ke clipboard (siap kirim WhatsApp)"
            >
              {copiedWa ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWa ? 'Tersalin!' : 'Salin Rekap WA'}</span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 border border-white/20 text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                title="Muat ulang laporan terbaru dari server"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Memperbarui...' : 'Segarkan'}</span>
              </button>
            )}

            {sheetMeta?.spreadsheetUrl && (
              <a
                href={sheetMeta.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-100 border border-emerald-400/40 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Buka Google Sheets Database (Sheet: Laporan Harian & Username)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                <span>Google Sheets</span>
                <ExternalLink className="w-3 h-3 text-emerald-300" />
              </a>
            )}

            {onOpenCredentialBook && (
              <button
                type="button"
                onClick={onOpenCredentialBook}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <KeyRound className="w-4 h-4 text-amber-300" />
                <span>Buku Sandi</span>
              </button>
            )}

            {onResetReports && (
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Reset seluruh riwayat data laporan harian"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* View Mode & Date Selector Bar */}
        <div className="mt-5 pt-4 border-t border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* View Modes */}
          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('DAILY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'DAILY'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Pantauan Tanggal</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LATEST_PER_KEPLING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'LATEST_PER_KEPLING'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-amber-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Status Terkini 24 Lingkungan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('ALL');
                setSelectedDate('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Semua Tanggal</span>
            </button>
          </div>

          {/* Date Picker & Quick Date Links (for DAILY mode) */}
          {viewMode === 'DAILY' && (
            <div className="flex flex-wrap items-center gap-2 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15">
              <Calendar className="w-4 h-4 text-emerald-300 shrink-0" />
              
              {/* Dropdown of dates that actually have reports */}
              {availableDates.length > 0 && (
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-900/90 text-white font-bold text-xs py-1 px-2 rounded-lg border border-emerald-500/40 focus:outline-none cursor-pointer"
                >
                  <option value={todayIso}>
                    Hari Ini: {formatTanggalIndonesia(new Date())} {hasReportsToday ? '(Ada Laporan)' : '(Belum Ada Lapor)'}
                  </option>
                  {availableDates.map((d) => (
                    <option key={d.iso} value={d.iso}>
                      {d.label}
                    </option>
                  ))}
                  <option value="">Semua Tanggal ({reports.length} Laporan)</option>
                </select>
              )}

              {/* Native Date Input */}
              <input
                id="input-monitor-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                title="Pilih tanggal manual"
              />

              {/* Quick shortcut buttons */}
              <div className="flex items-center gap-1 border-l border-white/20 pl-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayIso)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                    selectedDate === todayIso
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/10 text-emerald-200 hover:bg-white/20'
                  }`}
                  title="Lihat Laporan Hari Ini"
                >
                  Hari Ini
                </button>
                {latestAvailableDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(latestAvailableDate)}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                      selectedDate === latestAvailableDate
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/10 text-emerald-200 hover:bg-white/20'
                    }`}
                    title={`Lihat Tanggal Laporan Terbaru (${latestAvailableDate})`}
                  >
                    Terbaru ({availableDates[0]?.count || 0})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Monitoring Tab Switcher (Laporan Harian vs Hasil Pemetaan Spasial) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveMainTab('LAPORAN')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeMainTab === 'LAPORAN'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Status Laporan Harian (24 Kepling)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold hidden sm:inline-block">
            {stats.submittedCount}/{stats.totalKepling} Lapor
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('PBB_REALISASI')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeMainTab === 'PBB_REALISASI'
              ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-600" />
          <span>Realisasi PBB-P2</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
            activeMainTab === 'PBB_REALISASI'
              ? 'bg-white/40 text-slate-950'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {pbbOverview.persentaseRealisasiNominal.toFixed(1)}% Lunas
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('PEMETAAN')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeMainTab === 'PEMETAAN'
              ? 'bg-emerald-700 text-white shadow-sm border border-emerald-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MapIcon className="w-4 h-4 text-emerald-300" />
          <span>Hasil Pemetaan WebGIS & WRS (24 Lingkungan)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
            activeMainTab === 'PEMETAAN'
              ? 'bg-white/20 text-white'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {kelurahanPemetaan.totalRumahAll} Rumah • {kelurahanPemetaan.totalJiwaAll} Jiwa
          </span>
        </button>
      </div>

      {activeMainTab === 'LAPORAN' && (
        <>
          {/* Quick Notice to WebGIS Pemetaan */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <MapIcon className="w-4 h-4" />
              </div>
              <p className="text-slate-700">
                <strong className="text-emerald-900 font-bold">Hasil Pemetaan Spasial Terkini:</strong>{' '}
                {kelurahanPemetaan.totalRumahAll} Rumah terpetakan • {kelurahanPemetaan.totalJiwaAll} Jiwa •{' '}
                {kelurahanPemetaan.totalWrsAktifAll} WRS Aktif (Potensi Rp {kelurahanPemetaan.potensiRetribusiWrsAll.toLocaleString('id-ID')}/bln).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveMainTab('PEMETAAN')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <span>Lihat Detail Hasil Pemetaan 24 Lingkungan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Empty Database Recovery Banner (If reports is 0) */}
      {reports.length === 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-950 text-sm">
                  Database Laporan Belum Terisi atau Masih Kosong
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Sistem telah menyiapkan data awal resmi untuk <strong>24 Kepala Lingkungan</strong> Kelurahan Mangga (kegiatan Opsir PBB, Perlinsos DTKS, IKD Dukcapil, BPJS, dan Pos Kamling). Tekan tombol di bawah untuk langsung memuat seluruh riwayat laporan ke dashboard.
                </p>
              </div>
            </div>
            {onSeedInitialReports && (
              <button
                type="button"
                onClick={handleTriggerSeed}
                disabled={isSeeding}
                className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSeeding ? 'Sedang Memuat...' : 'Muat Data 24 Kepling Sekarang'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notice Banner if viewing DAILY and selected date has 0 reports but past reports exist */}
      {viewMode === 'DAILY' && stats.submittedCount === 0 && reports.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 text-amber-950 font-medium">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-900">
                Belum ada laporan Kepling yang masuk pada tanggal{' '}
                <span className="underline">{selectedDate ? formatTanggalIndonesia(new Date(selectedDate + 'T00:00:00')) : 'ini'}</span>.
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {latestAvailableDate ? (
                  <>Tersedia data laporan pada tanggal <strong>{availableDates[0]?.label}</strong>.</>
                ) : (
                  <>Anda dapat menekan tombol <strong>"Status Terkini 24 Lingkungan"</strong> untuk melihat laporan terakhir masing-masing Kepling.</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {latestAvailableDate && latestAvailableDate !== selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(latestAvailableDate)}
                className="flex-1 sm:flex-none px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
              >
                Buka Tanggal Terbaru ({latestAvailableDate})
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('LATEST_PER_KEPLING')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
            >
              Lihat Status Terkini 24 Kepling
            </button>
          </div>
        </div>
      )}

      {/* Helpful Mode Info Banner when viewing LATEST_PER_KEPLING */}
      {viewMode === 'LATEST_PER_KEPLING' && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-950 font-medium">
            <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Mode <strong>Status Terkini 24 Lingkungan</strong> menampilkan laporan terakhir yang pernah dikirimkan oleh masing-masing Kepling beserta akumulasi kinerja terbarunya.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('DAILY')}
            className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer shrink-0"
          >
            Beralih ke Pantauan Harian →
          </button>
        </div>
      )}

      {/* High-Level Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Progress Pelaporan */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tingkat Kepatuhan</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {stats.submittedCount}
            </span>
            <span className="text-xs font-bold text-slate-500">
              / {stats.totalKepling} Lingkungan
            </span>
            <span className="ml-auto text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {stats.completionPct}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex justify-between font-medium">
            <span>{stats.submittedCount} Sudah Lapor</span>
            <span className="text-amber-600 font-bold">{stats.pendingCount} Belum Lapor</span>
          </div>
        </div>

        {/* Card 2: Total Opsir PBB */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Opsir PBB</span>
            <Building className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {stats.totalPbb}
            </span>
            <span className="text-xs font-bold text-slate-500">Wajib Pajak (WP)</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 font-medium">
            Penyampaian SPPT & penagihan pajak PBB
          </p>
        </div>

        {/* Card 3: Total Perlinsos & IKD */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Perlinsos & IKD</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Bansos/DTKS</div>
              <div className="text-lg font-black text-purple-900">{stats.totalPerlinsos} KK</div>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <div className="text-xs font-medium text-slate-500">Aktivasi IKD</div>
              <div className="text-lg font-black text-blue-900">{stats.totalIkd} Jiwa</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 font-medium">
            Perlindungan sosial & kependudukan digital
          </p>
        </div>

        {/* Card 4: Total BPJS Ketenagakerjaan */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>BPJS Ketenagakerjaan</span>
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {stats.totalBpjs}
            </span>
            <span className="text-xs font-bold text-slate-500">Pekerja Rentan (Jiwa)</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 font-medium">
            Sosialisasi & pendataan perlindungan kerja
          </p>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            id="filter-all-status"
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({KEPLING_ACCOUNTS.length})
          </button>
          <button
            id="filter-submitted-status"
            type="button"
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'SUBMITTED'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sudah Lapor ({stats.submittedCount})</span>
          </button>
          <button
            id="filter-pending-status"
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Belum Lapor ({stats.pendingCount})</span>
          </button>
        </div>

        {/* Search Kepling Name / Lingkungan */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-monitor"
            type="text"
            placeholder="Cari Lingkungan / Nama Kepling..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grid of 24 Lingkungan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredList.map((kepling) => {
          const report = activeKeplingReportMap.get(kepling.id);
          const hasReported = Boolean(report);
          const latestReportAnytime = keplingLatestReportMap.get(kepling.id);

          return (
            <div
              key={kepling.id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                hasReported
                  ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-2xs'
                  : 'bg-slate-50/70 border-slate-200 hover:border-amber-200'
              }`}
            >
              <div>
                {/* Header Card: Lingkungan Badge & Status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-md bg-emerald-800 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                      {kepling.nomorLingkungan}
                    </span>
                    <span className="text-xs font-black text-emerald-950">
                      {kepling.lingkungan}
                    </span>
                  </div>

                  {hasReported ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{viewMode === 'LATEST_PER_KEPLING' ? (report.tanggal || 'Ada Laporan') : 'Sudah Lapor'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Belum Lapor</span>
                    </span>
                  )}
                </div>

                {/* Kepling Name & Mapped House Indicator */}
                <div className="flex items-start justify-between gap-1 mt-0.5">
                  <div>
                    <div className="text-sm font-bold text-slate-900 tracking-tight">
                      {kepling.nama}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {kepling.jabatan}
                    </div>
                  </div>
                  {(() => {
                    const lStats = kelurahanPemetaan.perLingkunganMap[kepling.id];
                    if (!lStats || lStats.totalRumah === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPemetaan?.(kepling.nomorLingkungan);
                        }}
                        className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        title={`Buka peta spasial ${lStats.totalRumah} rumah terpetakan di ${kepling.lingkungan}`}
                      >
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>{lStats.totalRumah} Rumah</span>
                      </button>
                    );
                  })()}
                </div>

                {/* Report Content Preview (if submitted) */}
                {hasReported && report ? (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    {viewMode === 'LATEST_PER_KEPLING' && report.tanggal && (
                      <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>Laporan: {report.hari ? report.hari + ', ' : ''}{report.tanggal}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1 text-[11px] bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                      <div>
                        <span className="text-slate-500">Opsir PBB: </span>
                        <strong className="text-emerald-900">{report.kinerja?.opsirPbbWp || '0'} WP</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Perlinsos: </span>
                        <strong className="text-emerald-900">{report.kinerja?.perlinsosKk || '0'} KK</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">IKD: </span>
                        <strong className="text-emerald-900">{report.kinerja?.ikdOrang || '0'} Jiwa</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">BPJS: </span>
                        <strong className="text-emerald-900">{report.kinerja?.bpjsKetenagakerjaanOrang || '0'} Jiwa</strong>
                      </div>
                    </div>
                    {report.kinerja?.kegiatanLainnya && (
                      <p className="text-[11px] text-slate-600 italic line-clamp-1">
                        "{report.kinerja.kegiatanLainnya}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs">
                    <p className="text-slate-400 italic text-[11px]">
                      Belum mengirimkan laporan pada tanggal ini.
                    </p>
                    {latestReportAnytime && (
                      <div className="mt-1.5 p-1.5 bg-slate-100 rounded-lg text-[10px] text-slate-600 flex items-center justify-between">
                        <span>
                          Laporan terakhir: <strong>{latestReportAnytime.tanggal || 'Sebelumnya'}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectReport(latestReportAnytime)}
                          className="font-bold text-emerald-700 hover:underline cursor-pointer ml-1"
                        >
                          Lihat
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {hasReported && report ? (
                  <button
                    id={`btn-view-report-${kepling.id}`}
                    type="button"
                    onClick={() => onSelectReport(report)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                  >
                    <span>Detail Laporan</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    id={`btn-draft-report-${kepling.id}`}
                    type="button"
                    onClick={() => onDraftForKepling(kepling)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Input Atas Nama</span>
                  </button>
                )}

                <button
                  id={`btn-history-kepling-${kepling.id}`}
                  type="button"
                  onClick={() => onSwitchToRiwayat(kepling.nama)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="Lihat seluruh riwayat laporan kepling ini"
                >
                  Semua Riwayat
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredList.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
          Tidak ada data Kepala Lingkungan yang memenuhi kriteria filter saat ini.
        </div>
      )}
      </>
      )}

      {activeMainTab === 'PBB_REALISASI' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Header & Global Stats */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white border border-emerald-800/60 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider">
                      Database SPPT Resmi
                    </span>
                    <span className="text-xs text-emerald-300 font-bold">24 Lingkungan</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                    Monitoring Realisasi Penerimaan PBB-P2
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-900/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl shadow-xs">
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
                    className="bg-emerald-950 text-amber-300 text-xs font-black rounded-lg px-2 py-1 border border-emerald-400/50 focus:outline-none cursor-pointer"
                  >
                    {AVAILABLE_PBB_YEARS.map((yr) => (
                      <option key={yr} value={yr} className="bg-slate-900 text-white font-bold">
                        {yr} {yr === 2026 ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {onOpenPbb && (
                  <button
                    type="button"
                    onClick={onOpenPbb}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Buka Rincian SPPT & Rekap</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Target Ketetapan</span>
                <span className="text-xl font-black text-white block mt-1">{formatRupiah(pbbOverview.totalTargetNominal)}</span>
              </div>
              <div className="bg-emerald-900/50 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/40">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">Realisasi (Lunas)</span>
                <span className="text-xl font-black text-amber-300 block mt-1">{formatRupiah(pbbOverview.totalRealisasiNominal)}</span>
                <div className="flex items-center justify-between text-[11px] text-emerald-200 mt-1">
                  <span>Capaian:</span>
                  <span className="font-bold text-white">{pbbOverview.persentaseRealisasiNominal.toFixed(2)}%</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">Sisa Belum Bayar</span>
                <span className="text-xl font-black text-rose-200 block mt-1">{formatRupiah(pbbOverview.totalSisaNominal)}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Kepatuhan Wajib Pajak</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-white">{pbbOverview.totalWpLunas}</span>
                  <span className="text-xs text-slate-300">/ {pbbOverview.totalWp} WP</span>
                </div>
                <div className="mt-2 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full"
                    style={{ width: `${Math.min(pbbOverview.persentaseWpLunas, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Table for 24 Lingkungan */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">Rincian Realisasi per Lingkungan</h4>
                <p className="text-xs text-slate-500 mt-0.5">Pemantauan progres ketetapan PBB-P2 24 Lingkungan</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Lingkungan..."
                  value={pbbSearch}
                  onChange={(e) => setPbbSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5 border-b border-slate-100">No. Lingkungan</th>
                    <th className="py-3 px-5 border-b border-slate-100">Target Nominal</th>
                    <th className="py-3 px-5 border-b border-slate-100">Realisasi (Lunas)</th>
                    <th className="py-3 px-5 border-b border-slate-100 text-center">% Realisasi</th>
                    <th className="py-3 px-5 border-b border-slate-100">Sisa Nominal</th>
                    <th className="py-3 px-5 border-b border-slate-100 text-center">WP Lunas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pbbOverview.lingkunganSummaries
                    .filter(lk => lk.lingkungan.toString().includes(pbbSearch))
                    .map((lk) => (
                    <tr key={lk.lingkungan} className="hover:bg-slate-50 transition-colors text-xs group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {lk.lingkungan}
                          </div>
                          <span className="font-bold text-slate-700">Lingkungan {lk.lingkungan}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 font-semibold text-slate-600">
                        {formatRupiah(lk.targetNominal)}
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-bold text-emerald-700">{formatRupiah(lk.realisasiNominal)}</span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            lk.persentaseRealisasi >= 90 ? 'bg-emerald-100 text-emerald-700' : 
                            lk.persentaseRealisasi >= 50 ? 'bg-amber-100 text-amber-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {lk.persentaseRealisasi.toFixed(1)}%
                          </span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                lk.persentaseRealisasi >= 90 ? 'bg-emerald-500' : 
                                lk.persentaseRealisasi >= 50 ? 'bg-amber-500' : 
                                'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(lk.persentaseRealisasi, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 font-bold text-rose-600">
                        {formatRupiah(lk.sisaNominal)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-slate-900">{lk.wpLunas}</span>
                          <span className="text-[10px] text-slate-400">/ {lk.totalWp} WP</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === 'PEMETAAN' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-5 sm:p-6 text-white border border-emerald-800/50 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold shadow-inner shrink-0">
                  <MapIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                      WebGIS Spasial & Potensi Lingkungan
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded border border-white/15">
                      Kelurahan Mangga • 24 Lingkungan
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                    Hasil Pemetaan Spasial & Potensi 24 Lingkungan
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Data door-to-door titik rumah warga, kepatuhan WRS (Wajib Retribusi Sampah), PBB, dan demografi penduduk
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportExcelPemetaan}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors cursor-pointer shadow-xs"
                  title="Unduh rekapitulasi pemetaan 24 lingkungan dalam format Excel (.xlsx)"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  <span>Ekspor Excel (.xlsx)</span>
                </button>

                {onOpenPemetaan && (
                  <button
                    type="button"
                    onClick={() => onOpenPemetaan()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-md"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Buka Peta Interaktif WebGIS</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 6 Kelurahan Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Titik Rumah */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Rumah Terpetakan
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900">
                  {kelurahanPemetaan.totalRumahAll}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">Bangunan</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tersebar di {kelurahanPemetaan.totalLingkunganTerpetakan} dari 24 Lingkungan
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Penerima Bansos:</span>
                <strong className="text-emerald-700 font-bold">{kelurahanPemetaan.totalBansosKkAll} KK</strong>
              </div>
            </div>

            {/* 2. Demografi */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  Total Penduduk Terdata
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-blue-950">
                  {kelurahanPemetaan.totalJiwaAll}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">Jiwa</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  L: <strong className="text-slate-800">{kelurahanPemetaan.totalLakiLakiAll}</strong> • P: <strong className="text-slate-800">{kelurahanPemetaan.totalPerempuanAll}</strong> Jiwa
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Anak: {kelurahanPemetaan.totalAnakAll} Jiwa</span>
                <span className="text-slate-500">Lansia: <strong className="text-slate-800">{kelurahanPemetaan.totalLansiaAll} Jiwa</strong></span>
              </div>
            </div>

            {/* 3. Status KK */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                  Status KK Warga
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-purple-950">
                  {kelurahanPemetaan.persenKkManggaAll}%
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">KTP Mangga</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {kelurahanPemetaan.totalKkManggaAll} KK Asli • {kelurahanPemetaan.totalKkLuarAll} KK Pendatang
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Total KK Terpetakan:</span>
                <strong className="text-purple-800 font-bold">{kelurahanPemetaan.totalRumahAll} KK</strong>
              </div>
            </div>

            {/* 4. Retribusi Sampah WRS */}
            <div className="bg-white rounded-2xl p-5 border-2 border-amber-300 shadow-2xs hover:border-amber-400 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider">
                  Wajib Retribusi Sampah (WRS)
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-amber-950">
                  {kelurahanPemetaan.totalWrsAktifAll}
                  <span className="text-xs font-semibold text-amber-800 ml-1.5">
                    Aktif ({kelurahanPemetaan.persenWrsAktifAll}%)
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Mandiri: {kelurahanPemetaan.totalWrsMandiriAll} • Belum: {kelurahanPemetaan.totalWrsBelumAll}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">Estimasi Potensi Retribusi:</span>
                <strong className="text-emerald-800 font-black">
                  Rp {kelurahanPemetaan.potensiRetribusiWrsAll.toLocaleString('id-ID')}/bln
                </strong>
              </div>
            </div>

            {/* 5. Pajak PBB */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Kepatuhan Pajak PBB
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-emerald-800">
                  {kelurahanPemetaan.totalPbbLunasAll}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">
                    Lunas ({kelurahanPemetaan.persenPbbLunasAll}%)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Belum Lunas: {kelurahanPemetaan.totalPbbBelumLunasAll} WP Terdata
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Nominal PBB Terdata:</span>
                <strong className="text-emerald-700 font-bold">
                  Rp {kelurahanPemetaan.totalNominalPbbAll.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* 6. Jalan & Batas Wilayah */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                  Ruas Jalan & Batas Poligon
                </span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Navigation className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-teal-900">
                  {kelurahanPemetaan.totalRuasJalanAll}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">Ruas Jalan</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Panjang: <strong className="text-slate-800">{kelurahanPemetaan.totalPanjangJalanMeterAll}</strong> Meter
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Poligon Batas:</span>
                <strong className="text-emerald-700 font-bold">
                  {kelurahanPemetaan.totalPoligonAda} dari 24 Lingkungan
                </strong>
              </div>
            </div>
          </div>

          {/* Top 3 Leaderboard Lingkungan Teraktif */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                  Top Lingkungan Teraktif Pemetaan Spasial
                </h4>
                <p className="text-xs text-slate-500">
                  Apresiasi Lingkungan dengan progres inventarisasi rumah dan potensi spasial tertinggi
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {kelurahanPemetaan.topLingkunganByRumah.slice(0, 3).map((item, idx) => (
                <div
                  key={item.lingkunganNomor}
                  className={`p-4 rounded-xl border relative overflow-hidden flex flex-col justify-between ${
                    idx === 0
                      ? 'bg-amber-50/60 border-amber-300'
                      : idx === 1
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-orange-50/40 border-orange-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : 'bg-orange-300 text-orange-950'
                      }`}>
                        Juara {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-700">
                        {item.totalRumah} Rumah
                      </span>
                    </div>
                    <h5 className="font-black text-sm text-slate-900 mt-2">
                      {item.lingkunganNama}
                    </h5>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {item.keplingNama}
                    </p>
                    <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
                      <span>{item.totalJiwa} Jiwa</span>
                      <span>•</span>
                      <span>WRS: {item.wrsAktif} Aktif</span>
                    </div>
                  </div>

                  {onOpenPemetaan && (
                    <button
                      type="button"
                      onClick={() => onOpenPemetaan(item.lingkunganNomor)}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 text-xs font-bold border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Compass className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Buka di Peta WebGIS</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tabel Rekapitulasi 24 Lingkungan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Tabel Rekapitulasi Pemetaan 24 Lingkungan</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan {filteredPemetaanLingkunganList.length} dari 24 Lingkungan Kelurahan Mangga
                </p>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pemetaanSearch}
                    onChange={(e) => setPemetaanSearch(e.target.value)}
                    placeholder="Cari lingkungan atau nama kepling..."
                    className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-48 sm:w-60"
                  />
                  {pemetaanSearch && (
                    <button
                      type="button"
                      onClick={() => setPemetaanSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setPemetaanFilterStatus('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      pemetaanFilterStatus === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua (24)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPemetaanFilterStatus('HAS_HOUSES')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      pemetaanFilterStatus === 'HAS_HOUSES'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sudah Memetakan ({kelurahanPemetaan.totalLingkunganTerpetakan})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPemetaanFilterStatus('NO_HOUSES')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      pemetaanFilterStatus === 'NO_HOUSES'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Belum Ada Data ({24 - kelurahanPemetaan.totalLingkunganTerpetakan})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Lingkungan</th>
                    <th className="py-2.5 px-3">Kepala Lingkungan</th>
                    <th className="py-2.5 px-3 text-center">Batas Poligon</th>
                    <th className="py-2.5 px-3 text-center">Rumah Terpetakan</th>
                    <th className="py-2.5 px-3 text-center">Penduduk (Jiwa)</th>
                    <th className="py-2.5 px-3 text-center">KK Mangga</th>
                    <th className="py-2.5 px-3 text-center">WRS Aktif</th>
                    <th className="py-2.5 px-3 text-center">PBB Lunas</th>
                    <th className="py-2.5 px-3 text-center">Jalan</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPemetaanLingkunganList.map((item) => (
                    <tr
                      key={item.lingkunganNomor}
                      className="hover:bg-emerald-50/30 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                            {item.lingkunganNomor}
                          </span>
                          <span>{item.lingkunganNama}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {item.keplingNama}
                        </div>
                        {item.keplingTelepon && (
                          <a
                            href={`https://wa.me/${item.keplingTelepon.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{item.keplingTelepon}</span>
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.hasPolygon ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>{item.polygonPointsCount} Sudut</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            <span>Belum Digambar</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.totalRumah}
                        </span>
                        {item.bansosKk > 0 && (
                          <span className="text-[10px] text-emerald-700 block">
                            ({item.bansosKk} Bansos)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-blue-950">
                          {item.totalJiwa} Jiwa
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          L: {item.totalLakiLaki} • P: {item.totalPerempuan}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-purple-900">
                          {item.persenKkMangga}%
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.kkMangga} / {item.kkLuar}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-amber-900">
                          {item.wrsAktif} KK ({item.persenWrsAktif}%)
                        </span>
                        {item.potensiRetribusiWrs > 0 && (
                          <span className="text-[10px] text-emerald-700 block font-semibold">
                            Rp {item.potensiRetribusiWrs.toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-emerald-800">
                          {item.pbbLunas} ({item.persenPbbLunas}%)
                        </span>
                        {item.totalNominalPbb > 0 && (
                          <span className="text-[10px] text-slate-500 block">
                            Rp {item.totalNominalPbb.toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-semibold text-slate-700">
                          {item.totalRuasJalan} Ruas
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.totalPanjangJalanMeter} M
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {onOpenPemetaan && (
                          <button
                            type="button"
                            onClick={() => onOpenPemetaan(item.lingkunganNomor)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            title={`Buka peta spasial ${item.lingkunganNama}`}
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Buka di Peta</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPemetaanLingkunganList.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-400 bg-slate-50 rounded-xl mt-4">
                Tidak ada Lingkungan yang sesuai dengan pencarian atau filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm sm:text-base">Konfirmasi Reset Seluruh Laporan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-1.5">
                <p className="font-bold">⚠️ Perhatian: Tindakan ini permanen!</p>
                <p>
                  Seluruh data laporan kegiatan harian yang tersimpan di sistem server database dan dashboard lokal akan dikosongkan (reset).
                </p>
              </div>
              <p>
                Gunakan fitur ini hanya jika Anda ingin memulai periode pelaporan baru dari awal atau membersihkan data uji coba.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onResetReports) {
                    setIsResetting(true);
                    try {
                      await onResetReports();
                      setIsResetModalOpen(false);
                    } catch (e) {
                      console.error('Reset error:', e);
                    } finally {
                      setIsResetting(false);
                    }
                  }
                }}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isResetting ? 'Sedang Mereset...' : 'Ya, Reset Semua Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
