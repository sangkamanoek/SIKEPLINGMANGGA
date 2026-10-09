import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json';
import fs from 'fs';
import path from 'path';

const app = initializeApp(cfg);
const db = getFirestore(app, (cfg as any).firestoreDatabaseId);

async function resetAllPbbStatus() {
  console.log('Starting reset of all PBB WP status to "Belum Bayar"...');
  const nowIso = new Date().toISOString();
  let totalUpdated = 0;

  const collectionsToCheck = [
    'pbb_sppt_2024',
    'pbb_sppt_2025',
    'pbb_sppt_2026',
    'pbb_sppt_2027',
    'pbb_sppt_2028',
    'pbb_sppt',
  ];

  for (const colName of collectionsToCheck) {
    console.log(`Checking collection ${colName}...`);
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);
    console.log(`Found ${snap.size} total docs in ${colName}`);

    const docsToReset: { id: string; ref: any }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.status !== 'Belum Bayar' || data.jumlahBayar) {
        docsToReset.push({ id: d.id, ref: d.ref });
      }
    });

    console.log(`Docs needing reset in ${colName}: ${docsToReset.length}`);

    // Commit in batches of 400 (Firestore limit is 500)
    for (let i = 0; i < docsToReset.length; i += 400) {
      const chunk = docsToReset.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.update(item.ref, {
          status: 'Belum Bayar',
          jumlahBayar: null,
          updatedAt: nowIso,
        });
      }
      await batch.commit();
      totalUpdated += chunk.length;
      console.log(`Committed chunk ${i + chunk.length}/${docsToReset.length} in ${colName}`);
    }
  }

  // Also update local data/pbb.json if present
  const DATA_DIR = path.join(process.cwd(), 'data');
  const PBB_FILE = path.join(DATA_DIR, 'pbb.json');
  if (fs.existsSync(PBB_FILE)) {
    try {
      const raw = fs.readFileSync(PBB_FILE, 'utf-8');
      const pbbData = JSON.parse(raw);
      for (const year of Object.keys(pbbData)) {
        if (Array.isArray(pbbData[year])) {
          pbbData[year] = pbbData[year].map((item: any) => ({
            ...item,
            status: 'Belum Bayar',
            jumlahBayar: null,
            updatedAt: nowIso,
          }));
        }
      }
      fs.writeFileSync(PBB_FILE, JSON.stringify(pbbData, null, 2), 'utf-8');
      console.log('Updated data/pbb.json server buffer file');
    } catch (e) {
      console.warn('Could not update pbb.json:', e);
    }
  }

  console.log(`FINISHED: Successfully reset ${totalUpdated} WP records to "Belum Bayar" in Firestore and server storage.`);
}

resetAllPbbStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during PBB reset:', err);
    process.exit(1);
  });
