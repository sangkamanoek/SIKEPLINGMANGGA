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
} from 'lucide-react';
import ViewImagesPage from './components/ViewImagesPage';
import { KunjunganHarianView } from './components/KunjunganHarianView';
import { GoogleUser, SheetMetadata, LaporanHarianItem, UserAccount, TargetsCapaianMap, isKelurahanAdmin } from './types';
import { safeSetLocalStorage, safeSetSessionStorage } from './lib/safeStorage';
import {
  initAuth,
  googleSignIn,
  logout,
  setAccessToken,
  getAccessToken,
} from './lib/firebase';
import {
  getOrCreateSpreadsheet,
  appendLaporanToSheet,
} from './lib/sheetsService';
import { uploadMakalahToGoogleDrive } from './lib/driveService';
import { SUPER_ADMIN_ACCOUNT, getAccountById, syncPasswordsWithServer, syncProfilesWithServer, syncAccountsWithServer } from './data/keplingList';
import { HeaderBanner } from './components/HeaderBanner';
import { FormLaporan } from './components/FormLaporan';
import { RiwayatLaporan } from './components/RiwayatLaporan';
import { DetailLaporanModal } from './components/DetailLaporanModal';
import { AccountSelectorModal } from './components/AccountSelectorModal';
import { MonitoringSuperAdmin } from './components/MonitoringSuperAdmin';
import { DashboardCapaianKepling } from './components/DashboardCapaianKepling';
import { DashboardPbbKasi } from './components/DashboardPbbKasi';
import { DashboardPerlinsosKasi } from './components/DashboardPerlinsosKasi';
import { DashboardTrantibumKasi } from './components/DashboardTrantibumKasi';
import { getDefaultTargetsCapaianMap } from './data/targetsData';
import { fetchTargetsCapaian, subscribeTargetsFromFirestore } from './lib/targetsApi';
import { PWAInstallModal } from './components/PWAInstallModal';
import { PanduanPPTModal } from './components/PanduanPPTModal';
import { customFetch } from './lib/fetchInterceptor';
import { AbsenKegiatanKhusus } from './components/AbsenKegiatanKhusus';
import { SmartHubDashboard } from './components/SmartHubDashboard';
import { RekapPbbView } from './components/RekapPbbView';
import { PemetaanWilayahView } from './components/PemetaanWilayahView';
import { LoginPage } from './components/LoginPage';
import { UbahPasswordModal } from './components/UbahPasswordModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AbsenApelModal } from './components/AbsenApelModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AbsenApelItem } from './types';
import { loadAllAttendance } from './lib/attendanceApi';
import { subscribeAttendanceFromFirestore, wipeAllFirestoreCapaianData, subscribeCustomEventsFromFirestore } from './lib/firestoreService';
import { CustomEvent } from './types';
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
  seedInitialReports,
} from './lib/reportsApi';
import { getReportsFromIndexedDB, clearIndexedDBReports } from './lib/indexedDbStorage';
import { KNOWN_STORAGE_KEYS } from './lib/reportsApi';
import { purgeAllClientCache } from './lib/purgeCache';

