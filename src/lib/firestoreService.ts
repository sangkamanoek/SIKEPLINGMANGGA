import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { LaporanHarianItem, KeplingTargetCapaian, TargetsCapaianMap, TaskReminder, NotificationLog, AbsenApelItem, EventAttendance } from '../types';
import type { CustomEvent } from '../types';
import { getDefaultTargetsCapaianMap } from '../data/targetsData';

import { getAccessToken } from './firebase';
import { syncAttendancePhotoToDrive } from './driveSync';

// Local in-memory cache of deleted report IDs to prevent re-emergence
const deletedReportIdsMemory = new Set<string>();

/**
 * Recursively cleans an object/array for Firestore writes by removing any fields with `undefined` values.
 * Firestore strictly forbids `undefined` anywhere in document payloads.
 */
export function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  if (!data || typeof data !== 'object') return data;
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue; // Skip undefined completely
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      cleaned[key] = cleanFirestoreData(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value
        .filter((v) => v !== undefined)
        .map((v) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? cleanFirestoreData(v) : v));
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export const shouldFilterReport = (report: any): boolean => {
  if (!report) return true;
  if (report.id && deletedReportIdsMemory.has(report.id)) {
    console.warn(`[filter] Report ${report.id} filtered out (marked deleted).`);
    return true;
  }
  return false;
};

// ==========================================
// 1. LAPORAN HARIAN (REPORTS) CRUD
// ==========================================

const REPORTS_COLLECTION = 'reports';
const DELETED_REPORTS_COLLECTION = 'deleted_reports';

/**
 * Fetch all registered deleted report IDs (Tombstones) - with quota limit
 */
export async function fetchDeletedReportIdsFromFirestore(): Promise<Set<string>> {
  try {
    const delCol = collection(db, DELETED_REPORTS_COLLECTION);
    const snap = await getDocs(query(delCol, limit(50)));
    snap.forEach((docSnap) => {
      deletedReportIdsMemory.add(docSnap.id);
      const data = docSnap.data();
      if (data.id) deletedReportIdsMemory.add(data.id);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, DELETED_REPORTS_COLLECTION);
  }
  return deletedReportIdsMemory;
}

/**
 * Fetch reports from Firebase Firestore
 */
export async function fetchReportsFromFirestore(): Promise<LaporanHarianItem[]> {
  try {
    // 1. Sync deleted report IDs
    await fetchDeletedReportIdsFromFirestore();

    const colRef = collection(db, REPORTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const reports: LaporanHarianItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as LaporanHarianItem;
      const reportId = docSnap.id || data.id;
      const report: LaporanHarianItem = {
        ...data,
        id: reportId,
      };

      // If document was previously deleted, remove it immediately from Firestore
      if (deletedReportIdsMemory.has(reportId) || deletedReportIdsMemory.has(data.id)) {
        deleteDoc(docSnap.ref).catch(() => {});
        return;
      }

      if (!shouldFilterReport(report)) {
        reports.push(report);
      }
    });

    // Sort descending by createdAt or tanggal
    reports.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return reports;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
    return [];
  }
}

/**
 * Save / Create / Update single report in Firebase Firestore
 */
