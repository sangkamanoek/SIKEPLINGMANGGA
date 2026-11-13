import { FotoDokumentasi, LaporanKegiatanPkk, PokjaPkkType } from '../types';
import {
  db,
  getAccessToken,
  isFirestoreQuotaCooldownActive,
  isQuotaExhaustedError,
  markFirestoreQuotaExhausted,
} from './firebase';
import { cleanFirestoreData } from './firestoreService';
import {
  collection,
  getDocs,
  getDocsFromServer,
  getDoc,
  getDocFromServer,
  onSnapshot,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { resilientSetDoc, resilientDeleteDoc } from './firestoreWriteQueue';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';
import * as XLSX from 'xlsx';
import { syncPkkPhotosToDrive } from './driveSync';
import { ensureCompactDataUrl } from './imageCompressor';
import {
  savePkkKegiatanToIndexedDB,
  getPkkKegiatanFromIndexedDB,
  saveSinglePkkKegiatanToIndexedDB,
  deletePkkKegiatanFromIndexedDB,
} from './indexedDbStorage';

export const PKK_KEGIATAN_COLLECTION = 'pkk_kegiatan';
export const PKK_KEGIATAN_STORAGE_KEY = 'sikepling_pkk_kegiatan_v1';
export const PKK_DELETED_STORAGE_KEY = 'sikepling_pkk_deleted_v1';
export const PKK_KEGIATAN_CHANNEL = 'sikepling_pkk_kegiatan_channel';

export const POKJA_LABELS: Record<PokjaPkkType, string> = {
  SEKRETARIAT: 'Sekretariat TP PKK',
  POKJA_I: 'Pokja I (Pancasila & Gotong Royong)',
  POKJA_II: 'Pokja II (Pendidikan & UP2K)',
  POKJA_III: 'Pokja III (Pangan, Sandang & Rumah Sehat)',
  POKJA_IV: 'Pokja IV (Kesehatan, Posyandu & PHBS)',
  PKK_LINGKUNGAN: 'TP PKK Lingkungan',
};

const INITIAL_PKK_KEGIATAN: LaporanKegiatanPkk[] = [];

let memoryKegiatan: LaporanKegiatanPkk[] = [];
let deletedPkkIdsCache: string[] = safeGetLocalStorage<string[]>(PKK_DELETED_STORAGE_KEY, []);

const extractFotoUrl = (f: any): string => {
  if (!f || typeof f !== 'object') return '';
  return String(f.url || f.src || f.dataUrl || f.base64 || '');
};

export const hasMissingKegiatanPhotoUrls = (item?: LaporanKegiatanPkk | null): boolean => {
  if (!item || !Array.isArray(item.fotoDokumentasi) || item.fotoDokumentasi.length === 0) {
    return false;
  }
  return item.fotoDokumentasi.some((f) => extractFotoUrl(f).length <= 20);
};

function mergeFotoArrays(
  primaryFotos: FotoDokumentasi[] | undefined,
  fallbackFotos: FotoDokumentasi[] | undefined
): FotoDokumentasi[] | undefined {
  if (!Array.isArray(primaryFotos)) return fallbackFotos;
  if (!Array.isArray(fallbackFotos) || fallbackFotos.length === 0) {
    return primaryFotos.map((f) => {
      const url = extractFotoUrl(f);
      return url && url !== f.url ? { ...f, url } : f;
    });
  }
  return primaryFotos.map((pf, idx) => {
    const primaryUrl = extractFotoUrl(pf);
    if (primaryUrl.length > 20) {
      return primaryUrl !== pf.url ? { ...pf, url: primaryUrl } : pf;
    }
    const match =
      (pf?.id
        ? fallbackFotos.find((fb) => fb && fb.id === pf.id && extractFotoUrl(fb).length > 20)
        : undefined) ||
      (pf?.name
        ? fallbackFotos.find(
            (fb, fbIdx) =>
              fb &&
              fb.name === pf.name &&
              (fbIdx === idx || fallbackFotos.length === primaryFotos.length) &&
              extractFotoUrl(fb).length > 20
          )
        : undefined) ||
      (fallbackFotos[idx] && extractFotoUrl(fallbackFotos[idx]).length > 20
        ? fallbackFotos[idx]
        : undefined);
    return match ? { ...pf, url: extractFotoUrl(match) } : pf;
  });
}

function mergeKegiatanPhotos(
  primary: LaporanKegiatanPkk,
  fallback?: LaporanKegiatanPkk
): LaporanKegiatanPkk {
  if (!fallback) {
    if (!Array.isArray(primary.fotoDokumentasi)) return primary;
    return { ...primary, fotoDokumentasi: mergeFotoArrays(primary.fotoDokumentasi, undefined) };
  }
  const mergedFotos = mergeFotoArrays(primary.fotoDokumentasi, fallback.fotoDokumentasi);
  return {
    ...primary,
    ...(mergedFotos !== undefined ? { fotoDokumentasi: mergedFotos } : {}),
  };
}

export const getDeletedPkkIds = (): string[] => {
  if (!Array.isArray(deletedPkkIdsCache)) deletedPkkIdsCache = [];
  return deletedPkkIdsCache;
};

export const markPkkDeleted = (id: string): void => {
  const current = getDeletedPkkIds();
  if (!current.includes(id)) {
    current.push(id);
    deletedPkkIdsCache = current;
    safeSetLocalStorage(PKK_DELETED_STORAGE_KEY, JSON.stringify(current));
  }
};

export const getLocalPkkKegiatanList = (): LaporanKegiatanPkk[] => {
  const deletedSet = new Set(getDeletedPkkIds());
  const stored = safeGetLocalStorage<LaporanKegiatanPkk[]>(PKK_KEGIATAN_STORAGE_KEY, []);
  const memMap = new Map<string, LaporanKegiatanPkk>();
  memoryKegiatan.forEach((m) => {
    if (m && m.id) memMap.set(m.id, m);
  });

  if (stored && Array.isArray(stored) && stored.length > 0) {
    const cleaned = stored
      .filter((x) => x && x.id && !deletedSet.has(x.id))
      .map((x) => mergeKegiatanPhotos(x, memMap.get(x.id)));
    memoryKegiatan = cleaned;
    return cleaned;
  }
  if (memoryKegiatan.length > 0) {
    const cleaned = memoryKegiatan.filter((x) => x && x.id && !deletedSet.has(x.id));
    memoryKegiatan = cleaned;
    return cleaned;
  }
  return INITIAL_PKK_KEGIATAN;
};

function stripKegiatanDataUrlsForBroadcast(items: LaporanKegiatanPkk[]): LaporanKegiatanPkk[] {
  return items.map((it) => {
    if (!it || !Array.isArray(it.fotoDokumentasi)) return it;
    return {
      ...it,
      fotoDokumentasi: it.fotoDokumentasi.map((f) =>
        f && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 200
          ? { ...f, url: '' }
          : f
      ),
    };
  });
}

export const setLocalPkkKegiatanList = (
  items: LaporanKegiatanPkk[],
  options?: { skipIdbFullSync?: boolean }
): void => {
  memoryKegiatan = items;
  if (!options?.skipIdbFullSync) {
    savePkkKegiatanToIndexedDB(items).catch(() => {});
  }
  safeSetLocalStorage(PKK_KEGIATAN_STORAGE_KEY, JSON.stringify(items), { skipIdbMirror: true });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PKK_KEGIATAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_KEGIATAN', items: stripKegiatanDataUrlsForBroadcast(items) });
      bc.close();
    }
  } catch {}
};

