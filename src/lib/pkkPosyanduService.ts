import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
} from 'firebase/firestore';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import {
  db,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import { FotoDokumentasi, PosyanduReport } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import { ensureCompactDataUrl } from './imageCompressor';
import {
  savePosyanduToIndexedDB,
  getPosyanduFromIndexedDB,
  saveSinglePosyanduToIndexedDB,
  deletePosyanduFromIndexedDB,
} from './indexedDbStorage';

const COLLECTION_NAME = 'pkk_posyandu_reports';
export const POSYANDU_STORAGE_KEY = 'sikepling_pkk_posyandu_v1';

// In-memory unstripped cache so photos stay intact during the session even when localStorage strips >250KB data URLs
let memoryPosyanduCache: PosyanduReport[] = [];

const extractPhotoUrl = (f: any): string => {
  if (!f || typeof f !== 'object') return '';
  return String(f.url || f.src || f.dataUrl || f.base64 || '');
};

export const hasMissingPosyanduPhotoUrls = (report?: PosyanduReport | null): boolean => {
  if (!report || !Array.isArray(report.dokumentasiFoto) || report.dokumentasiFoto.length === 0) {
    return false;
  }
  return report.dokumentasiFoto.some((f) => extractPhotoUrl(f).length <= 20);
};

function mergeFotoArrays(
  primaryFotos: FotoDokumentasi[] | undefined,
  fallbackFotos: FotoDokumentasi[] | undefined
): FotoDokumentasi[] | undefined {
  if (!Array.isArray(primaryFotos)) return fallbackFotos;
  if (!Array.isArray(fallbackFotos) || fallbackFotos.length === 0) {
    return primaryFotos.map((f) => {
      const url = extractPhotoUrl(f);
      return url && url !== f.url ? { ...f, url } : f;
    });
  }

  return primaryFotos.map((pf, idx) => {
    const primaryUrl = extractPhotoUrl(pf);
    if (primaryUrl.length > 20) {
      return primaryUrl !== pf.url ? { ...pf, url: primaryUrl } : pf;
    }

    const match =
      (pf?.id
        ? fallbackFotos.find((fb) => fb && fb.id === pf.id && extractPhotoUrl(fb).length > 20)
        : undefined) ||
      (pf?.name
        ? fallbackFotos.find(
            (fb, fbIdx) =>
              fb &&
              fb.name === pf.name &&
              (fbIdx === idx || fallbackFotos.length === primaryFotos.length) &&
              extractPhotoUrl(fb).length > 20
          )
        : undefined) ||
      (fallbackFotos[idx] && extractPhotoUrl(fallbackFotos[idx]).length > 20
        ? fallbackFotos[idx]
        : undefined);

    if (match) {
      return { ...pf, url: extractPhotoUrl(match) };
    }
    return pf;
  });
}

function mergeSinglePosyanduPhotos(
  primary: PosyanduReport,
  fallback?: PosyanduReport
): PosyanduReport {
  if (!fallback) {
    if (!Array.isArray(primary.dokumentasiFoto)) return primary;
    return {
      ...primary,
      dokumentasiFoto: mergeFotoArrays(primary.dokumentasiFoto, undefined),
    };
  }
  const mergedFotos = mergeFotoArrays(primary.dokumentasiFoto, fallback.dokumentasiFoto);
  return {
    ...primary,
    ...(mergedFotos !== undefined ? { dokumentasiFoto: mergedFotos } : {}),
  };
}

function sortPosyanduDesc(items: PosyanduReport[]): PosyanduReport[] {
  return [...items].sort((a, b) =>
    (b.tanggal || b.createdAt || '').localeCompare(a.tanggal || a.createdAt || '')
  );
}

export const getLocalPosyanduReports = (): PosyanduReport[] => {
  const lsItems = safeGetLocalStorage<PosyanduReport[]>(POSYANDU_STORAGE_KEY, []);
  if (!Array.isArray(lsItems) || lsItems.length === 0) {
    return memoryPosyanduCache;
  }
  if (memoryPosyanduCache.length === 0) {
    return lsItems;
  }
  const memMap = new Map<string, PosyanduReport>();
  memoryPosyanduCache.forEach((m) => {
    if (m && m.id) memMap.set(m.id, m);
  });
  return lsItems.map((it) => mergeSinglePosyanduPhotos(it, memMap.get(it.id)));
};

function resolveAuthoritativePosyandu(
  serverItems: PosyanduReport[],
  photoPool: PosyanduReport[]
): PosyanduReport[] {
  const poolMap = new Map<string, PosyanduReport>();
  photoPool.forEach((it) => {
    if (!it || !it.id) return;
    const prev = poolMap.get(it.id);
    poolMap.set(it.id, prev ? mergeSinglePosyanduPhotos(it, prev) : it);
  });

  const resolved = serverItems.map((serverItem) => {
    const cached = poolMap.get(serverItem.id);
    return mergeSinglePosyanduPhotos(serverItem, cached);
  });

  return sortPosyanduDesc(resolved);
}

/**
 * Fetch all posyandu reports from Firestore and update local storage & IndexedDB
 */
export const fetchPosyanduReports = async (): Promise<PosyanduReport[]> => {
  let idbList: PosyanduReport[] = [];
  try {
    const idb = await getPosyanduFromIndexedDB();
    if (Array.isArray(idb)) idbList = idb;
  } catch {}

  if (!db || isFirestoreQuotaCooldownActive()) {
    const merged = resolveAuthoritativePosyandu(
      idbList.length > 0 ? idbList : getLocalPosyanduReports(),
      [...idbList, ...memoryPosyanduCache, ...getLocalPosyanduReports()]
    );
    memoryPosyanduCache = merged;
    return merged;
  }

  try {
    const q = collection(db, COLLECTION_NAME);
    let snapshot;
    try {
      snapshot = await getDocsFromServer(q);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snapshot = await getDocs(q);
    }
    const items = snapshot.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    })) as PosyanduReport[];

    if (items.length > 0 || !snapshot.metadata.fromCache) {
      const resolved = resolveAuthoritativePosyandu(items, [
        ...idbList,
        ...memoryPosyanduCache,
        ...getLocalPosyanduReports(),
      ]);
      memoryPosyanduCache = resolved;
      savePosyanduToIndexedDB(resolved).catch(() => {});
      safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(resolved), { skipIdbMirror: true });
      return resolved;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[pkkPosyanduService] fetchPosyanduReports warning:', err);
    }
  }

  const fallback = resolveAuthoritativePosyandu(
    idbList.length > 0 ? idbList : getLocalPosyanduReports(),
    [...idbList, ...memoryPosyanduCache, ...getLocalPosyanduReports()]
  );
  memoryPosyanduCache = fallback;
  return fallback;
};

