import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PBB_COLLECTION_PREFIX } from '../lib/pbbService';

export async function diagnosePbb(year: number) {
  console.log(`[Diagnostic] Diagnosing PBB data for year: ${year}...`);
  const colName = `${PBB_COLLECTION_PREFIX}${year}`;
  try {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    console.log(`[Diagnostic] Found ${snapshot.size} documents in collection ${colName}`);
    
    snapshot.docs.slice(0, 10).forEach((docSnap, index) => {
      console.log(`[Diagnostic] Doc ${index + 1} (${docSnap.id}):`, docSnap.data());
    });
    
    if (snapshot.size === 0) {
        console.warn(`[Diagnostic] Collection ${colName} is empty! Check Firebase Console.`);
    }
  } catch (err) {
    console.error(`[Diagnostic] Error reading PBB for ${year}:`, err);
  }
}
