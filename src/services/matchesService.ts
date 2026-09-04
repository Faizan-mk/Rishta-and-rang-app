import { mediaUpload } from './mediaUpload';
import { supabase } from './supabase';
import type { BlockedProfile, ChatMessage, ChatMessageKind, Match } from '../types/content';
import type { ProfileMode } from '../types/user';

// A `matches` row as the table now stores it: one row per pair, ordered uuids,
// readable by both people in it (see supabase/24_matching.sql). Everything the
// old per-user row carried — the counterpart's name and photo, the last message,
// unread — is either looked up from `profiles` or derived from the thread.
export interface MatchRow {
  id: string;
  user_a: string;
  user_b: string;
  mode: ProfileMode;
  created_at: string;
  // Null unless one of the two has asked to move the conversation to rishta.
  rishta_requested_by: string | null;
  rishta_requested_at: string | null;
}

/** The counterpart's card, looked up per match from `profiles`. */
interface ProfileCard {
  name: string;
  photo: string;
}

export interface ChatMessageDoc {
  id: string;
  matchId: string;
  // Who wrote it. `fromMe` is not stored any more — it is this against the
  // signed-in member, worked out when the row is mapped (supabase/26_two_way_messaging.sql).
  senderId: string;
  text: string;
  kind: ChatMessageKind;
  audioUrl: string | null;
  durationSec: number | null;
  imageUrl: string | null;
  sentAt: string;
}

interface BlockedDoc {
  id: string;
  name: string;
  photo: string;
  blockedAt: string;
}

const MATCH_SELECT: string =
  'id, user_a, user_b, mode, created_at, rishta_requested_by, rishta_requested_at';

// Typed as plain string on purpose: supabase-js's select-string parser rejects
// quoted aliases, so we keep the query untyped and cast rows ourselves.
const MESSAGE_SELECT: string =
  'id, matchId:match_id, senderId:sender_id, text, kind, audioUrl:audio_path, durationSec:duration_sec, imageUrl:image_path, sentAt:sent_at';

const BLOCKED_SELECT: string = 'id:blocked_user_id, name, photo, blockedAt:blocked_at';

/** The other person in a pair, from the caller's side of it. */
export function counterpartOf(row: MatchRow, userId: string): string {
  return row.user_a === userId ? row.user_b : row.user_a;
}

/** The pair as the table stores it — ascending, which is what makes it a key. */
function orderedPair(userId: string, targetId: string): [string, string] {
  return userId < targetId ? [userId, targetId] : [targetId, userId];
}

export function mapMatchRow(row: MatchRow, userId: string, card?: ProfileCard): Match {
  return {
    id: row.id,
    // A card can be missing when the counterpart's profile is unreadable —
    // hidden, or blocked since. The thread still lists rather than vanishing
    // mid-render; the block flow is what removes it.
    name: card?.name ?? '',
    photo: card?.photo ?? '',
    // The row has no message columns any more: the preview and its timestamp
    // come from the thread itself, and the caller fills them in from the chat
    // history it already loads. Until then the match sorts by when it formed.
    lastMessage: '',
    lastMessageAt: row.created_at,
    // Per-side state, so it is not on the shared row at all: it comes from
    // `match_reads` (supabase/26_two_way_messaging.sql), which the caller folds
    // in once it has the thread to compare against.
    unread: false,
    mode: row.mode,
    // The shared row's own mode is the crossing-over: once a pair moves to
    // rishta, they are in rishta for both of them.
    movedToRishta: row.mode === 'rishta',
    // Same column, two different screens: the one who asked waits, the other
    // is the one with something to answer.
    rishtaRequestPending: row.rishta_requested_by === userId,
    rishtaRequestIncoming: row.rishta_requested_by != null && row.rishta_requested_by !== userId,
    sourceProfileId: counterpartOf(row, userId),
  };
}

export function mapChatMessageDoc(id: string, data: ChatMessageDoc, userId: string): ChatMessage {
  return {
    id,
    matchId: data.matchId,
    fromMe: data.senderId === userId,
    text: data.text,
    sentAt: data.sentAt,
    kind: data.kind,
    audioUri: data.audioUrl ?? undefined,
    durationSec: data.durationSec ?? undefined,
    imageUri: data.imageUrl ?? undefined,
    // This maps a row the server returned, so it is on the server by definition.
    status: 'sent',
  };
}

function mapBlockedDoc(data: BlockedDoc): BlockedProfile {
  return {
    id: data.id,
    name: data.name,
    photo: data.photo,
    blockedAt: data.blockedAt,
  };
}

/** The counterparts' cards in one round trip, keyed by id. */
async function fetchProfileCards(ids: string[]): Promise<Map<string, ProfileCard>> {
  const cards = new Map<string, ProfileCard>();
  if (ids.length === 0) return cards;
  const { data, error } = await supabase.from('profiles').select('id, full_name, photos').in('id', ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const profile = row as unknown as { id: string; full_name: string; photos: string[] | null };
    cards.set(profile.id, { name: profile.full_name, photo: profile.photos?.[0] ?? '' });
  }
  return cards;
}

