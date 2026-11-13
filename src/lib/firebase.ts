import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any;
let db: any;

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
const isIframe = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  // Inside cross-origin iframes (preview/shared views) or restricted WebViews,
  // multi-tab IndexedDB locks can hang or fail; use memoryLocalCache (app already caches to IndexedDB/localStorage).
  db = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: isIframe
        ? memoryLocalCache()
        : persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
    },
    dbId
  );

  console.log('Firebase initialized on DB:', dbId, isIframe ? '(iframe memory cache)' : '(persistent cache)');
} catch (e) {
  console.warn('Primary Firestore init fallback, retrying with dbId:', dbId, e);
  try {
    db = initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache(),
      },
      dbId
    );
  } catch {
    // CRITICAL: Always pass dbId so we never accidentally fall back to missing '(default)' database
    db = getFirestore(app, dbId);
  }
}

async function testConnection() {
  if (typeof window === 'undefined' || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore offline: Please check your Firebase configuration or network.', error.message);
    }
  }
}
testConnection();

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
