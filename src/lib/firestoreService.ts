export const cleanFirestoreData = (data: any) => {
  const cleaned: any = {};
  for (const key of Object.keys(data || {})) {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

export interface SyncAuditLog {
  id?: string;
  timestamp: string;
  actor: string;
  action: string;
  status: string;
  details?: any;
}

export interface AttendanceQREntity {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  [key: string]: any;
}

import { collection, getDocs, doc, setDoc, deleteDoc, query, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const fetchReportsFromFirestore = async (): Promise<any[]> => {
  if (!db) return [];
  try {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch from 'reports' collection
    try {
      const snap1 = await getDocs(collection(db, 'reports'));
      snap1.forEach((d) => {
        const data = d.data();
        if (data && d.id) {
          list.push({ ...data, id: d.id });
          seenIds.add(d.id);
        }
      });
    } catch (e) {
      console.warn('Error fetching reports collection from Firestore:', e);
    }

    // 2. Fetch from 'laporan_harian' collection
    try {
      const snap2 = await getDocs(collection(db, 'laporan_harian'));
      snap2.forEach((d) => {
        const data = d.data();
        if (data && d.id && !seenIds.has(d.id)) {
          list.push({ ...data, id: d.id });
          seenIds.add(d.id);
        }
      });
    } catch (e) {
      // Ignore if collection doesn't exist
    }

    return list;
  } catch (err) {
    console.error('fetchReportsFromFirestore error:', err);
    return [];
  }
};

export const saveReportToFirestore = async (item: any): Promise<boolean> => {
  if (!db || !item || !item.id) return false;
  try {
    const cleaned = cleanFirestoreData(item);
    await setDoc(doc(db, 'reports', item.id), cleaned, { merge: true });
    return true;
  } catch (err) {
    console.error('saveReportToFirestore error:', err);
    return false;
  }
};

export const deleteReportFromFirestore = async (id: string): Promise<boolean> => {
  if (!db || !id) return false;
  try {
    await deleteDoc(doc(db, 'reports', id));
    return true;
  } catch (err) {
    console.error('deleteReportFromFirestore error:', err);
    return false;
  }
};

export const resetAllReportsInFirestore = async (): Promise<boolean> => {
  if (!db) return false;
  try {
    const list = await fetchReportsFromFirestore();
    for (const item of list) {
      if (item && item.id) {
        await deleteDoc(doc(db, 'reports', item.id)).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    return false;
  }
};

export const subscribeReportsFromFirestore = (cb: (items: any[]) => void) => {
  if (!db) {
    cb([]);
    return () => {};
  }
  try {
    const q = query(collection(db, 'reports'));
    return onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && docSnap.id) {
          items.push({ ...d, id: docSnap.id });
        }
      });
      cb(items);
    }, (err) => {
      console.warn('subscribeReportsFromFirestore error:', err);
      cb([]);
    });
  } catch (e) {
    cb([]);
    return () => {};
  }
};

export const shouldFilterReport = (_r?: any) => false;

export const fetchTargetsFromFirestore = async (): Promise<any> => ({});
export const saveTargetToFirestore = async () => {};
export const saveAllTargetsToFirestore = async () => {};
export const resetTargetsInFirestore = async () => {};
export const subscribeTargetsFromFirestore = (cb: any) => { cb([]); return () => {}; };

export const saveSyncAuditLog = async (_log: any) => {};
export const fetchSyncAuditLogs = async (): Promise<SyncAuditLog[]> => [];
export const saveAttendanceQRToFirestore = async (_qr: any) => {};
export const subscribeAttendanceQRFromFirestore = (_dateStr: string, cb: (qr: AttendanceQREntity | null) => void) => {
  if (typeof cb === 'function') {
    cb(null);
  }
  return () => {};
};

export const subscribeCustomEventsFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const subscribeEventAttendanceFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const saveCustomEventToFirestore = async (_event: any) => {};
export const deleteCustomEventFromFirestore = async (_id: string) => {};
export const saveEventAttendanceToFirestore = async (_att: any) => {};
