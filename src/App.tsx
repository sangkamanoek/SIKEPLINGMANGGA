import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserAccount, LaporanHarianItem, isPkkRole } from './types';
import { canAccountAccessTab, getAccessDeniedMessage } from './lib/rolePermissions';
import {
  SUPER_ADMIN_ACCOUNT,
  ALL_ACCOUNTS,
  getEffectiveProfile,
  syncProfilesWithServer,
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
const SuratKedinasanView = React.lazy(() =>
  import('./components/SuratKedinasanView').then((m) => ({ default: m.SuratKedinasanView }))
);
const RealisasiPembangunanView = React.lazy(() =>
  import('./components/RealisasiPembangunanView').then((m) => ({ default: m.RealisasiPembangunanView }))
);
const AgendaKelurahanView = React.lazy(() =>
  import('./components/AgendaKelurahanView').then((m) => ({ default: m.AgendaKelurahanView }))
);
const JadwalPoskoView = React.lazy(() =>
  import('./components/JadwalPoskoView').then((m) => ({ default: m.JadwalPoskoView }))
);
const KegiatanLurahView = React.lazy(() =>
  import('./components/KegiatanLurahView').then((m) => ({ default: m.KegiatanLurahView }))
);
const AbsensiAgendaKeplingView = React.lazy(() =>
  import('./components/AbsensiAgendaKeplingView').then((m) => ({ default: m.AbsensiAgendaKeplingView }))
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

const PkkPosyanduView = React.lazy(() =>
  import('./components/PkkPosyanduView').then((m) => ({ default: m.PkkPosyanduView }))
);
const PkkDasaWismaView = React.lazy(() =>
  import('./components/PkkDasaWismaView').then((m) => ({ default: m.PkkDasaWismaView }))
);
const LaporanKeuanganPkkView = React.lazy(() =>
  import('./components/LaporanKeuanganPkkView').then((m) => ({ default: m.LaporanKeuanganPkkView }))
);

import { useFeatureNotifications } from './hooks/useFeatureNotifications';
import { useAgendaTugasRealtimeAlert } from './hooks/useAgendaTugasRealtimeAlert';

import { getDefaultTargetsCapaianMap } from './data/targetsData';
import {
  fetchAllReports,
  saveReportToServer,
  subscribeReportsFromFirestore,
  deleteReportFromServer,
  hydrateMissingReportPhotos,
} from './lib/reportsApi';
import { subscribeKunjungan, getLocalKunjunganList, KunjunganWargaData } from './lib/kunjunganService';
import { getTodayLocalIso } from './lib/formatter';
import { safeGetLocalStorage, safeSetLocalStorage } from './lib/safeStorage';
import {
  getReportsFromIndexedDB,
  getVisitsFromIndexedDB,
  saveReportsToIndexedDB,
  saveVisitsToIndexedDB,
} from './lib/indexedDbStorage';
import { subscribeTargetsFromFirestore, saveReportToFirestore } from './lib/firestoreService';
import {
  clearFirestoreQuotaCooldown,
  isFirestoreQuotaCooldownActive,
} from './lib/firebase';
import {
  consolidateDailyReport,
  consolidateAllReports,
  mergeFotoArraysPreservingUrls,
  isAutoGeneratedReportId,
  isSameKeplingAndDate,
} from './lib/reportConsolidator';
import { initBackgroundAutoSync } from './lib/autoSyncService';
import {
  flushFirestoreWriteQueue,
  getPendingSyncCount,
  refreshPendingSyncCount,
} from './lib/firestoreWriteQueue';

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

  // Active Tab State (validated against activeAccount role)
  const [activeTab, setActiveTab] = useState<AppTabType>(() => {
    try {
      const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as AppTabType;
      if (savedTab && canAccountAccessTab(activeAccount?.role, savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'hub';
  });

  // Data States (rawReportsMapRef holds unmerged documents keyed by id so auto-synced reports never double-count)
  const rawReportsMapRef = useRef<Map<string, LaporanHarianItem>>(new Map());
  const deletedReportIdsRef = useRef<Set<string>>(new Set());

  const [reports, setReports] = useState<LaporanHarianItem[]>(() => {
    const initialRaw = safeGetLocalStorage<LaporanHarianItem[]>(LAPORAN_LOCAL_KEY, []);
    if (Array.isArray(initialRaw)) {
      initialRaw.forEach((r) => {
        if (r && r.id) rawReportsMapRef.current.set(r.id, r);
      });
    }
    return consolidateAllReports(Array.from(rawReportsMapRef.current.values()));
  });
  const [kunjunganList, setKunjunganList] = useState<KunjunganWargaData[]>(() => getLocalKunjunganList());
  const [targetsMap, setTargetsMap] = useState(getDefaultTargetsCapaianMap);
  const [selectedRiwayatKepling, setSelectedRiwayatKepling] = useState<string>('');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isUbahPasswordOpen, setIsUbahPasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPPTModalOpen, setIsPPTModalOpen] = useState(false);
  const [isAppUpdateOpen, setIsAppUpdateOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isSyncVerificationOpen, setIsSyncVerificationOpen] = useState(false);
  const [isNotifSoundModalOpen, setIsNotifSoundModalOpen] = useState(false);
  const [quotaNoticeVisible, setQuotaNoticeVisible] = useState<boolean>(() =>
    isFirestoreQuotaCooldownActive()
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getPendingSyncCount());
  const [isFlushingSync, setIsFlushingSync] = useState<boolean>(false);
  const [restoredPhotoReportIds, setRestoredPhotoReportIds] = useState<string[]>([]);
  const [isRestoringPhotosToCloud, setIsRestoringPhotosToCloud] = useState<boolean>(false);

  // Real-time audio chime & mobile vibration alert for Agenda Kelurahan & PBB Pindah NOP
  const { activeAlert, dismissAlert, replayAlertSound } = useAgendaTugasRealtimeAlert(activeAccount);

  // Unread feature notifications engine (tracks unread new reports since last application/tab visit)
  const { unreadCounts, markFeatureAsSeen } = useFeatureNotifications({
    activeAccount,
    activeTab,
    reports,
    kunjunganList,
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
    const handleQuotaExceeded = () => setQuotaNoticeVisible(true);
    window.addEventListener('open-account-selector-full', handleOpenFullSelector);
    window.addEventListener('open-notif-sound-modal', handleOpenNotifSound);
    window.addEventListener('sikepling_profile_updated', handleProfileUpdate);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('open-account-selector-full', handleOpenFullSelector);
      window.removeEventListener('open-notif-sound-modal', handleOpenNotifSound);
      window.removeEventListener('sikepling_profile_updated', handleProfileUpdate);
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Sync custom profiles from server / Firestore on start
  useEffect(() => {
    syncProfilesWithServer().then(() => {
      setActiveAccount((prev) => (prev ? getEffectiveProfile(prev) : prev));
    }).catch(() => {});

    let isMounted = true;

    const commitRawReportsToState = (persistLocal: boolean = true) => {
      const rawList = Array.from(rawReportsMapRef.current.values());
      const unified = consolidateAllReports(rawList);
      setReports(unified);
      if (persistLocal) {
        safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(rawList));
      }
      return { rawList, unified };
    };

    const applyReportsAndHydrate = (
      fetchedReports: LaporanHarianItem[],
      isAuthoritativeServer: boolean = false
    ) => {
      const fetchedIds = new Set<string>();
      const nowMs = Date.now();

      fetchedReports.forEach((r) => {
        if (!r || !r.id || deletedReportIdsRef.current.has(r.id)) return;
        fetchedIds.add(r.id);
        const existing = rawReportsMapRef.current.get(r.id);
        if (existing) {
          const mergedFotos = mergeFotoArraysPreservingUrls(existing.dokumentasiFoto, r.dokumentasiFoto);
          rawReportsMapRef.current.set(r.id, {
            ...existing,
            ...r,
            dokumentasiFoto: mergedFotos,
            jumlahDokumentasi: Math.max(
              mergedFotos.length,
              Number(r.jumlahDokumentasi || 0),
              Number(existing.jumlahDokumentasi || 0)
            ),
          });
        } else {
          rawReportsMapRef.current.set(r.id, r);
        }
      });

      // Prune auto-generated reports that were deleted on the server (unless freshly created locally < 15s ago)
      if (isAuthoritativeServer && fetchedIds.size > 0) {
        for (const [id, item] of rawReportsMapRef.current.entries()) {
          if (isAutoGeneratedReportId(id) && !fetchedIds.has(id)) {
            const updatedAtMs = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            if (!updatedAtMs || nowMs - updatedAtMs > 15_000) {
              rawReportsMapRef.current.delete(id);
            }
          }
        }
      }

      const { rawList } = commitRawReportsToState(true);
      saveReportsToIndexedDB(rawList).catch(() => {});

      hydrateMissingReportPhotos(rawList)
        .then(({ reports: hydrated, restoredFromServerIds, hydratedFromIdbCount }) => {
          if (!isMounted) return;
          if (restoredFromServerIds.length > 0 || hydratedFromIdbCount > 0) {
            hydrated.forEach((h) => {
              if (!h || !h.id) return;
              const currentRaw = rawReportsMapRef.current.get(h.id);
              if (currentRaw) {
                const mergedFotos = mergeFotoArraysPreservingUrls(
                  currentRaw.dokumentasiFoto,
                  h.dokumentasiFoto
                );
                rawReportsMapRef.current.set(h.id, {
                  ...currentRaw,
                  dokumentasiFoto: mergedFotos,
                  jumlahDokumentasi: Math.max(
                    mergedFotos.length,
                    Number(currentRaw.jumlahDokumentasi || 0)
                  ),
                });
              }
            });
            const { rawList: updatedRaw } = commitRawReportsToState(false);
            saveReportsToIndexedDB(updatedRaw).catch(() => {});
          }
          if (restoredFromServerIds.length > 0) {
            setRestoredPhotoReportIds(restoredFromServerIds);
          }
        })
        .catch(() => {});
    };

    // Instant offline hydration from IndexedDB on startup (0ms mobile load)
    getReportsFromIndexedDB().then((idbReports) => {
      if (!isMounted || !idbReports || idbReports.length === 0) return;
      idbReports.forEach((r) => {
        if (r && r.id && !deletedReportIdsRef.current.has(r.id)) {
          const existing = rawReportsMapRef.current.get(r.id);
          if (existing) {
            const mergedFotos = mergeFotoArraysPreservingUrls(existing.dokumentasiFoto, r.dokumentasiFoto);
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const idbTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
            rawReportsMapRef.current.set(r.id, {
              ...(idbTime > existingTime ? { ...existing, ...r } : { ...r, ...existing }),
              dokumentasiFoto: mergedFotos,
              jumlahDokumentasi: Math.max(
                mergedFotos.length,
                Number(existing.jumlahDokumentasi || 0),
                Number(r.jumlahDokumentasi || 0)
              ),
            });
          } else {
            rawReportsMapRef.current.set(r.id, r);
          }
        }
      });
      commitRawReportsToState(false);
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

    // Use real-time subscription for reports with non-blocking IndexedDB and LocalStorage persistence
    let gotLiveReports = false;
    const unsub = subscribeReportsFromFirestore((fetched) => {
      if (isMounted && Array.isArray(fetched)) {
        gotLiveReports = true;
        applyReportsAndHydrate(fetched, true);
      }
    });

    const reportsFallbackTimer = setTimeout(() => {
      if (!gotLiveReports && !isFirestoreQuotaCooldownActive()) {
        fetchAllReports()
          .then((fetched) => {
            if (isMounted && !gotLiveReports && Array.isArray(fetched) && fetched.length > 0) {
              applyReportsAndHydrate(fetched, false);
            }
          })
          .catch(() => {});
      }
    }, 5000);

    // Use real-time subscription for kunjungan with non-blocking IndexedDB persistence
    const unsubKunjungan = subscribeKunjungan((fetched) => {
      if (isMounted && Array.isArray(fetched)) {
        setKunjunganList(fetched);
        saveVisitsToIndexedDB(fetched).catch(() => {});
      }
    });

    const handleKunjunganUpdated = () => {
      if (isMounted) {
        setKunjunganList(getLocalKunjunganList());
      }
    };
    window.addEventListener('kunjungan-data-updated', handleKunjunganUpdated);

    // Use real-time subscription for targets (merge defaults for any missing keys)
    const unsubTargets = subscribeTargetsFromFirestore((map) => {
      if (map && Object.keys(map).length > 0) {
        setTargetsMap({ ...getDefaultTargetsCapaianMap(), ...map });
      }
    });
    
    const cleanupAutoSync = initBackgroundAutoSync();
    refreshPendingSyncCount()
      .then((count) => setPendingSyncCount(count))
      .catch(() => {});

    const handleQueueUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === 'number') {
        setPendingSyncCount(detail.count);
      } else {
        setPendingSyncCount(getPendingSyncCount());
      }
    };
    window.addEventListener('sikepling-sync-queue-updated', handleQueueUpdated);

    const handleReportsUpdated = (ev: Event) => {
      if (!isMounted) return;
      const detail = (
        ev as CustomEvent<{
          upsertedReports?: LaporanHarianItem[];
          deletedIds?: string[];
          deletedKeplingIds?: string[];
          stripDate?: string;
          stripPrefix?: string;
        }>
      ).detail;
      const upserted = Array.isArray(detail?.upsertedReports) ? detail.upsertedReports : [];
      const deletedSet = new Set(Array.isArray(detail?.deletedIds) ? detail.deletedIds : []);
      const deletedKeplingSet = new Set(
        Array.isArray(detail?.deletedKeplingIds) ? detail.deletedKeplingIds : []
      );
      const stripDate = detail?.stripDate || '';
      const stripPrefix = detail?.stripPrefix || '';

      deletedSet.forEach((delId) => {
        deletedReportIdsRef.current.add(delId);
        rawReportsMapRef.current.delete(delId);
      });

      if (stripPrefix && deletedKeplingSet.size > 0) {
        for (const [id, r] of rawReportsMapRef.current.entries()) {
          if (
            deletedKeplingSet.has(r.keplingId || '') &&
            (!stripDate || r.tanggal === stripDate || r.tanggalLaporan === stripDate) &&
            r.kinerja?.kegiatanLainnya?.includes(stripPrefix)
          ) {
            const filteredLines = r.kinerja.kegiatanLainnya
              .split('\n')
              .filter((line) => !line.includes(stripPrefix))
              .map((line) => line.replace(/^•\s*/, '').trim())
              .filter(Boolean);
            rawReportsMapRef.current.set(id, {
              ...r,
              kinerja: {
                ...r.kinerja,
                kegiatanLainnya: filteredLines.join('\n• '),
              },
            });
          }
        }
      }

      upserted.forEach((u) => {
        if (u && u.id) {
          deletedReportIdsRef.current.delete(u.id);
          rawReportsMapRef.current.set(u.id, u);
        }
      });

      commitRawReportsToState(true);
    };
    window.addEventListener('sikepling-reports-updated', handleReportsUpdated);

    return () => {
      isMounted = false;
      cleanupAutoSync();
      window.removeEventListener('sikepling-sync-queue-updated', handleQueueUpdated);
      window.removeEventListener('sikepling-reports-updated', handleReportsUpdated);
      window.removeEventListener('kunjungan-data-updated', handleKunjunganUpdated);
      clearTimeout(reportsFallbackTimer);
      unsub();
      unsubKunjungan();
      unsubTargets();
    };
  }, []);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleTabChange = useCallback((tab: AppTabType) => {
    if (activeAccount && !canAccountAccessTab(activeAccount.role, tab)) {
      showToast(getAccessDeniedMessage(activeAccount.role, tab), 'info');
      setActiveTab('hub');
      safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
      return;
    }
    setActiveTab(tab);
    markFeatureAsSeen(tab);
    safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeAccount, markFeatureAsSeen, showToast]);

  // Reactive Route Guard Effect on Account or Tab change
  useEffect(() => {
    if (!activeAccount) return;
    if (!canAccountAccessTab(activeAccount.role, activeTab)) {
      showToast(getAccessDeniedMessage(activeAccount.role, activeTab), 'info');
      setActiveTab('hub');
      safeSetLocalStorage(ACTIVE_TAB_STORAGE_KEY, 'hub');
    }
  }, [activeAccount, activeTab, showToast]);

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

  const handleSelectReport = async (report: LaporanHarianItem) => {
    setSelectedReportForModal(report);
    setIsDetailModalOpen(true);

    // If report has missing or empty photo URLs (due to light mode or archived storage), fetch full version
    const hasEmptyFoto =
      Array.isArray(report.dokumentasiFoto) &&
      report.dokumentasiFoto.some((f) => !f || typeof f.url !== 'string' || f.url.trim().length <= 20);
    const needsFullFetch =
      (report.jumlahDokumentasi > 0 && (!report.dokumentasiFoto || report.dokumentasiFoto.length === 0)) ||
      hasEmptyFoto;

    if (needsFullFetch && report.id) {
      const { fetchReportById } = await import('./lib/reportsApi');
      const full = await fetchReportById(report.id);
      if (full && full.dokumentasiFoto && full.dokumentasiFoto.length > 0) {
        const mergedFotos = mergeFotoArraysPreservingUrls(report.dokumentasiFoto, full.dokumentasiFoto);
        const enriched: LaporanHarianItem = {
          ...report,
          ...full,
          dokumentasiFoto: mergedFotos,
          jumlahDokumentasi: Math.max(mergedFotos.length, Number(full.jumlahDokumentasi || 0), Number(report.jumlahDokumentasi || 0)),
        };
        setSelectedReportForModal(enriched);
        setReports((prev) => prev.map((r) => (r.id === enriched.id ? enriched : r)));
      }
    }
  };

  const handleRestorePhotosToCloud = async () => {
    if (restoredPhotoReportIds.length === 0 || isRestoringPhotosToCloud) return;
    setIsRestoringPhotosToCloud(true);
    let restoredCount = 0;
    const remainingIds: string[] = [];

    try {
      const reportMap = new Map<string, LaporanHarianItem>();
      reports.forEach((r) => { if (r && r.id) reportMap.set(r.id, r); });

      for (const repId of restoredPhotoReportIds) {
        const target = reportMap.get(repId);
        if (!target) continue;
        const ok = await saveReportToFirestore(target).catch(() => false);
        if (ok) {
          restoredCount++;
        } else {
          remainingIds.push(repId);
        }
      }

      setRestoredPhotoReportIds(remainingIds);
      if (restoredCount > 0) {
        showToast(`Berhasil memulihkan foto pada ${restoredCount} laporan ke Cloud Firestore!`, 'success');
      } else {
        showToast('Belum berhasil menyinkronkan foto ke Cloud Firestore. Coba lagi saat koneksi stabil.', 'info');
      }
    } finally {
      setIsRestoringPhotosToCloud(false);
    }
  };

  const handleRefreshReports = async () => {
    try {
      const fetched = await fetchAllReports();
      if (Array.isArray(fetched) && fetched.length > 0) {
        fetched.forEach((r) => {
          if (r && r.id && !deletedReportIdsRef.current.has(r.id)) {
            rawReportsMapRef.current.set(r.id, r);
          }
        });
        const rawList = Array.from(rawReportsMapRef.current.values());
        const { reports: hydrated, restoredFromServerIds } = await hydrateMissingReportPhotos(rawList);
        hydrated.forEach((h) => {
          if (h && h.id) rawReportsMapRef.current.set(h.id, h);
        });
        const nextRaw = Array.from(rawReportsMapRef.current.values());
        setReports(consolidateAllReports(nextRaw));
        safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(nextRaw));
        saveReportsToIndexedDB(nextRaw).catch(() => {});
        if (restoredFromServerIds.length > 0) {
          setRestoredPhotoReportIds(restoredFromServerIds);
        }
        showToast('Riwayat laporan berhasil disegarkan.', 'success');
      }
    } catch {
      showToast('Gagal menyegarkan data laporan.', 'error');
    }
  };

  const handleUpdateReport = async (updatedItem: LaporanHarianItem) => {
    const existingRaw = rawReportsMapRef.current.get(updatedItem.id);
    const sameDayAutoReports = Array.from(rawReportsMapRef.current.values()).filter(
      (r) =>
        r.id !== updatedItem.id &&
        isAutoGeneratedReportId(r.id) &&
        isSameKeplingAndDate(r, updatedItem)
    );

    let rawToSave: LaporanHarianItem = updatedItem;

    if (existingRaw && sameDayAutoReports.length > 0) {
      const prevConsolidated = consolidateAllReports([existingRaw, ...sameDayAutoReports])[0];
      if (prevConsolidated) {
        const adjustNumeric = (
          key:
            | 'opsirPbbWp'
            | 'perlinsosKk'
            | 'perlinsosMenolakKk'
            | 'perlinsosTidakDiTempatKk'
            | 'ikdOrang'
            | 'bpjsKetenagakerjaanOrang'
        ) => {
          const prevConsVal = Number(prevConsolidated.kinerja?.[key] || 0);
          const nextConsVal = Number(updatedItem.kinerja?.[key] || 0);
          const prevRawVal = Number(existingRaw.kinerja?.[key] || 0);
          const delta = nextConsVal - prevConsVal;
          return Math.max(0, prevRawVal + delta);
        };

        rawToSave = {
          ...updatedItem,
          kinerja: {
            ...updatedItem.kinerja,
            opsirPbbWp: adjustNumeric('opsirPbbWp'),
            perlinsosKk: adjustNumeric('perlinsosKk'),
            perlinsosMenolakKk: adjustNumeric('perlinsosMenolakKk'),
            perlinsosTidakDiTempatKk: adjustNumeric('perlinsosTidakDiTempatKk'),
            ikdOrang: adjustNumeric('ikdOrang'),
            bpjsKetenagakerjaanOrang: adjustNumeric('bpjsKetenagakerjaanOrang'),
          },
        };
      }
    }

    deletedReportIdsRef.current.delete(rawToSave.id);
    rawReportsMapRef.current.set(rawToSave.id, rawToSave);
    const rawList = Array.from(rawReportsMapRef.current.values());
    const unified = consolidateAllReports(rawList);
    setReports(unified);
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(rawList));
    await saveReportToServer(rawToSave).catch(() => {});
    showToast('Laporan harian berhasil diperbarui!', 'success');
  };

  const handleDeleteReport = async (id: string) => {
    deletedReportIdsRef.current.add(id);
    rawReportsMapRef.current.delete(id);
    const rawList = Array.from(rawReportsMapRef.current.values());
    setReports(consolidateAllReports(rawList));
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(rawList));
    await deleteReportFromServer(id).catch(() => {});
    showToast('Laporan harian berhasil dihapus.', 'success');
  };

  const handleSaveReport = async (item: LaporanHarianItem) => {
    // Hanya gabungkan dengan laporan MANUAL milik Kepling pada tanggal yang sama
    // agar entri otomatis (lap_ag_, lap_pk_, lap_kj_) tetap independen di Firestore & tidak terhitung ganda
    const existingManual = Array.from(rawReportsMapRef.current.values()).find(
      (r) =>
        r.id !== item.id &&
        !isAutoGeneratedReportId(r.id) &&
        isSameKeplingAndDate(r, item)
    );
    let finalItem = item;
    let oldIdToDelete: string | null = null;

    if (existingManual) {
      finalItem = consolidateDailyReport(existingManual, item);
      if (item.id && item.id !== finalItem.id) {
        oldIdToDelete = item.id;
      }
    }

    deletedReportIdsRef.current.delete(finalItem.id);
    rawReportsMapRef.current.set(finalItem.id, finalItem);
    if (oldIdToDelete && oldIdToDelete !== finalItem.id) {
      deletedReportIdsRef.current.add(oldIdToDelete);
      rawReportsMapRef.current.delete(oldIdToDelete);
    }

    const rawList = Array.from(rawReportsMapRef.current.values());
    setReports(consolidateAllReports(rawList));
    safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(rawList));
    await saveReportToServer(finalItem).catch(() => {});
    if (oldIdToDelete && oldIdToDelete !== finalItem.id) {
      await deleteReportFromServer(oldIdToDelete).catch(() => {});
    }
    showToast(
      existingManual
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
        'hub', 'kegiatan_pkk', 'keuangan_pkk', 'posyandu_pkk', 'dasa_wisma', 'buku_pkk'
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 md:pb-8 overflow-x-clip">
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
        unreadCounts={unreadCounts}
      />

      {/* Update Toast Banner */}
      <AppUpdateToastBanner onOpenUpdateModal={() => setIsAppUpdateOpen(true)} />

      {/* Firestore Daily Quota Notice Banner */}
      {quotaNoticeVisible && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3">
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-sm">
            <div className="space-y-0.5">
              <p className="font-semibold">
                Mode Cache Lokal Aktif — Kuota Harian Firestore Tercapai
              </p>
              <p className="text-amber-800">
                Batas pembacaan gratis harian database Cloud Firestore telah tercapai dan akan direset besok. Data tersimpan lokal tetap dapat dilihat & digunakan.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  clearFirestoreQuotaCooldown();
                  window.location.reload();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Coba Sinkron Ulang
              </button>
              <button
                type="button"
                onClick={() => setQuotaNoticeVisible(false)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 font-medium hover:bg-amber-200 transition-colors cursor-pointer"
                aria-label="Tutup pemberitahuan kuota"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Offline / Weak-Signal Sync Queue Banner */}
      {pendingSyncCount > 0 && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-950 shadow-sm">
            <p className="font-semibold">
              {pendingSyncCount} perubahan tersimpan aman di perangkat dan menunggu sinkronisasi ke Cloud Firestore (sinyal lemah/offline).
            </p>
            <button
              type="button"
              disabled={isFlushingSync}
              onClick={async () => {
                setIsFlushingSync(true);
                try {
                  const res = await flushFirestoreWriteQueue();
                  setPendingSyncCount(res.remaining);
                  if (res.remaining === 0) {
                    showToast('Seluruh antrean perubahan berhasil disinkronkan ke Cloud Firestore!', 'success');
                  } else {
                    showToast(`${res.succeeded} data tersinkron, ${res.remaining} masih menunggu koneksi stabil.`, 'info');
                  }
                } finally {
                  setIsFlushingSync(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shrink-0"
            >
              {isFlushingSync ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-3 sm:p-6 space-y-4">
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
              unreadCounts={unreadCounts}
              onNavigate={(tab) => handleTabChange(tab as AppTabType)}
              onOpenPPTModal={() => setIsPPTModalOpen(true)}
              onOpenUpdateModal={() => setIsAppUpdateOpen(true)}
            />
          )
        )}

        {/* TAB 2: Form Laporan Harian */}
        {activeTab === 'form' && canAccountAccessTab(activeAccount.role, 'form') && (
          <FormLaporan
            onSaveReport={handleSaveReport}
            isSaving={false}
            hasGoogleAuth={false}
            onConnectGoogle={() => {}}
            activeAccount={activeAccount}
            existingReports={reports}
            onBackToRangkuman={() => handleTabChange('hub')}
          />
        )}

        {/* TAB 3: Monitoring Super Admin / Seklur */}
        {activeTab === 'monitoring' && canAccountAccessTab(activeAccount.role, 'monitoring') && (
          <MonitoringSuperAdmin
            reports={reports}
            onSelectReport={handleSelectReport}
            onDraftForKepling={handleDraftForKepling}
            onSwitchToRiwayat={handleSwitchToRiwayat}
            onOpenCapaianDashboard={() => handleTabChange('capaian_admin')}
            onOpenPbb={() => handleTabChange('rekap_pbb')}
            currentUser={activeAccount}
          />
        )}

        {/* TAB 4: Riwayat Laporan Harian */}
        {activeTab === 'riwayat' && canAccountAccessTab(activeAccount.role, 'riwayat') && (
          <RiwayatLaporan
            items={reports}
            isLoading={false}
            onRefresh={handleRefreshReports}
            sheetMeta={null}
            onSelectReport={handleSelectReport}
            hasGoogleAuth={false}
            activeAccount={activeAccount}
            initialPetugasFilter={activeAccount.role === 'kepling' ? activeAccount.nama : selectedRiwayatKepling}
            isAdmin={activeAccount.role === 'super_admin' || activeAccount.role === 'sekretaris'}
            onDeleteReport={activeAccount?.role === 'super_admin' ? handleDeleteReport : undefined}
            restoredPhotoCount={restoredPhotoReportIds.length}
            onRestorePhotosToCloud={handleRestorePhotosToCloud}
            isRestoringPhotos={isRestoringPhotosToCloud}
          />
        )}

        {/* TAB 5: Rekapitulasi PBB-P2 24 Lingkungan */}
        {activeTab === 'rekap_pbb' && canAccountAccessTab(activeAccount.role, 'rekap_pbb') && (
          <RekapPbbView
            activeAccount={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB 6: Capaian & Rekap Absensi */}
        {(activeTab === 'capaian' || activeTab === 'capaian_admin') &&
          canAccountAccessTab(activeAccount.role, activeTab) && (
          <DashboardCapaianKepling
            reports={reports}
            activeAccount={activeAccount}
            mode={activeAccount.role === 'kepling' ? 'kepling' : 'super_admin'}
            onSelectKeplingRiwayat={handleSwitchToRiwayat}
            onNavigateToForm={() => handleTabChange('form')}
            onOpenRekapPbb={() => handleTabChange('rekap_pbb')}
            onNavigateToKunjungan={() => handleTabChange('kunjungan')}
            onOpenAbsensiKepling={
              activeAccount.role === 'super_admin' || activeAccount.role === 'sekretaris'
                ? () => handleTabChange('absensi_kepling')
                : undefined
            }
            kunjunganList={kunjunganList}
          />
        )}

        {/* TAB 7: Surat Kedinasan */}
        {activeTab === 'surat_kedinasan' && canAccountAccessTab(activeAccount.role, 'surat_kedinasan') && (
          <SuratKedinasanView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB 9: Realisasi Pembangunan */}
        {activeTab === 'realisasi_pembangunan' && canAccountAccessTab(activeAccount.role, 'realisasi_pembangunan') && (
          <RealisasiPembangunanView
            currentUser={activeAccount}
          />
        )}

        {/* TAB: Agenda Kelurahan */}
        {activeTab === 'agenda' && canAccountAccessTab(activeAccount.role, 'agenda') && (
          <AgendaKelurahanView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB: Jadwal Posko Trantibum, Banjir & Kebersihan Malam */}
        {activeTab === 'jadwal_posko' && canAccountAccessTab(activeAccount.role, 'jadwal_posko') && (
          <JadwalPoskoView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB: Kegiatan Lurah (Hanya Super Admin) */}
        {activeTab === 'kegiatan_lurah' && canAccountAccessTab(activeAccount.role, 'kegiatan_lurah') && (
          <KegiatanLurahView
            currentUser={activeAccount}
            onShowToast={showToast}
          />
        )}

        {/* TAB: Absensi Kepala Lingkungan (Hanya Superadmin & Seklur) */}
        {activeTab === 'absensi_kepling' &&
          canAccountAccessTab(activeAccount.role, 'absensi_kepling') && (
            <AbsensiAgendaKeplingView
              currentUser={activeAccount}
              onShowToast={showToast}
              onGoToAgendaTab={() => handleTabChange('agenda')}
            />
          )}

        {/* TAB 11: Kunjungan Warga */}
        {activeTab === 'kunjungan' && canAccountAccessTab(activeAccount.role, 'kunjungan') && (
          <KunjunganHarianView
            currentUser={activeAccount}
            kunjunganList={kunjunganList}
          />
        )}

        {/* TAB 12: Dashboard Kasi */}
        {activeTab === 'dashboard_kasi' && canAccountAccessTab(activeAccount.role, 'dashboard_kasi') && (
          activeAccount.role === 'kasi_pemerintahan' ? (
            <DashboardPbbKasi
              reports={reports}
              targetsMap={targetsMap}
              currentUser={activeAccount}
              onOpenRekapPbb={() => handleTabChange('rekap_pbb')}
              onSelectKeplingRiwayat={handleSwitchToRiwayat}
            />
          ) : activeAccount.role === 'kasi_pembangunan' ? (
            <DashboardPerlinsosKasi
              reports={reports}
              targetsMap={targetsMap}
              currentUser={activeAccount}
              onOpenKunjunganWarga={() => handleTabChange('kunjungan')}
              onSelectKeplingRiwayat={handleSwitchToRiwayat}
            />
          ) : (
            <DashboardTrantibumKasi
              reports={reports}
              currentUser={activeAccount}
              onSelectKeplingRiwayat={handleSwitchToRiwayat}
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

        {activeTab === 'posyandu_pkk' && (
          <PkkPosyanduView
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
        unreadCounts={unreadCounts}
      />

      {/* Interactive Modals */}
      <AccountSelectorModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        activeAccount={activeAccount}
        onSelectAccount={handleAccountSelect}
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
              updated.forEach((r) => {
                if (r && r.id) rawReportsMapRef.current.set(r.id, r);
              });
              const rawList = Array.from(rawReportsMapRef.current.values());
              setReports(consolidateAllReports(rawList));
              safeSetLocalStorage(LAPORAN_LOCAL_KEY, JSON.stringify(rawList));
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
