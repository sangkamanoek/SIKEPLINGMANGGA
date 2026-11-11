
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function inspect() {
  console.log('Fetching Dasa Wisma samples...');
  try {
    const q = query(collection(db, 'pkk_dasa_wisma'), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log('No documents found in pkk_dasa_wisma');
      return;
    }
    const samples = [];
    snap.forEach(doc => {
      samples.push({ id: doc.id, ...doc.data() });
    });
    console.log(JSON.stringify(samples, null, 2));
  } catch (err) {
    console.error('Error fetching samples:', err);
  }
}

inspect();
