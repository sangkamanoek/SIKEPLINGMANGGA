import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Award,
  Users,
  History,
  UserCheck,
  ShieldCheck,
  Trophy,
  Calendar,
  Compass,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  HelpCircle,
  MapPin,
  Layers,
  Search,
  Sparkles,
  LayoutGrid,
  Clock,
  Plus,
  FileSpreadsheet,
  Wrench,
  Wallet,
  RefreshCw,
  Database,
  Trash2,
} from 'lucide-react';
import { saveReportToFirestore } from '../lib/firestoreService';
import { fetchAllReports } from '../lib/reportsApi';
import { optimizeAndCleanBrowserMemory } from '../lib/safeStorage';
import { UserAccount, LaporanHarianItem, AbsenApelItem } from '../types';
import { DeadlineNotifAlert } from './DeadlineNotifAlert';
import { RealtimeSyncStatusPanel } from './RealtimeSyncStatusPanel';
import { SpptPbbItem } from '../data/pbbSampleData';
import { AgendaKelurahanBanner } from './AgendaKelurahanBanner';
import {
  DEFAULT_PBB_YEAR,
  AVAILABLE_PBB_YEARS,
  getLocalSpptForYear,
  fetchPbbSpptFromFirestore,
  subscribePbbSpptFromFirestore,
  computePbbOverview,
  subscribePbbSummary,
  getCachedPbbOverview,
  fetchPbbSpptForLingkungan,
  subscribePbbSpptForLingkungan,
  KelurahanPbbOverview,
} from '../lib/pbbService';

interface SmartHubDashboardProps {
  activeAccount: UserAccount;
  reports: LaporanHarianItem[];
  attendanceList: AbsenApelItem[];
  unreadCounts?: Record<string, number>;
  onNavigate: (tab: 'form' | 'capaian' | 'monitoring' | 'capaian_admin' | 'riwayat' | 'kunjungan' | 'dashboard_kasi' | 'kegiatan_khusus' | 'rekap_pbb' | 'database_keluarga' | 'realisasi_pembangunan' | 'daftar_tugas_khusus' | 'agenda' | string) => void;

  onOpenAbsenApel: () => void;
  onOpenPPTModal: () => void;
  onOpenUpdateModal?: () => void;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  spreadsheetTitle?: string | null;
  onForceSyncAll?: () => Promise<void> | void;
}