export async function saveReportToFirestore(item: LaporanHarianItem): Promise<boolean> {
  try {
    if (!item.id) {
      item.id = 'lap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    
    // Check if this item was marked as deleted by Admin
    if (deletedReportIdsMemory.has(item.id)) {
      console.warn(`Laporan ${item.id} sudah dihapus oleh Admin dan ditolak untuk disimpan.`);
      return false;
    }

    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    item.updatedAt = new Date().toISOString();

    const docRef = doc(db, REPORTS_COLLECTION, item.id);
    await setDoc(docRef, cleanFirestoreData(item), { merge: true });

    return true;
  } catch (error) {
    // Fallback: If payload size is too large due to heavy base64 images, attempt to save without corrupted strings
    try {
      // Keep valid photos, and if document is still too large, reduce number of photos cleanly rather than breaking base64 string
      const safeItem: LaporanHarianItem = {
        ...item,
        dokumentasiFoto: item.dokumentasiFoto?.slice(0, 4),
      };
      const docRef = doc(db, REPORTS_COLLECTION, item.id);
      await setDoc(docRef, cleanFirestoreData(safeItem), { merge: true });
      return true;
    } catch (fallbackError) {
      handleFirestoreError(error, OperationType.WRITE, REPORTS_COLLECTION);
      return false;
    }
  }
}

/**
 * Delete single report from Firebase Firestore and register permanent tombstone
 */
export async function deleteReportFromFirestore(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    // 1. Mark in in-memory blacklist immediately
    deletedReportIdsMemory.add(id);

    // 2. Write permanent tombstone in deleted_reports collection
    try {
      const delDocRef = doc(db, DELETED_REPORTS_COLLECTION, id);
      await setDoc(delDocRef, {
        id,
        deletedAt: new Date().toISOString(),
        deletedBy: 'admin',
      });
    } catch (delErr) {
      handleFirestoreError(delErr, OperationType.WRITE, DELETED_REPORTS_COLLECTION);
    }

    // 3. Delete directly from reports collection by primary ID
    const docRef = doc(db, REPORTS_COLLECTION, id);
    await deleteDoc(docRef);

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, REPORTS_COLLECTION);
    return false;
  }
}

/**
 * Batch sync multiple reports to Firebase Firestore
 */
export async function batchSyncReportsToFirestore(items: LaporanHarianItem[]): Promise<number> {
  try {
    if (!Array.isArray(items) || items.length === 0) return 0;

    let synced = 0;
    // Chunk items into batches of 400 (Firestore maximum is 500 ops per batch)
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item || !item.namaKepling || shouldFilterReport(item) || (item.id && deletedReportIdsMemory.has(item.id))) continue;
        const id = item.id || ('lap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
        const docRef = doc(db, REPORTS_COLLECTION, id);
        batch.set(docRef, cleanFirestoreData({ ...item, id }), { merge: true });
        synced++;
      }

      await batch.commit();
    }

    return synced;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, REPORTS_COLLECTION);
    return 0;
  }
}

/**
 * Reset all reports in Firebase Firestore
 */
export async function resetAllReportsInFirestore(): Promise<boolean> {
  try {
    const colRef = collection(db, REPORTS_COLLECTION);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) return true;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, REPORTS_COLLECTION);
    return false;
  }
}

/**
 * Real-time listener for reports in Firebase Firestore
 */
export function subscribeReportsFromFirestore(
  onData: (reports: LaporanHarianItem[], isFromCache: boolean) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, REPORTS_COLLECTION);
  let debounceTimer: any = null;

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const reports: LaporanHarianItem[] = [];
        const isFromCache = snapshot.metadata.fromCache;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LaporanHarianItem;
          const reportId = docSnap.id || data.id;
          const report: LaporanHarianItem = {
            ...data,
            id: reportId,
          };
          if (deletedReportIdsMemory.has(reportId) || deletedReportIdsMemory.has(data.id)) {
            // If deleted, ignore and clean up in background
            deleteDoc(docSnap.ref).catch(() => {});
            return;
          }
          if (!shouldFilterReport(report)) {
            reports.push(report);
          }
        });

        reports.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        onData(reports, isFromCache);
      }, 5);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, REPORTS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

// ==========================================
// 2. TARGET & CAPAIAN CRUD
// ==========================================

const TARGETS_COLLECTION = 'targets_capaian';

/**
 * Fetch all targets & capaian from Firebase Firestore (with auto seed if empty)
 */
export async function fetchTargetsFromFirestore(): Promise<TargetsCapaianMap> {
  try {
    const colRef = collection(db, TARGETS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const map: TargetsCapaianMap = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as KeplingTargetCapaian;
      map[docSnap.id] = {
        ...data,
        keplingId: docSnap.id,
      };
    });

    if (Object.keys(map).length > 0) {
      return map;
    }

    // Auto-seed default targets to Firestore if collection is empty
    const defaults = getDefaultTargetsCapaianMap();
    await saveAllTargetsToFirestore(defaults);
    return defaults;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, TARGETS_COLLECTION);
    return getDefaultTargetsCapaianMap();
  }
}

/**
 * Save or update target/capaian for single Kepling
 */
