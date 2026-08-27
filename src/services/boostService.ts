import { getDoc, setDoc } from 'firebase/firestore';
import { boostDoc } from './firestorePaths';

// A member's profile-boost wallet: how many boosts they still hold, and when the
// running one (if any) expires. Owner-only, like the daily-like counter.
interface BoostState {
  boostsLeft: number;
  // ISO timestamp, or null when no boost is running.
  activeUntil: string | null;
}

async function fetchState(profileId: string): Promise<BoostState | null> {
  const snap = await getDoc(boostDoc(profileId));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<BoostState>;
  return {
    boostsLeft: typeof data.boostsLeft === 'number' ? data.boostsLeft : 0,
    activeUntil: typeof data.activeUntil === 'string' ? data.activeUntil : null,
  };
}

async function setState(profileId: string, next: BoostState): Promise<void> {
  await setDoc(boostDoc(profileId), { boostsLeft: next.boostsLeft, activeUntil: next.activeUntil } satisfies BoostState);
}

export const boostService = { fetchState, setState };
export type { BoostState };
