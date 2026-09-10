import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { TaskReminder, NotificationLog, TaskCategory } from '../types';
import {
  requestNotificationPermission,
  sendNotification,
  saveReminders,
  saveNotificationLogs,
} from '../lib/notifications';
import { syncTaskReminderToGoogleCalendar } from '../lib/googleCalendar';

interface NotifikasiPengingatProps {
  reminders: TaskReminder[];
  onUpdateReminders: (updated: TaskReminder[]) => void;
  notificationLogs: NotificationLog[];
  onClearLogs: () => void;
  hasGoogleAuth: boolean;
  googleToken: string | null;
  onConnectGoogle: () => void;
  onTriggerToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

const CATEGORY_INFO: Record<TaskCategory, { label: string; color: string; iconBg: string }> = {
  PBB: {
    label: 'OPSIR PBB',
    color: 'text-amber-700 border-amber-300 bg-amber-50',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  IKD: {
    label: 'PENDATAAN IKD',
    color: 'text-blue-700 border-blue-300 bg-blue-50',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  BPJS: {
    label: 'BPJS KETENAGAKERJAAN',
    color: 'text-orange-700 border-orange-300 bg-orange-50',
    iconBg: 'bg-orange-100 text-orange-700',
  },
  PERLINSOS: {
    label: 'PERLINSOS (BANSOS)',
    color: 'text-purple-700 border-purple-300 bg-purple-50',
    iconBg: 'bg-purple-100 text-purple-700',
  },
  LAPORAN_HARIAN: {
    label: 'LAPORAN HARIAN',
    color: 'text-emerald-700 border-emerald-300 bg-emerald-50',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
};

const HARI_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const NotifikasiPengingat: React.FC<NotifikasiPengingatProps> = ({
  reminders,
  onUpdateReminders,
  notificationLogs,
  onClearLogs,
  hasGoogleAuth,
  googleToken,
  onConnectGoogle,
  onTriggerToast,
}) => {
  const [permState, setPermState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSyncingAllToCalendar, setIsSyncingAllToCalendar] = useState(false);
  const [syncCount, setSyncCount] = useState<number | null>(null);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermState(res);
    if (res === 'granted') {
      onTriggerToast('Izin notifikasi browser berhasil diaktifkan!', 'success');
      sendNotification(
        'Sistem Pengingat Aktif 🔔',
        'Notifikasi tugas harian Kepling Kota Medan berhasil diaktifkan.',
        'LAPORAN_HARIAN'
      );
    } else {
      onTriggerToast('Izin notifikasi belum diberikan atau diblokir di browser.', 'info');
    }
  };

  const handleToggleReminder = (id: string) => {
    const updated = reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onUpdateReminders(updated);
    saveReminders(updated);
    onTriggerToast('Pengaturan pengingat diperbarui', 'info');
  };

  const handleTimeChange = (id: string, newTime: string) => {
    const updated = reminders.map((r) => (r.id === id ? { ...r, time: newTime } : r));
    onUpdateReminders(updated);
    saveReminders(updated);
  };

  const handleDayToggle = (reminderId: string, dayIndex: number) => {
    const updated = reminders.map((r) => {
      if (r.id !== reminderId) return r;
      const days = r.daysOfWeek.includes(dayIndex)
        ? r.daysOfWeek.filter((d) => d !== dayIndex)
        : [...r.daysOfWeek, dayIndex].sort();
      return { ...r, daysOfWeek: days };
    });
    onUpdateReminders(updated);
    saveReminders(updated);
  };

  const handleTestNotification = (r: TaskReminder) => {
    sendNotification(
      `Pengingat Tugas: ${r.title} ⏰`,
      `${r.description} (Waktu jadwal: ${r.time} WIB)`,
      r.category
    );
    onTriggerToast(`Notifikasi tes untuk "${r.title}" telah dibunyikan!`, 'success');
  };

  const handleSyncAllToGoogleCalendar = async () => {
    if (!googleToken) {
      onTriggerToast('Silakan hubungkan akun Google terlebih dahulu.', 'info');
      onConnectGoogle();
      return;
    }

    setIsSyncingAllToCalendar(true);
    let success = 0;
    try {
      const activeReminders = reminders.filter((r) => r.enabled);
      const today = new Date().toISOString().split('T')[0];

      for (const r of activeReminders) {
        await syncTaskReminderToGoogleCalendar(googleToken, r, today);
        success++;
      }
      setSyncCount(success);
      onTriggerToast(`Berhasil menyinkronkan ${success} jadwal tugas ke Google Calendar hari ini!`, 'success');
    } catch (e) {
      console.error(e);
      onTriggerToast('Gagal menyinkronkan beberapa jadwal ke Google Calendar.', 'error');
    } finally {
      setIsSyncingAllToCalendar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Sistem Pengingat Tugas Harian Kepling</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kirimkan alarm & pengingat otomatis untuk pengumpulan PBB, pendataan IKD, dan sosialisasi BPJS TK pada waktu yang ditentukan.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {permState !== 'granted' ? (
            <button
              id="btn-aktifkan-notifikasi-browser"
              type="button"
              onClick={handleRequestPermission}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Aktifkan Notifikasi Browser</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Izin Notifikasi Aktif</span>
            </div>
          )}

          {hasGoogleAuth ? (
            <button
              id="btn-sync-all-to-calendar"
              type="button"
              onClick={handleSyncAllToGoogleCalendar}
              disabled={isSyncingAllToCalendar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSyncingAllToCalendar ? 'Menyinkronkan...' : 'Sinkronkan Tugas ke Google Calendar'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>Hubungkan Kalender</span>
            </button>
          )}
        </div>
      </div>

      {syncCount !== null && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center justify-between text-xs font-semibold animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {syncCount} Tugas harian telah dijadwalkan langsung ke Google Calendar Anda hari ini!
          </span>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-emerald-700 font-bold inline-flex items-center gap-1"
          >
            Buka Kalender <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* List of Configured Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reminders.map((r) => {
          const cat = CATEGORY_INFO[r.category] || CATEGORY_INFO.LAPORAN_HARIAN;

          return (
            <div
              key={r.id}
              className={`p-5 rounded-xl border transition-all ${
                r.enabled
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-slate-200/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${cat.color}`}
                  >
                    {cat.label}
                  </span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {r.time} WIB
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggleReminder(r.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-800">{r.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.description}</p>

              {/* Time Configuration & Days */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500">WAKTU:</label>
                  <input
                    type="time"
                    value={r.time}
                    onChange={(e) => handleTimeChange(r.id, e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Days Selector */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6].map((dayIdx) => {
                    const isSelected = r.daysOfWeek.includes(dayIdx);
                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        onClick={() => handleDayToggle(r.id, dayIdx)}
                        className={`w-6 h-6 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title={HARI_LABEL[dayIdx]}
                      >
                        {HARI_LABEL[dayIdx][0]}
                      </button>
                    );
                  })}
                </div>

                {/* Test button */}
                <button
                  type="button"
                  onClick={() => handleTestNotification(r)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                  title="Bunyikan tes pengingat"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Uji Bunyi</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification Logs History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Riwayat Pengingat & Notifikasi Terkirim
            </h3>
          </div>
          {notificationLogs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="text-xs text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
            >
              Hapus Semua Riwayat
            </button>
          )}
        </div>

        {notificationLogs.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {notificationLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <div>
                    <span className="font-bold text-slate-800">{log.title}</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">{log.message}</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-6">
            Belum ada notifikasi yang terpicu. Pengingat akan otomatis muncul sesuai waktu jadwal di atas.
          </p>
        )}
      </div>
    </div>
  );
};