export async function saveTargetToFirestore(
  item: Partial<KeplingTargetCapaian> & { keplingId: string }
): Promise<boolean> {
  try {
    const docRef = doc(db, TARGETS_COLLECTION, item.keplingId);
    const payload = cleanFirestoreData({
      ...item,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, TARGETS_COLLECTION);
    return false;
  }
}

/**
 * Save / Update batch of all targets
 */
export async function saveAllTargetsToFirestore(allTargets: TargetsCapaianMap): Promise<boolean> {
  try {
    const batch = writeBatch(db);
    const keys = Object.keys(allTargets);

    for (const k of keys) {
      const item = allTargets[k];
      const docRef = doc(db, TARGETS_COLLECTION, k);
      batch.set(docRef, cleanFirestoreData({ ...item, updatedAt: new Date().toISOString() }), { merge: true });
    }

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, TARGETS_COLLECTION);
    return false;
  }
}

/**
 * Reset targets in Firestore to default official baseline
 */
export async function resetTargetsInFirestore(): Promise<TargetsCapaianMap> {
  const defaults = getDefaultTargetsCapaianMap();
  await saveAllTargetsToFirestore(defaults);
  return defaults;
}

/**
 * Real-time listener for targets & capaian
 */
export function subscribeTargetsFromFirestore(
  onData: (targets: TargetsCapaianMap) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, TARGETS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const map: TargetsCapaianMap = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as KeplingTargetCapaian;
        map[docSnap.id] = {
          ...data,
          keplingId: docSnap.id,
        };
      });
      if (Object.keys(map).length > 0) {
        onData(map);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, TARGETS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

// ==========================================
// 3. ACCOUNT PASSWORDS CRUD
// ==========================================

const PASSWORDS_COLLECTION = 'account_passwords';

/**
 * Fetch all custom passwords from Firebase Firestore
 */
export async function fetchPasswordsFromFirestore(): Promise<Record<string, string>> {
  try {
    const colRef = collection(db, PASSWORDS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const passwords: Record<string, string> = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.password) {
        passwords[docSnap.id] = String(data.password).trim();
      }
    });

    return passwords;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PASSWORDS_COLLECTION);
    return {};
  }
}

/**
 * Save custom password for account in Firebase Firestore
 */
export async function savePasswordToFirestore(accountId: string, newPassword: string): Promise<boolean> {
  try {
    const docRef = doc(db, PASSWORDS_COLLECTION, accountId);
    await setDoc(
      docRef,
      {
        accountId,
        password: newPassword.trim(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PASSWORDS_COLLECTION);
    return false;
  }
}

/**
 * Reset password in Firebase Firestore (delete custom override)
 */
export async function resetPasswordInFirestore(accountId: string): Promise<boolean> {
  try {
    const docRef = doc(db, PASSWORDS_COLLECTION, accountId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PASSWORDS_COLLECTION);
    return false;
  }
}

/**
 * Real-time listener for account passwords
 */
export function subscribePasswordsFromFirestore(
  onData: (passwords: Record<string, string>) => void
): Unsubscribe {
  const colRef = collection(db, PASSWORDS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const passwords: Record<string, string> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.password) {
          passwords[docSnap.id] = String(data.password).trim();
        }
      });
      onData(passwords);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, PASSWORDS_COLLECTION);
    }
  );
}

// ==========================================
// 4. TASK REMINDERS & NOTIFICATION LOGS CRUD
// ==========================================

const REMINDERS_COLLECTION = 'reminders';
const NOTIFICATION_LOGS_COLLECTION = 'notification_logs';

export async function fetchRemindersFromFirestore(): Promise<TaskReminder[]> {
  try {
    const snapshot = await getDocs(collection(db, REMINDERS_COLLECTION));
    const items: TaskReminder[] = [];
    snapshot.forEach((d) => items.push({ ...(d.data() as TaskReminder), id: d.id }));
    return items;
  } catch {
    return [];
  }
}

