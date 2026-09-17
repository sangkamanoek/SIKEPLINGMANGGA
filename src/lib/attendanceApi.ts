import { AbsenApelItem, StatusAbsenApel, UserAccount } from '../types';
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
  const d = new Date();
  const day = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMin = hours * 60 + minutes;

  const startMin = 7 * 60 + 30; // 07:30 WIB = 450 min
  const endMin = 8 * 60 + 30;   // 08:30 WIB = 510 min

  const hoursStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const formattedTime = `${hoursStr}:${minStr} WIB`;

  const isWorkDay = day >= 1 && day <= 5;

  if (!isWorkDay) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDayName = dayNames[day];
    return {
      formattedTime,
      isWorkDay: false,
      isWithinWindow: false,
      isTooEarly: false,
      isLate: false,
      statusLabel: `Libur Akhir Pekan (${currentDayName}) • Apel Pagi Hanya Senin s/d Jumat`,
    };
  }

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
 * Load attendance list from localStorage fallback
 */
export function getStoredAttendanceLocal(): AbsenApelItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca absen dari localStorage:', e);
  }
  return [];
}

/**
 * Save attendance list to localStorage safely
 */
export function setStoredAttendanceLocal(items: AbsenApelItem[]): void {
  try {
    // Keep heavy photos light in local storage
    const trimmed = items.map((item) => {
      if (item.fotoSelfieUrl && item.fotoSelfieUrl.length > 80000) {
        return {
          ...item,
          fotoSelfieUrl: item.fotoSelfieUrl.substring(0, 100) + '...',
        };
      }
      return item;
    });
    safeSetLocalStorage(STORAGE_KEY_ATTENDANCE, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Gagal menyimpan absen ke localStorage:', e);
  }
}

/**
 * Load all attendance records from Firestore and local cache
 */
export async function loadAllAttendance(): Promise<AbsenApelItem[]> {
  try {
    const firestoreData = await fetchAttendanceFromFirestore();
    if (firestoreData && firestoreData.length > 0) {
      setStoredAttendanceLocal(firestoreData);
      // Sync to server buffer in background
      fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: firestoreData }),
      }).catch(() => {});
      return firestoreData;
    }
  } catch (e) {
    console.warn('Fallback from Firestore for attendance:', e);
  }

  // Backup Tier 1: Internal Server Buffer API
  try {
    const res = await fetch('/api/attendance');
    if (res.ok) {
      const json = await res.json();
      const serverItems = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (serverItems && serverItems.length > 0) {
        setStoredAttendanceLocal(serverItems);
        return serverItems;
      }
    }
  } catch (e) {
    console.warn('Fallback from server /api/attendance:', e);
  }

  return getStoredAttendanceLocal();
}

/**
 * Submit or update attendance record
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

  // 1. Update local storage
  const currentLocal = getStoredAttendanceLocal();
  const index = currentLocal.findIndex((a) => a.id === docId);
  if (index >= 0) {
    currentLocal[index] = item;
  } else {
    currentLocal.unshift(item);
  }
  setStoredAttendanceLocal(currentLocal);

  // 2. Concurrently sync to Firebase Firestore and Server Buffer
  saveAttendanceToFirestore(item).catch((err) => {
    console.warn('Gagal menyinkronkan absen ke Firestore:', err);
  });

  fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  }).catch((err) => {
    console.warn('Gagal menyinkronkan absen ke server buffer:', err);
  });

  return item;
}

/**
 * Get today's attendance record for a specific Kepling account
 */
export function getTodayAbsenForKepling(
  attendanceList: AbsenApelItem[],
  accountId: string,
  tanggal?: string
): AbsenApelItem | undefined {
  const dateStr = tanggal || getTodayDateString();
  return attendanceList.find(
    (a) => a.accountId === accountId && a.tanggal === dateStr
  );
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
  const todayRecords = attendanceList.filter((a) => a.tanggal === dateStr && a.accountId !== 'super_admin');

  let hadir = 0;
  let izin = 0;
  let sakit = 0;
  let dinasLuar = 0;

  todayRecords.forEach((rec) => {
    if (rec.status === 'Hadir') hadir++;
    else if (rec.status === 'Izin') izin++;
    else if (rec.status === 'Sakit') sakit++;
    else if (rec.status === 'Dinas Luar') dinasLuar++;
  });

  const totalKepling = KEPLING_ACCOUNTS.length; // 24
  const totalSudahAbsen = todayRecords.length;
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
  referenceDateStr?: string
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
      const rec = attendanceList.find((a) => a.accountId === accountId && a.tanggal === dateStr);
      const isToday = dateStr === todayStr;

      let isAbsent = false;

      if (rec) {
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
