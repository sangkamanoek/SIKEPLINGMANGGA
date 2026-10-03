import { KunjunganWargaData } from '../components/FormKunjunganWarga';
import { db } from './firebase';
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
import { getReportIsoDate, isReportMatchingDate, getTodayLocalIso, extractNomorLingkungan, isKunjunganMatchingKepling } from './formatter';
import { LaporanHarianItem, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

export const KUNJUNGAN_STORAGE_KEY = 'sikepling_kunjungan_harian_list_v1';
export const KUNJUNGAN_BROADCAST_CHANNEL = 'sikepling_kunjungan_channel';
export const KUNJUNGAN_CUSTOM_EVENT = 'kunjungan-data-updated';

/**
 * Normalisasi data kunjungan ke ISO Date (YYYY-MM-DD)
 */
export function getKunjunganIsoDate(k: any): string {
  if (!k) return '';
  const iso = getReportIsoDate(k);
  if (iso) return iso;
  if (k.tanggal && String(k.tanggal).match(/^\d{4}-\d{2}-\d{2}$/)) {
    return String(k.tanggal);
  }
  if (k.createdAt && typeof k.createdAt === 'string') {
    const createdIso = k.createdAt.split('T')[0];
    if (createdIso.match(/^\d{4}-\d{2}-\d{2}$/)) return createdIso;
  }
  return '';
}

/**
 * Validasi apakah kunjungan cocok dengan tanggal target ISO
 */
export function isKunjunganOnDate(k: any, targetDateIso: string): boolean {
  if (!k || !targetDateIso) return true;
  const kIso = getKunjunganIsoDate(k);
  if (kIso && kIso === targetDateIso) return true;
  if (isReportMatchingDate(k, targetDateIso)) return true;
  if (k.tanggal === targetDateIso) return true;
  if (k.createdAt && typeof k.createdAt === 'string' && k.createdAt.startsWith(targetDateIso)) return true;
  return false;
}

/**
 * Ambil data Kunjungan instan dari Local Storage (0ms)
 */
export function getLocalKunjunganList(): KunjunganWargaData[] {
  return safeGetLocalStorage<KunjunganWargaData[]>(KUNJUNGAN_STORAGE_KEY, []);
}

/**
 * Simpan data Kunjungan ke Local Storage & Broadcast ke tab lain
 */
export function setLocalKunjunganList(list: KunjunganWargaData[]): void {
  safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(list));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(KUNJUNGAN_CUSTOM_EVENT, { detail: list }));
  }
}

/**
 * Broadcast event simpan / update kunjungan seketika
 */
export function broadcastKunjunganChange(item: KunjunganWargaData): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(KUNJUNGAN_CUSTOM_EVENT, { detail: item }));
    const bc = new BroadcastChannel(KUNJUNGAN_BROADCAST_CHANNEL);
    bc.postMessage({ type: 'KUNJUNGAN_SAVED', item, timestamp: Date.now() });
    setTimeout(() => {
      try {
        bc.close();
      } catch {}
    }, 200);
  } catch {}
}

/**
 * Ambil data dari Server Buffer Express
 */
