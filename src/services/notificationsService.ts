import { supabase } from './supabase';
import { DEFAULT_NOTIFICATION_PREFS, NotificationItem, NotificationPrefs } from '../types/content';

interface NotificationRow {
  id: string;
  type: NotificationItem['type'];
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  match_id: string | null;
}

/** A `notifications` row (snake_case, from PostgreSQL/Realtime) → NotificationItem. */
export function rowToNotification(row: Record<string, unknown>): NotificationItem {
  return {
    id: String(row.id),
    type: row.type as NotificationItem['type'],
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    read: Boolean(row.read),
    matchId: row.match_id ? String(row.match_id) : undefined,
  };
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: row.read,
    matchId: row.match_id ?? undefined,
  };
}

const NOTIFICATION_SELECT = 'id, type, title, body, created_at, read, match_id';

async function fetchFeed(profileId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapNotification(row as unknown as NotificationRow));
}

interface NotificationPrefsRow {
  new_matches: boolean | null;
  messages: boolean | null;
  likes: boolean | null;
  rishta_requests: boolean | null;
  product_updates: boolean | null;
}

async function fetchPrefs(profileId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('new_matches, messages, likes, rishta_requests, product_updates')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_NOTIFICATION_PREFS;
  const row = data as unknown as NotificationPrefsRow;
  return {
    newMatches: row.new_matches ?? DEFAULT_NOTIFICATION_PREFS.newMatches,
    messages: row.messages ?? DEFAULT_NOTIFICATION_PREFS.messages,
    likes: row.likes ?? DEFAULT_NOTIFICATION_PREFS.likes,
    rishtaRequests: row.rishta_requests ?? DEFAULT_NOTIFICATION_PREFS.rishtaRequests,
    productUpdates: row.product_updates ?? DEFAULT_NOTIFICATION_PREFS.productUpdates,
  };
}

async function setPref(profileId: string, next: NotificationPrefs): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      id: profileId,
      new_matches: next.newMatches,
      messages: next.messages,
      likes: next.likes,
      rishta_requests: next.rishtaRequests,
      product_updates: next.productUpdates,
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

async function addNotification(
  profileId: string,
  type: NotificationItem['type'],
  title: string,
  body: string
): Promise<NotificationItem> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ profile_id: profileId, type, title, body, created_at: new Date().toISOString(), read: false })
    .select(NOTIFICATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapNotification(data as unknown as NotificationRow);
}

async function markAllRead(profileId: string): Promise<void> {
  // A single "update ... where read = false" replaces the per-document batch
  // the Supabase version needed.
  await supabase.from('notifications').update({ read: true }).eq('profile_id', profileId).eq('read', false);
}

async function markRead(profileId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('profile_id', profileId)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Reading a thread reads whatever it was ever notified about, too — a
 * "X sent you a message" row a member already saw in the chat itself should
 * not still be sitting there unread the next time they open Notifications.
 */
async function markReadByMatch(profileId: string, matchId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('profile_id', profileId)
    .eq('match_id', matchId)
    .eq('read', false);
  if (error) throw new Error(error.message);
}

export const notificationsService = {
  fetchFeed,
  fetchPrefs,
  setPref,
  addNotification,
  markAllRead,
  markRead,
  markReadByMatch,
};