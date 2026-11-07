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
  ClipboardList,
  LayoutGrid,
  Smartphone,
  UploadCloud as CloudUpload,
  Server,
  Database,
  Bell,
  Camera,
  UserCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'react-qr-code';
import {
  getTugasKhususList,
  addTugasKhusus,
  deleteTugasKhusus,
  updateTugasKhususStatus,
  TugasKhusus,
  subscribeTugasKhususFromFirestore,
  subscribeTugasKhususSubmissions,
  TugasFotoSubmissionItem,
  getTugasSubmissionsLocal,
} from '../lib/tugasKhususService';
import {
  saveSuperAdminDeviceDataToFirestore,
  syncSuperAdminDeviceDataToLiveFirestore,
  getSuperAdminDeviceDataSnapshot,
} from '../lib/appBackupService';
import {
  fetchSyncAuditLogs,
  SyncAuditLog,
  saveAttendanceQRToFirestore,
  subscribeAttendanceQRFromFirestore,
  AttendanceQREntity,
} from '../lib/firestoreService';
import {
  LaporanHarianItem,
  SheetMetadata,
  UserAccount,
  UserRole,
  TitikRumahBangunan,
  RuasJalanLingkungan,
  LingkunganPolygon,
  isPkkRole,
  AbsenApelItem,
} from '../types';
import { 
  KEPLING_ACCOUNTS, 
  ALL_ACCOUNTS,
  getDynamicAccounts, 
  addDynamicAccount, 
  deleteAccountById, 
  restoreAccountById,
  getDeletedAccountIds, 
  saveDeletedAccountIds,
  getAllEffectiveAccounts,
  syncAccountsWithServer 
} from '../data/keplingList';
import { KasiProfileManagerModal } from './KasiProfileManagerModal';
import {
  formatTanggalIndonesia,
  getTodayLocalIso,
  isReportMatchingKepling,
  isReportMatchingDate,
  getReportIsoDate,
} from '../lib/formatter';
import {
  AVAILABLE_PBB_YEARS,
  DEFAULT_PBB_YEAR,
  getLocalSpptForYear,
  computePbbOverview,
  formatRekapPbbWaText,
  subscribePbbSpptFromFirestore,
  fetchPbbSpptFromFirestore,
  subscribePbbSummary,
  getCachedPbbOverview,
  KelurahanPbbOverview,
} from '../lib/pbbService';
import { SpptPbbItem } from '../data/pbbSampleData';
import { RekapCapaianPbb24Lingkungan } from './RekapCapaianPbb24Lingkungan';
import { RekapAbsensiSuperAdmin } from './RekapAbsensiSuperAdmin';

interface MonitoringSuperAdminProps {
  reports: LaporanHarianItem[];
  onSelectReport: (report: LaporanHarianItem) => void;
  onDraftForKepling: (kepling: UserAccount) => void;
  onSwitchToRiwayat: (keplingName: string) => void;
  onOpenCredentialBook?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onResetReports?: () => Promise<void>;
  onOpenCapaianDashboard?: () => void;
  onOpenPbb?: () => void;
  sheetMeta?: SheetMetadata | null;
  attendanceList?: AbsenApelItem[];
  currentUser?: UserAccount;
}

