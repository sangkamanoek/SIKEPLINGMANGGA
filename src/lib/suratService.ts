import { SuratKedinasanItem, JenisSuratKedinasan } from '../types';
import { db } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

import { getAccessToken } from './firebase';
import { syncSuratFileToDrive } from './driveSync';

export const SURAT_STORAGE_KEY = 'si_mangga_surat_kedinasan_list_v2';
export const SURAT_COLLECTION = 'surat_kedinasan';
export const SURAT_CHANNEL = 'si_mangga_surat_channel';
export const SURAT_CUSTOM_EVENT = 'si-mangga-surat-updated';

// Helper to identify generated dummy sample surat items
export const isDummySurat = (item: Partial<SuratKedinasanItem> | null | undefined): boolean => {
  if (!item) return false;
  const idStr = String(item.id || '');
  return /^surat_[1-9]$/.test(idStr);
};

// Initial surat list is strictly empty for real official correspondence
export const INITIAL_SURAT_LIST: SuratKedinasanItem[] = [];

let memorySurat: SuratKedinasanItem[] = [];

export const getLocalSuratList = (): SuratKedinasanItem[] => {
  if (memorySurat.length > 0) {
    return memorySurat.filter((x) => !isDummySurat(x));
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('si_mangga_surat_kedinasan_list');
    }
  } catch {}

  const stored = safeGetLocalStorage<SuratKedinasanItem[]>(SURAT_STORAGE_KEY, []);
  if (stored && Array.isArray(stored)) {
    const cleaned = stored.filter((x) => !isDummySurat(x));
    memorySurat = cleaned;
    if (cleaned.length !== stored.length) {
      safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  }
  memorySurat = [];
  return [];
};

export const setLocalSuratList = (items: SuratKedinasanItem[]): void => {
  const cleaned = items.filter((x) => !isDummySurat(x));
  memorySurat = cleaned;
  safeSetLocalStorage(SURAT_STORAGE_KEY, JSON.stringify(cleaned));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.postMessage({ type: 'SYNC_SURAT', items: cleaned });
      bc.close();
    }
  } catch (e) {
    console.warn(e);
  }
};

/**
 * Fetch surat from Server Buffer Express (/api/surat)
 */
export async function fetchSuratFromServerBuffer(): Promise<SuratKedinasanItem[]> {
  try {
    const res = await fetch(`/api/surat?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        return (json.data as SuratKedinasanItem[]).filter((x) => !isDummySurat(x));
      }
    }
  } catch (err) {
    console.warn('Notice fetching surat from server buffer:', err);
  }
  return [];
}

/**
 * Fetch from both Server Buffer and Firestore, merging seamlessly
 */
export async function fetchSuratFromServer(): Promise<SuratKedinasanItem[]> {
  const map = new Map<string, SuratKedinasanItem>();

  // 1. Fetch from Firestore (Primary source of truth)
  if (db) {
    try {
      const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const itm = d.data() as SuratKedinasanItem;
        if (!isDummySurat(itm) && itm.id) {
          map.set(itm.id, itm);
        }
      });
    } catch (err) {
      console.warn('Notice fetching surat from Firestore:', err);
    }
  }

  // 2. Fetch server buffer (Secondary source, might contain large PDFs not in Firestore)
  try {
    const serverItems = await fetchSuratFromServerBuffer();
    serverItems.forEach((s) => {
      const existing = map.get(s.id);
      if (existing) {
        // Merge to preserve larger fileUrl from server if needed
        if (s.fileUrl && !existing.fileUrl) {
          map.set(s.id, { ...existing, fileUrl: s.fileUrl });
        }
      } else {
        // If it's in server buffer but not Firestore, it might be new or strictly server-side
        map.set(s.id, s);
      }
    });
  } catch {}

  const merged = Array.from(map.values()).sort((a, b) => {
    return (b.tanggalSurat || '').localeCompare(a.tanggalSurat || '');
  });

  // Always update local list, even if empty
  setLocalSuratList(merged);
  return merged;
}

/**
 * Save surat with dual-tier sync (0ms local + Server Buffer + Firestore with size protection)
 */
export async function saveSuratItem(item: SuratKedinasanItem): Promise<void> {
  let itemToSave = item;

  // 0. Sync to Drive if connected
  try {
    const activeToken = await getAccessToken();
    if (activeToken) {
      itemToSave = await syncSuratFileToDrive(item, activeToken);
    }
  } catch (err) {
    console.warn('Drive sync for surat failed:', err);
  }

  // 1. Local update (0ms instant)
  const current = getLocalSuratList();
  const existsIndex = current.findIndex((x) => x.id === itemToSave.id);
  const updated = existsIndex >= 0
    ? current.map((x) => (x.id === itemToSave.id ? itemToSave : x))
    : [itemToSave, ...current];

  setLocalSuratList(updated);

  // 2. Save to Server Buffer (handles any size, even large PDF attachments)
  fetch('/api/surat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: itemToSave }),
  }).catch((err) => {
    console.warn('Notice saving surat to server buffer:', err);
  });

  // 3. Save to Firestore Cloud (with 1MB document boundary protection)
  if (db) {
    try {
      // Check if fileUrl exceeds safe Firestore document size (approx 850KB base64)
      const isFileTooLargeForFirestore = itemToSave.fileUrl && itemToSave.fileUrl.length > 900000 && itemToSave.fileUrl.startsWith('data:');
      
      if (isFileTooLargeForFirestore) {
        // Save metadata without oversized base64
        const safeFirestoreDoc = {
          ...itemToSave,
          fileUrl: '', // Full PDF preserved in server buffer / Drive
          fileStoredOnServer: true,
        };
        await setDoc(doc(db, SURAT_COLLECTION, itemToSave.id), safeFirestoreDoc);
      } else {
        try {
          await setDoc(doc(db, SURAT_COLLECTION, itemToSave.id), itemToSave);
        } catch (setErr: any) {
          console.warn('Firestore setDoc failed, saving safe metadata fallback:', setErr);
          const safeFirestoreDoc = {
            ...itemToSave,
            fileUrl: itemToSave.fileUrl?.startsWith('http') ? itemToSave.fileUrl : '', // Keep Drive URL if it's already an HTTP link
            fileStoredOnServer: !itemToSave.fileUrl?.startsWith('http'),
          };
          await setDoc(doc(db, SURAT_COLLECTION, itemToSave.id), safeFirestoreDoc);
        }
      }
    } catch (err) {
      console.warn('Failed saving surat to Firestore:', err);
    }
  }

  // 4. Dispatch event for same-tab reactive UI
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SURAT_CUSTOM_EVENT, { detail: itemToSave }));
    }
  } catch {}
}

export async function deleteSuratItem(id: string): Promise<void> {
  const current = getLocalSuratList();
  const updated = current.filter((x) => x.id !== id);
  setLocalSuratList(updated);

  // Delete from Server Buffer
  fetch(`/api/surat/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((err) => {
    console.warn('Notice deleting surat from server buffer:', err);
  });

  // Delete from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, SURAT_COLLECTION, id));
    } catch (err) {
      console.warn('Failed deleting surat from Firestore:', err);
    }
  }
}