export async function fetchKunjunganFromServerBuffer(): Promise<KunjunganWargaData[]> {
  try {
    const res = await fetch(`/api/kunjungan?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        return json.data as KunjunganWargaData[];
      }
    }
  } catch (err) {
    console.warn('Notice fetching kunjungan from server:', err);
  }
  return [];
}

/**
 * Simpan 1 catatan Kunjungan secara Dual-Tier (0ms Local + Broadcast + Server Buffer + Firestore)
 */
export async function saveKunjunganWargaToFirestore(data: KunjunganWargaData): Promise<void> {
  // 1. Instant 0ms update di local state & storage
  const current = getLocalKunjunganList();
  const exists = current.some((x) => x.id === data.id);
  const updated = exists ? current.map((x) => (x.id === data.id ? data : x)) : [data, ...current];
  setLocalKunjunganList(updated);
  broadcastKunjunganChange(data);

  // 2. Kirim ke Server API buffer
  fetch('/api/kunjungan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: data }),
  }).catch((err) => {
    console.warn('Notice saving kunjungan to server buffer:', err);
  });

  // 3. Simpan ke Firestore
  if (db) {
    try {
      const docRef = doc(db, 'kunjungan_warga', data.id);
      await setDoc(docRef, data);
    } catch (err) {
      console.warn('Firestore setDoc notice for kunjungan_warga:', err);
    }
  }
}

/**
 * Hapus 1 catatan Kunjungan (Local + Server + Firestore)
 */
export async function deleteKunjunganWarga(id: string): Promise<void> {
  const current = getLocalKunjunganList();
  const updated = current.filter((x) => x.id !== id);
  setLocalKunjunganList(updated);

  if (typeof window !== 'undefined') {
    try {
      const bc = new BroadcastChannel(KUNJUNGAN_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'KUNJUNGAN_DELETED', id, timestamp: Date.now() });
      setTimeout(() => bc.close(), 200);
    } catch {}
  }

  fetch(`/api/kunjungan/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((err) => {
    console.warn('Notice deleting kunjungan from server:', err);
  });

  if (db) {
    try {
      await deleteDoc(doc(db, 'kunjungan_warga', id));
    } catch (err) {
      console.warn('Firestore deleteDoc notice for kunjungan_warga:', err);
    }
  }
}

/**
 * Ultra-fast Real-time listener & Dual-tier sync untuk Kunjungan Warga
 */
export function subscribeKunjunganWarga(
  onSuccess: (data: KunjunganWargaData[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // 1. 0ms instant local cache
  const initialLocal = getLocalKunjunganList();
  if (initialLocal.length > 0) {
    onSuccess(initialLocal);
  }

  // 2. Fetch server buffer immediately
  fetchKunjunganFromServerBuffer().then((serverItems) => {
    if (serverItems.length > 0) {
      const current = getLocalKunjunganList();
      const map = new Map<string, KunjunganWargaData>();
      serverItems.forEach((it) => map.set(it.id, it));
      current.forEach((it) => {
        if (!map.has(it.id)) map.set(it.id, it);
      });
      const merged = Array.from(map.values());
      setLocalKunjunganList(merged);
      onSuccess(merged);
    }
  });

  // 3. Cross-tab BroadcastChannel listener
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(KUNJUNGAN_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      if (event?.data?.type === 'KUNJUNGAN_SAVED' && event.data.item) {
        const item = event.data.item as KunjunganWargaData;
        const current = getLocalKunjunganList();
        const exists = current.some((x) => x.id === item.id);
        const updated = exists ? current.map((x) => (x.id === item.id ? item : x)) : [item, ...current];
        setLocalKunjunganList(updated);
        onSuccess(updated);
      } else if (event?.data?.type === 'KUNJUNGAN_DELETED' && event.data.id) {
        const id = event.data.id;
        const current = getLocalKunjunganList();
        const updated = current.filter((x) => x.id !== id);
        setLocalKunjunganList(updated);
        onSuccess(updated);
      }
    };
  } catch {}

  // 4. Same-window custom event listener
  const handleCustomEvent = (e: any) => {
    const detail = e?.detail;
    if (Array.isArray(detail)) {
      onSuccess(detail);
    } else if (detail && detail.id) {
      const current = getLocalKunjunganList();
      const exists = current.some((x) => x.id === detail.id);
      const updated = exists ? current.map((x) => (x.id === detail.id ? detail : x)) : [detail, ...current];
      setLocalKunjunganList(updated);
      onSuccess(updated);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(KUNJUNGAN_CUSTOM_EVENT, handleCustomEvent);
  }

  // 5. Firestore real-time snapshot
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'kunjungan_warga'), orderBy('createdAt', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, KunjunganWargaData>();
          snapshot.forEach((d) => {
            const data = d.data() as KunjunganWargaData;
            if (data && (data.id || d.id)) {
              const fullData = { ...data, id: data.id || d.id };
              map.set(fullData.id, fullData);
            }
          });
          const list = Array.from(map.values());
          if (list.length > 0) {
            setLocalKunjunganList(list);
            onSuccess(list);
          }
        },
        (err) => {
          console.warn('Firestore snapshot error for kunjungan_warga:', err);
          if (onError) onError(err);
        }
      );
    } catch (e: any) {
      console.warn('Error setting up firestore snapshot on kunjungan_warga:', e);
      if (onError) onError(e);
    }
  }

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(KUNJUNGAN_CUSTOM_EVENT, handleCustomEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}

/**
 * 🛡️ KONSOLIDASI GANDA: Menggabungkan data kunjungan form mandiri (kunjungan_warga)
 * dengan data kunjungan yang diinput Kepling melalui Laporan Kinerja Harian (kinerja.perlinsosKk).
 * Ini memastikan jika Kepling 11 (atau Kepling mana pun) mengisi kunjungan di laporan harian
 * ataupun di form kunjungan terpisah, Super Admin PASTI melihatnya dan TIDAK PERNAH NIHIL!
 */
export function consolidateKunjunganWithReports(
  kunjunganList: KunjunganWargaData[] | any[],
  reports: LaporanHarianItem[] | any[]
): KunjunganWargaData[] {
  const map = new Map<string, KunjunganWargaData>();

  // 1. Masukkan semua kunjungan dari form mandiri
  (kunjunganList || []).forEach((k) => {
    if (k && k.id) {
      map.set(k.id, k);
    }
  });

  // 2. Periksa semua laporan harian untuk mengekstrak kunjungan/sambang warga
  (reports || []).forEach((rep) => {
    if (!rep) return;
    const kin = rep.kinerja || {};
    const perlinsosCount = parseInt(kin.perlinsosKk || '0', 10);
    const perlinsosMenolakCount = parseInt(kin.perlinsosMenolakKk || '0', 10);
    const perlinsosTidakDiTempatCount = parseInt(kin.perlinsosTidakDiTempatKk || '0', 10);
    const totalGiatPerlinsos = perlinsosCount + perlinsosMenolakCount + perlinsosTidakDiTempatCount;

    const hasPerlinsosGiat =
      totalGiatPerlinsos > 0 ||
      (kin.perlinsosKeterangan && kin.perlinsosKeterangan.trim() !== '' && kin.perlinsosKeterangan !== 'Pendataan Perlinsos') ||
      (kin.perlinsosMenolakRincian && kin.perlinsosMenolakRincian.trim() !== '');

    if (!hasPerlinsosGiat) return;

    const targetNomor =
      extractNomorLingkungan(rep.jabatan) ||
      extractNomorLingkungan(rep.lingkungan) ||
      extractNomorLingkungan(rep.keplingId);

    const kepling = KEPLING_ACCOUNTS.find((k) => {
      if (rep.keplingId && k.id && rep.keplingId.toLowerCase() === k.id.toLowerCase()) return true;
      if (targetNomor && k.nomorLingkungan && targetNomor === k.nomorLingkungan) return true;
      if (rep.namaKepling && k.nama && rep.namaKepling.trim().toLowerCase() === k.nama.trim().toLowerCase()) return true;
      return false;
    });

    const keplingNama = rep.namaKepling || kepling?.nama || (targetNomor ? `Kepling Lingkungan ${targetNomor}` : 'Kepala Lingkungan');
    const lingkunganNama = kepling?.lingkungan || (targetNomor ? `Lingkungan ${targetNomor}` : rep.jabatan || 'Lingkungan');
    const keplingId = kepling?.id || rep.keplingId || (targetNomor ? `kepling_${targetNomor}` : 'kepling_unknown');
    const tglIso = getReportIsoDate(rep) || rep.tanggal || getTodayLocalIso();

    // Cek apakah sudah ada entri form mandiri untuk kepling ini pada tanggal ini
    const alreadyHasVisits = Array.from(map.values()).some((k) => {
      const matchKepling = isKunjunganMatchingKepling(k, { id: keplingId, nama: keplingNama, nomorLingkungan: targetNomor || undefined, lingkungan: lingkunganNama });
      const matchDate = isKunjunganOnDate(k, tglIso);
      return matchKepling && matchDate;
    });

    // Jika belum ada di list kunjungan mandiri, buatkan catatan kunjungan virtual resmi
    if (!alreadyHasVisits) {
      const repFoto = (rep.dokumentasiFoto || []).find((f: any) =>
        f?.kategori === 'perlinsos' ||
        (f?.name && (f.name.toLowerCase().includes('perlinsos') || f.name.toLowerCase().includes('kunjungan')))
      )?.url || (rep.dokumentasiFoto?.[0]?.url || '');

      let keteranganSambang = kin.perlinsosKeterangan || 'Kunjungan dan Sambang Warga Door-to-Door';
      if (kin.perlinsosMenolakRincian) {
        keteranganSambang += ` (Catatan Menolak: ${kin.perlinsosMenolakRincian})`;
      }

      const synthesizedId = `synced_rep_kunjungan_${rep.id || (keplingId + '_' + tglIso)}`;
      const synthesizedItem: KunjunganWargaData = {
        id: synthesizedId,
        tanggal: tglIso,
        namaWarga: kin.perlinsosKeterangan ? kin.perlinsosKeterangan.replace(/Kunjungan\s*(warga)?\s*[:,-]?\s*/i, '').split(',')[0].trim() || `Warga ${lingkunganNama}` : `Warga ${lingkunganNama}`,
        alamat: `Wilayah ${lingkunganNama}, Kelurahan Mangga`,
        lingkungan: lingkunganNama,
        lingkunganNomor: targetNomor || 1,
        namaKepling: keplingNama,
        keplingId: keplingId,
        perlinsos: perlinsosCount > 0 ? 'Sudah' : (perlinsosMenolakCount > 0 ? 'Menolak' : 'Belum'),
        ikd: (parseInt(kin.ikdOrang || '0', 10) > 0) ? 'Sudah' : 'Belum',
        pbb: (parseInt(kin.opsirPbbWp || '0', 10) > 0) ? 'Sudah' : 'Belum',
        keterangan: keteranganSambang,
        fotoDokumentasi: repFoto,
        createdAt: rep.createdAt || new Date().toISOString(),
      };

      map.set(synthesizedId, synthesizedItem);
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.tanggal || '').getTime();
    const tB = new Date(b.createdAt || b.tanggal || '').getTime();
    return tB - tA;
  });
}
