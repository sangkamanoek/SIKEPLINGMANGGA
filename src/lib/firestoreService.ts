import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { LaporanHarianItem, KeplingTargetCapaian, TargetsCapaianMap, TaskReminder, NotificationLog, AbsenApelItem, CustomEvent, EventAttendance } from '../types';
import { getDefaultTargetsCapaianMap } from '../data/targetsData';

// Local in-memory cache of deleted report IDs to prevent re-emergence
const deletedReportIdsMemory = new Set<string>();

export const isBeforeSept7 = (report: any): boolean => {
  if (!report) return true;
  if (report.id && deletedReportIdsMemory.has(report.id)) return true;
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
    console.warn('Notice reading deleted_reports tombstones:', err);
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

      if (!isBeforeSept7(report)) {
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
    console.warn('Firebase Firestore fetch notice (switching to server buffer):', error?.message || error);
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
    await setDoc(docRef, item, { merge: true });

    return true;
  } catch (error) {
    console.error('Gagal menyimpan laporan ke Firebase Firestore:', error);

    // Fallback: If payload size is too large due to heavy base64 images, attempt to save without corrupted strings
    try {
      // Keep valid photos, and if document is still too large, reduce number of photos cleanly rather than breaking base64 string
      const safeItem: LaporanHarianItem = {
        ...item,
        dokumentasiFoto: item.dokumentasiFoto?.slice(0, 4),
      };
      const docRef = doc(db, REPORTS_COLLECTION, item.id);
      await setDoc(docRef, safeItem, { merge: true });
      return true;
    } catch (fallbackError) {
      console.error('Fallback save to Firestore failed:', fallbackError);
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
      console.warn('Notice writing tombstone to deleted_reports:', delErr);
    }

    // 3. Delete directly from reports collection by primary ID
    const docRef = doc(db, REPORTS_COLLECTION, id);
    await deleteDoc(docRef);

    return true;
  } catch (error) {
    console.warn('Gagal menghapus laporan dari Firebase Firestore:', error);
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
        if (!item || !item.namaKepling || isBeforeSept7(item) || (item.id && deletedReportIdsMemory.has(item.id))) continue;
        const id = item.id || ('lap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
        const docRef = doc(db, REPORTS_COLLECTION, id);
        batch.set(docRef, { ...item, id }, { merge: true });
        synced++;
      }

      await batch.commit();
    }

    return synced;
  } catch (error) {
    console.warn('Gagal batch sync laporan ke Firebase Firestore:', error);
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
    console.warn('Gagal mereset laporan di Firebase Firestore:', error);
    return false;
  }
}

/**
 * Real-time listener for reports in Firebase Firestore
 */
export function subscribeReportsFromFirestore(
  onData: (reports: LaporanHarianItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, REPORTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const reports: LaporanHarianItem[] = [];
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
        if (!isBeforeSept7(report)) {
          reports.push(report);
        }
      });

      reports.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      onData(reports);
    },
    (err) => {
      console.warn('Firestore onSnapshot error reports (switching to server fallback):', err);
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
    console.warn('Gagal membaca targets_capaian dari Firebase Firestore:', error);
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
    const payload = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.warn('Gagal menyimpan target ke Firebase Firestore:', error);
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
      batch.set(docRef, { ...item, updatedAt: new Date().toISOString() }, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.warn('Gagal menyimpan semua target ke Firebase Firestore:', error);
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
      console.warn('Firestore onSnapshot error targets:', err);
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
    console.warn('Gagal membaca passwords dari Firebase Firestore:', error);
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
    console.warn('Gagal menyimpan password ke Firebase Firestore:', error);
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
    console.warn('Gagal mereset password di Firebase Firestore:', error);
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
      console.warn('Firestore onSnapshot passwords notice:', err);
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
    console.warn('Gagal membaca profiles dari Firebase Firestore:', err);
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
    console.warn('Gagal menyimpan profile ke Firebase Firestore:', error);
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
      console.warn('Firestore onSnapshot profiles notice:', err);
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
    console.warn('Firebase Firestore attendance fetch notice (using server fallback):', err?.message || err);
    return [];
  }
}

export async function saveAttendanceToFirestore(item: AbsenApelItem): Promise<boolean> {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err: any) {
    console.warn('Firebase Firestore save attendance notice:', err?.message || err);
    return false;
  }
}

export function subscribeAttendanceFromFirestore(
  onData: (items: AbsenApelItem[]) => void
): Unsubscribe {
  const colRef = collection(db, ATTENDANCE_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AbsenApelItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AbsenApelItem;
        if (data && data.id) {
          list.push(data);
        }
      });
      list.sort((a, b) => new Date(b.waktuLengkap || b.createdAt).getTime() - new Date(a.waktuLengkap || a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.warn('Firestore onSnapshot attendance notice (using server fallback):', err?.message || err);
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
    console.warn('Firebase Firestore custom events fetch notice:', err?.message || err);
    return [];
  }
}

export async function saveCustomEventToFirestore(event: CustomEvent): Promise<boolean> {
  try {
    const docRef = doc(db, CUSTOM_EVENTS_COLLECTION, event.id);
    await setDoc(docRef, event, { merge: true });
    return true;
  } catch (err: any) {
    console.warn('Firebase Firestore save custom event notice:', err?.message || err);
    return false;
  }
}

export async function deleteCustomEventFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, CUSTOM_EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    console.warn('Firebase Firestore delete custom event notice:', err?.message || err);
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
      console.warn('Firestore onSnapshot custom events notice:', err?.message || err);
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
    console.warn('Firebase Firestore event attendance fetch notice:', err?.message || err);
    return [];
  }
}

export async function saveEventAttendanceToFirestore(item: EventAttendance): Promise<boolean> {
  try {
    const docRef = doc(db, EVENT_ATTENDANCE_COLLECTION, item.id);
    await setDoc(docRef, item, { merge: true });
    return true;
  } catch (err: any) {
    console.warn('Firebase Firestore save event attendance notice:', err?.message || err);
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
      console.warn('Firestore onSnapshot event attendance notice:', err?.message || err);
    }
  );
}



