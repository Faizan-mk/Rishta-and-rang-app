import {
  addDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { mediaUpload } from './mediaUpload';
import {
  blockedCollection,
  blockedDoc,
  matchDoc,
  matchesCollection,
  messagesCollection,
} from './firestorePaths';
import type { BlockedProfile, ChatMessage, ChatMessageKind, Match } from '../types/content';
import type { ProfileMode } from '../types/user';

export interface MatchDoc {
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
  sourceProfileId: string | null;
  name: string;
  photo: string;
  blockedAt: string;
}

/** The subset of a match a caller may patch. */
export type MatchPatch = Partial<Omit<MatchDoc, 'sourceProfileId'>>;

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

function mapBlockedDoc(id: string, data: BlockedDoc): BlockedProfile {
  return {
    id,
    sourceProfileId: data.sourceProfileId ?? undefined,
    name: data.name,
    photo: data.photo,
    blockedAt: data.blockedAt,
  };
}

export function mapMatchSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Match {
  return mapMatchDoc(snap.id, snap.data() as MatchDoc);
}

export function mapChatMessageSnapshot(snap: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  return mapChatMessageDoc(snap.id, snap.data() as ChatMessageDoc);
}

async function fetchMatches(profileId: string): Promise<Match[]> {
  const snap = await getDocs(query(matchesCollection(profileId), orderBy('lastMessageAt', 'desc')));
  return snap.docs.map(mapMatchSnapshot);
}

async function fetchChatHistory(profileId: string): Promise<Record<string, ChatMessage[]>> {
  const snap = await getDocs(query(messagesCollection(profileId), orderBy('sentAt', 'asc')));
  const history: Record<string, ChatMessage[]> = {};
  for (const entry of snap.docs) {
    const message = mapChatMessageSnapshot(entry);
    (history[message.matchId] ??= []).push(message);
  }
  return history;
}

async function fetchBlocked(profileId: string): Promise<BlockedProfile[]> {
  const snap = await getDocs(query(blockedCollection(profileId), orderBy('blockedAt', 'desc')));
  return snap.docs.map((entry) => mapBlockedDoc(entry.id, entry.data() as BlockedDoc));
}

async function createMatch(
  profileId: string,
  match: { name: string; photo: string; mode: ProfileMode; sourceProfileId?: string }
): Promise<Match> {
  const data: MatchDoc = {
    name: match.name,
    photo: match.photo,
    mode: match.mode,
    sourceProfileId: match.sourceProfileId ?? null,
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    unread: false,
    movedToRishta: false,
    rishtaRequestPending: false,
  };
  const ref = await addDoc(matchesCollection(profileId), data);
  return mapMatchDoc(ref.id, data);
}

async function updateMatch(profileId: string, matchId: string, patch: MatchPatch): Promise<void> {
  await updateDoc(matchDoc(profileId, matchId), patch);
}

async function deleteMatch(profileId: string, matchId: string): Promise<void> {
  await deleteDoc(matchDoc(profileId, matchId));
}

async function insertMessage(profileId: string, data: ChatMessageDoc): Promise<ChatMessage> {
  const ref = await addDoc(messagesCollection(profileId), data);
  return mapChatMessageDoc(ref.id, data);
}

function baseMessage(matchId: string, fromMe: boolean, kind: ChatMessageKind): ChatMessageDoc {
  return {
    matchId,
    fromMe,
    kind,
    text: '',
    audioUrl: null,
    durationSec: null,
    imageUrl: null,
    // Client ISO timestamps (rather than serverTimestamp) keep ordering stable
    // in the local snapshot — a pending server timestamp reads back as null and
    // would jump the message around as soon as the write lands.
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
  // Doc id is the blocked profile's id, so re-blocking overwrites instead of
  // stacking duplicates (what the old `on conflict` upsert did).
  await setDoc(blockedDoc(profileId, blocked.id), {
    sourceProfileId: blocked.sourceProfileId ?? null,
    name: blocked.name,
    photo: blocked.photo,
    blockedAt: blocked.blockedAt,
  } satisfies BlockedDoc);
}

async function unblockUser(profileId: string, blockedId: string): Promise<void> {
  await deleteDoc(blockedDoc(profileId, blockedId));
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
