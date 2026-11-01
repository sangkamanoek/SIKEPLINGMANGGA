import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LaporanHarianItem, UserAccount, isPkkRole } from '../types';
import { subscribeSurat, getLocalSuratList } from '../lib/suratService';
import { subscribeToPembangunan } from '../lib/pembangunanService';
import { subscribePkkKegiatan, getLocalPkkKegiatanList } from '../lib/pkkKegiatanService';
import { subscribePosyanduReports } from '../lib/pkkPosyanduService';
import { subscribeDasaWisma, getLocalDasaWismaList } from '../lib/pkkDasaWismaService';
import { subscribeTransaksiPkk, getLocalTransaksiPkk } from '../lib/pkkKeuanganService';
import { getReportIsoDate, getTodayLocalIso, isReportMatchingKepling, isKunjunganMatchingKepling } from '../lib/formatter';

export type FeatureNotificationKey =
  | 'kunjungan'
  | 'riwayat'
  | 'surat_kedinasan'
  | 'realisasi_pembangunan'
  | 'kegiatan_khusus'
  | 'kegiatan_pkk'
  | 'posyandu_pkk'
  | 'dasa_wisma'
  | 'keuangan_pkk'
  | 'buku_pkk';

interface UseFeatureNotificationsProps {
  activeAccount: UserAccount;
  activeTab: string;
  reports: LaporanHarianItem[];
  kunjunganList: any[];
  customEvents?: any[];
}

const STORAGE_PREFIX = 'sikepling_seen_items_v2';

function getStorageKey(feature: string, userId: string): string {
  return `${STORAGE_PREFIX}_${feature}_${userId || 'anonymous'}`;
}

export function getItemId(item: any): string {
  if (!item) return '';
  return String(item.id || item._id || item.noSurat || item.nomor || item.nomorSurat || item.idDokumen || '');
}

function loadSeenIds(feature: string, userId: string): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(getStorageKey(feature, userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch {}
  return new Set();
}

function saveSeenIds(feature: string, userId: string, seenSet: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // Keep set bounded to latest 500 IDs to avoid localStorage bloat
    const arr = Array.from(seenSet).slice(-500);
    localStorage.setItem(getStorageKey(feature, userId), JSON.stringify(arr));
  } catch {}
}

function isItemFromToday(item: any): boolean {
  if (!item) return false;
  const todayIso = getTodayLocalIso();
  const itemIso = getReportIsoDate(item);
  if (itemIso) {
    return itemIso === todayIso;
  }
  const tgl = item.tanggal || item.waktu || item.createdAt || item.tanggalSurat || item.tanggalPelaksanaan || '';
  if (typeof tgl === 'string') {
    if (tgl.startsWith(todayIso)) return true;
    const [y, m, d] = todayIso.split('-');
    if (tgl.includes(`${d}/${m}/${y}`) || tgl.includes(`${d}-${m}-${y}`)) return true;
  }
  return false;
}

