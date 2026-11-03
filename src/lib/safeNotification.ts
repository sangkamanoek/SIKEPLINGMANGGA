/**
 * safeNotification.ts
 * 
 * Safely handles browser / Web Notifications with permission requests and fallback.
 */

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('[Notification] requestPermission error:', err);
    return 'default';
  }
};

export const showSafeNotification = (title: string = 'SI-MANGGA', options?: NotificationOptions) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/logo_pemko_medan.png',
        badge: '/icon-192.png',
        ...options,
      });
    } catch (e) {
      console.warn('[Notification] Error displaying notification:', e);
    }
  } else if (Notification.permission === 'default') {
    requestNotificationPermission().then((permission) => {
      if (permission === 'granted') {
        try {
          new Notification(title, {
            icon: '/logo_pemko_medan.png',
            badge: '/icon-192.png',
            ...options,
          });
        } catch {}
      }
    });
  }
};
