import { supabase } from './supabase';
import { DEFAULT_NOTIFICATION_PREFS, NotificationItem, NotificationPrefs } from '../types/content';

interface NotificationRow {
  id: string;
  type: NotificationItem['type'];
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

interface NotificationPrefsRow {
  new_matches: boolean;
  messages: boolean;
  likes: boolean;
  rishta_requests: boolean;
  product_updates: boolean;
}

function mapNotification(row: NotificationRow): NotificationItem {
  return { id: row.id, type: row.type, title: row.title, body: row.body, createdAt: row.created_at, read: row.read };
}

function mapPrefs(row: NotificationPrefsRow | null): NotificationPrefs {
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  return {
    newMatches: row.new_matches,
    messages: row.messages,
    likes: row.likes,
    rishtaRequests: row.rishta_requests,
    productUpdates: row.product_updates,
  };
}

async function fetchFeed(profileId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, created_at, read')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .returns<NotificationRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

async function fetchPrefs(profileId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('new_matches, messages, likes, rishta_requests, product_updates')
    .eq('profile_id', profileId)
    .maybeSingle<NotificationPrefsRow>();
  if (error) throw error;
  return mapPrefs(data);
}

async function setPref(profileId: string, next: NotificationPrefs): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      profile_id: profileId,
      new_matches: next.newMatches,
      messages: next.messages,
      likes: next.likes,
      rishta_requests: next.rishtaRequests,
      product_updates: next.productUpdates,
    },
    { onConflict: 'profile_id' }
  );
  if (error) throw error;
}

async function addNotification(
  profileId: string,
  type: NotificationItem['type'],
  title: string,
  body: string
): Promise<NotificationItem> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ profile_id: profileId, type, title, body })
    .select('id, type, title, body, created_at, read')
    .single<NotificationRow>();
  if (error) throw error;
  return mapNotification(data);
}

async function markAllRead(profileId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('profile_id', profileId);
  if (error) throw error;
}

async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export const notificationsService = { fetchFeed, fetchPrefs, setPref, addNotification, markAllRead, markRead };