export function useFeatureNotifications({
  activeAccount,
  activeTab,
  reports,
  kunjunganList,
  customEvents = [],
}: UseFeatureNotificationsProps) {
  const userId = activeAccount.id || activeAccount.nama || 'user';
  const isPkk = isPkkRole(activeAccount.role);
  const isKepling = activeAccount.role === 'kepling';

  // External feature items tracked in local state for live updates
  const [suratItems, setSuratItems] = useState<any[]>(() => {
    try {
      return getLocalSuratList();
    } catch {
      return [];
    }
  });

  const [pembangunanItems, setPembangunanItems] = useState<any[]>([]);

  const [pkkKegiatanItems, setPkkKegiatanItems] = useState<any[]>(() => {
    if (!isPkk) return [];
    try {
      return getLocalPkkKegiatanList();
    } catch {
      return [];
    }
  });

  const [pkkPosyanduItems, setPkkPosyanduItems] = useState<any[]>([]);

  const [pkkDasaWismaItems, setPkkDasaWismaItems] = useState<any[]>(() => {
    if (!isPkk) return [];
    try {
      return getLocalDasaWismaList();
    } catch {
      return [];
    }
  });

  const [pkkKeuanganItems, setPkkKeuanganItems] = useState<any[]>(() => {
    if (!isPkk) return [];
    try {
      return getLocalTransaksiPkk();
    } catch {
      return [];
    }
  });

  // Track seen IDs per feature in state
  const [seenMap, setSeenMap] = useState<Record<string, Set<string>>>(() => {
    return {
      kunjungan: loadSeenIds('kunjungan', userId),
      riwayat: loadSeenIds('riwayat', userId),
      surat_kedinasan: loadSeenIds('surat_kedinasan', userId),
      realisasi_pembangunan: loadSeenIds('realisasi_pembangunan', userId),
      kegiatan_khusus: loadSeenIds('kegiatan_khusus', userId),
      kegiatan_pkk: loadSeenIds('kegiatan_pkk', userId),
      posyandu_pkk: loadSeenIds('posyandu_pkk', userId),
      dasa_wisma: loadSeenIds('dasa_wisma', userId),
      keuangan_pkk: loadSeenIds('keuangan_pkk', userId),
      buku_pkk: loadSeenIds('buku_pkk', userId),
    };
  });

  // Flag to check if we've initialized initial historical items
  const initializedFeaturesRef = useRef<Set<string>>(new Set());

  // Listen to live subscriptions for secondary features
  useEffect(() => {
    const unsubSurat = subscribeSurat(
      (items) => setSuratItems(items),
      () => {}
    );
    const unsubPembangunan = subscribeToPembangunan((items) =>
      setPembangunanItems(items)
    );

    let unsubPkkKegiatan = () => {};
    let unsubPkkPosyandu = () => {};
    let unsubPkkDawis = () => {};
    let unsubPkkKeuangan = () => {};

    if (isPkk) {
      unsubPkkKegiatan = subscribePkkKegiatan((items) => setPkkKegiatanItems(items));
      unsubPkkPosyandu = subscribePosyanduReports((items) => setPkkPosyanduItems(items));
      unsubPkkDawis = subscribeDasaWisma((items) => setPkkDasaWismaItems(items));
      unsubPkkKeuangan = subscribeTransaksiPkk((items) => setPkkKeuanganItems(items));
    }

    return () => {
      unsubSurat();
      unsubPembangunan();
      unsubPkkKegiatan();
      unsubPkkPosyandu();
      unsubPkkDawis();
      unsubPkkKeuangan();
    };
  }, [isPkk]);

  // Map of all items per feature, tailored to role
  const featureItemsMap = useMemo<Record<string, any[]>>(() => {
    // For Kepling, prioritize their own reports and visits
    const relevantReports = isKepling
      ? (reports || []).filter((r) => isReportMatchingKepling(r, activeAccount))
      : (reports || []);

    const relevantKunjungan = isKepling
      ? (kunjunganList || []).filter((k) => isKunjunganMatchingKepling(k, activeAccount))
      : (kunjunganList || []);

    return {
      kunjungan: relevantKunjungan,
      riwayat: relevantReports,
      surat_kedinasan: suratItems || [],
      realisasi_pembangunan: pembangunanItems || [],
      kegiatan_khusus: customEvents || [],
      kegiatan_pkk: pkkKegiatanItems || [],
      posyandu_pkk: pkkPosyanduItems || [],
      dasa_wisma: pkkDasaWismaItems || [],
      keuangan_pkk: pkkKeuanganItems || [],
      buku_pkk: [],
    };
  }, [
    isKepling,
    activeAccount,
    kunjunganList,
    reports,
    suratItems,
    pembangunanItems,
    customEvents,
    pkkKegiatanItems,
    pkkPosyanduItems,
    pkkDasaWismaItems,
    pkkKeuanganItems,
  ]);

  // Smart initial historical seed on first cold launch:
  // If user never had a seenSet stored in localStorage, pre-seed older items so user isn't spammed with old months-old data.
  useEffect(() => {
    Object.keys(featureItemsMap).forEach((feature) => {
      if (initializedFeaturesRef.current.has(feature)) return;
      const items = featureItemsMap[feature];
      if (!items || items.length === 0) return;

      const rawStored = typeof localStorage !== 'undefined' ? localStorage.getItem(getStorageKey(feature, userId)) : null;
      if (rawStored === null) {
        // Cold start: mark items older than today as already seen
        const initialSeen = new Set<string>();
        items.forEach((item) => {
          const id = getItemId(item);
          if (id && !isItemFromToday(item)) {
            initialSeen.add(id);
          }
        });
        saveSeenIds(feature, userId, initialSeen);
        setSeenMap((prev) => ({ ...prev, [feature]: initialSeen }));
      }
      initializedFeaturesRef.current.add(feature);
    });
  }, [featureItemsMap, userId]);

  // Method to mark a feature's items as seen
  const markFeatureAsSeen = useCallback(
    (feature: string) => {
      const items = featureItemsMap[feature] || [];
      if (!items || items.length === 0) return;

      setSeenMap((prevSeenMap) => {
        const currentSeen = prevSeenMap[feature] || new Set<string>();
        let hasChanges = false;
        const nextSeen = new Set(currentSeen);

        items.forEach((item) => {
          const id = getItemId(item);
          if (id && !nextSeen.has(id)) {
            nextSeen.add(id);
            hasChanges = true;
          }
        });

        if (!hasChanges) {
          return prevSeenMap;
        }

        saveSeenIds(feature, userId, nextSeen);
        return {
          ...prevSeenMap,
          [feature]: nextSeen,
        };
      });
    },
    [featureItemsMap, userId]
  );

  // Automatically mark activeTab as seen when user opens it
  useEffect(() => {
    if (activeTab && activeTab !== 'hub' && featureItemsMap[activeTab]) {
      markFeatureAsSeen(activeTab);
    }
  }, [activeTab, markFeatureAsSeen, featureItemsMap]);

  // Calculate unread/new counts
  const unreadCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    console.log('DEBUG: Calculating unreadCounts', { featureItemsMap, seenMap, activeTab });

    Object.keys(featureItemsMap).forEach((feature) => {
      // If user is currently on this tab, count is 0
      if (activeTab === feature) {
        counts[feature] = 0;
        return;
      }

      const items = featureItemsMap[feature] || [];
      const seenSet = seenMap[feature] || new Set<string>();

      // Check how many items have not been seen
      let unread = 0;
      items.forEach((item) => {
        const id = getItemId(item);
        if (id && !seenSet.has(id)) {
          unread += 1;
        }
      });

      counts[feature] = unread;
    });

    console.log('DEBUG: Final unreadCounts', counts);
    return counts;
  }, [featureItemsMap, seenMap, activeTab]);

  // Total unread across all features
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((acc, c) => acc + (c || 0), 0);
  }, [unreadCounts]);

  return {
    unreadCounts,
    totalUnreadCount,
    markFeatureAsSeen,
  };
}