async function fetchMatches(profileId: string): Promise<Match[]> {
  // Either column can be us, so the filter is an `or` rather than an `eq`. RLS
  // says the same thing, but stating it in the query keeps the plan on the
  // per-column indexes.
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .or(`user_a.eq.${profileId},user_b.eq.${profileId}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MatchRow[];
  const cards = await fetchProfileCards(rows.map((row) => counterpartOf(row, profileId)));
  return rows.map((row) => mapMatchRow(row, profileId, cards.get(counterpartOf(row, profileId))));
}

/** How many messages one page of a thread carries. */
export const MESSAGE_PAGE_SIZE = 30;

/** A `chat_messages` row as PostgreSQL hands it over — snake_case, unaliased. */
export function rowToMessage(row: Record<string, unknown>, userId: string): ChatMessage {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    // Not a stored column: whose message this is, is who is reading it.
    fromMe: String(row.sender_id) === userId,
    text: (row.text as string) ?? '',
    sentAt: (row.sent_at as string) ?? new Date().toISOString(),
    kind: (row.kind as ChatMessage['kind']) ?? 'text',
    audioUri: row.audio_path ? String(row.audio_path) : undefined,
    durationSec: typeof row.duration_sec === 'number' ? row.duration_sec : undefined,
    imageUri: row.image_path ? String(row.image_path) : undefined,
    // Anything that came back from the server is on the server.
    status: 'sent',
  };
}

/**
 * The newest message of each conversation, and nothing else.
 *
 * This used to be every message of every thread, fetched before the matches
 * list could render — the whole history, to show one line per row. `distinct
 * on` does that server-side now (supabase/33_chat_paging_and_receipts.sql); the
 * thread itself is paged in when it is opened.
 */
async function fetchThreadPreviews(profileId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('thread_previews');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => rowToMessage(row, profileId));
}

export interface MessagePage {
  /** Oldest first, the order the thread renders in. */
  messages: ChatMessage[];
  /** Whether a full page came back — the only honest "there may be more". */
  hasMore: boolean;
}

/**
 * One page of one conversation, newest first, ending just before `cursor`.
 *
 * The cursor is a whole message rather than a timestamp: two messages can carry
 * the same `sent_at` (they are stamped by the client), so a time alone would
 * either skip one or repeat it. The RPC compares `(sent_at, id)` as a pair.
 */
async function fetchMessagePage(
  profileId: string,
  matchId: string,
  cursor?: { sentAt: string; id: string },
  limit: number = MESSAGE_PAGE_SIZE
): Promise<MessagePage> {
  const { data, error } = await supabase.rpc('message_page', {
    p_match_id: matchId,
    p_before_at: cursor?.sentAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    // The RPC answers newest first because that is what the index is sorted by;
    // the screen wants oldest first.
    messages: rows.map((row) => rowToMessage(row, profileId)).reverse(),
    hasMore: rows.length >= limit,
  };
}

export interface ReadMarks {
  /** When I last opened each thread — what my own unread badge is measured against. */
  mine: Record<string, string>;
  /** When the other member last opened it — what a read receipt is measured against. */
  theirs: Record<string, string>;
}

/**
 * Both sides' read marks in one query.
 *
 * `match_reads_select` returns my own row plus my counterpart's, for matches I
 * am in and unless they have turned their online status off — so the split
 * below is on `user_id`, and a missing `theirs` entry is simply "no receipt",
 * whether that is because they never opened it or because they do not share it.
 */
async function fetchReads(profileId: string): Promise<ReadMarks> {
  const { data, error } = await supabase.from('match_reads').select('match_id, user_id, last_read_at');
  if (error) throw new Error(error.message);
  const marks: ReadMarks = { mine: {}, theirs: {} };
  for (const row of data ?? []) {
    const read = row as unknown as { match_id: string; user_id: string; last_read_at: string };
    const side = read.user_id === profileId ? marks.mine : marks.theirs;
    side[read.match_id] = read.last_read_at;
  }
  return marks;
}

/** Read state is per person, so this is an upsert on (match_id, user_id). */
async function markRead(profileId: string, matchId: string, at: string): Promise<void> {
  const { error } = await supabase
    .from('match_reads')
    .upsert({ match_id: matchId, user_id: profileId, last_read_at: at }, { onConflict: 'match_id,user_id' });
  if (error) throw new Error(error.message);
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

async function findMatchRow(profileId: string, targetId: string): Promise<MatchRow | null> {
  const [userA, userB] = orderedPair(profileId, targetId);
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as MatchRow) ?? null;
}

/**
 * The pair's match row, creating it if this is the moment it formed. The insert
 * is refused unless the like is actually mutual (see supabase/24_matching.sql),
 * so a caller cannot conjure a conversation with someone who never liked back.
 */
async function ensureMatch(profileId: string, targetId: string, mode: ProfileMode): Promise<Match> {
  const existing = await findMatchRow(profileId, targetId);
  if (existing) return mapMatchRow(existing, profileId);

  const [userA, userB] = orderedPair(profileId, targetId);
  const { data, error } = await supabase
    .from('matches')
    .insert({ user_a: userA, user_b: userB, mode })
    .select(MATCH_SELECT)
    .single();

  if (error) {
    // 23505: the other side's client wrote the row between our select and our
    // insert. The unique on the pair is what makes that a race we can simply
    // read our way out of rather than an error worth surfacing.
    if (error.code === '23505') {
      const theirs = await findMatchRow(profileId, targetId);
      if (theirs) return mapMatchRow(theirs, profileId);
    }
    throw new Error(error.message);
  }
  return mapMatchRow(data as unknown as MatchRow, profileId);
}

/**
 * Asks to move the conversation to rishta.
 *
 * The database decides whether it may be asked at all — a participant, not
 * already rishta, nothing pending, and the asker's rishta profile filled in.
 * It raises otherwise, and the message text is the raw code (see
 * supabase/28_rishta_request.sql) for the caller to map to something readable.
 */
async function requestRishta(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('request_rishta', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

/**
 * Answers the other member's request. Accepting is the only thing that moves
 * `mode`, and it moves it for both of them at once — there is one row.
 */
async function respondRishta(matchId: string, accept: boolean): Promise<'accepted' | 'declined'> {
  const { data, error } = await supabase.rpc('respond_rishta', { p_match_id: matchId, p_accept: accept });
  if (error) throw new Error(error.message);
  return data === 'accepted' ? 'accepted' : 'declined';
}

/** Unmatching ends the conversation for both sides — there is one row now. */
async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw new Error(error.message);
}

/** What a caller supplies. `sentAt` is not among it — see below. */
type NewMessage = Omit<ChatMessageDoc, 'id' | 'senderId' | 'sentAt'>;

async function insertMessage(profileId: string, data: NewMessage): Promise<ChatMessage> {
  const { data: row, error } = await supabase
    .from('chat_messages')
    .insert({
      match_id: data.matchId,
      sender_id: profileId,
      text: data.text,
      kind: data.kind,
      audio_path: data.audioUrl,
      duration_sec: data.durationSec,
      image_path: data.imageUrl,
      // `sent_at` is deliberately NOT sent: the column defaults to the
      // database's own `now()`.
      //
      // It used to be stamped from the device, which meant a phone with a wrong
      // clock wrote a wrong time — and wrote it for both people, since the two
      // sides read the same row. A message could sit hours in the past, or in
      // the future, with nothing in the app disagreeing. The reason it was done
      // that way (a pending timestamp reading back as null and making the
      // message jump) no longer holds: the insert reads the saved row back, so
      // the server's own time arrives with it, and the optimistic copy covers
      // the moment in between.
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  // The inserted row, not the payload we sent: only the row carries the
  // database-generated `id` and `sent_at`, and the Realtime channel de-dupes on
  // the id.
  const saved = row as unknown as ChatMessageDoc;
  return mapChatMessageDoc(saved.id, saved, profileId);
}

function baseMessage(matchId: string, kind: ChatMessageKind): NewMessage {
  return {
    matchId,
    kind,
    text: '',
    audioUrl: null,
    durationSec: null,
    imageUrl: null,
  };
}

async function insertTextMessage(profileId: string, matchId: string, text: string): Promise<ChatMessage> {
  return insertMessage(profileId, { ...baseMessage(matchId, 'text'), text });
}

async function insertVoiceMessage(
  profileId: string,
  matchId: string,
  localUri: string,
  durationSec: number
): Promise<ChatMessage> {
  const audioUrl = await mediaUpload.uploadChatAudio(profileId, matchId, localUri);
  return insertMessage(profileId, { ...baseMessage(matchId, 'voice'), audioUrl, durationSec });
}

async function insertImageMessage(profileId: string, matchId: string, localUri: string): Promise<ChatMessage> {
  const imageUrl = await mediaUpload.uploadChatImage(profileId, matchId, localUri);
  return insertMessage(profileId, { ...baseMessage(matchId, 'image'), imageUrl });
}

async function blockUser(profileId: string, blocked: BlockedProfile): Promise<void> {
  // Unique on (profile_id, blocked_user_id), so re-blocking the same person
  // overwrites instead of stacking duplicates. `source_profile_id` is still
  // written for the older column's sake until it is dropped.
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
      {
        profile_id: profileId,
        blocked_user_id: blocked.id,
        source_profile_id: blocked.id,
        name: blocked.name,
        photo: blocked.photo,
        blocked_at: blocked.blockedAt,
      },
      { onConflict: 'profile_id,blocked_user_id' }
    );
  if (error) throw new Error(error.message);
}

async function unblockUser(profileId: string, blockedUserId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('profile_id', profileId)
    .eq('blocked_user_id', blockedUserId);
  if (error) throw new Error(error.message);
}

export const matchesService = {
  fetchMatches,
  fetchThreadPreviews,
  fetchMessagePage,
  fetchReads,
  markRead,
  fetchBlocked,
  findMatchRow,
  ensureMatch,
  requestRishta,
  respondRishta,
  deleteMatch,
  insertTextMessage,
  insertVoiceMessage,
  insertImageMessage,
  blockUser,
  unblockUser,
};