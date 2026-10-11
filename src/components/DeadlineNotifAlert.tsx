import React from 'react';
import { UserAccount, LaporanHarianItem } from '../types';

interface DeadlineNotifAlertProps {
  activeAccount: UserAccount;
  reports: LaporanHarianItem[];
  onNavigate: (tab: 'form' | 'monitoring' | 'riwayat') => void;
  compactMode?: boolean;
}

/**
 * Aturan automatic cutoff 23:30 WIB telah dihapus.
 * Komponen ini dinonaktifkan (return null) agar tidak menampilkan countdown maupun peringatan keterlambatan cutoff.
 */
export const DeadlineNotifAlert: React.FC<DeadlineNotifAlertProps> = () => {
  return null;
};
