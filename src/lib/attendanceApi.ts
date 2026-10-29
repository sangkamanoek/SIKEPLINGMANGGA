import { AbsenApelItem } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const ATTENDANCE_STORAGE_KEY = 'sikepling_attendance_list_v1';

export interface KeplingWeeklyRow {
  accountId: string;
  nama: string;
  lingkungan: string;
  nomorLingkungan?: number;
  dailyStatus: Record<string, string>;
  totalHadir: number;
  totalTidakApel: number;
  totalIzinSakit: number;
  percentageHadir: number;
  [key: string]: any;
}

export interface KeplingMonthlyRow {
  accountId: string;
  nama: string;
  lingkungan: string;
  nomorLingkungan?: number;
  dailyStatus: Record<string, string>;
  totalHadir: number;
  totalTidakApel: number;
  totalIzinSakit: number;
  percentageHadir: number;
  [key: string]: any;
}

export const getTodayDateString = () => new Date().toISOString().split('T')[0];
export const getCurrentTimeString = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const submitAbsenApel = async (_data: any) => {
  // Logic usually handled in the component calling saveAbsen
};

export const computeAttendanceSummary24 = (attendanceList: AbsenApelItem[] = [], date?: string) => {
  const targetDate = date || getTodayDateString();
  const todayRecords = attendanceList.filter(a => a.tanggal === targetDate || a.createdAt?.startsWith(targetDate));
  
  const totalHadir = todayRecords.filter(a => a.status === 'HADIR').length;
  const totalIzin = todayRecords.filter(a => a.status === 'IZIN').length;
  const totalSakit = todayRecords.filter(a => a.status === 'SAKIT').length;
  const totalDinasLuar = todayRecords.filter(a => a.status === 'DINAS_LUAR').length;
  const totalAlpa = todayRecords.filter(a => a.status === 'ALPA' || a.status === 'TIDAK_HADIR').length;
  
  const totalParticipating = 24;
  const percentageHadir = (totalHadir / totalParticipating) * 100;

  return {
    totalHadir,
    percentageHadir,
    totalIzin,
    totalSakit,
    totalDinasLuar,
    totalBelumAbsen: Math.max(0, totalParticipating - todayRecords.length),
    hadir: totalHadir,
    izin: totalIzin,
    sakit: totalSakit,
    alpa: totalAlpa,
  };
};

export const getTodayAbsenForKepling = (
  attendanceList: AbsenApelItem[],
  keplingId: string,
  date?: string
): AbsenApelItem | null => {
  const targetDate = date || getTodayDateString();
  return (
    attendanceList?.find(
      (a) => a.keplingId === keplingId && (a.tanggal === targetDate || a.createdAt?.startsWith(targetDate))
    ) || null
  );
};

export const checkApelTimeStatus = () => {
  const d = new Date();
  const hour = d.getHours();
  const minute = d.getMinutes();
  
  // Example rule: late after 08:00
  const isLate = hour > 8 || (hour === 8 && minute > 0);
  
  if (isLate) {
    return {
      status: 'TERLAMBAT' as const,
      label: 'Terlambat',
      isLate: true,
      colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
    };
  }

  return {
    status: 'TEPAT_WAKTU' as const,
    label: 'Tepat Waktu',
    isLate: false,
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  };
};

export const calculateAbsentDays = (
  attendanceList: AbsenApelItem[] = [],
  keplingId: string,
  date?: string
) => {
  const targetDate = date || getTodayDateString();
  const [year, month] = targetDate.split('-').map(Number);
  
  const monthRecords = attendanceList.filter(a => {
    const d = a.tanggal || a.createdAt || '';
    return d.startsWith(`${year}-${String(month).padStart(2, '0')}`) && a.keplingId === keplingId;
  });

  const totalAbsent = monthRecords.filter(a => a.status === 'ALPA' || a.status === 'TIDAK_HADIR').length;

  return {
    consecutiveDays: 0, // Placeholder for more complex logic
    totalAbsentThisMonth: totalAbsent,
  };
};

export const loadAllAttendance = (): AbsenApelItem[] => {
  return safeGetLocalStorage<AbsenApelItem[]>(ATTENDANCE_STORAGE_KEY, []);
};