function sortPkkKegiatanDesc(items: LaporanKegiatanPkk[]): LaporanKegiatanPkk[] {
  return [...items].sort((a, b) => {
    const dateA = a.tanggal || a.createdAt || '';
    const dateB = b.tanggal || b.createdAt || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export const smartMergePkkKegiatan = (
  local: LaporanKegiatanPkk[],
  remote: LaporanKegiatanPkk[]
): LaporanKegiatanPkk[] => {
  const deletedSet = new Set(getDeletedPkkIds());
  const map = new Map<string, LaporanKegiatanPkk>();
  for (const item of local) {
    if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
  }
  for (const item of remote) {
    if (item && item.id && !deletedSet.has(item.id)) {
      const prev = map.get(item.id);
      map.set(item.id, mergeKegiatanPhotos(item, prev));
    }
  }
  return sortPkkKegiatanDesc(Array.from(map.values()));
};

function resolveAuthoritativeKegiatan(
  serverItems: LaporanKegiatanPkk[],
  photoPool: LaporanKegiatanPkk[]
): LaporanKegiatanPkk[] {
  const deletedSet = new Set(getDeletedPkkIds());
  const poolMap = new Map<string, LaporanKegiatanPkk>();
  photoPool.forEach((it) => {
    if (!it || !it.id) return;
    const prev = poolMap.get(it.id);
    poolMap.set(it.id, prev ? mergeKegiatanPhotos(it, prev) : it);
  });

  const resolved = serverItems
    .filter((it) => it && it.id && !deletedSet.has(it.id))
    .map((it) => mergeKegiatanPhotos(it, poolMap.get(it.id)));

  return sortPkkKegiatanDesc(resolved);
}

export const fetchPkkKegiatanFromFirestore = async (): Promise<LaporanKegiatanPkk[]> => {
  let idbList: LaporanKegiatanPkk[] = [];
  try {
    const idb = await getPkkKegiatanFromIndexedDB();
    if (Array.isArray(idb)) idbList = idb;
  } catch {}

  const local = resolveAuthoritativeKegiatan(
    idbList.length > 0 ? idbList : getLocalPkkKegiatanList(),
    [...idbList, ...memoryKegiatan, ...getLocalPkkKegiatanList()]
  );

  if (!db || isFirestoreQuotaCooldownActive()) return local;
  try {
    const colRef = collection(db, PKK_KEGIATAN_COLLECTION);
    let snapshot;
    try {
      snapshot = await getDocsFromServer(colRef);
    } catch (serverErr) {
      if (isQuotaExhaustedError(serverErr)) throw serverErr;
      snapshot = await getDocs(colRef);
    }
    const deletedSet = new Set(getDeletedPkkIds());
    const remote: LaporanKegiatanPkk[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && !deletedSet.has(docSnap.id)) {
        remote.push({ ...(d as LaporanKegiatanPkk), id: docSnap.id });
      }
    });
    if (remote.length > 0 || !snapshot.metadata.fromCache) {
      const resolved = resolveAuthoritativeKegiatan(remote, [
        ...idbList,
        ...memoryKegiatan,
        ...local,
      ]);
      setLocalPkkKegiatanList(resolved);
      return resolved;
    }
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      markFirestoreQuotaExhausted(err);
    } else {
      console.warn('[PKK Kegiatan fetch error]:', err);
    }
  }
  return local;
};

