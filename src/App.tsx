import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserAccount, LaporanHarianItem, AbsenApelItem, isPkkRole } from './types';
import {
  SUPER_ADMIN_ACCOUNT,
  ALL_ACCOUNTS,
  getEffectiveProfile,
  syncProfilesWithServer,
  syncBuku1ToPkkProfiles,
} from './data/keplingList';
import { HeaderBanner } from './components/HeaderBanner';
import { MobileBottomNav, AppTabType } from './components/MobileBottomNav';
import { SmartHubDashboard } from './components/SmartHubDashboard';
import { LoginPage } from './components/LoginPage';
import { TopNavigationBar } from './components/TopNavigationBar';
import { KeplingAlertBanner } from './components/KeplingAlertBanner';
import { AppUpdateToastBanner } from './components/AppUpdateToastBanner';
import { ComponentLoader } from './components/ComponentLoader';

// Modals - Eager for fast user interaction
import { AccountSelectorModal } from './components/AccountSelectorModal';
import { AbsenApelModal } from './components/AbsenApelModal';
import { UbahPasswordModal } from './components/UbahPasswordModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { NotifikasiSoundSettingsModal } from './components/NotifikasiSoundSettingsModal';

// Heavy Modals - Lazy loaded
const PanduanPPTModal = React.lazy(() =>
  import('./components/PanduanPPTModal').then((m) => ({ default: m.PanduanPPTModal }))
);
const SyncVerificationModal = React.lazy(() =>
  import('./components/SyncVerificationModal').then((m) => ({ default: m.SyncVerificationModal }))
);
const DetailLaporanModal = React.lazy(() =>
  import('./components/DetailLaporanModal').then((m) => ({ default: m.DetailLaporanModal }))
);

// Heavy Views & Modules - Lazy loaded for lightning-fast initial page paint
const FormLaporan = React.lazy(() =>
  import('./components/FormLaporan').then((m) => ({ default: m.FormLaporan }))
);
const MonitoringSuperAdmin = React.lazy(() =>
  import('./components/MonitoringSuperAdmin').then((m) => ({ default: m.MonitoringSuperAdmin }))
);
const RiwayatLaporan = React.lazy(() =>
  import('./components/RiwayatLaporan').then((m) => ({ default: m.RiwayatLaporan }))
);
const RekapPbbView = React.lazy(() =>
  import('./components/RekapPbbView').then((m) => ({ default: m.RekapPbbView }))
);
const DashboardCapaianKepling = React.lazy(() =>
  import('./components/DashboardCapaianKepling').then((m) => ({ default: m.DashboardCapaianKepling }))
);
const RekapAbsensiSuperAdmin = React.lazy(() =>
  import('./components/RekapAbsensiSuperAdmin').then((m) => ({ default: m.RekapAbsensiSuperAdmin }))
);
const SuratKedinasanView = React.lazy(() =>
  import('./components/SuratKedinasanView').then((m) => ({ default: m.SuratKedinasanView }))
);
const RealisasiPembangunanView = React.lazy(() =>
  import('./components/RealisasiPembangunanView').then((m) => ({ default: m.RealisasiPembangunanView }))
);
const DaftarTugasKhususView = React.lazy(() =>
  import('./components/DaftarTugasKhususView').then((m) => ({ default: m.DaftarTugasKhususView }))
);
const AgendaKelurahanView = React.lazy(() =>
  import('./components/AgendaKelurahanView').then((m) => ({ default: m.AgendaKelurahanView }))
);
const AbsenKegiatanKhusus = React.lazy(() =>
  import('./components/AbsenKegiatanKhusus').then((m) => ({ default: m.AbsenKegiatanKhusus }))
);
const KunjunganHarianView = React.lazy(() =>
  import('./components/KunjunganHarianView').then((m) => ({ default: m.KunjunganHarianView }))
);
const DashboardPbbKasi = React.lazy(() =>
  import('./components/DashboardPbbKasi').then((m) => ({ default: m.DashboardPbbKasi }))
);
const DashboardPerlinsosKasi = React.lazy(() =>
  import('./components/DashboardPerlinsosKasi').then((m) => ({ default: m.DashboardPerlinsosKasi }))
);
const DashboardTrantibumKasi = React.lazy(() =>
  import('./components/DashboardTrantibumKasi').then((m) => ({ default: m.DashboardTrantibumKasi }))
);
const PkkHubDashboard = React.lazy(() =>
  import('./components/PkkHubDashboard').then((m) => ({ default: m.PkkHubDashboard }))
);
const PkkBukuAdministrasiView = React.lazy(() =>
  import('./components/PkkBukuAdministrasiView').then((m) => ({ default: m.PkkBukuAdministrasiView }))
);
const PkkKegiatanView = React.lazy(() =>
  import('./components/PkkKegiatanView').then((m) => ({ default: m.PkkKegiatanView }))
);
const PkkDasaWismaView = React.lazy(() =>
  import('./components/PkkDasaWismaView').then((m) => ({ default: m.PkkDasaWismaView }))
);
const PkkPosyanduView = React.lazy(() =>
  import('./components/PkkPosyanduView').then((m) => ({ default: m.PkkPosyanduView }))
);
const LaporanKeuanganPkkView = React.lazy(() =>
  import('./components/LaporanKeuanganPkkView').then((m) => ({ default: m.LaporanKeuanganPkkView }))
);

