import { collection, getDocs, getDocsFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { safeSetLocalStorage } from './safeStorage';
import { LOCAL_STORAGE_KEY_LAPORAN } from './reportsApi';
import {
  saveReportsToIndexedDB,
  saveSuratToIndexedDB,
  savePosyanduToIndexedDB,
  saveVisitsToIndexedDB,
  savePkkKegiatanToIndexedDB,
} from './indexedDbStorage';
import { saveLocalSpptForYear } from './pbbService';
import { MONITORING_INFRA_COLLECTION, MONITORING_INFRA_STORAGE_KEY } from './monitoringInfrastrukturService';
import { KUNJUNGAN_COLLECTION, KUNJUNGAN_STORAGE_KEY } from './kunjunganService';
import { PEMBANGUNAN_STORAGE_KEY } from './pembangunanService';
import {
  STORAGE_KEY_TASKS,
  STORAGE_KEY_SUBMISSIONS,
  TUGAS_KHUSUS_COLLECTION,
  TUGAS_SUBMISSIONS_COLLECTION,
} from './tugasKhususService';

async function getColDocs(colName: string) {
  const colRef = collection(db, colName);
  try {
    return await getDocsFromServer(colRef);
  } catch {
    return await getDocs(colRef);
  }
}

export const pullAllDataFromFirestore = async (
  onProgress: (msg: string) => void
): Promise<{ success: boolean; message: string }> => {
  if (!db) return { success: false, message: 'Database tidak tersedia' };

  try {
    // 1. PKK Kegiatan (Book 6)
    onProgress('Mengambil Data Kegiatan PKK (Buku 6)...');
    const pkkKegiatanSnap = await getColDocs('pkk_kegiatan');
    const pkkKegiatan: any[] = [];
    pkkKegiatanSnap.forEach((d) => pkkKegiatan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_kegiatan_v1', JSON.stringify(pkkKegiatan));
    savePkkKegiatanToIndexedDB(pkkKegiatan).catch(() => {});

    // 2. PKK Keuangan (Book 3)
    onProgress('Mengambil Data Keuangan PKK (Buku 3)...');
    const pkkKeuanganSnap = await getColDocs('pkk_keuangan');
    const pkkKeuangan: any[] = [];
    pkkKeuanganSnap.forEach((d) => pkkKeuangan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_keuangan_v1', JSON.stringify(pkkKeuangan));

    // 3. PKK Dasa Wisma
    onProgress('Mengambil Data Dasa Wisma...');
    const pkkDawisSnap = await getColDocs('pkk_dasa_wisma');
    const pkkDawis: any[] = [];
    pkkDawisSnap.forEach((d) => pkkDawis.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_dasa_wisma_v1', JSON.stringify(pkkDawis));

    // 4. PKK Buku Administrasi (1, 4, 5)
    onProgress('Mengambil Data Buku Administrasi PKK (1, 4, 5)...');
    const books = [
      { col: 'pkk_buku_1_anggota', key: 'sikepling_pkk_buku_1_v1' },
      { col: 'pkk_buku_4_notulen', key: 'sikepling_pkk_buku_4_v1' },
      { col: 'pkk_buku_5_inventaris', key: 'sikepling_pkk_buku_5_v1' },
    ];

    for (const book of books) {
      try {
        const snap = await getColDocs(book.col);
        const data: any[] = [];
        snap.forEach((d) => data.push({ ...d.data(), id: d.id }));
        safeSetLocalStorage(book.key, JSON.stringify(data));
      } catch (e) {
        console.warn(`Failed to pull ${book.col}:`, e);
      }
    }

    // 5. Surat Kedinasan (Book 2)
    onProgress('Mengambil Arsip Surat Kedinasan (Buku 2)...');
    const suratSnap = await getColDocs('surat_kedinasan');
    const surat: any[] = [];
    suratSnap.forEach((d) => surat.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_surat_kedinasan_v1', JSON.stringify(surat));
    saveSuratToIndexedDB(surat).catch(() => {});

    // 7. Laporan Harian (Kepling)
    onProgress('Mengambil Seluruh Laporan Kinerja Kepling...');
    const reports: any[] = [];
    const seenReportIds = new Set<string>();

    const collectionsToTry = ['reports', 'laporan_harian', 'SIKEPLINGMANGGA'];
    for (const col of collectionsToTry) {
      try {
        const snap = await getColDocs(col);
        snap.forEach((d) => {
          if (!seenReportIds.has(d.id)) {
            reports.push({ ...d.data(), id: d.id });
            seenReportIds.add(d.id);
          }
        });
      } catch (e) {}
    }
    safeSetLocalStorage(LOCAL_STORAGE_KEY_LAPORAN, JSON.stringify(reports));
    saveReportsToIndexedDB(reports).catch(() => {});

    // 8. Posyandu
    onProgress('Mengambil Laporan Posyandu...');
    const posyanduSnap = await getColDocs('pkk_posyandu_reports');
    const posyandu: any[] = [];
    posyanduSnap.forEach((d) => posyandu.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_posyandu_v1', JSON.stringify(posyandu));
    savePosyanduToIndexedDB(posyandu).catch(() => {});

    // 9. Agenda Kelurahan
    onProgress('Mengambil Agenda Kelurahan...');
    const agendaSnap = await getColDocs('agenda_kelurahan');
    const agenda: any[] = [];
    agendaSnap.forEach((d) => agenda.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_agenda_kelurahan_v2', JSON.stringify(agenda));

    // 10. Monitoring Infrastruktur
    onProgress('Mengambil Laporan Monitoring Infrastruktur...');
    const infraSnap = await getColDocs(MONITORING_INFRA_COLLECTION);
    const infra: any[] = [];
    infraSnap.forEach((d) => infra.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(MONITORING_INFRA_STORAGE_KEY, JSON.stringify(infra));

    // 11. Kunjungan Warga
    onProgress('Mengambil Data Kunjungan Warga...');
    const visitSnap = await getColDocs(KUNJUNGAN_COLLECTION);
    const visits: any[] = [];
    visitSnap.forEach((d) => visits.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(visits));
    saveVisitsToIndexedDB(visits).catch(() => {});

    // 12. Realisasi Pembangunan
    onProgress('Mengambil Data Pembangunan...');
    const pembangunanSnap = await getColDocs('realisasi_pembangunan');
    const pembangunan: any[] = [];
    pembangunanSnap.forEach((d) => pembangunan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(pembangunan));

    // 13. Tugas Khusus
    onProgress('Mengambil Data Tugas Khusus...');
    const tasksSnap = await getColDocs(TUGAS_KHUSUS_COLLECTION);
    const tasks: any[] = [];
    tasksSnap.forEach((d) => {
      const data = d.data();
      if (data && data.judul) tasks.push({ ...data, id: d.id });
    });
    safeSetLocalStorage(STORAGE_KEY_TASKS, JSON.stringify(tasks));

    const subsSnap = await getColDocs(TUGAS_SUBMISSIONS_COLLECTION);
    const subs: Record<string, any> = {};
    subsSnap.forEach((d) => {
      const data = d.data();
      if (data.taskId) subs[data.taskId] = { ...data, id: d.id };
    });
    safeSetLocalStorage(STORAGE_KEY_SUBMISSIONS, JSON.stringify(subs));

    // 14. PBB SPPT (Hanya Tahun Aktif 2026 agar ringan di memori HP)
    onProgress('Mengambil Data PBB SPPT Tahun 2026...');
    try {
      const pbbSnap = await getColDocs('pbb_sppt_2026');
      const pbb: any[] = [];
      pbbSnap.forEach((d) => pbb.push({ ...d.data(), id: d.id }));
      if (pbb.length > 0) {
        saveLocalSpptForYear(pbb, 2026);
      }
    } catch (e) {
      console.warn('PBB SPPT pull error:', e);
    }

    onProgress('Semua data berhasil ditarik dari Cloud!');

    // Trigger window events to notify UI to refresh
    window.dispatchEvent(new CustomEvent('agenda-data-updated'));
    window.dispatchEvent(new CustomEvent('kunjungan-data-updated'));
    window.dispatchEvent(new CustomEvent('pembangunan-data-updated'));
    window.dispatchEvent(new CustomEvent('pbb-data-updated', { detail: { year: 2026 } }));
    window.dispatchEvent(new Event('sikepling_tugas_khusus_updated'));

    return { success: true, message: 'Berhasil menarik seluruh data dari Cloud Firestore.' };
  } catch (err) {
    console.error('Global Pull Error:', err);
    return { success: false, message: 'Gagal menarik data: ' + (err instanceof Error ? err.message : String(err)) };
  }
};

