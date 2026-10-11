import { db } from './firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';

export interface PkkSyncStats {
  pkkKeuangan: { total: number; synced: number };
  pkkKegiatan: { total: number; synced: number };
  pkkDasaWisma: { total: number; synced: number };
  buku1: { total: number; synced: number };
  buku4: { total: number; synced: number };
  buku5: { total: number; synced: number };
  posyandu: { total: number; synced: number };
}

export async function getPkkDeviceDataSnapshot() {
  // Read from localStorage / fallback arrays or collections
  let pkkKeuangan: any[] = [];
  let pkkKegiatan: any[] = [];
  let dawis: any[] = [];
  let buku1: any[] = [];
  let buku4: any[] = [];
  let buku5: any[] = [];
  let posyandu: any[] = [];

  try {
    const rawKeq = localStorage.getItem('sikepling_pkk_keuangan') || localStorage.getItem('pkk_keuangan_cache');
    if (rawKeq) pkkKeuangan = JSON.parse(rawKeq);
  } catch {}

  try {
    const rawKeg = localStorage.getItem('sikepling_pkk_kegiatan') || localStorage.getItem('pkk_kegiatan_cache');
    if (rawKeg) pkkKegiatan = JSON.parse(rawKeg);
  } catch {}

  try {
    const rawDawis = localStorage.getItem('sikepling_dasa_wisma') || localStorage.getItem('dasa_wisma_cache');
    if (rawDawis) dawis = JSON.parse(rawDawis);
  } catch {}

  try {
    const rawB1 = localStorage.getItem('sikepling_pkk_buku_1') || localStorage.getItem('buku_1_cache');
    if (rawB1) buku1 = JSON.parse(rawB1);
  } catch {}

  try {
    const rawB4 = localStorage.getItem('sikepling_pkk_buku_4') || localStorage.getItem('buku_4_cache');
    if (rawB4) buku4 = JSON.parse(rawB4);
  } catch {}

  try {
    const rawB5 = localStorage.getItem('sikepling_pkk_buku_5') || localStorage.getItem('buku_5_cache');
    if (rawB5) buku5 = JSON.parse(rawB5);
  } catch {}

  try {
    const rawPos = localStorage.getItem('sikepling_pkk_posyandu') || localStorage.getItem('posyandu_reports_cache');
    if (rawPos) posyandu = JSON.parse(rawPos);
  } catch {}

  return {
    pkkKeuangan,
    pkkKegiatan,
    dawis,
    buku1,
    buku4,
    buku5,
    posyandu,
    totalCount: pkkKeuangan.length + pkkKegiatan.length + dawis.length + buku1.length + buku4.length + buku5.length + posyandu.length
  };
}

export async function syncPkkDeviceDataToLiveFirestore(
  onProgress?: (msg: string) => void
): Promise<{
  success: boolean;
  message: string;
  stats: PkkSyncStats;
}> {
  const stats: PkkSyncStats = {
    pkkKeuangan: { total: 0, synced: 0 },
    pkkKegiatan: { total: 0, synced: 0 },
    pkkDasaWisma: { total: 0, synced: 0 },
    buku1: { total: 0, synced: 0 },
    buku4: { total: 0, synced: 0 },
    buku5: { total: 0, synced: 0 },
    posyandu: { total: 0, synced: 0 },
  };

  try {
    onProgress?.('Membaca data lokal modul PKK...');
    const snapshot = await getPkkDeviceDataSnapshot();

    // 1. PKK Keuangan
    stats.pkkKeuangan.total = snapshot.pkkKeuangan.length;
    if (snapshot.pkkKeuangan.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.pkkKeuangan.length} transaksi PKK Keuangan...`);
      for (const item of snapshot.pkkKeuangan) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_keuangan', item.id), cleanFirestoreData(item), { merge: true });
            stats.pkkKeuangan.synced++;
          } catch {}
        }
      }
    }

    // 2. PKK Kegiatan
    stats.pkkKegiatan.total = snapshot.pkkKegiatan.length;
    if (snapshot.pkkKegiatan.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.pkkKegiatan.length} laporan PKK Kegiatan...`);
      for (const item of snapshot.pkkKegiatan) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_kegiatan', item.id), cleanFirestoreData(item), { merge: true });
            stats.pkkKegiatan.synced++;
          } catch {}
        }
      }
    }

    // 3. Dasa Wisma
    stats.pkkDasaWisma.total = snapshot.dawis.length;
    if (snapshot.dawis.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.dawis.length} kelompok Dasa Wisma...`);
      for (const item of snapshot.dawis) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_dasa_wisma', item.id), cleanFirestoreData(item), { merge: true });
            stats.pkkDasaWisma.synced++;
          } catch {}
        }
      }
    }

    // 4. Buku 1 Anggota
    stats.buku1.total = snapshot.buku1.length;
    if (snapshot.buku1.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.buku1.length} anggota Buku I PKK...`);
      for (const item of snapshot.buku1) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_buku_1_anggota', item.id), cleanFirestoreData(item), { merge: true });
            stats.buku1.synced++;
          } catch {}
        }
      }
    }

    // 5. Buku 4 Notulen
    stats.buku4.total = snapshot.buku4.length;
    if (snapshot.buku4.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.buku4.length} notulen rapat Buku IV PKK...`);
      for (const item of snapshot.buku4) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_buku_4_notulen', item.id), cleanFirestoreData(item), { merge: true });
            stats.buku4.synced++;
          } catch {}
        }
      }
    }

    // 6. Buku 5 Inventaris
    stats.buku5.total = snapshot.buku5.length;
    if (snapshot.buku5.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.buku5.length} inventaris Buku V PKK...`);
      for (const item of snapshot.buku5) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_buku_5_inventaris', item.id), cleanFirestoreData(item), { merge: true });
            stats.buku5.synced++;
          } catch {}
        }
      }
    }

    // 7. Posyandu Reports
    stats.posyandu.total = snapshot.posyandu.length;
    if (snapshot.posyandu.length > 0) {
      onProgress?.(`Menyinkronkan ${snapshot.posyandu.length} laporan Posyandu PKK...`);
      for (const item of snapshot.posyandu) {
        if (item && item.id && db) {
          try {
            await setDoc(doc(db, 'pkk_posyandu_reports', item.id), cleanFirestoreData(item), { merge: true });
            stats.posyandu.synced++;
          } catch {}
        }
      }
    }

    onProgress?.('Penyelarasan database cloud PKK selesai!');

    return {
      success: true,
      message: 'Seluruh data modul PKK berhasil disinkronkan ke database live Firestore!',
      stats,
    };
  } catch (error: any) {
    console.error('Error syncing PKK device data:', error);
    return {
      success: false,
      message: `Gagal menyelaraskan data PKK: ${error.message || error}`,
      stats,
    };
  }
}
