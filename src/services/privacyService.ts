import { supabase } from './supabase';
import { DEFAULT_PRIVACY_PREFS, PrivacyPrefs } from '../types/content';

interface PrivacyPrefsRow {
  profile_visible: boolean;
  online_status_visible: boolean;
  blur_photos: boolean;
}

async function fetchPrefs(profileId: string): Promise<PrivacyPrefs> {
  const { data, error } = await supabase
    .from('privacy_prefs')
    .select('profile_visible, online_status_visible, blur_photos')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PRIVACY_PREFS;
  const row = data as unknown as PrivacyPrefsRow;
  return {
    profileVisible: row.profile_visible ?? DEFAULT_PRIVACY_PREFS.profileVisible,
    onlineStatusVisible: row.online_status_visible ?? DEFAULT_PRIVACY_PREFS.onlineStatusVisible,
    blurPhotos: row.blur_photos ?? DEFAULT_PRIVACY_PREFS.blurPhotos,
  };
}

async function setPrefs(profileId: string, next: PrivacyPrefs): Promise<void> {
  const { error } = await supabase.from('privacy_prefs').upsert(
    {
      id: profileId,
      profile_visible: next.profileVisible,
      online_status_visible: next.onlineStatusVisible,
      blur_photos: next.blurPhotos,
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export const privacyService = { fetchPrefs, setPrefs };