import { useFeatureNotifications } from './hooks/useFeatureNotifications';
import { useAgendaTugasRealtimeAlert } from './hooks/useAgendaTugasRealtimeAlert';

import { getDefaultTargetsCapaianMap } from './data/targetsData';
import { fetchAllReports, saveReportToServer, subscribeReportsFromFirestore, deleteReportFromServer } from './lib/reportsApi';
import { subscribeKunjungan, getLocalKunjunganList, KunjunganWargaData } from './lib/kunjunganService';
import { getTodayLocalIso } from './lib/formatter';
import { safeGetLocalStorage, safeSetLocalStorage } from './lib/safeStorage';
import { subscribeAttendance, loadAllAttendance } from './lib/attendanceApi';
import {
  getReportsFromIndexedDB,
  getVisitsFromIndexedDB,
  saveReportsToIndexedDB,
  saveVisitsToIndexedDB,
} from './lib/indexedDbStorage';
import { subscribeTargetsFromFirestore } from './lib/firestoreService';
import { consolidateDailyReport, consolidateAllReports, findMatchingDailyReport } from './lib/reportConsolidator';

const ACTIVE_ACCOUNT_STORAGE_KEY = 'sikepling_active_account_id';
const ACTIVE_TAB_STORAGE_KEY = 'sikepling_active_tab_v2';
const LAPORAN_LOCAL_KEY = 'kepling_local_laporan_history_v2';

