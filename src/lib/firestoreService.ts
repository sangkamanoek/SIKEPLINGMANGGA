import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { LaporanHarianItem, KeplingTargetCapaian, TargetsCapaianMap, TaskReminder, NotificationLog } from '../types';
import { getDefaultTargetsCapaianMap } from '../data/targetsData';

// Helper to filter out pre-7 Sept 2026 reports
export const isBeforeSept7 = (r: any): boolean => {
  if (!r) return false;
  if (r.createdAt) {
    const d = new Date(r.createdAt);
    if (!isNaN(d.getTime()) && d < new Date('2026-09-07T00:00:00+07:00')) {
      return true;
    }
  }
  const tgl = (r.tanggal || '').toUpperCase();
  if (tgl.includes('SEPTEMBER 2026') || tgl.includes('SEP 2026')) {
    const match = tgl.match(/\b0?([1-6])\s+SEPTEMBER/i);
    if (match) return true;
  }
  return false;
};

// ==========================================
// 1. LAPORAN HARIAN (REPORTS) CRUD
// ==========================================

const REPORTS_COLLECTION = 'reports';

/**
 * Fetch all reports from Firebase Firestore
 */
export async function fetchReportsFromFirestore(): Promise<LaporanHarianItem[]> {
  try {
    const colRef = collection(db, REPORTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const reports: LaporanHarianItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as LaporanHarianItem;
      const report: LaporanHarianItem = {
        ...data,
        id: docSnap.id || data.id,
      };
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
  } catch (error) {
    console.warn('Gagal membaca laporan dari Firebase Firestore:', error);
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
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    item.updatedAt = new Date().toISOString();

    const docRef = doc(db, REPORTS_COLLECTION, item.id);
    await setDoc(docRef, item, { merge: true });

    // Simpan juga salinan langsung di koleksi SIKEPLINGMANGGA
    try {
      await setDoc(doc(db, 'SIKEPLINGMANGGA', item.id), item, { merge: true });
    } catch (err) {
      console.warn('Simpan ke koleksi SIKEPLINGMANGGA:', err);
    }

    return true;
  } catch (error) {
    console.warn('Gagal menyimpan laporan ke Firebase Firestore:', error);
    return false;
  }
}

/**
 * Delete single report from Firebase Firestore
 */
export async function deleteReportFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, REPORTS_COLLECTION, id);
    await deleteDoc(docRef);
    try {
      await deleteDoc(doc(db, 'SIKEPLINGMANGGA', id));
    } catch {
      // ignore
    }
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
        if (!item || !item.namaKepling || isBeforeSept7(item)) continue;
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
        const report: LaporanHarianItem = {
          ...data,
          id: docSnap.id || data.id,
        };
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
      console.warn('Firestore onSnapshot error reports:', err);
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

