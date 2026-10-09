import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  Firestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Flexible config: use environment variables if provided in Vercel, fallback to bundled config
const rawConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || (firebaseConfig as any).apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || (firebaseConfig as any).authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (firebaseConfig as any).projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || (firebaseConfig as any).storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || (firebaseConfig as any).messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || (firebaseConfig as any).appId,
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || (firebaseConfig as any).measurementId,
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) || (firebaseConfig as any).databaseURL,
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || (firebaseConfig as any).firestoreDatabaseId,
};

// Check if Firebase is legitimately configured
export const isFirebaseConfigured = !!(rawConfig.projectId && rawConfig.apiKey);

// If not configured, use syntactically valid dummy values to prevent startup crashes
// while forcing 100% stable local-only fallback mode.
const activeConfig = isFirebaseConfigured ? rawConfig : {
  apiKey: "AIzaSyDummyKeyForOfflineMode1234567890",
  authDomain: "offline-mode.firebaseapp.com",
  projectId: "offline-mode-dummy-project",
  storageBucket: "offline-mode.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:dummyappid123456",
  measurementId: "G-DUMMY123",
  firestoreDatabaseId: undefined,
};

const app = !getApps().length ? initializeApp(activeConfig) : getApp();
export const auth = getAuth(app);

// Suppress transient backend offline and quota connection logs in console
try {
  setLogLevel('silent');
} catch {}

let firestoreInstance: Firestore;

try {
  // Initialize Firestore with persistent cache for better offline support and speed.
  firestoreInstance = activeConfig.firestoreDatabaseId
    ? initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        activeConfig.firestoreDatabaseId
      )
    : initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        }
      );
} catch (e) {
  console.warn('initializeFirestore failed, falling back to standard getFirestore:', e);
  try {
    firestoreInstance = activeConfig.firestoreDatabaseId
      ? getFirestore(app, activeConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch {
    firestoreInstance = getFirestore(app);
  }
}

export const db: Firestore = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  if (errStr.includes('resource-exhausted') || errStr.includes('Quota exceeded') || errStr.includes('unavailable')) {
    console.warn('Firestore Quota/Network Warning (falling back to local buffer):', errStr);
    return; // Don't throw fatal error for quota exhaustion, allow graceful fallback
  }
  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error:', jsonError);
  throw new Error(jsonError);
}

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
});

const CACHE_KEY = 'google_cached_access_token';

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch (e) {
    return null;
  }
})();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || localStorage.getItem(CACHE_KEY);
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        // Need to obtain an access token via interactive sign-in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      const token = cachedAccessToken || localStorage.getItem(CACHE_KEY);
      if (!token) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(CACHE_KEY, credential.accessToken);
    } catch (e) {
      console.warn('Could not save access token to storage:', e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = localStorage.getItem(CACHE_KEY);
    } catch (e) {}
  }
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(CACHE_KEY, token);
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch (e) {}
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {}
};