export const fetchSinglePkkKegiatan = async (
  id: string,
  forceServer = false
): Promise<LaporanKegiatanPkk | null> => {
  if (!id) return null;
  const local = getLocalPkkKegiatanList();
  let best = local.find((x) => x.id === id);

  if (!forceServer && best && !hasMissingKegiatanPhotoUrls(best)) {
    return best;
  }

  try {
    const idbList = await getPkkKegiatanFromIndexedDB();
    const idbFound = idbList?.find((x) => x.id === id);
    if (idbFound) {
      best = best ? mergeKegiatanPhotos(best, idbFound) : idbFound;
      if (!forceServer && !hasMissingKegiatanPhotoUrls(best)) {
        return best;
      }
    }
  } catch {}

  if (db && !isFirestoreQuotaCooldownActive()) {
    try {
      const docRef = doc(db, PKK_KEGIATAN_COLLECTION, id);
      let snap;
      try {
        snap = await getDocFromServer(docRef);
      } catch (serverErr) {
        if (isQuotaExhaustedError(serverErr)) throw serverErr;
        snap = await getDoc(docRef);
      }
      if (snap.exists()) {
        const remote = { ...(snap.data() as LaporanKegiatanPkk), id: snap.id };
        const resolved = mergeKegiatanPhotos(remote, best);
        await saveSinglePkkKegiatanToIndexedDB(resolved).catch(() => {});
        const updated = [resolved, ...local.filter((x) => x.id !== id)];
        setLocalPkkKegiatanList(sortPkkKegiatanDesc(updated));
        return resolved;
      }
    } catch (err) {
      if (isQuotaExhaustedError(err)) {
        markFirestoreQuotaExhausted(err);
      }
    }
  }

  return best || null;
};

