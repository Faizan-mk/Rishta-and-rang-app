import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { db } from './firebase';

// ---------------------------------------------------------------------------
// Firestore layout
//
//   profiles/{uid}                        public member card — readable by any
//                                         signed-in user (the Firestore stand-in
//                                         for the old `discover_profiles` view)
//   users/{uid}/private/profile           email, wali contact
//   users/{uid}/private/verification      CNIC number + private media paths
//   users/{uid}/private/notificationPrefs
//   users/{uid}/private/privacyPrefs
//   users/{uid}/private/dailyLikes
//   users/{uid}/matches/{matchId}
//   users/{uid}/messages/{messageId}      chat messages, with a matchId field
//   users/{uid}/blocked/{blockedId}
//   users/{uid}/favorites/{targetId}
//   users/{uid}/viewHistory/{viewedId}
//   users/{uid}/notifications/{id}
//
// Everything under users/{uid} is owner-only; see firestore.rules.
// ---------------------------------------------------------------------------

export const PROFILES = 'profiles';

/** Subcollections under users/{uid} that deleteAccount has to clear out. */
export const USER_SUBCOLLECTIONS = [
  'private',
  'matches',
  'messages',
  'blocked',
  'favorites',
  'viewHistory',
  'notifications',
] as const;

export function profilesCollection(): CollectionReference {
  return collection(db, PROFILES);
}

export function profileDoc(uid: string): DocumentReference {
  return doc(db, PROFILES, uid);
}

export function userDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

export function userCollection(uid: string, name: (typeof USER_SUBCOLLECTIONS)[number]): CollectionReference {
  return collection(db, 'users', uid, name);
}

export function privateDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'private', 'profile');
}

export function verificationDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'private', 'verification');
}

export function notificationPrefsDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'private', 'notificationPrefs');
}

export function privacyPrefsDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'private', 'privacyPrefs');
}

export function dailyLikesDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'private', 'dailyLikes');
}

export function matchesCollection(uid: string): CollectionReference {
  return userCollection(uid, 'matches');
}

export function matchDoc(uid: string, matchId: string): DocumentReference {
  return doc(db, 'users', uid, 'matches', matchId);
}

export function messagesCollection(uid: string): CollectionReference {
  return userCollection(uid, 'messages');
}

export function blockedCollection(uid: string): CollectionReference {
  return userCollection(uid, 'blocked');
}

export function blockedDoc(uid: string, blockedId: string): DocumentReference {
  return doc(db, 'users', uid, 'blocked', blockedId);
}

export function favoritesCollection(uid: string): CollectionReference {
  return userCollection(uid, 'favorites');
}

export function favoriteDoc(uid: string, targetId: string): DocumentReference {
  return doc(db, 'users', uid, 'favorites', targetId);
}

export function viewHistoryCollection(uid: string): CollectionReference {
  return userCollection(uid, 'viewHistory');
}

export function viewHistoryDoc(uid: string, viewedId: string): DocumentReference {
  return doc(db, 'users', uid, 'viewHistory', viewedId);
}

export function notificationsCollection(uid: string): CollectionReference {
  return userCollection(uid, 'notifications');
}

export function notificationDoc(uid: string, id: string): DocumentReference {
  return doc(db, 'users', uid, 'notifications', id);
}
