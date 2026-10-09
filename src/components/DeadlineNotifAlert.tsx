import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Volume2,
  X,
  FileText,
  Users,
} from 'lucide-react';
import { UserAccount, LaporanHarianItem } from '../types';
import { getTodayLocalIso } from '../lib/formatter';
import { showSafeNotification } from '../lib/safeNotification';

interface DeadlineNotifAlertProps {
  activeAccount: UserAccount;
  reports: LaporanHarianItem[];
  onNavigate: (tab: 'form' | 'monitoring' | 'riwayat') => void;
  compactMode?: boolean;
}

export const DeadlineNotifAlert: React.FC<DeadlineNotifAlertProps> = ({
  activeAccount,
  reports,
  onNavigate,
  compactMode = false,
}) => {
  const isKepling = activeAccount.role === 'kepling';
  const isAdminOrKasi = activeAccount.role === 'super_admin' || activeAccount.role.startsWith('kasi_');

  const [now, setNow] = useState<Date>(new Date());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });
  const [isNotifTesting, setIsNotifTesting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Update clock every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's ISO date (YYYY-MM-DD)
  const todayIso = getTodayLocalIso();

  // Check if current Kepling has submitted report today
  const hasSubmittedToday = reports.some(
    (r) =>
      r.petugasNama?.trim().toLowerCase() === activeAccount.nama?.trim().toLowerCase() &&
      r.tanggalLaporan?.startsWith(todayIso)
  );

  // Calculate target deadline: Today at 23:30:00 local time
  const deadlineDate = new Date(now);
  deadlineDate.setHours(23, 30, 0, 0);

  // Time difference in seconds
  const diffInMs = deadlineDate.getTime() - now.getTime();
  const diffInSec = Math.floor(diffInMs / 1000);

  const isPast2330 = diffInSec < 0; // Past 23:30 WIB
  const isApproachingUrgent = !isPast2330 && diffInSec <= 7200; // Under 2 hours (120 mins)
  const isApproachingCritical = !isPast2330 && diffInSec <= 3600; // Under 1 hour (60 mins)

  // Countdown display calculation
  const hours = Math.max(0, Math.floor(diffInSec / 3600));
  const minutes = Math.max(0, Math.floor((diffInSec % 3600) / 60));
  const seconds = Math.max(0, Math.floor(diffInSec % 60));

  const padZero = (n: number) => String(n).padStart(2, '0');

  // Browser Push Notification Request
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Browser Anda tidak mendukung Web Notification API.');
      return;
    }

    try {
      setIsNotifTesting(true);
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);

      if (perm === 'granted') {
        showSafeNotification('🔔 SI-KEPLING Kelurahan Mangga', {
          body: `Notifikasi Pengingat Laporan Harian (Batas 23:30 WIB) berhasil diaktifkan untuk Lingkungan ${activeAccount.lingkungan || ''}!`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      } else if (perm === 'denied') {
        alert('Izin notifikasi diblokir oleh browser. Silakan izinkan notifikasi pada ikon gembok di browser URL bar.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setIsNotifTesting(false);
    }
  };

  // Automated Push Notification trigger when approaching 23:30
  useEffect(() => {
    if (!isKepling || hasSubmittedToday || notifPermission !== 'granted') return;

    // Check specific critical time slots to fire a push notification
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timeKey = `${currentHour}:${currentMin}`;

    // Target threshold slots: 20:00, 21:00, 22:00, 22:30, 23:00, 23:15, 23:25
    const alertSlots = ['20:0', '21:0', '22:0', '22:30', '23:0', '23:15', '23:25'];

    if (alertSlots.includes(timeKey)) {
      const lastNotifiedKey = `sikepling_last_notified_${todayIso}_${timeKey}`;
      if (!localStorage.getItem(lastNotifiedKey)) {
        localStorage.setItem(lastNotifiedKey, 'true');

        const isUrgent = currentHour >= 22;
        const title = isUrgent
          ? `🚨 DARURAT SI-KEPLING: Laporan Lingkungan ${activeAccount.lingkungan}`
          : `⚠️ PENGINGAT SI-KEPLING: Laporan Harian ${activeAccount.lingkungan}`;

        const body = `Batas waktu pengiriman laporan harian adalah pukul 23:30 WIB. Anda BELUM melapor hari ini (${hours}j ${minutes}m lagi). Klik untuk buka form!`;

        try {
          showSafeNotification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'sikepling-deadline-alert',
            requireInteraction: true,
          }, () => {
            window.focus();
            onNavigate('form');
          });
        } catch (e) {
          console.warn('Notification execution error:', e);
        }
      }
    }
  }, [now, isKepling, hasSubmittedToday, notifPermission, activeAccount, todayIso, hours, minutes, onNavigate]);

  // If Super Admin / Kasi, show executive monitoring alert summary
  if (isAdminOrKasi) {
    const keplingCountWithReports = new Set(
      reports
        .filter((r) => r.tanggalLaporan?.startsWith(todayIso))
        .map((r) => r.petugasNama)
    ).size;

    const unreportedCount = Math.max(0, 24 - keplingCountWithReports);

    return (
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${unreportedCount > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                PEMANTAUAN DEDLINE LAPORAN (23:30 WIB)
              </span>
              <span className="bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
              </span>
            </div>
            <p className="font-bold text-slate-200 mt-0.5">
              {unreportedCount === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 inline" /> Seluruh 24 Kepling Telah Mengirimkan Laporan Harian Hari Ini!
                </span>
              ) : (
                <span className="text-amber-300">
                  <span className="font-black text-rose-400">{unreportedCount} dari 24 Kepling</span> Belum Mengirimkan Laporan Harian Hari Ini.
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('monitoring')}
          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Buka Monitoring Kepling →</span>
        </button>
      </div>
    );
  }

  // Non-Kepling role guard
  if (!isKepling) return null;

  // Case A: Kepling HAS ALREADY SUBMITTED REPORT TODAY
  if (hasSubmittedToday) {
    if (isDismissed) return null;
    return (
      <div className="bg-emerald-950/80 border border-emerald-600/70 text-emerald-200 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 text-xs animate-fade-in relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 font-extrabold uppercase text-[9px] px-2 py-0.5 rounded border border-emerald-500/30">
                LAPORAN HARIAN TERKIRIM
              </span>
              <span className="text-slate-300 text-[10px] font-medium">
                Lingkungan {activeAccount.lingkungan}
              </span>
            </div>
            <p className="font-extrabold text-white mt-1 text-sm">
              Laporan Harian Anda Hari Ini ({todayIso}) Telah Berhasil Diterima Sistem!
            </p>
            <p className="text-[11px] text-emerald-300 font-medium">
              Terima kasih atas disiplin dan keaktifan Anda sebelum batas waktu 23:30 WIB.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('riwayat')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1"
          >
            <span>Lihat Laporan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-emerald-400 hover:text-white rounded-lg hover:bg-emerald-900/50 cursor-pointer"
            title="Sembunyikan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Case B: Kepling HAS NOT SUBMITTED REPORT TODAY - PAST 23:30 WIB (System Overdue)
  if (isPast2330) {
    return (
      <div className="bg-gradient-to-r from-rose-950 via-red-900 to-slate-950 border-2 border-rose-600 text-white rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden animate-bounce-short">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-lg shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                  🚨 STATUS: BELUM MELAPOR (LEWAT 23:30 WIB)
                </span>
                <span className="text-rose-200 text-xs font-bold">
                  Lingkungan {activeAccount.lingkungan}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                Batas Waktu Laporan Harian (23:30 WIB) Telah Terlewati!
              </h3>
              <p className="text-xs text-rose-100 font-medium max-w-xl">
                Status Anda saat ini ditandai berwarna <span className="font-black underline decoration-white">MERAH (BELUM MELAPOR)</span> pada tabel monitoring Super Admin Kelurahan. Segera kirimkan laporan harian Anda sekarang untuk memperbarui status.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={() => onNavigate('form')}
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer transform hover:scale-105"
            >
              <FileText className="w-4 h-4" />
              <span>📝 Kirim Laporan Susulan Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case C: Kepling HAS NOT SUBMITTED REPORT TODAY - APPROACHING 23:30 WIB (URGENT / NORMAL)
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 text-white shadow-xl border-2 transition-all relative overflow-hidden ${
        isApproachingCritical
          ? 'bg-gradient-to-r from-red-950 via-rose-900 to-slate-950 border-rose-500 ring-2 ring-rose-500/50 animate-pulse'
          : isApproachingUrgent
          ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 border-amber-500'
          : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 border-indigo-500/80'
      }`}
    >
      {/* Background glow graphics */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -mr-12 -mt-12" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        
        {/* Left Info Column */}
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-2xl shadow-md shrink-0 flex items-center justify-center ${
              isApproachingCritical
                ? 'bg-rose-600 text-white animate-bounce'
                : isApproachingUrgent
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-indigo-600 text-white'
            }`}
          >
            {isApproachingCritical ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isApproachingCritical
                    ? 'bg-rose-500 text-white'
                    : isApproachingUrgent
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-indigo-500 text-white'
                }`}
              >
                {isApproachingCritical
                  ? '🚨 DARURAT SISA WAKTU LAPOR'
                  : isApproachingUrgent
                  ? '⚠️ PERINGATAN LAPORAN HARIAN'
                  : '🕒 INGATAN LAPORAN HARIAN'}
              </span>
              <span className="text-slate-300 text-xs font-extrabold">
                Lingkungan {activeAccount.lingkungan}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Batas Waktu Pengiriman Laporan: 23:30 WIB</span>
            </h3>

            <p className="text-xs text-slate-200 font-medium max-w-xl">
              Anda <span className="font-black text-amber-300">BELUM mengirimkan Laporan Harian</span> untuk hari ini. Kirimkan sebelum pukul 23:30 WIB agar status lingkungan Anda tercatat <span className="font-black text-emerald-400">SUDAH MELAPOR</span>.
            </p>
          </div>
        </div>

        {/* Right Countdown & Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800">
          
          {/* Live Countdown Badge */}
          <div className="bg-slate-950/90 border border-slate-700 px-4 py-2 rounded-xl flex items-center justify-between sm:justify-center gap-3 text-center shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              SISA WAKTU:
            </span>
            <div className="font-mono font-black text-base sm:text-lg text-emerald-400 tracking-wider flex items-center gap-1">
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-white">{padZero(hours)}</span>
              <span className="text-slate-500">:</span>
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-amber-400">{padZero(minutes)}</span>
              <span className="text-slate-500">:</span>
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-rose-400">{padZero(seconds)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('form')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 font-black text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer transform hover:scale-105 ${
                isApproachingCritical
                  ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📝 Isi Laporan Sekarang</span>
            </button>

            {/* Push Notif Toggle */}
            <button
              onClick={handleEnableNotifications}
              disabled={isNotifTesting}
              className={`px-3 py-2.5 rounded-xl border font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                notifPermission === 'granted'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
              }`}
              title={
                notifPermission === 'granted'
                  ? 'Notifikasi Push Browser Aktif'
                  : 'Aktifkan Pengingat Notifikasi Push Browser'
              }
            >
              {notifPermission === 'granted' ? (
                <>
                  <BellRing className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Push Aktif</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span className="hidden sm:inline">Aktifkan Notif</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