export const SmartHubDashboard: React.FC<SmartHubDashboardProps> = React.memo(({
  activeAccount,
  reports,
  attendanceList,
  unreadCounts = {},
  onNavigate,
  onOpenAbsenApel,
  onOpenPPTModal,
  onOpenUpdateModal,
  isGoogleConnected = false,
  googleUserEmail,
  spreadsheetTitle,
  onForceSyncAll,
}) => {
  const isKepling = activeAccount.role === 'kepling';
  const isAdmin = activeAccount.role === 'super_admin';
  const isKasi = activeAccount.role.startsWith('kasi_');
  const isBapenda = activeAccount.role === 'petugas_bapenda';

  // Toggle state for Classic vs Consolidated Bento-Grid Dashboard layout with LocalStorage persistence
  const [dashboardStyle, setDashboardStyle] = useState<'classic' | 'consolidated'>(() => {
    return (localStorage.getItem('sikepling_dashboard_style') as 'classic' | 'consolidated') || 'consolidated';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'laporan' | 'capaian' | 'absen'>('all');

  const handleStyleChange = (style: 'classic' | 'consolidated') => {
    setDashboardStyle(style);
    localStorage.setItem('sikepling_dashboard_style', style);
  };

  // Active PBB year (synced with user's selected year)
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

  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);

  const handleSyncFirestore = async () => {
    setIsSyncingFirestore(true);
    try {
      for (const r of reports) {
        if (r && r.id) {
          await saveReportToFirestore(r).catch(() => {});
        }
      }
      const fresh = await fetchAllReports();
      if (onForceSyncAll) {
        await onForceSyncAll();
      }
      alert(`Berhasil menyinkronkan ${fresh.length} data laporan harian ke Cloud Firestore!`);
    } catch (err) {
      alert('Gagal menyinkronkan data ke Firestore.');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const [isCleaningMemory, setIsCleaningMemory] = useState(false);

  const handleCleanBrowserMemory = () => {
    if (!window.confirm('Bersihkan memori sementara browser HP/komputer? Data akun dan laporan utama tetap aman di Cloud Firestore.')) {
      return;
    }
    setIsCleaningMemory(true);
    try {
      const res = optimizeAndCleanBrowserMemory();
      alert(`Pembersihan Memori Selesai!\n• Berhasil membuang ${res.freedKeys} entri data lama/sementara.\n• Memori browser kini lebih ringan dan responsif.`);
    } catch {
      alert('Gagal membersihkan memori browser.');
    } finally {
      setIsCleaningMemory(false);
    }
  };

  const [summaryOverview, setSummaryOverview] = useState<KelurahanPbbOverview>(() => getCachedPbbOverview(pbbYear));

  // Reactive live SPPT list state
  const [spptList, setSpptList] = useState<SpptPbbItem[]>(() => {
    const list = getLocalSpptForYear(pbbYear);
    if (list.length > 0) return list;
    try {
      const legacy = localStorage.getItem(`sikepling_pbb_master_data_${pbbYear}`);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Subscribe to real-time PBB updates (Firestore, API buffer, LocalStorage, BroadcastChannel)
  useEffect(() => {
    // 1. Subscribe to summary overview (instant 0ms loading)
    const unsubSummary = subscribePbbSummary(pbbYear, (ov) => {
      if (ov && ov.totalWp > 0) setSummaryOverview(ov);
    });

    let unsubSppt: () => void = () => {};

    if (isKepling && activeAccount.nomorLingkungan) {
      const lk = activeAccount.nomorLingkungan;
      fetchPbbSpptForLingkungan(pbbYear, lk).then((items) => {
        if (Array.isArray(items) && items.length > 0) setSpptList(items);
      }).catch(() => {});
      unsubSppt = subscribePbbSpptForLingkungan(pbbYear, lk, (items) => {
        if (Array.isArray(items) && items.length > 0) setSpptList(items);
      });
    } else {
      // Super Admin or Kasi Pem
      const currentLocal = getLocalSpptForYear(pbbYear);
      if (currentLocal.length > 0) {
        setSpptList(currentLocal);
      }
      fetchPbbSpptFromFirestore(pbbYear).then((items) => {
        if (Array.isArray(items) && items.length > 0) setSpptList(items);
      }).catch(() => {});
      unsubSppt = subscribePbbSpptFromFirestore(pbbYear, (items) => {
        if (Array.isArray(items) && items.length > 0) setSpptList(items);
      });
    }

    const handleSync = () => {
      if (!isKepling) {
        const updated = getLocalSpptForYear(pbbYear);
        setSpptList(updated);
      }
    };

    window.addEventListener('pbb-data-updated', handleSync);
    window.addEventListener('pbb-item-synced', handleSync);
    const handleWiped = () => setSpptList([]);
    window.addEventListener('pbb-wiped-all', handleWiped);

    const handleStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('sikepling_sppt_pbb') || e.key.includes('sikepling_pbb_master_data'))) {
        handleSync();
      }
      if (e.key === 'sikepling_pbb_selected_year' && e.newValue) {
        const num = parseInt(e.newValue, 10);
        if (AVAILABLE_PBB_YEARS.includes(num)) setPbbYear(num);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubSummary();
      unsubSppt();
      window.removeEventListener('pbb-data-updated', handleSync);
      window.removeEventListener('pbb-item-synced', handleSync);
      window.removeEventListener('pbb-wiped-all', handleWiped);
      window.removeEventListener('storage', handleStorage);
    };
  }, [pbbYear, isKepling, activeAccount?.nomorLingkungan]);

  // Live PBB database summary computed directly from synced SPPT data (same as RekapPbbView)
  const pbbSummary = useMemo(() => {
    // For Kepling role, focus on their assigned Lingkungan; for Super Admin / Kasi, whole kelurahan
    const filteredList = isKepling && activeAccount.nomorLingkungan
      ? spptList.filter(item => Number(item.lingkungan) === activeAccount.nomorLingkungan)
      : spptList;

    if (filteredList.length > 0) {
      const totalCount = filteredList.length;
      const lunasList = filteredList.filter(item => item.status === 'Sudah Bayar');
      const lunasCount = lunasList.length;
      const totalTarget = filteredList.reduce((acc, item) => acc + (Number(item.pbbTerutang) || 0), 0);
      const totalRealisasi = lunasList.reduce((acc, item) => {
        const paid = item.jumlahBayar !== undefined && item.jumlahBayar !== null
          ? Number(item.jumlahBayar)
          : (Number(item.pbbTerutang) || 0);
        return acc + paid;
      }, 0);
      const percent = totalTarget > 0 
        ? (totalRealisasi / totalTarget) * 100 
        : (totalCount > 0 ? (lunasCount / totalCount) * 100 : 0);
      const percentWp = totalCount > 0 ? (lunasCount / totalCount) * 100 : 0;

      return {
        totalCount,
        lunasCount,
        totalTarget,
        totalRealisasi,
        percent: percent > 0 ? percent : percentWp,
        percentWp,
      };
    }

    // Check summaryOverview baseline
    const overview = summaryOverview;
    if (overview && overview.totalWp > 0) {
      const lkTarget = isKepling && activeAccount.nomorLingkungan
        ? overview.lingkunganSummaries.find(lk => lk.lingkungan === activeAccount.nomorLingkungan)
        : null;

      if (lkTarget && lkTarget.totalWp > 0) {
        return {
          totalCount: lkTarget.totalWp,
          lunasCount: lkTarget.wpLunas,
          totalTarget: lkTarget.targetNominal,
          totalRealisasi: lkTarget.realisasiNominal,
          percent: lkTarget.persentaseRealisasi || lkTarget.persentaseWpLunas,
          percentWp: lkTarget.persentaseWpLunas,
        };
      }

      return {
        totalCount: overview.totalWp,
        lunasCount: overview.totalWpLunas,
        totalTarget: overview.totalTargetNominal,
        totalRealisasi: overview.totalRealisasiNominal,
        percent: overview.persentaseRealisasiNominal || overview.persentaseWpLunas,
        percentWp: overview.persentaseWpLunas,
      };
    }

    // Default clean state when database is empty (0 WP)
    return {
      totalCount: 0,
      lunasCount: 0,
      totalTarget: 0,
      totalRealisasi: 0,
      percent: 0,
      percentWp: 0,
    };
  }, [spptList, isKepling, activeAccount.nomorLingkungan, pbbYear]);

  // Stats / Compliance Helpers
  const todayStr = new Date().toISOString().split('T')[0];
  
  const hasSubmittedReportToday = reports.some(
    (r) => r.petugasNama === activeAccount.nama && r.tanggalLaporan?.startsWith(todayStr)
  );

  const hasAbsenApelToday = attendanceList.some(
    (a) => a.accountId === activeAccount.id && a.tanggal?.startsWith(todayStr)
  );

  const todayReportsCount = reports.filter((r) => r.tanggalLaporan?.startsWith(todayStr)).length;
  const uniqueKeplingsWithReportsToday = new Set(
    reports
      .filter((r) => r.tanggalLaporan?.startsWith(todayStr))
      .map((r) => r.petugasNama)
  ).size;

  const todayApelCount = attendanceList.filter(
    (a) => a.tanggal.startsWith(todayStr) && a.status === 'Hadir'
  ).length;

  const isPbbAllowed =
    isKepling ||
    isAdmin ||
    activeAccount.role === 'kasi_pemerintahan' ||
    activeAccount.role === 'petugas_bapenda';

  // Helper to calculate incoming report & data record count for top-right card badges
  const getMenuCountBadge = useMemo(() => {
    return (id: string) => {
      switch (id) {
        case 'riwayat': {
          const count = isKepling
            ? reports.filter(r => String(r.lingkungan) === String(activeAccount.nomorLingkungan) || r.petugasNama === activeAccount.nama || r.namaKepling === activeAccount.nama).length
            : reports.length;
          return { num: count, label: `${count} Laporan` };
        }
        case 'kegiatan_khusus': {
          const count = attendanceList.length;
          return { num: count, label: `${count} Absen` };
        }
        case 'kunjungan': {
          let count = 0;
          try {
            const raw = localStorage.getItem('sikepling_kunjungan_warga_v1');
            if (raw) count = JSON.parse(raw).length;
          } catch {}
          return { num: count, label: `${count} Sambang` };
        }
        case 'agenda': {
          let count = 0;
          try {
            const raw = localStorage.getItem('sikepling_agenda_kelurahan_v1');
            if (raw) count = JSON.parse(raw).length;
          } catch {}
          return { num: count, label: `${count} Agenda` };
        }
        case 'daftar_tugas_khusus': {
          let count = 0;
          try {
            const raw = localStorage.getItem('sikepling_tugas_khusus_v1');
            if (raw) count = JSON.parse(raw).length;
          } catch {}
          return { num: count, label: `${count} Tugas` };
        }
        case 'database_keluarga': {
          let count = 0;
          try {
            const raw = localStorage.getItem('sikepling_data_keluarga_v1');
            if (raw) count = JSON.parse(raw).length;
          } catch {}
          if (count === 0) count = 429;
          return { num: count, label: `${count} Data KK` };
        }
        case 'pbb_lingkungan':
        case 'rekap_pbb': {
          const count = pbbSummary.totalCount || spptList.length || 1240;
          return { num: count, label: `${count.toLocaleString('id-ID')} SPPT` };
        }
        case 'realisasi_pembangunan': {
          let count = 0;
          try {
            const raw = localStorage.getItem('sikepling_realisasi_pembangunan_v1');
            if (raw) count = JSON.parse(raw).length;
          } catch {}
          if (count === 0) {
            count = reports.filter(r => Boolean(r.kinerja?.infrastrukturAdaGiat)).length;
          }
          return { num: count, label: `${count} Progres` };
        }
        case 'monitoring': {
          return { num: todayReportsCount, label: `${todayReportsCount} Lapor Hari Ini` };
        }
        case 'capaian':
        case 'capaian_admin': {
          return { num: 24, label: `24 Kepling` };
        }
        case 'dashboard_kasi': {
          return { num: reports.length, label: `${reports.length} Laporan` };
        }
        case 'form': {
          const count = reports.filter(r => r.petugasNama === activeAccount.nama || String(r.lingkungan) === String(activeAccount.nomorLingkungan)).length;
          return { num: count, label: `${count} Laporan` };
        }
        default:
          return { num: reports.length, label: `${reports.length} Data` };
      }
    };
  }, [reports, attendanceList, pbbSummary, spptList, isKepling, activeAccount, todayReportsCount]);

  // Define menu items for UIX filtering strictly tailored per role
  const menuItems = useMemo(() => {
    if (isBapenda) {
      return [
        {
          id: 'pbb_lingkungan',
          title: `Rekapitulasi Realisasi PBB ${pbbYear}`,
          desc: `Pantau target dan realisasi penerimaan PBB-P2 Tahun ${pbbYear} di 24 Lingkungan Kelurahan Mangga (Akses Lihat Saja / Read-Only).`,
          category: 'capaian',
          icon: FileSpreadsheet,
          iconBg: 'bg-emerald-50 text-emerald-700',
          badge: `PBB ${pbbYear}`,
          badgeColor: 'bg-emerald-100 text-emerald-800',
          action: () => onNavigate('rekap_pbb'),
        },
      ];
    }

    // Role Kasi Tata Pemerintahan
    if (activeAccount.role === 'kasi_pemerintahan') {
      return [
        {
          id: 'dashboard_kasi',
          title: 'Dashboard Kasi Tata Pemerintahan',
          desc: 'Monitoring leaderboard penerimaan Opsir PBB, capaian IKD, dan presensi apel pagi 24 Kepling.',
          category: 'capaian',
          icon: Award,
          iconBg: 'bg-teal-50 text-teal-700',
          badge: 'UTAMA PEMERINTAHAN',
          badgeColor: 'bg-teal-100 text-teal-900',
          bgGradient: 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 text-white border-teal-600/60',
          action: () => onNavigate('dashboard_kasi'),
        },
        {
          id: 'rekap_pbb',
          title: `Rekapitulasi Realisasi PBB-P2 ${pbbYear}`,
          desc: 'Monitoring data SPPT Wajib Pajak per lingkungan, status bayar lunas, dan ekspor lembar rekapitulasi PBB.',
          category: 'capaian',
          icon: FileSpreadsheet,
          iconBg: 'bg-emerald-50 text-emerald-700',
          badge: `PBB-P2 ${pbbYear}`,
          badgeColor: 'bg-emerald-100 text-emerald-800',
          action: () => onNavigate('rekap_pbb'),
        },
        {
          id: 'database_keluarga',
          title: 'Database Master Data Keluarga (KK & NIK)',
          desc: 'Pencarian NIK/KK, struktur anggota keluarga, buku register kependudukan, dan verifikasi data warga.',
          category: 'laporan',
          icon: Users,
          iconBg: 'bg-blue-50 text-blue-700',
          badge: 'KEPENDUDUKAN',
          badgeColor: 'bg-blue-100 text-blue-900',
          action: () => onNavigate('database_keluarga'),
        },
        {
          id: 'kegiatan_khusus',
          title: 'Presensi Apel & Disiplin Kepling',
          desc: 'Verifikasi foto selfie kehadiran, koordinat GPS apel, dan rekapitulasi kehadiran 24 Kepala Lingkungan.',
          category: 'absen',
          icon: UserCheck,
          iconBg: 'bg-teal-50 text-teal-700',
          badge: 'PRESENSI APEL',
          badgeColor: 'bg-teal-100 text-teal-800',
          action: () => onNavigate('kegiatan_khusus'),
        },
        {
          id: 'riwayat',
          title: 'Riwayat Laporan Pemerintahan',
          desc: 'Pusat arsip laporan kegiatan harian Kepling terkait administrasi kependudukan, IKD, dan pelayanan warga.',
          category: 'laporan',
          icon: History,
          iconBg: 'bg-slate-100 text-slate-700',
          badge: 'ARSIP LAPORAN',
          badgeColor: 'bg-slate-200 text-slate-800',
          action: () => onNavigate('riwayat'),
        },
      ];
    }

    // Role Kasi Pembangunan & Kesos
    if (activeAccount.role === 'kasi_pembangunan') {
      return [
        {
          id: 'dashboard_kasi',
          title: 'Dashboard Kasi Pembangunan & Kesos',
          desc: 'Monitoring realisasi pendataan 429 KK Perlinsos/DTKS, Posyandu, stunting, dan kepesertaan BPJS Ketenagakerjaan.',
          category: 'capaian',
          icon: Award,
          iconBg: 'bg-blue-50 text-blue-700',
          badge: 'UTAMA PEMBANGUNAN',
          badgeColor: 'bg-blue-100 text-blue-900',
          bgGradient: 'bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white border-blue-600/60',
          action: () => onNavigate('dashboard_kasi'),
        },
        {
          id: 'realisasi_pembangunan',
          title: 'Realisasi Pembangunan Infrastruktur',
          desc: 'Monitoring kondisi jalan rusak, perbaikan drainase/parit, paving block, lampu LPJU, dan Bedah Rumah RTLH.',
          category: 'laporan',
          icon: Wrench,
          iconBg: 'bg-indigo-50 text-indigo-700',
          badge: 'INFRASTRUKTUR & MUSRENBANG',
          badgeColor: 'bg-indigo-100 text-indigo-900',
          action: () => onNavigate('realisasi_pembangunan'),
        },
        {
          id: 'database_keluarga',
          title: 'Database Data Keluarga (KK Rentan / DTKS)',
          desc: 'Pusat data terpadu kependudukan, desil kesejahteraan 1-5, bansos PKH, BPNT, dan sanitasi keluarga.',
          category: 'laporan',
          icon: Users,
          iconBg: 'bg-blue-50 text-blue-700',
          badge: 'DATA PERLINSOS',
          badgeColor: 'bg-blue-100 text-blue-900',
          action: () => onNavigate('database_keluarga'),
        },
        {
          id: 'kunjungan',
          title: 'Kunjungan Harian Warga & Posyandu',
          desc: 'Log & rekam interaksi sambang silaturahmi, verifikasi bansos door-to-door, dan kegiatan sosial kemasyarakatan.',
          category: 'laporan',
          icon: Users,
          iconBg: 'bg-emerald-50 text-emerald-600',
          badge: 'KESEJAHTERAAN SOSIAL',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          action: () => onNavigate('kunjungan'),
        },
        {
          id: 'kegiatan_khusus',
          title: 'Absensi Kegiatan Kelurahan',
          desc: 'Absensi check-in kegiatan sosial, penimbangan stunting posyandu, dan gotong royong warga.',
          category: 'absen',
          icon: UserCheck,
          iconBg: 'bg-emerald-50 text-emerald-600',
          badge: 'GPS ABSEN',
          badgeColor: 'bg-teal-100 text-teal-800',
          action: () => onNavigate('kegiatan_khusus'),
        },
        {
          id: 'riwayat',
          title: 'Riwayat Laporan Pembangunan & Kesos',
          desc: 'Pusat arsip laporan harian Kepling khusus bidang pembangunan fisik, posyandu, dan sosial kemasyarakatan.',
          category: 'laporan',
          icon: History,
          iconBg: 'bg-slate-100 text-slate-700',
          badge: 'ARSIP LAPORAN',
          badgeColor: 'bg-slate-200 text-slate-800',
          action: () => onNavigate('riwayat'),
        },
      ];
    }

    // Role Kasi Trantibum & Linmas
    if (activeAccount.role === 'kasi_trantibum') {
      return [
        {
          id: 'dashboard_kasi',
          title: 'Dashboard Kasi Trantibum & Linmas',
          desc: 'Monitoring 7 Bidang Trantibum: Poskamling, Infra Publik, Mediasi Warga, Posko Trantib, Bersemi, Sampah Liar, Faktor 74.',
          category: 'capaian',
          icon: Award,
          iconBg: 'bg-amber-50 text-amber-700',
          badge: '7 BIDANG TRANTIBUM',
          badgeColor: 'bg-amber-100 text-amber-900',
          bgGradient: 'bg-gradient-to-r from-amber-950 via-orange-950 to-slate-900 text-white border-amber-600/60',
          action: () => onNavigate('dashboard_kasi'),
        },
        {
          id: 'kegiatan_khusus',
          title: 'Absensi Kegiatan Kelurahan & Linmas',
          desc: 'Absensi check-in patroli gabungan Tiga Pilar, penertiban sampah liar, dan apel siaga trantibum.',
          category: 'absen',
          icon: UserCheck,
          iconBg: 'bg-emerald-50 text-emerald-600',
          badge: 'GPS ABSEN',
          badgeColor: 'bg-teal-100 text-teal-800',
          action: () => onNavigate('kegiatan_khusus'),
        },
        {
          id: 'riwayat',
          title: 'Riwayat Laporan Ketentraman & Trantib',
          desc: 'Pusat arsip laporan giat ronda malam, penertiban sampah liar, mediasi perselisihan, dan penanganan gangguan kamtibmas.',
          category: 'laporan',
          icon: History,
          iconBg: 'bg-slate-100 text-slate-700',
          badge: 'ARSIP LAPORAN',
          badgeColor: 'bg-slate-200 text-slate-800',
          action: () => onNavigate('riwayat'),
        },
      ];
    }

    // Default: Super Admin or Kepling
    return [
      {
        id: 'monitoring',
        title: 'Monitoring Laporan 24 Lingkungan',
        desc: 'Pantau status pengiriman laporan harian, rekapitulasi kehadiran, dan kegiatan kebersihan/trantib 24 Lingkungan real-time.',
        category: 'laporan',
        icon: ShieldCheck,
        iconBg: 'bg-teal-50 text-teal-700',
        badge: 'MONITORING REALTIME',
        badgeColor: 'bg-teal-100 text-teal-900',
        bgGradient: 'bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-900 text-white border-teal-600/60',
        action: () => onNavigate('monitoring'),
      },
      {
        id: 'realisasi_pembangunan',
        title: 'Monitoring & Realisasi Pembangunan Wilayah',
        desc: 'Pusat data realisasi fisik infrastruktur, Musrenbang, perbaikan jalan, drainase parit, LPJU, dan Bedah Rumah RTLH.',
        category: 'laporan',
        icon: Wrench,
        iconBg: 'bg-rose-50 text-rose-700',
        badge: 'SARPRAS & INFRASTRUKTUR',
        badgeColor: 'bg-rose-100 text-rose-900',
        bgGradient: 'bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 text-white border-rose-600/60',
        action: () => onNavigate('realisasi_pembangunan'),
      },
      // 1. GIAT HARIAN (DAILY ACTIVITIES)
      ...(isKepling
        ? [
            {
              id: 'form',
              title: 'Formulir Laporan Harian',
              desc: 'Input kegiatan harian Kepala Lingkungan: trantib, infrastruktur, kebersihan, PBB, & kemasyarakatan.',
              category: 'laporan',
              icon: FileText,
              iconBg: 'bg-emerald-50 text-emerald-600',
              badge: 'UTAMA',
              badgeColor: 'bg-red-100 text-red-800',
              action: () => onNavigate('form'),
            },
          ]
        : []),
      {
        id: 'kunjungan',
        title: 'Buku Kunjungan Warga (Door-to-Door)',
        desc: 'Pencatatan langsung sambang warga per rumah, verifikasi status Perlinsos, aktivasi IKD, & kepatuhan PBB.',
        category: 'laporan',
        icon: Users,
        iconBg: 'bg-emerald-50 text-emerald-600',
        badge: 'SAMBANG WARGA',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        action: () => onNavigate('kunjungan'),
      },
      {
        id: 'kegiatan_khusus',
        title: 'Presensi Apel & Kegiatan',
        desc: 'Absensi check-in kegiatan kelurahan dengan validasi koordinat GPS dan foto selfie kehadiran.',
        category: 'absen',
        icon: UserCheck,
        iconBg: 'bg-teal-50 text-teal-700',
        badge: 'GPS ABSEN',
        badgeColor: 'bg-teal-100 text-teal-800',
        action: () => onNavigate('kegiatan_khusus'),
      },
      ...(!isKepling
        ? [
            {
              id: 'agenda',
              title: 'Agenda & Jadwal Kegiatan Kelurahan',
              desc: 'Jadwal rapat, gotong royong, posyandu, dan agenda resmi kelurahan lengkap dengan status selesai, lokasi, peserta, & ekspor Excel.',
              category: 'laporan',
              icon: Calendar,
              iconBg: 'bg-emerald-50 text-emerald-700',
              badge: 'AGENDA RESMI',
              badgeColor: 'bg-emerald-100 text-emerald-900',
              action: () => onNavigate('agenda'),
            },
          ]
        : []),
      {
        id: 'daftar_tugas_khusus',
        title: 'Daftar Tugas Khusus & Dokumentasi',
        desc: 'Lihat seluruh perintah & instruksi dari Lurah serta unggah foto bukti dokumentasi pelaksanaannya di lapangan.',
        category: 'laporan',
        icon: ClipboardList,
        iconBg: 'bg-amber-50 text-amber-700',
        badge: 'TUGAS LURAH',
        badgeColor: 'bg-amber-100 text-amber-900',
        action: () => onNavigate('daftar_tugas_khusus'),
      },


      // 2. DATA & LAYANAN (DATA & SERVICES)
      {
        id: 'database_keluarga',
        title: 'Database Data Keluarga (KK)',
        desc: 'Pusat data terpadu kependudukan, anggota keluarga (NIK), tingkat kesejahteraan (Desil 1–5), bansos PKH Medan Makmur, dan sanitasi.',
        category: 'laporan',
        icon: Users,
        iconBg: 'bg-blue-50 text-blue-700',
        badge: 'DATA KELUARGA',
        badgeColor: 'bg-blue-100 text-blue-900',
        action: () => onNavigate('database_keluarga'),
      },
      ...(isPbbAllowed
        ? [
            {
              id: 'pbb_lingkungan',
              title: isKepling ? `Data PBB Lingkungan ${activeAccount.nomorLingkungan || ''}` : `Rekapitulasi Realisasi PBB ${pbbYear}`,
              desc: isKepling
                ? `Pantau target nominal PBB, daftar SPPT Wajib Pajak Lingkungan ${activeAccount.nomorLingkungan || ''}, dan tandai WP lunas.`
                : `Rekapitulasi target dan realisasi penerimaan PBB-P2 Tahun ${pbbYear} di 24 Lingkungan Kelurahan Mangga.`,
              category: 'capaian',
              icon: FileSpreadsheet,
              iconBg: 'bg-emerald-50 text-emerald-700',
              badge: isKepling ? 'PBB LINGKUNGAN' : `PBB ${pbbYear}`,
              badgeColor: 'bg-emerald-100 text-emerald-800',
              action: () => onNavigate('rekap_pbb'),
            },
          ]
        : []),
      {
        id: 'realisasi_pembangunan',
        title: 'Monitoring & Realisasi Pembangunan Wilayah',
        desc: 'Monitoring realisasi perbaikan jalan, drainase, pemasangan paving blok, lampu LPJU, dan penambahan tiang baru di wilayah masing-masing.',
        category: 'laporan',
        icon: Wrench,
        iconBg: 'bg-indigo-50 text-indigo-700',
        badge: 'PEMBANGUNAN',
        badgeColor: 'bg-indigo-100 text-indigo-900',
        action: () => onNavigate('realisasi_pembangunan'),
      },

      // 3. INSIGHT & MONITORING (INSIGHT & MONITORING)
      {
        id: 'riwayat',
        title: isKepling ? 'Riwayat Laporan Saya' : 'Database Riwayat Laporan',
        desc: 'Pusat arsip pencarian, filter, edit, verifikasi, dan ekspor laporan harian seluruh lingkungan.',
        category: 'laporan',
        icon: History,
        iconBg: 'bg-slate-100 text-slate-700',
        badge: 'ARSIP',
        badgeColor: 'bg-slate-200 text-slate-800',
        action: () => onNavigate('riwayat'),
      },
      {
        id: 'capaian',
        title: isKepling ? 'Dashboard Capaian Saya' : 'Kelola Target & Capaian 24 Kepling',
        desc: 'Grafik real-time realisasi target PBB, Perlinsos (DTKS), dan Trantibum secara transparan.',
        category: 'capaian',
        icon: Trophy,
        iconBg: 'bg-amber-50 text-amber-600',
        badge: 'TARGET',
        badgeColor: 'bg-amber-100 text-amber-800',
        action: () => onNavigate(isKepling ? 'capaian' : 'capaian_admin'),
      },
      ...(isAdmin
        ? [
            {
              id: 'monitoring',
              title: 'Monitoring Keaktifan Kepling',
              desc: 'Pantau status keaktifan laporan harian, rekapitulasi apel pagi, dan peta interaktif kelurahan.',
              category: 'capaian',
              icon: ShieldCheck,
              iconBg: 'bg-amber-50 text-amber-600',
              badge: 'ADMIN',
              badgeColor: 'bg-rose-100 text-rose-800',
              action: () => onNavigate('monitoring'),
            },
            {
              id: 'dashboard_kasi',
              title: 'Dashboard Bidang Sektoral 3 Kasi',
              desc: 'Monitoring sektoral terpadu: PBB/IKD/Apel (Pemerintahan), Perlinsos/Posyandu (Pembangunan), dan Poskamling (Trantibum).',
              category: 'capaian',
              icon: Award,
              iconBg: 'bg-teal-50 text-teal-600',
              badge: '3 SEKTORAL',
              badgeColor: 'bg-teal-100 text-teal-800',
              action: () => onNavigate('dashboard_kasi'),
            },
          ]
        : []),
    ];
  }, [isBapenda, activeAccount.role, isKepling, isAdmin, isPbbAllowed, pbbYear, onNavigate]);

  const filteredMenus = menuItems.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 animate-fade-in">
      {/* Top Executive Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 border border-slate-800 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded">
                Pusat Kendali Eksekutif
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-300 text-xs font-semibold">
                {activeAccount.jabatan}
              </span>

              {/* Layout Mode Toggler */}
              <div className="inline-flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px] font-bold ml-2">
                <button
                  type="button"
                  onClick={() => handleStyleChange('consolidated')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    dashboardStyle === 'consolidated'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Gaya dashboard bento modern terstruktur"
                >
                  Terkonsolidasi
                </button>
                <button
                  type="button"
                  onClick={() => handleStyleChange('classic')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    dashboardStyle === 'classic'
                      ? 'bg-slate-800 text-slate-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Gaya dashboard menu klasik"
                >
                  Klasik
                </button>
              </div>
            </div>
            
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Selamat Datang, <span className="text-emerald-400 font-extrabold">{activeAccount.nama}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
              SI-MANGGA • Sistem Informasi & Administrasi Kelurahan Mangga. 
              {isKepling && ` Melayani warga di Lingkungan ${activeAccount.lingkungan}, Kec. Medan Tuntungan.`}
              {isAdmin && " Dashboard Eksekutif Super Admin. Kelola seluruh 24 lingkungan secara real-time."}
              {isKasi && " Dashboard Kasi Sektoral. Evaluasi, verifikasi, dan pantau capaian kinerja bidang Anda."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {onOpenUpdateModal && (
              <button
                type="button"
                onClick={onOpenUpdateModal}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/50 text-amber-300 text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer group"
                title="Lihat informasi pembaruan versi & fitur terkini aplikasi"
              >
                <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
                <span>Info Update</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSyncFirestore}
              disabled={isSyncingFirestore}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Sinkronkan seluruh data laporan harian ke Cloud Firestore"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-200 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirestore ? 'Menyinkronkan...' : 'Sinkronkan Firestore'}</span>
            </button>
            <button
              type="button"
              onClick={handleCleanBrowserMemory}
              disabled={isCleaningMemory}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 hover:border-rose-500/50 text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Bersihkan memori & cache sementara browser HP/komputer yang memperlambat sistem"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{isCleaningMemory ? 'Membersihkan...' : 'Bersihkan Memori'}</span>
            </button>
            <button
              onClick={onOpenPPTModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Panduan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Panel Ringkasan Status Sinkronisasi Real-Time (Firebase, Google Sheets, IndexedDB) */}
      <RealtimeSyncStatusPanel
        isGoogleConnected={isGoogleConnected}
        googleUserEmail={googleUserEmail}
        spreadsheetTitle={spreadsheetTitle}
        onForceSyncAll={onForceSyncAll}
      />

      {/* Visual Alert & Deadline 23:30 Push Notif Component */}
      <DeadlineNotifAlert activeAccount={activeAccount} reports={reports} onNavigate={onNavigate} />

      {/* Agenda Kelurahan Banner for Kepling */}
      <AgendaKelurahanBanner activeAccount={activeAccount} />

      {/* 3 Pilar Utama SI-MANGGA Banner Quick Navigation */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs sm:text-sm font-bold uppercase text-slate-900 tracking-wider">
              3 Pilar Layanan Utama SI-MANGGA
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
            Kelurahan Mangga · Medan Tuntungan
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pilar 1 */}
          <div 
            onClick={() => onNavigate(isKepling ? 'form' : 'dashboard_kasi')}
            className="p-3.5 bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-300 rounded-xl transition-all cursor-pointer group flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-102">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">Pilar 1</span>
              <h4 className="text-xs font-bold text-slate-900 truncate">Kinerja Kepling & Layanan</h4>
              <p className="text-[11px] text-slate-500 truncate">Presensi, Laporan Harian & PBB</p>
            </div>
          </div>

          {/* Pilar 2 */}
          <div 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('switch-to-pkk-role'));
            }}
            className="p-3.5 bg-slate-50/80 hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-300 rounded-xl transition-all cursor-pointer group flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-102">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-teal-800 uppercase block tracking-wider">Pilar 2</span>
              <h4 className="text-xs font-bold text-slate-900 truncate">Kegiatan TP-PKK</h4>
              <p className="text-[11px] text-slate-500 truncate">Pusat Menu, Laporan & Dasa Wisma</p>
            </div>
          </div>

          {/* Pilar 3 */}
          <div 
            onClick={() => onNavigate('surat_kedinasan')}
            className="p-3.5 bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-xl transition-all cursor-pointer group flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-102">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-blue-800 uppercase block tracking-wider">Pilar 3</span>
              <h4 className="text-xs font-bold text-slate-900 truncate">Surat Kedinasan</h4>
              <p className="text-[11px] text-slate-500 truncate">Arsip Surat Masuk, Keluar & SK</p>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER MODE A: MODERN CONSOLIDATED BENTO-GRID */}
      {dashboardStyle === 'consolidated' ? (
        <div className="space-y-6">
          
          {/* Quick Stats Bento Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. SEKSI TATA PEMERINTAHAN BENTO ROW */}
            {activeAccount.role === 'kasi_pemerintahan' && (
              <>
                <div 
                  onClick={() => onNavigate('dashboard_kasi')}
                  className="bg-slate-900 border border-slate-800 hover:border-teal-500/80 p-5 rounded-2xl text-white shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] uppercase font-black tracking-widest text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      🏛️ Tata Pemerintahan
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 flex items-center gap-1.5 text-slate-100">
                      <span>Dashboard Leaderboard PBB & IKD</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Monitoring peringkat capaian Opsir PBB, IKD, dan kedisiplinan apel pagi di 24 Lingkungan.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Status Wilayah</p>
                      <p className="text-xs sm:text-sm font-black text-teal-400 mt-1">24 Lingkungan</p>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Presensi Apel</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-400 mt-1">{todayApelCount} Hadir</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs font-black text-teal-400 group-hover:text-teal-300">
                    <span>Buka Dashboard Pemerintahan →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('rekap_pbb')}
                  className="bg-white border border-slate-200 hover:border-emerald-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        📊 Realisasi PBB-P2 2026
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">SPPT Master</span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Kolektibilitas Pajak PBB
                    </h3>
                    <div className="pt-2 space-y-2">
                      <div className="flex items-end justify-between text-xs font-black">
                        <span className="text-slate-500">Realisasi Penerimaan</span>
                        <span className="text-emerald-700 text-sm">{pbbSummary.percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className="h-full bg-emerald-600 rounded-full transition-all duration-1000 group-hover:bg-emerald-500"
                          style={{ width: `${Math.min(100, pbbSummary.percent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 font-bold pt-1 leading-none">
                        <span className="text-emerald-700">Lunas: {pbbSummary.lunasCount.toLocaleString('id-ID')} WP</span>
                        <span className="text-slate-500">Target: {pbbSummary.totalCount.toLocaleString('id-ID')} WP</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-emerald-700 group-hover:text-emerald-600">
                    <span>Kelola Lembar SPPT PBB →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('database_keluarga')}
                  className="bg-white border border-slate-200 hover:border-blue-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-black tracking-widest text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                      👥 Kependudukan & Administrasi
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Master Data Keluarga & KK
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Pencarian NIK, struktur keluarga, register domisili, dan verifikasi kependudukan 24 Lingkungan.
                    </p>
                    <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 mt-2">
                      <p className="text-[10px] text-blue-700 font-bold">Register Kependudukan Online</p>
                      <p className="text-xs font-black text-blue-900 mt-0.5">Siap Verifikasi & Validasi</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-blue-700 group-hover:text-blue-600">
                    <span>Buka Database Keluarga →</span>
                  </div>
                </div>
              </>
            )}

            {/* 2. SEKSI PEMBANGUNAN & KESOS BENTO ROW */}
            {activeAccount.role === 'kasi_pembangunan' && (
              <>
                <div 
                  onClick={() => onNavigate('dashboard_kasi')}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/80 p-5 rounded-2xl text-white shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] uppercase font-black tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      🏗️ Pembangunan & Kesos
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 flex items-center gap-1.5 text-slate-100">
                      <span>Dashboard Perlinsos & Stunting</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Monitoring pendataan 429 KK Perlinsos/DTKS, penimbangan stunting posyandu, dan BPJS.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Target Perlinsos</p>
                      <p className="text-xs sm:text-sm font-black text-blue-400 mt-1">429 KK Mangga</p>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Layanan Posyandu</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-400 mt-1">ILP Terpadu</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs font-black text-blue-400 group-hover:text-blue-300">
                    <span>Buka Dashboard Pembangunan →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('realisasi_pembangunan')}
                  className="bg-white border border-slate-200 hover:border-indigo-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black tracking-widest text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                        🛣️ Sarpras & Infrastruktur
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Fisik</span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Realisasi Pembangunan Fisik
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Monitoring perbaikan jalan berlubang, drainase/parit, penerangan LPJU, paving blok, & bedah rumah.
                    </p>
                    <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 mt-2">
                      <p className="text-[10px] text-indigo-700 font-bold">Musrenbang & Usulan Sarpras</p>
                      <p className="text-xs font-black text-indigo-900 mt-0.5">Monitoring Status Progres Fisik</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-indigo-700 group-hover:text-indigo-600">
                    <span>Kelola Pembangunan Fisik →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('kunjungan')}
                  className="bg-white border border-slate-200 hover:border-emerald-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        🤝 Kesejahteraan Sosial
                      </span>
                      {unreadCounts?.['kunjungan'] && unreadCounts['kunjungan'] > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse ring-1 ring-white/50">
                          {unreadCounts['kunjungan']} Baru
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Kunjungan Warga Rentan
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Log interaksi door-to-door sambang warga rentan, lansia, disabilitas, dan penerima bansos PKH/BPNT.
                    </p>
                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 mt-2">
                      <p className="text-[10px] text-emerald-700 font-bold">Verifikasi Door-to-Door</p>
                      <p className="text-xs font-black text-emerald-900 mt-0.5">Desil 1–5 Terpantau</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-emerald-700 group-hover:text-emerald-600">
                    <span>Lihat Kunjungan Warga →</span>
                  </div>
                </div>
              </>
            )}

            {/* 3. SEKSI TRANTIBUM & LINMAS BENTO ROW */}
            {activeAccount.role === 'kasi_trantibum' && (
              <>
                <div 
                  onClick={() => onNavigate('dashboard_kasi')}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/80 p-5 rounded-2xl text-white shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] uppercase font-black tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      🛡️ Trantibum & Linmas
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 flex items-center gap-1.5 text-slate-100">
                      <span>Dashboard 7 Bidang Trantibum</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Monitoring Pos Ronda, Fasum, Mediasi Sengketa Warga, Posko Trantib, Sampah Liar & Faktor 74.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Poskamling</p>
                      <p className="text-xs sm:text-sm font-black text-amber-400 mt-1">24 Lingkungan</p>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Situasi Kamtibmas</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-400 mt-1">Kondusif</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs font-black text-amber-400 group-hover:text-amber-300">
                    <span>Buka Dashboard Trantibum →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('kegiatan_khusus')}
                  className="bg-white border border-slate-200 hover:border-amber-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        🛡️ Patroli &amp; Apel
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Linmas</span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Absensi Patroli &amp; Apel Linmas
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Check-in GPS patroli gabungan Tiga Pilar, penertiban keamanan lingkungan, dan apel siaga kamtibmas.
                    </p>
                    <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 mt-2">
                      <p className="text-[10px] text-amber-800 font-bold">Kesiapsiagaan Trantibum</p>
                      <p className="text-xs font-black text-amber-950 mt-0.5">Petugas &amp; Linmas Aktif</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-amber-700 group-hover:text-amber-600">
                    <span>Buka Absensi Linmas →</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigate('riwayat')}
                  className="bg-white border border-slate-200 hover:border-emerald-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      📜 Arsip Laporan
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      Laporan Giat Ketertiban & Mediasi
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Pusat arsip laporan ronda malam, penertiban sampah liar, mediasi perselisihan, dan tanggap darurat bencana.
                    </p>
                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 mt-2">
                      <p className="text-[10px] text-emerald-700 font-bold">Laporan Disaring Khusus</p>
                      <p className="text-xs font-black text-emerald-900 mt-0.5">Bidang Trantibum & Linmas</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-emerald-700 group-hover:text-emerald-600">
                    <span>Lihat Riwayat Trantibum →</span>
                  </div>
                </div>
              </>
            )}

            {/* 4. SUPER ADMIN & KEPLING BENTO ROW (DEFAULT) */}
            {activeAccount.role !== 'kasi_pemerintahan' &&
             activeAccount.role !== 'kasi_pembangunan' &&
             activeAccount.role !== 'kasi_trantibum' && (
              <>
                {/* Bento Card 1: Buku Kunjungan Warga Door-to-Door (Kiri / Utama) */}
                <div 
                  onClick={() => onNavigate('kunjungan')}
                  className="md:col-span-1 bg-slate-900 border border-slate-800 hover:border-emerald-500/80 p-5 rounded-2xl text-white shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      👥 Kunjungan Door-to-Door
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-2 flex items-center gap-1.5 text-slate-100">
                      <span>Buku Sambang 24 Lingkungan</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Pencatatan langsung sambang warga per rumah, verifikasi status Perlinsos, aktivasi IKD, dan cek SPPT PBB.
                    </p>
                  </div>

                  {/* Interactive preview indicators */}
                  <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Format Berbagi</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-400 mt-1">Salin WA Instan</p>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Ekspor Berkas</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-400 mt-1 flex items-center gap-1">
                        <span>Excel &amp; ZIP Foto</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs font-black text-emerald-400 group-hover:text-emerald-300">
                    <span>Buka Buku Kunjungan →</span>
                  </div>
                </div>

                {/* Bento Card 2: Capaian & Target Realisasi PBB (Kanan Bawah-style) */}
                {isPbbAllowed && (
                  <div 
                    onClick={() => onNavigate('rekap_pbb')}
                    className="bg-white border border-slate-200 hover:border-emerald-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          📊 Realisasi PBB-P2 {isKepling && activeAccount.nomorLingkungan ? `(Lingk. ${activeAccount.nomorLingkungan})` : `(${pbbYear})`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {spptList.length > 0 ? 'Live Database' : 'Siap Input'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                        Capaian Penerimaan PBB
                      </h3>
                      
                      {/* Custom bar chart representation */}
                      <div className="pt-2 space-y-2">
                        <div className="flex items-end justify-between text-xs font-black">
                          <span className="text-slate-500">Kolektivitas PBB</span>
                          <span className="text-indigo-600 text-sm">{pbbSummary.percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000 group-hover:bg-indigo-500"
                            style={{ width: `${Math.min(100, pbbSummary.percent)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600 font-bold pt-1 leading-none">
                          <span className="text-emerald-700">Lunas: {pbbSummary.lunasCount.toLocaleString('id-ID')} WP</span>
                          <span className="text-slate-500">Target: {pbbSummary.totalCount.toLocaleString('id-ID')} WP</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-indigo-600 group-hover:text-indigo-500">
                      <span>Kelola SPPT PBB-P2 →</span>
                    </div>
                  </div>
                )}

                {/* Bento Card 3: Radar Kepatuhan Harian & Presensi (Kanan Atas-style) */}
                <div 
                  onClick={() => onNavigate(isAdmin ? 'monitoring' : 'riwayat')}
                  className="bg-white border border-slate-200 hover:border-emerald-500 p-5 rounded-2xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        👤 Presensi &amp; Agenda
                      </span>
                      {unreadCounts?.['riwayat'] && unreadCounts['riwayat'] > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse ring-1 ring-white/50">
                          {unreadCounts['riwayat']} Laporan Baru
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-black tracking-tight mt-2 text-slate-900">
                      {isAdmin ? 'Radar Tugas & Kehadiran' : 'Riwayat Laporan Saya'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      {isAdmin 
                        ? 'Pantau kepatuhan pengiriman laporan harian dan kehadiran apel pagi 24 Kepala Lingkungan secara langsung.'
                        : 'Lihat status pengiriman laporan kinerja harian dan verifikasi dokumentasi kegiatan.'}
                    </p>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex -space-x-2">
                        <span className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-2xs">✓</span>
                        <span className="w-7 h-7 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-2xs">✓</span>
                        <span className="w-7 h-7 rounded-full bg-emerald-300 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-2xs">✓</span>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">{todayApelCount} Kepling Hadir Apel</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Tersinkronisasi Real-Time</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-black text-emerald-700 group-hover:text-emerald-600">
                    <span>{isAdmin ? 'Monitoring Kepling →' : 'Buka Riwayat Laporan →'}</span>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Quick Checklist For Active Kepling in Bento mode */}
          {isKepling && (
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 flex-wrap">
                <h4 className="font-black text-slate-800 text-xs sm:text-sm uppercase tracking-wide">Radar Kepatuhan Lingkungan {activeAccount.nomorLingkungan}</h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  hasAbsenApelToday ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
                }`}>
                  <div>
                    <p className="text-[11px] font-black text-slate-700 leading-none">1. Absensi Apel Pagi</p>
                    <p className="text-[10px] text-slate-500 mt-1">{hasAbsenApelToday ? '✅ Sudah Terverifikasi Hadir' : '⚠️ Silakan lapor kehadiran apel pagi'}</p>
                  </div>
                  <button 
                    onClick={onOpenAbsenApel}
                    className={`px-3 py-1 text-[10px] font-black rounded-lg ${
                      hasAbsenApelToday ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {hasAbsenApelToday ? 'Lihat' : 'Absen'}
                  </button>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  hasSubmittedReportToday ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                }`}>
                  <div>
                    <p className="text-[11px] font-black text-slate-700 leading-none">2. Laporan Kegiatan Harian</p>
                    <p className="text-[10px] text-slate-500 mt-1">{hasSubmittedReportToday ? '✅ Laporan hari ini sudah terkirim' : '⚠️ Wajib kirim laporan harian'}</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('form')}
                    className={`px-3 py-1 text-[10px] font-black rounded-lg ${
                      hasSubmittedReportToday ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    {hasSubmittedReportToday ? 'Kirim Lagi' : 'Isi Laporan'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* RENDER MODE B: ORIGINAL CLASSIC VIEW */
        <div className="space-y-6">
          
          {/* COMPLIANCE CHECKLIST FOR KEPLING */}
          {isKepling && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base">Radar Tugas &amp; Kepatuhan Harian</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Pantau 2 agenda wajib sebelum batas waktu berakhir hari ini.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  <span>Hari Ini:</span>
                  <span className="text-emerald-800 font-black">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Kartu 1: Absen Apel Pagi */}
                <div
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    hasAbsenApelToday
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs ring-1 ring-amber-400/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase tracking-wider">1. Absen Apel Pagi</span>
                        {!hasAbsenApelToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 animate-pulse">
                            WAJIB
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold mt-1 opacity-90">
                        {hasAbsenApelToday ? '✅ Sudah Terverifikasi Hadir' : '⚠️ Jam 07.45 - 08.00 WIB di Kantor Lurah'}
                      </p>
                    </div>
                    {hasAbsenApelToday ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                    )}
                  </div>

                  {hasAbsenApelToday ? (
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                      <span>Presensi Tercatat</span>
                      <button
                        onClick={onOpenAbsenApel}
                        className="underline hover:text-emerald-950 cursor-pointer"
                      >
                        Lihat Bukti
                      </button>
                    </div>
                  ) : (
                    <button
                      id="btn-radar-absen-sekarang"
                      onClick={onOpenAbsenApel}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 text-xs font-black rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Ambil Absen Apel Sekarang</span>
                    </button>
                  )}
                </div>

                {/* Kartu 2: Formulir Laporan Harian */}
                <div
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    hasSubmittedReportToday
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase tracking-wider">2. Laporan Harian</span>
                        {!hasSubmittedReportToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white">
                            BELUM KIRIM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold mt-1 opacity-90">
                        {hasSubmittedReportToday
                          ? '✅ 1 Laporan Harian Lengkap Terkirim'
                          : '📝 Wajib 6 Foto Kegiatan Lapangan'}
                      </p>
                    </div>
                    {hasSubmittedReportToday ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                  </div>

                  {hasSubmittedReportToday ? (
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                      <span>Tersimpan di Cloud</span>
                      <button
                        onClick={() => onNavigate('form')}
                        className="underline hover:text-emerald-950 cursor-pointer"
                      >
                        + Lapor Lagi
                      </button>
                    </div>
                  ) : (
                    <button
                      id="btn-radar-lapor-sekarang"
                      onClick={() => onNavigate('form')}
                      className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-505 active:scale-98 text-white text-xs font-black rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Isi &amp; Kirim Laporan</span>
                    </button>
                  )}
                </div>

                {/* Kartu 3: Sambang Warga Lapangan */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/90 text-slate-800 flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">3. Sambang Warga Lapangan</span>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">Pencatatan door-to-door, Perlinsos, IKD, &amp; PBB.</p>
                    </div>
                    <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => onNavigate('kunjungan')}
                      className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-2xs text-center cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
                    >
                      <span>👥 Buka Buku Kunjungan Warga</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QUICK STATS FOR ADMIN */}
          {isAdmin && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Laporan Hari Ini</p>
                <p className="text-xl font-black text-emerald-800 mt-1">{todayReportsCount} Laporan</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Dari {uniqueKeplingsWithReportsToday}/24 Kepling</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kehadiran Apel Hari Ini</p>
                <p className="text-xl font-black text-amber-700 mt-1">{todayApelCount}/24 Hadir</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Sesi Apel Pagi Kelurahan</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Database Laporan</p>
                <p className="text-xl font-black text-slate-900 mt-1">{reports.length} Data</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Tersimpan di Cloud Firestore</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peta Pelayanan</p>
                <p className="text-xl font-black text-blue-700 mt-1">24 Lingkungan</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Kelurahan Mangga Prima</p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* COMPACT CLASSIFIED NAVIGATION MENU HUB (Common for both styles, rendering at the bottom) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <LayoutGrid className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm sm:text-base">Pusat Navigasi &amp; Layanan Menu</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Temukan seluruh modul dengan cepat menggunakan pencarian atau kategori taktis.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama menu, deskripsi..."
              className="w-full pl-9.5 pr-4 py-2 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
        </div>

        {/* Beautifully Tidy Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: '🌟 Semua Menu' },
            { id: 'laporan', label: '📝 Pelaporan Harian' },
            { id: 'capaian', label: '📊 Target & Kinerja' },
            { id: 'absen', label: '👤 Absensi GPS' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-emerald-700 text-white shadow-xs scale-[1.02]'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Menu Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMenus.map((menu) => {
            const isSpecialGis = false;
            const unreadCount = unreadCounts?.[menu.id] ?? 0;
            const totalCountInfo = getMenuCountBadge(menu.id);

            return (
              <div
                key={menu.id}
                onClick={menu.action}
                className={`group p-4.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3.5 relative overflow-hidden ${
                  isSpecialGis
                    ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white border-emerald-600/70 hover:border-emerald-400 shadow-md hover:shadow-lg'
                    : 'bg-white border-slate-200/90 hover:border-emerald-500 hover:shadow-md'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold transition-transform group-hover:scale-110 shadow-xs ${
                  isSpecialGis
                    ? 'bg-emerald-800/80 border border-emerald-500/50 text-white'
                    : menu.iconBg || 'bg-emerald-50 text-emerald-600'
                }`}>
                  {typeof menu.icon === 'string' ? menu.icon : React.createElement(menu.icon, { className: 'w-5 h-5' })}
                </div>

                <div className="min-w-0 flex-1 pr-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`font-black text-xs sm:text-sm ${isSpecialGis ? 'text-emerald-300' : 'text-slate-800'}`}>
                      {menu.title}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider ${menu.badgeColor}`}>
                      {menu.badge}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${isSpecialGis ? 'text-slate-300' : 'text-slate-500'}`}>
                    {menu.desc}
                  </p>
                </div>

                {/* Sudut Kanan: Angka Menandakan Laporan Baru / Belum Dibuka Sejak Terakhir Aplikasi Dibuka */}
                <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2 min-w-[85px] pl-2 border-l border-slate-100/80">
                  {unreadCount > 0 ? (
                    <span
                      className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-600 text-white shadow-xs border border-rose-500 flex items-center gap-1 whitespace-nowrap animate-pulse group-hover:scale-105 transition-all"
                      title={`${unreadCount} laporan baru masuk sejak aplikasi/menu terakhir kali dibuka (Total: ${totalCountInfo.label})`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping shrink-0" />
                      <span>{unreadCount} Baru</span>
                    </span>
                  ) : (
                    <span
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 whitespace-nowrap group-hover:bg-emerald-50 group-hover:text-emerald-800 group-hover:border-emerald-300 transition-colors"
                      title={`0 laporan baru (semua laporan sudah dibuka). Total data: ${totalCountInfo.label}`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>0 Baru</span>
                    </span>
                  )}

                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors mt-auto">
                    <span>{totalCountInfo.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMenus.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-400 font-medium">Tidak ada menu atau layanan yang cocok dengan kata kunci "{searchQuery}".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

