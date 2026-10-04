import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('--- FETCHING REAL-TIME COUNTS FROM FIRESTORE ---');
  
  // Read firebase-applet-config.json
  const configPath = join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  
  try {
    // 1. Fetch Reports
    const reportsSnapshot = await getDocs(collection(db, 'reports'));
    const reportsCount = reportsSnapshot.size;
    
    let totalPerlinsosKk = 0;
    let totalBpjsTkOrang = 0;
    
    reportsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const kin = data.kinerja || {};
      totalPerlinsosKk += parseInt(String(kin.perlinsosKk || kin.perlinsos || 0), 10) || 0;
      totalBpjsTkOrang += parseInt(String(kin.bpjsKetenagakerjaanOrang || kin.bpjs || 0), 10) || 0;
    });
    
    // 2. Fetch Kunjungan Warga
    const kunjunganSnapshot = await getDocs(collection(db, 'kunjungan_warga'));
    const kunjunganCount = kunjunganSnapshot.size;
    
    // 3. Fetch Data Keluarga
    const keluargaSnapshot = await getDocs(collection(db, 'data_keluarga'));
    const keluargaCount = keluargaSnapshot.size;

    console.log('\n======================================');
    console.log(`📂 Jumlah Laporan Kepling: ${reportsCount} Laporan`);
    console.log(`📌 Jumlah Kunjungan Warga: ${kunjunganCount} Kunjungan`);
    console.log(`👪 Jumlah Database Keluarga: ${keluargaCount} KK`);
    console.log(`🛡️ Total Realisasi Perlinsos: ${totalPerlinsosKk} KK`);
    console.log(`💼 Total Realisasi BPJS TK: ${totalBpjsTkOrang} Orang`);
    console.log('======================================\n');
  } catch (err) {
    console.error('Error fetching Firestore data:', err);
  }
}

main().catch(console.error);
