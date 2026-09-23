import { db } from '../src/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function wipeAllReports() {
  try {
    const querySnapshot = await getDocs(collection(db, 'kunjungan_warga'));
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, 'kunjungan_warga', document.id)));
    });
    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${deletePromises.length} reports.`);
  } catch (error) {
    console.error('Error wiping reports:', error);
  }
}

wipeAllReports();
