import { supabase } from './supabase';
import { mediaUpload } from './mediaUpload';
import type { BlockedProfile, ChatMessage, ChatMessageKind, Match } from '../types/content';
import type { ProfileMode } from '../types/user';

interface MatchRow {
  id: string;
  name: string;
  photo: string;
  last_message: string;
  last_message_at: string;
  unread: boolean;
  mode: ProfileMode;
  moved_to_rishta: boolean;
  rishta_request_pending: boolean;
  source_profile_id: string | null;
}

interface ChatMessageRow {
  id: string;
  match_id: string;
  from_me: boolean;
  text: string;
  kind: ChatMessageKind;
  audio_path: string | null;
  duration_sec: number | null;
  image_path: string | null;
  sent_at: string;
}

interface BlockedUserRow {
  blocked_id: string;
  source_profile_id: string | null;
  name: string;
  photo: string;
  blocked_at: string;
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unread: row.unread,
    mode: row.mode,
    movedToRishta: row.moved_to_rishta,
    rishtaRequestPending: row.rishta_request_pending,
    sourceProfileId: row.source_profile_id ?? undefined,
  };
}

function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    matchId: row.match_id,
    fromMe: row.from_me,
    text: row.text,
    sentAt: row.sent_at,
    kind: row.kind,
    audioUri: row.audio_path ? mediaUpload.publicUrl(row.audio_path) : undefined,
    durationSec: row.duration_sec ?? undefined,
    imageUri: row.image_path ? mediaUpload.publicUrl(row.image_path) : undefined,
  };
}

function mapBlocked(row: BlockedUserRow): BlockedProfile {
  return {
    id: row.blocked_id,
    sourceProfileId: row.source_profile_id ?? undefined,
    name: row.name,
    photo: row.photo,
    blockedAt: row.blocked_at,
  };
}

async function fetchMatches(profileId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, name, photo, last_message, last_message_at, unread, mode, moved_to_rishta, rishta_request_pending, source_profile_id')
    .eq('profile_id', profileId)
    .order('last_message_at', { ascending: false })
    .returns<MatchRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMatch);
}

async function fetchChatHistory(profileId: string): Promise<Record<string, ChatMessage[]>> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, match_id, from_me, text, kind, audio_path, duration_sec, image_path, sent_at')
    .eq('profile_id', profileId)
    .order('sent_at', { ascending: true })
    .returns<ChatMessageRow[]>();
  if (error) throw error;
  const history: Record<string, ChatMessage[]> = {};
  for (const row of data ?? []) {
    const message = mapMessage(row);
    (history[message.matchId] ??= []).push(message);
  }
  return history;
}

async function fetchBlocked(profileId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, source_profile_id, name, photo, blocked_at')
    .eq('profile_id', profileId)
    .order('blocked_at', { ascending: false })
    .returns<BlockedUserRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapBlocked);
}

async function createMatch(
  profileId: string,
  match: { name: string; photo: string; mode: ProfileMode; sourceProfileId?: string }
): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      profile_id: profileId,
      name: match.name,
      photo: match.photo,
      mode: match.mode,
      source_profile_id: match.sourceProfileId ?? null,
      last_message: '',
      last_message_at: new Date().toISOString(),
    })
    .select('id, name, photo, last_message, last_message_at, unread, mode, moved_to_rishta, rishta_request_pending, source_profile_id')
    .single<MatchRow>();
  if (error) throw error;
  return mapMatch(data);
}

async function updateMatch(matchId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('matches').update(patch).eq('id', matchId);
  if (error) throw error;
}

async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
}

async function insertTextMessage(profileId: string, matchId: string, fromMe: boolean, text: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ profile_id: profileId, match_id: matchId, from_me: fromMe, text, kind: 'text' })
    .select('id, match_id, from_me, text, kind, audio_path, duration_sec, image_path, sent_at')
    .single<ChatMessageRow>();
  if (error) throw error;
  return mapMessage(data);
}

async function insertVoiceMessage(profileId: string, matchId: string, localUri: string, durationSec: number): Promise<ChatMessage> {
  const audioPath = await mediaUpload.uploadChatAudio(profileId, matchId, localUri);
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ profile_id: profileId, match_id: matchId, from_me: true, kind: 'voice', audio_path: audioPath, duration_sec: durationSec })
    .select('id, match_id, from_me, text, kind, audio_path, duration_sec, image_path, sent_at')
    .single<ChatMessageRow>();
  if (error) throw error;
  return mapMessage(data);
}

async function insertImageMessage(profileId: string, matchId: string, localUri: string): Promise<ChatMessage> {
  const imagePath = await mediaUpload.uploadChatImage(profileId, matchId, localUri);
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ profile_id: profileId, match_id: matchId, from_me: true, kind: 'image', image_path: imagePath })
    .select('id, match_id, from_me, text, kind, audio_path, duration_sec, image_path, sent_at')
    .single<ChatMessageRow>();
  if (error) throw error;
  return mapMessage(data);
}

async function blockUser(profileId: string, blocked: BlockedProfile): Promise<void> {
  const { error } = await supabase.from('blocked_users').upsert(
    {
      profile_id: profileId,
      blocked_id: blocked.id,
      source_profile_id: blocked.sourceProfileId ?? null,
      name: blocked.name,
      photo: blocked.photo,
      blocked_at: blocked.blockedAt,
    },
    { onConflict: 'profile_id,blocked_id' }
  );
  if (error) throw error;
}

async function unblockUser(profileId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').delete().eq('profile_id', profileId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export const matchesService = {
  fetchMatches,
  fetchChatHistory,
  fetchBlocked,
  createMatch,
  updateMatch,
  deleteMatch,
  insertTextMessage,
  insertVoiceMessage,
  insertImageMessage,
  blockUser,
  unblockUser,
};