export const subscribePkkKegiatan = (
  callback: (items: LaporanKegiatanPkk[]) => void
): Unsubscribe => {
  const initial = getLocalPkkKegiatanList();
  callback(initial);

  let isActive = true;
  let receivedServerSnapshot = false;

  // Always hydrate from IndexedDB to restore photos even when localStorage stripped them
  getPkkKegiatanFromIndexedDB()
    .then((idbItems) => {
      if (!isActive || !Array.isArray(idbItems) || idbItems.length === 0) return;
      const hydrated = resolveAuthoritativeKegiatan(
        initial.length > 0 ? initial : idbItems,
        [...idbItems, ...memoryKegiatan]
      );
      memoryKegiatan = hydrated;
      if (!receivedServerSnapshot) {
        callback(hydrated);
      }
    })
    .catch(() => {});

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(PKK_KEGIATAN_CHANNEL);
      bc.onmessage = (ev) => {
        if (isActive && ev.data?.items && Array.isArray(ev.data.items)) {
          const deletedSet = new Set(getDeletedPkkIds());
          const memMap = new Map<string, LaporanKegiatanPkk>();
          memoryKegiatan.forEach((m) => {
            if (m && m.id) memMap.set(m.id, m);
          });
          const cleaned = ev.data.items
            .filter((x: LaporanKegiatanPkk) => x && x.id && !deletedSet.has(x.id))
            .map((x: LaporanKegiatanPkk) => mergeKegiatanPhotos(x, memMap.get(x.id)));
          memoryKegiatan = cleaned;
          callback(cleaned);
        }
      };
    }
  } catch {}

  let firestoreUnsub: Unsubscribe = () => {};
  let fallbackTimer: any = null;
  if (db && !isFirestoreQuotaCooldownActive()) {
    try {
      const colRef = collection(db, PKK_KEGIATAN_COLLECTION);
      firestoreUnsub = onSnapshot(
        colRef,
        async (snapshot) => {
          if (!isActive) return;
          const deletedSet = new Set(getDeletedPkkIds());
          const remote: LaporanKegiatanPkk[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d && !deletedSet.has(docSnap.id)) {
              remote.push({
                ...(d as LaporanKegiatanPkk),
                id: docSnap.id,
              });
            }
          });

          let idbList: LaporanKegiatanPkk[] = [];
          try {
            const idb = await getPkkKegiatanFromIndexedDB();
            if (Array.isArray(idb)) idbList = idb;
          } catch {}

          if (!snapshot.metadata.fromCache) {
            receivedServerSnapshot = true;
            const resolved = resolveAuthoritativeKegiatan(remote, [
              ...idbList,
              ...memoryKegiatan,
              ...getLocalPkkKegiatanList(),
            ]);
            setLocalPkkKegiatanList(resolved);
            callback(resolved);
          } else if (remote.length > 0 && !receivedServerSnapshot) {
            const local = getLocalPkkKegiatanList();
            const merged = smartMergePkkKegiatan([...local, ...idbList], remote);
            memoryKegiatan = merged;
            callback(merged);
          }
        },
        (err) => {
          if (isQuotaExhaustedError(err)) {
            markFirestoreQuotaExhausted(err);
            isActive = false;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            try { firestoreUnsub(); } catch {}
            return;
          }
          console.warn('[PKK Kegiatan Firestore error]:', err);
          if (!isFirestoreQuotaCooldownActive()) {
            fetchPkkKegiatanFromFirestore().then((items) => {
              if (isActive) callback(items);
            });
          }
        }
      );

      fallbackTimer = setTimeout(() => {
        if (isActive && !receivedServerSnapshot && !isFirestoreQuotaCooldownActive()) {
          fetchPkkKegiatanFromFirestore().then((items) => {
            if (isActive && !receivedServerSnapshot && items.length > 0) {
              callback(items);
            }
          });
        }
      }, 4500);
    } catch (err) {
      console.warn('[PKK Kegiatan setup error]:', err);
    }
  }

  return () => {
    isActive = false;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (bc) bc.close();
    try { firestoreUnsub(); } catch {}
  };
};

export const syncPkkKegiatanDirectly = async (): Promise<LaporanKegiatanPkk[]> => {
  return fetchPkkKegiatanFromFirestore();
};