/**
 * Fetch a single posyandu report directly by document ID.
 * If cached copy has stripped photo URLs (`url: ''`), hydrates from IndexedDB and Firestore server.
 */
export const fetchSinglePosyanduReport = async (
  id: string,
  forceServer = false
): Promise<PosyanduReport | null> => {
  if (!id) return null;

  const localList = getLocalPosyanduReports();
  const localFound = localList.find((x) => x.id === id);
  const memFound = memoryPosyanduCache.find((x) => x.id === id);

  let bestLocal: PosyanduReport | undefined = localFound
    ? mergeSinglePosyanduPhotos(localFound, memFound)
    : memFound;

  if (!forceServer && bestLocal && !hasMissingPosyanduPhotoUrls(bestLocal)) {
    return bestLocal;
  }

  // 2. Check IndexedDB unconditionally if forceServer is false or as fallback photo pool
  let idbFound: PosyanduReport | undefined;
  try {
    const idbList = await getPosyanduFromIndexedDB();
    idbFound = idbList?.find((x) => x.id === id);
    if (idbFound) {
      bestLocal = bestLocal
        ? mergeSinglePosyanduPhotos(bestLocal, idbFound)
        : idbFound;
      if (!forceServer && !hasMissingPosyanduPhotoUrls(bestLocal)) {
        memoryPosyanduCache = [
          bestLocal,
          ...memoryPosyanduCache.filter((x) => x.id !== id),
        ];
        return bestLocal;
      }
    }
  } catch {}

  // 3. Query Firestore directly by Document Reference (prefer server)
  if (db && !isFirestoreQuotaCooldownActive()) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      let snap;
      try {
        snap = await getDocFromServer(docRef);
      } catch (serverErr) {
        if (isQuotaExhaustedError(serverErr)) throw serverErr;
        snap = await getDoc(docRef);
      }
      if (snap.exists()) {
        const serverItem = { ...snap.data(), id: snap.id } as PosyanduReport;
        const resolved = mergeSinglePosyanduPhotos(serverItem, bestLocal || idbFound);
        memoryPosyanduCache = [
          resolved,
          ...memoryPosyanduCache.filter((x) => x.id !== id),
        ];
        await saveSinglePosyanduToIndexedDB(resolved).catch(() => {});
        const updatedList = [resolved, ...localList.filter((x) => x.id !== id)];
        safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updatedList), { skipIdbMirror: true });
        return resolved;
      }
    } catch (e) {
      if (isQuotaExhaustedError(e)) {
        markFirestoreQuotaExhausted(e);
      } else {
        console.warn(`[pkkPosyanduService] Failed to fetch single doc "${id}":`, e);
      }
    }
  }

  return bestLocal || null;
};

