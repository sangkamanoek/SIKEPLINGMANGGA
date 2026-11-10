import { useEffect } from 'react';
import { UserAccount } from '../types';
import { showSafeNotification } from '../lib/safeNotification';

export function useKeplingMorningNotification(currentUser: UserAccount | null) {
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'kepling') return;

    // Request notification permission if not granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const checkTimeAndNotify = () => {
      const now = new Date();
      // WIB is UTC+7
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wibDate = new Date(utc + (3600000 * 7));
      const hours = wibDate.getHours();
      const minutes = wibDate.getMinutes();

      // Target: 07:30 WIB
      if (hours === 7 && minutes === 30) {
        const todayStr = wibDate.toISOString().split('T')[0];
        const lastNotifKey = `kepling_morning_notif_${currentUser.id}_${todayStr}`;
        
        if (!localStorage.getItem(lastNotifKey)) {
          localStorage.setItem(lastNotifKey, 'true');
          showSafeNotification(
            'Pengingat Laporan Harian Kepling ⏰',
            {
              body: `Halo ${currentUser.nama}, selamat pagi! Jangan lupa untuk mengisi laporan kinerja harian Anda hari ini.`,
              icon: '/logo_pemko_medan.png',
            }
          );
        }
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkTimeAndNotify, 30000);
    checkTimeAndNotify();

    return () => clearInterval(interval);
  }, [currentUser]);
}
