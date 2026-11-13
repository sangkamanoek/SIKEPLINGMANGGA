import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { cleanFirestoreData } from './firestoreService';
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

  let isActive = true;
  let receivedServerSnapshot = false;

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
        console.error('[Firestore Tugas Khusus] onSnapshot error:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, TUGAS_KHUSUS_COLLECTION);
        } catch {}
        fetchTugasKhususFromFirestore().then((items) => {
          if (isActive && callback) callback(items);
        });
      }
    );

    fetchTugasKhususFromFirestore().then((items) => {
      if (isActive && !receivedServerSnapshot && callback) {
        callback(items);
      }
    });

    return () => {
      isActive = false;
      unsub();
    };
  } catch (error) {
    console.error('[Firestore Tugas Khusus] subscribe error:', error);
    return () => {};
  }
}

export async function fetchTugasSubmissionsFromFirestore(): Promise<Record<string, TugasFotoSubmissionItem>> {
  try {
    const colRef = collection(db, TUGAS_SUBMISSIONS_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch {
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
    console.warn('[Firestore Tugas Submissions] fetch error:', err);
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

  let isActive = true;
  let receivedServerSnapshot = false;

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
        console.error('[Firestore Tugas Submissions] onSnapshot error:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, TUGAS_SUBMISSIONS_COLLECTION);
        } catch {}
        fetchTugasSubmissionsFromFirestore().then((subMap) => {
          if (isActive && callback) callback(subMap);
        });
      }
    );

    fetchTugasSubmissionsFromFirestore().then((subMap) => {
      if (isActive && !receivedServerSnapshot && callback) {
        callback(subMap);
      }
    });

    return () => {
      isActive = false;
      unsub();
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
  try {
    const colRef = collection(db, TUGAS_KHUSUS_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch {
      snap = await getDocs(colRef);
    }
    const result = parseTugasDocs(snap.docs);

    if (result.length > 0 || !snap.metadata.fromCache) {
      saveTugasKhususList(result);
      return result;
    }
    return getTugasKhususList();
  } catch (error) {
    console.error('[Firestore Tugas Khusus] fetch error:', error);
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

  // 2. Persist to Firestore to broadcast to all other phones & devices
  try {
    const docRef = doc(db, TUGAS_KHUSUS_COLLECTION, newTask.id);
    const cleaned = cleanFirestoreData(newTask);
    setDoc(docRef, cleaned).then(() => {
      console.log(`[Firestore Tugas Khusus] Successfully published task ${newTask.id} (${newTask.judul})`);
    }).catch((err) => {
      console.error('[Firestore Tugas Khusus] Failed publishing task to Firestore:', err);
      handleFirestoreError(err, OperationType.WRITE, TUGAS_KHUSUS_COLLECTION);
    });
  } catch (err) {
    console.error('[Firestore Tugas Khusus] addTugasKhusus sync error:', err);
  }

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

  try {
    const docRef = doc(db, TUGAS_KHUSUS_COLLECTION, id);
    setDoc(docRef, { status, updatedAt: now }, { merge: true }).catch((err) => {
      console.error(`[Firestore Tugas Khusus] Failed updating status for ${id}:`, err);
    });
  } catch (err) {
    console.error('[Firestore Tugas Khusus] updateTugasKhususStatus error:', err);
  }
}

/**
 * Delete task locally and from Firestore
 */
export function deleteTugasKhusus(id: string): void {
  const list = getTugasKhususList();
  const filtered = list.filter((t) => t.id !== id);
  saveTugasKhususList(filtered);

  try {
    const docRef = doc(db, TUGAS_KHUSUS_COLLECTION, id);
    deleteDoc(docRef).catch((err) => {
      console.error(`[Firestore Tugas Khusus] Failed deleting task ${id}:`, err);
    });
  } catch (err) {
    console.error('[Firestore Tugas Khusus] deleteTugasKhusus error:', err);
  }
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

  try {
    const docRef = doc(db, TUGAS_KHUSUS_COLLECTION, taskId);
    setDoc(
      docRef,
      {
        completedBy: arrayUnion(accountId),
        updatedAt: now,
      },
      { merge: true }
    ).then(() => {
      console.log(`[Firestore Tugas Khusus] Account ${accountId} marked completed on task ${taskId}`);
    }).catch((err) => {
      console.error(`[Firestore Tugas Khusus] Failed syncing completed status for ${taskId}:`, err);
    });
  } catch (err) {
    console.error('[Firestore Tugas Khusus] markTugasKhususCompletedByAccount error:', err);
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

  // 3. Persist submission to Firestore
  try {
    const subDocId = `${submission.taskId}_${submission.accountId || 'anonymous'}`;
    const docRef = doc(db, TUGAS_SUBMISSIONS_COLLECTION, subDocId);
    await setDoc(docRef, cleanFirestoreData(cleanItem), { merge: true });
    console.log(`[Firestore Tugas Submission] Successfully uploaded submission for task ${submission.taskId}`);
    return true;
  } catch (err) {
    console.error(`[Firestore Tugas Submission] Error uploading submission for ${submission.taskId}:`, err);
    try {
      handleFirestoreError(err, OperationType.WRITE, TUGAS_SUBMISSIONS_COLLECTION);
    } catch {}
    return false;
  }
}