export async function saveReminderToFirestore(reminder: TaskReminder): Promise<boolean> {
  try {
    await setDoc(doc(db, REMINDERS_COLLECTION, reminder.id), reminder, { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function deleteReminderFromFirestore(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, REMINDERS_COLLECTION, id));
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// 5. KEPLING PROFILES (NAMA & TELEPON) CRUD
// ==========================================

const PROFILES_COLLECTION = 'account_profiles';

export async function fetchProfilesFromFirestore(): Promise<Record<string, { nama?: string; telepon?: string }>> {
  try {
    const colRef = collection(db, PROFILES_COLLECTION);
    const snapshot = await getDocs(colRef);
    const profiles: Record<string, { nama?: string; telepon?: string }> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        profiles[docSnap.id] = {
          nama: data.nama,
          telepon: data.telepon,
        };
      }
    });
    return profiles;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, PROFILES_COLLECTION);
    return {};
  }
}

export async function saveProfileToFirestore(
  accountId: string,
  profile: { nama?: string; telepon?: string }
): Promise<boolean> {
  try {
    const docRef = doc(db, PROFILES_COLLECTION, accountId);
    await setDoc(
      docRef,
      {
        accountId,
        ...profile,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PROFILES_COLLECTION);
    return false;
  }
}

export function subscribeProfilesFromFirestore(
  onData: (profiles: Record<string, { nama?: string; telepon?: string }>) => void
): Unsubscribe {
  const colRef = collection(db, PROFILES_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const profiles: Record<string, { nama?: string; telepon?: string }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
          profiles[docSnap.id] = {
            nama: data.nama,
            telepon: data.telepon,
          };
        }
      });
      onData(profiles);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, PROFILES_COLLECTION);
    }
  );
}

// ==========================================
// 7. ABSEN APEL PAGI (ATTENDANCE) CRUD
// ==========================================

const ATTENDANCE_COLLECTION = 'attendance';

export async function fetchAttendanceFromFirestore(): Promise<AbsenApelItem[]> {
  try {
    const colRef = collection(db, ATTENDANCE_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: AbsenApelItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AbsenApelItem;
      if (data && data.id) {
        list.push(data);
      }
    });
    // Sort descending by time
    list.sort((a, b) => new Date(b.waktuLengkap || b.createdAt).getTime() - new Date(a.waktuLengkap || a.createdAt).getTime());
    return list;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, ATTENDANCE_COLLECTION);
    return [];
  }
}

export async function saveAttendanceToFirestore(item: AbsenApelItem): Promise<boolean> {
  try {
    let itemToSave = item;

    // 0. Sync to Drive if connected
    try {
      const activeToken = await getAccessToken();
      if (activeToken) {
        itemToSave = await syncAttendancePhotoToDrive(item, activeToken);
      }
    } catch (err) {
      console.warn('Drive sync for attendance failed:', err);
    }

    const docRef = doc(db, ATTENDANCE_COLLECTION, itemToSave.id);
    await setDoc(docRef, itemToSave, { merge: true });
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, ATTENDANCE_COLLECTION);
    return false;
  }
}

export async function deleteAttendanceFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, ATTENDANCE_COLLECTION);
    return false;
  }
}

export function subscribeAttendanceFromFirestore(
  onData: (items: AbsenApelItem[], isFromCache: boolean) => void
): Unsubscribe {
  const colRef = collection(db, ATTENDANCE_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AbsenApelItem[] = [];
      const isFromCache = snapshot.metadata.fromCache;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AbsenApelItem;
        if (data && data.id) {
          list.push(data);
        }
      });
      list.sort((a, b) => new Date(b.waktuLengkap || b.createdAt).getTime() - new Date(a.waktuLengkap || a.createdAt).getTime());
      onData(list, isFromCache);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, ATTENDANCE_COLLECTION);
    }
  );
}

// ==========================================
// 7.5. DAILY ROTATING ATTENDANCE QR CRUD
// ==========================================

export const ATTENDANCE_QR_COLLECTION = 'attendance_qr';

export interface AttendanceQREntity {
  id: string;
  token: string;
  tanggal: string;
  createdAt: string;
  lat?: number;
  lng?: number;
}

