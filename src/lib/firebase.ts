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

const QUOTA_COOLDOWN_STORAGE_KEY = 'sikepling_firestore_quota_cooldown_until';
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit jeda saat kuota habis agar tidak membanjiri backend
let memoryQuotaCooldownUntil = 0;
let lastQuotaWarnTime = 0;

export const isQuotaExhaustedError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted')
  );
};

export const isFirestoreQuotaCooldownActive = (): boolean => {
  const now = Date.now();
  if (memoryQuotaCooldownUntil > now) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(QUOTA_COOLDOWN_STORAGE_KEY);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && until > now) {
          memoryQuotaCooldownUntil = until;
          return true;
        }
        sessionStorage.removeItem(QUOTA_COOLDOWN_STORAGE_KEY);
      }
    }
  } catch {}
  return false;
};

export const markFirestoreQuotaExhausted = (err?: any): void => {
  const now = Date.now();
  const until = now + QUOTA_COOLDOWN_MS;
  memoryQuotaCooldownUntil = until;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(QUOTA_COOLDOWN_STORAGE_KEY, String(until));
    }
  } catch {}

  if (now - lastQuotaWarnTime > 30000) {
    lastQuotaWarnTime = now;
    console.warn(
      '[Firestore Quota] Batas kuota harian Firestore tercapai (resource-exhausted). Mode hemat kuota & cache lokal aktif.',
      err?.message || ''
    );
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('firestore-quota-exceeded', {
          detail: {
            projectId: (firebaseConfig as any).projectId,
            databaseId: dbId,
            message: err?.message || 'Quota exceeded.',
          },
        })
      );
    }
  } catch {}
};

export const clearFirestoreQuotaCooldown = (): void => {
  memoryQuotaCooldownUntil = 0;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(QUOTA_COOLDOWN_STORAGE_KEY);
    }
  } catch {}
};

async function testConnection() {
  if (typeof window === 'undefined' || !db) return;
  if ((window as any).__sikeplingFirestoreConnChecked || isFirestoreQuotaCooldownActive()) return;
  (window as any).__sikeplingFirestoreConnChecked = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted(error);
      return;
    }
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
  if (isQuotaExhaustedError(error)) {
    markFirestoreQuotaExhausted(error);
    return;
  }
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
