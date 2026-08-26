// `getReactNativePersistence` exists at runtime only in firebase/auth's React
// Native build (@firebase/auth/dist/rn), which Metro resolves via the
// "react-native" export condition. TypeScript resolves types from the default
// browser entry instead, which doesn't declare it — so the import errors even
// though the function is there. This augmentation restores the type.
// See https://github.com/firebase/firebase-js-sdk/issues/9316
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