export const MonitoringSuperAdmin: React.FC<MonitoringSuperAdminProps> = React.memo(({
  reports,
  onSelectReport,
  onDraftForKepling,
  onSwitchToRiwayat,
  onOpenCredentialBook,
  onRefresh,
  isRefreshing,
  onResetReports,
  onOpenCapaianDashboard,
  onOpenPbb,
  sheetMeta,
  attendanceList = [],
  currentUser,
}) => {
  const todayIso = getTodayLocalIso();

  // Tab mode for Monitoring Dashboard: Laporan Harian vs Presensi Apel vs Realisasi PBB vs Akun vs Tugas Khusus
  const [activeMainTab, setActiveMainTab] = useState<'LAPORAN' | 'PRESENSI' | 'PBB_REALISASI' | 'ACCOUNTS' | 'TUGAS_KHUSUS'>('LAPORAN');
  const [selectedPresensiDate, setSelectedPresensiDate] = useState<string>(todayIso);

  // Tugas Khusus Lurah states
  const [tugasList, setTugasList] = useState<TugasKhusus[]>(() => getTugasKhususList());
  const [tugasSubmissions, setTugasSubmissions] = useState<Record<string, TugasFotoSubmissionItem>>(() => getTugasSubmissionsLocal());
  const [viewingSubmission, setViewingSubmission] = useState<{ task: TugasKhusus; sub: TugasFotoSubmissionItem } | null>(null);
  const [taskJudul, setTaskJudul] = useState('');
  const [taskDeskripsi, setTaskDeskripsi] = useState('');
  const [taskTargetAccountId, setTaskTargetAccountId] = useState('ALL');
  const [taskDeadline, setTaskDeadline] = useState(todayIso);
  const [taskError, setTaskError] = useState('');
  const [taskSuccess, setTaskSuccess] = useState('');

  useEffect(() => {
    // 1. Initial cached values
    setTugasList(getTugasKhususList());
    setTugasSubmissions(getTugasSubmissionsLocal());

    // 2. Real-time Firestore sync
    const unsubTasks = subscribeTugasKhususFromFirestore((liveTasks) => {
      setTugasList(liveTasks);
    });
    const unsubSubs = subscribeTugasKhususSubmissions((liveSubs) => {
      setTugasSubmissions(liveSubs);
    });

    const handleTugasUpdate = () => {
      setTugasList(getTugasKhususList());
      setTugasSubmissions(getTugasSubmissionsLocal());
    };
    window.addEventListener('sikepling_tugas_khusus_updated', handleTugasUpdate);
    window.addEventListener('sikepling_tugas_khusus_submissions_updated', handleTugasUpdate);
    return () => {
      unsubTasks();
      unsubSubs();
      window.removeEventListener('sikepling_tugas_khusus_updated', handleTugasUpdate);
      window.removeEventListener('sikepling_tugas_khusus_submissions_updated', handleTugasUpdate);
    };
  }, []);

  const handleCreateTugas = (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    setTaskSuccess('');
    if (!taskJudul.trim() || !taskDeskripsi.trim()) {
      setTaskError('Judul dan Deskripsi Tugas Khusus wajib diisi.');
      return;
    }
    try {
      const isTargetPkkAll = taskTargetAccountId === 'ALL_PKK';
      const isTargetAllKepling = taskTargetAccountId === 'ALL';
      const targetAcc = accountsList.find((a) => a.id === taskTargetAccountId);
      const targetRole = isTargetPkkAll
        ? 'pkk'
        : isTargetAllKepling
        ? 'kepling'
        : targetAcc?.role || 'all';

      addTugasKhusus({
        judul: taskJudul.trim(),
        deskripsi: taskDeskripsi.trim(),
        targetAccountId: taskTargetAccountId,
        targetRole,
        pemberiTugas: isTargetPkkAll ? 'Lurah / Ketua TP-PKK' : 'Lurah Kelurahan Mangga',
        tanggalMulai: todayIso,
        deadline: taskDeadline || todayIso,
        status: 'aktif',
      });
      setTaskJudul('');
      setTaskDeskripsi('');
      setTaskTargetAccountId('ALL');
      setTaskSuccess('Tugas Khusus berhasil diterbitkan dan langsung tampil di perangkat target!');
      setTimeout(() => setTaskSuccess(''), 4000);
    } catch (err: any) {
      setTaskError(err.message || 'Gagal menyimpan tugas khusus.');
    }
  };

  // Account management states
  const [accountSubTab, setAccountSubTab] = useState<'KASI' | 'ALL'>('KASI');
  const [accountsList, setAccountsList] = useState<UserAccount[]>(() => getAllEffectiveAccounts());
  const [newUsername, setNewUsername] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newRole, setNewRole] = useState<'kepling' | 'kasi' | 'admin' | 'superadmin'>('kepling');
  const [newJabatan, setNewJabatan] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNomorLingkungan, setNewNomorLingkungan] = useState<number | ''>('');
  const [newTelepon, setNewTelepon] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'kepling' | 'kasi' | 'admin' | 'superadmin'>('ALL');

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
  const [summaryOverview, setSummaryOverview] = useState<KelurahanPbbOverview>(() => getCachedPbbOverview(pbbYear));
  const [isSyncingPbb, setIsSyncingPbb] = useState(false);
  const [pbbSearch, setPbbSearch] = useState<string>('');

  useEffect(() => {
    const unsubSummary = subscribePbbSummary(pbbYear, (ov) => {
      if (ov && ov.totalWp > 0) setSummaryOverview(ov);
    });
    setSpptList(getLocalSpptForYear(pbbYear));
    fetchPbbSpptFromFirestore(pbbYear).then((items) => {
      if (items && items.length > 0) setSpptList(items);
    }).catch(() => {});
    const unsub = subscribePbbSpptFromFirestore(pbbYear, (items) => {
      if (items && items.length > 0) setSpptList(items);
    });
    return () => {
      unsubSummary();
      unsub();
    };
  }, [pbbYear]);

  const handleManualSyncPbb = async () => {
    setIsSyncingPbb(true);
    try {
      const items = await fetchPbbSpptFromFirestore(pbbYear);
      if (items && items.length > 0) {
        setSpptList(items);
      }
    } catch {} finally {
      setIsSyncingPbb(false);
    }
  };

  const pbbOverview = useMemo(() => {
    if (spptList.length > 0) {
      return computePbbOverview(spptList, pbbYear);
    }
    return summaryOverview;
  }, [spptList, pbbYear, summaryOverview]);

  const [copiedPbbWaSuperAdmin, setCopiedPbbWaSuperAdmin] = useState(false);
  const handleCopyPbbWaSuperAdmin = () => {
    try {
      const text = formatRekapPbbWaText(pbbOverview, pbbYear);
      navigator.clipboard.writeText(text);
      setCopiedPbbWaSuperAdmin(true);
      setTimeout(() => setCopiedPbbWaSuperAdmin(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Extract all distinct dates available in reports, with report counts
  const availableDates = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    const dateCounts: Record<string, { count: number; dateStr: string; hari: string }> = {};
    reports.forEach((r) => {
      const iso = getReportIsoDate(r);
      if (iso) {
        if (dateCounts[iso]) {
          dateCounts[iso].count++;
        } else {
          dateCounts[iso] = {
            count: 1,
            dateStr: r.tanggal || iso,
            hari: r.hari || '',
          };
        }
      }
    });
    return Object.entries(dateCounts)
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'WAITING'>('ALL');
  const [displayLayout, setDisplayLayout] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Section: Generate QR Apel
  const [currentQR, setCurrentQR] = useState<AttendanceQREntity | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  useEffect(() => {
    const unsub = subscribeAttendanceQRFromFirestore(selectedDate, (qr) => {
      setCurrentQR(qr);
    });
    return () => unsub();
  }, [selectedDate]);

  const generateApelQR = async () => {
    setIsGeneratingQR(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const qrData: AttendanceQREntity = {
        id: `qr_${selectedDate}`,
        code: token,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        active: true,
        token,
        tanggal: selectedDate,
        createdAt: new Date().toISOString(),
        lat: 3.514234, // Kantor Lurah center
        lng: 98.633175, // Kantor Lurah center
      };
      await saveAttendanceQRToFirestore(qrData);
    } catch (e) {
      console.error('Failed to generate QR:', e);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // States for local device synchronization & backup to Firestore
  const [isDeviceSyncModalOpen, setIsDeviceSyncModalOpen] = useState(false);
  const [deviceSyncProgress, setDeviceSyncProgress] = useState('');
  const [deviceSyncError, setDeviceSyncError] = useState('');
  const [deviceSyncSuccess, setDeviceSyncSuccess] = useState('');
  const [deviceBackupStats, setDeviceBackupStats] = useState<any>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isPushingLive, setIsPushingLive] = useState(false);
  const [syncAuditLogs, setSyncAuditLogs] = useState<SyncAuditLog[]>([]);

  // Load local device metrics when sync modal opens
  useEffect(() => {
    if (isDeviceSyncModalOpen) {
      setDeviceSyncProgress('Menghitung data lokal perangkat...');
      setDeviceSyncError('');
      setDeviceSyncSuccess('');
      
      getSuperAdminDeviceDataSnapshot()
        .then((snapshot) => {
          setDeviceBackupStats(snapshot.summary);
          setDeviceSyncProgress('');
        })
        .catch((err) => {
          console.error(err);
          setDeviceSyncError('Gagal memuat data lokal perangkat');
          setDeviceSyncProgress('');
        });

      // Load device sync audit logs
      fetchSyncAuditLogs()
        .then((logs) => {
          setSyncAuditLogs(logs);
        })
        .catch((err) => {
          console.error('Gagal memuat audit log sinkronisasi:', err);
        });
    } else {
      setDeviceBackupStats(null);
    }
  }, [isDeviceSyncModalOpen]);

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
      if (statusFilter === 'WAITING' && isSubmitted) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = k.nama.toLowerCase().includes(term);
        const matchesLingkungan = k.lingkungan.toLowerCase().includes(term);
        const matchesJabatan = k.jabatan ? k.jabatan.toLowerCase().includes(term) : false;
        return matchesName || matchesLingkungan || matchesJabatan;
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
    text += `📊 Progress: ${stats.submittedCount}/${stats.totalKepling} Lingkungan (${stats.completionPct}%)\n`;
    text += `🔴 Belum Melapor: ${stats.pendingCount} Kepling\n\n`;
    text += `*STATUS PELAPORAN 24 LINGKUNGAN:*\n`;

    KEPLING_ACCOUNTS.forEach((k) => {
      const rep = activeKeplingReportMap.get(k.id);
      if (rep) {
        const tglText = rep.tanggal ? ` [${rep.tanggal}]` : '';
        text += `✅ ${k.lingkungan} (${k.nama})${tglText} - SUDAH LAPOR\n`;
        text += `   - PBB: ${rep.kinerja?.opsirPbbWp || 0} WP | Perlinsos: ${rep.kinerja?.perlinsosKk || 0} KK | IKD: ${rep.kinerja?.ikdOrang || 0} Jiwa | BPJS: ${rep.kinerja?.bpjsKetenagakerjaanOrang || 0} Jiwa\n`;
      } else {
        text += `🔴 ${k.lingkungan} (${k.nama}) - BELUM MELAPOR\n`;
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
              <p className="text-xs text-slate-300 font-normal mt-0.5 flex flex-wrap items-center gap-2">
                <span>Kelurahan Mangga • Kecamatan Medan Tuntungan • Total Database: <strong>{reports.length} Laporan</strong></span>
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-900/80 px-2 py-0.5 rounded-full border border-emerald-500/40 inline-flex items-center gap-1 shadow-sm">
                  ⚡ Auto-Simpan HP Aktif (IndexedDB Fast Cache)
                </span>
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

            <button
              type="button"
              onClick={() => setActiveMainTab('TUGAS_KHUSUS')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-xs font-bold transition-colors cursor-pointer shadow-xs animate-pulse"
              title="Buat dan kelola Tugas Khusus dari Lurah"
            >
              <Bell className="w-4 h-4 text-rose-300" />
              <span>Tugas Khusus Lurah</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeviceSyncModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 border border-indigo-400/40 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Sinkronisasikan data HP/Laptop lokal Anda ke Firestore Cloud"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-300" />
              <span>Sinkronisasi HP/Laptop</span>
            </button>

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

      {/* Main Monitoring Tab Switcher (Laporan Harian vs Realisasi PBB vs Akun) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 p-1.5 bg-slate-800 rounded-2xl border border-slate-700 shadow-2xs overflow-hidden max-w-full mb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab('LAPORAN')}
          className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer snap-start shrink-0 ${
            activeMainTab === 'LAPORAN'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
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
          onClick={() => setActiveMainTab('PRESENSI')}
          className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer snap-start shrink-0 ${
            activeMainTab === 'PRESENSI'
              ? 'bg-teal-600 text-white shadow-sm border border-teal-500'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4 text-teal-300" />
          <span>Hasil Presensi Apel</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
            activeMainTab === 'PRESENSI'
              ? 'bg-white/20 text-white'
              : 'bg-teal-100 text-teal-800'
          }`}>
            24 Kepling
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('PBB_REALISASI')}
          className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer snap-start shrink-0 ${
            activeMainTab === 'PBB_REALISASI'
              ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
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
          onClick={() => setActiveMainTab('ACCOUNTS')}
          className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer snap-start shrink-0 ${
            activeMainTab === 'ACCOUNTS'
              ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-300" />
          <span>Kelola Akun & Username</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
            activeMainTab === 'ACCOUNTS'
              ? 'bg-white/20 text-white'
              : 'bg-indigo-100 text-indigo-800'
          }`}>
            {accountsList.length} Akun
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('TUGAS_KHUSUS')}
          className={`flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer snap-start shrink-0 ${
            activeMainTab === 'TUGAS_KHUSUS'
              ? 'bg-rose-600 text-white shadow-sm border border-rose-500'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Bell className="w-4 h-4 text-rose-300" />
          <span>Tugas Khusus Lurah</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
            activeMainTab === 'TUGAS_KHUSUS'
              ? 'bg-white/20 text-white'
              : 'bg-rose-100 text-rose-800'
          }`}>
            {tugasList.filter(t => t.status === 'aktif').length} Aktif
          </span>
        </button>
      </div>

      {activeMainTab === 'LAPORAN' && (
        <>
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

      {/* Control Bar: Layout Toggle, Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              id="filter-all-status"
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({KEPLING_ACCOUNTS.length})
            </button>
            <button
              id="filter-submitted-status"
              type="button"
              onClick={() => setStatusFilter('SUBMITTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'SUBMITTED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>🟢 Sudah Lapor ({stats.submittedCount})</span>
            </button>
            <button
              id="filter-waiting-status"
              type="button"
              onClick={() => setStatusFilter('WAITING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'WAITING'
                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
              title="Kepling yang belum mengirim laporan harian"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>🔴 Belum Melapor ({stats.pendingCount})</span>
            </button>
          </div>

          {/* Layout Toggle (Tabel Monitoring vs Kartu) & Search */}
          <div className="flex items-center gap-2">
            {/* View Layout Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setDisplayLayout('TABLE')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  displayLayout === 'TABLE'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan dalam tabel monitoring terstruktur"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Tabel Monitoring</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayLayout('CARDS')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  displayLayout === 'CARDS'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan dalam bentuk kartu grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu Grid</span>
              </button>
            </div>

            {/* Search Kepling Name / Lingkungan */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-monitor"
                type="text"
                placeholder="Cari Lingkungan / Nama Kepling..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RENDER LAYOUT 1: TABEL MONITORING SUPER ADMIN */}
      {displayLayout === 'TABLE' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <h3 className="font-extrabold text-sm tracking-tight text-white">
                Tabel Monitoring Status Pelaporan 24 Kepling
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-300">
              Menampilkan {filteredList.length} dari 24 Kepling
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center">Lingkungan</th>
                  <th className="py-3 px-4">Nama Kepling &amp; Jabatan</th>
                  <th className="py-3 px-4 text-center">Status Pelaporan Harian</th>
                  <th className="py-3 px-4 text-center">Waktu Kirim</th>
                  <th className="py-3 px-4">Ringkasan Kinerja Harian</th>
                  <th className="py-3 px-4 text-right">Aksi Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map((kepling) => {
                  const report = activeKeplingReportMap.get(kepling.id);
                  const hasReported = Boolean(report);
                  const latestReportAnytime = keplingLatestReportMap.get(kepling.id);

                  return (
                    <tr
                      key={kepling.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasReported ? 'bg-white' : 'bg-rose-50/20'
                      }`}
                    >
                      {/* Lingkungan Number */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-900 text-white font-black text-xs shadow-2xs">
                          {kepling.nomorLingkungan}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                          Lk. {kepling.nomorLingkungan}
                        </div>
                      </td>

                      {/* Kepling Name & Mapped House */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-xs sm:text-sm">
                          {kepling.nama}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {kepling.jabatan}
                        </div>
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-3.5 px-4 text-center">
                        {hasReported ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>SUDAH LAPOR</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold mt-1">
                              {viewMode === 'LATEST_PER_KEPLING' ? (report.tanggal || 'Ada Data') : 'Laporan Diterima'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white border border-rose-700 shadow-sm">
                              <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                              <span>BELUM MELAPOR</span>
                            </span>
                            <span className="text-[10px] text-rose-700 font-medium mt-1">
                              Belum Ada Laporan
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Time / Date Submitted */}
                      <td className="py-3.5 px-4 text-center text-[11px]">
                        {hasReported && report ? (
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {report.createdAt ? new Date(report.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '18:30'} WIB
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {report.tanggal || 'Hari Ini'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Performance Summary */}
                      <td className="py-3.5 px-4">
                        {hasReported && report ? (
                          <div className="flex flex-wrap items-center gap-1 text-[11px]">
                            <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                              PBB: {report.kinerja?.opsirPbbWp || 0} WP
                            </span>
                            <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200 font-bold">
                              Perlinsos: {report.kinerja?.perlinsosKk || 0} KK
                            </span>
                            <span className="bg-purple-50 text-purple-900 px-2 py-0.5 rounded border border-purple-200 font-bold">
                              IKD: {report.kinerja?.ikdOrang || 0} Jiwa
                            </span>
                            <span className="bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200 font-bold">
                              BPJS: {report.kinerja?.bpjsKetenagakerjaanOrang || 0} Jiwa
                            </span>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px] italic">
                            {latestReportAnytime
                              ? `Laporan terakhir dikirim: ${latestReportAnytime.tanggal || 'Sebelumnya'}`
                              : 'Belum ada catatan laporan.'}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasReported && report ? (
                            <button
                              id={`btn-view-report-tbl-${kepling.id}`}
                              type="button"
                              onClick={() => onSelectReport(report)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                            >
                              Detail
                            </button>
                          ) : (
                            <button
                              id={`btn-draft-report-tbl-${kepling.id}`}
                              type="button"
                              onClick={() => onDraftForKepling(kepling)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>Inputkan</span>
                            </button>
                          )}
                          <button
                            id={`btn-history-kepling-tbl-${kepling.id}`}
                            type="button"
                            onClick={() => onSwitchToRiwayat(kepling.nama)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Riwayat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RENDER LAYOUT 2: GRID OF 24 LINGKUNGAN CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-fade-in">
        {filteredList.map((kepling) => {
          const report = activeKeplingReportMap.get(kepling.id);
          const hasReported = Boolean(report);
          const latestReportAnytime = keplingLatestReportMap.get(kepling.id);

          return (
            <div
              key={kepling.id}
              className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                hasReported
                  ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-2xs'
                  : 'bg-rose-50/20 border-rose-200 hover:border-rose-300 shadow-2xs'
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{viewMode === 'LATEST_PER_KEPLING' ? (report.tanggal || 'Ada Laporan') : 'SUDAH LAPOR'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 shadow-xs">
                      <AlertCircle className="w-3 h-3 text-white" />
                      <span>BELUM MELAPOR</span>
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
      )}

      {filteredList.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
          Tidak ada data Kepala Lingkungan yang memenuhi kriteria filter saat ini.
        </div>
      )}
      </>
      )}

      {activeMainTab === 'PRESENSI' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <RekapAbsensiSuperAdmin
            attendanceList={attendanceList}
            currentUser={currentUser || (ALL_ACCOUNTS[0] as UserAccount)}
            selectedDate={selectedPresensiDate}
            onDateChange={setSelectedPresensiDate}
          />
        </div>
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

                {/* Tombol Sinkronkan Data Realtime */}
                <button
                  type="button"
                  onClick={handleManualSyncPbb}
                  disabled={isSyncingPbb}
                  title="Sinkronkan data PBB dari Server Buffer & Cloud Firestore"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold border border-emerald-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPbb ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
                  <span>{isSyncingPbb ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                </button>

                {/* Tombol Salin Rekap PBB WA */}
                <button
                  type="button"
                  onClick={handleCopyPbbWaSuperAdmin}
                  title="Salin rekapitulasi capaian persentase PBB 24 Lingkungan ke format WhatsApp"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer ${
                    copiedPbbWaSuperAdmin
                      ? 'bg-emerald-400 text-slate-950 scale-102 ring-2 ring-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/60'
                  }`}
                >
                  {copiedPbbWaSuperAdmin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-emerald-200" />}
                  <span>{copiedPbbWaSuperAdmin ? 'Tersalin!' : 'Salin Rekap PBB WA'}</span>
                </button>

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
                <span className="text-sm sm:text-base font-black text-white block mt-1 tracking-tight truncate whitespace-nowrap">{formatRupiah(pbbOverview.totalTargetNominal)}</span>
              </div>
              <div className="bg-emerald-900/50 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/40">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">Realisasi (Lunas)</span>
                <span className="text-sm sm:text-base font-black text-amber-300 block mt-1 tracking-tight truncate whitespace-nowrap">{formatRupiah(pbbOverview.totalRealisasiNominal)}</span>
                <div className="flex items-center justify-between text-[11px] text-emerald-200 mt-1">
                  <span>Capaian:</span>
                  <span className="font-bold text-white">{pbbOverview.persentaseRealisasiNominal.toFixed(2)}%</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">Sisa Belum Bayar</span>
                <span className="text-sm sm:text-base font-black text-rose-200 block mt-1 tracking-tight truncate whitespace-nowrap">{formatRupiah(pbbOverview.totalSisaNominal)}</span>
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

          {/* Rekap Total Capaian PBB 24 Lingkungan (Grid & Tabel Persentase) */}
          <RekapCapaianPbb24Lingkungan
            overview={pbbOverview}
            selectedYear={pbbYear}
            onSelectLingkungan={() => {
              if (onOpenPbb) onOpenPbb();
            }}
            defaultViewMode="grid"
          />

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
                            lk.persentaseRealisasi >= 75 ? 'bg-emerald-100 text-emerald-700' : 
                            lk.persentaseRealisasi >= 50 ? 'bg-amber-100 text-amber-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {lk.persentaseRealisasi.toFixed(1)}%
                          </span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                lk.persentaseRealisasi >= 75 ? 'bg-emerald-500' : 
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

      {activeMainTab === 'ACCOUNTS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-violet-950 rounded-2xl p-5 sm:p-6 text-white border border-indigo-800/50 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold shadow-inner shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                      Manajemen Akun Pengguna
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-indigo-200 px-2 py-0.5 rounded border border-white/15">
                      Kelola Hak Akses & Kredensial
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                    Kelola Akun Login & Kredensial Username
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Tambah akun kustom baru, kelola password, atau nonaktifkan akses bagi Kepala Lingkungan dan Kasi Kelurahan Mangga.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Switcher inside ACCOUNTS */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-800/60 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setAccountSubTab('KASI')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                accountSubTab === 'KASI'
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Struktur Kepala Seksi & Bidang Tugas</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                accountSubTab === 'KASI' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-900'
              }`}>
                3 Seksi
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAccountSubTab('ALL')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                accountSubTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Daftar Akun Kepling & Kustom</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                accountSubTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {accountsList.length} Akun
              </span>
            </button>
          </div>

          {accountSubTab === 'KASI' ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <KasiProfileManagerModal
                embedded={true}
                onRefresh={() => setAccountsList(getAllEffectiveAccounts())}
              />
            </div>
          ) : (
            <>
              {/* Feedback Messages */}
              {accountError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{accountError}</span>
                </div>
              )}
              {accountSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{accountSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* COLUMN 1: Form Tambah Akun */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-800 text-sm">Tambah Akun Login Baru</h4>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                setAccountError('');
                setAccountSuccess('');

                const usernameClean = newUsername.trim().toLowerCase().replace(/[\s\-_.]+/g, '_');
                if (!usernameClean) {
                  setAccountError('Username tidak boleh kosong!');
                  return;
                }
                if (usernameClean.length < 3) {
                  setAccountError('Username minimal 3 karakter!');
                  return;
                }
                if (!newNama.trim()) {
                  setAccountError('Nama Lengkap tidak boleh kosong!');
                  return;
                }
                if (!newPassword.trim()) {
                  setAccountError('Kata sandi tidak boleh kosong!');
                  return;
                }

                // Check duplicate ID
                const allEff = getAllEffectiveAccounts();
                const exists = allEff.some((a) => a.id.toLowerCase() === usernameClean);
                if (exists) {
                  setAccountError(`Username "${usernameClean}" sudah digunakan! Coba yang lain.`);
                  return;
                }

                const romanMap: Record<number, string> = {
                  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
                  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV', 16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX',
                  21: 'XXI', 22: 'XXII', 23: 'XXIII', 24: 'XXIV'
                };
                const getRoman = (num: number) => romanMap[num] || String(num);

                const newAccount: UserAccount = {
                  id: usernameClean,
                  role: newRole as UserRole,
                  nama: newNama.trim(),
                  jabatan: newJabatan.trim() || (newRole === 'kepling' ? `Kepala Lingkungan ${newNomorLingkungan || ''}` : `Staf Kasi`),
                  kelurahan: 'Kelurahan Mangga',
                  kecamatan: 'Kecamatan Medan Tuntungan',
                  password: newPassword.trim(),
                  nomorLingkungan: newRole === 'kepling' && newNomorLingkungan ? Number(newNomorLingkungan) : undefined,
                  lingkungan: newRole === 'kepling' && newNomorLingkungan ? `Lingkungan ${getRoman(Number(newNomorLingkungan))}` : undefined,
                  telepon: newTelepon.trim() || undefined,
                };

                addDynamicAccount(newAccount);
                setAccountsList(getAllEffectiveAccounts());

                // Clear Form
                setNewUsername('');
                setNewNama('');
                setNewRole('kepling');
                setNewJabatan('');
                setNewPassword('');
                setNewNomorLingkungan('');
                setNewTelepon('');
                setAccountSuccess(`Akun login "${usernameClean}" berhasil ditambahkan!`);
              }} className="space-y-3.5 text-xs text-slate-700">
                {/* Peran / Role */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peran / Hak Akses</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as any;
                      setNewRole(r);
                      if (r !== 'kepling') {
                        setNewNomorLingkungan('');
                        setNewJabatan(r === 'kasi' ? 'Staf Kasi' : r === 'superadmin' ? 'Superadmin' : 'Staf Admin');
                      } else {
                        setNewJabatan('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="kepling">Kepala Lingkungan (Kepling)</option>
                    <option value="kasi">Kasi Kelurahan (PBB / Perlinsos / Trantibum)</option>
                    <option value="admin">Staf Admin Kelurahan</option>
                    <option value="superadmin">Super Admin / Lurah</option>
                  </select>
                </div>

                {/* Username / ID */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username Login (Gunakan Huruf Kecil & Tanpa Spasi)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: kepling_25 atau roni_purba"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Username akan digunakan untuk masuk ke dalam aplikasi.</p>
                </div>

                {/* Nama Lengkap */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Pemegang Akun</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Roni Purba, S.H."
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Nomor Lingkungan (Hanya jika Kepling) */}
                {newRole === 'kepling' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor Lingkungan (Angka)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      placeholder="Contoh: 25"
                      value={newNomorLingkungan}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewNomorLingkungan(val === '' ? '' : Number(val));
                        if (val) {
                          setNewJabatan(`Kepala Lingkungan ${val}`);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                )}

                {/* Jabatan Resmi */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan Resmi (Otomatis / Kustom)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Kepala Lingkungan XXV atau Staff Pembangunan"
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Kata Sandi */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kata Sandi / Password Akses</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: mangga25 atau roni123"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Nomor Telepon / WA */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor WA / Telepon (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={newTelepon}
                    onChange={(e) => setNewTelepon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md transition-colors cursor-pointer mt-2 flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Daftarkan Akun Pengguna</span>
                </button>
              </form>
            </div>

            {/* COLUMN 2: Daftar Akun Login */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Daftar Akun Login Aktif</h4>
                </div>
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Cari username atau nama..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRoleFilter('ALL')}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                    roleFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua ({accountsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('superadmin')}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                    roleFilter === 'superadmin' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('kasi')}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                    roleFilter === 'kasi' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Kasi
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('kepling')}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                    roleFilter === 'kepling' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Kepling
                </button>
              </div>

              {/* Accounts Cards List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {accountsList
                  .filter((a) => {
                    const matchesSearch = 
                      a.id.toLowerCase().includes(accountSearch.toLowerCase()) ||
                      a.nama.toLowerCase().includes(accountSearch.toLowerCase()) ||
                      (a.jabatan && a.jabatan.toLowerCase().includes(accountSearch.toLowerCase()));
                    const matchesRole = roleFilter === 'ALL' || a.role === roleFilter;
                    return matchesSearch && matchesRole;
                  })
                  .map((acc) => {
                    // Check if it is a dynamic (custom) account
                    const isCustom = getDynamicAccounts().some((d) => d.id.toLowerCase() === acc.id.toLowerCase());

                    return (
                      <div key={acc.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 hover:border-indigo-150 rounded-xl transition-all text-xs">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                            acc.role === 'super_admin' ? 'bg-rose-100 text-rose-800' :
                            (acc.role as string) === 'kasi' ? 'bg-amber-100 text-amber-800' :
                            (acc.role as string) === 'admin' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {acc.role === 'super_admin' ? 'SA' : (acc.role as string) === 'kasi' ? 'KS' : 'KP'}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-800">{acc.nama}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                isCustom ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {isCustom ? 'KUSTOM' : 'BAWAAN'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">{acc.jabatan}</p>
                            <div className="flex items-center gap-2.5 mt-1 text-[11px] font-mono text-slate-600 bg-white border border-slate-100 px-2 py-0.5 rounded-md w-fit">
                              <span>User: <strong className="text-indigo-600 select-all">{acc.id}</strong></span>
                              <span>•</span>
                              <span>Pass: <strong className="text-slate-800 select-all">{acc.password || 'Mati / Diubah'}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Delete Button (Can delete custom, and soft-delete built-in) */}
                        {acc.id !== 'super_admin' && acc.id !== 'fery_arapenta' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Apakah Anda yakin ingin menonaktifkan / menghapus akun "${acc.id}"?`)) {
                                deleteAccountById(acc.id);
                                setAccountsList(getAllEffectiveAccounts());
                                setAccountSuccess(`Akun "${acc.id}" berhasil dinonaktifkan / dihapus.`);
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-colors cursor-pointer shrink-0"
                            title="Hapus / Nonaktifkan Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                {accountsList.filter((a) => {
                  const matchesSearch = 
                    a.id.toLowerCase().includes(accountSearch.toLowerCase()) ||
                    a.nama.toLowerCase().includes(accountSearch.toLowerCase()) ||
                    (a.jabatan && a.jabatan.toLowerCase().includes(accountSearch.toLowerCase()));
                  const matchesRole = roleFilter === 'ALL' || a.role === roleFilter;
                  return matchesSearch && matchesRole;
                }).length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Tidak ada akun login yang sesuai dengan kriteria pencarian.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: Akun Bawaan yang Dinonaktifkan (Untuk Pemulihan) */}
          {ALL_ACCOUNTS.filter(a => getDeletedAccountIds().includes(a.id)).length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Akun Bawaan Sistem yang Sedang Dinonaktifkan</h4>
                  <p className="text-[11px] text-slate-400">Akun-akun bawaan berikut disembunyikan dari daftar login. Anda dapat mengaktifkannya kembali kapan saja.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ALL_ACCOUNTS
                  .filter(a => getDeletedAccountIds().includes(a.id))
                  .map((acc) => (
                    <div key={acc.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{acc.nama}</p>
                        <p className="text-[10px] text-slate-400 font-mono">User: {acc.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          restoreAccountById(acc.id);
                          setAccountsList(getAllEffectiveAccounts());
                          setAccountSuccess(`Akun bawaan "${acc.nama}" berhasil diaktifkan kembali!`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
                      >
                        Pulihkan
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
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

      {/* Device Sync & Backup Modal */}
      {isDeviceSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-sm sm:text-base text-white">Sinkronisasi Data HP / Laptop Lokal</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSavingSnapshot && !isPushingLive) {
                    setIsDeviceSyncModalOpen(false);
                  }
                }}
                disabled={isSavingSnapshot || isPushingLive}
                className="text-white/80 hover:text-white cursor-pointer disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs text-slate-600 overflow-y-auto flex-1">
              <div className="p-3.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-xl space-y-1.5 leading-relaxed">
                <p className="font-bold">📱 Penyelarasan & Cadangan Data Perangkat</p>
                <p>
                  Fitur ini mengambil data terbaru yang saat ini tersimpan di browser (IndexedDB / LocalStorage) laptop atau HP Anda, lalu menyimpannya ke Cloud Firestore. Ini sangat bermanfaat jika Anda melakukan pembaruan secara offline atau dari aplikasi versi lama.
                </p>
              </div>

              {/* Loader for first count */}
              {deviceSyncProgress && !isSavingSnapshot && !isPushingLive && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-indigo-600">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                  <p className="font-bold">{deviceSyncProgress}</p>
                </div>
              )}

              {/* Error Alert */}
              {deviceSyncError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold">
                  ⚠️ {deviceSyncError}
                </div>
              )}

              {/* Success Alert */}
              {deviceSyncSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-1.5 animate-in zoom-in-95 whitespace-pre-line">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Berhasil!
                  </p>
                  <p>{deviceSyncSuccess}</p>
                </div>
              )}

              {/* Data Statistics Panel */}
              {deviceBackupStats && !deviceSyncProgress && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Data Terdeteksi di HP / Laptop Anda:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Laporan Harian</span>
                      <span className="text-base font-black text-slate-800">{deviceBackupStats.reportsCount} <span className="text-[10px] font-medium text-slate-500">item</span></span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Data Keluarga</span>
                      <span className="text-base font-black text-slate-800">{deviceBackupStats.familyCount} <span className="text-[10px] font-medium text-slate-500">KK</span></span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Realisasi PBB</span>
                      <span className="text-base font-black text-slate-800">{deviceBackupStats.pbbCount} <span className="text-[10px] font-medium text-slate-500">SPPT</span></span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Kunjungan Warga</span>
                      <span className="text-base font-black text-slate-800">{deviceBackupStats.visitsCount} <span className="text-[10px] font-medium text-slate-500">item</span></span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Administrasi PKK</span>
                      <span className="text-base font-black text-slate-800">
                        {deviceBackupStats.pkkKeuanganCount + deviceBackupStats.pkkKegiatanCount + deviceBackupStats.pkkDasaWismaCount} <span className="text-[10px] font-medium text-slate-500">item</span>
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">WebGIS Spasial</span>
                      <span className="text-base font-black text-slate-800">
                        {deviceBackupStats.polygonsCount + deviceBackupStats.housesCount + deviceBackupStats.roadsCount} <span className="text-[10px] font-medium text-slate-500">fitur</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Log Sinkronisasi Terakhir */}
              {syncAuditLogs && syncAuditLogs.length > 0 && (
                <div className="space-y-2.5 pt-4 border-t border-slate-200">
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Riwayat Sinkronisasi Perangkat Terakhir (Audit Log):
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {syncAuditLogs.map((log: any, idx) => (
                      <div key={log.id || log.deviceId || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-700 text-xs truncate max-w-[200px]" title={log.deviceId || log.id}>
                            📱 ID: {log.deviceId || log.id || `Log-${idx}`} {log.deviceId === localStorage.getItem('sikepling_device_id') && <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[8px] font-bold ml-1">Perangkat Ini</span>}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status === 'success' ? 'Sukses' : 'Gagal'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium">
                          <div>
                            Terakhir Sinkron: <span className="font-bold text-slate-700">{log.lastSyncAt || log.timestamp || '-'}</span>
                          </div>
                          <div>
                            Operator: <span className="font-bold text-indigo-700">{log.operatorName || log.actor || 'Super Admin'}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Data Terunggah: <span className="font-extrabold text-indigo-800">{log.action || 'Audit'}</span> {log.summary ? `(${typeof log.summary === 'string' ? log.summary : JSON.stringify(log.summary)})` : ''}
                        </div>
                        {log.deviceInfo && (
                          <div className="text-[9px] text-slate-400 italic truncate" title={typeof log.deviceInfo === 'string' ? log.deviceInfo : JSON.stringify(log.deviceInfo)}>
                            Device: {typeof log.deviceInfo === 'string' ? log.deviceInfo : JSON.stringify(log.deviceInfo)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Indicators */}
              {(isSavingSnapshot || isPushingLive) && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col items-center justify-center gap-3 py-6 animate-pulse">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                  <div className="space-y-1 text-center">
                    <p className="font-black text-indigo-900 text-xs">
                      {isSavingSnapshot ? 'Sedang Membuat Snapshot Cadangan...' : 'Sedang Menyinkronkan Data...'}
                    </p>
                    <p className="text-[11px] text-indigo-700 italic font-medium">{deviceSyncProgress}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsDeviceSyncModalOpen(false)}
                disabled={isSavingSnapshot || isPushingLive}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                Tutup
              </button>

              {/* Action 1: Create Backup snapshot */}
              <button
                type="button"
                disabled={isSavingSnapshot || isPushingLive || !deviceBackupStats}
                onClick={async () => {
                  setIsSavingSnapshot(true);
                  setDeviceSyncProgress('Mengambil snapshot data lokal...');
                  setDeviceSyncError('');
                  setDeviceSyncSuccess('');
                  const res = await saveSuperAdminDeviceDataToFirestore('Super Admin (Manual Sync)');
                  if (res.success) {
                    setDeviceSyncSuccess(res.message);
                    fetchSyncAuditLogs().then(setSyncAuditLogs).catch(console.error);
                  } else {
                    setDeviceSyncError(res.message);
                  }
                  setIsSavingSnapshot(false);
                  setDeviceSyncProgress('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Menyimpan snapshot data lokal ke folder cadangan Firestore tanpa menimpa data live"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Simpan File Cadangan</span>
              </button>

              {/* Action 2: Sync directly to Live Database */}
              <button
                type="button"
                disabled={isSavingSnapshot || isPushingLive || !deviceBackupStats}
                onClick={async () => {
                  if (window.confirm('Apakah Anda yakin ingin menyinkronkan seluruh data perangkat lokal ke database live di Firestore? Data lama yang bentrok akan diperbarui.')) {
                    setIsPushingLive(true);
                    setDeviceSyncError('');
                    setDeviceSyncSuccess('');
                    const res = await syncSuperAdminDeviceDataToLiveFirestore((msg) => {
                      setDeviceSyncProgress(msg);
                    });
                    if (res.success) {
                      fetchSyncAuditLogs().then(setSyncAuditLogs).catch(console.error);
                      setDeviceSyncSuccess(
                        `${res.message}\n\n` +
                        `• Laporan Harian: ${res.stats.reports.synced}/${res.stats.reports.total} berhasil\n` +
                        `• Data Keluarga: ${res.stats.family.synced}/${res.stats.family.total} berhasil\n` +
                        `• PBB SPPT: ${res.stats.pbb.synced}/${res.stats.pbb.total} berhasil\n` +
                        `• Kunjungan: ${res.stats.visits.synced}/${res.stats.visits.total} berhasil\n` +
                        `• PKK Keuangan: ${res.stats.pkkKeuangan.synced}/${res.stats.pkkKeuangan.total} berhasil\n` +
                        `• PKK Kegiatan: ${res.stats.pkkKegiatan.synced}/${res.stats.pkkKegiatan.total} berhasil\n` +
                        `• Dasa Wisma: ${res.stats.pkkDasaWisma.synced}/${res.stats.pkkDasaWisma.total} berhasil\n` +
                        `• Surat: ${res.stats.surat.synced}/${res.stats.surat.total} berhasil\n` +
                        `• Peta Poligon: ${res.stats.polygons.synced}/${res.stats.polygons.total} berhasil\n` +
                        `• Peta Rumah: ${res.stats.houses.synced}/${res.stats.houses.total} berhasil\n` +
                        `• Peta Jalan: ${res.stats.roads.synced}/${res.stats.roads.total} berhasil`
                      );
                    } else {
                      setDeviceSyncError(res.message);
                    }
                    setIsPushingLive(false);
                    setDeviceSyncProgress('');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Unggah dan sinkronkan data lokal langsung ke koleksi database live Firestore"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Penyelarasan Live (Push To Cloud)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === 'TUGAS_KHUSUS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-pink-950 rounded-2xl p-5 sm:p-6 text-white border border-rose-800/50 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center font-bold shadow-inner shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-rose-500 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                      Instruksi & Tugas Khusus Lurah
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-rose-200 px-2 py-0.5 rounded border border-white/15">
                      Pemberitahuan Pop-Up Real-Time
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
                    Buat & Kirim Tugas Khusus ke Kepala Lingkungan
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Pesan, perintah, atau tugas khusus yang Anda terbitkan di sini akan langsung tampil sebagai Pop-Up Banner kuning di perangkat akun Kepala Lingkungan atau seluruh staf terkait.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Create Tugas Khusus */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-rose-600" /> Form Penerbitan Tugas Khusus Baru
            </h4>

            {taskError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {taskError}
              </div>
            )}
            {taskSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {taskSuccess}
              </div>
            )}

            <form onSubmit={handleCreateTugas} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Tugas / Perintah *</label>
                <input
                  type="text"
                  value={taskJudul}
                  onChange={(e) => setTaskJudul(e.target.value)}
                  placeholder="Contoh: Pendataan Tambahan Warga Rentan & Lansia Lk. IV"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi & Instruksi Detail dari Lurah *</label>
                <textarea
                  rows={3}
                  value={taskDeskripsi}
                  onChange={(e) => setTaskDeskripsi(e.target.value)}
                  placeholder="Tuliskan detail instruksi, sasaran, atau catatan khusus yang harus dikerjakan oleh penerima tugas..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Sasaran Penerima</label>
                <select
                  value={taskTargetAccountId}
                  onChange={(e) => setTaskTargetAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                >
                  <option value="ALL">📢 Semua Kepala Lingkungan (Broadcast Kepling)</option>
                  <option value="ALL_PKK">🌸 Semua Pengurus TP-PKK (Broadcast PKK)</option>
                  <optgroup label="Pengurus & Anggota TP-PKK">
                    {accountsList.filter(a => isPkkRole(a.role)).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        🌸 {acc.nama} ({acc.jabatan || acc.id})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kepala Lingkungan (Kepling 1-24)">
                    {accountsList.filter(a => a.role === 'kepling').map(acc => (
                      <option key={acc.id} value={acc.id}>
                        📍 {acc.nama} ({acc.jabatan || acc.id})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deadline / Batas Waktu</label>
                <input
                  type="date"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" /> Terbitkan & Kirim Tugas Khusus
                </button>
              </div>
            </form>
          </div>

          {/* List of Published Tugas Khusus */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" /> Riwayat Tugas Khusus Diterbitkan ({tugasList.length})
              </h4>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Tersinkronisasi Real-Time ke Seluruh HP
              </span>
            </div>

            {tugasList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Belum ada Tugas Khusus yang diterbitkan. Silakan buat melalui form di atas.
              </div>
            ) : (
              <div className="space-y-3">
                {tugasList.map((t) => {
                  const targetName = t.targetAccountId === 'ALL'
                    ? 'Semua Kepala Lingkungan (Broadcast)'
                    : accountsList.find(a => a.id === t.targetAccountId)?.nama || t.targetAccountId;
                  const submission = tugasSubmissions[t.id];
                  const completedNames = (t.completedBy || []).map(id => {
                    return accountsList.find(a => a.id === id)?.nama || id;
                  });

                  return (
                    <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            t.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {t.status === 'aktif' ? 'Aktif Berjalan' : 'Selesai'}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            Target: <strong className="text-slate-900">{targetName}</strong>
                          </span>
                          <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            Deadline: {t.deadline}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateTugasKhususStatus(t.id, t.status === 'aktif' ? 'selesai' : 'aktif')}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                          >
                            {t.status === 'aktif' ? 'Tandai Selesai' : 'Aktifkan Kembali'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Hapus tugas khusus ini?')) {
                                deleteTugasKhusus(t.id);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h5 className="font-black text-sm text-slate-900">{t.judul}</h5>
                      <p className="text-xs text-slate-700 leading-relaxed">{t.deskripsi}</p>

                      {/* Dokumentasi Foto Submisi dari Kepling */}
                      {submission && submission.fotoUrl && (
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={submission.fotoUrl}
                              alt="Bukti Dokumentasi"
                              className="w-10 h-10 object-cover rounded-lg border border-indigo-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                                Bukti Lapangan Diterima: {submission.namaKepling || 'Kepling'}
                              </span>
                              <p className="text-xs text-slate-700 truncate font-medium">
                                {submission.keterangan || 'Tidak ada catatan tambahan'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingSubmission({ task: t, sub: submission })}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer inline-flex items-center gap-1 shadow-xs"
                          >
                            <Camera className="w-3.5 h-3.5" /> Buka Foto
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                        <span>Pemberi: {t.pemberiTugas}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-indigo-700">
                            {t.completedBy?.length || 0} Akun Selesai:
                          </span>
                          {completedNames.length > 0 ? (
                            <span className="text-slate-700 font-semibold">
                              {completedNames.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada akun</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Preview Bukti Dokumentasi Tugas Khusus */}
          {viewingSubmission && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                      Bukti Dokumentasi Lapangan
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-1">
                      {viewingSubmission.task.judul}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pengirim: <strong>{viewingSubmission.sub.namaKepling || 'Kepling'}</strong> &bull; {new Date(viewingSubmission.sub.updatedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingSubmission(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video flex items-center justify-center">
                    <img
                      src={viewingSubmission.sub.fotoUrl}
                      alt="Foto Bukti Lapangan"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {viewingSubmission.sub.keterangan && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-800 space-y-1">
                      <span className="font-bold text-slate-600 block">Keterangan / Laporan Kepling:</span>
                      <p className="leading-relaxed">{viewingSubmission.sub.keterangan}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewingSubmission(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
