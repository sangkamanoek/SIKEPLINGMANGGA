import { AbsenApelItem, StatusAbsenApel, UserAccount, CustomEvent, EventAttendance } from '../types';
import { safeSetLocalStorage } from './safeStorage';
import {
  fetchAttendanceFromFirestore,
  saveAttendanceToFirestore,
  subscribeAttendanceFromFirestore,
} from './firestoreService';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

const STORAGE_KEY_ATTENDANCE = 'kepling_absen_apel_list';

/**
 * Utility to format current date YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Utility to format time HH:mm WIB
 */
export function getCurrentTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
}

export interface WibTimeStatus {
  formattedTime: string;
  isWorkDay: boolean; // Monday - Friday
  isWithinWindow: boolean; // 07:30 - 08:30 WIB on Monday - Friday
  isTooEarly: boolean; // Before 07:30 WIB
  isLate: boolean; // After 08:30 WIB
  statusLabel: string;
}

/**
 * Check if current time & day falls within official Apel Pagi window:
 * Hari: Senin s/d Jumat
 * Jam: 07:30 - 08:30 WIB
 */
export function checkApelTimeStatus(): WibTimeStatus {
  // Gunakan waktu saat ini
  const now = new Date();

  // Dapatkan jam dan menit di WIB
  // Asumsi lingkungan server mungkin UTC, maka kita perlu mengonversi secara eksplisit ke WIB
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Konversi UTC ke WIB (UTC+7)
  let wibHours = utcHours + 7;
  let wibMinutes = utcMinutes;
  
  if (wibHours >= 24) {
    wibHours -= 24;
  }
  
  const totalMin = wibHours * 60 + wibMinutes;
  const day = (now.getUTCDay() + (wibHours >= 24 ? 1 : 0)) % 7;

  // Jadwal Resmi: 07:30 - 08:30 WIB
  const startMin = 7 * 60 + 30; // 450 min
  const endMin = 8 * 60 + 30;   // 510 min

  const hoursStr = String(wibHours).padStart(2, '0');
  const minStr = String(wibMinutes).padStart(2, '0');
  const formattedTime = `${hoursStr}:${minStr} WIB`;

  const isWorkDay = day >= 1 && day <= 5; // Senin - Jumat
  const isWithinWindow = totalMin >= startMin && totalMin <= endMin;
  const isLate = totalMin > endMin;

  if (!isWorkDay) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return {
      formattedTime,
      isWorkDay: false,
      isWithinWindow: false,
      isTooEarly: false,
      isLate: false,
      statusLabel: `Libur Akhir Pekan (${dayNames[day]}) • Apel Pagi Hanya Senin s/d Jumat`,
    };
  }

  // Jika sebelum jam 07:30
  if (totalMin < startMin) {
    return {
      formattedTime,
      isWorkDay: true,
      isWithinWindow: false,
      isTooEarly: true,
      isLate: false,
      statusLabel: 'Belum Jam Apel (Jadwal Resmi 07.30 - 08.30 WIB)',
    };
  }

  // Jika setelah jam 08:30
  if (totalMin > endMin) {
    return {
      formattedTime,
      isWorkDay: true,
      isWithinWindow: false,
      isTooEarly: false,
      isLate: true,
      statusLabel: 'Akses Presensi Ditutup (Lewat Pukul 08.30 WIB) • Otomatis Tidak Mengikuti Apel',
    };
  }

  return {
    formattedTime,
    isWorkDay: true,
    isWithinWindow: true,
    isTooEarly: false,
    isLate: false,
    statusLabel: 'Tepat Waktu (Jam Apel Resmi 07.30 - 08.30 WIB)',
  };
}

/**
 * Load all attendance records strictly online from Server Buffer and Firestore
 */