export async function fetchAttendanceQRFromFirestore(date: string): Promise<AttendanceQREntity | null> {
  try {
    const docRef = doc(db, ATTENDANCE_QR_COLLECTION, date);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AttendanceQREntity;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${ATTENDANCE_QR_COLLECTION}/${date}`);
    return null;
  }
}

export async function saveAttendanceQRToFirestore(item: AttendanceQREntity): Promise<boolean> {
  try {
    const docRef = doc(db, ATTENDANCE_QR_COLLECTION, item.tanggal);
    await setDoc(docRef, cleanFirestoreData(item), { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${ATTENDANCE_QR_COLLECTION}/${item.tanggal}`);
    return false;
  }
}

export function subscribeAttendanceQRFromFirestore(
  date: string,
  onData: (item: AttendanceQREntity | null) => void
): Unsubscribe {
  const docRef = doc(db, ATTENDANCE_QR_COLLECTION, date);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onData(docSnap.data() as AttendanceQREntity);
      } else {
        onData(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `${ATTENDANCE_QR_COLLECTION}/${date}`);
    }
  );
}

// ==========================================
// 8. CUSTOM EVENTS & EVENT ATTENDANCE CRUD
// ==========================================

const CUSTOM_EVENTS_COLLECTION = 'custom_events';
const EVENT_ATTENDANCE_COLLECTION = 'event_attendance';

export async function fetchCustomEventsFromFirestore(): Promise<CustomEvent[]> {
  try {
    const colRef = collection(db, CUSTOM_EVENTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const events: CustomEvent[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CustomEvent;
      if (data && data.id) {
        events.push(data);
      }
    });
    // Sort descending by date
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, CUSTOM_EVENTS_COLLECTION);
    return [];
  }
}

export async function saveCustomEventToFirestore(event: CustomEvent): Promise<boolean> {
  try {
    const docRef = doc(db, CUSTOM_EVENTS_COLLECTION, event.id);
    await setDoc(docRef, event, { merge: true });
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, CUSTOM_EVENTS_COLLECTION);
    return false;
  }
}

export async function deleteCustomEventFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, CUSTOM_EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, CUSTOM_EVENTS_COLLECTION);
    return false;
  }
}

export function subscribeCustomEventsFromFirestore(
  onData: (events: CustomEvent[]) => void
): Unsubscribe {
  const colRef = collection(db, CUSTOM_EVENTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const events: CustomEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CustomEvent;
        if (data && data.id) {
          events.push(data);
        }
      });
      events.sort((a, b) => b.date.localeCompare(a.date));
      onData(events);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, CUSTOM_EVENTS_COLLECTION);
    }
  );
}

export async function fetchEventAttendanceFromFirestore(): Promise<EventAttendance[]> {
  try {
    const colRef = collection(db, EVENT_ATTENDANCE_COLLECTION);
    const snapshot = await getDocs(colRef);
    const attendance: EventAttendance[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as EventAttendance;
      if (data && data.id) {
        attendance.push(data);
      }
    });
    return attendance;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, EVENT_ATTENDANCE_COLLECTION);
    return [];
  }
}

export async function saveEventAttendanceToFirestore(item: EventAttendance): Promise<boolean> {
  try {
    const docRef = doc(db, EVENT_ATTENDANCE_COLLECTION, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, EVENT_ATTENDANCE_COLLECTION);
    return false;
  }
}

export function subscribeEventAttendanceFromFirestore(
  onData: (items: EventAttendance[]) => void
): Unsubscribe {
  const colRef = collection(db, EVENT_ATTENDANCE_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const attendance: EventAttendance[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as EventAttendance;
        if (data && data.id) {
          attendance.push(data);
        }
      });
      onData(attendance);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, EVENT_ATTENDANCE_COLLECTION);
    }
  );
}

// Helper to delete any Firestore collection in chunked batches (max 400 per batch)
async function deleteCollectionInChunks(colName: string): Promise<void> {
  try {
    const c = collection(db, colName);
    const snap = await getDocs(c);
    if (!snap.empty) {
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 400);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, colName);
  }
}

/**
 * WIPE ALL CAPAIAN, REPORTS, ATTENDANCE, AND PBB DATA IN FIRESTORE
 * Cleans all operational data back to a fresh 0-baseline while STRICTLY PRESERVING
 * user accounts, credentials, and passwords.
 */