export function subscribeSurat(
  onSuccess: (data: SuratKedinasanItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // 1. Instant 0ms load
  const initial = getLocalSuratList();
  if (initial.length > 0) {
    onSuccess(initial);
  }

  // 2. Fetch server buffer immediately
  fetchSuratFromServerBuffer().then((serverItems) => {
    if (serverItems.length > 0) {
      const current = getLocalSuratList();
      const map = new Map<string, SuratKedinasanItem>();
      serverItems.forEach((it) => map.set(it.id, it));
      current.forEach((it) => {
        if (!map.has(it.id)) map.set(it.id, it);
      });
      const merged = Array.from(map.values()).sort((a, b) => (b.tanggalSurat || '').localeCompare(a.tanggalSurat || ''));
      setLocalSuratList(merged);
      onSuccess(merged);
    }
  });

  // 3. Broadcast channel
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SURAT_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data && event.data.items) {
          memorySurat = event.data.items;
          onSuccess(event.data.items);
        }
      };
    }
  } catch {}

  // 4. Custom event
  const handleCustomEvent = (e: any) => {
    if (e && e.detail) {
      const current = getLocalSuratList();
      onSuccess(current);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(SURAT_CUSTOM_EVENT, handleCustomEvent);
  }

  // 5. Firestore real-time snapshot
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, SURAT_COLLECTION), orderBy('tanggalSurat', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, SuratKedinasanItem>();
          
          // 1. Start with the Firestore snapshot as the base truth
          snapshot.forEach((d) => {
            const itm = d.data() as SuratKedinasanItem;
            if (!isDummySurat(itm) && itm.id) {
              map.set(itm.id, itm);
            }
          });

          // 2. Merge with local/server items only to preserve fields not in Firestore (like large PDF blobs)
          const localItems = getLocalSuratList();
          localItems.forEach((existing) => {
            if (map.has(existing.id)) {
              const itm = map.get(existing.id)!;
              // Preserve fileUrl from local/server if Firestore stripped it due to size
              if (existing.fileUrl && !itm.fileUrl) {
                map.set(itm.id, { ...itm, fileUrl: existing.fileUrl });
              }
            }
          });

          const items = Array.from(map.values()).sort((a, b) => (b.tanggalSurat || '').localeCompare(a.tanggalSurat || ''));
          
          // Always update local list and trigger success, even if list is empty (handles deletions)
          setLocalSuratList(items);
          onSuccess(items);
        },
        (err) => {
          console.warn('Firestore snapshot error on surat_kedinasan:', err);
          if (onError) onError(err);
        }
      );
    } catch (e: any) {
      console.warn('Error setting up firestore snapshot on surat_kedinasan:', e);
      if (onError) onError(e);
    }
  }

  return () => {
    if (bc) {
      try { bc.close(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(SURAT_CUSTOM_EVENT, handleCustomEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}
