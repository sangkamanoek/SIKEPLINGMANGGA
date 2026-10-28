import { SuratKedinasanItem } from '../types';
import { db } from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import {
  saveSuratToIndexedDB,
  getSuratFromIndexedDB,
  saveSingleSuratToIndexedDB,
  deleteSuratFromIndexedDB,
} from './indexedDbStorage';

export const SURAT_COLLECTION = 'surat_kedinasan';
export const SURAT_STORAGE_KEY = 'sikepling_surat_kedinasan_v1';
export const SURAT_DELETED_KEY = 'sikepling_surat_deleted_v1';
export const SURAT_CHANNEL = 'sikepling_surat_channel';

// 650,000 characters base64 is ~480KB binary, safely below Firestore 1,048,576 byte hard limit
const FIRESTORE_MAX_ATTACHMENT_BASE64_LEN = 650_000;

let memorySurat: SuratKedinasanItem[] = [];
let deletedSuratIdsCache: string[] = safeGetLocalStorage<string[]>(SURAT_DELETED_KEY, []);

export const getDeletedSuratIds = (): string[] => {
  if (!Array.isArray(deletedSuratIdsCache)) deletedSuratIdsCache = [];
  return deletedSuratIdsCache;
};

export const markSuratDeleted = (id: string): void => {
  const current = getDeletedSuratIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedSuratIdsCache = current;
    safeSetLocalStorage(SURAT_DELETED_KEY, JSON.stringify(current));
  }
};

/**
 * Get current cached surat list from memory or localStorage
 */
export const getLocalSuratList = (): SuratKedinasanItem[] => {
  const deletedSet = new Set(getDeletedSuratIds());
  if (memorySurat.length > 0) {
    const cleaned = memorySurat.filter((x) => x && x.id && !deletedSet.has(x.id));
    memorySurat = cleaned;
    return cleaned;
  }
  const stored = safeGetLocalStorage<SuratKedinasanItem[]>(SURAT_STORAGE_KEY, []);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    const cleaned = stored.filter((x) => x && x.id && !deletedSet.has(x.id));
    memorySurat = cleaned;
    return cleaned;
  }
  return [];
};

/**
 * Save to in-memory, IndexedDB, and broadcast channel
 */
export const setLocalSuratList = (items: SuratKedinasanItem[]): void => {
  memorySurat = items;
  safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(items));
  saveSuratToIndexedDB(items).catch(() => {});
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.postMessage({ type: 'SYNC_SURAT', items });
      bc.close();
    }
  } catch (e) {}
};

/**
 * Merge lists while preserving file attachments and honoring deletions
 */
