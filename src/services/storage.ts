import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  users: 'rishta.users.v1',
  credentials: 'rishta.credentials.v1',
  session: 'rishta.session.v1',
  themeMode: 'rishta.themeMode.v1',
  notificationPrefs: 'rishta.notificationPrefs.v1',
  notificationFeed: 'rishta.notificationFeed.v1',
  matches: 'rishta.matches.v1',
  chatHistory: 'rishta.chatHistory.v1',
  favorites: 'rishta.favorites.v1',
  dailyLikes: 'rishta.dailyLikes.v1',
  privacyPrefs: 'rishta.privacyPrefs.v1',
  blockedUsers: 'rishta.blockedUsers.v1',
} as const;

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = { KEYS, getJSON, setJSON };