export const subscribePosyanduReports = (onUpdate: (items: PosyanduReport[]) => void) => {
  let isActive = true;
  let hasLiveFirestore = false;

  const initial = getLocalPosyanduReports();
  if (initial.length > 0) {
    onUpdate(initial);
  }

  // ALWAYS asynchronously hydrate from IndexedDB to restore full photos even when initial.length > 0
  getPosyanduFromIndexedDB()
    .then((idbItems) => {
      if (!isActive || !Array.isArray(idbItems) || idbItems.length === 0) return;
      const hydrated = resolveAuthoritativePosyandu(
        initial.length > 0 ? initial : idbItems,
        [...idbItems, ...memoryPosyanduCache]
      );
      memoryPosyanduCache = hydrated;
      if (!hasLiveFirestore) {
        onUpdate(hydrated);
      }
    })
    .catch((err) => {
      console.warn('[pkkPosyanduService] IndexedDB hydration note:', err);
    });

  if (!db || isFirestoreQuotaCooldownActive()) return () => { isActive = false; };

  let fallbackTimer: any = null;
  const q = collection(db, COLLECTION_NAME);
  const unsub = onSnapshot(
    q,
    async (snapshot) => {
      if (!isActive) return;
      const serverItems = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as PosyanduReport[];

      let idbList: PosyanduReport[] = [];
      try {
        const idb = await getPosyanduFromIndexedDB();
        if (Array.isArray(idb)) idbList = idb;
      } catch {}

      if (!snapshot.metadata.fromCache) {
        hasLiveFirestore = true;
        const resolved = resolveAuthoritativePosyandu(serverItems, [
          ...idbList,
          ...memoryPosyanduCache,
          ...getLocalPosyanduReports(),
        ]);
        if (isActive) {
          memoryPosyanduCache = resolved;
          savePosyanduToIndexedDB(resolved).catch(() => {});
          safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(resolved), { skipIdbMirror: true });
          onUpdate(resolved);
        }
      } else if (serverItems.length > 0 && !hasLiveFirestore) {
        const resolved = resolveAuthoritativePosyandu(serverItems, [
          ...idbList,
          ...memoryPosyanduCache,
          ...getLocalPosyanduReports(),
        ]);
        memoryPosyanduCache = resolved;
        onUpdate(resolved);
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
      console.warn('[pkkPosyanduService] onSnapshot listener warning:', error);
      if (!isFirestoreQuotaCooldownActive()) {
        fetchPosyanduReports()
          .then((items) => {
            if (isActive) onUpdate(items);
          })
          .catch(() => {});
      }
    }
  );

  fallbackTimer = setTimeout(() => {
    if (isActive && !hasLiveFirestore && !isFirestoreQuotaCooldownActive()) {
      fetchPosyanduReports()
        .then((items) => {
          if (isActive && !hasLiveFirestore && items.length > 0) {
            hasLiveFirestore = true;
            onUpdate(items);
          }
        })
        .catch(() => {});
    }
  }, 4500);

  return () => {
    isActive = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    try { unsub(); } catch {}
  };
};

