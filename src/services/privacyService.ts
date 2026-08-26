import { getDoc, setDoc } from 'firebase/firestore';
import { privacyPrefsDoc } from './firestorePaths';
import { DEFAULT_PRIVACY_PREFS, PrivacyPrefs } from '../types/content';

async function fetchPrefs(profileId: string): Promise<PrivacyPrefs> {
  const snap = await getDoc(privacyPrefsDoc(profileId));
  if (!snap.exists()) return DEFAULT_PRIVACY_PREFS;
  const data = snap.data() as Partial<PrivacyPrefs>;
  return { ...DEFAULT_PRIVACY_PREFS, ...data };
}

async function setPrefs(profileId: string, next: PrivacyPrefs): Promise<void> {
  await setDoc(privacyPrefsDoc(profileId), next);
}

export const privacyService = { fetchPrefs, setPrefs };
