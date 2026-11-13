import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import {
  QueuedWriteRecord,
  putWriteQueueItemIDB,
  getAllWriteQueueItemsIDB,
  deleteWriteQueueItemIDB,
} from './indexedDbStorage';

const QUEUE_LOCAL_KEY = 'sikepling_firestore_write_queue_v1';
const DEFAULT_WRITE_TIMEOUT_MS = 8500;
const MAX_LOCAL_QUEUE_ITEM_CHARS = 120_000;
const MAX_QUEUE_LENGTH = 500;

let isFlushingQueue = false;
let memoryPendingCount = 0;

function stripUndefinedDeep(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' ? stripUndefinedDeep(item) : item));
  }
  if (typeof data !== 'object') return data;
  const cleaned: any = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined) {
      cleaned[key] = typeof data[key] === 'object' ? stripUndefinedDeep(data[key]) : data[key];
    }
  }
  return cleaned;
}

function readLocalQueue(): QueuedWriteRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(QUEUE_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalQueue(records: QueuedWriteRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // Keep only lightweight entries in localStorage; heavy entries (>120KB) live safely in IndexedDB
    const lightRecords = records.slice(0, MAX_QUEUE_LENGTH).map((rec) => {
      if (!rec.payload) return rec;
      try {
        const str = JSON.stringify(rec.payload);
        if (str.length > MAX_LOCAL_QUEUE_ITEM_CHARS) {
          return { ...rec, payload: undefined, storedInIdbOnly: true } as QueuedWriteRecord;
        }
      } catch {
        return { ...rec, payload: undefined, storedInIdbOnly: true } as QueuedWriteRecord;
      }
      return rec;
    });
    localStorage.setItem(QUEUE_LOCAL_KEY, JSON.stringify(lightRecords));
  } catch {
    // Ignore localStorage quota failures; IndexedDB holds full queue
  }
}

function emitQueueUpdated(pendingCount: number): void {
  memoryPendingCount = pendingCount;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sikepling-sync-queue-updated', {
          detail: { pendingCount },
        })
      );
    }
  } catch {}
}

export async function refreshPendingSyncCount(): Promise<number> {
  try {
    const idbItems = await getAllWriteQueueItemsIDB();
    const localItems = readLocalQueue();
    const keySet = new Set<string>();
    idbItems.forEach((x) => x?.key && keySet.add(x.key));
    localItems.forEach((x) => x?.key && !x.storedInIdbOnly && keySet.add(x.key));
    emitQueueUpdated(keySet.size);
    return keySet.size;
  } catch {
    const count = readLocalQueue().length;
    emitQueueUpdated(count);
    return count;
  }
}

export function getPendingSyncCount(): number {
  if (memoryPendingCount > 0) return memoryPendingCount;
  return readLocalQueue().length;
}

async function enqueueWrite(record: QueuedWriteRecord): Promise<void> {
  try {
    await putWriteQueueItemIDB(record).catch(() => {});
    const current = readLocalQueue().filter((x) => x && x.key !== record.key);
    current.unshift(record);
    writeLocalQueue(current);
    await refreshPendingSyncCount();
  } catch {
    // Fallback
  }
}

async function removeQueuedWrite(key: string): Promise<void> {
  try {
    await deleteWriteQueueItemIDB(key).catch(() => {});
    const current = readLocalQueue();
    const filtered = current.filter((x) => x && x.key !== key);
    if (filtered.length !== current.length) {
      writeLocalQueue(filtered);
    }
    await refreshPendingSyncCount();
  } catch {
    // Fallback
  }
}

export interface ResilientWriteResult {
  synced: boolean;
  queued: boolean;
  reason?: string;
}

/**
 * Reliable Firestore setDoc with weak-signal timeout guard, quota-cooldown protection,
 * and automatic persistent retry queue (IndexedDB + LocalStorage).
 * Never hangs the UI indefinitely on poor 2G/3G connections and never silently loses user edits.
 */
export async function resilientSetDoc(
  colName: string,
  docId: string,
  data: Record<string, any>,
  options?: { merge?: boolean; timeoutMs?: number }
): Promise<ResilientWriteResult> {
  if (!colName || !docId) {
    return { synced: false, queued: false, reason: 'invalid-ref' };
  }

  const key = `${colName}::${docId}`;
  const merge = options?.merge !== undefined ? options.merge : true;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS;
  const sanitized = stripUndefinedDeep(data);

  const record: QueuedWriteRecord = {
    key,
    op: 'set',
    colName,
    docId,
    payload: sanitized,
    merge,
    enqueuedAt: Date.now(),
    attempts: 0,
  };

  if (!db) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'db-unavailable' };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'offline' };
  }

  if (isFirestoreQuotaCooldownActive()) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'quota-cooldown' };
  }

  let settled = false;
  const docRef = doc(db, colName, docId);
  const writePromise = setDoc(docRef, sanitized, { merge });

  return new Promise<ResilientWriteResult>((resolve) => {
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      await enqueueWrite(record);
      resolve({ synced: false, queued: true, reason: 'weak-signal-timeout' });
    }, timeoutMs);

    writePromise
      .then(async () => {
        clearTimeout(timer);
        await removeQueuedWrite(key);
        if (!settled) {
          settled = true;
          resolve({ synced: true, queued: false });
        }
      })
      .catch(async (err: any) => {
        clearTimeout(timer);
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
        }
        await enqueueWrite({
          ...record,
          lastError: err?.message || String(err),
        });
        if (!settled) {
          settled = true;
          resolve({
            synced: false,
            queued: true,
            reason: err?.message || 'write-error',
          });
        }
      });
  });
}

