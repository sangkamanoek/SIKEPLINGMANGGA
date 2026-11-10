import { saveReportToFirestore } from './firestoreService';

export function initBackgroundAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    try {
      const storedReports = localStorage.getItem('sikepling_laporan_harian_list');
      if (storedReports) {
        const reports = JSON.parse(storedReports);
        if (Array.isArray(reports)) {
          for (const rep of reports.slice(0, 5)) {
            if (rep && rep.id) {
              await saveReportToFirestore(rep).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AutoSync] Online background sync note:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  // Periodic background sync every 3 minutes to guarantee data is pushed to Firestore
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      try {
        const storedReports = localStorage.getItem('sikepling_laporan_harian_list');
        if (storedReports) {
          const reports = JSON.parse(storedReports);
          if (Array.isArray(reports) && reports.length > 0) {
            await saveReportToFirestore(reports[0]).catch(() => {});
          }
        }
      } catch (e) {
        // silent background sync catch
      }
    }
  }, 180000); // 3 minutes

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}
