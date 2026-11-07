import { AbsenApelItem } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
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

export const mergeAttendanceLists = (a: AbsenApelItem[] = [], b: AbsenApelItem[] = []): AbsenApelItem[] => {
  const map = new Map<string, AbsenApelItem>();
  const makeKey = (item: AbsenApelItem) => {
    if (item.id) return item.id;
    const acc = item.accountId || item.keplingId || 'unknown';
    const tgl = item.tanggal || item.createdAt?.slice(0, 10) || 'unknown';
    return `absen_${acc}_${tgl}`;
  };

  [...b, ...a].forEach((item) => {
    if (!item) return;
    const key = makeKey(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const curTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (curTime >= exTime) {
        map.set(key, { ...existing, ...item });
      }
    }
  });

  return Array.from(map.values()).sort((x, y) => {
    const tx = new Date(x.createdAt || x.tanggal || 0).getTime();
    const ty = new Date(y.createdAt || y.tanggal || 0).getTime();
    return ty - tx;
  });
};

export const submitAbsenApel = async (
  account: any,
  status: any,
  fotoSelfie?: string,
  lokasiGps?: string,
  catatan?: string,
  selectedDate?: string
): Promise<boolean> => {
  try {
    const targetDate = selectedDate || getTodayDateString();
    const now = new Date();
    const jamStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
    
    const accountId = account?.id || account?.username || 'kepling';
    const recordId = `absen_${accountId}_${targetDate}`;

    const newRecord: AbsenApelItem = {
      id: recordId,
      accountId: accountId,
      keplingId: accountId,
      namaKepling: account?.nama || account?.name || 'Kepala Lingkungan',
      lingkungan: account?.lingkungan || 'Lingkungan',
      nomorLingkungan: account?.nomorLingkungan || 0,
      tanggal: targetDate,
      jam: jamStr,
      waktuLengkap: now.toISOString(),
      status: status,
      fotoSelfieUrl: fotoSelfie || '',
      lokasiGps: lokasiGps || 'Jl. Flamboyan Raya No. 49, Kelurahan Mangga',
      catatan: catatan || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 1. Update LocalStorage immediately
    const currentList = loadAllAttendance();
    const updatedList = mergeAttendanceLists([newRecord], currentList);
    safeSetLocalStorage(ATTENDANCE_STORAGE_KEY, JSON.stringify(updatedList));

    // 2. Broadcast via BroadcastChannel
    try {
      const bc = new BroadcastChannel('sikepling_attendance_channel');
      bc.postMessage({ type: 'ATTENDANCE_UPDATED', record: newRecord, all: updatedList });
      bc.close();
    } catch {}

    // 3. Save to server buffer POST /api/attendance
    try {
      fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      }).catch(err => console.warn('Server attendance buffer warning:', err));
    } catch {}

    // 4. Save to Firestore collection 'attendance'
    if (db) {
      try {
        const docRef = doc(db, 'attendance', recordId);
        await setDoc(docRef, newRecord, { merge: true });
      } catch (fErr) {
        console.warn('Firestore attendance save warning:', fErr);
      }
    }

    return true;
  } catch (error) {
    console.error('Error submitting absen apel:', error);
    return false;
  }
};

export const computeAttendanceSummary24 = (attendanceList: AbsenApelItem[] = [], date?: string) => {
  const targetDate = date || getTodayDateString();
  const todayRecords = attendanceList.filter(a => a.tanggal === targetDate || a.createdAt?.startsWith(targetDate));
  
  const isStatus = (a: AbsenApelItem, ...matches: string[]) => {
    const st = String(a.status || '').toUpperCase();
    return matches.some(m => st.includes(m.toUpperCase()));
  };

  const totalHadir = todayRecords.filter(a => isStatus(a, 'Hadir')).length;
  const totalIzin = todayRecords.filter(a => isStatus(a, 'Izin')).length;
  const totalSakit = todayRecords.filter(a => isStatus(a, 'Sakit')).length;
  const totalDinasLuar = todayRecords.filter(a => isStatus(a, 'Dinas')).length;
  const totalAlpa = todayRecords.filter(a => isStatus(a, 'Tidak', 'Alpa')).length;
  
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
      (a) => (a.keplingId === keplingId || a.accountId === keplingId) && (a.tanggal === targetDate || a.createdAt?.startsWith(targetDate))
    ) || null
  );
};

