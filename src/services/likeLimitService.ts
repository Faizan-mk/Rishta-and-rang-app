import { getDoc, setDoc } from 'firebase/firestore';
import { dailyLikesDoc } from './firestorePaths';

interface DailyLikeState {
  date: string;
  count: number;
}

async function fetchState(profileId: string): Promise<DailyLikeState | null> {
  const snap = await getDoc(dailyLikesDoc(profileId));
  if (!snap.exists()) return null;
  const data = snap.data() as DailyLikeState;
  return { date: data.date, count: data.count };
}

async function setState(profileId: string, next: DailyLikeState): Promise<void> {
  await setDoc(dailyLikesDoc(profileId), { date: next.date, count: next.count } satisfies DailyLikeState);
}

export const likeLimitService = { fetchState, setState };
export type { DailyLikeState };
