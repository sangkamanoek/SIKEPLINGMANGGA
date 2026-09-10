import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function main() {
  console.log('Menginisialisasi data Firebase baru dengan nama SIKEPLINGMANGGA...');

  // 1. Buat Dokumen Utama Koleksi SIKEPLINGMANGGA
  const infoDocRef = doc(db, 'SIKEPLINGMANGGA', 'info');
  await setDoc(infoDocRef, {
    namaAplikasi: 'SI KEPLING MANGGA',
    kodeAplikasi: 'SIKEPLINGMANGGA',
    deskripsi: 'Sistem Informasi Pelaporan Kinerja Harian dan Dashboard Capaian 24 Kepala Lingkungan Kelurahan Mangga Kecamatan Medan Tuntungan',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    kota: 'Kota Medan',
    provinsi: 'Sumatera Utara',
    instansi: 'Pemerintah Kota Medan',
    jumlahLingkungan: 24,
    databaseTersambung: 'Firebase Firestore',
    statusDatabase: 'Aktif & Siap Digunakan',
    koleksiTerkait: ['reports', 'targets_capaian', 'account_passwords', 'reminders', 'notification_logs', 'SIKEPLINGMANGGA'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log('Dokumen SIKEPLINGMANGGA/info berhasil dibuat.');

  // 2. Buat Dokumen Target Capaian di SIKEPLINGMANGGA/targets
  const targetsPath = path.resolve(process.cwd(), 'data/targets_capaian.json');
  let targetsData = {};
  if (fs.existsSync(targetsPath)) {
    targetsData = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  }
  const targetsDocRef = doc(db, 'SIKEPLINGMANGGA', 'targets');
  await setDoc(targetsDocRef, {
    keterangan: 'Baseline Target Capaian 24 Kepala Lingkungan Kelurahan Mangga 2026',
    data: targetsData,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log('Dokumen SIKEPLINGMANGGA/targets berhasil dibuat.');

  // 3. Simpan data reports yang ada ke koleksi reports dan juga ke SIKEPLINGMANGGA/reports
  const reportsPath = path.resolve(process.cwd(), 'data/reports.json');
  if (fs.existsSync(reportsPath)) {
    const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
    console.log(`Menyimpan ${reports.length} laporan ke Firestore...`);
    for (const r of reports) {
      if (!r.id) continue;
      // Simpan ke koleksi root 'reports'
      await setDoc(doc(db, 'reports', r.id), r, { merge: true });
      // Simpan juga ke dokumen SIKEPLINGMANGGA
      await setDoc(doc(db, 'SIKEPLINGMANGGA', `laporan_${r.id}`), {
        ...r,
        tag: 'SIKEPLINGMANGGA',
        disimpanPada: new Date().toISOString(),
      }, { merge: true });
    }
  }

  // 4. Pastikan koleksi 'targets_capaian' untuk kepling_1 s/d kepling_24 terisi di Firestore
  if (targetsData && typeof targetsData === 'object') {
    const batch = writeBatch(db);
    for (const [keplingId, item] of Object.entries(targetsData)) {
      const docRef = doc(db, 'targets_capaian', keplingId);
      batch.set(docRef, { ...(item as any), updatedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
    console.log('Koleksi targets_capaian 24 Kepling berhasil disinkronkan ke Firestore.');
  }

  console.log('Semua data Firebase dengan nama SIKEPLINGMANGGA BERHASIL DIBUAT!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error inisialisasi data Firebase:', err);
  process.exit(1);
});
