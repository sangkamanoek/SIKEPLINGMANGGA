import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any;
let db: any;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = (firebaseConfig as any).firestoreDatabaseId
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
    : getFirestore(app);
} catch (e) {
  console.warn('Firebase init notice:', e);
}

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
}

export const handleFirestoreError = (error: any, _op?: any, _path?: string) => {
  console.warn('Firestore error handled:', error, _op, _path);
};

export const getAccessToken = async () => 'mock_token';

export { app, db };
