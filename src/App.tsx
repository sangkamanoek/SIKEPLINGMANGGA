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
} from 'lucide-react';
import ViewImagesPage from './components/ViewImagesPage';
import { GoogleUser, SheetMetadata, LaporanHarianItem, UserAccount } from './types';
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
import { SUPER_ADMIN_ACCOUNT, getAccountById, syncPasswordsWithServer, syncProfilesWithServer } from './data/keplingList';
import { HeaderBanner } from './components/HeaderBanner';
import { FormLaporan } from './components/FormLaporan';
import { RiwayatLaporan } from './components/RiwayatLaporan';
import { DetailLaporanModal } from './components/DetailLaporanModal';
import { AccountSelectorModal } from './components/AccountSelectorModal';
import { MonitoringSuperAdmin } from './components/MonitoringSuperAdmin';
import { DashboardCapaianKepling } from './components/DashboardCapaianKepling';
import { PWAInstallModal } from './components/PWAInstallModal';
import { PanduanPPTModal } from './components/PanduanPPTModal';
import { LoginPage } from './components/LoginPage';
import { UbahPasswordModal } from './components/UbahPasswordModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AbsenApelModal } from './components/AbsenApelModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AbsenApelItem } from './types';
import { loadAllAttendance } from './lib/attendanceApi';
import { subscribeAttendanceFromFirestore } from './lib/firestoreService';
import { consolidateDailyReport } from './lib/reportConsolidator';
import {
  fetchAllReports,
  saveReportToServer,
  deleteReportFromServer,
  resetAllReportsOnServer,
  subscribeReportsFromFirestore,
  getLocalDeletedReportIds,
} from './lib/reportsApi';

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
  const [attendanceList, setAttendanceList] = useState<AbsenApelItem[]>([]);
  const [preselectedKepling, setPreselectedKepling] = useState<UserAccount | null>(null);
  const [riwayatFilterPetugas, setRiwayatFilterPetugas] = useState<string | undefined>(undefined);

  // Active view tab: form | capaian | monitoring | capaian_admin | riwayat
  const [activeTab, setActiveTab] = useState<
    'form' | 'capaian' | 'monitoring' | 'capaian_admin' | 'riwayat'
  >(() => {
    return activeAccount.role === 'super_admin' ? 'monitoring' : 'form';
  });

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

  // Load local backup reports
  const loadLocalReports = () => {
    try {
      const deletedIds = getLocalDeletedReportIds();
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_LAPORAN);
      if (stored) {
        const parsed: LaporanHarianItem[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const active = parsed.filter((r) => r && r.id && !deletedIds.has(r.id));
          setReports(active);
          safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(active));
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
    syncPasswordsWithServer();
    syncProfilesWithServer();
    loadLocalReports();
    refreshAllReports(false);
    loadAllAttendance().then((items) => setAttendanceList(items));

    // Subscribe to real-time reports directly from Firebase Firestore
    const unsubscribeFirestoreReports = subscribeReportsFromFirestore((firestoreReports) => {
      if (firestoreReports && firestoreReports.length >= 0) {
        setReports(firestoreReports);
        safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(firestoreReports));
      }
    });

    // Subscribe to real-time attendance directly from Firebase Firestore
    const unsubscribeAttendance = subscribeAttendanceFromFirestore((items) => {
      if (items) {
        setAttendanceList(items);
      }
    });

    // Auto-sync polling every 15 seconds as a resilient backup
    const pollInterval = setInterval(() => {
      refreshAllReports(false);
    }, 15000);

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
      unsubscribeFirestoreReports();
      unsubscribeAttendance();
      clearInterval(pollInterval);
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

  // Reset all reports handler
  const handleResetAllReports = async () => {
    try {
      setReports([]);
      setSelectedReport(null);
      await resetAllReportsOnServer();
      showToast('Seluruh data laporan berhasil direset di server dan dashboard.', 'info');
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
    if (account.role === 'super_admin') {
      setActiveTab('monitoring');
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

                {/* Super Admin Tab 4: Input Formulir (Bantuan/Asistensi) */}
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
      <main className={`flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 ${isModalOpen ? 'print:hidden' : ''}`}>
        {activeTab === 'form' && (
          <FormLaporan
            onSaveReport={handleSaveReport}
            isSaving={isSaving}
            hasGoogleAuth={Boolean(token)}
            onConnectGoogle={handleConnectGoogle}
            activeAccount={activeAccount}
            preselectedKepling={preselectedKepling}
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
              onOpenCapaianDashboard={() => setActiveTab('capaian_admin')}
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
              isAdmin={activeAccount.role === 'super_admin'}
              onDeleteReport={handleDeleteReport}
            />
          </ErrorBoundary>
        )}
      </main>

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
          isAdmin={activeAccount.role === 'super_admin'}
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