export const isAttendanceMatchingKepling = (record: any, keplingId: string) => {
  return record?.keplingId === keplingId;
};

export const isAttendanceMatchingDate = (record: any, dateStr: string) => {
  return record?.tanggal === dateStr || record?.createdAt?.startsWith(dateStr);
};

export const computeWeeklyAttendance24 = (attendanceList: AbsenApelItem[] = [], _weekRefDate?: string) => {
  // Logic to determine last 5 work days
  const workDates: any[] = [];
  const d = new Date();
  // Simple: last 5 days
  for (let i = 4; i >= 0; i--) {
    const date = new Date();
    date.setDate(d.getDate() - i);
    const ds = date.toISOString().split('T')[0];
    workDates.push({
      dateStr: ds,
      dayName: date.toLocaleDateString('id-ID', { weekday: 'long' }),
      formatted: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    });
  }

  const rows: KeplingWeeklyRow[] = KEPLING_ACCOUNTS.map((acc) => {
    const accRecords = attendanceList.filter(a => a.keplingId === acc.id);
    const dailyStatus: Record<string, string> = {};
    let hadir = 0;
    let tidakApel = 0;
    let izinSakit = 0;

    workDates.forEach(wd => {
      const rec = accRecords.find(r => r.tanggal === wd.dateStr || r.createdAt?.startsWith(wd.dateStr));
      if (rec) {
        dailyStatus[wd.dateStr] = rec.status;
        if (rec.status === 'HADIR') hadir++;
        else if (rec.status === 'IZIN' || rec.status === 'SAKIT') izinSakit++;
        else tidakApel++;
      } else {
        dailyStatus[wd.dateStr] = '-';
      }
    });

    return {
      accountId: acc.id,
      nama: acc.nama,
      lingkungan: acc.lingkungan,
      nomorLingkungan: acc.nomorLingkungan,
      dailyStatus,
      totalHadir: hadir,
      totalTidakApel: tidakApel,
      totalIzinSakit: izinSakit,
      percentageHadir: (hadir / workDates.length) * 100,
    };
  });

  return {
    weekLabel: `${workDates[0].formatted} - ${workDates[4].formatted}`,
    workDates,
    rows,
  };
};

export const computeMonthlyAttendance24 = (
  attendanceList: AbsenApelItem[] = [],
  yearInput?: number,
  monthInput?: number
) => {
  const now = new Date();
  const year = yearInput || now.getFullYear();
  const month = monthInput || (now.getMonth() + 1);
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const rows: KeplingMonthlyRow[] = KEPLING_ACCOUNTS.map((acc) => {
    const monthRecords = attendanceList.filter(a => {
      const d = a.tanggal || a.createdAt || '';
      return d.startsWith(`${year}-${String(month).padStart(2, '0')}`) && a.keplingId === acc.id;
    });

    const hadir = monthRecords.filter(r => r.status === 'HADIR').length;
    const izinSakit = monthRecords.filter(r => r.status === 'IZIN' || r.status === 'SAKIT').length;
    const tidakApel = monthRecords.filter(r => r.status === 'ALPA' || r.status === 'TIDAK_HADIR').length;

    return {
      accountId: acc.id,
      nama: acc.nama,
      lingkungan: acc.lingkungan,
      nomorLingkungan: acc.nomorLingkungan,
      dailyStatus: {}, // Simplified
      totalHadir: hadir,
      totalTidakApel: tidakApel,
      totalIzinSakit: izinSakit,
      percentageHadir: hadir > 0 ? (hadir / (hadir + tidakApel + izinSakit || 1)) * 100 : 0,
    };
  });

  return {
    monthName: monthNames[month - 1],
    totalWorkDays: 22, // Static estimate
    rows,
  };
};

export const subscribeAttendance = (cb: (items: AbsenApelItem[]) => void) => {
  const initial = loadAllAttendance();
  cb(initial);

  if (!db) return () => {};

  try {
    const q = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: AbsenApelItem[] = [];
      snap.forEach(d => items.push({ ...d.data(), id: d.id } as AbsenApelItem));
      safeSetLocalStorage(ATTENDANCE_STORAGE_KEY, JSON.stringify(items));
      cb(items);
    });
    return unsub;
  } catch (e) {
    console.error('Attendance subscription failed:', e);
    return () => {};
  }
};

