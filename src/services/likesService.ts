import { deleteDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { likeReceivedDoc, likesReceivedCollection } from './firestorePaths';
import type { ProfileMode } from '../types/user';

// ---------------------------------------------------------------------------
// "See who liked you" — the paid half of Explore+.
//
// A member's own favourites live under users/{me}/favorites, which nobody else
// can read. So a like is mirrored onto the *target*: users/{target}/likesReceived/{me}.
// Firestore rules let the liker create and delete only their own doc there, and
// let only the owner read the collection (see firestore.rules).
//
// The card details are denormalised into the doc — all of it is public profile
// data anyway — so the list renders without a second lookup per liker.
// ---------------------------------------------------------------------------

export interface LikeReceived {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  likedAt: string;
}

interface LikeReceivedDoc {
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  createdAt: string;
}

async function fetchLikesReceived(profileId: string): Promise<LikeReceived[]> {
  const snap = await getDocs(query(likesReceivedCollection(profileId), orderBy('createdAt', 'desc')));
  return snap.docs.map((entry) => {
    const data = entry.data() as LikeReceivedDoc;
    return {
      id: entry.id,
      kind: data.kind,
      name: data.name,
      age: data.age,
      city: data.city,
      photo: data.photo,
      likedAt: data.createdAt,
    };
  });
}

async function sendLike(targetId: string, liker: Omit<LikeReceived, 'likedAt'>): Promise<void> {
  await setDoc(likeReceivedDoc(targetId, liker.id), {
    kind: liker.kind,
    name: liker.name,
    age: liker.age,
    city: liker.city,
    photo: liker.photo,
    createdAt: new Date().toISOString(),
  } satisfies LikeReceivedDoc);
}

async function withdrawLike(targetId: string, likerId: string): Promise<void> {
  await deleteDoc(likeReceivedDoc(targetId, likerId));
}

export const likesService = { fetchLikesReceived, sendLike, withdrawLike };
