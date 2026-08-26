import { deleteDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { viewHistoryCollection, viewHistoryDoc } from './firestorePaths';
import type { ViewedProfile } from '../types/content';

const MAX_HISTORY = 60;

interface ViewHistoryDoc {
  kind: ViewedProfile['kind'];
  name: string;
  age: number;
  city: string;
  photo: string;
  viewedAt: string;
}

function mapEntry(id: string, data: ViewHistoryDoc): ViewedProfile {
  return { id, kind: data.kind, name: data.name, age: data.age, city: data.city, photo: data.photo, viewedAt: data.viewedAt };
}

async function fetchHistory(profileId: string): Promise<ViewedProfile[]> {
  const snap = await getDocs(query(viewHistoryCollection(profileId), orderBy('viewedAt', 'desc'), limit(MAX_HISTORY)));
  return snap.docs.map((entry) => mapEntry(entry.id, entry.data() as ViewHistoryDoc));
}

async function recordView(profileId: string, profile: Omit<ViewedProfile, 'viewedAt'>): Promise<void> {
  // Doc id is the viewed profile's id, so re-viewing bumps the timestamp on the
  // existing entry instead of adding a duplicate.
  await setDoc(viewHistoryDoc(profileId, profile.id), {
    kind: profile.kind,
    name: profile.name,
    age: profile.age,
    city: profile.city,
    photo: profile.photo,
    viewedAt: new Date().toISOString(),
  } satisfies ViewHistoryDoc);

  // Trim anything past the newest MAX_HISTORY entries.
  const all = await getDocs(query(viewHistoryCollection(profileId), orderBy('viewedAt', 'desc')));
  const overflow = all.docs.slice(MAX_HISTORY);
  if (overflow.length) await Promise.all(overflow.map((entry) => deleteDoc(entry.ref)));
}

async function clearHistory(profileId: string): Promise<void> {
  const snap = await getDocs(viewHistoryCollection(profileId));
  await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref)));
}

export const viewHistoryService = { fetchHistory, recordView, clearHistory };