export async function loadAllAttendance(): Promise<AbsenApelItem[]> {
  const map = new Map<string, AbsenApelItem>();

  // 1. Fetch online from Express Server Buffer (/api/attendance)
  try {
    const res = await fetch(`/api/attendance?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      const serverItems = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (Array.isArray(serverItems) && serverItems.length > 0) {
        serverItems.forEach((a: AbsenApelItem) => {
          if (a && a.id) map.set(a.id, a);
        });
      }
    }
  } catch (e) {
    // Silent catch
  }

  // 2. Fetch online from Firebase Firestore
  try {
    const firestoreData = await fetchAttendanceFromFirestore();
    if (Array.isArray(firestoreData) && firestoreData.length > 0) {
      firestoreData.forEach((a) => {
        if (a && a.id) map.set(a.id, a);
      });
    }
  } catch (e) {
    // Already handled in fetchAttendanceFromFirestore
  }

  const list = Array.from(map.values());
  list.sort(
    (a, b) =>
      new Date(b.waktuLengkap || b.createdAt).getTime() -
      new Date(a.waktuLengkap || a.createdAt).getTime()
  );
  return list;
}

/**
 * Delete attendance record online from Server Buffer
 */
export async function deleteAbsenApel(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const res = await fetch(`/api/attendance/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting attendance on server:', err);
    return false;
  }
}

/**
 * Submit or update attendance record strictly online
 */
export async function submitAbsenApel(
  account: UserAccount,
  status: StatusAbsenApel,
  fotoSelfieUrl?: string,
  lokasiGps?: string,
  catatan?: string,
  overrideTanggal?: string
): Promise<AbsenApelItem> {
  const tanggal = overrideTanggal || getTodayDateString();
  const jam = getCurrentTimeString();
  const now = new Date();
  const waktuLengkap = now.toISOString();

  // Create document ID e.g. "absen_kepling_1_2026-09-13"
  const docId = `absen_${account.id}_${tanggal}`;

  const timeStatus = checkApelTimeStatus();
  let finalCatatan = catatan || '';
  if (status === 'Hadir' && timeStatus.isLate) {
    if (!finalCatatan.includes('Terlambat')) {
      finalCatatan = finalCatatan ? `${finalCatatan} (${timeStatus.statusLabel})` : timeStatus.statusLabel;
    }
  }

  const item: AbsenApelItem = {
    id: docId,
    accountId: account.id,
    namaKepling: account.nama,
    lingkungan: account.lingkungan,
    nomorLingkungan: account.nomorLingkungan,
    tanggal,
    jam,
    waktuLengkap,
    status,
    fotoSelfieUrl: fotoSelfieUrl || '',
    lokasiGps: lokasiGps || 'Jl. Flamboyan Raya No. 49, Kelurahan Mangga (Akurasi GPS Maksimal)',
    catatan: finalCatatan,
    createdAt: waktuLengkap,
    updatedAt: waktuLengkap,
  };

  // Concurrently sync online to Firebase Firestore and Server Buffer
  saveAttendanceToFirestore(item).catch(() => {});

  fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  }).catch(() => {});

  return item;
}

/**
 * Check whether an attendance item matches a target ISO date string (YYYY-MM-DD).
 * Handles YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, Indonesian text dates, and ISO timestamps in UTC / WIB.
 */
