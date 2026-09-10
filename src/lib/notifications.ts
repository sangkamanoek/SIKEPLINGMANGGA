import { TaskReminder, NotificationLog, TaskCategory } from '../types';

const STORAGE_KEY_REMINDERS = 'kepling_task_reminders';
const STORAGE_KEY_LOGS = 'kepling_notification_logs';

export const DEFAULT_TASK_REMINDERS: TaskReminder[] = [
  {
    id: 'rem_pbb',
    category: 'PBB',
    title: 'Pengumpulan & Opsir PBB',
    description: 'Penyampaian SPPT dan penagihan PBB kepada Wajib Pajak di lingkungan wilayah.',
    time: '09:00',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6], // Senin - Sabtu
    googleCalendarSync: true,
  },
  {
    id: 'rem_ikd',
    category: 'IKD',
    title: 'Pendataan Penduduk & Identitas Kependudukan Digital (IKD)',
    description: 'Fasilitasi aktivasi aplikasi IKD Dukcapil dan verifikasi data penduduk setempat.',
    time: '11:00',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    googleCalendarSync: true,
  },
  {
    id: 'rem_bpjs',
    category: 'BPJS',
    title: 'Sosialisasi BPJS Ketenagakerjaan',
    description: 'Penyuluhan dan pendataan pekerja rentan / informal untuk program jaminan sosial ketenagakerjaan.',
    time: '14:00',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    googleCalendarSync: true,
  },
  {
    id: 'rem_perlinsos',
    category: 'PERLINSOS',
    title: 'Pengecekan Perlindungan Sosial (Perlinsos / Bansos)',
    description: 'Verifikasi faktual data penerima bantuan sosial PKH / BPNT dan warga rentan.',
    time: '15:30',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    googleCalendarSync: true,
  },
  {
    id: 'rem_laporan',
    category: 'LAPORAN_HARIAN',
    title: 'Penyusunan & Pengiriman Laporan Kinerja Harian',
    description: 'Rekapitulasi capaian kinerja harian dan upload dokumentasi kegiatan ke database.',
    time: '16:30',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    googleCalendarSync: true,
  },
];

/**
 * Play a gentle Web Audio notification chime
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play two-tone chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.debug('Audio chime failed:', e);
  }
}

/**
 * Request notification permission from the browser
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

/**
 * Load configured reminders from LocalStorage
 */
export function loadReminders(): TaskReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDERS);
    if (!raw) {
      saveReminders(DEFAULT_TASK_REMINDERS);
      return DEFAULT_TASK_REMINDERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load reminders:', e);
    return DEFAULT_TASK_REMINDERS;
  }
}

/**
 * Save reminders to LocalStorage
 */
export function saveReminders(reminders: TaskReminder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
  } catch (e) {
    console.warn('Failed to save reminders:', e);
  }
}

/**
 * Load notification history logs
 */
export function loadNotificationLogs(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Save notification logs
 */
export function saveNotificationLogs(logs: NotificationLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('Failed to save notification logs:', e);
  }
}

/**
 * Trigger an actual notification (Browser popup + Sound + History Log)
 */
export function sendNotification(
  title: string,
  message: string,
  category: TaskCategory
): NotificationLog {
  // 1. Play sound
  playNotificationSound();

  // 2. Trigger browser notification if granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `kepling-${Date.now()}`,
      });
    } catch (e) {
      console.debug('Native notification error:', e);
    }
  }

  // 3. Append to logs
  const log: NotificationLog = {
    id: 'notif_' + Date.now(),
    title,
    message,
    category,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const logs = loadNotificationLogs();
  logs.unshift(log);
  saveNotificationLogs(logs);

  return log;
}