export const savePosyanduReport = async (item: PosyanduReport) => {
  // 1. Gather full unstripped existing pool (IndexedDB + memory + localStorage) so saving one report never wipes other reports' photos
  let idbList: PosyanduReport[] = [];
  try {
    const idb = await getPosyanduFromIndexedDB();
    if (Array.isArray(idb)) idbList = idb;
  } catch {}

  const currentFull = resolveAuthoritativePosyandu(
    idbList.length > 0 ? idbList : getLocalPosyanduReports(),
    [...idbList, ...memoryPosyanduCache, ...getLocalPosyanduReports()]
  );
  const existingItem = currentFull.find((x) => x.id === item.id);

  // Restore any empty URL slots from existing unstripped cache before persisting
  let hydratedItem = mergeSinglePosyanduPhotos(item, existingItem);

  // 2. Guard against Firestore 1MB document limit by re-compressing oversized base64 images if needed
  if (Array.isArray(hydratedItem.dokumentasiFoto) && hydratedItem.dokumentasiFoto.length > 0) {
    const approxBytes = JSON.stringify(hydratedItem).length;
    if (approxBytes > 820_000) {
      const compactedFotos = await Promise.all(
        hydratedItem.dokumentasiFoto.map(async (f) => {
          if (f && typeof f.url === 'string' && f.url.startsWith('data:image/')) {
            const smaller = await ensureCompactDataUrl(f.url, 520, 0.34);
            return { ...f, url: smaller };
          }
          return f;
        })
      );
      hydratedItem = { ...hydratedItem, dokumentasiFoto: compactedFotos };
    }
  }

  const payload: PosyanduReport = {
    ...hydratedItem,
    updatedAt: new Date().toISOString(),
  };

  const idx = currentFull.findIndex((x) => x.id === item.id);
  const updated =
    idx >= 0
      ? currentFull.map((x) => (x.id === item.id ? payload : x))
      : [payload, ...currentFull];

  memoryPosyanduCache = sortPosyanduDesc(updated);

  // Persist unstripped payload to IndexedDB first, then safeSetLocalStorage (no duplicate full IDB rewrite)
  await saveSinglePosyanduToIndexedDB(payload).catch(() => {});
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });

  const cleaned = cleanFirestoreData(payload);
  // Avoid overwriting existing non-empty Firestore photos if payload still contains stripped empty-url placeholders
  if (Array.isArray(cleaned.dokumentasiFoto) && hasMissingPosyanduPhotoUrls(payload)) {
    const validOnly = cleaned.dokumentasiFoto.filter(
      (f: any) => extractPhotoUrl(f).length > 20
    );
    if (validOnly.length === 0) {
      delete cleaned.dokumentasiFoto;
    } else {
      cleaned.dokumentasiFoto = validOnly;
    }
  }
  await resilientSetDoc(COLLECTION_NAME, item.id, cleaned, { merge: true });
};

export const deletePosyanduReport = async (id: string) => {
  const current = getLocalPosyanduReports();
  const updated = current.filter((x) => x.id !== id);
  memoryPosyanduCache = memoryPosyanduCache.filter((x) => x.id !== id);
  await deletePosyanduFromIndexedDB(id).catch(() => {});
  safeSetLocalStorage(POSYANDU_STORAGE_KEY, JSON.stringify(updated), { skipIdbMirror: true });

  await resilientDeleteDoc(COLLECTION_NAME, id);
};
