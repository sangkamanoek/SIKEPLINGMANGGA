import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { resilientSetDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { UserAccount } from '../types';

export interface PbbPindahNotifItem {
  id: string;
  spptId: string;
  nop: string;
  namaWp: string;
  alamatOp?: string;
  tahun: number;
  dariLingkungan: number;
  keLingkungan: number;
  dipindahOlehId: string;
  dipindahOlehNama: string;
  dipindahOlehRole: string;
  createdAt: string;
  readBy: string[];
}

export const PBB_PINDAH_NOTIF_COLLECTION = 'pbb_pindah_notifications';
const PBB_PINDAH_NOTIF_STORAGE_KEY = 'sikepling_pbb_pindah_notifs_v1';
export const PBB_PINDAH_NOTIF_EVENT = 'pbb-pindah-notif-updated';

/**
 * Determine whether a Pindah NOP notification should be shown to the given user account.
 * Recipients:
 * 1. Kasi Pemerintahan (`kasi_pemerintahan`)
 * 2. Super Admin (`super_admin`)
 * 3. Kepling Tujuan Pindah NOP (`kepling` with `nomorLingkungan === notif.keLingkungan`)
 * Excludes the sender (`account.id === notif.dipindahOlehId`) so the mover doesn't get a redundant incoming alert.
 */
export function isPbbPindahNotifForAccount(
  notif: PbbPindahNotifItem | null | undefined,
  account: UserAccount | null | undefined
): boolean {
  if (!notif || !account) return false;
  if (account.id && notif.dipindahOlehId && account.id === notif.dipindahOlehId) {
    return false;
  }
  if (account.role === 'super_admin' || account.role === 'kasi_pemerintahan') {
    return true;
  }
  if (account.role === 'kepling') {
    const userLing = Number(account.nomorLingkungan);
    const targetLing = Number(notif.keLingkungan);
    return Number.isFinite(userLing) && userLing > 0 && userLing === targetLing;
  }
  return false;
}

export function isPbbPindahNotifUnreadForAccount(
  notif: PbbPindahNotifItem,
  account: UserAccount | null | undefined
): boolean {
  if (!account || !isPbbPindahNotifForAccount(notif, account)) return false;
  const userId = account.id || account.nama || '';
  if (!userId) return false;
  const readBy = Array.isArray(notif.readBy) ? notif.readBy : [];
  return !readBy.includes(userId);
}

function sortNotifsNewestFirst(items: PbbPindahNotifItem[]): PbbPindahNotifItem[] {
  return [...items].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

function mergeNotifLists(
  primary: PbbPindahNotifItem[],
  secondary: PbbPindahNotifItem[]
): PbbPindahNotifItem[] {
  const map = new Map<string, PbbPindahNotifItem>();
  [...secondary, ...primary].forEach((item) => {
    if (!item || !item.id) return;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, {
        ...item,
        readBy: Array.isArray(item.readBy) ? Array.from(new Set(item.readBy)) : [],
      });
    } else {
      const mergedReadBy = Array.from(
        new Set([
          ...(Array.isArray(existing.readBy) ? existing.readBy : []),
          ...(Array.isArray(item.readBy) ? item.readBy : []),
        ])
      );
      map.set(item.id, {
        ...existing,
        ...item,
        readBy: mergedReadBy,
      });
    }
  });
  return sortNotifsNewestFirst(Array.from(map.values())).slice(0, 200);
}

export function getLocalPbbPindahNotifs(): PbbPindahNotifItem[] {
  const local = safeGetLocalStorage<PbbPindahNotifItem[]>(PBB_PINDAH_NOTIF_STORAGE_KEY, []);
  if (!Array.isArray(local)) return [];
  return sortNotifsNewestFirst(local.filter((item) => item && item.id));
}

function emitPbbPindahUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PBB_PINDAH_NOTIF_EVENT));
  }
}

