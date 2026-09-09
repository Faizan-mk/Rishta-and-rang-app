import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('storage.getJSON', () => {
  it('returns the fallback when nothing is stored', async () => {
    const value = await storage.getJSON(storage.KEYS.themeMode, 'system');
    expect(value).toBe('system');
  });

  it('parses back a previously stored value', async () => {
    await storage.setJSON(storage.KEYS.themeMode, 'dark');
    expect(await storage.getJSON(storage.KEYS.themeMode, 'system')).toBe('dark');
  });

  it('falls back on unparseable stored JSON rather than throwing', async () => {
    await AsyncStorage.setItem(storage.KEYS.themeMode, 'not-json{{');
    expect(await storage.getJSON(storage.KEYS.themeMode, 'system')).toBe('system');
  });

  it('round-trips an object value', async () => {
    await storage.setJSON('custom-key', { a: 1, b: [1, 2, 3] });
    expect(await storage.getJSON('custom-key', null)).toEqual({ a: 1, b: [1, 2, 3] });
  });
});
