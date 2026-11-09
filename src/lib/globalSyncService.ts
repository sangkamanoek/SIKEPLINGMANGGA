import { collection, getDocs, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { safeSetLocalStorage } from './safeStorage';
import { 
  PKK_KEGIATAN_COLLECTION, 
  PKK_KEGIATAN_STORAGE_KEY 
} from './pkkKegiatanService';
import { 
  KEUANGAN_COLLECTION, 
  KEUANGAN_STORAGE_KEY 
} from './pkkKeuanganService';
import { 
  PKK_DASA_WISMA_COLLECTION, 
  PKK_DASA_WISMA_STORAGE_KEY 
} from './pkkDasaWismaService';
import { 
  SURAT_COLLECTION, 
  SURAT_STORAGE_KEY 
} from './suratService';
import { 
  fetchAllDataKeluarga 
} from './dataKeluargaService';
import { 
  MONITORING_INFRA_COLLECTION, 
  MONITORING_INFRA_STORAGE_KEY 
} from './monitoringInfrastrukturService';
import { 
  KUNJUNGAN_COLLECTION, 
  KUNJUNGAN_STORAGE_KEY 
} from './kunjunganService';
import { 
  PEMBANGUNAN_STORAGE_KEY 
} from './pembangunanService';
import { 
  STORAGE_KEY_TASKS, 
  STORAGE_KEY_SUBMISSIONS,
  TUGAS_KHUSUS_COLLECTION,
  TUGAS_SUBMISSIONS_COLLECTION
} from './tugasKhususService';

export const pullAllDataFromFirestore = async (
  onProgress: (msg: string) => void
): Promise<{ success: boolean; message: string }> => {
  if (!db) return { success: false, message: 'Database tidak tersedia' };

  try {
    // 1. PKK Kegiatan (Book 6)
    onProgress('Mengambil Data Kegiatan PKK (Buku 6)...');
    const pkkKegiatanSnap = await getDocs(collection(db, 'pkk_kegiatan'));
    const pkkKegiatan: any[] = [];
    pkkKegiatanSnap.forEach(d => pkkKegiatan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_kegiatan_v1', JSON.stringify(pkkKegiatan));

    // 2. PKK Keuangan (Book 3)
    onProgress('Mengambil Data Keuangan PKK (Buku 3)...');
    const pkkKeuanganSnap = await getDocs(collection(db, 'pkk_keuangan'));
    const pkkKeuangan: any[] = [];
    pkkKeuanganSnap.forEach(d => pkkKeuangan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_keuangan_v1', JSON.stringify(pkkKeuangan));

    // 3. PKK Dasa Wisma
    onProgress('Mengambil Data Dasa Wisma...');
    const pkkDawisSnap = await getDocs(collection(db, 'pkk_dasa_wisma'));
    const pkkDawis: any[] = [];
    pkkDawisSnap.forEach(d => pkkDawis.push({ ...d.data(), id: d.id }));
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
        const snap = await getDocs(collection(db, book.col));
        const data: any[] = [];
        snap.forEach(d => data.push({ ...d.data(), id: d.id }));
        safeSetLocalStorage(book.key, JSON.stringify(data));
      } catch (e) {
        console.warn(`Failed to pull ${book.col}:`, e);
      }
    }

    // 5. Surat Kedinasan (Book 2)
    onProgress('Mengambil Arsip Surat Kedinasan (Buku 2)...');
    const suratSnap = await getDocs(collection(db, 'surat_kedinasan'));
    const surat: any[] = [];
    suratSnap.forEach(d => surat.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_surat_kedinasan_v1', JSON.stringify(surat));

    // 6. Data Keluarga
    onProgress('Mengambil Database Keluarga...');
    const keluarga = await fetchAllDataKeluarga();
    safeSetLocalStorage('sikepling_data_keluarga_v1', JSON.stringify(keluarga));

    // 7. Laporan Harian (Kepling)
    onProgress('Mengambil Seluruh Laporan Kinerja Kepling...');
    const reports: any[] = [];
    const seenReportIds = new Set<string>();
    
    const collectionsToTry = ['reports', 'laporan_harian', 'SIKEPLINGMANGGA'];
    for (const col of collectionsToTry) {
      try {
        const snap = await getDocs(collection(db, col));
        snap.forEach(d => {
          if (!seenReportIds.has(d.id)) {
            reports.push({ ...d.data(), id: d.id });
            seenReportIds.add(d.id);
          }
        });
      } catch (e) {}
    }
    safeSetLocalStorage('sikepling_laporan_harian_list', JSON.stringify(reports));

    // 8. Posyandu
    onProgress('Mengambil Laporan Posyandu...');
    const posyanduSnap = await getDocs(collection(db, 'pkk_posyandu_reports'));
    const posyandu: any[] = [];
    posyanduSnap.forEach(d => posyandu.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_pkk_posyandu_v1', JSON.stringify(posyandu));

    // 9. Agenda Kelurahan
    onProgress('Mengambil Agenda Kelurahan...');
    const agendaSnap = await getDocs(collection(db, 'agenda_kelurahan'));
    const agenda: any[] = [];
    agendaSnap.forEach(d => agenda.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_agenda_kelurahan_v2', JSON.stringify(agenda));

    // 10. Monitoring Infrastruktur
    onProgress('Mengambil Laporan Monitoring Infrastruktur...');
    const infraSnap = await getDocs(collection(db, MONITORING_INFRA_COLLECTION));
    const infra: any[] = [];
    infraSnap.forEach(d => infra.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(MONITORING_INFRA_STORAGE_KEY, JSON.stringify(infra));

    // 11. Kunjungan Warga
    onProgress('Mengambil Data Kunjungan Warga...');
    const visitSnap = await getDocs(collection(db, KUNJUNGAN_COLLECTION));
    const visits: any[] = [];
    visitSnap.forEach(d => visits.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(visits));

    // 12. Realisasi Pembangunan
    onProgress('Mengambil Data Pembangunan...');
    const pembangunanSnap = await getDocs(collection(db, 'realisasi_pembangunan'));
    const pembangunan: any[] = [];
    pembangunanSnap.forEach(d => pembangunan.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(PEMBANGUNAN_STORAGE_KEY, JSON.stringify(pembangunan));

    // 13. Tugas Khusus
    onProgress('Mengambil Data Tugas Khusus...');
    const tasksSnap = await getDocs(collection(db, TUGAS_KHUSUS_COLLECTION));
    const tasks: any[] = [];
    tasksSnap.forEach(d => tasks.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage(STORAGE_KEY_TASKS, JSON.stringify(tasks));

    const subsSnap = await getDocs(collection(db, TUGAS_SUBMISSIONS_COLLECTION));
    const subs: Record<string, any> = {};
    subsSnap.forEach(d => {
      const data = d.data();
      if (data.taskId) subs[data.taskId] = { ...data, id: d.id };
    });
    safeSetLocalStorage(STORAGE_KEY_SUBMISSIONS, JSON.stringify(subs));

    // 14. PBB SPPT (Hanya Tahun Aktif 2026 agar ringan di memori HP)
    onProgress('Mengambil Data PBB SPPT Tahun 2026...');
    try {
      const pbbSnap = await getDocs(collection(db, 'pbb_sppt_2026'));
      const pbb: any[] = [];
      pbbSnap.forEach(d => pbb.push({ ...d.data(), id: d.id }));
      if (pbb.length > 0) {
        safeSetLocalStorage('sikepling_sppt_pbb_records_2026_v3', JSON.stringify(pbb));
      }
    } catch (e) {
      console.warn('PBB SPPT pull error:', e);
    }

    // 15. Attendance
    onProgress('Mengambil Data Presensi Apel...');
    const attSnap = await getDocs(collection(db, 'attendance'));
    const att: any[] = [];
    attSnap.forEach(d => att.push({ ...d.data(), id: d.id }));
    safeSetLocalStorage('sikepling_attendance_list_v1', JSON.stringify(att));

    onProgress('Semua data berhasil ditarik dari Cloud!');
    
    // Trigger window events to notify UI to refresh
    window.dispatchEvent(new CustomEvent('agenda-data-updated'));
    window.dispatchEvent(new CustomEvent('pbb-data-updated', { detail: { year: 2026 } }));
    window.dispatchEvent(new Event('sikepling_tugas_khusus_updated'));
    
    return { success: true, message: 'Berhasil menarik seluruh data dari Cloud Firestore.' };
  } catch (err) {
    console.error('Global Pull Error:', err);
    return { success: false, message: 'Gagal menarik data: ' + (err instanceof Error ? err.message : String(err)) };
  }
};

