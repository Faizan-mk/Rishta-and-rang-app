import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Push registration.
//
// Scaffolding, not a working notification pipeline: this gets a device address
// and stores it, so that something can be sent later. Nothing sends yet — the
// `send-push` Edge Function (supabase/functions/send-push) is invoked by hand
// until Day 5-6 makes new-match / new-message / new-like real server-side
// events with somewhere to hang a trigger.
//
// Two things that will bite on a real device:
//   · Remote push does not work in Expo Go on SDK 53+. It needs a development
//     build or a store build.
//   · Android needs FCM credentials configured on the EAS project, or Expo has
//     no way to reach the device.
// ---------------------------------------------------------------------------

/** Foreground behaviour. Without this a notification arriving while the app is open is silent. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The EAS project id Expo signs the push token against. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    // Bare/dev-client builds read it from the manifest instead.
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Asks for permission and returns this device's Expo push token, or null.
 *
 * Null is an ordinary outcome, not an error: a simulator has no push hardware,
 * and a member is entitled to say no. Callers carry on either way — the app
 * works without notifications.
 */
export async function requestPushToken(): Promise<string | null> {
  // The emulator has no notification hardware; asking there returns a token
  // that can never be delivered to.
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Android will not display anything without a channel to display it in.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  // Only prompt if they have not already answered — re-asking a "no" does
  // nothing on iOS and is rude on Android.
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const id = projectId();
  if (!id) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data;
  } catch {
    // No FCM credentials on the project, no network, or a token service that
    // is having a bad day. None of it should stop the app loading.
    return null;
  }
}

/** What the device is, for debugging "why did only the iPhones miss it". */
function deviceInfo(): Record<string, unknown> {
  return {
    platform: Platform.OS,
    osVersion: Device.osVersion ?? null,
    model: Device.modelName ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}

/**
 * Stores this device's token against the signed-in member.
 *
 * Goes through the `register_push_token` RPC rather than a plain upsert: the
 * token is unique table-wide, so a device that changes hands has to move to the
 * new account, and the client cannot write over a row it does not own.
 */
export async function registerPushToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_device_info: deviceInfo(),
  });
  if (error) throw new Error(error.message);
}

/** Drops this device on sign-out, so the next person here is not sent their mail. */
export async function unregisterPushToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
  if (error) throw new Error(error.message);
}

export const pushService = { requestPushToken, registerPushToken, unregisterPushToken };
