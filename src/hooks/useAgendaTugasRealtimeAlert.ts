import { useState, useEffect, useRef, useCallback } from 'react';
import { UserAccount, AgendaKelurahanItem } from '../types';
import { subscribeAgendaFromFirestore, getLocalAgendaList } from '../lib/agendaService';
import {
  PbbPindahNotifItem,
  subscribePbbPindahNotifs,
  isPbbPindahNotifUnreadForAccount,
} from '../lib/pbbMoveNotifService';
import {
  notifyAgendaKelurahan,
  notifyPbbPindahNop,
  playAgendaKelurahanSound,
  playPbbPindahNopSound,
  triggerDeviceVibration,
} from '../lib/soundVibrationService';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/safeStorage';
import { subscribeJadwalPoskoFromFirestore, getLocalJadwalPoskoList } from '../lib/jadwalPoskoService';
import { JadwalPoskoItem } from '../types';

const SEEN_AGENDA_KEY = 'sikepling_alert_seen_agenda_ids_v1';
const ALERTED_PBB_PINDAH_PREFIX = 'sikepling_alerted_pbb_pindah_v1_';
const ALERTED_POSKO_PREFIX = 'sikepling_alerted_posko_v1_';
const MAX_PBB_ALERT_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari

export interface AlertNotificationItem {
  id: string;
  type: 'agenda' | 'pbb_pindah' | 'posko';
  title: string;
  subTitle: string;
  detail: string;
  timestamp: string;
  rawItem?: any;
}

