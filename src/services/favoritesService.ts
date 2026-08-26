import { deleteDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { favoriteDoc, favoritesCollection } from './firestorePaths';
import type { FavoriteProfile } from '../types/content';

interface FavoriteDoc {
  kind: FavoriteProfile['kind'];
  name: string;
  age: number;
  city: string;
  photo: string;
  createdAt: string;
}

function mapFavorite(id: string, data: FavoriteDoc): FavoriteProfile {
  return { id, kind: data.kind, name: data.name, age: data.age, city: data.city, photo: data.photo };
}

async function fetchFavorites(profileId: string): Promise<FavoriteProfile[]> {
  const snap = await getDocs(query(favoritesCollection(profileId), orderBy('createdAt', 'desc')));
  return snap.docs.map((entry) => mapFavorite(entry.id, entry.data() as FavoriteDoc));
}

async function addFavorite(profileId: string, profile: FavoriteProfile): Promise<void> {
  // Doc id is the target's id, so favouriting twice overwrites rather than
  // stacking duplicates.
  await setDoc(favoriteDoc(profileId, profile.id), {
    kind: profile.kind,
    name: profile.name,
    age: profile.age,
    city: profile.city,
    photo: profile.photo,
    createdAt: new Date().toISOString(),
  } satisfies FavoriteDoc);
}

async function removeFavorite(profileId: string, targetId: string): Promise<void> {
  await deleteDoc(favoriteDoc(profileId, targetId));
}

export const favoritesService = { fetchFavorites, addFavorite, removeFavorite };
