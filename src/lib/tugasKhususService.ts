import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  setDoc,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
  OperationType,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export interface TugasKhusus {
  id: string;
  judul: string;
  deskripsi: string;
  targetAccountId: string; // 'ALL' or specific account ID e.g. 'kepling_1'
  targetRole: string; // 'kepling' or 'all'
  pemberiTugas: string; // e.g. "Lurah Kelurahan Mangga"
  tanggalMulai: string;
  deadline: string;
  status: 'aktif' | 'selesai';
  createdAt: string;
  updatedAt?: string;
  completedBy: string[]; // array of account IDs who completed it
}

export interface TugasFotoSubmissionItem {
  id?: string;
  taskId: string;
  accountId: string;
  namaKepling?: string;
  fotoUrl: string;
  keterangan: string;
  updatedAt: string;
}

export const TUGAS_KHUSUS_COLLECTION = 'tugas_khusus';
export const TUGAS_SUBMISSIONS_COLLECTION = 'tugas_khusus_submissions';

export const STORAGE_KEY_TASKS = 'sikepling_tugas_khusus_list';
export const STORAGE_KEY_SUBMISSIONS = 'sikepling_tugas_khusus_submissions_v1';

/**
 * Utility to compress image to max dimensions to keep Firestore document size small (< 1 MB)
 */
export async function compressTugasFoto(dataUrl: string, maxDim = 800, quality = 0.75): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Get cached tasks synchronously from localStorage
 */
export function getTugasKhususList(): TugasKhusus[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.judul) : [];
  } catch {
    return [];
  }
}

/**
 * Save tasks to localStorage and broadcast custom update event
 */
export function saveTugasKhususList(list: TugasKhusus[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(list));
    window.dispatchEvent(new Event('sikepling_tugas_khusus_updated'));
  } catch {}
}

/**
 * Get submissions map synchronously from localStorage
 */
export function getTugasSubmissionsLocal(): Record<string, TugasFotoSubmissionItem> {
  return safeGetLocalStorage<Record<string, TugasFotoSubmissionItem>>(STORAGE_KEY_SUBMISSIONS, {});
}

/**
 * Save submissions map to localStorage and broadcast event
 */
export function saveTugasSubmissionsLocal(map: Record<string, TugasFotoSubmissionItem>): void {
  safeSetLocalStorage(STORAGE_KEY_SUBMISSIONS, JSON.stringify(map));
  window.dispatchEvent(new Event('sikepling_tugas_khusus_submissions_updated'));
}

function parseTugasDocs(docs: any[]): TugasKhusus[] {
  const result: TugasKhusus[] = [];
  docs.forEach((d) => {
    const data = d.data() as Partial<TugasKhusus>;
    if (data && data.judul) {
      result.push({
        id: d.id,
        judul: data.judul || '',
        deskripsi: data.deskripsi || '',
        targetAccountId: data.targetAccountId || 'ALL',
        targetRole: data.targetRole || 'kepling',
        pemberiTugas: data.pemberiTugas || 'Lurah Kelurahan Mangga',
        tanggalMulai: data.tanggalMulai || '',
        deadline: data.deadline || '',
        status: (data.status as 'aktif' | 'selesai') || 'aktif',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt,
        completedBy: Array.isArray(data.completedBy) ? data.completedBy : [],
      });
    }
  });
  result.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
  return result;
}

/**
 * Real-time listener for Tugas Khusus from Firestore.
 * Updates local cache and notifies all mounted listeners immediately.
 */
