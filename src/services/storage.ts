import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  themeMode: 'rishta.themeMode.v1',
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