export async function savePbbPindahNotif(
  input: Omit<PbbPindahNotifItem, 'id' | 'createdAt' | 'readBy'> & {
    id?: string;
    createdAt?: string;
    readBy?: string[];
  }
): Promise<PbbPindahNotifItem> {
  const nowIso = input.createdAt || new Date().toISOString();
  const id =
    input.id ||
    `pbb_move_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const notif: PbbPindahNotifItem = {
    id: String(id).slice(0, 100),
    spptId: String(input.spptId || '').slice(0, 120),
    nop: String(input.nop || '').trim().slice(0, 40),
    namaWp: String(input.namaWp || '-').trim().slice(0, 200),
    alamatOp: String(input.alamatOp || '-').trim().slice(0, 300),
    tahun: Number(input.tahun) || new Date().getFullYear(),
    dariLingkungan: Number(input.dariLingkungan) || 0,
    keLingkungan: Number(input.keLingkungan) || 0,
    dipindahOlehId: String(input.dipindahOlehId || 'kepling').slice(0, 80),
    dipindahOlehNama: String(input.dipindahOlehNama || 'Kepala Lingkungan').slice(0, 120),
    dipindahOlehRole: String(input.dipindahOlehRole || 'kepling').slice(0, 40),
    createdAt: nowIso,
    readBy: Array.isArray(input.readBy) ? Array.from(new Set(input.readBy)) : [],
  };

  const current = getLocalPbbPindahNotifs();
  const merged = mergeNotifLists([notif], current);
  safeSetLocalStorage(PBB_PINDAH_NOTIF_STORAGE_KEY, JSON.stringify(merged), {
    skipIdbMirror: true,
  });
  emitPbbPindahUpdated();

  const cleaned = cleanFirestoreData(notif);
  await resilientSetDoc(PBB_PINDAH_NOTIF_COLLECTION, notif.id, cleaned, {
    merge: true,
  });

  return notif;
}

export async function markPbbPindahNotifRead(
  notifId: string,
  accountId: string
): Promise<void> {
  if (!notifId || !accountId) return;

  const current = getLocalPbbPindahNotifs();
  let updatedTarget: PbbPindahNotifItem | null = null;
  const updated = current.map((item) => {
    if (item.id !== notifId) return item;
    const nextReadBy = Array.from(
      new Set([...(Array.isArray(item.readBy) ? item.readBy : []), accountId])
    );
    updatedTarget = { ...item, readBy: nextReadBy };
    return updatedTarget;
  });

  safeSetLocalStorage(PBB_PINDAH_NOTIF_STORAGE_KEY, JSON.stringify(updated), {
    skipIdbMirror: true,
  });
  emitPbbPindahUpdated();

  const fallbackPayload = updatedTarget
    ? cleanFirestoreData(updatedTarget)
    : { readBy: [accountId] };

  if (!db || isFirestoreQuotaCooldownActive()) {
    await resilientSetDoc(
      PBB_PINDAH_NOTIF_COLLECTION,
      notifId,
      fallbackPayload,
      { merge: true }
    );
    return;
  }

  try {
    await updateDoc(doc(db, PBB_PINDAH_NOTIF_COLLECTION, notifId), {
      readBy: arrayUnion(accountId),
    });
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    }
    await resilientSetDoc(
      PBB_PINDAH_NOTIF_COLLECTION,
      notifId,
      fallbackPayload,
      { merge: true }
    );
  }
}

export async function markAllPbbPindahNotifsRead(
  accountId: string,
  notifIds: string[]
): Promise<void> {
  if (!accountId || !Array.isArray(notifIds) || notifIds.length === 0) return;
  const idSet = new Set(notifIds);
  const current = getLocalPbbPindahNotifs();
  const updated = current.map((item) => {
    if (!idSet.has(item.id)) return item;
    const nextReadBy = Array.from(
      new Set([...(Array.isArray(item.readBy) ? item.readBy : []), accountId])
    );
    return { ...item, readBy: nextReadBy };
  });

  safeSetLocalStorage(PBB_PINDAH_NOTIF_STORAGE_KEY, JSON.stringify(updated), {
    skipIdbMirror: true,
  });
  emitPbbPindahUpdated();

  await Promise.all(
    notifIds.map(async (notifId) => {
      const targetItem = updated.find((u) => u.id === notifId);
      const fallbackPayload = targetItem
        ? cleanFirestoreData(targetItem)
        : { readBy: [accountId] };

      if (!db || isFirestoreQuotaCooldownActive()) {
        await resilientSetDoc(
          PBB_PINDAH_NOTIF_COLLECTION,
          notifId,
          fallbackPayload,
          { merge: true }
        );
        return;
      }
      try {
        await updateDoc(doc(db, PBB_PINDAH_NOTIF_COLLECTION, notifId), {
          readBy: arrayUnion(accountId),
        });
      } catch (err) {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
        }
        await resilientSetDoc(
          PBB_PINDAH_NOTIF_COLLECTION,
          notifId,
          fallbackPayload,
          { merge: true }
        );
      }
    })
  );
}

export async function fetchPbbPindahNotifsFromFirestore(): Promise<PbbPindahNotifItem[]> {
  const local = getLocalPbbPindahNotifs();
  if (!db || isFirestoreQuotaCooldownActive()) return local;

  try {
    const colRef = collection(db, PBB_PINDAH_NOTIF_COLLECTION);
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snap = await getDocs(colRef);
    }

    const remoteList: PbbPindahNotifItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as PbbPindahNotifItem;
      if (data && d.id) {
        remoteList.push({
          ...data,
          id: d.id,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
        });
      }
    });

    const merged = mergeNotifLists(remoteList, local);
    safeSetLocalStorage(PBB_PINDAH_NOTIF_STORAGE_KEY, JSON.stringify(merged), {
      skipIdbMirror: true,
    });
    emitPbbPindahUpdated();
    return merged;
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      try {
        handleFirestoreError(err, OperationType.GET, PBB_PINDAH_NOTIF_COLLECTION);
      } catch {
        // Fallback silently to local cache in UI listeners
      }
    }
    return local;
  }
}

export function subscribePbbPindahNotifs(
  cb: (items: PbbPindahNotifItem[]) => void
): () => void {
  const initialLocal = getLocalPbbPindahNotifs();
  cb(initialLocal);

  let isActive = true;

  const handleLocalEvent = () => {
    if (!isActive) return;
    cb(getLocalPbbPindahNotifs());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(PBB_PINDAH_NOTIF_EVENT, handleLocalEvent);
  }

  if (!db || isFirestoreQuotaCooldownActive()) {
    return () => {
      isActive = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(PBB_PINDAH_NOTIF_EVENT, handleLocalEvent);
      }
    };
  }

  let unsub: () => void = () => {};
  try {
    const q = query(collection(db, PBB_PINDAH_NOTIF_COLLECTION));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return;
        const remoteItems: PbbPindahNotifItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PbbPindahNotifItem;
          if (data && docSnap.id) {
            remoteItems.push({
              ...data,
              id: docSnap.id,
              readBy: Array.isArray(data.readBy) ? data.readBy : [],
            });
          }
        });

        const merged = mergeNotifLists(remoteItems, getLocalPbbPindahNotifs());
        safeSetLocalStorage(PBB_PINDAH_NOTIF_STORAGE_KEY, JSON.stringify(merged), {
          skipIdbMirror: true,
        });
        cb(merged);
      },
      (err) => {
        if (isQuotaExhaustedError(err)) {
          markFirestoreQuotaExhausted(err);
          return;
        }
        console.warn('subscribePbbPindahNotifs error:', err);
        fetchPbbPindahNotifsFromFirestore().then((items) => {
          if (isActive) cb(items);
        });
      }
    );
  } catch (err) {
    console.warn('subscribePbbPindahNotifs init error:', err);
  }

  return () => {
    isActive = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener(PBB_PINDAH_NOTIF_EVENT, handleLocalEvent);
    }
    try {
      unsub();
    } catch {}
  };
}