export function isAttendanceMatchingDate(
  item: AbsenApelItem | any,
  targetDateIso: string
): boolean {
  if (!item || !targetDateIso) return false;

  // 1. Direct match on item.tanggal
  if (item.tanggal) {
    const t = String(item.tanggal).trim();
    if (t === targetDateIso) return true;

    // Normalize DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      if (`${y}-${m}-${d}` === targetDateIso) return true;
    }

    // Indonesian month name match e.g. "24 September 2026", "24 SEPT 2026"
    const monthMatch = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (monthMatch) {
      const d = monthMatch[1].padStart(2, '0');
      const monthStr = String(monthMatch[2] || '').toUpperCase();
      const y = monthMatch[3];
      const monthNames = [
        'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
        'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
      ];
      const mIdx = monthNames.findIndex(b => b.startsWith(monthStr) || monthStr.startsWith(b.slice(0, 3)));
      if (mIdx >= 0) {
        const m = String(mIdx + 1).padStart(2, '0');
        if (`${y}-${m}-${d}` === targetDateIso) return true;
      }
    }
  }

  // 2. Check waktuLengkap (ISO string) with local/WIB conversion
  if (item.waktuLengkap && typeof item.waktuLengkap === 'string') {
    if (item.waktuLengkap.startsWith(targetDateIso)) return true;
    try {
      const dt = new Date(item.waktuLengkap);
      if (!isNaN(dt.getTime())) {
        const utc = dt.getTime() + dt.getTimezoneOffset() * 60000;
        const wib = new Date(utc + 7 * 3600000);
        const wibIso = `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
        if (wibIso === targetDateIso) return true;
      }
    } catch {}
  }

  // 3. Check createdAt
  if (item.createdAt && typeof item.createdAt === 'string') {
    if (item.createdAt.startsWith(targetDateIso)) return true;
    try {
      const dt = new Date(item.createdAt);
      if (!isNaN(dt.getTime())) {
        const utc = dt.getTime() + dt.getTimezoneOffset() * 60000;
        const wib = new Date(utc + 7 * 3600000);
        const wibIso = `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
        if (wibIso === targetDateIso) return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Smart matching of an attendance record to a Kepling account.
 * Checks accountId, extracted number, nomorLingkungan, lingkungan name, and namaKepling.
 */
export function isAttendanceMatchingKepling(
  item: AbsenApelItem | any,
  kepling: UserAccount
): boolean {
  if (!item || !kepling) return false;

  const nomor = kepling.nomorLingkungan || 0;

  // 1. Direct account ID check (case-insensitive, handles with/without underscore)
  if (item.accountId) {
    const itemAccId = String(item.accountId).trim().toLowerCase();
    const kepAccId = String(kepling.id).trim().toLowerCase();
    if (itemAccId === kepAccId) return true;
    if (itemAccId.replace(/_/g, '') === kepAccId.replace(/_/g, '')) return true;

    // Check numerical ID match e.g. "kepling_1" vs "kepling1" vs "1"
    const rawNum = itemAccId.replace(/[^0-9]/g, '');
    if (rawNum && nomor > 0 && parseInt(rawNum, 10) === nomor) {
      return true;
    }
  }

  // 2. Nomor Lingkungan (handles number, numeric string)
  if (item.nomorLingkungan !== undefined && item.nomorLingkungan !== null && nomor > 0) {
    if (Number(item.nomorLingkungan) === nomor) {
      return true;
    }
  }

  // 3. Lingkungan Name matching (handles "Lingkungan I", "Lingkungan 1", "Lk I", etc.)
  if (item.lingkungan) {
    const itemLk = String(item.lingkungan).toLowerCase().trim();
    const kepLk = String(kepling.lingkungan).toLowerCase().trim();
    if (itemLk === kepLk) return true;

    if (nomor > 0) {
      const ROMAN_NUMERALS = [
        'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
        'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
        'xxi', 'xxii', 'xxiii', 'xxiv'
      ];
      const roman = ROMAN_NUMERALS[nomor - 1];
      if (
        itemLk.includes(`lingkungan ${nomor}`) ||
        itemLk.includes(`lingkungan ${roman}`) ||
        itemLk.includes(`lk ${nomor}`) ||
        itemLk.includes(`lk ${roman}`) ||
        itemLk.includes(`lk. ${nomor}`) ||
        itemLk.includes(`lk. ${roman}`)
      ) {
        return true;
      }
    }
  }

  // 4. Nama Kepling matching
  if (item.namaKepling && kepling.nama) {
    const cleanItem = String(item.namaKepling).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanKep = String(kepling.nama).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanItem === cleanKep) return true;
    if (cleanItem.length >= 5 && (cleanKep.includes(cleanItem) || cleanItem.includes(cleanKep))) {
      return true;
    }
  }

  return false;
}

/**
 * Get today's attendance record for a specific Kepling account with smart fuzzy matching
 */
export function getTodayAbsenForKepling(
  attendanceList: AbsenApelItem[],
  accountId: string,
  tanggal?: string
): AbsenApelItem | undefined {
  const dateStr = tanggal || getTodayDateString();
  const kepling = KEPLING_ACCOUNTS.find(
    (k) => k.id === accountId || k.id.replace(/_/g, '') === accountId.replace(/_/g, '')
  );

  return attendanceList.find((a) => {
    if (!isAttendanceMatchingDate(a, dateStr)) return false;
    if (kepling) {
      return isAttendanceMatchingKepling(a, kepling);
    }
    return (
      a.accountId === accountId ||
      a.accountId?.replace(/_/g, '') === accountId.replace(/_/g, '')
    );
  });
}

/**
 * Compute summary of 24 Kepling attendance status for a given date
 */
export interface AttendanceSummary24 {
  totalKepling: number;
  totalHadir: number;
  totalIzin: number;
  totalSakit: number;
  totalDinasLuar: number;
  totalBelumAbsen: number;
  percentageHadir: number;
}

export function computeAttendanceSummary24(
  attendanceList: AbsenApelItem[],
  tanggal?: string
): AttendanceSummary24 {
  const dateStr = tanggal || getTodayDateString();

  let hadir = 0;
  let izin = 0;
  let sakit = 0;
  let dinasLuar = 0;

  KEPLING_ACCOUNTS.forEach((kepling) => {
    const rec = getTodayAbsenForKepling(attendanceList, kepling.id, dateStr);
    if (rec) {
      const st = (rec.status || '').toLowerCase();
      if (st === 'hadir' || st.includes('hadir')) hadir++;
      else if (st === 'izin' || st.includes('izin')) izin++;
      else if (st === 'sakit' || st.includes('sakit')) sakit++;
      else if (st === 'dinas luar' || st.includes('dinas')) dinasLuar++;
    }
  });

  const totalKepling = KEPLING_ACCOUNTS.length; // 24
  const totalSudahAbsen = hadir + izin + sakit + dinasLuar;
  const totalBelumAbsen = Math.max(0, totalKepling - totalSudahAbsen);
  const percentageHadir = Math.round((hadir / totalKepling) * 100);

  return {
    totalKepling,
    totalHadir: hadir,
    totalIzin: izin,
    totalSakit: sakit,
    totalDinasLuar: dinasLuar,
    totalBelumAbsen,
    percentageHadir,
  };
}

/**
 * Calculate how many consecutive days and total days a Kepling has missed Apel Pagi.
 * Only counts working days (Senin s/d Jumat).
 */
export interface AbsentDaysResult {
  consecutiveDays: number;
  totalAbsentThisMonth: number;
  label: string;
  detailDates: string[];
}

export function calculateAbsentDays(
  attendanceList: AbsenApelItem[],
  accountId: string,
  referenceDateStr?: string,
  eventList?: CustomEvent[],
  eventAttendanceList?: EventAttendance[]
): AbsentDaysResult {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const timeStat = checkApelTimeStatus();

  // Determine if today itself is considered absent
  const todayStr = getTodayDateString();
  const isTodayRef = !referenceDateStr || referenceDateStr === todayStr;

  let consecutiveDays = 0;
  let totalAbsentThisMonth = 0;
  const detailDates: string[] = [];

  // Check past 30 days backwards
  const checkDate = new Date(refDate);
  const currentMonth = refDate.getMonth();
  const currentYear = refDate.getFullYear();

  let streakActive = true;

  for (let i = 0; i < 30; i++) {
    const dayOfWeek = checkDate.getDay(); // 0 = Sun, 6 = Sat
    const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    if (isWorkDay) {
      const rec = getTodayAbsenForKepling(attendanceList, accountId, dateStr);
      const isToday = dateStr === todayStr;

      // Check if there's a required event today
      const hasRequiredEvent = eventList && eventAttendanceList && eventList.some(e => e.date === dateStr && e.required);
      const attendedEvent = hasRequiredEvent && eventAttendanceList!.some(att => 
        att.accountId === accountId && 
        eventList!.some(e => e.id === att.eventId && e.date === dateStr) && 
        att.status !== 'Tidak Hadir'
      );

      let isAbsent = false;

      if (attendedEvent) {
        // If attended required event, not absent
        isAbsent = false;
      } else if (rec) {
        if (rec.status === 'Tidak Mengikuti Apel') {
          isAbsent = true;
        } else {
          // Attended (Hadir, Izin, Sakit, Dinas Luar)
          isAbsent = false;
        }
      } else {
        // No record
        if (isToday) {
          // If today is past 08.30 WIB, count as absent
          if (timeStat.isLate) {
            isAbsent = true;
          } else {
            // Still within or before window, streak not broken yet
            isAbsent = false;
          }
        } else {
          // Past workday without attendance record is absent
          isAbsent = true;
        }
      }

      // If check date is in the same month, count monthly absent
      if (checkDate.getMonth() === currentMonth && checkDate.getFullYear() === currentYear && isAbsent) {
        totalAbsentThisMonth++;
      }

      if (streakActive) {
        if (isAbsent) {
          consecutiveDays++;
          detailDates.push(dateStr);
        } else {
          // If we encounter an attended day, streak stops
          if (!isToday || (rec && rec.status !== 'Tidak Mengikuti Apel')) {
            streakActive = false;
          }
        }
      }
    }

    // Move back 1 day
    checkDate.setDate(checkDate.getDate() - 1);
  }

  const label =
    consecutiveDays <= 0
      ? '0 Hari'
      : consecutiveDays === 1
      ? '1 Hari'
      : `${consecutiveDays} Hari`;

  return {
    consecutiveDays,
    totalAbsentThisMonth,
    label,
    detailDates,
  };
}

export interface KeplingWeeklyRow {
  accountId: string;
  nama: string;
  lingkungan: string;
  nomorLingkungan: number;
  days: {
    dateStr: string;
    dayName: string;
    status: StatusAbsenApel | 'Belum Absen' | '-';
    jam?: string;
  }[];
  totalHadir: number;
  totalTidakApel: number;
  totalIzinSakit: number;
  persentase: number;
}

export interface KeplingMonthlyRow {
  accountId: string;
  nama: string;
  lingkungan: string;
  nomorLingkungan: number;
  totalHariKerja: number;
  totalHadir: number;
  totalIzin: number;
  totalSakit: number;
  totalDinasLuar: number;
  totalTidakApel: number;
  consecutiveAbsentDays: number;
  persentaseHadir: number;
}

/**
 * Compute weekly recap for 24 Kepling (Monday to Friday)
 */
export function computeWeeklyAttendance24(
  attendanceList: AbsenApelItem[],
  referenceDateStr?: string
): {
  weekLabel: string;
  workDates: { dateStr: string; dayName: string; formatted: string }[];
  rows: KeplingWeeklyRow[];
} {
  const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const day = ref.getDay(); // 0 = Sun
  const diffToMonday = day === 0 ? -6 : 1 - day; // calculate Monday of the week

  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);

  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const workDates: { dateStr: string; dayName: string; formatted: string }[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const formatted = `${d.getDate()}/${d.getMonth() + 1}`;
    workDates.push({ dateStr, dayName: dayNames[i], formatted });
  }

  const weekLabel = `${workDates[0].formatted} s/d ${workDates[4].formatted} ${monday.getFullYear()}`;

  const todayStr = getTodayDateString();
  const timeStat = checkApelTimeStatus();

  const rows: KeplingWeeklyRow[] = KEPLING_ACCOUNTS.map((k) => {
    let totalHadir = 0;
    let totalTidakApel = 0;
    let totalIzinSakit = 0;

    const days = workDates.map((wd) => {
      const rec = attendanceList.find((a) => a.accountId === k.id && a.tanggal === wd.dateStr);
      let status: StatusAbsenApel | 'Belum Absen' | '-' = '-';
      let jam = rec?.jam;

      if (rec) {
        status = rec.status;
        if (status === 'Hadir') totalHadir++;
        else if (status === 'Tidak Mengikuti Apel') totalTidakApel++;
        else if (status === 'Izin' || status === 'Sakit' || status === 'Dinas Luar') totalIzinSakit++;
      } else {
        if (wd.dateStr === todayStr) {
          if (timeStat.isLate) {
            status = 'Tidak Mengikuti Apel';
            totalTidakApel++;
          } else {
            status = 'Belum Absen';
          }
        } else if (wd.dateStr < todayStr) {
          status = 'Tidak Mengikuti Apel';
          totalTidakApel++;
        } else {
          status = '-';
        }
      }

      return {
        dateStr: wd.dateStr,
        dayName: wd.dayName,
        status,
        jam,
      };
    });

    const evaluatedDays = days.filter((d) => d.status !== '-').length || 1;
    const persentase = Math.round((totalHadir / evaluatedDays) * 100);

    return {
      accountId: k.id,
      nama: k.nama,
      lingkungan: k.lingkungan,
      nomorLingkungan: k.nomorLingkungan || 0,
      days,
      totalHadir,
      totalTidakApel,
      totalIzinSakit,
      persentase,
    };
  });

  return { weekLabel, workDates, rows };
}

/**
 * Compute monthly attendance recap for 24 Kepling
 */
export function computeMonthlyAttendance24(
  attendanceList: AbsenApelItem[],
  year: number,
  month: number // 1-12
): {
  monthName: string;
  totalWorkDays: number;
  rows: KeplingMonthlyRow[];
} {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthName = `${monthNames[month - 1]} ${year}`;

  // Find all work days in this month
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const workDates: string[] = [];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workDates.push(
        `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      );
    }
  }

  const todayStr = getTodayDateString();
  const timeStat = checkApelTimeStatus();

  // Evaluate work days up to today (if current month) or all work days
  const activeWorkDates = workDates.filter((wd) => wd <= todayStr);
  const totalWorkDays = activeWorkDates.length || 1;

  const rows: KeplingMonthlyRow[] = KEPLING_ACCOUNTS.map((k) => {
    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalDinasLuar = 0;
    let totalTidakApel = 0;

    activeWorkDates.forEach((wd) => {
      const rec = attendanceList.find((a) => a.accountId === k.id && a.tanggal === wd);
      if (rec) {
        if (rec.status === 'Hadir') totalHadir++;
        else if (rec.status === 'Izin') totalIzin++;
        else if (rec.status === 'Sakit') totalSakit++;
        else if (rec.status === 'Dinas Luar') totalDinasLuar++;
        else if (rec.status === 'Tidak Mengikuti Apel') totalTidakApel++;
      } else {
        if (wd === todayStr) {
          if (timeStat.isLate) totalTidakApel++;
        } else {
          totalTidakApel++;
        }
      }
    });

    const absentStat = calculateAbsentDays(attendanceList, k.id, todayStr);
    const persentaseHadir = Math.round((totalHadir / totalWorkDays) * 100);

    return {
      accountId: k.id,
      nama: k.nama,
      lingkungan: k.lingkungan,
      nomorLingkungan: k.nomorLingkungan || 0,
      totalHariKerja: totalWorkDays,
      totalHadir,
      totalIzin,
      totalSakit,
      totalDinasLuar,
      totalTidakApel,
      consecutiveAbsentDays: absentStat.consecutiveDays,
      persentaseHadir,
    };
  });

  return {
    monthName,
    totalWorkDays,
    rows,
  };
}
