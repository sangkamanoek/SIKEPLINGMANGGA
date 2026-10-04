import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function testFetch() {
  const q = query(collection(db, 'reports'), limit(5));
  const snap = await getDocs(q);
  snap.forEach(d => console.log(JSON.stringify(d.data())));
}

testFetch().catch(console.error);