const LOCAL_STORAGE_KEY_LAPORAN = 'kepling_local_laporan_history_v2';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewImagesId = urlParams.get('view-images');
  if (viewImagesId) {
    return <ViewImagesPage reportId={viewImagesId} />;
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
        if (parsed?.title === 'SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA') return parsed;
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
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [attendanceList, setAttendanceList] = useState<AbsenApelItem[]>([]);
  const [preselectedKepling, setPreselectedKepling] = useState<UserAccount | null>(null);
  const [riwayatFilterPetugas, setRiwayatFilterPetugas] = useState<string | undefined>(undefined);

  // Active view tab: hub | form | capaian | monitoring | capaian_admin | riwayat | kunjungan | dashboard_kasi | kegiatan_khusus | pemetaan
  const [activeTab, setActiveTab] = useState<
    'hub' | 'form' | 'capaian' | 'monitoring' | 'capaian_admin' | 'riwayat' | 'kunjungan' | 'dashboard_kasi' | 'kegiatan_khusus' | 'pemetaan' | 'rekap_pbb'
  >('hub');

  // Targeted lingkungan for Pemetaan WebGIS deep-linking
  const [pemetaanTargetLingkungan, setPemetaanTargetLingkungan] = useState<string | undefined>(undefined);

  const handleNavigateToPemetaan = (lingkunganNomor?: number | string) => {
    if (lingkunganNomor !== undefined && lingkunganNomor !== null && String(lingkunganNomor).trim() !== '') {
      const rawStr = String(lingkunganNomor).trim();
      const idVal = rawStr.startsWith('kepling_') ? rawStr : `kepling_${rawStr}`;
      setPemetaanTargetLingkungan(idVal);
    } else {
      setPemetaanTargetLingkungan(undefined);
    }
    setActiveTab('pemetaan');
  };

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

  // Modal detail view
  const [selectedReport, setSelectedReport] = useState<LaporanHarianItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Floating Toast notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Centralized report fetcher: reads from server with local cache fallback
  const refreshAllReports = useCallback(async (showNotification = false) => {
    setIsRefreshingReports(true);
    try {
      const serverReports = await fetchAllReports();
      if (serverReports) {
        setReports(serverReports);
        if (showNotification) {
          showToast(`Data berhasil diperbarui (${serverReports.length} laporan tersedia)`, 'success');
        }
      }
    } catch (e) {
      console.warn('Could not refresh reports from server:', e);
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
    // Register aggressive cache-clearing service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('[App] Service worker registered:', registration.scope);
      }).catch((err) => {
        console.error('[App] Service worker registration failed:', err);
      });
    }

    // Instantly load cached local reports to populate the UI in 10ms (Buttery-smooth startup)
    loadLocalReports();

    syncPasswordsWithServer();
    syncProfilesWithServer();
    syncAccountsWithServer();
    refreshAllReports(false);
    loadAllAttendance().then((items) => setAttendanceList(items));
    fetchTargetsCapaian().then((data) => {
      if (data) setTargetsMap(data);
    });

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
          
          console.log(`[App State Sync] Merged ${reportMap.size} reports from Firestore subscription.`);

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

          // Cache merged reports to LocalStorage for offline speed on next reload
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
      unsubscribeTargets();
      unsubscribeFirestoreReports();
      unsubscribeAttendance();
      unsubscribeEvents();
      clearInterval(pollNotifications);
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

  // Seed / restore initial official reports for 24 Kepling
  const handleSeedInitialReports = async () => {
    setIsRefreshingReports(true);
    try {
      const seeded = await seedInitialReports();
      if (seeded && seeded.length > 0) {
        setReports(seeded);
        showToast(`Berhasil memuat ${seeded.length} data laporan historis 24 Kepling!`, 'success');
      } else {
        await refreshAllReports(true);
      }
    } catch (err) {
      console.error('Failed to seed reports:', err);
      showToast('Gagal memuat data laporan awal.', 'error');
    } finally {
      setIsRefreshingReports(false);
    }
  };

  // Handle Login & Session Authentication
  const handleLoginSuccess = (account: UserAccount, remember: boolean) => {
    setActiveAccount(account);
    setIsLoggedIn(true);
    setPreselectedKepling(account);
    if (account.role === 'super_admin') {
      setActiveTab('monitoring');
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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
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
        onLogout={handleLogout}
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
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between overflow-x-auto">
          <div className="flex gap-1">
            {activeAccount.role === 'kepling' ? (
              <>
                {/* Kepling Tab - Hub */}
                <button
                  id="tab-hub-kepling"
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'hub'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <span>Pusat Menu</span>
                </button>

                {/* Kepling Tab 0: Presensi Apel Pagi */}
                <button
                  id="tab-absen-apel-kepling"
                  type="button"
                  onClick={() => setIsAbsenApelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-black border-b-2 border-transparent text-amber-700 hover:text-amber-900 hover:bg-amber-50 cursor-pointer whitespace-nowrap"
                >
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>Absen Apel Pagi</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-400 text-slate-950 shadow-2xs">
                    PRESENSI
                  </span>
                </button>

                {/* Kepling Tab Khusus: Absen Kegiatan */}
                <button
                  id="tab-kegiatan-khusus"
                  type="button"
                  onClick={() => setActiveTab('kegiatan_khusus')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'kegiatan_khusus'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span>Absen Kegiatan Khusus</span>
                </button>

                {/* Kepling Tab 1b: Kunjungan Harian Warga */}
                <button
                  id="tab-kunjungan-warga-kepling"
                  type="button"
                  onClick={() => setActiveTab('kunjungan')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'kunjungan'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>Kunjungan Harian</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                    WARGA
                  </span>
                </button>

                {/* Kepling Tab 1: Formulir Laporan */}
                <button
                  id="tab-input-laporan"
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'form'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Formulir Laporan</span>
                </button>

                {/* Kepling Tab 1c: Pemetaan Wilayah WebGIS & WRS */}
                <button
                  id="tab-pemetaan-kepling"
                  type="button"
                  onClick={() => setActiveTab('pemetaan')}
                  className={`inline-flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'pemetaan'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <span>Peta &amp; WRS</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-300 text-slate-950">
                    GIS
                  </span>
                </button>

                {/* Kepling Tab 2: Dashboard Capaian Saya */}
                <button
                  id="tab-capaian-kepling"
                  type="button"
                  onClick={() => setActiveTab('capaian')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'capaian'
                      ? 'border-emerald-600 text-emerald-900 bg-emerald-50/70 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Dashboard Capaian</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                    SAYA
                  </span>
                </button>

                {/* Kepling Tab 2b: Data PBB Lingkungan */}
                <button
                  id="tab-pbb-kepling"
                  type="button"
                  onClick={() => setActiveTab('rekap_pbb')}
                  className={`inline-flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'rekap_pbb'
                      ? 'border-emerald-600 text-emerald-900 bg-emerald-50/70 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>PBB Lingkungan {activeAccount.nomorLingkungan || ''}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
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
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'riwayat'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <History className="w-4 h-4 text-emerald-700" />
                  <span>Riwayat Laporan Saya</span>
                </button>
              </>
            ) : (
              <>
                {/* Admin/Kasi Shared Tab - Hub */}
                <button
                  id="tab-hub-admin"
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'hub'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <span>Pusat Menu</span>
                </button>

                {/* Kasi Sektoral Dashboard Tab */}
                {(activeAccount.role === 'kasi_pemerintahan' ||
                  activeAccount.role === 'kasi_pembangunan' ||
                  activeAccount.role === 'kasi_trantibum' ||
                  activeAccount.role === 'super_admin') && (
                  <button
                    id="tab-dashboard-kasi"
                    type="button"
                    onClick={() => setActiveTab('dashboard_kasi')}
                    className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === 'dashboard_kasi'
                        ? 'border-teal-600 text-teal-950 bg-teal-50 font-black'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Award className="w-4 h-4 text-teal-600" />
                    <span>Dashboard Sektoral</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-teal-100 text-teal-800">
                      {activeAccount.role === 'kasi_pemerintahan'
                        ? 'PBB'
                        : activeAccount.role === 'kasi_pembangunan'
                        ? 'PERLINSOS'
                        : activeAccount.role === 'kasi_trantibum'
                        ? 'TRANTIB'
                        : 'SEKTORAL'}
                    </span>
                  </button>
                )}
                {(activeAccount.role === 'kasi_pemerintahan' || activeAccount.role === 'super_admin') && (
                  <button
                    id="tab-rekap-pbb-kasi"
                    type="button"
                    onClick={() => setActiveTab('rekap_pbb')}
                    className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === 'rekap_pbb'
                        ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Realisasi PBB</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                      2026
                    </span>
                  </button>
                )}

                {activeAccount.role === 'super_admin' && (
                  <>
                    {/* Super Admin Tab 0: Absen Apel Pagi 24 Kepling */}
                    <button
                      id="tab-absen-apel-admin"
                      type="button"
                      onClick={() => setIsAbsenApelModalOpen(true)}
                      className="inline-flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-black border-b-2 border-transparent text-amber-900 hover:bg-amber-100/70 cursor-pointer whitespace-nowrap"
                    >
                      <UserCheck className="w-4 h-4 text-amber-600" />
                      <span>Absen Apel Pagi</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-400 text-slate-950 shadow-2xs">
                        REKAP 24
                      </span>
                    </button>

                    {/* Super Admin Tab 1: Monitoring 24 Kepling */}
                    <button
                      id="tab-monitoring-super-admin"
                      type="button"
                      onClick={() => setActiveTab('monitoring')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'monitoring'
                          ? 'border-amber-500 text-amber-900 bg-amber-50/80 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Monitoring 24 Kepling</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-200 text-amber-950">
                        STATUS
                      </span>
                    </button>

                    {/* Super Admin Tab 2: Dashboard Capaian 24 Kepling */}
                    <button
                      id="tab-capaian-super-admin"
                      type="button"
                      onClick={() => setActiveTab('capaian_admin')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'capaian_admin'
                          ? 'border-amber-500 text-amber-900 bg-amber-50/80 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <span>Dashboard Capaian</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
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
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'riwayat'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <History className="w-4 h-4 text-emerald-700" />
                      <span>Semua Riwayat</span>
                      {reports.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold">
                          {reports.length}
                        </span>
                      )}
                    </button>

                    {/* Super Admin Tab 4: Kunjungan Harian 24 Kepling */}
                    <button
                      id="tab-kunjungan-warga-admin"
                      type="button"
                      onClick={() => setActiveTab('kunjungan')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'kunjungan'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span>Kunjungan Harian</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                        24 LINGKUNGAN
                      </span>
                    </button>

                    {/* Super Admin Tab 4b: Pemetaan WebGIS 24 Lingkungan */}
                    <button
                      id="tab-pemetaan-admin"
                      type="button"
                      onClick={() => setActiveTab('pemetaan')}
                      className={`inline-flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'pemetaan'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Compass className="w-4 h-4 text-emerald-700" />
                      <span>WebGIS &amp; WRS</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-400 text-slate-950 shadow-2xs">
                        PETA 24
                      </span>
                    </button>

                    {/* Super Admin Tab 5: Input Formulir (Bantuan/Asistensi) */}
                    <button
                      id="tab-input-laporan"
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'form'
                          ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>Input Laporan</span>
                    </button>

                    {/* Super Admin Tab 6: Kegiatan Khusus */}
                    <button
                      id="tab-kegiatan-khusus"
                      type="button"
                      onClick={() => setActiveTab('kegiatan_khusus')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'kegiatan_khusus'
                          ? 'border-amber-500 text-amber-900 bg-amber-50/80 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-amber-600" />
                      <span>Kegiatan Khusus</span>
                    </button>

                    {/* Super Admin Tab 7: Realisasi PBB */}
                    <button
                      id="tab-rekap-pbb-admin"
                      type="button"
                      onClick={() => setActiveTab('rekap_pbb')}
                      className={`inline-flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'rekap_pbb'
                          ? 'border-amber-500 text-amber-900 bg-amber-50/80 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                      <span>Realisasi PBB</span>
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
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 pl-3"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-6 pb-24 md:pb-8 ${isModalOpen ? 'print:hidden' : ''}`}>
        {/* Smart Hub Dashboard Tab */}
        {activeTab === 'hub' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Pusat Menu">
            <SmartHubDashboard
              activeAccount={activeAccount}
              reports={reports}
              attendanceList={attendanceList}
              onNavigate={(tab) => {
                if (tab === 'riwayat') {
                  setRiwayatFilterPetugas(activeAccount.role === 'kepling' ? activeAccount.nama : undefined);
                }
                setActiveTab(tab);
              }}
              onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
              onOpenPPTModal={() => setIsPPTModalOpen(true)}
            />
          </ErrorBoundary>
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
                        ? 'bg-teal-700 text-white shadow-xs'
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
                        ? 'bg-teal-700 text-white shadow-xs'
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
                        ? 'bg-teal-700 text-white shadow-xs'
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
              />
            )}
            {(activeAccount.role === 'kasi_trantibum' ||
              (activeAccount.role === 'super_admin' && adminSektoralView === 'trantibum')) && (
              <DashboardTrantibumKasi
                reports={reports}
                currentUser={activeAccount}
                onSelectKeplingRiwayat={(keplingName) => {
                  setRiwayatFilterPetugas(keplingName);
                  setActiveTab('riwayat');
                }}
              />
            )}
          </ErrorBoundary>
        )}

        {activeTab === 'form' && (
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
        )}

        {/* Dashboard Capaian Kepling Pribadi */}
        {activeTab === 'capaian' && (
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
          />
        )}

        {/* Dashboard Capaian 24 Kepling Super Admin */}
        {activeTab === 'capaian_admin' && (
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
          />
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
              onSeedInitialReports={handleSeedInitialReports}
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
              onDeleteReport={handleDeleteReport}
            />
          </ErrorBoundary>
        )}

        {/* Tab Kunjungan Harian Warga (Door-to-Door) */}
        {activeTab === 'kunjungan' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Kunjungan Harian">
            <KunjunganHarianView
              currentUser={activeAccount}
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
            />
          </ErrorBoundary>
        )}

        {/* Tab Rekap Realisasi PBB */}
        {activeTab === 'rekap_pbb' && (
          <ErrorBoundary fallbackTitle="Gagal Memuat Realisasi PBB">
            <RekapPbbView activeAccount={activeAccount} onShowToast={showToast} />
          </ErrorBoundary>
        )}
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
      />

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

      {/* Footer matching Professional Polish style */}
      <footer className="bg-white border-t border-slate-200 px-4 py-3.5 flex items-center justify-center text-center w-full print:hidden">
        <div className="flex items-center justify-center gap-2.5 mx-auto">
          <span className="bg-[#991B1B] text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider uppercase shadow-xs">
            #MEDANUNTUKSEMUA
          </span>
          <span className="bg-[#1E3A8A] text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider uppercase shadow-xs">
            #SEMUAUNTUKMEDAN
          </span>
        </div>
      </footer>
    </div>
  );
}