/**
 * Reliable Firestore deleteDoc with weak-signal timeout guard and persistent retry queue.
 */
export async function resilientDeleteDoc(
  colName: string,
  docId: string,
  options?: { timeoutMs?: number }
): Promise<ResilientWriteResult> {
  if (!colName || !docId) {
    return { synced: false, queued: false, reason: 'invalid-ref' };
  }

  const key = `${colName}::${docId}`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS;
  const record: QueuedWriteRecord = {
    key,
    op: 'delete',
    colName,
    docId,
    enqueuedAt: Date.now(),
    attempts: 0,
  };

  if (!db) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'db-unavailable' };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'offline' };
  }

  if (isFirestoreQuotaCooldownActive()) {
    await enqueueWrite(record);
    return { synced: false, queued: true, reason: 'quota-cooldown' };
  }

  let settled = false;
  const docRef = doc(db, colName, docId);
  const deletePromise = deleteDoc(docRef);

  return new Promise<ResilientWriteResult>((resolve) => {
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      await enqueueWrite(record);
      resolve({ synced: false, queued: true, reason: 'weak-signal-timeout' });
    }, timeoutMs);

    deletePromise
      .then(async () => {
        clearTimeout(timer);
        await removeQueuedWrite(key);
        if (!settled) {
          settled = true;
          resolve({ synced: true, queued: false });
        }
      })
      .catch(async (err: any) => {
        clearTimeout(timer);
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
        }
        await enqueueWrite({
          ...record,
          lastError: err?.message || String(err),
        });
        if (!settled) {
          settled = true;
          resolve({
            synced: false,
            queued: true,
            reason: err?.message || 'delete-error',
          });
        }
      });
  });
}

/**
 * Flush all pending offline/weak-signal Firestore writes sequentially.
 */
export async function flushFirestoreWriteQueue(): Promise<{
  processed: number;
  succeeded: number;
  remaining: number;
}> {
  if (isFlushingQueue) {
    return { processed: 0, succeeded: 0, remaining: getPendingSyncCount() };
  }
  if (!db || (typeof navigator !== 'undefined' && !navigator.onLine) || isFirestoreQuotaCooldownActive()) {
    const remaining = await refreshPendingSyncCount();
    return { processed: 0, succeeded: 0, remaining };
  }

  isFlushingQueue = true;
  let processed = 0;
  let succeeded = 0;

  try {
    const idbRecords = await getAllWriteQueueItemsIDB();
    const localRecords = readLocalQueue();
    const mergedMap = new Map<string, QueuedWriteRecord>();

    localRecords.forEach((rec) => {
      if (rec && rec.key && !rec.storedInIdbOnly) {
        mergedMap.set(rec.key, rec);
      }
    });
    idbRecords.forEach((rec) => {
      if (rec && rec.key) {
        mergedMap.set(rec.key, rec);
      }
    });

    const queue = Array.from(mergedMap.values()).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    if (queue.length === 0) {
      emitQueueUpdated(0);
      return { processed: 0, succeeded: 0, remaining: 0 };
    }

    for (const rec of queue) {
      if (!navigator.onLine || isFirestoreQuotaCooldownActive()) break;
      processed++;

      try {
        const ref = doc(db, rec.colName, rec.docId);
        const opPromise =
          rec.op === 'delete'
            ? deleteDoc(ref)
            : setDoc(ref, stripUndefinedDeep(rec.payload || {}), { merge: rec.merge ?? true });

        await Promise.race([
          opPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('flush-timeout')), 9000)),
        ]);

        await removeQueuedWrite(rec.key);
        succeeded++;
      } catch (err: any) {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          break;
        }
        await enqueueWrite({
          ...rec,
          attempts: (rec.attempts || 0) + 1,
          lastError: err?.message || String(err),
        });
      }
    }
  } finally {
    isFlushingQueue = false;
  }

  const remaining = await refreshPendingSyncCount();
  return { processed, succeeded, remaining };
}