export async function wipeAllFirestoreCapaianData(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Delete all reports from 'reports'
    await deleteCollectionInChunks(REPORTS_COLLECTION);

    // 2. Delete all tombstones from 'deleted_reports'
    await deleteCollectionInChunks(DELETED_REPORTS_COLLECTION);

    // 3. Delete all attendance from 'attendance' & 'event_attendance'
    await deleteCollectionInChunks(ATTENDANCE_COLLECTION);
    await deleteCollectionInChunks(EVENT_ATTENDANCE_COLLECTION);

    // 4. Delete all custom events from 'custom_events'
    await deleteCollectionInChunks(CUSTOM_EVENTS_COLLECTION);

    // 5. Reset all targets_capaian in Firestore to 21 September 2026 baseline
    try {
      const defaults = getDefaultTargetsCapaianMap();
      const targetBatch = writeBatch(db);
      for (const [kId, item] of Object.entries(defaults)) {
        const docRef = doc(db, TARGETS_COLLECTION, kId);
        targetBatch.set(docRef, {
          ...item,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Sistem Reset',
        });
      }
      await targetBatch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, TARGETS_COLLECTION);
    }

    // 6. Delete all PBB SPPT records from Firestore completely in safe 400-doc chunks
    const pbbCols = ['pbb_sppt', 'pbb_sppt_2026', 'pbb_sppt_2025', 'pbb_sppt_2027'];
    for (const colName of pbbCols) {
      await deleteCollectionInChunks(colName);
    }

    // Clear memory cache
    deletedReportIdsMemory.clear();

    return { success: true, message: 'Seluruh data entri laporan dan realisasi PBB berhasil dihapus bersih dari Firebase Firestore!' };
  } catch (err: any) {
    console.error('Fatal error in wipeAllFirestoreCapaianData:', err);
    return { success: false, message: err?.message || 'Gagal mereset Firebase Firestore' };
  }
}

export interface SyncAuditLog {
  deviceId: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    language: string;
  };
  lastSyncAt: string;
  status: 'success' | 'failed';
  summary: {
    reportsCount: number;
    familyCount: number;
    pbbCount: number;
    visitsCount: number;
    totalCount: number;
  };
  operatorName: string;
}

const SYNC_AUDIT_LOG_COLLECTION = 'sync_audit_logs';

/**
 * Saves a simple audit log of a device's synchronization to Firestore.
 */
export async function saveSyncAuditLog(
  deviceId: string,
  deviceInfo: any,
  status: 'success' | 'failed',
  summary: any,
  operatorName: string = 'Super Admin'
): Promise<boolean> {
  try {
    if (!db) return false;
    const docRef = doc(db, SYNC_AUDIT_LOG_COLLECTION, deviceId);
    await setDoc(docRef, {
      deviceId,
      deviceInfo: {
        userAgent: deviceInfo.userAgent || '',
        platform: deviceInfo.platform || '',
        screenResolution: deviceInfo.screenResolution || '',
        language: deviceInfo.language || '',
      },
      lastSyncAt: new Date().toISOString(),
      status,
      summary: {
        reportsCount: summary.reportsCount || 0,
        familyCount: summary.familyCount || 0,
        pbbCount: summary.pbbCount || 0,
        visitsCount: summary.visitsCount || 0,
        totalCount: (summary.reportsCount || 0) + (summary.familyCount || 0) + (summary.pbbCount || 0) + (summary.visitsCount || 0),
      },
      operatorName,
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving sync audit log:', err);
    return false;
  }
}

/**
 * Fetches all sync audit logs from Firestore.
 */
export async function fetchSyncAuditLogs(): Promise<SyncAuditLog[]> {
  try {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, SYNC_AUDIT_LOG_COLLECTION));
    const logs: SyncAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      logs.push({
        deviceId: docSnap.id,
        ...docSnap.data()
      } as SyncAuditLog);
    });
    // Sort descending by lastSyncAt
    logs.sort((a, b) => new Date(b.lastSyncAt).getTime() - new Date(a.lastSyncAt).getTime());
    return logs;
  } catch (err) {
    console.error('Error fetching sync audit logs:', err);
    return [];
  }
}



