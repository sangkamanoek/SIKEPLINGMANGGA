import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PBB_COLLECTION_PREFIX } from '../lib/pbbService';

export async function diagnosePbb(year: number) {
  console.log(`Diagnosing PBB data for year: ${year}...`);
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  try {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    console.log(`Found ${snapshot.size} documents in collection ${colName}`);
    if (snapshot.size > 0) {
      const firstDoc = snapshot.docs[0].data();
      console.log('Sample document data:', firstDoc);
    }
  } catch (err) {
    console.error(`Error diagnosing PBB for ${year}:`, err);
  }
}
