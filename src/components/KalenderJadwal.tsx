import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  ExternalLink,
  Plus,
  RefreshCw,
  BellRing,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { LaporanHarianItem, TaskReminder } from '../types';
import { syncReportToGoogleCalendar, syncTaskReminderToGoogleCalendar } from '../lib/googleCalendar';

interface KalenderJadwalProps {
  reports: LaporanHarianItem[];
  reminders: TaskReminder[];
  hasGoogleAuth: boolean;
  googleToken: string | null;
  onConnectGoogle: () => void;
  onSelectReport: (report: LaporanHarianItem) => void;
  onTriggerToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const KalenderJadwal: React.FC<KalenderJadwalProps> = ({
  reports,
  reminders,
  hasGoogleAuth,
  googleToken,
  onConnectGoogle,
  onSelectReport,
  onTriggerToast,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'ALL' | 'REPORTS' | 'TASKS'>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'MONTH' | 'AGENDA'>('MONTH');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Calculate calendar grid days
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Normalize date string helper
  const getReportsForDay = (day: number): LaporanHarianItem[] => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const datePattern1 = `${year}-${paddedMonth}-${paddedDay}`;
    const monthNameUpper = monthNames[month].toUpperCase();

    return reports.filter((r) => {
      // Check ISO createdAt or formatted date string
      if (r.createdAt && r.createdAt.startsWith(datePattern1)) return true;
      const t = (r.tanggal || '').toUpperCase();
      if (t.includes(String(day)) && t.includes(monthNameUpper)) return true;
      return false;
    });
  };

  // Sync today's reports & reminders to Google Calendar
  const handleBulkSyncToGoogleCalendar = async () => {
    if (!googleToken) {
      onTriggerToast('Silakan hubungkan akun Google terlebih dahulu.', 'info');
      onConnectGoogle();
      return;
    }

    setIsSyncing(true);
    let count = 0;
    try {
      // 1. Sync reports
      for (const rep of reports.slice(0, 10)) {
        await syncReportToGoogleCalendar(googleToken, rep);
        count++;
      }
      // 2. Sync reminders for today
      const todayStr = new Date().toISOString().split('T')[0];
      for (const rem of reminders.filter((r) => r.enabled)) {
        await syncTaskReminderToGoogleCalendar(googleToken, rem, todayStr);
        count++;
      }
      onTriggerToast(`Berhasil menyinkronkan ${count} item ke Google Calendar Anda!`, 'success');
    } catch (e) {
      console.error(e);
      onTriggerToast('Gagal menyinkronkan beberapa item ke Google Calendar.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header & Google Calendar Sync Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Kalender Jadwal Tugas & Laporan Kinerja</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi jadwal tugas harian (PBB, IKD, BPJS TK) dan riwayat laporan terkirim yang tersinkron ke Google Calendar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasGoogleAuth ? (
            <>
              <button
                id="btn-sync-calendar-all"
                type="button"
                onClick={handleBulkSyncToGoogleCalendar}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan ke Google Calendar'}</span>
              </button>

              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
              >
                <span>Buka Google Calendar</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Hubungkan Google Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode & Month Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-base font-bold text-slate-800 min-w-44 text-center">
            {monthNames[month]} {year}
          </span>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Bulan berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={goToday}
            className="ml-2 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Hari Ini
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilterType('REPORTS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterType === 'REPORTS' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Laporan Kinerja ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('TASKS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterType === 'TASKS' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Jadwal Tugas ({reminders.filter((r) => r.enabled).length})
          </button>
        </div>
      </div>

      {/* Visual Month Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2.5 text-xs font-bold text-slate-600">
          <span className="text-red-600">Minggu</span>
          <span>Senin</span>
          <span>Selasa</span>
          <span>Rabu</span>
          <span>Kamis</span>
          <span>Jumat</span>
          <span>Sabtu</span>
        </div>

        {/* Calendar days cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 min-h-[480px]">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50/50 p-2 min-h-24"></div>
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNumber = i + 1;
            const dayReports = getReportsForDay(dayNumber);
            const isToday =
              new Date().getDate() === dayNumber &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year;

            const dayOfWeek = new Date(year, month, dayNumber).getDay();
            const activeTasksForDay = reminders.filter(
              (r) => r.enabled && r.daysOfWeek.includes(dayOfWeek)
            );

            return (
              <div
                key={`day-${dayNumber}`}
                className={`p-2 min-h-28 flex flex-col justify-between transition-colors ${
                  isToday ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      isToday
                        ? 'bg-emerald-600 text-white'
                        : dayOfWeek === 0
                        ? 'text-red-500 font-bold'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {dayReports.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </div>

                {/* Day Items / Pills */}
                <div className="space-y-1 overflow-hidden flex-1">
                  {/* Submitted Reports */}
                  {(filterType === 'ALL' || filterType === 'REPORTS') &&
                    dayReports.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onSelectReport(r)}
                        className="w-full text-left p-1 rounded bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-[10px] font-semibold text-emerald-900 truncate block cursor-pointer transition-colors"
                        title={`Laporan Kinerja: PBB ${r.kinerja.opsirPbbWp} WP, IKD ${r.kinerja.ikdOrang}, BPJS ${r.kinerja.bpjsKetenagakerjaanOrang}`}
                      >
                        <span className="font-bold">✓ Laporan:</span> {r.kinerja.opsirPbbWp}WP / {r.kinerja.perlinsosKk}KK
                      </button>
                    ))}

                  {/* Scheduled Tasks for today or day of week */}
                  {(filterType === 'ALL' || filterType === 'TASKS') &&
                    activeTasksForDay.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className="p-1 rounded bg-slate-100 border border-slate-200 text-[9.5px] text-slate-700 font-medium truncate flex items-center gap-1"
                        title={`${t.time} WIB - ${t.title}`}
                      >
                        <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800">{t.time}</span> {t.title}
                      </div>
                    ))}

                  {activeTasksForDay.length > 2 && filterType !== 'REPORTS' && (
                    <span className="text-[9px] font-bold text-slate-400 block px-1">
                      +{activeTasksForDay.length - 2} tugas lainnya
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Routine Agenda Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Jadwal Rutin Tugas Harian (Terintegrasi ke Google Calendar)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reminders
            .filter((r) => r.enabled)
            .map((r) => (
              <div
                key={r.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="text-emerald-700 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {r.time} WIB
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    {r.category}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800">{r.title}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2">{r.description}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
