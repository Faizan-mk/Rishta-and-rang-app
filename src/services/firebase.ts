import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length) {
  throw new Error(
    `Missing Firebase config (${missing.join(', ')}) — set the EXPO_PUBLIC_FIREBASE_* keys in .env and restart the dev server with \`npx expo start -c\`.`
  );
}

// getApps() guard: Fast Refresh re-runs this module, and initializeApp throws on
// a duplicate app name.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// On native, initializeAuth (not getAuth) is what lets us pin persistence to
// AsyncStorage; without it the session is memory-only and the user is signed
// out on every reload. It also throws if the auth instance already exists,
// hence the fallback.
//
// On web there is nothing to pin: Metro resolves firebase/auth's `browser`
// export there, which has no getReactNativePersistence at all, and getAuth
// already persists to indexedDB/localStorage.
function createAuth(): Auth {
  if (Platform.OS === 'web') return getAuth(firebaseApp);
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();

// React Native's networking stack doesn't play well with Firestore's default
// WebChannel transport; auto-detect falls back to long-polling when needed.
function createDb(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // Already started (Fast Refresh re-ran this module).
    return getFirestore(firebaseApp);
  }
}

export const db = createDb();

export const storage = getStorage(firebaseApp);
