import { useState, useEffect, useRef, useCallback } from 'react';
import { UserAccount, AgendaKelurahanItem } from '../types';
import { TugasKhusus, subscribeTugasKhususFromFirestore, getTugasKhususList } from '../lib/tugasKhususService';
import { subscribeAgendaFromFirestore, getLocalAgendaList } from '../lib/agendaService';
import {
  notifyAgendaKelurahan,
  notifyTugasKhususLurah,
  playAgendaKelurahanSound,
  playTugasKhususLurahSound,
  triggerDeviceVibration,
} from '../lib/soundVibrationService';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/safeStorage';

const SEEN_AGENDA_KEY = 'sikepling_alert_seen_agenda_ids_v1';
const SEEN_TUGAS_KEY = 'sikepling_alert_seen_tugas_ids_v1';

export interface AlertNotificationItem {
  id: string;
  type: 'agenda' | 'tugas';
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
  const isInitialTugasLoadedRef = useRef(false);

  // Load seen IDs from storage
  const seenAgendaIdsRef = useRef<Set<string>>(
    new Set(safeGetLocalStorage<string[]>(SEEN_AGENDA_KEY, []))
  );
  const seenTugasIdsRef = useRef<Set<string>>(
    new Set(safeGetLocalStorage<string[]>(SEEN_TUGAS_KEY, []))
  );

  const saveSeenAgendaIds = useCallback(() => {
    safeSetLocalStorage(
      SEEN_AGENDA_KEY,
      JSON.stringify(Array.from(seenAgendaIdsRef.current).slice(-200))
    );
  }, []);

  const saveSeenTugasIds = useCallback(() => {
    safeSetLocalStorage(
      SEEN_TUGAS_KEY,
      JSON.stringify(Array.from(seenTugasIdsRef.current).slice(-200))
    );
  }, []);

  // Dismiss current floating alert
  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // Manual test trigger for Kepling to check sound & vibration on their HP
  const testAlert = useCallback((type: 'agenda' | 'tugas') => {
    if (type === 'agenda') {
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
    } else {
      notifyTugasKhususLurah(
        'Verifikasi & Validasi Warga Rentan Lingkungan',
        'Tenggat: 3 Hari • Instruksi Langsung dari Lurah'
      );
      setActiveAlert({
        id: 'test_tugas_' + Date.now(),
        type: 'tugas',
        title: 'TES NOTIFIKASI: Tugas Khusus dari Lurah',
        subTitle: 'Verifikasi & Validasi Warga Rentan Lingkungan',
        detail: 'Instruksi: Mohon seluruh Kepala Lingkungan segera melakukan pendataan warga dan unggah foto dokumentasi.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  }, []);

  const userId = currentUser?.id || '';
  const userRole = currentUser?.role || '';

  // Listen to Agenda Kelurahan updates
  useEffect(() => {
    if (!userId) return;

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

  // Listen to Tugas Khusus updates
  useEffect(() => {
    if (!userId) return;

    const handleTugasList = (tasks: TugasKhusus[]) => {
      if (!Array.isArray(tasks)) return;

      // On initial run, register all existing tasks as seen
      if (!isInitialTugasLoadedRef.current) {
        tasks.forEach((t) => {
          if (t.id) seenTugasIdsRef.current.add(t.id);
        });
        saveSeenTugasIds();
        isInitialTugasLoadedRef.current = true;
        return;
      }

      // Check for newly added active tasks
      const newTasks = tasks.filter((t) => {
        if (!t.id || t.status !== 'aktif') return false;
        if (seenTugasIdsRef.current.has(t.id)) return false;

        // Check if task targets this user or all kepling
        const matchesTarget =
          t.targetAccountId === 'ALL' ||
          t.targetAccountId === userId ||
          t.targetRole === 'kepling' ||
          t.targetRole === 'all' ||
          (userRole === 'super_admin');

        return matchesTarget;
      });

      if (newTasks.length > 0) {
        newTasks.forEach((t) => seenTugasIdsRef.current.add(t.id));
        saveSeenTugasIds();

        const latestTask = newTasks[0];
        const detailStr = `Tenggat: ${latestTask.deadline || 'Segera'} • Dari: ${latestTask.pemberiTugas || 'Lurah Kelurahan Mangga'}`;

        // Play loud dispatcher chime & strong vibration on mobile HP
        notifyTugasKhususLurah(latestTask.judul, detailStr);

        setActiveAlert({
          id: latestTask.id,
          type: 'tugas',
          title: 'TUGAS KHUSUS DARI LURAH',
          subTitle: latestTask.judul,
          detail: `${latestTask.deskripsi || ''} (Tenggat: ${latestTask.deadline || '-'})`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawItem: latestTask,
        });
      }
    };

    // Pre-populate with local list
    const initialLocalTasks = getTugasKhususList();
    if (initialLocalTasks.length > 0 && !isInitialTugasLoadedRef.current) {
      initialLocalTasks.forEach((t) => {
        if (t.id) seenTugasIdsRef.current.add(t.id);
      });
      isInitialTugasLoadedRef.current = true;
      saveSeenTugasIds();
    }

    const unsubTugas = subscribeTugasKhususFromFirestore(handleTugasList);

    const handleLocalTugasEvent = () => {
      const currentList = getTugasKhususList();
      handleTugasList(currentList);
    };
    window.addEventListener('sikepling_tugas_khusus_updated', handleLocalTugasEvent);

    return () => {
      if (typeof unsubTugas === 'function') unsubTugas();
      window.removeEventListener('sikepling_tugas_khusus_updated', handleLocalTugasEvent);
    };
  }, [userId, userRole, saveSeenTugasIds]);

  return {
    activeAlert,
    dismissAlert,
    testAlert,
    replayAlertSound: () => {
      if (activeAlert?.type === 'agenda') {
        playAgendaKelurahanSound();
        triggerDeviceVibration([250, 100, 250, 100, 450]);
      } else if (activeAlert?.type === 'tugas') {
        playTugasKhususLurahSound();
        triggerDeviceVibration([350, 100, 350, 100, 350, 100, 700]);
      }
    },
  };
}