export function useAgendaTugasRealtimeAlert(currentUser: UserAccount | null) {
  const [activeAlert, setActiveAlert] = useState<AlertNotificationItem | null>(null);

  // Track known IDs so we only alert on newly added items
  const isInitialAgendaLoadedRef = useRef(false);

  // Load seen IDs from storage
  const seenAgendaIdsRef = useRef<Set<string>>(
    new Set(safeGetLocalStorage<string[]>(SEEN_AGENDA_KEY, []))
  );

  const saveSeenAgendaIds = useCallback(() => {
    safeSetLocalStorage(
      SEEN_AGENDA_KEY,
      JSON.stringify(Array.from(seenAgendaIdsRef.current).slice(-200))
    );
  }, []);

  const userId = currentUser?.id || '';
  const userRole = currentUser?.role || '';
  const userLingkungan = currentUser?.nomorLingkungan;

  // Per-account alerted Pindah NOP IDs (so switching accounts / logging in later still triggers unread alerts once)
  const alertedPbbIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      alertedPbbIdsRef.current = new Set();
      setActiveAlert(null);
      return;
    }
    const stored = safeGetLocalStorage<string[]>(`${ALERTED_PBB_PINDAH_PREFIX}${userId}`, []);
    alertedPbbIdsRef.current = new Set(Array.isArray(stored) ? stored : []);
    // Clear stale floating alert when switching account
    setActiveAlert((prev) => (prev?.type === 'pbb_pindah' ? null : prev));
  }, [userId]);

  const saveAlertedPbbIds = useCallback((uid: string) => {
    if (!uid) return;
    safeSetLocalStorage(
      `${ALERTED_PBB_PINDAH_PREFIX}${uid}`,
      JSON.stringify(Array.from(alertedPbbIdsRef.current).slice(-200))
    );
  }, []);

  // Dismiss current floating alert
  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // Manual test trigger for Kepling to check sound & vibration on their HP
  const testAlert = useCallback((_type?: 'agenda') => {
    notifyAgendaKelurahan(
      'Rapat Koordinasi Evaluasi Wilayah & PBB',
      'Aula Kantor Kelurahan Mangga • 09:00 WIB'
    );
    setActiveAlert({
      id: 'test_agenda_' + Date.now(),
      type: 'agenda',
      title: 'TES NOTIFIKASI: Agenda Kelurahan Baru',
      subTitle: 'Rapat Koordinasi Evaluasi Wilayah & PBB',
      detail: 'Tanggal: Hari Ini • Jam: 09:00 WIB • Lokasi: Aula Kantor Kelurahan Mangga',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    });
  }, []);

  // Listen to Agenda Kelurahan updates (hanya untuk Superadmin, Seklur & Kepling)
  useEffect(() => {
    if (!userId) return;
    if (userRole !== 'super_admin' && userRole !== 'sekretaris' && userRole !== 'kepling') return;

    const handleAgendaList = (items: AgendaKelurahanItem[]) => {
      if (!Array.isArray(items)) return;

      // On initial run, register all existing items as seen so we don't spam on refresh
      if (!isInitialAgendaLoadedRef.current) {
        items.forEach((item) => {
          if (item.id) seenAgendaIdsRef.current.add(item.id);
        });
        saveSeenAgendaIds();
        isInitialAgendaLoadedRef.current = true;
        return;
      }

      // Find any newly created agenda that wasn't seen before
      const newItems = items.filter((item) => item.id && !seenAgendaIdsRef.current.has(item.id));
      if (newItems.length > 0) {
        newItems.forEach((newItem) => {
          seenAgendaIdsRef.current.add(newItem.id);
        });
        saveSeenAgendaIds();

        // Target: trigger sound & vibration for Kepala Lingkungan (or all accounts)
        const latestNew = newItems[0];
        const detailStr = `${latestNew.tanggalKegiatan || ''} ${latestNew.jamKegiatan || ''} • Lokasi: ${latestNew.lokasi || 'Kelurahan Mangga'}`;

        // Play sound and vibrate on mobile
        notifyAgendaKelurahan(latestNew.namaKegiatan, detailStr);

        setActiveAlert({
          id: latestNew.id,
          type: 'agenda',
          title: 'AGENDA KELURAHAN BARU',
          subTitle: latestNew.namaKegiatan,
          detail: `${detailStr} • Peserta: ${latestNew.peserta || 'Seluruh Kepala Lingkungan'}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawItem: latestNew,
        });
      }
    };

    // Pre-populate with local list first
    const initialLocal = getLocalAgendaList();
    if (initialLocal.length > 0 && !isInitialAgendaLoadedRef.current) {
      initialLocal.forEach((item) => {
        if (item.id) seenAgendaIdsRef.current.add(item.id);
      });
      isInitialAgendaLoadedRef.current = true;
      saveSeenAgendaIds();
    }

    const unsubAgenda = subscribeAgendaFromFirestore(handleAgendaList);

    // Cross-tab / local event listener
    const handleLocalUpdate = () => {
      const currentLocal = getLocalAgendaList();
      handleAgendaList(currentLocal);
    };
    window.addEventListener('agenda-data-updated', handleLocalUpdate);

    return () => {
      if (typeof unsubAgenda === 'function') unsubAgenda();
      window.removeEventListener('agenda-data-updated', handleLocalUpdate);
    };
  }, [userId, saveSeenAgendaIds]);

  // Listen to PBB Pindah NOP notifications (Kasi Pem, Super Admin, & Kepling Tujuan)
  useEffect(() => {
    if (!userId || !currentUser) return;

    const nowMs = Date.now();
    const handlePbbMoveNotifs = (notifs: PbbPindahNotifItem[]) => {
      if (!Array.isArray(notifs) || notifs.length === 0) return;

      const unalertedForUser = notifs.filter((n) => {
        if (!n || !n.id) return false;
        if (alertedPbbIdsRef.current.has(n.id)) return false;
        if (!isPbbPindahNotifUnreadForAccount(n, currentUser)) return false;
        if (n.createdAt) {
          const ts = Date.parse(n.createdAt);
          if (Number.isFinite(ts) && nowMs - ts > MAX_PBB_ALERT_AGE_MS) {
            return false;
          }
        }
        return true;
      });

      if (unalertedForUser.length > 0) {
        unalertedForUser.forEach((n) => alertedPbbIdsRef.current.add(n.id));
        saveAlertedPbbIds(userId);

        const latest = unalertedForUser[0];
        const asalText =
          latest.dariLingkungan > 0 ? `Lingkungan ${latest.dariLingkungan}` : 'Belum Dipetakan (0)';
        const tujuanText = `Lingkungan ${latest.keLingkungan}`;
        const subTitle = `NOP ${latest.nop} • ${latest.namaWp}`;
        const detail = `${asalText} ➔ ${tujuanText} • Oleh: ${latest.dipindahOlehNama}${
          unalertedForUser.length > 1 ? ` (+${unalertedForUser.length - 1} pemindahan lainnya)` : ''
        }`;

        notifyPbbPindahNop(subTitle, detail);

        setActiveAlert({
          id: latest.id,
          type: 'pbb_pindah',
          title: 'PINDAH NOP PBB MASUK',
          subTitle,
          detail,
          timestamp: latest.createdAt
            ? new Date(latest.createdAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawItem: latest,
        });
      }
    };

    const unsubPbbNotifs = subscribePbbPindahNotifs(handlePbbMoveNotifs);
    return () => {
      unsubPbbNotifs();
    };
  }, [userId, userRole, userLingkungan, currentUser, saveAlertedPbbIds]);

  // Listen to Jadwal Posko for designated Kepling
  useEffect(() => {
    if (!userId || !currentUser || currentUser.role !== 'kepling') return;

    const noLing = currentUser.nomorLingkungan;
    const uid = currentUser.id;

    const handlePoskoList = (items: JadwalPoskoItem[]) => {
      if (!Array.isArray(items) || items.length === 0) return;

      const alertedPosko = new Set(
        safeGetLocalStorage<string[]>(`${ALERTED_POSKO_PREFIX}${uid}`, [])
      );

      // Cari posko aktif hari ini di mana Kepling ditugaskan & belum absen
      const myActivePosko = items.find((p) => {
        if (!p || p.status === 'SELESAI') return false;
        if (alertedPosko.has(p.id)) return false;

        const isAssigned = p.petugasKepling?.some(
          (k) =>
            (k.keplingId === uid || k.nomorLingkungan === noLing) &&
            k.statusKehadiran === 'Belum Hadir'
        );
        return isAssigned;
      });

      if (myActivePosko) {
        alertedPosko.add(myActivePosko.id);
        safeSetLocalStorage(
          `${ALERTED_POSKO_PREFIX}${uid}`,
          JSON.stringify(Array.from(alertedPosko).slice(-100))
        );

        const subTitle = `${myActivePosko.namaPosko} (${myActivePosko.waktuMulai})`;
        const detail = `Lokasi: ${myActivePosko.lokasiPosko} • Anda ditunjuk piket malam ini. Wajib unggah foto kehadiran!`;

        notifyAgendaKelurahan('PENUGASAN PIKET POSKO KELURAHAN', subTitle);

        setActiveAlert({
          id: `alert_posko_${myActivePosko.id}`,
          type: 'posko',
          title: 'PENUGASAN PIKET POSKO KELURAHAN',
          subTitle,
          detail,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawItem: myActivePosko,
        });
      }
    };

    // Pre-check local
    const localPosko = getLocalJadwalPoskoList();
    handlePoskoList(localPosko);

    const unsubPosko = subscribeJadwalPoskoFromFirestore(handlePoskoList);
    const handleLocalPoskoUpdate = () => handlePoskoList(getLocalJadwalPoskoList());
    window.addEventListener('jadwal-posko-updated', handleLocalPoskoUpdate);

    return () => {
      if (typeof unsubPosko === 'function') unsubPosko();
      window.removeEventListener('jadwal-posko-updated', handleLocalPoskoUpdate);
    };
  }, [userId, currentUser]);

  return {
    activeAlert,
    dismissAlert,
    testAlert,
    replayAlertSound: () => {
      if (activeAlert?.type === 'agenda' || activeAlert?.type === 'posko') {
        playAgendaKelurahanSound();
        triggerDeviceVibration([250, 100, 250, 100, 450]);
      } else if (activeAlert?.type === 'pbb_pindah') {
        playPbbPindahNopSound();
        triggerDeviceVibration([220, 80, 220, 80, 420]);
      }
    },
  };
}
