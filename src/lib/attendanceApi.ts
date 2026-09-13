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
  isWithinWindow: boolean; // 07:30 - 09:00 WIB
  isTooEarly: boolean; // Before 07:30 WIB
  isLate: boolean; // After 09:00 WIB
  statusLabel: string;
}

/**
 * Check if current time falls within official Apel Pagi window: 07:30 - 09:00 WIB
 */
export function checkApelTimeStatus(): WibTimeStatus {
  const d = new Date();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMin = hours * 60 + minutes;

  const startMin = 7 * 60 + 30; // 07:30 WIB = 450 min
  const endMin = 9 * 60 + 0;   // 09:00 WIB = 540 min

  const hoursStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const formattedTime = `${hoursStr}:${minStr} WIB`;

  if (totalMin < startMin) {
    return {
      formattedTime,
      isWithinWindow: false,
      isTooEarly: true,
      isLate: false,
      statusLabel: 'Belum Jam Apel (Jam Resmi 07.30 - 09.00 WIB)',
    };
  }

  if (totalMin > endMin) {
    return {
      formattedTime,
      isWithinWindow: false,
      isTooEarly: false,
      isLate: true,
      statusLabel: 'Terlambat Apel (Lewat Jam Resmi 09.00 WIB)',
    };
  }

  return {
    formattedTime,
    isWithinWindow: true,
    isTooEarly: false,
    isLate: false,
    statusLabel: 'Tepat Waktu (Jam Apel Resmi 07.30 - 09.00 WIB)',
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
      return firestoreData;
    }
  } catch (e) {
    console.warn('Fallback to local storage for attendance:', e);
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
    lokasiGps: lokasiGps || 'Kelurahan Mangga (GPS Terverifikasi)',
    catatan: finalCatatan,
    createdAt: waktuLengkap,
    updatedAt: waktuLengkap,
  };

  // Update local storage
  const currentLocal = getStoredAttendanceLocal();
  const index = currentLocal.findIndex((a) => a.id === docId);
  if (index >= 0) {
    currentLocal[index] = item;
  } else {
    currentLocal.unshift(item);
  }
  setStoredAttendanceLocal(currentLocal);

  // Sync to Firebase Firestore
  saveAttendanceToFirestore(item).catch((err) => {
    console.warn('Gagal menyinkronkan absen ke Firestore:', err);
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