export default function App() {
  // Active Account State & Login Status
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  const [activeAccount, setActiveAccount] = useState<UserAccount>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (savedId) {
        const found = ALL_ACCOUNTS.find(
          (a) => a.id === savedId || (a.aliases && a.aliases.includes(savedId))
        );
        if (found) return getEffectiveProfile(found);
      }
    } catch {}
    return getEffectiveProfile(SUPER_ADMIN_ACCOUNT);
  });

  // Active Tab State
  const [activeTab, setActiveTab] = useState<AppTabType>(() => {
    try {
      const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as AppTabType;
      if (savedTab) return savedTab;
    } catch {}
    return 'hub';
  });

  // Data States
  const [reports, setReports] = useState<LaporanHarianItem[]>(() => {
    return safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_LOCAL_KEY, []);
  });
  const [kunjunganList, setKunjunganList] = useState<KunjunganWargaData[]>(() => getLocalKunjunganList());
  const [attendanceList, setAttendanceList] = useState<AbsenApelItem[]>(() => loadAllAttendance());
  const [presensiSubTab, setPresensiSubTab] = useState<'apel' | 'khusus'>('apel');
  const [selectedAbsensiDate, setSelectedAbsensiDate] = useState<string>(() => getTodayLocalIso());
  const [targetsMap, setTargetsMap] = useState(getDefaultTargetsCapaianMap);
  const [selectedRiwayatKepling, setSelectedRiwayatKepling] = useState<string>('');

  // Sinkronisasi otomatis: Presensi yang dicatat di Form Laporan otomatis digabung ke attendanceList
  const effectiveAttendanceList = useMemo(() => {
    const list = [...attendanceList];
    const existingKeys = new Set(
      list.map((a) => `${a.accountId || a.keplingId}_${a.tanggal || (a.createdAt ? a.createdAt.slice(0, 10) : '')}`)
    );

    reports.forEach((r) => {
      if (r.absenApel && r.absenApel.status) {
        const dateStr = r.tanggal || (r.createdAt ? r.createdAt.slice(0, 10) : '');
        const accId = r.keplingId || r.jabatan || 'kepling';
        const key = `${accId}_${dateStr}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          list.push({
            id: `absen_rep_${r.id}`,
            accountId: accId,
            keplingId: r.keplingId || accId,
            namaKepling: r.namaKepling || 'Kepala Lingkungan',
            lingkungan: (r as any).lingkungan || r.jabatan || 'Lingkungan',
            tanggal: dateStr,
            jam: r.absenApel.jam || '07:35 WIB',
            waktuLengkap: r.absenApel.waktuLengkap || r.createdAt || new Date().toISOString(),
            status: r.absenApel.status as any,
            fotoSelfieUrl: r.absenApel.fotoSelfieUrl || '',
            lokasiGps: r.absenApel.lokasiGps || 'Halaman Kantor Kelurahan Mangga (GPS)',
            catatan: r.absenApel.catatan || '',
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || r.createdAt || new Date().toISOString(),
          });
        }
      }
    });

    return list;
  }, [attendanceList, reports]);

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAbsenApelModalOpen, setIsAbsenApelModalOpen] = useState(false);
  const [isUbahPasswordOpen, setIsUbahPasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPPTModalOpen, setIsPPTModalOpen] = useState(false);
  const [isAppUpdateOpen, setIsAppUpdateOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isSyncVerificationOpen, setIsSyncVerificationOpen] = useState(false);
  const [isNotifSoundModalOpen, setIsNotifSoundModalOpen] = useState(false);

  // Real-time audio chime & mobile vibration alert for Agenda Kelurahan & Tugas Khusus Lurah
  const { activeAlert, dismissAlert, replayAlertSound } = useAgendaTugasRealtimeAlert(activeAccount);

  // Unread feature notifications engine (tracks unread new reports since last application/tab visit)
  const { unreadCounts, markFeatureAsSeen } = useFeatureNotifications({
    activeAccount,
    activeTab,
    reports,
    kunjunganList,
    attendanceList: effectiveAttendanceList,
  });

  useEffect(() => {
    const handleOpenFullSelector = () => setIsAccountModalOpen(true);
    const handleOpenNotifSound = () => setIsNotifSoundModalOpen(true);
    const handleProfileUpdate = () => {
      setActiveAccount((prev) => {
        const base = ALL_ACCOUNTS.find((a) => a.id === prev.id) || prev;
        return getEffectiveProfile(base);
      });
    };
    window.addEventListener('open-account-selector-full', handleOpenFullSelector);
    window.addEventListener('open-notif-sound-modal', handleOpenNotifSound);
    window.addEventListener('sikepling_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('open-account-selector-full', handleOpenFullSelector);
      window.removeEventListener('open-notif-sound-modal', handleOpenNotifSound);
      window.removeEventListener('sikepling_profile_updated', handleProfileUpdate);
    };
  }, []);

  // Sync custom profiles from server / Firestore on start
  useEffect(() => {
    syncBuku1ToPkkProfiles();
    syncProfilesWithServer().then(() => {
      syncBuku1ToPkkProfiles();
      setActiveAccount((prev) => (prev ? getEffectiveProfile(prev) : prev));
    }).catch(() => {});

    // Instant offline hydration from IndexedDB on startup (0ms mobile load)
    getReportsFromIndexedDB().then((idbReports) => {
      if (idbReports && idbReports.length > 0) {
        setReports((prev) => {
          const map = new Map<string, LaporanHarianItem>();
          prev.forEach((r) => { if (r && r.id) map.set(r.id, r); });
          idbReports.forEach((r) => {
            if (r && r.id && !map.has(r.id)) {
              map.set(r.id, r);
            }
          });
          const merged = Array.from(map.values());
          return consolidateAllReports(merged);
        });
      }
    }).catch(() => {});

    // Hydrate visits from IndexedDB
    getVisitsFromIndexedDB().then((idbVisits) => {
      if (idbVisits && idbVisits.length > 0) {
        setKunjunganList((prev) => {
          const map = new Map<string, KunjunganWargaData>();
          prev.forEach((v) => { if (v && v.id) map.set(v.id, v); });
          idbVisits.forEach((v) => {
            if (v && v.id && !map.has(v.id)) {
              map.set(v.id, v);
            }
          });
          return Array.from(map.values());
        });
      }
    }).catch(() => {});

    // Use real-time subscription for reports with automatic IndexedDB + LocalStorage sync
    const unsub = subscribeReportsFromFirestore((fetched) => {
      if (Array.isArray(fetched)) {
        const unified = consolidateAllReports(fetched);
        setReports(unified);
        safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(unified));
        saveReportsToIndexedDB(unified).catch(() => {});
      }
    });

    // Use real-time subscription for kunjungan with automatic IndexedDB sync
    const unsubKunjungan = subscribeKunjungan((fetched) => {
      if (Array.isArray(fetched)) {
        setKunjunganList(fetched);
        saveVisitsToIndexedDB(fetched).catch(() => {});
        safeSetLocalStorage('sikepling_kunjungan_warga_v1', JSON.stringify(fetched));
      }
    });

    // Use real-time subscription for attendance
    const unsubAttendance = subscribeAttendance((fetched) => {
      if (Array.isArray(fetched)) {
        setAttendanceList(fetched);
      }
    });

    // Use real-time subscription for targets
    const unsubTargets = subscribeTargetsFromFirestore((map) => {
      if (map && Object.keys(map).length > 0) {
        setTargetsMap(map);
      }
    });
    
    // Delay initial full pull by 5 seconds so mobile initial render is completely instant & smooth
    const initialSyncTimeout = setTimeout(() => {
      import('./lib/syncManager').then(m => m.runSilentBackgroundSync()).catch(console.error);
    }, 5000);

    const syncInterval = setInterval(() => {
      import('./lib/syncManager').then(m => m.runSilentBackgroundSync()).catch(console.error);
    }, 600000); // 10 minutes
    
    return () => {
      clearTimeout(initialSyncTimeout);
      unsub();
      unsubKunjungan();
      unsubAttendance();
      unsubTargets();
      clearInterval(syncInterval);
    };
  }, []);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Strict role-based route access lists
  const PKK_RESTRICTED_TABS: AppTabType[] = useMemo(() => [
    'form',
    'capaian',
    'rekap_pbb',
    'agenda',
    'kunjungan',
    'surat_kedinasan',
    'capaian_admin',
    'dashboard_kasi',
  ], []);

  const KELURAHAN_RESTRICTED_TABS: AppTabType[] = useMemo(() => [
    'keuangan_pkk',
    'kegiatan_pkk',
    'dasa_wisma',
    'posyandu_pkk',
    'buku_pkk',
  ], []);

  const handleTabChange = useCallback((tab: AppTabType) => {
    if (activeAccount && activeAccount.role !== 'super_admin') {
      const isPkk = isPkkRole(activeAccount.role);
      if (isPkk && PKK_RESTRICTED_TABS.includes(tab)) {
        showToast('Akses Dibatasi: Halaman ini khusus untuk Aparatur Kelurahan.', 'info');
        setActiveTab('hub');
        safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
        return;
      }
      if (!isPkk && KELURAHAN_RESTRICTED_TABS.includes(tab)) {
        showToast('Akses Dibatasi: Halaman ini khusus untuk Pengurus TP-PKK.', 'info');
        setActiveTab('hub');
        safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
        return;
      }
    }
    setActiveTab(tab);
    markFeatureAsSeen(tab);
    safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeAccount, markFeatureAsSeen, PKK_RESTRICTED_TABS, KELURAHAN_RESTRICTED_TABS, showToast]);

  // Reactive Route Guard Effect on Account or Tab change
  useEffect(() => {
    if (!activeAccount || activeAccount.role === 'super_admin') return;
    const isPkk = isPkkRole(activeAccount.role);

    if (isPkk && PKK_RESTRICTED_TABS.includes(activeTab)) {
      showToast('Akses Dibatasi: Dialihkan ke Pusat Menu PKK.', 'info');
      setActiveTab('hub');
      safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
    } else if (!isPkk && KELURAHAN_RESTRICTED_TABS.includes(activeTab)) {
      showToast('Akses Dibatasi: Dialihkan ke Pusat Menu Kelurahan.', 'info');
      setActiveTab('hub');
      safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
    }
  }, [activeAccount, activeTab, PKK_RESTRICTED_TABS, KELURAHAN_RESTRICTED_TABS, showToast]);

  const handleAccountSelect = useCallback((acc: UserAccount) => {
    const effective = getEffectiveProfile(acc);
    setActiveAccount(effective);
    setIsLoggedIn(true);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, acc.id);
    } catch {}
    setIsAccountModalOpen(false);

    // Direct to hub on role switch
    handleTabChange('hub');
  }, [handleTabChange]);

  const handleLoginSuccess = (account: UserAccount, remember: boolean) => {
    const effective = getEffectiveProfile(account);
    setActiveAccount(effective);
    setIsLoggedIn(true);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, account.id);
    } catch {}
    showToast(`Berhasil masuk sebagai ${account.nama}!`, 'success');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    } catch {}
    setIsLoggedIn(false);
    showToast('Berhasil keluar dari akun.', 'info');
  };

  const [selectedReportForModal, setSelectedReportForModal] = useState<LaporanHarianItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const handleSelectReport = (report: LaporanHarianItem) => {
    setSelectedReportForModal(report);
    setIsDetailModalOpen(true);
  };

  const handleUpdateReport = async (updatedItem: LaporanHarianItem) => {
    const updated = consolidateAllReports(reports.map((r) => (r.id === updatedItem.id ? updatedItem : r)));
    setReports(updated);
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(updated));
    await saveReportToServer(updatedItem).catch(() => {});
    showToast('Laporan harian berhasil diperbarui!', 'success');
  };

  const handleDeleteReport = async (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(updated));
    await deleteReportFromServer(id).catch(() => {});
    showToast('Laporan harian berhasil dihapus.', 'success');
  };

  const handleSaveReport = async (item: LaporanHarianItem) => {
    // Otomatis cek jika Kepling ini sudah pernah mengirim laporan pada tanggal yang sama
    const existing = findMatchingDailyReport(reports, item);
    let finalItem = item;
    let oldIdToDelete: string | null = null;

    if (existing && existing.id !== item.id) {
      // Gabungkan laporan baru ke dalam laporan yang sudah ada (auto-consolidate)
      finalItem = consolidateDailyReport(existing, item);
      oldIdToDelete = item.id;
    }

    const updated = consolidateAllReports([
      finalItem,
      ...reports.filter((r) => r.id !== finalItem.id && r.id !== oldIdToDelete),
    ]);
    setReports(updated);
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(updated));
    await saveReportToServer(finalItem).catch(() => {});
    if (oldIdToDelete) {
      await deleteReportFromServer(oldIdToDelete).catch(() => {});
    }
    showToast(
      existing
        ? 'Laporan harian berhasil otomatis digabungkan dengan laporan sebelumnya!'
        : 'Laporan harian berhasil disimpan dan disinkronkan!',
      'success'
    );
    handleTabChange('riwayat');
  };

  const handleDraftForKepling = (kepling: UserAccount) => {
    handleAccountSelect(kepling);
    handleTabChange('form');
  };

  const handleSwitchToRiwayat = (keplingName: string) => {
    setSelectedRiwayatKepling(keplingName);
    handleTabChange('riwayat');
  };

  const todayIso = useMemo(() => getTodayLocalIso(), []);

  // Determine current portal mode (PKK vs Kelurahan)
  const isPkk = activeAccount ? isPkkRole(activeAccount.role) : false;

  // Strict Role Partitioning / Access Guard
  useEffect(() => {
    if (isPkk) {
      const allowedPkkTabs = [
        'hub', 'kegiatan_pkk', 'keuangan_pkk', 'dasa_wisma', 'posyandu_pkk',
        'buku_pkk', 'surat_kedinasan', 'daftar_tugas_khusus', 'monitoring', 'realisasi_pembangunan'
      ];
      if (!allowedPkkTabs.includes(activeTab)) {
        setActiveTab('hub');
      }
    }
  }, [isPkk, activeAccount, activeTab]);

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenPPTModal={() => setIsPPTModalOpen(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 md:pb-8">
      {/* Real-time Alert Banner with Sound and Mobile Vibration indicator */}
      <KeplingAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onNavigateTab={handleTabChange}
        onReplayAlertSound={replayAlertSound}
      />

      {/* Official Header Banner */}
      <HeaderBanner
        user={null}
        sheetMeta={null}
        isConnecting={false}
        onConnectGoogle={() => {}}
        onDisconnectGoogle={() => {}}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenUbahPassword={() => setIsUbahPasswordOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onOpenPPTModal={() => setIsPPTModalOpen(true)}
        onOpenSyncVerification={() => setIsSyncVerificationOpen(true)}
        onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
        onOpenUpdateModal={() => setIsAppUpdateOpen(true)}
        onOpenNotifSoundSettings={() => setIsNotifSoundModalOpen(true)}
        onLogout={handleLogout}
        portalMode={isPkk ? 'pkk' : 'kelurahan'}
      />

      {/* Top Navigation Bar */}
      <TopNavigationBar
        activeTab={activeTab}
        onNavigate={handleTabChange}
        isAdmin={activeAccount?.role === 'super_admin' || activeAccount?.role === 'sekretaris'}
        activeAccount={activeAccount}
      />

      {/* Update Toast Banner */}
      <AppUpdateToastBanner onOpenUpdateModal={() => setIsAppUpdateOpen(true)} />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        <React.Suspense fallback={<ComponentLoader label="Memuat modul tampilan..." />}>
          {/* TAB 1: SmartHub Dashboard */}
        {activeTab === 'hub' && (
          isPkk ? (
            <PkkHubDashboard
              currentUser={activeAccount}
              onNavigateTab={(pkkTab) => handleTabChange(pkkTab)}
              onOpenUpdateModal={() => setIsAppUpdateOpen(true)}
            />
          ) : (
            <SmartHubDashboard
              activeAccount={activeAccount}
              reports={reports}
              attendanceList={effectiveAttendanceList}
              unreadCounts={unreadCounts}
              onNavigate={(tab) => handleTabChange(tab as AppTabType)}
              onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
              onOpenPPTModal={() => setIsPPTModalOpen(true)}
              onOpenUpdateModal={() => setIsAppUpdateOpen(true)}
            />
          )
        )}

        {/* TAB 2: Form Laporan Harian */}
        {activeTab === 'form' && (
          <FormLaporan
            onSaveReport={handleSaveReport}
            isSaving={false}
            hasGoogleAuth={false}
            onConnectGoogle={() => {}}
            activeAccount={activeAccount}
            attendanceList={effectiveAttendanceList}
            existingReports={reports}
            onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
            onBackToRangkuman={() => handleTabChange('hub')}
          />
        )}

        {/* TAB 3: Monitoring Super Admin / Lurah */}
        {activeTab === 'monitoring' && (
          <MonitoringSuperAdmin
            reports={reports}
            onSelectReport={handleSelectReport}
            onDraftForKepling={handleDraftForKepling}
            onSwitchToRiwayat={handleSwitchToRiwayat}
            onOpenCapaianDashboard={() => handleTabChange('capaian_admin')}
            onOpenPbb={() => handleTabChange('rekap_pbb')}
            attendanceList={effectiveAttendanceList}
            currentUser={activeAccount}
          />
        )}

        {/* TAB 4: Riwayat Laporan Harian */}
        {activeTab === 'riwayat' && (
          <RiwayatLaporan
            items={reports}
            isLoading={false}
            onRefresh={() => {}}
            sheetMeta={null}
            onSelectReport={handleSelectReport}
            hasGoogleAuth={false}
            activeAccount={activeAccount}
            initialPetugasFilter={selectedRiwayatKepling}
            isAdmin={activeAccount.role === 'super_admin' || activeAccount.role === 'sekretaris'}
            onDeleteReport={activeAccount?.role === 'super_admin' ? handleDeleteReport : undefined}
          />
        )}

        {/* TAB 5: Rekapitulasi PBB-P2 24 Lingkungan */}
        {activeTab === 'rekap_pbb' && (
          <RekapPbbView
            activeAccount={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB 6: Capaian & Rekap Absensi */}
        {(activeTab === 'capaian' || activeTab === 'capaian_admin') && (
          <DashboardCapaianKepling
            reports={reports}
            activeAccount={activeAccount}
            mode={activeAccount.role === 'kepling' ? 'kepling' : 'super_admin'}
            onSelectKeplingRiwayat={handleSwitchToRiwayat}
            onNavigateToForm={() => handleTabChange('form')}
            onOpenRekapPbb={() => handleTabChange('rekap_pbb')}
            onNavigateToKunjungan={() => handleTabChange('kunjungan')}
            onNavigateToPresensi={() => handleTabChange('kegiatan_khusus')}
            attendanceList={effectiveAttendanceList}
            kunjunganList={kunjunganList}
          />
        )}

        {/* TAB 7: Surat Kedinasan */}
        {activeTab === 'surat_kedinasan' && (
          <SuratKedinasanView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB 9: Realisasi Pembangunan */}
        {activeTab === 'realisasi_pembangunan' && (
          <RealisasiPembangunanView
            currentUser={activeAccount}
          />
        )}

        {/* TAB 10: Daftar Tugas Khusus */}
        {activeTab === 'daftar_tugas_khusus' && (
          <DaftarTugasKhususView
            currentUser={activeAccount}
          />
        )}

        {/* TAB: Agenda Kelurahan */}
        {activeTab === 'agenda' && (
          <AgendaKelurahanView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}


        {/* TAB: Presensi Apel & Kegiatan Khusus */}
        {activeTab === 'kegiatan_khusus' && (
          <div className="space-y-4">
            {/* Sub-tab navigation: Rekap Presensi Apel 24 Kepling vs Absensi Kegiatan Khusus */}
            <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-2xs flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPresensiSubTab('apel')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  presensiSubTab === 'apel'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>📋 Rekap Presensi Apel 24 Kepling</span>
              </button>
              <button
                type="button"
                onClick={() => setPresensiSubTab('khusus')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  presensiSubTab === 'khusus'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🎯 Kegiatan Khusus & Event QR</span>
              </button>
            </div>

            {presensiSubTab === 'apel' ? (
              <RekapAbsensiSuperAdmin
                attendanceList={effectiveAttendanceList}
                currentUser={activeAccount}
                selectedDate={selectedAbsensiDate}
                onDateChange={setSelectedAbsensiDate}
              />
            ) : (
              <AbsenKegiatanKhusus
                activeAccount={activeAccount}
                showToast={(msg, type) => showToast(msg, type === 'warning' ? 'error' : type)}
              />
            )}
          </div>
        )}

        {/* TAB 11: Kunjungan Warga */}
        {activeTab === 'kunjungan' && (
          <KunjunganHarianView
            currentUser={activeAccount}
            kunjunganList={kunjunganList}
          />
        )}

        {/* TAB 12: Dashboard Kasi */}
        {activeTab === 'dashboard_kasi' && (
          activeAccount.role === 'kasi_pemerintahan' ? (
            <DashboardPbbKasi
              reports={reports}
              targetsMap={targetsMap}
              currentUser={activeAccount}
              attendanceList={effectiveAttendanceList}
              selectedDate={todayIso}
              onDateChange={() => {}}
              onOpenRekapPbb={() => handleTabChange('rekap_pbb')}
            />
          ) : activeAccount.role === 'kasi_pembangunan' ? (
            <DashboardPerlinsosKasi
              reports={reports}
              targetsMap={targetsMap}
              currentUser={activeAccount}
              onOpenKunjunganWarga={() => handleTabChange('kunjungan')}
            />
          ) : (
            <DashboardTrantibumKasi
              reports={reports}
              currentUser={activeAccount}
            />
          )
        )}

        {/* TAB 13: PKK Views */}
        {activeTab === 'keuangan_pkk' && (
          <LaporanKeuanganPkkView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'kegiatan_pkk' && (
          <PkkKegiatanView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'dasa_wisma' && (
          <PkkDasaWismaView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'posyandu_pkk' && (
          <PkkPosyanduView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'buku_pkk' && (
          <PkkBukuAdministrasiView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}
        </React.Suspense>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        activeAccount={activeAccount}
      />

      {/* Interactive Modals */}
      <AccountSelectorModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        activeAccount={activeAccount}
        onSelectAccount={handleAccountSelect}
      />

      <AbsenApelModal
        isOpen={isAbsenApelModalOpen}
        onClose={() => setIsAbsenApelModalOpen(false)}
        activeAccount={activeAccount}
        onAbsenSuccess={() => showToast('Presensi apel pagi berhasil dicatat!', 'success')}
      />

      <UbahPasswordModal
        isOpen={isUbahPasswordOpen}
        onClose={() => setIsUbahPasswordOpen(false)}
        activeAccount={activeAccount}
        onSuccess={() => showToast('Kata sandi berhasil diperbarui!', 'success')}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        activeAccount={activeAccount}
        onProfileUpdated={(updated) => {
          if (updated && updated.id) {
            setActiveAccount(updated);
            try {
              localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, updated.id);
            } catch {}
            showToast(`Profil ${updated.nama} berhasil diperbarui!`, 'success');
          }
        }}
      />

      {isPPTModalOpen && (
        <React.Suspense fallback={null}>
          <PanduanPPTModal
            isOpen={isPPTModalOpen}
            onClose={() => setIsPPTModalOpen(false)}
          />
        </React.Suspense>
      )}

      <AppUpdateModal
        isOpen={isAppUpdateOpen}
        onClose={() => setIsAppUpdateOpen(false)}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {isSyncVerificationOpen && (
        <React.Suspense fallback={null}>
          <SyncVerificationModal
            isOpen={isSyncVerificationOpen}
            onClose={() => setIsSyncVerificationOpen(false)}
            localReports={reports}
            currentUser={activeAccount}
            onSyncComplete={(updated) => {
              setReports(updated);
              safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(updated));
            }}
            showToast={showToast}
          />
        </React.Suspense>
      )}

      <NotifikasiSoundSettingsModal
        isOpen={isNotifSoundModalOpen}
        onClose={() => setIsNotifSoundModalOpen(false)}
        currentUser={activeAccount}
      />

      {isDetailModalOpen && (
        <React.Suspense fallback={null}>
          <DetailLaporanModal
            item={selectedReportForModal}
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false);
              setSelectedReportForModal(null);
            }}
            sheetMeta={null}
            hasGoogleAuth={false}
            isAdmin={activeAccount?.role === 'super_admin' || activeAccount?.role === 'sekretaris'}
            attendanceList={effectiveAttendanceList}
            onUpdateReport={handleUpdateReport}
            onDeleteReport={activeAccount?.role === 'super_admin' ? handleDeleteReport : undefined}
          />
        </React.Suspense>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-600'
                : toast.type === 'info'
                ? 'bg-blue-600'
                : 'bg-emerald-600'
            }`}
          >
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