export function subscribeTugasKhususFromFirestore(callback?: (tasks: TugasKhusus[]) => void): Unsubscribe {
  const initialLocal = getTugasKhususList();
  if (callback && initialLocal.length > 0) {
    callback(initialLocal);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    return () => {};
  }

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const colRef = collection(db, TUGAS_KHUSUS_COLLECTION);
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        if (!isActive) return;
        const firestoreTasks = parseTugasDocs(snapshot.docs);

        if (!snapshot.metadata.fromCache) {
          receivedServerSnapshot = true;
          saveTugasKhususList(firestoreTasks);
          if (callback) callback(firestoreTasks);
        } else if (firestoreTasks.length > 0) {
          saveTugasKhususList(firestoreTasks);
          if (callback) callback(firestoreTasks);
        }
      },
      (error) => {
        if (isQuotaExhaustedError(error)) {
          markFirestoreQuotaExhausted(error);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try { unsub(); } catch {}
          return;
        }
        console.error('[Firestore Tugas Khusus] onSnapshot error:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, TUGAS_KHUSUS_COLLECTION);
        } catch {}
        if (!isFirestoreQuotaCooldownActive()) {
          fetchTugasKhususFromFirestore().then((items) => {
            if (isActive && callback) callback(items);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchTugasKhususFromFirestore().then((items) => {
          if (isActive && !receivedServerSnapshot && callback) {
            callback(items);
          }
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { unsub(); } catch {}
    };
  } catch (error) {
    console.error('[Firestore Tugas Khusus] subscribe error:', error);
    return () => {};
  }
}

export async function fetchTugasSubmissionsFromFirestore(): Promise<Record<string, TugasFotoSubmissionItem>> {
  if (!db || isFirestoreQuotaCooldownActive()) return getTugasSubmissionsLocal();
  try {
    const colRef = collection(db, TUGAS_SUBMISSIONS_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const subMap: Record<string, TugasFotoSubmissionItem> = {};
    snap.forEach((d) => {
      const item = d.data() as Partial<TugasFotoSubmissionItem>;
      if (item && item.taskId) {
        subMap[item.taskId] = {
          id: d.id,
          taskId: item.taskId,
          accountId: item.accountId || '',
          namaKepling: item.namaKepling || '',
          fotoUrl: item.fotoUrl || '',
          keterangan: item.keterangan || '',
          updatedAt: item.updatedAt || new Date().toISOString(),
        };
      }
    });
    if (Object.keys(subMap).length > 0 || !snap.metadata.fromCache) {
      saveTugasSubmissionsLocal(subMap);
      return subMap;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[Firestore Tugas Submissions] fetch error:', err);
    }
  }
  return getTugasSubmissionsLocal();
}

/**
 * Real-time listener for Tugas Khusus Submissions (bukti foto & keterangan).
 */
export function subscribeTugasKhususSubmissions(
  callback?: (submissions: Record<string, TugasFotoSubmissionItem>) => void
): Unsubscribe {
  const initialLocal = getTugasSubmissionsLocal();
  if (callback && Object.keys(initialLocal).length > 0) {
    callback(initialLocal);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    return () => {};
  }

  let isActive = true;
  let receivedServerSnapshot = false;
  let fallbackTimer: any = null;

  try {
    const colRef = collection(db, TUGAS_SUBMISSIONS_COLLECTION);
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        if (!isActive) return;
        const subMap: Record<string, TugasFotoSubmissionItem> = {};
        snapshot.forEach((d) => {
          const item = d.data() as Partial<TugasFotoSubmissionItem>;
          if (item && item.taskId) {
            subMap[item.taskId] = {
              id: d.id,
              taskId: item.taskId,
              accountId: item.accountId || '',
              namaKepling: item.namaKepling || '',
              fotoUrl: item.fotoUrl || '',
              keterangan: item.keterangan || '',
              updatedAt: item.updatedAt || new Date().toISOString(),
            };
          }
        });

        if (!snapshot.metadata.fromCache) {
          receivedServerSnapshot = true;
          saveTugasSubmissionsLocal(subMap);
          if (callback) callback(subMap);
        } else if (Object.keys(subMap).length > 0) {
          saveTugasSubmissionsLocal(subMap);
          if (callback) callback(subMap);
        }
      },
      (error) => {
        if (isQuotaExhaustedError(error)) {
          markFirestoreQuotaExhausted(error);
          isActive = false;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          try { unsub(); } catch {}
          return;
        }
        console.error('[Firestore Tugas Submissions] onSnapshot error:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, TUGAS_SUBMISSIONS_COLLECTION);
        } catch {}
        if (!isFirestoreQuotaCooldownActive()) {
          fetchTugasSubmissionsFromFirestore().then((subMap) => {
            if (isActive && callback) callback(subMap);
          });
        }
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
        fetchTugasSubmissionsFromFirestore().then((subMap) => {
          if (isActive && !receivedServerSnapshot && callback) {
            callback(subMap);
          }
        });
      }
    }, 4500);

    return () => {
      isActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { unsub(); } catch {}
    };
  } catch (error) {
    console.error('[Firestore Tugas Submissions] subscribe error:', error);
    return () => {};
  }
}

/**
 * Fetch all tasks from Firestore once
 */
export async function fetchTugasKhususFromFirestore(): Promise<TugasKhusus[]> {
  if (!db || isFirestoreQuotaCooldownActive()) return getTugasKhususList();
  try {
    const colRef = collection(db, TUGAS_KHUSUS_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }
    const result = parseTugasDocs(snap.docs);

    if (result.length > 0 || !snap.metadata.fromCache) {
      saveTugasKhususList(result);
      return result;
    }
    return getTugasKhususList();
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted(error);
    } else {
      console.error('[Firestore Tugas Khusus] fetch error:', error);
    }
    return getTugasKhususList();
  }
}

