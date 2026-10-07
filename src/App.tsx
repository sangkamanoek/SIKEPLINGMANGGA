import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  History,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Award,
  Trophy,
  UserCheck,
  Users,
  Compass,
  Wrench,
  Wallet,
  Flower2,
  Building,
  ShieldAlert,
  BookOpen,
  Baby,
} from 'lucide-react';
import { subscribeKunjunganWarga } from './lib/kunjunganService';
import { syncInfraReportToPembangunan } from './lib/pembangunanService';
import {
  GoogleUser,
  SheetMetadata,
  LaporanHarianItem,
  UserAccount,
  TargetsCapaianMap,
  isKelurahanAdmin,
  isPkkRole,
  isKelurahanRole,
} from './types';
import { safeSetLocalStorage, safeSetSessionStorage, populateMemoryCache } from './lib/safeStorage';
import {
  initAuth,
  googleSignIn,
  logout,
  setAccessToken,
  getAccessToken,
  db,
} from './lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  getOrCreateSpreadsheet,
  appendLaporanToSheet,
} from './lib/sheetsService';
import { uploadMakalahToGoogleDrive } from './lib/driveService';
import { SUPER_ADMIN_ACCOUNT, getAccountById, syncPasswordsWithServer, syncProfilesWithServer, syncAccountsWithServer } from './data/keplingList';
import { HeaderBanner } from './components/HeaderBanner';
import { FormLaporan } from './components/FormLaporan';
import { SmartHubDashboard } from './components/SmartHubDashboard';
import { DeadlineNotifAlert } from './components/DeadlineNotifAlert';
import { LoginPage } from './components/LoginPage';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppUpdateToastBanner } from './components/AppUpdateToastBanner';
import { CURRENT_APP_VERSION } from './lib/appVersionService';
import { customFetch } from './lib/fetchInterceptor';
import { getDefaultTargetsCapaianMap } from './data/targetsData';
import { fetchTargetsCapaian, subscribeTargetsFromFirestore } from './lib/targetsApi';
import { fetchAllDataKeluarga } from './lib/dataKeluargaService';
import { useFeatureNotifications } from './hooks/useFeatureNotifications';

