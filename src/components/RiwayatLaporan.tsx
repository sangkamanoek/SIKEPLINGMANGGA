import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  CheckCircle,
  X,
  Eye,
  Edit3,
  Shield,
  Trash2,
  AlertTriangle,
  Landmark,
  HeartHandshake,
  ShieldAlert,
  Award,
  Users,
  Wrench,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { LaporanHarianItem, SheetMetadata, UserAccount, KinerjaHarian } from '../types';
import { KEPLING_ACCOUNTS, SUPER_ADMIN_ACCOUNT } from '../data/keplingList';
import { isReportMatchingKepling, isReportMatchingDate, getReportIsoDate, getTodayLocalIso } from '../lib/formatter';
import { VirtualList } from './VirtualList';

interface RiwayatLaporanProps {
  items: LaporanHarianItem[];
  isLoading: boolean;
  onRefresh: () => void;
  sheetMeta: SheetMetadata | null;
  onSelectReport: (item: LaporanHarianItem) => void;
  hasGoogleAuth: boolean;
  initialPetugasFilter?: string;
  isAdmin?: boolean;
  activeAccount?: UserAccount;
  onDeleteReport?: (id: string) => Promise<void>;
}

export type DateFilterMode =
  | 'ALL'
  | 'TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM_RANGE';

type FilterKegiatanType = 'ALL' | 'PBB' | 'PERLINSOS' | 'IKD' | 'BPJS' | 'POSKAMLING' | 'INFRASTRUKTUR' | 'POSYANDU' | 'LAINNYA';
type FilterKategoriIsuType = 'ALL' | 'KEAMANAN' | 'KEBERSIHAN' | 'INFRASTRUKTUR' | 'PELAYANAN_SOSIAL' | 'PBB_PAJAK';

// Helper domain validators
export const isReportForPemerintahan = (item: LaporanHarianItem): boolean => {
  const kin: Partial<KinerjaHarian> = item.kinerja || {};
  const hasPbb = parseFloat(String(kin.opsirPbbWp || 0)) > 0 || Boolean(kin.opsirPbbKeterangan?.trim());
  const hasIkd = parseFloat(String(kin.ikdOrang || 0)) > 0 || Boolean(kin.ikdKeterangan?.trim());
  const hasApel = Boolean(item.absenApel?.status || item.absenApel?.jam);
  
  const allText = [
    item.absenApel?.catatan,
    kin.kegiatanLainnya,
    kin.opsirPbbKeterangan,
    kin.ikdKeterangan,
  ].filter(Boolean).join(' ').toLowerCase();

  const hasKeywords = /\b(pbb|pajak|sppt|wp|ikd|kependudukan|identitas|ktp|kk|nik|domisili|apel|pemerintahan|pelayanan\s*surat|register|surat\s*keterangan|pemilu|tps|pilkada|bapenda|dukcapil)\b/i.test(allText);

  return hasPbb || hasIkd || hasApel || hasKeywords;
};

export const isReportForPembangunan = (item: LaporanHarianItem): boolean => {
  const kin: Partial<KinerjaHarian> = item.kinerja || {};
  const hasPerlinsos = parseFloat(String(kin.perlinsosKk || 0)) > 0 || Boolean(kin.perlinsosKeterangan?.trim()) || Boolean(kin.perlinsosKategoriKegiatan);
  const hasBpjs = parseFloat(String(kin.bpjsKetenagakerjaanOrang || 0)) > 0 || Boolean(kin.bpjsKetenagakerjaanKeterangan?.trim());
  const hasInfra = Boolean(kin.infrastrukturAdaGiat || kin.infrastrukturSubjek?.trim() || kin.infrastrukturLokasi?.trim());
  const hasPosyandu = Boolean(kin.posyanduAdaGiat || kin.posyanduNama?.trim());

  const allText = [
    item.absenApel?.catatan,
    kin.kegiatanLainnya,
    kin.perlinsosKeterangan,
    kin.bpjsKetenagakerjaanKeterangan,
    kin.infrastrukturSubjek,
    kin.infrastrukturLokasi,
    kin.posyanduNama,
    kin.posyanduKeterangan,
  ].filter(Boolean).join(' ').toLowerCase();

  const hasKeywords = /\b(perlinsos|dtks|bansos|pkh|bpnt|stunting|posyandu|balita|baduta|lansia|disabilitas|infrastruktur|jalan|drainase|parit|paving|lampu|lpju|bedah\s*rumah|rtlh|musrenbang|sosial|bantuan|sembako|dinas\s*sdabmbk|dinas\s*sosial|dinas\s*kesehatan|bpjs)\b/i.test(allText);

  return hasPerlinsos || hasBpjs || hasInfra || hasPosyandu || hasKeywords;
};