export const checkApelTimeStatus = () => {
  const d = new Date();
  const day = d.getDay();
  const isWorkDay = day >= 1 && day <= 5;
  const hour = d.getHours();
  const minute = d.getMinutes();
  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} WIB`;
  
  // Rule: apel window 07.00 - 08.00 Waktu Indonesia Barat
  const isLate = hour > 8 || (hour === 8 && minute > 0);
  const isWithinWindow = hour >= 7 && (hour < 8 || (hour === 8 && minute === 0));
  const statusLabel = isLate ? 'Terlambat' : 'Tepat Waktu';

  if (isLate) {
    return {
      status: 'TERLAMBAT' as const,
      label: 'Terlambat',
      statusLabel: 'Terlambat',
      isLate: true,
      isWorkDay,
      isWithinWindow,
      formattedTime,
      colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
    };
  }

  return {
    status: 'TEPAT_WAKTU' as const,
    label: 'Tepat Waktu',
    statusLabel: 'Tepat Waktu',
    isLate: false,
    isWorkDay,
    isWithinWindow,
    formattedTime,
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
    const accId = a.keplingId || a.accountId;
    return d.startsWith(`${year}-${String(month).padStart(2, '0')}`) && accId === keplingId;
  });

  const totalAbsent = monthRecords.filter(a => {
    const st = String(a.status || '').toUpperCase();
    return st.includes('TIDAK') || st.includes('ALPA');
  }).length;

  return {
    consecutiveDays: 0, // Placeholder for more complex logic
    totalAbsentThisMonth: totalAbsent,
  };
};

export const loadAllAttendance = (): AbsenApelItem[] => {
  const data = safeGetLocalStorage<any>(ATTENDANCE_STORAGE_KEY, []);
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

export const isAttendanceMatchingKepling = (record: any, keplingInput: any) => {
  if (!record || !keplingInput) return false;
  if (typeof keplingInput === 'string') {
    const s = keplingInput.trim().toLowerCase();
    if (record.keplingId && record.keplingId.toLowerCase() === s) return true;
    if (record.accountId && record.accountId.toLowerCase() === s) return true;
    if (record.namaKepling && record.namaKepling.trim().toLowerCase() === s) return true;
    return false;
  }
  if (typeof keplingInput === 'object') {
    const targetId = (keplingInput.id || keplingInput.username || '').toLowerCase();
    if (targetId && (record.keplingId?.toLowerCase() === targetId || record.accountId?.toLowerCase() === targetId)) {
      return true;
    }
    const targetNama = (keplingInput.nama || keplingInput.name || '').trim().toLowerCase();
    if (targetNama && record.namaKepling?.trim().toLowerCase() === targetNama) {
      return true;
    }
    const targetLk = keplingInput.nomorLingkungan;
    const recLk = record.nomorLingkungan;
    if (targetLk && recLk && Number(targetLk) === Number(recLk)) {
      return true;
    }
  }
  return false;
};

export const isAttendanceMatchingDate = (record: any, dateStr: string) => {
  if (!record || !dateStr) return false;
  const targetIso = dateStr.slice(0, 10);
  if (record.tanggal && record.tanggal.slice(0, 10) === targetIso) return true;
  if (record.createdAt && record.createdAt.slice(0, 10) === targetIso) return true;
  if (record.waktuLengkap && record.waktuLengkap.slice(0, 10) === targetIso) return true;
  return false;
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
    const accRecords = attendanceList.filter(a => (a.keplingId || a.accountId) === acc.id);
    const dailyStatus: Record<string, string> = {};
    let hadir = 0;
    let tidakApel = 0;
    let izinSakit = 0;

    workDates.forEach(wd => {
      const rec = accRecords.find(r => r.tanggal === wd.dateStr || r.createdAt?.startsWith(wd.dateStr));
      if (rec) {
        dailyStatus[wd.dateStr] = rec.status;
        const st = String(rec.status || '').toUpperCase();
        if (st.includes('HADIR')) hadir++;
        else if (st.includes('IZIN') || st.includes('SAKIT')) izinSakit++;
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
      const accId = a.keplingId || a.accountId;
      return d.startsWith(`${year}-${String(month).padStart(2, '0')}`) && accId === acc.id;
    });

    const hadir = monthRecords.filter(r => String(r.status || '').toUpperCase().includes('HADIR')).length;
    const izinSakit = monthRecords.filter(r => {
      const st = String(r.status || '').toUpperCase();
      return st.includes('IZIN') || st.includes('SAKIT');
    }).length;
    const tidakApel = monthRecords.filter(r => {
      const st = String(r.status || '').toUpperCase();
      return st.includes('TIDAK') || st.includes('ALPA');
    }).length;

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
  if (initial.length > 0) {
    cb(initial);
  }

  // Fetch from server buffer (/api/attendance) immediately to ensure seed data/cache is available
  fetch('/api/attendance')
    .then(r => r.json())
    .then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const merged = mergeAttendanceLists(loadAllAttendance(), res.data);
        safeSetLocalStorage(ATTENDANCE_STORAGE_KEY, JSON.stringify(merged));
        cb(merged);
      }
    })
    .catch(() => {});

  // Real-time broadcast channel across open tabs
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('sikepling_attendance_channel');
    bc.onmessage = (ev) => {
      if (ev.data && (ev.data.type === 'ATTENDANCE_UPDATED' || ev.data.type === 'ATTENDANCE_REFRESH')) {
        const current = loadAllAttendance();
        cb(current);
      }
    };
  } catch {}

  // Real-time Firestore snapshot listener
  let unsubFirestore: (() => void) = () => {};
  if (db) {
    try {
      const q = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          const items: AbsenApelItem[] = [];
          snap.forEach(d => items.push({ ...d.data(), id: d.id } as AbsenApelItem));
          if (items.length > 0) {
            const merged = mergeAttendanceLists(loadAllAttendance(), items);
            safeSetLocalStorage(ATTENDANCE_STORAGE_KEY, JSON.stringify(merged));
            cb(merged);
          }
        },
        (err) => {
          console.warn('Attendance subscription snapshot error:', err);
        }
      );
    } catch (e) {
      console.warn('Attendance subscription failed:', e);
    }
  }

  return () => {
    unsubFirestore();
    if (bc) bc.close();
  };
};