// Code-Splitting: Lazy load heavy modules to guarantee fast initial startup
const ViewImagesPage = React.lazy(() => import('./components/ViewImagesPage'));
const KunjunganHarianView = React.lazy(() => import('./components/KunjunganHarianView').then(m => ({ default: m.KunjunganHarianView })));
const LaporanKeuanganPkkView = React.lazy(() => import('./components/LaporanKeuanganPkkView').then(m => ({ default: m.LaporanKeuanganPkkView })));
const PkkHubDashboard = React.lazy(() => import('./components/PkkHubDashboard').then(m => ({ default: m.PkkHubDashboard })));
const PkkKegiatanView = React.lazy(() => import('./components/PkkKegiatanView').then(m => ({ default: m.PkkKegiatanView })));
const PkkDasaWismaView = React.lazy(() => import('./components/PkkDasaWismaView').then(m => ({ default: m.PkkDasaWismaView })));
const PkkPosyanduView = React.lazy(() => import('./components/PkkPosyanduView').then(m => ({ default: m.PkkPosyanduView })));
const PkkBukuAdministrasiView = React.lazy(() => import('./components/PkkBukuAdministrasiView').then(m => ({ default: m.PkkBukuAdministrasiView })));
const SuratKedinasanView = React.lazy(() => import('./components/SuratKedinasanView').then(m => ({ default: m.SuratKedinasanView })));
const RealisasiPembangunanView = React.lazy(() => import('./components/RealisasiPembangunanView').then(m => ({ default: m.RealisasiPembangunanView })));
const RangkumanLaporanKelurahan = React.lazy(() => import('./components/RangkumanLaporanKelurahan').then(m => ({ default: m.RangkumanLaporanKelurahan })));
const RiwayatLaporan = React.lazy(() => import('./components/RiwayatLaporan').then(m => ({ default: m.RiwayatLaporan })));
const DetailLaporanModal = React.lazy(() => import('./components/DetailLaporanModal').then(m => ({ default: m.DetailLaporanModal })));
const AccountSelectorModal = React.lazy(() => import('./components/AccountSelectorModal').then(m => ({ default: m.AccountSelectorModal })));
const MonitoringSuperAdmin = React.lazy(() => import('./components/MonitoringSuperAdmin').then(m => ({ default: m.MonitoringSuperAdmin })));
const DashboardCapaianKepling = React.lazy(() => import('./components/DashboardCapaianKepling').then(m => ({ default: m.DashboardCapaianKepling })));
const DashboardPbbKasi = React.lazy(() => import('./components/DashboardPbbKasi').then(m => ({ default: m.DashboardPbbKasi })));
const DashboardPerlinsosKasi = React.lazy(() => import('./components/DashboardPerlinsosKasi').then(m => ({ default: m.DashboardPerlinsosKasi })));
const DashboardTrantibumKasi = React.lazy(() => import('./components/DashboardTrantibumKasi').then(m => ({ default: m.DashboardTrantibumKasi })));
const PWAInstallModal = React.lazy(() => import('./components/PWAInstallModal').then(m => ({ default: m.PWAInstallModal })));
const PanduanPPTModal = React.lazy(() => import('./components/PanduanPPTModal').then(m => ({ default: m.PanduanPPTModal })));
const AppUpdateModal = React.lazy(() => import('./components/AppUpdateModal').then(m => ({ default: m.AppUpdateModal })));
const AbsenKegiatanKhusus = React.lazy(() => import('./components/AbsenKegiatanKhusus').then(m => ({ default: m.AbsenKegiatanKhusus })));
const RekapPbbView = React.lazy(() => import('./components/RekapPbbView').then(m => ({ default: m.RekapPbbView })));
const PemetaanWilayahView = React.lazy(() => import('./components/PemetaanWilayahView').then(m => ({ default: m.PemetaanWilayahView })));
const DatabaseKeluargaView = React.lazy(() => import('./components/DatabaseKeluargaView').then(m => ({ default: m.DatabaseKeluargaView })));
const UbahPasswordModal = React.lazy(() => import('./components/UbahPasswordModal').then(m => ({ default: m.UbahPasswordModal })));
const EditProfileModal = React.lazy(() => import('./components/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const AbsenApelModal = React.lazy(() => import('./components/AbsenApelModal').then(m => ({ default: m.AbsenApelModal })));

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center animate-fade-in">
    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
    <p className="text-sm font-bold text-slate-700">Memuat Modul...</p>
    <p className="text-xs text-slate-400 mt-1">SI-MANGGA Kelurahan Mangga</p>
  </div>
);
import { AbsenApelItem, CustomEvent, EventAttendance, StatusAbsenApel } from './types';
import { loadAllAttendance, getTodayAbsenForKepling } from './lib/attendanceApi';
import {
  subscribeAttendanceFromFirestore,
  saveAttendanceToFirestore,
  wipeAllFirestoreCapaianData,
  subscribeCustomEventsFromFirestore,
  subscribeEventAttendanceFromFirestore,
} from './lib/firestoreService';
import { KEPLING_ACCOUNTS } from './data/keplingList';
import { getReportIsoDate, getTodayLocalIso } from './lib/formatter';
import { wipeAllPbbSpptEverywhere } from './lib/pbbService';
import { consolidateDailyReport } from './lib/reportConsolidator';
import {
  fetchAllReports,
  saveReportToServer,
  deleteReportFromServer,
  resetAllReportsOnServer,
  subscribeReportsFromFirestore,
  getLocalDeletedReportIds,
  isReportDeleted,
} from './lib/reportsApi';
import {
  getReportsFromIndexedDB,
  clearIndexedDBReports,
  getKeluargaFromIndexedDB,
  getPbbFromIndexedDB,
  getVisitsFromIndexedDB,
  getHistoryFromIndexedDB,
} from './lib/indexedDbStorage';
import { KNOWN_STORAGE_KEYS } from './lib/reportsApi';
import { purgeAllClientCache } from './lib/purgeCache';

const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history_v2';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewImagesId = urlParams.get('view-images');
  if (viewImagesId) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <ViewImagesPage reportId={viewImagesId} />
      </React.Suspense>
    );
  }

  const [user, setUser] = useState<GoogleUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_cached_access_token');
    } catch (e) {
      return null;
    }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [sheetMeta, setSheetMeta] = useState<SheetMetadata | null>(() => {
    try {
      const stored = localStorage.getItem('google_sheet_metadata');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.title === 'SI-MANGGA (Sistem Informasi & Administrasi Kelurahan Mangga)') return parsed;
      }
    } catch (e) {
      return null;
    }
    return null;
  });

  // Authentication State for Access Gatekeeping
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const isAuth = localStorage.getItem('kepling_session_authenticated');
      const isSessionAuth = sessionStorage.getItem('kepling_session_authenticated');
      return isAuth === 'true' || isSessionAuth === 'true';
    } catch (e) {
      return false;
    }
  });

  // Active Account State (Super Admin or 24 Kepling)
  const [activeAccount, setActiveAccount] = useState<UserAccount>(() => {
    try {
      const savedId = localStorage.getItem('kepling_active_account_id');
      if (savedId) {
        return getAccountById(savedId);
      }
    } catch (e) {
      console.warn(e);
    }
    return SUPER_ADMIN_ACCOUNT;
  });

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isUbahPasswordOpen, setIsUbahPasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isPPTModalOpen, setIsPPTModalOpen] = useState(false);
  const [isAbsenApelModalOpen, setIsAbsenApelModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [attendanceList, setAttendanceList] = useState<AbsenApelItem[]>([]);
  const [eventAttendanceList, setEventAttendanceList] = useState<EventAttendance[]>([]);
  const [kunjunganList, setKunjunganList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('sikepling_kunjungan_harian_list_v1');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [preselectedKepling, setPreselectedKepling] = useState<UserAccount | null>(null);
  const [riwayatFilterPetugas, setRiwayatFilterPetugas] = useState<string | undefined>(undefined);

  // Active view tab
  const [activeTab, setActiveTab] = useState<
    | 'hub'
    | 'form'
    | 'capaian'
    | 'monitoring'
    | 'capaian_admin'
    | 'riwayat'
    | 'kunjungan'
    | 'dashboard_kasi'
    | 'kegiatan_khusus'
    | 'pemetaan'
    | 'rekap_pbb'
    | 'database_keluarga'
    | 'realisasi_pembangunan'
    | 'keuangan_pkk'
    | 'kegiatan_pkk'
    | 'dasa_wisma'
    | 'posyandu_pkk'
    | 'surat_kedinasan'
    | 'buku_pkk'
  >('hub');

  // Mode portal khusus Super Admin: 'kelurahan' (default) atau 'pkk'
  const [adminPortalMode, setAdminPortalMode] = useState<'kelurahan' | 'pkk'>('kelurahan');

  // Sub-mode untuk tab 'form' bagi Super Admin: 'rangkuman' (default) atau 'formulir' (asistensi)
  const [superAdminFormSubMode, setSuperAdminFormSubMode] = useState<'rangkuman' | 'formulir'>('rangkuman');

  // Targeted lingkungan for Pemetaan WebGIS deep-linking
  const [pemetaanTargetLingkungan, setPemetaanTargetLingkungan] = useState<string | undefined>(undefined);

  const handleNavigateToPemetaan = (lingkunganNomor?: number | string) => {
    if (activeAccount.role === 'petugas_bapenda') {
      showToast('Akses Dibatasi: Petugas Bapenda tidak memiliki izin untuk melihat Peta WebGIS.', 'error');
      return;
    }
    if (lingkunganNomor !== undefined && lingkunganNomor !== null && String(lingkunganNomor).trim() !== '') {
      const rawStr = String(lingkunganNomor).trim();
      const idVal = rawStr.startsWith('kepling_') ? rawStr : `kepling_${rawStr}`;
      setPemetaanTargetLingkungan(idVal);
    } else {
      setPemetaanTargetLingkungan(undefined);
    }
    setActiveTab('pemetaan');
  };

  // Strict Role-Based Access Control (RBAC) & Complete Isolation between Kelurahan & PKK
  useEffect(() => {
    // 0a. PKK ROLES: ONLY allowed tabs: hub, kegiatan_pkk, keuangan_pkk, dasa_wisma, buku_pkk
    // Strict isolation: PKK CANNOT access Kelurahan features (form, monitoring, capaian, pemetaan, etc.)
    if (isPkkRole(activeAccount.role)) {
      const pkkAllowedTabs = ['hub', 'kegiatan_pkk', 'keuangan_pkk', 'dasa_wisma', 'posyandu_pkk', 'buku_pkk'];
      if (!pkkAllowedTabs.includes(activeTab)) {
        setActiveTab('hub');
        showToast('Akses Dibatasi: Akun PKK hanya berwenang mengakses modul Tim Penggerak PKK.', 'error');
      }
      return;
    }

    // 0b. KELURAHAN ROLES: CANNOT access PKK features (keuangan_pkk, kegiatan_pkk, dasa_wisma, buku_pkk)
    // Strict isolation: Kelurahan accounts cannot access PKK financial, activity, or dasa wisma tabs
    const pkkOnlyTabs = ['keuangan_pkk', 'kegiatan_pkk', 'dasa_wisma', 'posyandu_pkk', 'buku_pkk'];
    if (pkkOnlyTabs.includes(activeTab)) {
      const fallbackTab =
        activeAccount.role === 'kepling'
          ? 'form'
          : activeAccount.role === 'super_admin'
          ? 'monitoring'
          : activeAccount.role === 'petugas_bapenda'
          ? 'rekap_pbb'
          : 'dashboard_kasi';
      setActiveTab(fallbackTab);
      showToast('Akses Dibatasi: Modul PKK khusus untuk Tim Penggerak PKK.', 'error');
      return;
    }

    // 1. Petugas Bapenda: Only rekap_pbb
    if (activeAccount.role === 'petugas_bapenda' && activeTab !== 'rekap_pbb') {
      setActiveTab('rekap_pbb');
      return;
    }

    // 2. Kasi Pemerintahan: Allowed tabs: hub, dashboard_kasi, rekap_pbb, database_keluarga, riwayat, kegiatan_khusus, surat_kedinasan
    if (activeAccount.role === 'kasi_pemerintahan') {
      const allowed = ['hub', 'dashboard_kasi', 'rekap_pbb', 'database_keluarga', 'riwayat', 'kegiatan_khusus', 'surat_kedinasan'];
      if (!allowed.includes(activeTab)) {
        setActiveTab('dashboard_kasi');
        showToast('Akses Disesuaikan: Anda diarahkan ke bidang tugas Seksi Tata Pemerintahan.', 'info');
      }
      return;
    }

    // 3. Kasi Pembangunan: Allowed tabs: hub, dashboard_kasi, realisasi_pembangunan, database_keluarga, kunjungan, riwayat, kegiatan_khusus, surat_kedinasan
    if (activeAccount.role === 'kasi_pembangunan') {
      const allowed = ['hub', 'dashboard_kasi', 'realisasi_pembangunan', 'database_keluarga', 'kunjungan', 'riwayat', 'kegiatan_khusus', 'surat_kedinasan'];
      if (!allowed.includes(activeTab)) {
        setActiveTab('dashboard_kasi');
        showToast('Akses Disesuaikan: Anda diarahkan ke bidang tugas Seksi Pembangunan & Kesos.', 'info');
      }
      return;
    }

    // 4. Kasi Trantibum: Allowed tabs: hub, dashboard_kasi, pemetaan, riwayat, kegiatan_khusus, surat_kedinasan
    if (activeAccount.role === 'kasi_trantibum') {
      const allowed = ['hub', 'dashboard_kasi', 'pemetaan', 'riwayat', 'kegiatan_khusus', 'surat_kedinasan'];
      if (!allowed.includes(activeTab)) {
        setActiveTab('dashboard_kasi');
        showToast('Akses Disesuaikan: Anda diarahkan ke bidang tugas Seksi Trantibum & Linmas.', 'info');
      }
      return;
    }

    // 5. Kepling: Allowed tabs: hub, form, capaian, pemetaan, realisasi_pembangunan, rekap_pbb, riwayat, kunjungan, kegiatan_khusus, surat_kedinasan
    if (activeAccount.role === 'kepling') {
      const allowed = ['hub', 'form', 'capaian', 'pemetaan', 'realisasi_pembangunan', 'rekap_pbb', 'riwayat', 'kunjungan', 'kegiatan_khusus', 'surat_kedinasan'];
      if (!allowed.includes(activeTab)) {
        setActiveTab('form');
        showToast('Akses Disesuaikan: Fitur ini tidak tersedia untuk Kepala Lingkungan.', 'info');
      }
      return;
    }
  }, [activeAccount.role, activeTab]);

  // Listen for custom navigation events from SmartHubDashboard
  useEffect(() => {
    const handleNavigateTab = (e: Event) => {
      const customEvent = e as Event & { detail?: any };
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    const handleSwitchPkk = () => {
      setIsAccountModalOpen(true);
      showToast('Pilih akun pengurus TP-PKK untuk mengakses Pilar Kegiatan TP-PKK & Dasa Wisma.', 'info');
    };
    window.addEventListener('navigate-tab', handleNavigateTab);
    window.addEventListener('switch-to-pkk-role', handleSwitchPkk);
    return () => {
      window.removeEventListener('navigate-tab', handleNavigateTab);
      window.removeEventListener('switch-to-pkk-role', handleSwitchPkk);
    };
  }, []);

  // Kasi Dashboard Target Mapping and Pemerintahan date states
  const [targetsMap, setTargetsMap] = useState<TargetsCapaianMap>(getDefaultTargetsCapaianMap);
  const todayStr = new Date().toISOString().split('T')[0];
  const [pemerintahanDate, setPemerintahanDate] = useState<string>(todayStr);
  const [adminSektoralView, setAdminSektoralView] = useState<'pemerintahan' | 'pembangunan' | 'trantibum'>('pemerintahan');

  // Reports data
  const [reports, setReports] = useState<LaporanHarianItem[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isRefreshingReports, setIsRefreshingReports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time unread/new reports counter across all features
  const { unreadCounts, totalUnreadCount } = useFeatureNotifications({
    activeAccount,
    activeTab,
    reports,
    kunjunganList,
    customEvents,
  });

  // Render notification badge on navigation tab menu buttons
  const renderTabBadge = useCallback((featureKey: string) => {
    const count = unreadCounts[featureKey] || 0;
    if (count <= 0) return null;
    return (
      <span
        className="ml-1.5 px-1.5 py-0.2 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse ring-1 ring-white/60 tracking-tight"
        title={`${count} laporan baru`}
      >
        {count > 99 ? '99+' : count}
      </span>
    );
  }, [unreadCounts]);

  // Modal detail view
  const [selectedReport, setSelectedReport] = useState<LaporanHarianItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Floating Toast notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Centralized report & attendance fetcher: reads from server and Firestore in parallel (lightweight)
  const refreshAllReports = useCallback(async (showNotification = false) => {
    setIsRefreshingReports(true);
    try {
      const [serverReports, freshAttendance] = await Promise.all([
        fetchAllReports().catch(() => null),
        loadAllAttendance().catch(() => null),
      ]);
      if (serverReports) {
        setReports(serverReports);
      }
      if (freshAttendance && freshAttendance.length > 0) {
        setAttendanceList(freshAttendance);
      }
      if (showNotification) {
        showToast(
          `Sinkronisasi berhasil (${serverReports?.length || 0} laporan, ${freshAttendance?.length || 0} apel)`,
          'success'
        );
      }
    } catch (e) {
      console.warn('Could not refresh data from server:', e);
    } finally {
      setIsRefreshingReports(false);
    }
  }, []);

  // Load local backup reports from IndexedDB / LocalStorage
  const loadLocalReports = async () => {
    try {
      const deletedIds = getLocalDeletedReportIds();
      // 1. Try IndexedDB first (high-capacity, contains all reports & photos)
      const idbItems = await getReportsFromIndexedDB();
      if (Array.isArray(idbItems) && idbItems.length > 0) {
        const active = idbItems.filter((r) => r && r.id && !deletedIds.has(r.id) && !isReportDeleted(r));
        if (active.length > 0) {
          setReports(active);
          return;
        }
      }

      // 2. Fallback to LocalStorage
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
      if (stored) {
        const parsed: LaporanHarianItem[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const active = parsed.filter((r) => r && r.id && !deletedIds.has(r.id) && !isReportDeleted(r));
          setReports(active);
        }
      }
    } catch (e) {
      console.warn('Could not read local reports:', e);
    }
  };

  const saveLocalReport = (item: LaporanHarianItem) => {
    try {
      const deletedIds = getLocalDeletedReportIds();
      if (item.id && deletedIds.has(item.id)) return;

      setReports((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === item.id);
        let updated: LaporanHarianItem[];
        if (existingIndex >= 0) {
          const clone = [...prev];
          clone[existingIndex] = item;
          updated = clone;
        } else {
          updated = [item, ...prev];
        }
        const filtered = updated.filter((r) => r && r.id && !deletedIds.has(r.id));
        safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(filtered));
        return filtered;
      });
    } catch (e) {
      console.warn('Could not save to local storage:', e);
    }
  };

  // Setup spreadsheet and upload Makalah to Google Drive when user logs in
  const syncSpreadsheet = useCallback(async (authToken: string) => {
    try {
      const meta = await getOrCreateSpreadsheet(authToken);
      setSheetMeta(meta);
      try {
        safeSetLocalStorage('google_sheet_metadata', JSON.stringify(meta));
      } catch (e) {}

      // Automatically sync Makalah .docx to Google Drive
      try {
        const uploaded = localStorage.getItem('google_drive_makalah_uploaded');
        if (!uploaded) {
          const driveFile = await uploadMakalahToGoogleDrive(authToken);
          if (driveFile?.webViewLink) {
            safeSetLocalStorage('google_drive_makalah_uploaded', 'true');
            safeSetLocalStorage('google_drive_makalah_link', driveFile.webViewLink);
            showToast('Makalah Ilmiah (.docx) berhasil disimpan ke Google Drive Anda!', 'success');
          }
        }
      } catch (driveErr) {
        console.warn('Google Drive Makalah upload note:', driveErr);
      }
    } catch (err: unknown) {
      console.error('Error setting up spreadsheet:', err);
      showToast('Gagal menghubungkan Google Sheet secara otomatis', 'error');
    }
  }, []);

  // Initialization: Load reports from server, sync offline cache, and set auto-sync interval
  useEffect(() => {
    // Force automatic cache clearing and PWA metadata update for non-tech-savvy users
    const FORCE_UPDATE_KEY = 'simangga_cache_force_update_v6';
    const hasForceUpdated = localStorage.getItem(FORCE_UPDATE_KEY);

    if (!hasForceUpdated) {
      if ('caches' in window) {
        caches.keys().then((names) => {
          Promise.all(names.map((name) => caches.delete(name))).catch(() => {});
        }).catch(() => {});
      }
      localStorage.setItem(FORCE_UPDATE_KEY, 'true');
    }

    // Register aggressive cache-clearing service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.update();
      }).catch((err) => {
        console.error('[App] Service worker registration failed:', err);
      });
    }

    // Instantly load cached local reports to populate the UI in 10ms (Buttery-smooth startup)
    loadLocalReports();

    // Stagger heavy database memory caching across idle intervals so older phones don't freeze or drop frames
    const runIdle = (fn: () => void, timeoutMs: number) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(fn, { timeout: timeoutMs });
      } else {
        setTimeout(fn, timeoutMs);
      }
    };

    const tVisit = setTimeout(() => {
      runIdle(() => {
        getVisitsFromIndexedDB().then((data) => {
          if (data && data.length > 0) {
            populateMemoryCache('sikepling_kunjungan_harian_list_v1', JSON.stringify(data));
          }
        });
        getHistoryFromIndexedDB().then((data) => {
          if (data && data.length > 0) {
            populateMemoryCache('kepling_local_laporan_history_v2', JSON.stringify(data));
          }
        });
      }, 1200);
    }, 800);

    const tPbb = setTimeout(() => {
      runIdle(() => {
        getPbbFromIndexedDB().then((data) => {
          if (data && data.length > 0) {
            populateMemoryCache('sikepling_sppt_pbb_records_2026_v3', JSON.stringify(data));
          }
        });
      }, 2500);
    }, 2000);

    const tKeluarga = setTimeout(() => {
      runIdle(() => {
        getKeluargaFromIndexedDB().then((data) => {
          if (data && data.length > 0) {
            populateMemoryCache('sikepling_database_keluarga_v1', JSON.stringify(data));
          }
        });
      }, 4000);
    }, 3500);

    // Stagger secondary background syncs to ensure first UI frame paints at 60fps
    const timer1 = setTimeout(() => {
      syncPasswordsWithServer();
      syncProfilesWithServer();
      syncAccountsWithServer();
    }, 150);

    const timer2 = setTimeout(() => {
      refreshAllReports(false);
      loadAllAttendance().then((items) => setAttendanceList(items));
      fetchTargetsCapaian().then((data) => {
        if (data) setTargetsMap(data);
      });
    }, 300);

    // Subscribe to real-time targets & capaian directly from Firebase Firestore
    const unsubscribeTargets = subscribeTargetsFromFirestore((data) => {
      if (data && Object.keys(data).length > 0) {
        setTargetsMap((prev) => ({ ...prev, ...data }));
      }
    });

    // Subscribe to real-time reports directly from Firebase Firestore with safe non-destructive merge
    const unsubscribeFirestoreReports = subscribeReportsFromFirestore((firestoreReports, isFromCache) => {
      if (Array.isArray(firestoreReports)) {
        setReports((prev) => {
          // If Firestore is genuinely empty on the server, we must clear the reports to allow a fresh start (NOL)!
          if (firestoreReports.length === 0 && !isFromCache) {
            try {
              safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify([]));
            } catch {}
            return [];
          }

          // Guard: If Firestore returns empty list due to offline cache loading, never wipe out active user-submitted reports
          if (firestoreReports.length === 0 && prev.length > 0) {
            return prev;
          }

          const deletedIds = getLocalDeletedReportIds();
          const reportMap = new Map<string, LaporanHarianItem>();

          // 1. First add all Firestore incoming reports
          firestoreReports.forEach((r) => {
            if (r && r.id && !deletedIds.has(r.id) && !isReportDeleted(r)) {
              reportMap.set(r.id, r);
            }
          });

          // 2. Retain any freshly saved reports from local memory that may not have arrived in Firestore yet
          prev.forEach((r) => {
            if (r && r.id && !deletedIds.has(r.id) && !isReportDeleted(r)) {
              if (!reportMap.has(r.id)) {
                reportMap.set(r.id, r);
              }
            }
          });

          const merged = Array.from(reportMap.values());
          merged.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

          // Cache merged reports to LocalStorage/IndexedDB for offline speed on next reload
          try {
            safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(merged));
          } catch {}

          return merged;
        });
      }
    });

    // Subscribe to real-time attendance directly from Firebase Firestore with safe merge
    const unsubscribeAttendance = subscribeAttendanceFromFirestore((items, isFromCache) => {
      if (Array.isArray(items)) {
        setAttendanceList((prev) => {
          if (items.length === 0 && !isFromCache) {
            return [];
          }
          if (items.length === 0 && prev.length > 0) return prev;
          const attMap = new Map<string, AbsenApelItem>();
          items.forEach((it) => {
            if (it && it.id) attMap.set(it.id, it);
          });
          prev.forEach((it) => {
            if (it && it.id && !attMap.has(it.id)) attMap.set(it.id, it);
          });
          const merged = Array.from(attMap.values());
          merged.sort((a, b) => new Date(b.waktuLengkap || b.createdAt).getTime() - new Date(a.waktuLengkap || a.createdAt).getTime());
          return merged;
        });
      }
    });

    // Subscribe to events and check for notifications
    const unsubscribeEvents = subscribeCustomEventsFromFirestore((data) => {
      setCustomEvents(data);
    });

    // Subscribe to real-time event attendance
    const unsubscribeEventAttendance = subscribeEventAttendanceFromFirestore((items) => {
      if (Array.isArray(items)) {
        setEventAttendanceList(items);
      }
    });

    // Ultra-fast Dual-Tier Real-time Listener & Server Sync untuk Kunjungan Warga
    const unsubscribeKunjungan = subscribeKunjunganWarga((items) => {
      if (Array.isArray(items)) {
        setKunjunganList(items);
      }
    });

    const pollNotifications = setInterval(() => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;
      
      const now = new Date();
      customEvents.forEach(event => {
        const eventTime = new Date(`${event.date}T${event.time}`);
        const diffMs = eventTime.getTime() - now.getTime();
        
        // 5 minutes = 300,000 ms. Check range: [4 mins, 5 mins]
        if (diffMs > 240000 && diffMs <= 300000) {
          // Check if targeted
          const isTargeted = event.required || event.targetKeplingIds?.includes(activeAccount?.id);
          if (isTargeted) {
             new window.Notification("BELUM ABSEN KEGIATAN KHUSUS", { body: `Agenda: ${event.title} dimulai dalam 5 menit!` });
             if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      });
    }, 60000); // Poll every minute

    // Background polling: Firestore onSnapshot already provides INSTANT realtime push updates.
    // Periodic fallback refresh every 30s only when tab is visible prevents battery/CPU thrashing on older phones.
    const fastSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshAllReports(false);
    }, 30000);

    const unsubscribe = initAuth(
      async (firebaseUser, accessToken) => {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
        setToken(accessToken);
        setAccessToken(accessToken);
        await syncSpreadsheet(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setSheetMeta(null);
      }
    );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(tVisit);
      clearTimeout(tPbb);
      clearTimeout(tKeluarga);
      unsubscribeTargets();
      unsubscribeFirestoreReports();
      unsubscribeAttendance();
      unsubscribeEvents();
      unsubscribeEventAttendance();
      if (unsubscribeKunjungan) unsubscribeKunjungan();
      clearInterval(pollNotifications);
      clearInterval(fastSyncInterval);
      unsubscribe();
    };
  }, [syncSpreadsheet, refreshAllReports]);

  // Connect Google account
  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: res.user.email,
          photoURL: res.user.photoURL,
        });
        setToken(res.accessToken);
        showToast('Google Sheets & Calendar berhasil terhubung!', 'success');
        await syncSpreadsheet(res.accessToken);
      }
    } catch (err: unknown) {
      console.error('Sign in failed:', err);
      showToast('Koneksi Google dibatalkan atau terjadi kesalahan', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Google account
  const handleDisconnectGoogle = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setSheetMeta(null);
    showToast('Koneksi akun Google diputuskan', 'info');
  };

  // Save report to database (Local Storage & Central Server) & Google Sheets if connected
  const handleSaveReport = async (item: LaporanHarianItem) => {
    setIsSaving(true);
    try {
      // Automatic Consolidation: Check if an existing report for this Kepling on the same date already exists
      const existingReport = reports.find((r) => {
        const sameKepling =
          (r.keplingId && item.keplingId && r.keplingId === item.keplingId) ||
          r.namaKepling === item.namaKepling ||
          r.jabatan === item.jabatan;
        const sameDate = r.tanggal === item.tanggal;
        return sameKepling && sameDate && r.id !== item.id;
      });

      let reportToSave = item;
      if (existingReport) {
        reportToSave = consolidateDailyReport(existingReport, item);
      }

      // 1. ALWAYS save to local database immediately FIRST so data is guaranteed safe (0ms)
      saveLocalReport(reportToSave);

      // 2. Open confirmation modal right away with the saved report
      setSelectedReport(reportToSave);
      setIsModalOpen(true);

      // 3. Save to Firebase Firestore and Server buffer in parallel
      await saveReportToServer(reportToSave);

      // 3b. Sync presensi apel from report to central attendance if not already recorded
      if (reportToSave.absenApel && reportToSave.absenApel.status) {
        try {
          const isoDate = getReportIsoDate(reportToSave) || getTodayLocalIso();
          const accId = reportToSave.keplingId || activeAccount.id;
          const targetKepling = KEPLING_ACCOUNTS.find(
            (k) =>
              k.id === accId ||
              (k.nama && reportToSave.namaKepling && k.nama.toLowerCase() === String(reportToSave.namaKepling).toLowerCase())
          );

          if (targetKepling) {
            const hasExisting = getTodayAbsenForKepling(attendanceList, targetKepling.id, isoDate);
            if (!hasExisting) {
              const newAbsen: AbsenApelItem = {
                id: `absen_${targetKepling.id}_${isoDate}`,
                accountId: targetKepling.id,
                namaKepling: targetKepling.nama,
                lingkungan: targetKepling.lingkungan,
                nomorLingkungan: targetKepling.nomorLingkungan,
                tanggal: isoDate,
                jam: reportToSave.absenApel.jam || '07:35 WIB',
                waktuLengkap: reportToSave.absenApel.waktuLengkap || new Date().toISOString(),
                status: (reportToSave.absenApel.status as StatusAbsenApel) || 'Hadir',
                fotoSelfieUrl: reportToSave.absenApel.fotoSelfieUrl || '',
                lokasiGps: reportToSave.absenApel.lokasiGps || 'Halaman Kantor Kelurahan Mangga (GPS Verified)',
                catatan: reportToSave.absenApel.catatan || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              saveAttendanceToFirestore(newAbsen).catch(() => {});
              fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAbsen),
              }).catch(() => {});
              setAttendanceList((prev) => [newAbsen, ...prev.filter((a) => a.id !== newAbsen.id)]);
            }
          }
        } catch (syncErr) {
          console.warn('Auto sync attendance notice:', syncErr);
        }
      }

      // 3c. Sync infrastructure finding to Realisasi Pembangunan database
      if (reportToSave.kinerja?.infrastrukturAdaGiat || reportToSave.kinerja?.infrastrukturSubjek) {
        syncInfraReportToPembangunan(reportToSave).catch((err) => {
          console.warn('Auto sync infra report to pembangunan notice:', err);
        });
      }

      // 4. If Google account is connected, sync to Google Sheets in background/parallel
      const activeToken = token || (await getAccessToken());
      if (activeToken) {
        (async () => {
          try {
            let currentSheetMeta = sheetMeta;
            if (!currentSheetMeta) {
              try {
                const stored = localStorage.getItem('google_sheet_metadata');
                if (stored) currentSheetMeta = JSON.parse(stored);
              } catch (e) {}
            }
            if (!currentSheetMeta) {
              currentSheetMeta = await getOrCreateSpreadsheet(activeToken);
              setSheetMeta(currentSheetMeta);
              try {
                safeSetLocalStorage('google_sheet_metadata', JSON.stringify(currentSheetMeta));
              } catch (e) {}
            }

            await appendLaporanToSheet(activeToken, currentSheetMeta.spreadsheetId, reportToSave);
            showToast('Laporan berhasil tersimpan & terakumulasi di Database!', 'success');
          } catch (sheetErr) {
            console.warn('Google Sheets sync notice:', sheetErr);
          }
        })();
      } else {
        if (existingReport) {
          showToast('Laporan hari ini berhasil diperbarui & diakumulasikan!', 'success');
        } else {
          showToast('Laporan berhasil disimpan ke Database Kelurahan & Monitoring!', 'success');
        }
      }
    } catch (err: unknown) {
      console.error('Error in handleSaveReport:', err);
      saveLocalReport(item);
      showToast('Laporan berhasil disimpan ke Database Lokal!', 'success');
    } finally {
      setIsSaving(false);
    }
  };

  // Update report handler (Super Admin modifying or correcting Kepling data)
  const handleUpdateReport = async (updatedItem: LaporanHarianItem) => {
    try {
      saveLocalReport(updatedItem);
      await saveReportToServer(updatedItem);
      setSelectedReport(updatedItem);
      showToast(`Laporan ${updatedItem.namaKepling} (${updatedItem.jabatan}) berhasil diperbarui!`, 'success');
    } catch (err) {
      console.error('Failed to update report:', err);
      showToast('Gagal memperbarui laporan.', 'error');
    }
  };

  // Delete single report handler
  const handleDeleteReport = async (id: string) => {
    try {
      if (!id) return;
      setIsModalOpen(false);
      setSelectedReport(null);
      setReports((prev) => prev.filter((r) => r.id !== id));
      await deleteReportFromServer(id);
      showToast('Laporan berhasil dihapus dari sistem.', 'info');
    } catch (err) {
      console.error('Failed to delete report:', err);
      showToast('Gagal menghapus laporan.', 'error');
    }
  };

  // Reset all reports and operational achievements handler (Fresh Start)
  const handleResetAllReports = async () => {
    try {
      setReports([]);
      setSelectedReport(null);
      const defaultTargets = getDefaultTargetsCapaianMap();
      setTargetsMap(defaultTargets);

      // 1. Wipe Firebase Firestore data (reports, deleted tombstones, attendance, PBB collections)
      await wipeAllFirestoreCapaianData();
      await wipeAllPbbSpptEverywhere();

      // 2. Wipe server buffer & disk JSONs (while keeping passwords and profiles)
      await customFetch('/api/wipe-all-data', { method: 'POST' }).catch(() => {});
      await customFetch('/api/reset-all-system-data', { method: 'POST' }).catch(() => {});
      await resetAllReportsOnServer().catch(() => {});

      // 3. Clear local storage operational keys and IndexedDB cache
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY_LAPORAN);
        localStorage.removeItem('kepling_deleted_reports_v1');
        localStorage.removeItem('kepling_absen_apel_list');
        localStorage.removeItem('manggajuara_targets_capaian_v2');
        localStorage.removeItem('manggajuara_perlinsos_override_v2_applied');
        localStorage.removeItem('sikepling_kunjungan_harian_list_v1');
        for (let y = 2024; y <= 2030; y++) {
          localStorage.removeItem(`sikepling_sppt_pbb_records_${y}_v3`);
        }
        await clearIndexedDBReports().catch(() => {});
      } catch (e) {
        console.warn('Clear local keys warning:', e);
      }

      showToast('Seluruh data capaian, laporan & PBB berhasil dihapus bersih di aplikasi dan Firestore untuk entri CSV manual.', 'success');
    } catch (err) {
      console.error('Failed to reset reports:', err);
      showToast('Gagal mereset data laporan.', 'error');
    }
  };

  // Handle Login & Session Authentication
  const handleLoginSuccess = (account: UserAccount, remember: boolean) => {
    setActiveAccount(account);
    setIsLoggedIn(true);
    setPreselectedKepling(account);
    if (isPkkRole(account.role)) {
      setActiveTab('hub');
      setRiwayatFilterPetugas(undefined);
    } else if (account.role === 'super_admin') {
      setActiveTab('monitoring');
      setAdminPortalMode('kelurahan');
      setRiwayatFilterPetugas(undefined);
    } else if (account.role === 'petugas_bapenda') {
      setActiveTab('rekap_pbb');
      setRiwayatFilterPetugas(undefined);
    } else if (
      account.role === 'kasi_pemerintahan' ||
      account.role === 'kasi_pembangunan' ||
      account.role === 'kasi_trantibum'
    ) {
      setActiveTab('dashboard_kasi');
      setRiwayatFilterPetugas(undefined);
    } else {
      setActiveTab('form');
      setRiwayatFilterPetugas(account.nama);
    }
    try {
      if (remember) {
        safeSetLocalStorage('kepling_session_authenticated', 'true');
        safeSetLocalStorage('kepling_active_account_id', account.id);
      } else {
        safeSetSessionStorage('kepling_session_authenticated', 'true');
        localStorage.removeItem('kepling_session_authenticated');
      }
    } catch (e) {
      console.warn(e);
    }
    showToast(`Selamat datang, ${account.nama} (${account.lingkungan})!`, 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    try {
      localStorage.removeItem('kepling_session_authenticated');
      sessionStorage.removeItem('kepling_session_authenticated');
    } catch (e) {
      console.warn(e);
    }
    showToast('Anda telah keluar dari aplikasi.', 'info');
  };

  // If user is not authenticated, show secure LoginPage
  if (!isLoggedIn) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          onOpenPPTModal={() => setIsPPTModalOpen(true)}
        />

        {/* Floating Toast Notification on Login */}
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50 animate-bounce-short">
            <div
              className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
                toastMsg.type === 'success'
                  ? 'bg-emerald-800 text-white border-emerald-600'
                  : toastMsg.type === 'error'
                  ? 'bg-red-800 text-white border-red-600'
                  : 'bg-slate-800 text-white border-slate-700'
              }`}
            >
              {toastMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-300" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-300" />
              )}
              <span>{toastMsg.text}</span>
            </div>
          </div>
        )}

        {/* PWA / APK Install Modal */}
        <PWAInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />

        {/* Panduan PPT Kepling Modal */}
        <PanduanPPTModal
          isOpen={isPPTModalOpen}
          onClose={() => setIsPPTModalOpen(false)}
        />
      </>
    );
  }

  const todayDateStr = new Date().toISOString().split('T')[0];
  const hasAbsenToday = attendanceList.some(
    (a) => a.accountId === activeAccount.id && a.tanggal?.startsWith(todayDateStr)
  );
  const hasLaporToday = reports.some(
    (r) => r.petugasNama === activeAccount.nama && r.tanggalLaporan?.startsWith(todayDateStr)
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <HeaderBanner
        user={user}
        sheetMeta={sheetMeta}
        isConnecting={isConnecting}
        onConnectGoogle={handleConnectGoogle}
        onDisconnectGoogle={handleDisconnectGoogle}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenUbahPassword={() => setIsUbahPasswordOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onOpenPPTModal={() => setIsPPTModalOpen(true)}
        onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onLogout={handleLogout}
        portalMode={adminPortalMode}
      />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-short">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              toastMsg.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-600'
                : toastMsg.type === 'error'
                ? 'bg-red-800 text-white border-red-600'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-300" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-300" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      {/* Modern, Aesthetic Navigation Tabs Bar (Floating Glass Capsule Switcher) */}
      <div className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30 py-2.5 px-2 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex items-center gap-2 pr-2">
            {isPkkRole(activeAccount.role) ? (
              <>
                {/* PKK Tab 1: Pusat Menu PKK */}
                <button
                  id="tab-hub-pkk"
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'hub'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Compass className={`w-4 h-4 ${activeTab === 'hub' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Pusat Menu PKK</span>
                </button>

                {/* PKK Tab 2: Laporan Kegiatan PKK */}
                <button
                  id="tab-kegiatan-pkk"
                  type="button"
                  onClick={() => setActiveTab('kegiatan_pkk')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'kegiatan_pkk'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <FileText className={`w-4 h-4 ${activeTab === 'kegiatan_pkk' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Kegiatan PKK</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'kegiatan_pkk' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                    POKJA
                  </span>
                  {renderTabBadge('kegiatan_pkk')}
                </button>

                {/* PKK Tab 3: Laporan Keuangan BKU PKK */}
                <button
                  id="tab-keuangan-pkk"
                  type="button"
                  onClick={() => setActiveTab('keuangan_pkk')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'keuangan_pkk'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Wallet className={`w-4 h-4 ${activeTab === 'keuangan_pkk' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Keuangan PKK</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'keuangan_pkk' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                    BKU
                  </span>
                  {renderTabBadge('keuangan_pkk')}
                </button>

                {/* PKK Tab 4: Rekap Dasa Wisma & Posyandu 24 Lingkungan */}
                <button
                  id="tab-dasa-wisma-pkk"
                  type="button"
                  onClick={() => setActiveTab('dasa_wisma')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'dasa_wisma'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Users className={`w-4 h-4 ${activeTab === 'dasa_wisma' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Dasa Wisma</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'dasa_wisma' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                    24 LINGK.
                  </span>
                  {renderTabBadge('dasa_wisma')}
                </button>

                {/* PKK Tab 4b: Laporan Posyandu */}
                <button
                  id="tab-posyandu-pkk"
                  type="button"
                  onClick={() => setActiveTab('posyandu_pkk')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'posyandu_pkk'
                      ? 'bg-rose-700 text-white shadow-md shadow-rose-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Baby className={`w-4 h-4 ${activeTab === 'posyandu_pkk' ? 'text-white' : 'text-rose-600'}`} />
                  <span>Laporan Posyandu</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'posyandu_pkk' ? 'bg-rose-900 text-rose-100' : 'bg-rose-100 text-rose-800'}`}>
                    POKJA IV
                  </span>
                  {renderTabBadge('posyandu_pkk')}
                </button>

                {/* PKK Tab 5: 6 Buku Wajib PKK Kelurahan */}
                <button
                  id="tab-buku-pkk"
                  type="button"
                  onClick={() => setActiveTab('buku_pkk')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'buku_pkk'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <BookOpen className={`w-4 h-4 ${activeTab === 'buku_pkk' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>6 Buku Wajib PKK</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'buku_pkk' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                    BUKU I-VI
                  </span>
                  {renderTabBadge('buku_pkk')}
                </button>
              </>
            ) : activeAccount.role === 'kepling' ? (
              <>
                {/* Kepling Tab - Hub */}
                <button
                  id="tab-hub-kepling"
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'hub'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Compass className={`w-4 h-4 ${activeTab === 'hub' ? 'text-white' : 'text-emerald-600'}`} />
                  <span>Pusat Menu</span>
                </button>

                {/* Kepling Tab 0: Presensi Apel Pagi */}
                <button
                  id="tab-absen-apel-kepling"
                  type="button"
                  onClick={() => setIsAbsenApelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer whitespace-nowrap transition-all shadow-3xs"
                >
                  <UserCheck className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>Absen Apel Pagi</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-200 text-slate-950">
                    PRESENSI
                  </span>
                </button>

                {/* Kepling Tab Khusus: Absen Kegiatan */}
                <button
                  id="tab-kegiatan-khusus"
                  type="button"
                  onClick={() => setActiveTab('kegiatan_khusus')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'kegiatan_khusus'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 ${activeTab === 'kegiatan_khusus' ? 'text-white' : 'text-emerald-600'}`} />
                  <span>Absen Kegiatan Khusus</span>
                  {renderTabBadge('kegiatan_khusus')}
                </button>

                {/* Kepling Tab 1b: Kunjungan Harian Warga */}
                <button
                  id="tab-kunjungan-warga-kepling"
                  type="button"
                  onClick={() => setActiveTab('kunjungan')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'kunjungan'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Users className={`w-4 h-4 ${activeTab === 'kunjungan' ? 'text-white' : 'text-emerald-600'}`} />
                  <span>Kunjungan Harian</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'kunjungan' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                    WARGA
                  </span>
                  {renderTabBadge('kunjungan')}
                </button>

                {/* Kepling Tab 1: Formulir Laporan */}
                <button
                  id="tab-input-laporan"
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'form'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <FileText className={`w-4 h-4 ${activeTab === 'form' ? 'text-white' : 'text-emerald-600'}`} />
                  <span>Formulir Laporan</span>
                </button>

                {/* Kepling Tab 1c: Pemetaan Wilayah WebGIS & WRS */}
                <button
                  id="tab-pemetaan-kepling"
                  type="button"
                  onClick={() => setActiveTab('pemetaan')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'pemetaan'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Compass className={`w-4 h-4 ${activeTab === 'pemetaan' ? 'text-white' : 'text-emerald-600'}`} />
                  <span>Peta &amp; WRS</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'pemetaan' ? 'bg-tosca-700 text-tosca-100' : 'bg-amber-300 text-slate-950'}`}>
                    GIS
                  </span>
                </button>

                {/* Kepling Tab Realisasi Pembangunan */}
                <button
                  id="tab-pembangunan-kepling"
                  type="button"
                  onClick={() => setActiveTab('realisasi_pembangunan')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'realisasi_pembangunan'
                      ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Wrench className={`w-4 h-4 ${activeTab === 'realisasi_pembangunan' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Realisasi Pembangunan</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'realisasi_pembangunan' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                    INFRA
                  </span>
                  {renderTabBadge('realisasi_pembangunan')}
                </button>

                {/* Kepling Tab 2: Dashboard Capaian Saya */}
                <button
                  id="tab-capaian-kepling"
                  type="button"
                  onClick={() => setActiveTab('capaian')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'capaian'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <Award className={`w-4 h-4 ${activeTab === 'capaian' ? 'text-white' : 'text-amber-500'}`} />
                  <span>Dashboard Capaian</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'capaian' ? 'bg-tosca-700 text-tosca-100' : 'bg-amber-100 text-amber-800'}`}>
                    SAYA
                  </span>
                </button>

                {/* Kepling Tab 2b: Data PBB Lingkungan */}
                <button
                  id="tab-pbb-kepling"
                  type="button"
                  onClick={() => setActiveTab('rekap_pbb')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'rekap_pbb'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'rekap_pbb' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>PBB Lingkungan {activeAccount.nomorLingkungan || ''}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'rekap_pbb' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                    2026
                  </span>
                </button>

                {/* Kepling Tab 3: Riwayat Laporan Saya */}
                <button
                  id="tab-riwayat-laporan"
                  type="button"
                  onClick={() => {
                    setRiwayatFilterPetugas(activeAccount.nama);
                    setActiveTab('riwayat');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === 'riwayat'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                  }`}
                >
                  <History className={`w-4 h-4 ${activeTab === 'riwayat' ? 'text-white' : 'text-tosca-700'}`} />
                  <span>Riwayat Laporan Saya</span>
                  {renderTabBadge('riwayat')}
                </button>
              </>
            ) : (
              <>
                {/* Admin/Kasi Shared Tab - Hub */}
                {activeAccount.role !== 'petugas_bapenda' && (
                  <button
                    id="tab-hub-admin"
                    type="button"
                    onClick={() => setActiveTab('hub')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'hub'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Compass className={`w-4 h-4 ${activeTab === 'hub' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Pusat Menu</span>
                  </button>
                )}

                {/* Kasi Sektoral Dashboard Tab */}
                {(activeAccount.role === 'kasi_pemerintahan' ||
                  activeAccount.role === 'kasi_pembangunan' ||
                  activeAccount.role === 'kasi_trantibum') && (
                  <button
                    id="tab-dashboard-kasi"
                    type="button"
                    onClick={() => setActiveTab('dashboard_kasi')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'dashboard_kasi'
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Award className={`w-4 h-4 ${activeTab === 'dashboard_kasi' ? 'text-white' : 'text-teal-600'}`} />
                    <span>Dashboard Sektoral</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'dashboard_kasi' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-tosca-800'}`}>
                      {activeAccount.role === 'kasi_pemerintahan'
                        ? 'PBB & IKD'
                        : activeAccount.role === 'kasi_pembangunan'
                        ? 'PERLINSOS'
                        : activeAccount.role === 'kasi_trantibum'
                        ? 'TRANTIBUM'
                        : 'SEKTORAL'}
                    </span>
                  </button>
                )}

                {/* Kasi Pemerintahan & Super Admin: Realisasi PBB-P2 Tab */}
                {(activeAccount.role === 'kasi_pemerintahan' || activeAccount.role === 'super_admin' || activeAccount.role === 'petugas_bapenda') && (
                  <button
                    id="tab-rekap-pbb-kasi"
                    type="button"
                    onClick={() => setActiveTab('rekap_pbb')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'rekap_pbb'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'rekap_pbb' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Realisasi PBB</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'rekap_pbb' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                      {activeAccount.role === 'petugas_bapenda' ? 'BAPENDA' : '2026'}
                    </span>
                  </button>
                )}

                {/* Kasi Pemerintahan & Kasi Pembangunan: Database Data Keluarga */}
                {(activeAccount.role === 'kasi_pemerintahan' || activeAccount.role === 'kasi_pembangunan') && (
                  <button
                    id="tab-database-keluarga-kasi"
                    type="button"
                    onClick={() => setActiveTab('database_keluarga')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'database_keluarga'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Users className={`w-4 h-4 ${activeTab === 'database_keluarga' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Database Keluarga</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'database_keluarga' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                      KK
                    </span>
                  </button>
                )}

                {/* Kasi Pembangunan: Realisasi Pembangunan Tab */}
                {activeAccount.role === 'kasi_pembangunan' && (
                  <button
                    id="tab-pembangunan-kasi"
                    type="button"
                    onClick={() => setActiveTab('realisasi_pembangunan')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'realisasi_pembangunan'
                        ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Wrench className={`w-4 h-4 ${activeTab === 'realisasi_pembangunan' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Realisasi Pembangunan</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'realisasi_pembangunan' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                      INFRA
                    </span>
                    {renderTabBadge('realisasi_pembangunan')}
                  </button>
                )}

                {/* Kasi Pembangunan: Kunjungan Warga Tab */}
                {activeAccount.role === 'kasi_pembangunan' && (
                  <button
                    id="tab-kunjungan-kasi"
                    type="button"
                    onClick={() => setActiveTab('kunjungan')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'kunjungan'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Users className={`w-4 h-4 ${activeTab === 'kunjungan' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Kunjungan Warga</span>
                    {renderTabBadge('kunjungan')}
                  </button>
                )}

                {/* Kasi Trantibum: Pemetaan Poskamling Tab */}
                {activeAccount.role === 'kasi_trantibum' && (
                  <button
                    id="tab-pemetaan-kasi"
                    type="button"
                    onClick={() => setActiveTab('pemetaan')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'pemetaan'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <Compass className={`w-4 h-4 ${activeTab === 'pemetaan' ? 'text-white' : 'text-amber-700'}`} />
                    <span>Peta Poskamling</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'pemetaan' ? 'bg-amber-700 text-amber-100' : 'bg-amber-100 text-amber-900'}`}>
                      GIS
                    </span>
                  </button>
                )}

                {/* Kasi Sektoral: Riwayat Laporan Tab */}
                {(activeAccount.role === 'kasi_pemerintahan' ||
                  activeAccount.role === 'kasi_pembangunan' ||
                  activeAccount.role === 'kasi_trantibum') && (
                  <button
                    id="tab-riwayat-kasi"
                    type="button"
                    onClick={() => {
                      setRiwayatFilterPetugas(undefined);
                      setActiveTab('riwayat');
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      activeTab === 'riwayat'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                        : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                    }`}
                  >
                    <History className={`w-4 h-4 ${activeTab === 'riwayat' ? 'text-white' : 'text-tosca-700'}`} />
                    <span>Riwayat Laporan</span>
                    {renderTabBadge('riwayat')}
                  </button>
                )}

                {activeAccount.role === 'super_admin' && (
                  <>
                    {/* Super Admin Tab 1: Monitoring 24 Kepling */}
                    <button
                      id="tab-monitoring-super-admin"
                      type="button"
                      onClick={() => setActiveTab('monitoring')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'monitoring'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <ShieldCheck className={`w-4 h-4 ${activeTab === 'monitoring' ? 'text-white' : 'text-amber-600'}`} />
                      <span>Monitoring 24 Kepling</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'monitoring' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200 text-amber-950'}`}>
                        STATUS
                      </span>
                    </button>

                    {/* Super Admin Tab 2: Dashboard Capaian 24 Kepling */}
                    <button
                      id="tab-capaian-super-admin"
                      type="button"
                      onClick={() => setActiveTab('capaian_admin')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'capaian_admin'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <Trophy className={`w-4 h-4 ${activeTab === 'capaian_admin' ? 'text-white' : 'text-amber-600'}`} />
                      <span>Dashboard Capaian</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'capaian_admin' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                        24 KEPLING
                      </span>
                    </button>

                    {/* Super Admin Tab 3: Semua Riwayat Laporan */}
                    <button
                      id="tab-riwayat-laporan"
                      type="button"
                      onClick={() => {
                        setRiwayatFilterPetugas(undefined);
                        setActiveTab('riwayat');
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'riwayat'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <History className={`w-4 h-4 ${activeTab === 'riwayat' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>Semua Riwayat</span>
                      {renderTabBadge('riwayat')}
                    </button>

                    {/* Super Admin Tab 4: Kunjungan Harian 24 Kepling */}
                    <button
                      id="tab-kunjungan-warga-admin"
                      type="button"
                      onClick={() => setActiveTab('kunjungan')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'kunjungan'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <Users className={`w-4 h-4 ${activeTab === 'kunjungan' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>Kunjungan Harian</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'kunjungan' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                        24 LINGKUNGAN
                      </span>
                      {renderTabBadge('kunjungan')}
                    </button>

                    {/* Super Admin Tab 4b: Pemetaan WebGIS 24 Lingkungan */}
                    <button
                      id="tab-pemetaan-admin"
                      type="button"
                      onClick={() => setActiveTab('pemetaan')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'pemetaan'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <Compass className={`w-4 h-4 ${activeTab === 'pemetaan' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>WebGIS &amp; WRS</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'pemetaan' ? 'bg-tosca-700 text-tosca-100' : 'bg-amber-400 text-slate-950 shadow-3xs'}`}>
                        PETA 24
                      </span>
                    </button>

                    {/* Super Admin Tab Realisasi Pembangunan */}
                    <button
                      id="tab-pembangunan-admin"
                      type="button"
                      onClick={() => setActiveTab('realisasi_pembangunan')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'realisasi_pembangunan'
                          ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <Wrench className={`w-4 h-4 ${activeTab === 'realisasi_pembangunan' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>Realisasi Pembangunan</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'realisasi_pembangunan' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                        INFRA
                      </span>
                      {renderTabBadge('realisasi_pembangunan')}
                    </button>

                    {/* Super Admin Tab Surat Kedinasan */}
                    <button
                      id="tab-surat-kedinasan-admin"
                      type="button"
                      onClick={() => setActiveTab('surat_kedinasan')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'surat_kedinasan'
                          ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <FileText className={`w-4 h-4 ${activeTab === 'surat_kedinasan' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>Surat Kedinasan</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'surat_kedinasan' ? 'bg-tosca-800 text-tosca-100' : 'bg-tosca-100 text-tosca-900'}`}>
                        ARSIP
                      </span>
                      {renderTabBadge('surat_kedinasan')}
                    </button>

                    {/* Super Admin Tab 5: Input Formulir / Rangkuman Laporan */}
                    <button
                      id="tab-input-laporan"
                      type="button"
                      onClick={() => {
                        setSuperAdminFormSubMode('rangkuman');
                        setActiveTab('form');
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'form'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <FileText className={`w-4 h-4 ${activeTab === 'form' ? 'text-white' : 'text-tosca-700'}`} />
                      <span>Input Laporan</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${activeTab === 'form' ? 'bg-tosca-700 text-tosca-100' : 'bg-tosca-100 text-emerald-800'}`}>
                        RANGKUMAN
                      </span>
                    </button>

                    {/* Super Admin Tab 6: Kegiatan Khusus */}
                    <button
                      id="tab-kegiatan-khusus"
                      type="button"
                      onClick={() => setActiveTab('kegiatan_khusus')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        activeTab === 'kegiatan_khusus'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/10 scale-[1.02] font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-3xs'
                      }`}
                    >
                      <UserCheck className={`w-4 h-4 ${activeTab === 'kegiatan_khusus' ? 'text-white' : 'text-amber-600'}`} />
                      <span>Kegiatan Khusus</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {sheetMeta?.spreadsheetUrl && (
            <a
              id="link-buka-spreadsheet-nav"
              href={sheetMeta.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-black text-tosca-700 hover:text-emerald-800 bg-emerald-50 hover:bg-tosca-100 px-3.5 py-2 rounded-xl border border-emerald-200 shrink-0 transition-all shadow-3xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-tosca-700" />
              <span>Google Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-6 pb-24 md:pb-8 max-w-full overflow-x-hidden ${isModalOpen ? 'print:hidden' : ''}`}>
        {/* Global Compact Deadline Alert Bar for Kepling when outside dashboard */}
        {activeTab !== 'hub' && !isPkkRole(activeAccount.role) && (
          <div className="mb-4">
            <DeadlineNotifAlert
              activeAccount={activeAccount}
              reports={reports}
              onNavigate={(tab) => setActiveTab(tab)}
              compactMode={true}
            />
          </div>
        )}

        {/* Animated Container for Active Tab Content */}
        <div key={activeTab} className="animate-tab-fade">
          <React.Suspense fallback={<ViewLoadingFallback />}>
          {/* Smart Hub Dashboard Tab */}
          {activeTab === 'hub' && (
            isPkkRole(activeAccount.role) ? (
              <ErrorBoundary fallbackTitle="Gagal Memuat Pusat Menu PKK">
                <PkkHubDashboard
                  currentUser={activeAccount}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary fallbackTitle="Gagal Memuat Pusat Menu">
                <SmartHubDashboard
                  activeAccount={activeAccount}
                  reports={reports}
                  attendanceList={attendanceList}
                  unreadCounts={unreadCounts}
                  isGoogleConnected={Boolean(user && token)}
                  googleUserEmail={user?.email}
                  spreadsheetTitle={sheetMeta?.title}
                  onForceSyncAll={refreshAllReports}
                  onNavigate={(tab) => {
                    if (tab === 'riwayat') {
                      setRiwayatFilterPetugas(activeAccount.role === 'kepling' ? activeAccount.nama : undefined);
                    }
                    setActiveTab(tab);
                  }}
                  onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
                  onOpenPPTModal={() => setIsPPTModalOpen(true)}
                  onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                />
              </ErrorBoundary>
            )
          )}

        {/* Dashboard Kasi Sektoral */}
        {activeTab === 'dashboard_kasi' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Dashboard Kasi">
            {activeAccount.role === 'super_admin' && (
              <div className="mb-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Award className="w-4 h-4 text-teal-600" />
                  <span>Mode Monitoring Sektoral Lurah:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminSektoralView('pemerintahan')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      adminSektoralView === 'pemerintahan'
                        ? 'bg-tosca-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Kasi Pemerintahan (PBB, IKD & Apel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSektoralView('pembangunan')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      adminSektoralView === 'pembangunan'
                        ? 'bg-tosca-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Kasi Pembangunan & Kesos (Perlinsos)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSektoralView('trantibum')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      adminSektoralView === 'trantibum'
                        ? 'bg-tosca-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Kasi Trantibum & Linmas
                  </button>
                </div>
              </div>
            )}

            {(activeAccount.role === 'kasi_pemerintahan' ||
              (activeAccount.role === 'super_admin' && adminSektoralView === 'pemerintahan')) && (
              <DashboardPbbKasi
                reports={reports}
                targetsMap={targetsMap}
                currentUser={activeAccount}
                attendanceList={attendanceList}
                selectedDate={pemerintahanDate}
                onDateChange={setPemerintahanDate}
                onSelectKeplingRiwayat={(keplingName) => {
                  setRiwayatFilterPetugas(keplingName);
                  setActiveTab('riwayat');
                }}
                onOpenRekapPbb={() => setActiveTab('rekap_pbb')}
              />
            )}
            {(activeAccount.role === 'kasi_pembangunan' ||
              (activeAccount.role === 'super_admin' && adminSektoralView === 'pembangunan')) && (
              <DashboardPerlinsosKasi
                reports={reports}
                targetsMap={targetsMap}
                currentUser={activeAccount}
                onSelectKeplingRiwayat={(keplingName) => {
                  setRiwayatFilterPetugas(keplingName);
                  setActiveTab('riwayat');
                }}
                onOpenKunjunganWarga={() => setActiveTab('kunjungan')}
                onOpenDatabaseKeluarga={() => setActiveTab('database_keluarga')}
              />
            )}
            {(activeAccount.role === 'kasi_trantibum' ||
              (activeAccount.role === 'super_admin' && adminSektoralView === 'trantibum')) && (
              <DashboardTrantibumKasi
                reports={reports}
                currentUser={activeAccount}
                onSelectKeplingRiwayat={
                  activeAccount.role === 'super_admin'
                    ? (keplingName) => {
                        setRiwayatFilterPetugas(keplingName);
                        setActiveTab('riwayat');
                      }
                    : undefined
                }
              />
            )}
          </ErrorBoundary>
        )}

        {activeTab === 'form' && (
          activeAccount.role === 'super_admin' ? (
            <div className="space-y-4">
              {/* Sub-Header Mode Switcher Khusus Super Admin */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    id="btn-submode-rangkuman"
                    type="button"
                    onClick={() => setSuperAdminFormSubMode('rangkuman')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      superAdminFormSubMode === 'rangkuman'
                        ? 'bg-tosca-700 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 Rangkuman Seluruh Laporan (24 Kepling)
                  </button>
                  <button
                    id="btn-submode-formulir"
                    type="button"
                    onClick={() => setSuperAdminFormSubMode('formulir')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      superAdminFormSubMode === 'formulir'
                        ? 'bg-tosca-700 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📝 Formulir Input Asistensi Manual
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-semibold px-2">
                  {superAdminFormSubMode === 'rangkuman' ? (
                    <span className="text-tosca-700 font-bold">
                      ✓ Menampilkan rekapitulasi apel, kinerja, dan kunjungan warga (NIHIL jika belum melapor)
                    </span>
                  ) : (
                    <span>
                      Target Asistensi:{' '}
                      <strong className="text-slate-800">
                        {preselectedKepling ? `${preselectedKepling.lingkungan} (${preselectedKepling.nama})` : 'Pilih di Formulir'}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              {superAdminFormSubMode === 'rangkuman' ? (
                <ErrorBoundary fallbackTitle="Gagal Memuat Rangkuman Kelurahan">
                  <RangkumanLaporanKelurahan
                    reports={reports}
                    attendanceList={attendanceList}
                    kunjunganList={kunjunganList}
                    currentUser={activeAccount}
                    onOpenReportDetail={(report) => {
                      setSelectedReport(report);
                      setIsModalOpen(true);
                    }}
                    onDraftForKepling={(kepling) => {
                      setPreselectedKepling(kepling);
                      setSuperAdminFormSubMode('formulir');
                      showToast(`Formulir disiapkan untuk ${kepling.lingkungan} (${kepling.nama})`, 'info');
                    }}
                    onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
                    onRefreshData={() => refreshAllReports(true)}
                    isRefreshing={isRefreshingReports}
                  />
                </ErrorBoundary>
              ) : (
                <ErrorBoundary fallbackTitle="Gagal Memuat Formulir Laporan">
                  <FormLaporan
                    onSaveReport={handleSaveReport}
                    isSaving={isSaving}
                    hasGoogleAuth={Boolean(token)}
                    onConnectGoogle={handleConnectGoogle}
                    activeAccount={activeAccount}
                    preselectedKepling={preselectedKepling}
                    attendanceList={attendanceList}
                    onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
                    onBackToRangkuman={() => setSuperAdminFormSubMode('rangkuman')}
                  />
                </ErrorBoundary>
              )}
            </div>
          ) : (
            <ErrorBoundary fallbackTitle="Gagal Memuat Formulir Laporan">
              <FormLaporan
                onSaveReport={handleSaveReport}
                isSaving={isSaving}
                hasGoogleAuth={Boolean(token)}
                onConnectGoogle={handleConnectGoogle}
                activeAccount={activeAccount}
                preselectedKepling={preselectedKepling}
                attendanceList={attendanceList}
                onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
              />
            </ErrorBoundary>
          )
        )}

        {/* Dashboard Capaian Kepling Pribadi */}
        {activeTab === 'capaian' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Dashboard Capaian Kepling">
            <DashboardCapaianKepling
              reports={reports}
              activeAccount={activeAccount}
              mode="kepling"
              onSelectKeplingRiwayat={(keplingName) => {
                setRiwayatFilterPetugas(keplingName);
                setActiveTab('riwayat');
              }}
              onOpenReportDetail={(report) => {
                setSelectedReport(report);
                setIsModalOpen(true);
              }}
              onNavigateToForm={() => setActiveTab('form')}
              onNavigateToPemetaan={handleNavigateToPemetaan}
              onOpenRekapPbb={() => setActiveTab('rekap_pbb')}
              attendanceList={attendanceList}
              eventAttendanceList={eventAttendanceList}
              customEvents={customEvents}
              kunjunganList={kunjunganList}
            />
          </ErrorBoundary>
        )}

        {/* Dashboard Capaian 24 Kepling Super Admin */}
        {activeTab === 'capaian_admin' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Dashboard Capaian Admin">
            <DashboardCapaianKepling
              reports={reports}
              activeAccount={activeAccount}
              mode="super_admin"
              onSelectKeplingRiwayat={(keplingName) => {
                setRiwayatFilterPetugas(keplingName);
                setActiveTab('riwayat');
              }}
              onOpenReportDetail={(report) => {
                setSelectedReport(report);
                setIsModalOpen(true);
              }}
              onNavigateToForm={() => setActiveTab('form')}
              onNavigateToPemetaan={handleNavigateToPemetaan}
              onOpenRekapPbb={() => setActiveTab('rekap_pbb')}
              attendanceList={attendanceList}
              eventAttendanceList={eventAttendanceList}
              customEvents={customEvents}
              kunjunganList={kunjunganList}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'monitoring' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Monitoring Admin">
            <MonitoringSuperAdmin
              reports={reports}
              onSelectReport={(report) => {
                setSelectedReport(report);
                setIsModalOpen(true);
              }}
              onDraftForKepling={(kepling) => {
                setPreselectedKepling(kepling);
                setSuperAdminFormSubMode('formulir');
                setActiveTab('form');
                showToast(`Formulir disiapkan untuk ${kepling.lingkungan} (${kepling.nama})`, 'info');
              }}
              onSwitchToRiwayat={(keplingName) => {
                setRiwayatFilterPetugas(keplingName);
                setActiveTab('riwayat');
              }}
              onOpenCredentialBook={() => setIsAccountModalOpen(true)}
              onRefresh={() => refreshAllReports(true)}
              isRefreshing={isRefreshingReports}
              onResetReports={handleResetAllReports}
              onOpenCapaianDashboard={() => setActiveTab('capaian_admin')}
              onOpenPemetaan={handleNavigateToPemetaan}
              onOpenPbb={() => setActiveTab('rekap_pbb')}
              sheetMeta={sheetMeta}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'riwayat' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Riwayat Laporan">
            <RiwayatLaporan
              items={reports}
              isLoading={isLoadingReports || isRefreshingReports}
              onRefresh={() => refreshAllReports(true)}
              sheetMeta={sheetMeta}
              onSelectReport={(item) => {
                setSelectedReport(item);
                setIsModalOpen(true);
              }}
              hasGoogleAuth={Boolean(token)}
              initialPetugasFilter={riwayatFilterPetugas}
              isAdmin={isKelurahanAdmin(activeAccount.role)}
              activeAccount={activeAccount}
              onDeleteReport={handleDeleteReport}
            />
          </ErrorBoundary>
        )}

        {/* Tab Kunjungan Harian Warga (Door-to-Door) */}
        {activeTab === 'kunjungan' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Kunjungan Harian">
            <KunjunganHarianView
              currentUser={activeAccount}
              reports={reports}
              onNavigateToForm={() => setActiveTab('form')}
            />
          </ErrorBoundary>
        )}

        {/* Tab Kegiatan Khusus (Absen) */}
        {activeTab === 'kegiatan_khusus' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Absensi Kegiatan Khusus">
            <AbsenKegiatanKhusus
              activeAccount={activeAccount}
              showToast={showToast}
            />
          </ErrorBoundary>
        )}

        {/* Tab Pemetaan Wilayah WebGIS & WRS */}
        {activeTab === 'pemetaan' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Sistem Pemetaan WebGIS">
            <PemetaanWilayahView
              currentUser={activeAccount}
              onShowToast={showToast}
              initialLingkunganFilter={pemetaanTargetLingkungan}
              onOpenDatabaseKeluarga={() => setActiveTab('database_keluarga')}
            />
          </ErrorBoundary>
        )}

        {/* Tab Rekap Realisasi PBB */}
        {activeTab === 'rekap_pbb' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Realisasi PBB">
            <RekapPbbView activeAccount={activeAccount} onShowToast={showToast} />
          </ErrorBoundary>
        )}

        {/* Tab Database Data Keluarga (KK) */}
        {activeTab === 'database_keluarga' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Database Data Keluarga">
            <DatabaseKeluargaView
              currentUser={activeAccount}
              onShowToast={showToast}
              onNavigateToWebgis={(lat, lng) => {
                setActiveTab('pemetaan');
              }}
            />
          </ErrorBoundary>
        )}

        {/* Tab Realisasi Pembangunan */}
        {activeTab === 'realisasi_pembangunan' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Realisasi Pembangunan">
            <RealisasiPembangunanView currentUser={activeAccount} />
          </ErrorBoundary>
        )}

        {/* Tab Arsip Surat Kedinasan */}
        {activeTab === 'surat_kedinasan' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Arsip Surat Kedinasan">
            <SuratKedinasanView currentUser={activeAccount} onShowToast={showToast} />
          </ErrorBoundary>
        )}

        {/* Tab Laporan Kegiatan Tim Penggerak PKK */}
        {activeTab === 'kegiatan_pkk' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Laporan Kegiatan PKK">
            <PkkKegiatanView currentUser={activeAccount} />
          </ErrorBoundary>
        )}

        {/* Tab Rekapitulasi Dasa Wisma & Posyandu 24 Lingkungan */}
        {activeTab === 'dasa_wisma' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Buku Rekap Dasa Wisma">
            <PkkDasaWismaView currentUser={activeAccount} />
          </ErrorBoundary>
        )}

        {/* Tab Laporan Posyandu PKK */}
        {activeTab === 'posyandu_pkk' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Laporan Posyandu">
            <PkkPosyanduView currentUser={activeAccount} onShowToast={showToast} />
          </ErrorBoundary>
        )}

        {/* Tab Laporan Keuangan Tim Penggerak PKK */}
        {activeTab === 'keuangan_pkk' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Laporan Keuangan PKK">
            <LaporanKeuanganPkkView currentUser={activeAccount} />
          </ErrorBoundary>
        )}

        {/* Tab 6 Buku Wajib Administrasi PKK */}
        {activeTab === 'buku_pkk' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat 6 Buku Wajib PKK">
            <PkkBukuAdministrasiView currentUser={activeAccount} onShowToast={showToast} />
          </ErrorBoundary>
        )}
          </React.Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly for Kepling & Staff) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'riwayat') {
            setRiwayatFilterPetugas(activeAccount.role === 'kepling' ? activeAccount.nama : undefined);
          }
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        activeAccount={activeAccount}
        hasAbsenToday={hasAbsenToday}
        hasLaporToday={hasLaporToday}
        unreadCounts={unreadCounts}
      />

      {/* Modals with Lazy Loading */}
      <React.Suspense fallback={null}>
        {/* Account Selector Modal */}
        <AccountSelectorModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          activeAccount={activeAccount}
          sheetMeta={sheetMeta}
          onSelectAccount={(acc) => {
            setActiveAccount(acc);
            setPreselectedKepling(acc);
            try {
              localStorage.setItem('kepling_active_account_id', acc.id);
            } catch (e) {
              console.warn(e);
            }
            if (acc.role === 'super_admin') {
              showToast('Beralih ke akun SUPER ADMIN (Kelurahan Mangga)', 'success');
              setActiveTab('monitoring');
            } else if (
              acc.role === 'kasi_pemerintahan' ||
              acc.role === 'kasi_pembangunan' ||
              acc.role === 'kasi_trantibum'
            ) {
              showToast(`Beralih ke akun ${acc.jabatan}: ${acc.nama}`, 'success');
              setActiveTab('dashboard_kasi');
            } else {
              showToast(`Beralih ke akun ${acc.lingkungan}: ${acc.nama}`, 'success');
              setActiveTab('form');
            }
          }}
        />

        {/* PWA / APK Install Modal */}
        <PWAInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />

        {/* Ubah Password Modal */}
        <UbahPasswordModal
          isOpen={isUbahPasswordOpen}
          onClose={() => setIsUbahPasswordOpen(false)}
          activeAccount={activeAccount}
          onSuccess={(msg) => showToast(msg, 'success')}
        />

        {/* Edit Profil Modal */}
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          activeAccount={activeAccount}
          onProfileUpdated={(updatedAccount) => {
            setActiveAccount(updatedAccount);
            showToast(`Profil ${updatedAccount.nama} berhasil diperbarui.`, 'success');
          }}
        />

        {/* Detail Laporan Modal (No WhatsApp) */}
        <ErrorBoundary fallbackTitle="Gagal Memuat Detail Laporan">
          <DetailLaporanModal
            item={selectedReport}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            sheetMeta={sheetMeta}
            hasGoogleAuth={Boolean(token)}
            isAdmin={isKelurahanAdmin(activeAccount.role)}
            attendanceList={attendanceList}
            onUpdateReport={handleUpdateReport}
            onDeleteReport={handleDeleteReport}
          />
        </ErrorBoundary>

        {/* Panduan PPT Kepling Modal */}
        <PanduanPPTModal
          isOpen={isPPTModalOpen}
          onClose={() => setIsPPTModalOpen(false)}
        />

        {/* Absen Apel Pagi Modal */}
        <AbsenApelModal
          isOpen={isAbsenApelModalOpen}
          onClose={() => setIsAbsenApelModalOpen(false)}
          activeAccount={activeAccount}
          attendanceList={attendanceList}
          onRefreshAttendance={async () => {
            const fresh = await loadAllAttendance();
            setAttendanceList(fresh);
          }}
          showToast={showToast}
        />

        {/* App Update / What's New Modal */}
        <AppUpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      </React.Suspense>

      {/* Floating App Update Notification Toast Banner */}
      <AppUpdateToastBanner
        onOpenDetails={() => setIsUpdateModalOpen(true)}
      />

      {/* Footer matching Professional Polish style */}
      <footer className="bg-white border-t border-slate-200 px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center w-full print:hidden">
        <div className="flex items-center justify-center gap-2.5 mx-auto sm:mx-0">
          <span className="bg-[#991B1B] text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider uppercase shadow-xs">
            #MEDANUNTUKSEMUA
          </span>
          <span className="bg-[#1E3A8A] text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider uppercase shadow-xs">
            #SEMUAUNTUKMEDAN
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsUpdateModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-tosca-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-3 py-1 rounded-full transition-all cursor-pointer shadow-2xs mx-auto sm:mx-0"
          title="Klik untuk melihat catatan rilis versi dan fitur terbaru aplikasi"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>SI-MANGGA <strong>{CURRENT_APP_VERSION}</strong></span>
          <span className="text-slate-400">•</span>
          <span className="text-emerald-600 font-semibold">Info Pembaruan</span>
        </button>
      </footer>
    </div>
  );
}
