import { LaporanHarianItem, TaskReminder } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface CalendarEventResponse {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Creates an event in Google Calendar for a submitted daily report
 */
export async function syncReportToGoogleCalendar(
  accessToken: string,
  report: LaporanHarianItem
): Promise<CalendarEventResponse> {
  // Determine date ISO (YYYY-MM-DD)
  let dateStr = new Date().toISOString().split('T')[0];
  if (report.createdAt) {
    dateStr = report.createdAt.split('T')[0];
  }

  const summary = `📋 Laporan Kinerja Kepling: ${report.namaKepling} (${report.hari}, ${report.tanggal})`;
  
  const description = [
    `LAPORAN KEGIATAN HARIAN`,
    `Pejabat: ${report.namaKepling} (${report.jabatan})`,
    `Wilayah: ${report.kelurahan}, ${report.kecamatan}`,
    `Tanggal: ${report.hari}, ${report.tanggal}`,
    ``,
    `KINERJA HARIAN:`,
    `1. OPSIR PBB : ${report.kinerja.opsirPbbWp || '0'} WP ${report.kinerja.opsirPbbKeterangan ? `(${report.kinerja.opsirPbbKeterangan})` : ''}`,
    `2. PERLINSOS : ${report.kinerja.perlinsosKk || '0'} KK ${report.kinerja.perlinsosKeterangan ? `(${report.kinerja.perlinsosKeterangan})` : ''}`,
    `3. IKD : ${report.kinerja.ikdOrang || '0'} ORANG ${report.kinerja.ikdKeterangan ? `(${report.kinerja.ikdKeterangan})` : ''}`,
    `4. BPJS TK : ${report.kinerja.bpjsKetenagakerjaanOrang || '0'} ORANG ${report.kinerja.bpjsKetenagakerjaanKeterangan ? `(${report.kinerja.bpjsKetenagakerjaanKeterangan})` : ''}`,
    report.kinerja.kegiatanLainnya ? `5. KEGIATAN LAINNYA : ${report.kinerja.kegiatanLainnya}` : '',
    ``,
    `Jumlah Dokumentasi: ${report.jumlahDokumentasi} Foto`,
    `Status: Tersimpan di Database Google Sheets`,
    `#MedanUntukSemua #SemuaUntukMedan`,
  ].filter(Boolean).join('\n');

  const payload = {
    summary,
    description,
    start: {
      date: dateStr,
    },
    end: {
      date: dateStr,
    },
    colorId: '10', // Green in Google Calendar
    transparency: 'transparent',
  };

  const res = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal menyimpan ke Google Calendar: ${res.status} ${errorText}`);
  }

  return await res.json();
}

/**
 * Creates or schedules a task reminder event in Google Calendar
 */
export async function syncTaskReminderToGoogleCalendar(
  accessToken: string,
  reminder: TaskReminder,
  targetDate?: string
): Promise<CalendarEventResponse> {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const timeStr = reminder.time || '09:00';
  
  // Format RFC3339 local time
  const startDateTime = `${dateStr}T${timeStr}:00+07:00`;
  
  // End 1 hour later
  const [hh, mm] = timeStr.split(':').map(Number);
  const endHour = String((hh + 1) % 24).padStart(2, '0');
  const endDateTime = `${dateStr}T${endHour}:${String(mm).padStart(2, '0')}:00+07:00`;

  const colorMap: Record<string, string> = {
    PBB: '11', // Red
    PERLINSOS: '5', // Yellow
    IKD: '9', // Blue
    BPJS: '6', // Orange
    LAPORAN_HARIAN: '10', // Green
  };

  const payload = {
    summary: `⏰ [Tugas Kepling] ${reminder.title}`,
    description: `${reminder.description}\n\nKategori: ${reminder.category}\nJadwal Jam: ${reminder.time} WIB\nSistem Pelaporan Harian Kepling Kota Medan`,
    start: {
      dateTime: startDateTime,
      timeZone: 'Asia/Jakarta',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Jakarta',
    },
    colorId: colorMap[reminder.category] || '10',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const res = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal membuat pengingat di Google Calendar: ${res.status} ${errorText}`);
  }

  return await res.json();
}

/**
 * Fetches recent Google Calendar events for the primary calendar
 */
export async function getGoogleCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEventResponse[]> {
  const min = timeMin || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const max = timeMax || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const url = `${CALENDAR_API_BASE}?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(
    max
  )}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    console.warn('Failed to load Google Calendar events:', res.status);
    return [];
  }

  const data = await res.json();
  return data.items || [];
}
