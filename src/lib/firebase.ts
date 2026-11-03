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
  
  // Enhanced initialization with Multi-Tab Persistent Cache for maximum speed
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
  }, dbId || '(default)');
  
  console.log('Firebase initialized with Persistent Cache on DB:', dbId || '(default)');
} catch (e) {
  console.error('Firebase initialization error:', e);
  // Fallback to basic if persistence fails
  db = getFirestore(app);
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
