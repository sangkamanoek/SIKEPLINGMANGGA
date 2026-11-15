/**
 * soundVibrationService.ts
 * 
 * Engine untuk membunyikan suara chime resmi dan getar (vibration) di HP Kepala Lingkungan
 * ketika ada Agenda Kelurahan baru atau Tugas Khusus dari Lurah.
 * Menggunakan Web Audio API Synthesizer (offline, tanpa dependensi file mp3 eksternal)
 * dan Navigator Vibrate API.
 */

// Storage settings keys
export const SOUND_ENABLED_KEY = 'sikepling_notif_sound_enabled';
export const VIBRATE_ENABLED_KEY = 'sikepling_notif_vibrate_enabled';

let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

// Initialize or get Web Audio Context
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Auto-unlock AudioContext on first user interaction (touch, tap, click)
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const handleUnlock = () => {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          isAudioUnlocked = true;
        }).catch(() => {});
      } else if (ctx.state === 'running') {
        isAudioUnlocked = true;
      }
    }
    // Remove listeners once unlocked
    if (isAudioUnlocked) {
      unlockEvents.forEach((ev) => window.removeEventListener(ev, handleUnlock));
    }
  };

  unlockEvents.forEach((ev) => window.addEventListener(ev, handleUnlock, { passive: true }));
}

/**
 * Checks if sound notification is enabled
 */
export function isSoundNotificationEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
}

/**
 * Sets sound notification preference
 */
export function setSoundNotificationEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('sikepling_notif_settings_changed'));
}

/**
 * Checks if vibration notification is enabled
 */
export function isVibrationEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(VIBRATE_ENABLED_KEY) !== 'false';
}

/**
 * Sets vibration notification preference
 */
export function setVibrationEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(VIBRATE_ENABLED_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('sikepling_notif_settings_changed'));
}

/**
 * Triggers vibration on mobile devices (HP)
 */
export function triggerDeviceVibration(pattern: number[] = [300, 100, 300, 100, 500]): boolean {
  if (!isVibrationEnabled()) return false;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch (err) {
    console.warn('[Vibration] Failed:', err);
  }
  return false;
}

/**
 * Plays a pleasant 3-tone announcement chime for AGENDA KELURAHAN
 * Frequencies: C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz)
 */
export async function playAgendaKelurahanSound(): Promise<void> {
  if (!isSoundNotificationEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Chime notes: C5, E5, G5
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.35 },
      { freq: 659.25, time: 0.16, dur: 0.35 },
      { freq: 783.99, time: 0.32, dur: 0.65 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // warm, clear chime sound
      osc.frequency.setValueAtTime(freq, now + time);

      // Volume envelope
      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.4, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
    });
  } catch (err) {
    console.warn('[Audio] playAgendaKelurahanSound error:', err);
  }
}

/**
 * Triggers sound + vibration + optional OS notification for AGENDA KELURAHAN
 */
export function notifyAgendaKelurahan(title: string, detail?: string) {
  playAgendaKelurahanSound();
  triggerDeviceVibration([250, 100, 250, 100, 450]);

  // Request & display browser system notification if supported
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('📢 AGENDA KELURAHAN BARU', {
        body: `${title}${detail ? `\n${detail}` : ''}`,
        icon: '/logo_pemko_medan.png',
        badge: '/icon-192.png',
        tag: 'agenda-kelurahan-notif',
      });
    } catch {}
  }
}

/**
 * Plays a distinct 3-tone chime for PBB PINDAH NOP notifications
 * Frequencies: E5 (659.25 Hz) -> G#5 (830.61 Hz) -> B5 (987.77 Hz)
 */
export async function playPbbPindahNopSound(): Promise<void> {
  if (!isSoundNotificationEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0.00, dur: 0.24 },
      { freq: 830.61, time: 0.14, dur: 0.24 },
      { freq: 987.77, time: 0.28, dur: 0.55 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.42, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
    });
  } catch (err) {
    console.warn('[Audio] playPbbPindahNopSound error:', err);
  }
}

/**
 * Triggers sound + vibration + optional OS notification for PBB PINDAH NOP
 */
export function notifyPbbPindahNop(title: string, detail?: string) {
  playPbbPindahNopSound();
  triggerDeviceVibration([220, 80, 220, 80, 420]);

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('📍 NOTIFIKASI PINDAH NOP PBB', {
        body: `${title}${detail ? `\n${detail}` : ''}`,
        icon: '/logo_pemko_medan.png',
        badge: '/icon-192.png',
        tag: 'pbb-pindah-nop-notif',
      });
    } catch {}
  }
}

