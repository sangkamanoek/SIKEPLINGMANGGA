import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function reset() {
  console.log('Resetting Firestore data...');
  
  // 1. Reset reports collection
  const reportsCol = collection(db, 'reports');
  const snap = await getDocs(reportsCol);
  console.log(`Found ${snap.docs.length} documents in 'reports' collection.`);
  for (const d of snap.docs) {
    console.log(`Deleting doc in reports: ${d.id}`);
    await deleteDoc(d.ref);
  }

  // 2. Reset any reports in SIKEPLINGMANGGA collection
  const sikeplingCol = collection(db, 'SIKEPLINGMANGGA');
  const snap2 = await getDocs(sikeplingCol);
  console.log(`Found ${snap2.docs.length} documents in 'SIKEPLINGMANGGA' collection.`);
  for (const d of snap2.docs) {
    if (d.id === 'info' || d.id === 'targets') {
      console.log(`Keeping meta doc: ${d.id}`);
      continue;
    }
    console.log(`Deleting doc in SIKEPLINGMANGGA: ${d.id}`);
    await deleteDoc(d.ref);
  }

  // 3. Reset local data/reports.json
  const reportsJsonPath = path.join(process.cwd(), 'data', 'reports.json');
  if (fs.existsSync(reportsJsonPath)) {
    fs.writeFileSync(reportsJsonPath, JSON.stringify([], null, 2), 'utf8');
    console.log('Emptied data/reports.json successfully.');
  }

  console.log('Reset completed successfully!');
  process.exit(0);
}

reset().catch((err) => {
  console.error('Reset error:', err);
  process.exit(1);
});
