import { RealisasiPembangunan } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from './safeStorage';

export const PEMBANGUNAN_STORAGE_KEY = 'sikepling_pembangunan_data_v1';
export const PEMBANGUNAN_CHANNEL = 'sikepling_pembangunan_channel';

export const getLocalPembangunanList = (): RealisasiPembangunan[] => {
  const stored = safeGetLocalStorage<RealisasiPembangunan[]>(PEMBANGUNAN_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
};

export const setLocalPembangunanList = (items: RealisasiPembangunan[]): void => {
  safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(items));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(PEMBANGUNAN_CHANNEL);
      bc.postMessage({ type: 'SYNC_PEMBANGUNAN', items });
      bc.close();
    }
  } catch (e) {}
};

export const fetchPembangunanAll = async (): Promise<RealisasiPembangunan[]> => {
  let serverItems: RealisasiPembangunan[] = [];
  try {
    const res = await fetch('/api/pembangunan', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        serverItems = json.data;
      }
    }
  } catch (err) {
    console.warn('[pembangunanService] Server API fetch error:', err);
  }

  const localItems = getLocalPembangunanList();
  
  // Merge server & local items by id
  const map = new Map<string, RealisasiPembangunan>();
  for (const item of localItems) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of serverItems) {
    if (item && item.id) {
      const existing = map.get(item.id);
      map.set(item.id, existing ? { ...item, ...existing } : item);
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  if (merged.length > 0) {
    setLocalPembangunanList(merged);
  }
  return merged;
};

export const savePembangunanToServer = async (item: RealisasiPembangunan): Promise<RealisasiPembangunan> => {
  // Update local first
  const current = getLocalPembangunanList();
  const idx = current.findIndex((p) => p.id === item.id);
  let updatedList = [...current];
  if (idx >= 0) {
    updatedList[idx] = { ...updatedList[idx], ...item, updatedAt: new Date().toISOString() };
  } else {
    updatedList = [{ ...item, createdAt: item.createdAt || new Date().toISOString() }, ...updatedList];
  }
  setLocalPembangunanList(updatedList);

  // Sync to server API
  try {
    const method = idx >= 0 && item.id && !item.id.startsWith('temp_') ? 'PUT' : 'POST';
    const url = method === 'PUT' ? `/api/pembangunan/${item.id}` : '/api/pembangunan';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const saved = json.data;
        const fresh = getLocalPembangunanList();
        const fIdx = fresh.findIndex((p) => p.id === item.id || p.id === saved.id);
        if (fIdx >= 0) {
          fresh[fIdx] = saved;
        } else {
          fresh.unshift(saved);
        }
        setLocalPembangunanList(fresh);
        return saved;
      }
    }
  } catch (err) {
    console.warn('[pembangunanService] Save to server error:', err);
  }

  return item;
};

export const deletePembangunanFromServer = async (id: string): Promise<void> => {
  const current = getLocalPembangunanList();
  const filtered = current.filter((p) => p.id !== id);
  setLocalPembangunanList(filtered);

  try {
    await fetch(`/api/pembangunan/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[pembangunanService] Delete from server error:', err);
  }
};

export const batchSyncPembangunan = async (items: RealisasiPembangunan[]): Promise<boolean> => {
  if (!Array.isArray(items) || items.length === 0) return true;
  setLocalPembangunanList(items);
  try {
    const res = await fetch('/api/pembangunan/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const json = await res.json();
      return !!json.success;
    }
  } catch (err) {
    console.warn('[pembangunanService] Batch sync error:', err);
  }
  return false;
};

export const subscribeToPembangunan = (cb: (items: RealisasiPembangunan[]) => void): (() => void) => {
  // Initial call with local list
  const initial = getLocalPembangunanList();
  cb(initial);

  // Fetch fresh from server
  fetchPembangunanAll().then((serverItems) => {
    cb(serverItems);
  });

  // Broadcast channel listener for multi-tab sync
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(PEMBANGUNAN_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC_PEMBANGUNAN' && Array.isArray(event.data.items)) {
          cb(event.data.items);
        }
      };
    }
  } catch (e) {}

  // Poll server periodically for updates
  const interval = setInterval(async () => {
    try {
      const items = await fetchPembangunanAll();
      cb(items);
    } catch (e) {}
  }, 10000);

  return () => {
    clearInterval(interval);
    if (bc) {
      bc.close();
    }
  };
};

export const subscribePembangunan = subscribeToPembangunan;
