import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Push registration.
//
// Registration plus the moments that fire one. The device address is
// stored here; the sending itself is the `send-push` Edge Function
// (supabase/functions/send-push), which the notify helpers below call.
//
// The helpers deliberately send almost nothing: an event and the match or
// person it hangs off. Who receives it, and what the title says, are decided
// inside the function from a relationship the caller demonstrably has — a
// member cannot address a stranger or sign a notification with someone else's
// name.
//
// Two things that will bite on a real device:
//   · Remote push does not work in Expo Go on SDK 53+. It needs a development
//     build or a store build.
//   · Android needs FCM credentials on the EAS project, and the Firebase config
//     in the build (app.json `googleServicesFile`), or Expo cannot reach the
//     device at all.
// ---------------------------------------------------------------------------

/**
 * True inside Expo Go.
 *
 * This matters more than it looks. On SDK 53+ merely *importing*
 * `expo-notifications` in Expo Go throws a red error at startup, because the
 * module registers a push-token listener as an import side effect. That would
 * greet anyone opening the app in Expo Go — including someone doing an
 * unrelated Urdu/RTL pass — with a stack trace about a feature they never
 * touched. So the module is loaded lazily, behind this check, and Expo Go never
 * pulls it in.
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

type NotificationsModule = typeof import('expo-notifications');

let notifications: NotificationsModule | null = null;

/** Loads expo-notifications on first use, and configures it once. */
function loadNotifications(): NotificationsModule | null {
  if (isExpoGo()) return null;
  if (notifications) return notifications;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-notifications') as NotificationsModule;

  // Foreground behaviour. Without this, a notification arriving while the app
  // is open is silent.
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notifications = mod;
  return mod;
}

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
  // Every `return null` below is an ordinary outcome the app carries on from,
  // which is exactly why each one says which it was: "no token" with no reason
  // attached is undiagnosable, and the causes need different fixes.
  const giveUp = (reason: string): null => {
    if (__DEV__) console.warn(`[push] no token: ${reason}`);
    return null;
  };

  if (isExpoGo()) return giveUp('running in Expo Go — needs a development build');

  // The emulator has no notification hardware; asking there returns a token
  // that can never be delivered to.
  if (!Device.isDevice) return giveUp('not a physical device');

  const Notifications = loadNotifications();
  if (!Notifications) return giveUp('expo-notifications unavailable');

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
  if (status !== 'granted') return giveUp(`permission ${status}`);

  const id = projectId();
  if (!id) return giveUp('no EAS projectId in app config');

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (__DEV__) console.log('[push] token acquired:', token.data);
    return token.data;
  } catch (e) {
    // Most often: no FCM credentials on the EAS project, so Expo has no way to
    // reach an Android device. Also no network, or a token service having a bad
    // day. None of it should stop the app loading.
    return giveUp(e instanceof Error ? e.message : String(e));
  }
}

/**
 * What `send-push` puts in a notification's `data`, for the app to route on.
 *
 * Every field is optional because it arrives off the wire: a notification sent
 * by hand from curl, or by an older build, carries whatever it carries. The
 * router treats anything it does not recognise as "just open the app".
 */
export interface PushRouting {
  event?: string;
  matchId?: string;
}

function routingOf(data: unknown): PushRouting {
  if (!data || typeof data !== 'object') return {};
  const { event, matchId } = data as Record<string, unknown>;
  return {
    event: typeof event === 'string' ? event : undefined,
    matchId: typeof matchId === 'string' ? matchId : undefined,
  };
}

/**
 * Calls back when a member taps one of our notifications while the app is
 * running (foreground or backgrounded). Returns its own unsubscribe.
 */
function onNotificationTap(handler: (routing: PushRouting) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(routingOf(response.notification.request.content.data));
  });
  return () => subscription.remove();
}

/**
 * The tap that launched the app, when that is how it was opened.
 *
 * A killed app is not listening when the tap happens, so the response is not
 * delivered to a listener at all — it is waiting here instead. Without this, a
 * push that wakes a closed app drops the member on whatever screen they left,
 * which is the case the notification exists for.
 */
async function initialNotificationTap(): Promise<PushRouting | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  return routingOf(response.notification.request.content.data);
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

/**
 * Fires one notification at the other side of a relationship.
 *
 * Never throws: a push that does not go out must not take the message, like or
 * request that prompted it down with it. The caller has already succeeded by
 * the time this runs.
 */
async function notify(body: Record<string, unknown>): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', { body });
  } catch (e) {
    if (__DEV__) console.warn('[push] send failed:', e);
  }
}

/** `preview` is the message's own text; a photo or voice note simply has none. */
function notifyMessage(matchId: string, preview?: string): Promise<void> {
  return notify({ event: 'message', matchId, preview });
}

function notifyRishtaRequest(matchId: string): Promise<void> {
  return notify({ event: 'rishta_request', matchId });
}

/**
 * The answer to a request, sent by the person who answered it.
 *
 * The requester is the one side of the handshake that has nothing on screen to
 * tell it: their `mode` flips (or their pending bar clears) under them, from a
 * write they did not make. The in-app row is written by `respond_rishta` itself
 * (supabase/32_rishta_notifications.sql); this is the half that reaches a phone
 * that is not open.
 */
function notifyRishtaAccepted(matchId: string): Promise<void> {
  return notify({ event: 'rishta_accepted', matchId });
}

function notifyRishtaDeclined(matchId: string): Promise<void> {
  return notify({ event: 'rishta_declined', matchId });
}

function notifyLike(targetId: string): Promise<void> {
  return notify({ event: 'like', targetId });
}

function notifyMatch(targetId: string): Promise<void> {
  return notify({ event: 'match', targetId });
}

export const pushService = {
  requestPushToken,
  registerPushToken,
  unregisterPushToken,
  onNotificationTap,
  initialNotificationTap,
  notifyMessage,
  notifyRishtaRequest,
  notifyRishtaAccepted,
  notifyRishtaDeclined,
  notifyLike,
  notifyMatch,
};
