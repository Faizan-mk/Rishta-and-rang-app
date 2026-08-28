import { mediaUpload } from './mediaUpload';
import { supabase } from './supabase';
import type { BlockedProfile, ChatMessage, ChatMessageKind, Match } from '../types/content';
import type { ProfileMode } from '../types/user';

export interface MatchDoc {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  mode: ProfileMode;
  movedToRishta: boolean;
  rishtaRequestPending: boolean;
  sourceProfileId: string | null;
}

export interface ChatMessageDoc {
  id: string;
  matchId: string;
  fromMe: boolean;
  text: string;
  kind: ChatMessageKind;
  audioUrl: string | null;
  durationSec: number | null;
  imageUrl: string | null;
  sentAt: string;
}

interface BlockedDoc {
  id: string;
  sourceProfileId: string | null;
  name: string;
  photo: string;
  blockedAt: string;
}

// Typed as plain string on purpose: supabase-js's select-string parser rejects
// quoted aliases, so we keep the query untyped and cast rows ourselves.
const MATCH_SELECT: string =
  'id, name, photo, lastMessage:last_message, lastMessageAt:last_message_at, unread, mode, movedToRishta:moved_to_rishta, rishtaRequestPending:rishta_request_pending, sourceProfileId:source_profile_id';

const MESSAGE_SELECT: string =
  'id, matchId:match_id, fromMe:from_me, text, kind, audioUrl:audio_path, durationSec:duration_sec, imageUrl:image_path, sentAt:sent_at';

const BLOCKED_SELECT: string =
  'id:blocked_id, sourceProfileId:source_profile_id, name, photo, blockedAt:blocked_at';

/** The subset of a match a caller may patch. */
export type MatchPatch = Partial<Omit<MatchDoc, 'sourceProfileId' | 'id'>>;

const MATCH_PATCH_COLUMNS: Record<keyof MatchPatch, string> = {
  name: 'name',
  photo: 'photo',
  lastMessage: 'last_message',
  lastMessageAt: 'last_message_at',
  unread: 'unread',
  mode: 'mode',
  movedToRishta: 'moved_to_rishta',
  rishtaRequestPending: 'rishta_request_pending',
};

export function mapMatchDoc(id: string, data: MatchDoc): Match {
  return {
    id,
    name: data.name,
    photo: data.photo,
    lastMessage: data.lastMessage,
    lastMessageAt: data.lastMessageAt,
    unread: data.unread,
    mode: data.mode,
    movedToRishta: data.movedToRishta,
    rishtaRequestPending: data.rishtaRequestPending,
    sourceProfileId: data.sourceProfileId ?? undefined,
  };
}

export function mapChatMessageDoc(id: string, data: ChatMessageDoc): ChatMessage {
  return {
    id,
    matchId: data.matchId,
    fromMe: data.fromMe,
    text: data.text,
    sentAt: data.sentAt,
    kind: data.kind,
    audioUri: data.audioUrl ?? undefined,
    durationSec: data.durationSec ?? undefined,
    imageUri: data.imageUrl ?? undefined,
  };
}

function mapBlockedDoc(data: BlockedDoc): BlockedProfile {
  return {
    id: data.id,
    sourceProfileId: data.sourceProfileId ?? undefined,
    name: data.name,
    photo: data.photo,
    blockedAt: data.blockedAt,
  };
}

async function fetchMatches(profileId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('profile_id', profileId)
    .order('last_message_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const match = row as unknown as MatchDoc;
    return mapMatchDoc(match.id, match);
  });
}

async function fetchChatHistory(profileId: string): Promise<Record<string, ChatMessage[]>> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_SELECT)
    .eq('profile_id', profileId)
    .order('sent_at', { ascending: true });
  if (error) throw new Error(error.message);
  const history: Record<string, ChatMessage[]> = {};
  for (const row of data ?? []) {
    const message = mapChatMessageDoc((row as unknown as ChatMessageDoc).id, row as unknown as ChatMessageDoc);
    (history[message.matchId] ??= []).push(message);
  }
  return history;
}

async function fetchBlocked(profileId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select(BLOCKED_SELECT)
    .eq('profile_id', profileId)
    .order('blocked_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBlockedDoc(row as unknown as BlockedDoc));
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
      unread: false,
      moved_to_rishta: false,
      rishta_request_pending: false,
    })
    .select(MATCH_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapMatchDoc((data as unknown as MatchDoc).id, data as unknown as MatchDoc);
}

async function updateMatch(profileId: string, matchId: string, patch: MatchPatch): Promise<void> {
  const update: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof MatchPatch)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    update[MATCH_PATCH_COLUMNS[key]] = value;
  }
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from('matches').update(update).eq('id', matchId).eq('profile_id', profileId);
  if (error) throw new Error(error.message);
}

async function deleteMatch(profileId: string, matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId).eq('profile_id', profileId);
  if (error) throw new Error(error.message);
}

async function insertMessage(profileId: string, data: Omit<ChatMessageDoc, 'id'>): Promise<ChatMessage> {
  const { data: row, error } = await supabase
    .from('chat_messages')
    .insert({
      profile_id: profileId,
      match_id: data.matchId,
      from_me: data.fromMe,
      text: data.text,
      kind: data.kind,
      audio_path: data.audioUrl,
      duration_sec: data.durationSec,
      image_path: data.imageUrl,
      sent_at: data.sentAt,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  // The inserted row, not the payload we sent: only the row carries the
  // database-generated `id`, and the Realtime channel de-dupes on it.
  const saved = row as unknown as ChatMessageDoc;
  return mapChatMessageDoc(saved.id, saved);
}

function baseMessage(matchId: string, fromMe: boolean, kind: ChatMessageKind): Omit<ChatMessageDoc, 'id'> {
  return {
    matchId,
    fromMe,
    kind,
    text: '',
    audioUrl: null,
    durationSec: null,
    imageUrl: null,
    // Client ISO timestamps (rather than the DB default) keep ordering stable
    // in the local snapshot — a pending server timestamp at insert time read
    // back as null and would jump the message around as soon as the write
    // landed. The same applies here, so we keep stamping client-side.
    sentAt: new Date().toISOString(),
  };
}

async function insertTextMessage(
  profileId: string,
  matchId: string,
  fromMe: boolean,
  text: string
): Promise<ChatMessage> {
  return insertMessage(profileId, { ...baseMessage(matchId, fromMe, 'text'), text });
}

async function insertVoiceMessage(
  profileId: string,
  matchId: string,
  localUri: string,
  durationSec: number
): Promise<ChatMessage> {
  const audioUrl = await mediaUpload.uploadChatAudio(profileId, matchId, localUri);
  return insertMessage(profileId, { ...baseMessage(matchId, true, 'voice'), audioUrl, durationSec });
}

async function insertImageMessage(profileId: string, matchId: string, localUri: string): Promise<ChatMessage> {
  const imageUrl = await mediaUpload.uploadChatImage(profileId, matchId, localUri);
  return insertMessage(profileId, { ...baseMessage(matchId, true, 'image'), imageUrl });
}

async function blockUser(profileId: string, blocked: BlockedProfile): Promise<void> {
  // Unique on (profile_id, blocked_id), so re-blocking overwrites instead of
  // stacking duplicates (what the old `on conflict` upsert did).
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
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
  if (error) throw new Error(error.message);
}

async function unblockUser(profileId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('profile_id', profileId)
    .eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
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