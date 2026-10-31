import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any;
let db: any;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  
  if (typeof window !== 'undefined') {
    try {
      db = initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        dbId || '(default)'
      );
    } catch (cacheErr) {
      console.warn('Persistent cache fallback to getFirestore:', cacheErr);
      db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  } else {
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
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


export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};


export const getAccessToken = async () => 'mock_token';

export { app, db };
