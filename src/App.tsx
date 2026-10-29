import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserAccount, LaporanHarianItem, AbsenApelItem, isPkkRole } from './types';
import {
  SUPER_ADMIN_ACCOUNT,
  ALL_ACCOUNTS,
  getEffectiveProfile,
  syncProfilesWithServer,
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

import { getDefaultTargetsCapaianMap } from './data/targetsData';
import { fetchAllReports, saveReportToServer } from './lib/reportsApi';
import { getTodayLocalIso } from './lib/formatter';
import { safeGetLocalStorage, safeSetLocalStorage } from './lib/safeStorage';

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
  const [attendanceList, setAttendanceList] = useState<AbsenApelItem[]>([]);
  const [targetsMap] = useState(getDefaultTargetsCapaianMap);
  const [selectedRiwayatKepling, setSelectedRiwayatKepling] = useState<string>('');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAbsenApelModalOpen, setIsAbsenApelModalOpen] = useState(false);
  const [isUbahPasswordOpen, setIsUbahPasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPPTModalOpen, setIsPPTModalOpen] = useState(false);
  const [isAppUpdateOpen, setIsAppUpdateOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isSyncVerificationOpen, setIsSyncVerificationOpen] = useState(false);

  useEffect(() => {
    const handleOpenFullSelector = () => setIsAccountModalOpen(true);
    window.addEventListener('open-account-selector-full', handleOpenFullSelector);
    return () => window.removeEventListener('open-account-selector-full', handleOpenFullSelector);
  }, []);

  // Sync custom profiles from server / Firestore on start
  useEffect(() => {
    syncProfilesWithServer().then(() => {
      setActiveAccount((prev) => (prev ? getEffectiveProfile(prev) : prev));
    }).catch(() => {});

    fetchAllReports().then((fetched) => {
      if (Array.isArray(fetched) && fetched.length > 0) {
        setReports(fetched);
        safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(fetched));
      }
    }).catch(() => {});
  }, []);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleTabChange = useCallback((tab: AppTabType) => {
    setActiveTab(tab);
    safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  const handleSaveReport = async (item: LaporanHarianItem) => {
    const updated = [item, ...reports.filter((r) => r.id !== item.id)];
    setReports(updated);
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(updated));
    await saveReportToServer(item).catch(() => {});
    showToast('Laporan harian berhasil disimpan dan disinkronkan!', 'success');
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
      const restrictedForKepling = ['monitoring', 'rekap_pbb', 'surat_kedinasan'];
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
              attendanceList={attendanceList}
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
            attendanceList={attendanceList}
            onOpenAbsenApel={() => setIsAbsenApelModalOpen(true)}
            onBackToRangkuman={() => handleTabChange('hub')}
          />
        )}

        {/* TAB 3: Monitoring Super Admin / Lurah */}
        {activeTab === 'monitoring' && (
          <MonitoringSuperAdmin
            reports={reports}
            onSelectReport={() => {}}
            onDraftForKepling={handleDraftForKepling}
            onSwitchToRiwayat={handleSwitchToRiwayat}
            onOpenCapaianDashboard={() => handleTabChange('capaian_admin')}
            onOpenPbb={() => handleTabChange('rekap_pbb')}
          />
        )}

        {/* TAB 4: Riwayat Laporan Harian */}
        {activeTab === 'riwayat' && (
          <RiwayatLaporan
            items={reports}
            isLoading={false}
            onRefresh={() => {}}
            sheetMeta={null}
            onSelectReport={() => {}}
            hasGoogleAuth={false}
            activeAccount={activeAccount}
            initialPetugasFilter={selectedRiwayatKepling}
            isAdmin={activeAccount.role === 'super_admin' || activeAccount.role === 'sekretaris'}
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
            attendanceList={attendanceList}
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
          <AbsenKegiatanKhusus
            activeAccount={activeAccount}
            showToast={(msg, type) => showToast(msg, type === 'warning' ? 'error' : type)}
          />
        )}

        {/* TAB 11: Kunjungan Warga */}
        {activeTab === 'kunjungan' && (
          <KunjunganHarianView
            currentUser={activeAccount}
          />
        )}

        {/* TAB 12: Dashboard Kasi */}
        {activeTab === 'dashboard_kasi' && (
          activeAccount.role === 'kasi_pemerintahan' ? (
            <DashboardPbbKasi
              reports={reports}
              targetsMap={targetsMap}
              currentUser={activeAccount}
              attendanceList={attendanceList}
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
