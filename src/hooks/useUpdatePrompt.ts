import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';

const PLAY_APP = 'market://details?id=com.rishtaandrang.app';
const PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.rishtaandrang.app';

/** This build's Android versionCode (written into the app at build time). */
function installedVersionCode(): number | null {
  const code = Constants.expoConfig?.android?.versionCode;
  return typeof code === 'number' ? code : null;
}

async function openPlayStore(): Promise<void> {
  // Let the dialog finish closing first: launching another app while a modal
  // is still animating out can be dropped on Android.
  await new Promise((resolve) => setTimeout(resolve, 350));
  // The play.google.com link, not market://: any store can claim market://
  // (Infinix/Tecno phones send it to their own Palm Store), while Google Play
  // is the app verified to open play.google.com links.
  try {
    await Linking.openURL(PLAY_WEB);
  } catch {
    await Linking.openURL(PLAY_APP).catch(() => undefined);
  }
}

export interface UpdatePromptState {
  visible: boolean;
  /** Below min_version_code: no "Not now", no close. */
  required: boolean;
  update: () => void;
  later: () => void;
}

/**
 * Whether to ask the member to update (supabase/75_app_version.sql): the
 * app's own Android versionCode against the build on Play. Rendered by
 * UpdatePrompt on Home only, so it never covers sign-in or the splash.
 *
 * Checked when Home mounts and each time the app comes back to the
 * foreground. "Not now" holds it off for the rest of this visit; it comes
 * back on the next open until they've updated, and stops by itself once the
 * installed build is the latest. Below min_version_code there is no way past it.
 *
 * Android only, and not in development builds, where the version means nothing.
 */
export function useUpdatePrompt(): UpdatePromptState {
  const [visible, setVisible] = useState(false);
  const [required, setRequired] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || __DEV__) return;
    const installed = installedVersionCode();
    if (installed === null) return;

    const check = async () => {
      const { data, error } = await supabase
        .from('app_version')
        .select('latest_version_code, min_version_code')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return;
      const row = data as { latest_version_code: number; min_version_code: number };
      if (installed < row.min_version_code) {
        setRequired(true);
        setVisible(true);
      } else if (installed < row.latest_version_code && !dismissed.current) {
        setRequired(false);
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, []);

  const update = useCallback(() => {
    // A required update stays up; it's checked again when they come back.
    if (!required) setVisible(false);
    void openPlayStore();
  }, [required]);

  const later = useCallback(() => {
    if (required) return;
    dismissed.current = true;
    setVisible(false);
  }, [required]);

  return { visible, required, update, later };
}
