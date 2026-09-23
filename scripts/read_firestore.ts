import { db } from '../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function readKunjunganWarga() {
  try {
    const querySnapshot = await getDocs(collection(db, 'kunjungan_warga'));
    const data: any[] = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error reading data:', error);
  }
}

readKunjunganWarga();
