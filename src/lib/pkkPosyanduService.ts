import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { PosyanduReport } from '../types';

const COLLECTION_NAME = 'pkk_posyandu_reports';

export const subscribePosyanduReports = (onUpdate: (items: PosyanduReport[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('tanggal', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as PosyanduReport[];
    onUpdate(items);
  });
};

export const savePosyanduReport = async (item: PosyanduReport) => {
  const docRef = doc(db, COLLECTION_NAME, item.id);
  const data = {
    ...item,
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, data, { merge: true });
};

export const deletePosyanduReport = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};
