/**
 * Safe Web Notification Helper
 * Mobile browsers (especially Google Chrome on Android) throw:
 * "TypeError: Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead."
 *
 * This utility prevents any crash by:
 * 1. Using ServiceWorkerRegistration.showNotification() when available.
 * 2. Safely trying new Notification() in a try-catch block for desktop browsers.
 * 3. Never throwing an uncaught exception.
 */

export async function showSafeNotification(
  title: string,
  options?: NotificationOptions,
  onClick?: () => void
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // 1. Preferred modern & mobile standard: ServiceWorkerRegistration.showNotification()
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      // Fallback below
    }
  }

  // 2. Desktop browser fallback: new Notification()
  try {
    const notif = new Notification(title, options);
    if (onClick && notif) {
      notif.onclick = () => {
        try {
          window.focus();
          onClick();
          notif.close();
        } catch {}
      };
    }
  } catch (err) {
    // Gracefully catch "Failed to construct 'Notification': Illegal constructor"
    console.warn('Direct new Notification() not supported on this platform:', err);
  }
}
