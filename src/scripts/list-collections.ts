import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const configPath = join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const collections = ['reports', 'kunjungan_warga', 'data_keluarga', 'deleted_reports', 'pbb_sppt_2026', 'sppt_pbb', 'laporan_harian'];
  
  for (const col of collections) {
    try {
      const snap = await getDocs(collection(db, col));
      console.log(`Collection [${col}]: ${snap.size} documents`);
    } catch (e) {
      console.log(`Collection [${col}] failed to load:`, e);
    }
  }
}

main().catch(console.error);