export const savePkkKegiatan = async (
  item: LaporanKegiatanPkk
): Promise<void> => {
  let itemToSave = item;

  try {
    const activeToken = await getAccessToken();
    if (activeToken) {
      itemToSave = await syncPkkPhotosToDrive(item, activeToken);
    }
  } catch (err) {
    console.warn('Drive sync for PKK failed:', err);
  }

  let idbList: LaporanKegiatanPkk[] = [];
  try {
    const idb = await getPkkKegiatanFromIndexedDB();
    if (Array.isArray(idb)) idbList = idb;
  } catch {}

  const currentFull = resolveAuthoritativeKegiatan(
    idbList.length > 0 ? idbList : getLocalPkkKegiatanList(),
    [...idbList, ...memoryKegiatan, ...getLocalPkkKegiatanList()]
  );

  // Guard total document size under 1MB
  if (Array.isArray(itemToSave.fotoDokumentasi) && itemToSave.fotoDokumentasi.length > 0) {
    if (JSON.stringify(itemToSave).length > 820_000) {
      const compacted = await Promise.all(
        itemToSave.fotoDokumentasi.map(async (f) => {
          if (f && typeof f.url === 'string' && f.url.startsWith('data:image/')) {
            return { ...f, url: await ensureCompactDataUrl(f.url, 520, 0.34) };
          }
          return f;
        })
      );
      itemToSave = { ...itemToSave, fotoDokumentasi: compacted };
    }
  }

  const filtered = currentFull.filter((x) => x.id !== itemToSave.id);
  const updated = sortPkkKegiatanDesc([itemToSave, ...filtered]);
  await saveSinglePkkKegiatanToIndexedDB(itemToSave).catch(() => {});
  setLocalPkkKegiatanList(updated, { skipIdbFullSync: true });

  const cleaned = cleanFirestoreData(itemToSave);
  if (Array.isArray(cleaned.fotoDokumentasi) && hasMissingKegiatanPhotoUrls(itemToSave)) {
    const validOnly = cleaned.fotoDokumentasi.filter((f: any) => extractFotoUrl(f).length > 20);
    if (validOnly.length === 0) {
      delete cleaned.fotoDokumentasi;
    } else {
      cleaned.fotoDokumentasi = validOnly;
    }
  }
  const writeRes = await resilientSetDoc(PKK_KEGIATAN_COLLECTION, itemToSave.id, cleaned, { merge: true });
  if (!writeRes.synced && !writeRes.queued && Array.isArray(itemToSave.fotoDokumentasi)) {
    const compactedFotos = await Promise.all(
      itemToSave.fotoDokumentasi.map(async (f) =>
        f?.url?.startsWith('data:image/')
          ? { ...f, url: await ensureCompactDataUrl(f.url, 420, 0.28) }
          : f
      )
    );
    const cleanedSafe = cleanFirestoreData({ ...itemToSave, fotoDokumentasi: compactedFotos });
    await resilientSetDoc(PKK_KEGIATAN_COLLECTION, itemToSave.id, cleanedSafe, { merge: true });
  }
};

export const deletePkkKegiatan = async (id: string): Promise<void> => {
  markPkkDeleted(id);
  const current = getLocalPkkKegiatanList();
  const updated = current.filter((x) => x.id !== id);
  await deletePkkKegiatanFromIndexedDB(id).catch(() => {});
  setLocalPkkKegiatanList(updated, { skipIdbFullSync: true });

  await resilientDeleteDoc(PKK_KEGIATAN_COLLECTION, id);
};

export const exportPkkKegiatanToExcel = (
  items: LaporanKegiatanPkk[],
  filterTitle: string = 'Seluruh Kegiatan PKK'
): void => {
  const headers = [
    'No',
    'Tanggal',
    'Pokja / Unit',
    'Nama Kegiatan',
    'Kategori Program 10 Pokok',
    'Lokasi',
    'Lingkungan',
    'Jumlah Peserta',
    'Uraian Hasil Kegiatan',
    'Rencana Tindak Lanjut',
    'Pelapor',
  ];

  const rows = items.map((it, idx) => [
    idx + 1,
    it.tanggal,
    POKJA_LABELS[it.pokja] || it.pokja,
    it.namaKegiatan,
    it.kategoriProgram,
    it.lokasi,
    it.lingkunganNama || (it.lingkunganNomor ? `Lingkungan ${it.lingkunganNomor}` : 'Kelurahan'),
    it.jumlahPeserta || 0,
    it.uraianHasil,
    it.tindakLanjut || '-',
    it.pelaporNama,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    ['TIM PENGGERAK PKK KELURAHAN MANGGA'],
    [`BUKU LAPORAN KEGIATAN TP-PKK - ${filterTitle.toUpperCase()}`],
    [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
    [],
    headers,
    ...rows,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kegiatan PKK');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Laporan_Kegiatan_PKK_Kelurahan_Mangga_${dateStr}.xlsx`);
};