export const smartMergeSurat = (
  local: SuratKedinasanItem[],
  remote: SuratKedinasanItem[]
): SuratKedinasanItem[] => {
  const deletedSet = new Set(getDeletedSuratIds());
  const map = new Map<string, SuratKedinasanItem>();

  for (const item of local) {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  for (const item of remote) {
    if (item && item.id && !deletedSet.has(item.id)) {
      const existing = map.get(item.id);
      if (existing) {
        // Retain attachment from local if remote stripped it due to Firestore size limits
        const fileUrl = existing.fileUrl || item.fileUrl;
        const fileName = existing.fileName || item.fileName;
        const fileSize = existing.fileSize || item.fileSize;
        const fileType = existing.fileType || item.fileType;
        map.set(item.id, {
          ...existing,
          ...item,
          fileUrl,
          fileName,
          fileSize,
          fileType,
        });
      } else {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.tanggalSurat || a.createdAt || '';
    const dateB = b.tanggalSurat || b.createdAt || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
};

/**
 * Fetch all surat from Server API (/api/surat) and IndexedDB
 */
export const fetchSuratFromServer = async (): Promise<SuratKedinasanItem[]> => {
  let serverItems: SuratKedinasanItem[] = [];

  // 1. Fetch from server API
  try {
    const res = await fetch('/api/surat', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        serverItems = json.data;
      }
    }
  } catch (err) {
    console.warn('[suratService] Server API fetch error:', err);
  }

  // 2. Fetch from IndexedDB
  let idbItems: SuratKedinasanItem[] = [];
  try {
    const fromIdb = await getSuratFromIndexedDB();
    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      idbItems = fromIdb;
    }
  } catch (err) {
    console.warn('[suratService] IndexedDB read error:', err);
  }

  const currentLocal = getLocalSuratList();
  const merged = smartMergeSurat(smartMergeSurat(currentLocal, idbItems), serverItems);
  setLocalSuratList(merged);
  return merged;
};

/**
 * Fetch complete single surat item (including heavy PDF attachment)
 * checks in-memory -> IndexedDB -> Server /api/surat/:id
 */
export const getSuratWithAttachment = async (id: string): Promise<SuratKedinasanItem | null> => {
  if (!id) return null;

  // 1. Check in-memory list first
  const inMem = memorySurat.find((s) => s.id === id);
  if (inMem && inMem.fileUrl) {
    return inMem;
  }

  // 2. Check IndexedDB
  try {
    const idbItems = await getSuratFromIndexedDB();
    if (Array.isArray(idbItems)) {
      const found = idbItems.find((s) => s.id === id);
      if (found && found.fileUrl) {
        // Update in-memory
        memorySurat = memorySurat.map((s) => (s.id === id ? { ...s, fileUrl: found.fileUrl } : s));
        return found;
      }
    }
  } catch (e) {}

  // 3. Check Server API
  try {
    const res = await fetch(`/api/surat/${encodeURIComponent(id)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const item = json.data as SuratKedinasanItem;
        if (item.fileUrl) {
          saveSingleSuratToIndexedDB(item).catch(() => {});
          memorySurat = memorySurat.map((s) => (s.id === id ? { ...s, fileUrl: item.fileUrl } : s));
          return item;
        }
      }
    }
  } catch (e) {}

  return inMem || null;
};

/**
 * Subscribe to real-time updates from IndexedDB, Server API, and Firestore
 */
export const subscribeSurat = (
  onUpdate: (items: SuratKedinasanItem[]) => void,
  onError?: (error: any) => void
): (() => void) => {
  // Initial immediate update
  const initial = getLocalSuratList();
  onUpdate(initial);

  // Load from IndexedDB and server asynchronously
  (async () => {
    try {
      const fromIdb = await getSuratFromIndexedDB();
      if (Array.isArray(fromIdb) && fromIdb.length > 0) {
        const merged = smartMergeSurat(getLocalSuratList(), fromIdb);
        setLocalSuratList(merged);
        onUpdate(merged);
      }
    } catch {}

    try {
      const res = await fetch('/api/surat');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const merged = smartMergeSurat(getLocalSuratList(), json.data);
          setLocalSuratList(merged);
          onUpdate(merged);
        }
      }
    } catch {}
  })();

  let unsubscribeFirestore: Unsubscribe | undefined;

  try {
    if (db) {
      const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const remoteItems: SuratKedinasanItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as SuratKedinasanItem;
            if (data && data.id) remoteItems.push(data);
          });
          const currentLocal = getLocalSuratList();
          const merged = smartMergeSurat(currentLocal, remoteItems);
          setLocalSuratList(merged);
          onUpdate(merged);
        },
        (error) => {
          console.warn('Firestore surat subscription error (falling back to local):', error);
          if (onError) onError(error);
        }
      );
    }
  } catch (e) {
    console.warn('Firestore not initialized for surat:', e);
    if (onError) onError(e);
  }

  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SURAT_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC_SURAT' && Array.isArray(event.data.items)) {
          const merged = smartMergeSurat(getLocalSuratList(), event.data.items);
          setLocalSuratList(merged);
          onUpdate(merged);
        }
      };
    }
  } catch (e) {}

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === SURAT_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          const merged = smartMergeSurat(getLocalSuratList(), parsed);
          onUpdate(merged);
        }
      } catch (e) {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (channel) channel.close();
    window.removeEventListener('storage', handleStorageEvent);
  };
};

/**
 * Save surat item to Memory, IndexedDB, Server API (/api/surat), and Firestore
 */
export const saveSuratItem = async (item: SuratKedinasanItem): Promise<void> => {
  const current = getLocalSuratList();
  const index = current.findIndex((x) => x.id === item.id);
  const payload: SuratKedinasanItem = {
    ...item,
    updatedAt: new Date().toISOString(),
  };

  let updated: SuratKedinasanItem[];
  if (index >= 0) {
    updated = current.map((x) => (x.id === item.id ? payload : x));
  } else {
    updated = [payload, ...current];
  }

  // 1. Save to in-memory and trigger LocalStorage & IndexedDB
  setLocalSuratList(updated);

  // 2. Save explicitly to IndexedDB with full attachment
  await saveSingleSuratToIndexedDB(payload);

  // 3. Save to Server REST API (/api/surat) - supports up to 50MB
  try {
    const res = await fetch('/api/surat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: payload }),
    });
    if (!res.ok) {
      console.warn('[suratService] Server API responded with non-200:', res.status);
    }
  } catch (serverErr) {
    console.warn('[suratService] Server API save failed (offline or network error):', serverErr);
  }

  // 4. Save to Firestore with intelligent payload size protection
  try {
    if (db) {
      const clean = cleanFirestoreData(payload);
      const isFileHeavy = clean.fileUrl && String(clean.fileUrl).length > FIRESTORE_MAX_ATTACHMENT_BASE64_LEN;

      let firestorePayload = clean;
      if (isFileHeavy) {
        // Strip heavy base64 string for Firestore to avoid 1MB limit violation
        // Metadata (nomor, perihal, fileName, fileSize, dll.) is fully preserved
        firestorePayload = {
          ...clean,
          fileUrl: undefined,
          hasServerAttachment: true,
        };
      }

      await setDoc(doc(db, SURAT_COLLECTION, item.id), firestorePayload);
    }
  } catch (firestoreErr) {
    console.warn('[suratService] Firestore save notice (data safely kept in Server/IndexedDB):', firestoreErr);
  }
};

/**
 * Delete surat item from Memory, IndexedDB, Server API, and Firestore
 */
export const deleteSuratItem = async (id: string): Promise<void> => {
  markSuratDeleted(id);
  const current = getLocalSuratList();
  const updated = current.filter((x) => x.id !== id);
  setLocalSuratList(updated);

  // 1. Delete from IndexedDB
  await deleteSuratFromIndexedDB(id);

  // 2. Delete from Server API
  try {
    await fetch(`/api/surat/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (serverErr) {
    console.warn('[suratService] Server delete notice:', serverErr);
  }

  // 3. Delete from Firestore
  try {
    if (db) {
      await deleteDoc(doc(db, SURAT_COLLECTION, id));
    }
  } catch (firestoreErr) {
    console.warn('[suratService] Firestore delete notice:', firestoreErr);
  }
};
