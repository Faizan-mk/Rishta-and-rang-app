import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Per-user read-through cache over AsyncStorage.
//
// The pattern everywhere it's used is stale-while-revalidate: a screen renders
// whatever the last session saved — instantly, with no network — while the live
// Firestore fetch runs behind it and replaces the data once it lands. Without
// this, every sign-in re-downloads the whole profile, deck, match list and
// favourites before anything can render.
//
// Chat messages deliberately do NOT go through here. They're already on a live
// onSnapshot listener, and a cached copy would leave stale messages on screen
// until the stream caught up.
//
// Keys are namespaced by user id so a second account on the same device never
// reads the first one's data, and `clearUser` wipes the lot on logout.
// ---------------------------------------------------------------------------

const PREFIX = 'rishta.cache.v1';

/** Anything older than this is treated as a miss and refetched cold. */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const CACHE_KEYS = {
  profile: 'profile',
  discoverDeck: 'discoverDeck',
  rishtaDeck: 'rishtaDeck',
  matches: 'matches',
  blocked: 'blocked',
  favorites: 'favorites',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

interface Envelope<T> {
  savedAt: number;
  data: T;
}

function storageKey(userId: string, key: CacheKey): string {
  return `${PREFIX}.${userId}.${key}`;
}

/**
 * Last saved value for this user, or null on a miss, a stale entry, or unreadable
 * JSON. Never throws — a broken cache must not be able to break a screen.
 */
async function read<T>(userId: string, key: CacheKey, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId, key));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (typeof envelope?.savedAt !== 'number') return null;
    if (Date.now() - envelope.savedAt > maxAgeMs) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

/** Fire-and-forget write. A failure here costs a slower next launch, nothing more. */
async function write<T>(userId: string, key: CacheKey, data: T): Promise<void> {
  try {
    const envelope: Envelope<T> = { savedAt: Date.now(), data };
    await AsyncStorage.setItem(storageKey(userId, key), JSON.stringify(envelope));
  } catch {
    // ignored on purpose
  }
}

/** Drops everything cached for one user. Called on logout and account deletion. */
async function clearUser(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(`${PREFIX}.${userId}.`));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // ignored on purpose
  }
}

export const cache = { read, write, clearUser };