export const isReportForTrantibum = (item: LaporanHarianItem): boolean => {
  const kin: Partial<KinerjaHarian> = item.kinerja || {};
  const hasPoskamling = Boolean(
    (kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat') ||
    kin.poskamlingAdaGiat ||
    kin.poskamlingPetugas?.trim() ||
    kin.poskamlingKeterangan?.trim()
  );

  const allText = [
    item.absenApel?.catatan,
    kin.kegiatanLainnya,
    kin.poskamlingPetugas,
    kin.poskamlingLokasi,
    kin.poskamlingKeterangan,
  ].filter(Boolean).join(' ').toLowerCase();

  const hasKeywords = /\b(poskamling|siskamling|pos\s*ronda|ronda|linmas|trantib|ketertiban|keamanan|patroli|kamtibmas|sengketa|mediasi|perselisihan|maling|pencurian|miras|judi|tawuran|pkl|spanduk|sampah\s*liar|gotong\s*royong|kebersihan|bencana|kebakaran|banjir|pohon\s*tumbang|posko|satpol\s*pp|babinsa|bhabinkamtibmas|tiga\s*pilar|faktor\s*74)\b/i.test(allText);

  return hasPoskamling || hasKeywords;
};

export const RiwayatLaporan: React.FC<RiwayatLaporanProps> = ({
  items,
  isLoading,
  onRefresh,
  sheetMeta,
  onSelectReport,
  hasGoogleAuth,
  initialPetugasFilter,
  isAdmin = false,
  activeAccount,
  onDeleteReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPetugas, setSelectedPetugas] = useState(initialPetugasFilter || 'ALL');
  const [selectedKegiatan, setSelectedKegiatan] = useState<FilterKegiatanType>('ALL');
  const [selectedKategoriIsu, setSelectedKategoriIsu] = useState<FilterKategoriIsuType>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Performance Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Role detection
  const isKasiPem = activeAccount?.role === 'kasi_pemerintahan';
  const isKasiBang = activeAccount?.role === 'kasi_pembangunan';
  const isKasiTrantib = activeAccount?.role === 'kasi_trantibum';
  const isAnyKasi = isKasiPem || isKasiBang || isKasiTrantib;
  const isSuperAdminOnly = activeAccount?.role === 'super_admin';

  // Boundary dates for intelligent fast range filtering
  const {
    todayIso,
    sevenDaysAgoIso,
    thirtyDaysAgoIso,
    thisMonthPrefix,
    thisMonthName,
    lastMonthPrefix,
    lastMonthName,
    thisYearPrefix,
  } = useMemo(() => {
    const today = new Date();
    const todayIso = getTodayLocalIso();

    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    const sevenDaysAgoIso = d7.toISOString().split('T')[0];

    const d30 = new Date();
    d30.setDate(d30.getDate() - 29);
    const thirtyDaysAgoIso = d30.toISOString().split('T')[0];

    const thisMonthPrefix = todayIso.slice(0, 7);
    const thisMonthName = today.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const lastMonthPrefix = `${prevMonthYear}-${prevMonthNum}`;
    const lastMonthName = prevMonthDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

    const thisYearPrefix = String(today.getFullYear());

    return {
      todayIso,
      sevenDaysAgoIso,
      thirtyDaysAgoIso,
      thisMonthPrefix,
      thisMonthName,
      lastMonthPrefix,
      lastMonthName,
      thisYearPrefix,
    };
  }, []);

  const handleExecuteDelete = async (id: string) => {
    if (!onDeleteReport) return;
    setIsDeletingId(id);
    try {
      await onDeleteReport(id);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Sync if initialPetugasFilter changes
  React.useEffect(() => {
    if (initialPetugasFilter) {
      setSelectedPetugas(initialPetugasFilter);
    } else {
      setSelectedPetugas('ALL');
    }
  }, [initialPetugasFilter]);

  // Extract officer names and lingkungan labels for the filter dropdown
  const listPetugas = useMemo(() => {
    const list: { nama: string; label: string }[] = [];
    // Pre-populate with all 24 Kepling
    KEPLING_ACCOUNTS.forEach((k) => {
      list.push({ nama: k.nama, label: `${k.lingkungan} - ${k.nama}` });
    });
    list.push({ nama: SUPER_ADMIN_ACCOUNT.nama, label: `Kasi Tata Pemerintahan - ${SUPER_ADMIN_ACCOUNT.nama}` });
    // Include any existing in items
    items.forEach((item) => {
      if (item.namaKepling?.trim()) {
        const trimmed = item.namaKepling.trim();
        if (!list.some((x) => x.nama.toLowerCase() === trimmed.toLowerCase())) {
          list.push({ nama: trimmed, label: `${item.jabatan || 'Petugas'} - ${trimmed}` });
        }
      }
    });
    return list;
  }, [items]);

  // Scoped items based on active role (Domain Partitioning)
  const domainScopedItems = useMemo(() => {
    if (isKasiPem) {
      return items.filter(isReportForPemerintahan);
    }
    if (isKasiBang) {
      return items.filter(isReportForPembangunan);
    }
    if (isKasiTrantib) {
      return items.filter(isReportForTrantibum);
    }
    return items;
  }, [items, isKasiPem, isKasiBang, isKasiTrantib]);

  // Comprehensive multi-criteria filtering
  const filtered = useMemo(() => {
    return domainScopedItems.filter((item) => {
      const term = searchTerm.toLowerCase();
      // 1. Keyword search (tanggal, hari, nama, jabatan, keterangan, catatan)
      const matchesKeyword =
        !searchTerm ||
        (item.tanggal || '').toLowerCase().includes(term) ||
        (item.hari || '').toLowerCase().includes(term) ||
        (item.namaKepling || '').toLowerCase().includes(term) ||
        (item.jabatan || '').toLowerCase().includes(term) ||
        (item.kinerja?.opsirPbbKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja?.perlinsosKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja?.ikdKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja?.bpjsKetenagakerjaanKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja?.kegiatanLainnya || '').toLowerCase().includes(term);

      if (!matchesKeyword) return false;

      // 2. Filter by Petugas (Ketat, mencegah kesalahan laporan antar-kepling)
      if (selectedPetugas !== 'ALL') {
        const targetKepling = KEPLING_ACCOUNTS.find(
          (k) => k.nama.trim().toLowerCase() === selectedPetugas.trim().toLowerCase()
        );
        if (targetKepling) {
          if (!isReportMatchingKepling(item, targetKepling)) {
            return false;
          }
        } else if (
          item.namaKepling?.trim().toLowerCase() !== selectedPetugas.trim().toLowerCase()
        ) {
          return false;
        }
      }

      // 3. Filter by Date Range Mode
      if (dateFilterMode !== 'ALL') {
        const reportIso = getReportIsoDate(item);
        if (!reportIso) return false;

        if (dateFilterMode === 'TODAY') {
          if (reportIso !== todayIso) return false;
        } else if (dateFilterMode === 'LAST_7_DAYS') {
          if (reportIso < sevenDaysAgoIso || reportIso > todayIso) return false;
        } else if (dateFilterMode === 'LAST_30_DAYS') {
          if (reportIso < thirtyDaysAgoIso || reportIso > todayIso) return false;
        } else if (dateFilterMode === 'THIS_MONTH') {
          if (!reportIso.startsWith(thisMonthPrefix)) return false;
        } else if (dateFilterMode === 'LAST_MONTH') {
          if (!reportIso.startsWith(lastMonthPrefix)) return false;
        } else if (dateFilterMode === 'THIS_YEAR') {
          if (!reportIso.startsWith(thisYearPrefix)) return false;
        } else if (dateFilterMode === 'CUSTOM_RANGE') {
          if (startDate && reportIso < startDate) return false;
          if (endDate && reportIso > endDate) return false;
        }
      } else if (startDate || endDate) {
        const reportIso = getReportIsoDate(item);
        if (!reportIso) return false;
        if (startDate && reportIso < startDate) return false;
        if (endDate && reportIso > endDate) return false;
      } else if (selectedDate) {
        if (!isReportMatchingDate(item, selectedDate)) {
          return false;
        }
      }

      // 4. Filter by Jenis Kegiatan
      if (selectedKegiatan === 'PBB') {
        const val = parseFloat(String(item.kinerja?.opsirPbbWp || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'PERLINSOS') {
        const val = parseFloat(String(item.kinerja?.perlinsosKk || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'IKD') {
        const val = parseFloat(String(item.kinerja?.ikdOrang || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'BPJS') {
        const val = parseFloat(String(item.kinerja?.bpjsKetenagakerjaanOrang || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'POSKAMLING') {
        return Boolean(
          (item.kinerja?.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat') ||
          item.kinerja?.poskamlingAdaGiat
        );
      }
      if (selectedKegiatan === 'INFRASTRUKTUR') {
        return Boolean(item.kinerja?.infrastrukturAdaGiat || item.kinerja?.infrastrukturSubjek);
      }
      if (selectedKegiatan === 'POSYANDU') {
        return Boolean(item.kinerja?.posyanduAdaGiat || item.kinerja?.posyanduNama);
      }
      if (selectedKegiatan === 'LAINNYA') {
        return Boolean(item.kinerja?.kegiatanLainnya?.trim());
      }

      // 5. Filter by Kategori Isu Bidang Spesifik
      if (selectedKategoriIsu !== 'ALL') {
        const kin: Partial<KinerjaHarian> = item.kinerja || {};
        const allText = [
          kin.kegiatanLainnya,
          kin.infrastrukturSubjek,
          kin.infrastrukturLokasi,
          kin.poskamlingPetugas,
          kin.poskamlingKeterangan,
          kin.opsirPbbKeterangan,
          kin.perlinsosKeterangan,
          item.absenApel?.catatan,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (selectedKategoriIsu === 'KEAMANAN') {
          const isPoskamling = Boolean(
            (kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat') ||
              kin.poskamlingAdaGiat
          );
          const hasKeyword = /\b(poskamling|siskamling|ronda|keamanan|trantib|ketertiban|patroli|maling|pencurian|sengketa|tawuran|bencana)\b/i.test(
            allText
          );
          if (!isPoskamling && !hasKeyword) return false;
        } else if (selectedKategoriIsu === 'KEBERSIHAN') {
          const hasKeyword = /\b(bersih|kebersihan|sampah|got|parit|drainase|kerja\s*bakti|gotong\s*royong|rumput|wrs|retribusi)\b/i.test(
            allText
          );
          if (!hasKeyword) return false;
        } else if (selectedKategoriIsu === 'INFRASTRUKTUR') {
          const isInfra = Boolean(kin.infrastrukturAdaGiat || kin.infrastrukturSubjek);
          const hasKeyword = /\b(infrastruktur|jalan|aspal|berlubang|rusak|penerangan|lampu|jembatan|trotoar|fasum|fasilitas)\b/i.test(
            allText
          );
          if (!isInfra && !hasKeyword) return false;
        } else if (selectedKategoriIsu === 'PELAYANAN_SOSIAL') {
          const isSosial =
            parseFloat(String(kin.perlinsosKk || 0)) > 0 ||
            parseFloat(String(kin.ikdOrang || 0)) > 0 ||
            parseFloat(String(kin.bpjsKetenagakerjaanOrang || 0)) > 0;
          const hasKeyword = /\b(perlinsos|bansos|ikd|bpjs|sosial|dtks|pkh|sembako|bantuan|rentan)\b/i.test(
            allText
          );
          if (!isSosial && !hasKeyword) return false;
        } else if (selectedKategoriIsu === 'PBB_PAJAK') {
          const isPbb = parseFloat(String(kin.opsirPbbWp || 0)) > 0;
          const hasKeyword = /\b(pbb|pajak|wp|sppt|opsir|retribusi)\b/i.test(allText);
          if (!isPbb && !hasKeyword) return false;
        }
      }

      return true;
    });
  }, [
    domainScopedItems,
    searchTerm,
    selectedPetugas,
    dateFilterMode,
    startDate,
    endDate,
    selectedDate,
    selectedKegiatan,
    selectedKategoriIsu,
    todayIso,
    sevenDaysAgoIso,
    thirtyDaysAgoIso,
    thisMonthPrefix,
    lastMonthPrefix,
    thisYearPrefix,
  ]);

  // Aggregate stats across the filtered view
  const stats = useMemo(() => {
    let totalPbbWp = 0;
    let totalPerlinsosKk = 0;
    let totalIkdOrang = 0;
    let totalBpjsOrang = 0;
    let totalPoskamling = 0;
    let totalInfra = 0;
    let totalPosyandu = 0;

    filtered.forEach((i) => {
      totalPbbWp += parseFloat(String(i.kinerja?.opsirPbbWp || 0)) || 0;
      totalPerlinsosKk += parseFloat(String(i.kinerja?.perlinsosKk || 0)) || 0;
      totalIkdOrang += parseFloat(String(i.kinerja?.ikdOrang || 0)) || 0;
      totalBpjsOrang += parseFloat(String(i.kinerja?.bpjsKetenagakerjaanOrang || 0)) || 0;
      if (i.kinerja?.poskamlingStatus && i.kinerja.poskamlingStatus !== 'Tidak Ada Giat') {
        totalPoskamling += 1;
      }
      if (i.kinerja?.infrastrukturAdaGiat || i.kinerja?.infrastrukturSubjek) {
        totalInfra += 1;
      }
      if (i.kinerja?.posyanduAdaGiat || i.kinerja?.posyanduNama) {
        totalPosyandu += 1;
      }
    });

    return { totalPbbWp, totalPerlinsosKk, totalIkdOrang, totalBpjsOrang, totalPoskamling, totalInfra, totalPosyandu };
  }, [filtered]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedPetugas('ALL');
    setSelectedKegiatan('ALL');
    setSelectedKategoriIsu('ALL');
    setDateFilterMode('ALL');
    setStartDate('');
    setEndDate('');
    setSelectedDate('');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedPetugas !== 'ALL' ||
    selectedKegiatan !== 'ALL' ||
    selectedKategoriIsu !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    selectedDate !== '';

  // Reset pagination to page 1 on filter/search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPetugas, selectedKegiatan, selectedKategoriIsu, dateFilterMode, startDate, endDate, selectedDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / (pageSize === -1 ? filtered.length || 1 : pageSize)));
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Dedicated Duty Scope Banner for Kepala Seksi */}
      {isKasiPem && (
        <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white rounded-2xl p-5 border border-teal-600/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0 text-teal-300">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-400 text-teal-950 font-black text-[10px] uppercase tracking-wider">
                  Pembagian Tugas: Seksi Tata Pemerintahan
                </span>
                <span className="text-xs text-teal-200 font-medium">Akses Bidang Terfokus</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1">
                Laporan & Data Kinerja: PBB-P2, IKD, Register Kependudukan & Presensi Apel
              </h3>
              <p className="text-xs text-teal-100/80 mt-0.5">
                Menampilkan arsip laporan yang berhubungan dengan tugas pokok dan fungsi Seksi Tata Pemerintahan Kelurahan Mangga.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-teal-950/60 px-3 py-2 rounded-xl border border-teal-700/50 text-xs font-bold text-teal-200">
            <UserCheck className="w-4 h-4 text-teal-400" />
            <span>{filtered.length} Laporan Bidang Pemerintahan</span>
          </div>
        </div>
      )}

      {isKasiBang && (
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-blue-600/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-300">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-400 text-blue-950 font-black text-[10px] uppercase tracking-wider">
                  Pembagian Tugas: Seksi Pembangunan & Kesos
                </span>
                <span className="text-xs text-blue-200 font-medium">Akses Bidang Terfokus</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1">
                Laporan & Data Kinerja: Realisasi Infrastruktur, Perlinsos (DTKS), BPJS & Posyandu
              </h3>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Menampilkan arsip laporan yang berhubungan dengan sarana prasarana fisik, bansos warga rentan, dan kesejahteraan sosial.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-blue-950/60 px-3 py-2 rounded-xl border border-blue-700/50 text-xs font-bold text-blue-200">
            <Wrench className="w-4 h-4 text-blue-400" />
            <span>{filtered.length} Laporan Bidang Pembangunan</span>
          </div>
        </div>
      )}

      {isKasiTrantib && (
        <div className="bg-gradient-to-r from-amber-950 via-orange-950 to-slate-900 text-white rounded-2xl p-5 border border-amber-600/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-black text-[10px] uppercase tracking-wider">
                  Pembagian Tugas: Seksi Trantibum & Linmas
                </span>
                <span className="text-xs text-amber-200 font-medium">Akses Bidang Terfokus</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1">
                Laporan & Data Kinerja: Poskamling, Linmas, Mediasi Sengketa, PKL & Kebersihan
              </h3>
              <p className="text-xs text-amber-100/80 mt-0.5">
                Menampilkan arsip laporan ronda malam poskamling, patroli ketertiban umum, mediasi sengketa, dan tanggap darurat wilayah.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-amber-950/60 px-3 py-2 rounded-xl border border-amber-700/50 text-xs font-bold text-amber-200">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>{filtered.length} Laporan Bidang Trantibum</span>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-6 bg-emerald-500 rounded-full shrink-0"></span>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
              Database Riwayat Laporan Kinerja
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Data tersinkronisasi otomatis dengan Cloud Firestore & database server secara realtime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sheetMeta?.spreadsheetUrl && (
            <a
              id="link-buka-spreadsheet-riwayat"
              href={sheetMeta.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Buka Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            id="btn-refresh-riwayat"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="Muat ulang dari Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Multi-Criteria Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Pencarian & Filter Laporan
            </h3>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Input Bar & Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              id="input-cari-riwayat"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kata kunci: nama, hari, catatan..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
            />
          </div>

          {/* Filter by Kategori Isu Bidang */}
          <div>
            <select
              id="filter-kategori-isu"
              value={selectedKategoriIsu}
              onChange={(e) => setSelectedKategoriIsu(e.target.value as FilterKategoriIsuType)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-bold"
            >
              <option value="ALL">📋 Semua Kategori Isu</option>
              <option value="KEAMANAN">🛡️ Keamanan & Poskamling (Trantibum)</option>
              <option value="KEBERSIHAN">🧹 Kebersihan & Lingkungan (Sampah/Got)</option>
              <option value="INFRASTRUKTUR">🛣️ Infrastruktur & Sarana (Jalan/Fasum)</option>
              <option value="PELAYANAN_SOSIAL">🤝 Sosial & Kependudukan (Perlinsos/IKD)</option>
              <option value="PBB_PAJAK">🏛️ Pajak PBB & Retribusi Daerah</option>
            </select>
          </div>

          {/* Filter by Petugas Kepling (Tersedia untuk Admin & Tampilan Bersama) */}
          <div>
            <select
              id="filter-petugas"
              value={selectedPetugas}
              onChange={(e) => setSelectedPetugas(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
            >
              <option value="ALL">👤 Semua Petugas Kepling</option>
              {listPetugas.map((petugas) => (
                <option key={petugas.nama} value={petugas.nama}>
                  👤 {petugas.label || petugas.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Periode Rentang Tanggal */}
          <div>
            <select
              id="filter-periode-tanggal"
              value={dateFilterMode}
              onChange={(e) => {
                const mode = e.target.value as DateFilterMode;
                setDateFilterMode(mode);
                if (mode !== 'CUSTOM_RANGE') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-bold"
            >
              <option value="ALL">📅 Semua Rentang Waktu</option>
              <option value="TODAY">⚡ Hari Ini ({todayIso})</option>
              <option value="LAST_7_DAYS">⏱️ 7 Hari Terakhir</option>
              <option value="LAST_30_DAYS">📆 30 Hari Terakhir</option>
              <option value="THIS_MONTH">🗓️ Bulan Ini ({thisMonthName})</option>
              <option value="LAST_MONTH">⏪ Bulan Lalu ({lastMonthName})</option>
              <option value="THIS_YEAR">🏛️ Tahun Ini ({thisYearPrefix})</option>
              <option value="CUSTOM_RANGE">🎯 Rentang Tanggal Kustom...</option>
            </select>
          </div>
        </div>

        {/* Dedicated Date Range Filter Pills & Custom Range Inputs */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 text-[11px] font-extrabold uppercase mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rentang Tanggal:</span>
            </span>

            {[
              { id: 'ALL', label: 'Semua Waktu', icon: '📅' },
              { id: 'TODAY', label: 'Hari Ini', icon: '⚡' },
              { id: 'LAST_7_DAYS', label: '7 Hari Terakhir', icon: '⏱️' },
              { id: 'LAST_30_DAYS', label: '30 Hari', icon: '📆' },
              { id: 'THIS_MONTH', label: `Bulan Ini (${thisMonthName})`, icon: '🗓️' },
              { id: 'LAST_MONTH', label: `Bulan Lalu (${lastMonthName})`, icon: '⏪' },
              { id: 'THIS_YEAR', label: `Tahun ${thisYearPrefix}`, icon: '🏛️' },
              { id: 'CUSTOM_RANGE', label: 'Rentang Kustom', icon: '🎯' },
            ].map((preset) => {
              const isActive = dateFilterMode === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setDateFilterMode(preset.id as DateFilterMode);
                    if (preset.id !== 'CUSTOM_RANGE') {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-2xs scale-105'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker Box */}
          {(dateFilterMode === 'CUSTOM_RANGE' || startDate || endDate) && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Dari Tanggal:</span>
                  </span>
                  <input
                    id="filter-rentang-mulai"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilterMode('CUSTOM_RANGE');
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1">
                    <span>Sampai Tanggal:</span>
                  </span>
                  <input
                    id="filter-rentang-selesai"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilterMode('CUSTOM_RANGE');
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Quick shortcut helper inside custom box */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(sevenDaysAgoIso);
                      setEndDate(todayIso);
                      setDateFilterMode('CUSTOM_RANGE');
                    }}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-bold transition-colors cursor-pointer"
                  >
                    7 Hari Lalu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(`${thisMonthPrefix}-01`);
                      setEndDate(todayIso);
                      setDateFilterMode('CUSTOM_RANGE');
                    }}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-bold transition-colors cursor-pointer"
                  >
                    Bulan Berjalan
                  </button>
                </div>
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDateFilterMode('ALL');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hapus Rentang</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Kategori Isu Bidang Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 text-[11px] font-extrabold uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kategori Isu Bidang:</span>
          </span>

          {[
            { id: 'ALL', label: 'Semua Isu', icon: '📋', activeClass: 'bg-slate-800 text-white shadow-2xs' },
            { id: 'KEAMANAN', label: 'Keamanan & Poskamling', icon: '🛡️', activeClass: 'bg-amber-500 text-slate-950 font-black shadow-2xs' },
            { id: 'KEBERSIHAN', label: 'Kebersihan & Lingkungan', icon: '🧹', activeClass: 'bg-teal-700 text-white font-black shadow-2xs' },
            { id: 'INFRASTRUKTUR', label: 'Infrastruktur & Sarana', icon: '🛣️', activeClass: 'bg-blue-700 text-white font-black shadow-2xs' },
            { id: 'PELAYANAN_SOSIAL', label: 'Sosial & Kependudukan', icon: '🤝', activeClass: 'bg-purple-700 text-white font-black shadow-2xs' },
            { id: 'PBB_PAJAK', label: 'Pajak PBB & Retribusi', icon: '🏛️', activeClass: 'bg-emerald-800 text-white font-black shadow-2xs' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedKategoriIsu(cat.id as FilterKategoriIsuType)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedKategoriIsu === cat.id
                  ? `${cat.activeClass} scale-105`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Jenis Kegiatan Quick Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px] font-bold uppercase mr-1">
            Jenis Kegiatan:
          </span>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'ALL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Kegiatan
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('PBB')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'PBB'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            1. OPSIR PBB
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('PERLINSOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'PERLINSOS'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            2. PERLINSOS
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('IKD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'IKD'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            3. IDENTITAS DIGITAL (IKD)
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('BPJS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'BPJS'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            4. BPJS KETENAGAKERJAAN
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('POSKAMLING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedKegiatan === 'POSKAMLING'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>5. POSKAMLING</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('LAINNYA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'LAINNYA'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            6. Kegiatan Lainnya
          </button>
        </div>

        {/* Results Summary Bar */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>
              Menampilkan <strong>{filtered.length}</strong> dari <strong>{items.length}</strong> total laporan tersimpan.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              PBB: <strong className="text-emerald-700">{stats.totalPbbWp} WP</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              Perlinsos: <strong className="text-emerald-700">{stats.totalPerlinsosKk} KK</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              IKD: <strong className="text-emerald-700">{stats.totalIkdOrang} ORG</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              BPJS TK: <strong className="text-emerald-700">{stats.totalBpjsOrang} ORG</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-amber-300 text-amber-900 flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-600" />
              Poskamling: <strong className="text-amber-700">{stats.totalPoskamling} Giat</strong>
            </span>
          </div>
        </div>
      </div>

      {/* List of Filtered Reports with Virtual Windowing */}
      {filtered.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Memuat <strong>{paginatedItems.length}</strong> dari <strong>{filtered.length}</strong> laporan</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>⚡ Virtual Windowing</span>
              <span className="hidden sm:inline font-normal text-emerald-700">• Ringan untuk HP</span>
            </span>
          </div>

          <VirtualList
            items={paginatedItems}
            itemHeight={260}
            overscan={5}
            keyExtractor={(item) => item.id}
            renderItem={(item) => (
            <div
              key={item.id}
              className="mb-3 p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-emerald-700 text-white shadow-2xs">
                      {item.hari}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {item.tanggal}
                    </span>
                    {item.jumlahDokumentasi > 0 && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        📷 {item.jumlahDokumentasi} Foto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    <strong className="text-slate-800 font-bold">{item.namaKepling}</strong> • {item.jabatan} • {item.kelurahan}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectReport(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    title="Buka laporan untuk melihat detail, cetak PDF, atau edit isinya"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Buka / Edit</span>
                  </button>

                  {isSuperAdminOnly && onDeleteReport && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(confirmDeleteId === item.id ? null : item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      title="Hapus laporan ini dari sistem (Akses Super Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>

              {/* In-app Confirmation Banner for Admin Delete */}
              {confirmDeleteId === item.id && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-rose-900 font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Hapus laporan <strong>{item.namaKepling}</strong> ({item.jabatan}) tanggal <strong>{item.tanggal}</strong> permanen dari database?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isDeletingId === item.id}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteDelete(item.id)}
                      disabled={isDeletingId === item.id}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingId === item.id ? 'Menghapus...' : 'Ya, Hapus'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Pillars Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">1. OPSIR PBB</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja?.opsirPbbWp ? `${String(item.kinerja.opsirPbbWp).replace(/^0+(?=\d)/, '')} WP` : '-'}
                  </span>
                  {item.kinerja?.opsirPbbKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.opsirPbbKeterangan}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">2. PERLINSOS</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja?.perlinsosKk ? `${String(item.kinerja.perlinsosKk).replace(/^0+(?=\d)/, '')} KK` : '-'}
                  </span>
                  {item.kinerja?.perlinsosKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.perlinsosKeterangan}
                    </p>
                  )}
                  {item.kinerja?.perlinsosMenolakKk && String(item.kinerja.perlinsosMenolakKk) !== '0' && (
                    <div className="mt-1 text-[9px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded truncate" title={item.kinerja.perlinsosMenolakRincian || ''}>
                      ⚠️ Menolak: {item.kinerja.perlinsosMenolakKk} KK
                    </div>
                  )}
                  {item.kinerja?.perlinsosTidakDiTempatKk && String(item.kinerja.perlinsosTidakDiTempatKk) !== '0' && (
                    <div className="mt-0.5 text-[9px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded truncate" title={item.kinerja.perlinsosTidakDiTempatRincian || ''}>
                      🏠 Tdk di Tempat: {item.kinerja.perlinsosTidakDiTempatKk} KK
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">3. IKD</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja?.ikdOrang ? `${String(item.kinerja.ikdOrang).replace(/^0+(?=\d)/, '')} ORG` : '-'}
                  </span>
                  {item.kinerja?.ikdKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.ikdKeterangan}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">4. BPJS TK</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja?.bpjsKetenagakerjaanOrang ? `${String(item.kinerja.bpjsKetenagakerjaanOrang).replace(/^0+(?=\d)/, '')} ORG` : '-'}
                  </span>
                  {item.kinerja?.bpjsKetenagakerjaanKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.bpjsKetenagakerjaanKeterangan}
                    </p>
                  )}
                </div>
              </div>

              {/* Poskamling Information Bar */}
              {item.kinerja?.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat' && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950 flex flex-wrap items-center gap-2">
                  <span className="font-bold flex items-center gap-1 text-amber-900">
                    <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Poskamling:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 font-black text-[10px] text-slate-950">
                    {item.kinerja.poskamlingStatus}
                  </span>
                  {item.kinerja.poskamlingLokasi && (
                    <span className="text-slate-700">📍 {item.kinerja.poskamlingLokasi}</span>
                  )}
                  {item.kinerja.poskamlingPetugas && (
                    <span className="text-slate-600 hidden sm:inline">👮 {item.kinerja.poskamlingPetugas}</span>
                  )}
                  {item.kinerja.poskamlingKeterangan && (
                    <span className="text-slate-600 italic text-[11px] w-full sm:w-auto truncate">
                      "{item.kinerja.poskamlingKeterangan}"
                    </span>
                  )}
                </div>
              )}

              {item.kinerja?.kegiatanLainnya && (
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-700">Kegiatan Lainnya:</span> {item.kinerja.kegiatanLainnya}
                </p>
              )}

              {/* Lampiran Foto Dokumentasi Lapangan (Tampil Rapi & Jelas) */}
              {item.dokumentasiFoto && item.dokumentasiFoto.length > 0 && (
                <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 flex items-center gap-1">
                      <span>📷 {item.dokumentasiFoto.length} Foto:</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.dokumentasiFoto.slice(0, 6).map((foto, idx) => (
                        <div
                          key={foto.id || idx}
                          onClick={() => onSelectReport(item)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer hover:border-emerald-500 hover:scale-105 transition-all relative group shadow-2xs"
                          title={`${foto.name || `Foto ${idx + 1}`} - Klik untuk lihat foto jelas & penuh`}
                        >
                          <img
                            src={foto.url}
                            alt={foto.name || `Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        </div>
                      ))}
                      {item.dokumentasiFoto.length > 6 && (
                        <div
                          onClick={() => onSelectReport(item)}
                          className="w-12 h-12 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0 cursor-pointer hover:bg-emerald-100 transition-colors"
                          title="Lihat seluruh sisa foto lainnya"
                        >
                          +{item.dokumentasiFoto.length - 6}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectReport(item)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                  >
                    <span>Buka Album Foto & Cetak</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            )}
          />

          {/* Pagination Controls Bar */}
          {(totalPages > 1 || pageSize === -1 || filtered.length > 10) && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                {pageSize === -1 ? (
                  <span>Menampilkan <strong className="text-emerald-700 font-bold">Semua {filtered.length}</strong> laporan dengan Virtual Windowing</span>
                ) : (
                  <>
                    <span>Menampilkan halaman <strong className="text-emerald-700 font-bold">{currentPage}</strong> dari <strong>{totalPages}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span>(Total {filtered.length} laporan)</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-2 text-slate-500">
                  <span className="text-[11px]">Tampilkan:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <option value={10}>10 Baris</option>
                    <option value={20}>20 Baris</option>
                    <option value={50}>50 Baris</option>
                    <option value={100}>100 Baris</option>
                    <option value={-1}>Semua (Virtual Scroll ⚡)</option>
                  </select>
                </div>

                {pageSize !== -1 && totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pNum = currentPage - 2 + i;
                          if (pNum > totalPages) pNum = totalPages - (4 - i);
                        }
                        return (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => setCurrentPage(pNum)}
                            className={`w-8 h-8 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                              currentPage === pNum
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Halaman Berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-slate-600">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Menyinkronkan data dari Cloud Firestore...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-bold text-slate-700 text-sm">Tidak ada laporan yang sesuai dengan kriteria filter.</p>
              <p className="text-slate-400 max-w-md mx-auto">
                Coba ubah kata kunci pencarian, sesuaikan tanggal, atau klik Reset Filter untuk menampilkan seluruh laporan.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
