import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { cleanFirestoreData } from './firestoreService';
import { getLocalTransaksiPkk, KEUANGAN_COLLECTION } from './pkkKeuanganService';
import { getLocalPkkKegiatanList, PKK_KEGIATAN_COLLECTION, hasMissingKegiatanPhotoUrls } from './pkkKegiatanService';
import { getLocalDasaWismaList, PKK_DASA_WISMA_COLLECTION } from './pkkDasaWismaService';
import { getLocalPosyanduReports, hasMissingPosyanduPhotoUrls } from './pkkPosyanduService';
import { getPosyanduFromIndexedDB, getPkkKegiatanFromIndexedDB } from './indexedDbStorage';
import { safeGetLocalStorage } from './safeStorage';
import { PkkBuku1Anggota, PkkBuku4Notulen, PkkBuku5Inventaris } from './pkkBukuService';

export const syncPkkDeviceDataToLiveFirestore = async (
  onProgress: (msg: string) => void
): Promise<{ success: boolean; message: string; stats: any }> => {
  if (!db) return { success: false, message: 'Database tidak tersedia', stats: {} };

  const stats = {
    pkkKeuangan: { synced: 0, total: 0 },
    pkkKegiatan: { synced: 0, total: 0 },
    pkkDasaWisma: { synced: 0, total: 0 },

    buku1: { synced: 0, total: 0 },
    buku4: { synced: 0, total: 0 },
    buku5: { synced: 0, total: 0 },
    posyandu: { synced: 0, total: 0 },
  };

  try {
    // Keuangan
    onProgress('Menyinkronkan Keuangan...');
    const keuangan = getLocalTransaksiPkk();
    stats.pkkKeuangan.total = keuangan.length;
    for (const item of keuangan) {
      await setDoc(doc(db, KEUANGAN_COLLECTION, item.id), cleanFirestoreData(item), { merge: true });
      stats.pkkKeuangan.synced++;
    }

    // Kegiatan (read hydrated IndexedDB records first so photos aren't stripped)
    onProgress('Menyinkronkan Kegiatan...');
    const idbKegiatan = await getPkkKegiatanFromIndexedDB().catch(() => null);
    const kegiatan = Array.isArray(idbKegiatan) && idbKegiatan.length > 0
      ? idbKegiatan
      : getLocalPkkKegiatanList();
    stats.pkkKegiatan.total = kegiatan.length;
    for (const item of kegiatan) {
      const cleaned = cleanFirestoreData(item);
      // Never overwrite Firestore photos with stripped empty-url placeholders
      if (hasMissingKegiatanPhotoUrls(item)) {
        delete cleaned.fotoDokumentasi;
      }
      await setDoc(doc(db, PKK_KEGIATAN_COLLECTION, item.id), cleaned, { merge: true });
      stats.pkkKegiatan.synced++;
    }

    // Dasa Wisma
    onProgress('Menyinkronkan Dasa Wisma...');
    const dawis = getLocalDasaWismaList();
    stats.pkkDasaWisma.total = dawis.length;
    for (const item of dawis) {
      await setDoc(doc(db, PKK_DASA_WISMA_COLLECTION, item.id), cleanFirestoreData(item), { merge: true });
      stats.pkkDasaWisma.synced++;
    }

    // Buku 1, 4, 5
    onProgress('Menyinkronkan Buku Administrasi...');
    const b1 = safeGetLocalStorage<PkkBuku1Anggota[]>('sikepling_pkk_buku_1_v1', []);
    stats.buku1.total = b1.length;
    for (const item of b1) {
      await setDoc(doc(db, 'pkk_buku_1_anggota', item.id), cleanFirestoreData(item), { merge: true });
      stats.buku1.synced++;
    }

    const b4 = safeGetLocalStorage<PkkBuku4Notulen[]>('sikepling_pkk_buku_4_v1', []);
    stats.buku4.total = b4.length;
    for (const item of b4) {
      await setDoc(doc(db, 'pkk_buku_4_notulen', item.id), cleanFirestoreData(item), { merge: true });
      stats.buku4.synced++;
    }

    const b5 = safeGetLocalStorage<PkkBuku5Inventaris[]>('sikepling_pkk_buku_5_v1', []);
    stats.buku5.total = b5.length;
    for (const item of b5) {
      await setDoc(doc(db, 'pkk_buku_5_inventaris', item.id), cleanFirestoreData(item), { merge: true });
      stats.buku5.synced++;
    }

    // Posyandu (read hydrated IndexedDB records first and NEVER upload stripped empty photo arrays)
    onProgress('Menyinkronkan Laporan Posyandu...');
    const idbPosyandu = await getPosyanduFromIndexedDB().catch(() => null);
    const posyanduData = Array.isArray(idbPosyandu) && idbPosyandu.length > 0
      ? idbPosyandu
      : getLocalPosyanduReports();
    stats.posyandu.total = posyanduData.length;
    for (const item of posyanduData) {
      const cleaned = cleanFirestoreData(item);
      if (hasMissingPosyanduPhotoUrls(item)) {
        delete cleaned.dokumentasiFoto;
      }
      await setDoc(doc(db, 'pkk_posyandu_reports', item.id), cleaned, { merge: true });
      stats.posyandu.synced++;
    }

    onProgress('Selesai!');
    return { success: true, message: 'Data PKK berhasil disinkronkan ke Cloud.', stats };
  } catch (err) {
    console.error('PKK Sync Error:', err);
    return { success: false, message: 'Gagal menyinkronkan data: ' + (err instanceof Error ? err.message : String(err)), stats };
  }
};

export const getPkkDeviceDataSnapshot = async () => {
  const idbKegiatan = await getPkkKegiatanFromIndexedDB().catch(() => null);
  const idbPosyandu = await getPosyanduFromIndexedDB().catch(() => null);
  return {
    pkkKeuangan: getLocalTransaksiPkk(),
    pkkKegiatan: Array.isArray(idbKegiatan) && idbKegiatan.length > 0 ? idbKegiatan : getLocalPkkKegiatanList(),
    posyandu: Array.isArray(idbPosyandu) && idbPosyandu.length > 0 ? idbPosyandu : getLocalPosyanduReports(),
    buku1: safeGetLocalStorage<PkkBuku1Anggota[]>('sikepling_pkk_buku_1_v1', []),
    buku4: safeGetLocalStorage<PkkBuku4Notulen[]>('sikepling_pkk_buku_4_v1', []),
    buku5: safeGetLocalStorage<PkkBuku5Inventaris[]>('sikepling_pkk_buku_5_v1', []),
  };
};
