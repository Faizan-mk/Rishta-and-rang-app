import AsyncStorage from '@react-native-async-storage/async-storage';
import { cache, CACHE_KEYS } from '../cache';

// Stale-while-revalidate read-through cache over AsyncStorage, namespaced per
// user so a second account on the same device never reads the first one's data.

const USER_A = 'user-a';
const USER_B = 'user-b';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cache.write / cache.read', () => {
  it('round-trips a written value', async () => {
    await cache.write(USER_A, CACHE_KEYS.profile, { name: 'Ayesha' });
    const value = await cache.read<{ name: string }>(USER_A, CACHE_KEYS.profile);
    expect(value).toEqual({ name: 'Ayesha' });
  });

  it('returns null on a miss', async () => {
    const value = await cache.read(USER_A, CACHE_KEYS.profile);
    expect(value).toBeNull();
  });

  it('keeps different users apart under the same key', async () => {
    await cache.write(USER_A, CACHE_KEYS.matches, ['a-match']);
    await cache.write(USER_B, CACHE_KEYS.matches, ['b-match']);
    expect(await cache.read(USER_A, CACHE_KEYS.matches)).toEqual(['a-match']);
    expect(await cache.read(USER_B, CACHE_KEYS.matches)).toEqual(['b-match']);
  });

  it('treats an entry older than maxAgeMs as a miss', async () => {
    const realNow = Date.now;
    Date.now = jest.fn(() => 1_000_000);
    await cache.write(USER_A, CACHE_KEYS.favorites, ['fav-1']);
    Date.now = jest.fn(() => 1_000_000 + 5000);

    const fresh = await cache.read(USER_A, CACHE_KEYS.favorites, 10_000);
    expect(fresh).toEqual(['fav-1']);

    const stale = await cache.read(USER_A, CACHE_KEYS.favorites, 1000);
    expect(stale).toBeNull();

    Date.now = realNow;
  });

  it('returns null rather than throwing on unreadable JSON', async () => {
    await AsyncStorage.setItem('rishta.cache.v1.user-a.profile', 'not json{{');
    const value = await cache.read(USER_A, CACHE_KEYS.profile);
    expect(value).toBeNull();
  });

  it('does not throw when AsyncStorage.setItem rejects', async () => {
    // AsyncStorage's own jest mock is already a `jest.fn()`, so `jest.spyOn` returns
    // that same instance rather than wrapping it — calling `.mockRestore()` on it
    // would wipe its real (store-backed) implementation for the rest of the file.
    // `mockRejectedValueOnce` self-expires after one call, so no restore is needed.
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(cache.write(USER_A, CACHE_KEYS.profile, { name: 'x' })).resolves.toBeUndefined();
  });
});

describe('cache.clearUser', () => {
  it('removes only the target user entries', async () => {
    await cache.write(USER_A, CACHE_KEYS.profile, { a: 1 });
    await cache.write(USER_A, CACHE_KEYS.matches, { a: 1 });
    await cache.write(USER_B, CACHE_KEYS.profile, { b: 1 });

    await cache.clearUser(USER_A);

    expect(await cache.read(USER_A, CACHE_KEYS.profile)).toBeNull();
    expect(await cache.read(USER_A, CACHE_KEYS.matches)).toBeNull();
    expect(await cache.read(USER_B, CACHE_KEYS.profile)).toEqual({ b: 1 });
  });

  it('does nothing, and does not throw, when the user has no cached entries', async () => {
    await expect(cache.clearUser('nobody')).resolves.toBeUndefined();
  });
});
