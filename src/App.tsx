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
import { FormLaporan } from './components/FormLaporan';
import { MonitoringSuperAdmin } from './components/MonitoringSuperAdmin';
import { RiwayatLaporan } from './components/RiwayatLaporan';
import { RekapPbbView } from './components/RekapPbbView';
import { DashboardCapaianKepling } from './components/DashboardCapaianKepling';
import { RekapAbsensiSuperAdmin } from './components/RekapAbsensiSuperAdmin';
import { SuratKedinasanView } from './components/SuratKedinasanView';
import { DatabaseKeluargaView } from './components/DatabaseKeluargaView';
import { RealisasiPembangunanView } from './components/RealisasiPembangunanView';
import { DaftarTugasKhususView } from './components/DaftarTugasKhususView';
import { AgendaKelurahanView } from './components/AgendaKelurahanView';

import { AbsenKegiatanKhusus } from './components/AbsenKegiatanKhusus';
import { useFeatureNotifications } from './hooks/useFeatureNotifications';
import { KunjunganHarianView } from './components/KunjunganHarianView';
import { DashboardPbbKasi } from './components/DashboardPbbKasi';
import { DashboardPerlinsosKasi } from './components/DashboardPerlinsosKasi';
import { DashboardTrantibumKasi } from './components/DashboardTrantibumKasi';
import { PkkHubDashboard } from './components/PkkHubDashboard';
import { PkkBukuAdministrasiView } from './components/PkkBukuAdministrasiView';
import { PkkKegiatanView } from './components/PkkKegiatanView';
import { PkkDasaWismaView } from './components/PkkDasaWismaView';
import { PkkPosyanduView } from './components/PkkPosyanduView';
import { LaporanKeuanganPkkView } from './components/LaporanKeuanganPkkView';

import { AccountSelectorModal } from './components/AccountSelectorModal';
import { AbsenApelModal } from './components/AbsenApelModal';
import { UbahPasswordModal } from './components/UbahPasswordModal';
import { EditProfileModal } from './components/EditProfileModal';
import { PanduanPPTModal } from './components/PanduanPPTModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { AppUpdateToastBanner } from './components/AppUpdateToastBanner';
import { LoginPage } from './components/LoginPage';
import { TopNavigationBar } from './components/TopNavigationBar';
import { SyncVerificationModal } from './components/SyncVerificationModal';
import { KeplingAlertBanner } from './components/KeplingAlertBanner';
import { NotifikasiSoundSettingsModal } from './components/NotifikasiSoundSettingsModal';
import { useAgendaTugasRealtimeAlert } from './hooks/useAgendaTugasRealtimeAlert';

import { getDefaultTargetsCapaianMap } from './data/targetsData';
import { fetchAllReports, saveReportToServer, subscribeReportsFromFirestore, deleteReportFromServer } from './lib/reportsApi';
import { DetailLaporanModal } from './components/DetailLaporanModal';
import { subscribeKunjungan, KunjunganWargaData } from './lib/kunjunganService';
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
  const [kunjunganList, setKunjunganList] = useState<KunjunganWargaData[]>([]);
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
    
    // Trigger silent background sync for other data
    const syncInterval = setInterval(() => {
      import('./lib/syncManager').then(m => m.runSilentBackgroundSync()).catch(console.error);
    }, 600000); // 10 minutes
    
    // Initial sync
    import('./lib/syncManager').then(m => m.runSilentBackgroundSync()).catch(console.error);
    
    return () => {
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

  const handleTabChange = useCallback((tab: AppTabType) => {
    setActiveTab(tab);
    markFeatureAsSeen(tab);
    safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [markFeatureAsSeen]);

  const handleAccountSelect = useCallback((acc: UserAccount) => {
    const effective = getEffectiveProfile(acc);
    setActiveAccount(effective);
    setIsLoggedIn(true);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, acc.id);
    } catch {}
    setIsAccountModalOpen(false);

    // If changing to PKK role, direct to hub
    if (isPkkRole(acc.role)) {
      handleTabChange('hub');
    }
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
      const allowedPkkTabs = ['hub', 'kegiatan_pkk', 'keuangan_pkk', 'dasa_wisma', 'posyandu_pkk', 'buku_pkk', 'surat_kedinasan', 'daftar_tugas_khusus'];
      if (!allowedPkkTabs.includes(activeTab)) {
        setActiveTab('hub');
      }
    } else if (activeAccount?.role === 'kepling') {
      const restrictedForKepling = ['monitoring', 'surat_kedinasan'];
      if (restrictedForKepling.includes(activeTab)) {
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
            onNavigateToDatabaseKeluarga={() => handleTabChange('database_keluarga')}
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

        {/* TAB 8: Database Keluarga */}
        {activeTab === 'database_keluarga' && (
          <DatabaseKeluargaView
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
              onOpenDatabaseKeluarga={() => handleTabChange('database_keluarga')}
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

      <PanduanPPTModal
        isOpen={isPPTModalOpen}
        onClose={() => setIsPPTModalOpen(false)}
      />

      <AppUpdateModal
        isOpen={isAppUpdateOpen}
        onClose={() => setIsAppUpdateOpen(false)}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

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

      <NotifikasiSoundSettingsModal
        isOpen={isNotifSoundModalOpen}
        onClose={() => setIsNotifSoundModalOpen(false)}
        currentUser={activeAccount}
      />

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
