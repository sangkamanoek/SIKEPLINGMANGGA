import { flushFirestoreWriteQueue, refreshPendingSyncCount } from './firestoreWriteQueue';
import { isFirestoreQuotaCooldownActive } from './firebase';

export function initBackgroundAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const tryFlush = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isFirestoreQuotaCooldownActive()) return;
    flushFirestoreWriteQueue().catch(() => {});
  };

  // Initial refresh & flush shortly after mount so first paint isn't blocked
  const startupTimer = setTimeout(() => {
    refreshPendingSyncCount().then((count) => {
      if (count > 0) tryFlush();
    });
  }, 2500);

  const handleOnline = () => {
    tryFlush();
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      tryFlush();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Periodic background flush every 45 seconds ONLY if there are queued items
  const interval = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && !isFirestoreQuotaCooldownActive()) {
      refreshPendingSyncCount().then((count) => {
        if (count > 0) {
          flushFirestoreWriteQueue().catch(() => {});
        }
      });
    }
  }, 45_000);

  return () => {
    clearTimeout(startupTimer);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(interval);
  };
}
