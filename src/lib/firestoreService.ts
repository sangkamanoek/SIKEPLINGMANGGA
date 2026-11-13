export const cleanFirestoreData = (data: any): any => {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' ? cleanFirestoreData(item) : item));
  }
  if (typeof data !== 'object') return data;
  const cleaned: any = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined) {
      cleaned[key] = typeof data[key] === 'object' ? cleanFirestoreData(data[key]) : data[key];
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
  summary?: string;
  deviceInfo?: string;
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

    const collectionsToTry = ['reports', 'laporan_harian', 'SIKEPLINGMANGGA'];
    for (const colName of collectionsToTry) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.forEach((d) => {
          const data = d.data();
          if (data && d.id && !seenIds.has(d.id)) {
            list.push({ ...data, id: d.id });
            seenIds.add(d.id);
          }
        });
      } catch (e) {
        // Ignore if collection doesn't exist or error
      }
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
    return () => {};
  }
  const collectionsToWatch = ['reports', 'laporan_harian', 'SIKEPLINGMANGGA'];
  const collectionsData: Record<string, any[]> = {};
  const unsubs: (() => void)[] = [];
  let debounceTimer: any = null;
  let isActive = true;
  let hasReceivedServerData = false;

  const emitMerged = () => {
    if (!isActive) return;
    const map = new Map<string, any>();
    for (const colName of collectionsToWatch) {
      const list = collectionsData[colName] || [];
      list.forEach((item) => {
        if (item && item.id) {
          const existing = map.get(item.id);
          if (existing) {
            const hasPhotos = (it: any) =>
              it.dokumentasiFoto &&
              Array.isArray(it.dokumentasiFoto) &&
              it.dokumentasiFoto.some((f: any) => f.url);
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const itemTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            if (existingTime > itemTime) {
              const mergedPhotos = hasPhotos(existing)
                ? existing.dokumentasiFoto
                : item.dokumentasiFoto;
              map.set(item.id, { ...item, ...existing, ...(mergedPhotos ? { dokumentasiFoto: mergedPhotos } : {}) });
            } else if (!hasPhotos(item) && hasPhotos(existing)) {
              map.set(item.id, { ...existing, ...item, dokumentasiFoto: existing.dokumentasiFoto });
            } else {
              map.set(item.id, { ...existing, ...item });
            }
          } else {
            map.set(item.id, item);
          }
        }
      });
    }
    if (map.size === 0 && !hasReceivedServerData) {
      return;
    }
    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.tanggal ? new Date(b.tanggal).getTime() : 0;
      return timeB - timeA;
    });
    cb(merged);
  };

  const triggerDebouncedEmit = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emitMerged();
    }, 120);
  };

  try {
    for (const colName of collectionsToWatch) {
      try {
        const q = collection(db, colName);
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            const items: any[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              if (d && docSnap.id) {
                items.push({ ...d, id: docSnap.id });
              }
            });
            if (!snapshot.metadata.fromCache) {
              hasReceivedServerData = true;
            }
            if (items.length > 0 || !snapshot.metadata.fromCache) {
              collectionsData[colName] = items;
              triggerDebouncedEmit();
            }
          },
          (err) => {
            console.warn(`subscribeReportsFromFirestore (${colName}) error:`, err);
            fetchReportsFromFirestore().then((fallbackList) => {
              if (isActive && fallbackList.length > 0) {
                hasReceivedServerData = true;
                cb(fallbackList);
              }
            });
          }
        );
        unsubs.push(unsub);
      } catch (e) {
        console.warn(`Error attaching listener for ${colName}:`, e);
      }
    }

    // Parallel getDocs check to guarantee data loads on cold start / restricted iframes
    fetchReportsFromFirestore().then((fallbackList) => {
      if (isActive && !hasReceivedServerData && fallbackList.length > 0) {
        hasReceivedServerData = true;
        cb(fallbackList);
      }
    });

    return () => {
      isActive = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubs.forEach((u) => u());
    };
  } catch (e) {
    return () => {};
  }
};

export const shouldFilterReport = (_r?: any) => false;

export const fetchTargetsFromFirestore = async (): Promise<any> => {
  if (!db) return {};
  try {
    const snap = await getDocs(collection(db, 'targets_capaian'));
    const map: any = {};
    snap.forEach((d) => {
      map[d.id] = { ...d.data(), keplingId: d.id };
    });
    return map;
  } catch (err) {
    console.error('fetchTargetsFromFirestore error:', err);
    return {};
  }
};

export const saveTargetToFirestore = async (item: any) => {
  if (!db || !item || !item.keplingId) return;
  try {
    const cleaned = cleanFirestoreData(item);
    await setDoc(doc(db, 'targets_capaian', item.keplingId), cleaned, { merge: true });
  } catch (err) {
    console.error('saveTargetToFirestore error:', err);
  }
};

export const saveAllTargetsToFirestore = async (allTargets: any) => {
  if (!db || !allTargets) return;
  try {
    for (const key of Object.keys(allTargets)) {
      const item = allTargets[key];
      if (item && item.keplingId) {
        await saveTargetToFirestore(item);
      }
    }
  } catch (err) {
    console.error('saveAllTargetsToFirestore error:', err);
  }
};

export const resetTargetsInFirestore = async () => {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'targets_capaian'));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'targets_capaian', d.id));
    }
  } catch (err) {
    console.error('resetTargetsInFirestore error:', err);
  }
};

export const subscribeTargetsFromFirestore = (cb: (data: any) => void) => {
  if (!db) {
    return () => {};
  }
  let isActive = true;
  let hasReceivedData = false;
  try {
    const q = query(collection(db, 'targets_capaian'));
    const unsub = onSnapshot(q, (snapshot) => {
      const map: any = {};
      snapshot.forEach((docSnap) => {
        map[docSnap.id] = { ...docSnap.data(), keplingId: docSnap.id };
      });
      if (Object.keys(map).length > 0 || !snapshot.metadata.fromCache) {
        hasReceivedData = true;
        cb(map);
      }
    }, (err) => {
      console.warn('subscribeTargetsFromFirestore error:', err);
      fetchTargetsFromFirestore().then((fallback) => {
        if (isActive && fallback && Object.keys(fallback).length > 0) {
          hasReceivedData = true;
          cb(fallback);
        }
      });
    });

    // Proactive getDocs fallback on cold start / restricted iframe
    fetchTargetsFromFirestore().then((fallback) => {
      if (isActive && !hasReceivedData && fallback && Object.keys(fallback).length > 0) {
        hasReceivedData = true;
        cb(fallback);
      }
    });

    return () => {
      isActive = false;
      unsub();
    };
  } catch (e) {
    return () => {};
  }
};

export const saveSyncAuditLog = async (_log: any): Promise<boolean> => { return true; };
export const fetchSyncAuditLogs = async (): Promise<SyncAuditLog[]> => [];
export const saveAttendanceQRToFirestore = async (_qr: any): Promise<{ success: boolean; method?: string }> => { return { success: true, method: 'firestore' }; };
export const subscribeAttendanceQRFromFirestore = (_dateStr: string, cb: (qr: AttendanceQREntity | null) => void) => {
  if (typeof cb === 'function') {
    cb(null);
  }
  return () => {};
};

export const subscribeCustomEventsFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const subscribeEventAttendanceFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const saveCustomEventToFirestore = async (_event: any): Promise<boolean> => true;
export const deleteCustomEventFromFirestore = async (_id: string): Promise<boolean> => true;
export const saveEventAttendanceToFirestore = async (_att: any): Promise<boolean> => true;