/**
 * Add a new Tugas Khusus and broadcast to all devices via Firestore
 */
export function addTugasKhusus(task: Omit<TugasKhusus, 'id' | 'createdAt' | 'completedBy'>): TugasKhusus {
  const list = getTugasKhususList();
  const id = 'tugas_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const newTask: TugasKhusus = {
    ...task,
    id,
    createdAt: now,
    updatedAt: now,
    completedBy: [],
  };

  // 1. Immediately update local storage so UI is instantaneous
  list.unshift(newTask);
  saveTugasKhususList(list);

  // 2. Persist to Firestore via resilient write queue
  const cleaned = cleanFirestoreData(newTask);
  resilientSetDoc(TUGAS_KHUSUS_COLLECTION, newTask.id, cleaned, { merge: true }).catch(() => {});

  return newTask;
}

/**
 * Update task status (aktif / selesai) locally and on Firestore
 */
export function updateTugasKhususStatus(id: string, status: 'aktif' | 'selesai'): void {
  const list = getTugasKhususList();
  const now = new Date().toISOString();
  const updated = list.map((t) => (t.id === id ? { ...t, status, updatedAt: now } : t));
  saveTugasKhususList(updated);

  resilientSetDoc(TUGAS_KHUSUS_COLLECTION, id, { status, updatedAt: now }, { merge: true }).catch(() => {});
}

/**
 * Delete task locally and from Firestore
 */
export function deleteTugasKhusus(id: string): void {
  const list = getTugasKhususList();
  const filtered = list.filter((t) => t.id !== id);
  saveTugasKhususList(filtered);

  resilientDeleteDoc(TUGAS_KHUSUS_COLLECTION, id).catch(() => {});
}

/**
 * Mark a task completed by an account ID and synchronize to Firestore
 */
export function markTugasKhususCompletedByAccount(taskId: string, accountId: string): void {
  const list = getTugasKhususList();
  const now = new Date().toISOString();
  let updatedTask: TugasKhusus | null = null;

  const updatedList = list.map((t) => {
    if (t.id === taskId) {
      const completed = t.completedBy || [];
      if (!completed.includes(accountId)) {
        updatedTask = { ...t, completedBy: [...completed, accountId], updatedAt: now };
        return updatedTask;
      }
    }
    return t;
  });

  saveTugasKhususList(updatedList);

  const enqueueFallback = () => {
    const completedIds = updatedTask?.completedBy || [accountId];
    resilientSetDoc(
      TUGAS_KHUSUS_COLLECTION,
      taskId,
      { completedBy: completedIds, updatedAt: now },
      { merge: true }
    ).catch(() => {});
  };

  if (!db || (typeof navigator !== 'undefined' && !navigator.onLine) || isFirestoreQuotaCooldownActive()) {
    enqueueFallback();
    return;
  }

  try {
    const docRef = doc(db, TUGAS_KHUSUS_COLLECTION, taskId);
    Promise.race([
      setDoc(
        docRef,
        {
          completedBy: arrayUnion(accountId),
          updatedAt: now,
        },
        { merge: true }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8500)),
    ]).catch((err) => {
      if (isQuotaExhaustedError(err)) {
        markFirestoreQuotaExhausted(err);
      }
      enqueueFallback();
    });
  } catch {
    enqueueFallback();
  }
}

/**
 * Save submission photo & notes from Kepling, compress image, and sync to Firestore
 */
export async function saveTugasKhususSubmission(
  submission: Omit<TugasFotoSubmissionItem, 'updatedAt'>
): Promise<boolean> {
  if (!submission || !submission.taskId) return false;

  const now = new Date().toISOString();
  // Ensure photo is safely compressed under 800px to avoid 1MB limit
  const compressedFoto = await compressTugasFoto(submission.fotoUrl, 800, 0.75);

  const cleanItem: TugasFotoSubmissionItem = {
    ...submission,
    fotoUrl: compressedFoto,
    updatedAt: now,
  };

  // 1. Save to local map
  const localMap = getTugasSubmissionsLocal();
  localMap[submission.taskId] = cleanItem;
  saveTugasSubmissionsLocal(localMap);

  // 2. Mark task completed locally and on Firestore
  if (submission.accountId) {
    markTugasKhususCompletedByAccount(submission.taskId, submission.accountId);
  }

  // 3. Persist submission to Firestore via resilient write queue
  const subDocId = `${submission.taskId}_${submission.accountId || 'anonymous'}`;
  const res = await resilientSetDoc(TUGAS_SUBMISSIONS_COLLECTION, subDocId, cleanFirestoreData(cleanItem), { merge: true });
  return res.synced || res.queued;
}
