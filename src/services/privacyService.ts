import { supabase } from './supabase';
import { DEFAULT_PRIVACY_PREFS, PrivacyPrefs } from '../types/content';

interface PrivacyPrefsRow {
  profile_visible: boolean;
  online_status_visible: boolean;
  blur_photos: boolean;
}

function mapPrefs(row: PrivacyPrefsRow | null): PrivacyPrefs {
  if (!row) return DEFAULT_PRIVACY_PREFS;
  return { profileVisible: row.profile_visible, onlineStatusVisible: row.online_status_visible, blurPhotos: row.blur_photos };
}

async function fetchPrefs(profileId: string): Promise<PrivacyPrefs> {
  const { data, error } = await supabase
    .from('privacy_prefs')
    .select('profile_visible, online_status_visible, blur_photos')
    .eq('profile_id', profileId)
    .maybeSingle<PrivacyPrefsRow>();
  if (error) throw error;
  return mapPrefs(data);
}

async function setPrefs(profileId: string, next: PrivacyPrefs): Promise<void> {
  const { error } = await supabase.from('privacy_prefs').upsert(
    {
      profile_id: profileId,
      profile_visible: next.profileVisible,
      online_status_visible: next.onlineStatusVisible,
      blur_photos: next.blurPhotos,
    },
    { onConflict: 'profile_id' }
  );
  if (error) throw error;
}

export const privacyService = { fetchPrefs, setPrefs };
