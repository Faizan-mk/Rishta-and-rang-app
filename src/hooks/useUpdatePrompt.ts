import { useEffect, useRef } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import { useDialog } from '../store/DialogContext';
import { useLanguage } from '../store/LanguageContext';

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

/**
 * Tells the member when a newer build is on Play (supabase/75_app_version.sql),
 * without adding a library: the app's own dialog, and "Update now" opens
 * Lovebirds in the Play Store.
 *
 * Checked when the app opens and each time it comes back to the foreground.
 * "Later" holds it off for the rest of this visit; it comes back on the next
 * open until they've updated, and stops by itself once the installed build is
 * the latest. Below min_version_code there is no "Later".
 *
 * Android only, and not in development builds, where the version means nothing.
 */
export function useUpdatePrompt(): void {
  const { confirm, notify } = useDialog();
  const { t } = useLanguage();
  const showing = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || __DEV__) return;
    const installed = installedVersionCode();
    if (installed === null) return;

    const check = async () => {
      if (showing.current) return;
      const { data, error } = await supabase
        .from('app_version')
        .select('latest_version_code, min_version_code')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return;
      const row = data as { latest_version_code: number; min_version_code: number };

      if (installed < row.min_version_code) {
        showing.current = true;
        await notify({
          title: t('update.title'),
          message: t('update.requiredBody'),
          confirmLabel: t('update.now'),
        });
        showing.current = false;
        await openPlayStore();
        return;
      }

      if (installed < row.latest_version_code && !dismissed.current) {
        showing.current = true;
        const update = await confirm({
          title: t('update.title'),
          message: t('update.body'),
          confirmLabel: t('update.now'),
          cancelLabel: t('update.later'),
        });
        showing.current = false;
        if (update) await openPlayStore();
        else dismissed.current = true;
      }
    };

    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
