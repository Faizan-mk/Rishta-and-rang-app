import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { matchesService } from '../services/matchesService';
import { likesService } from '../services/likesService';
import { supabase } from '../services/supabase';
import { cache, CACHE_KEYS } from '../services/cache';
import { reactionsService, rowToReaction } from '../services/reactionsService';
import { AppError } from '../utils/appError';
import type { BlockedProfile, ChatMessage, Match, MessageReaction } from '../types/content';
import type { ProfileMode } from '../types/user';
import { PHOTO_PREVIEW, VOICE_PREVIEW, previewFor } from '../utils/messagePreview';
import { useAuth } from './AuthContext';

interface ProfileRef {
  id: string;
  name: string;
  photo: string;
  mode: ProfileMode;
}

export type { BlockedProfile };

interface MatchesContextValue {
  matches: Match[];
  chatHistory: Record<string, ChatMessage[]>;
  unreadCount: number;
  // Ids of the members whose thread has crossed into Rishta. Once a pair moves,
  // that person stops belonging to Friends anywhere in the app — the Friends
  // deck, Explore's Friends pool, and the Friends side of Matches all drop them.
  rishtaProfileIds: Set<string>;
  blockedProfiles: BlockedProfile[];
  getMatch: (matchId: string) => Match | undefined;
  getMessages: (matchId: string) => ChatMessage[];
  /** Every reaction on one message, in the order they were added. */
  getReactions: (messageId: string) => MessageReaction[];
  /** Adds the emoji, or takes it back off if this member already used it. */
  toggleReaction: (messageId: string, emoji: string) => void;
  sendMessage: (matchId: string, text: string) => void;
  sendVoiceMessage: (matchId: string, uri: string, durationSec: number) => void;
  sendImageMessage: (matchId: string, uri: string) => void;
  markMatchRead: (matchId: string) => void;
  sendRishtaRequest: (matchId: string, requestText: string) => void;
  removeMatch: (matchId: string) => void;
  blockMatch: (matchId: string) => void;
  unblockUser: (id: string) => void;
  /** The thread with this member, if the two of you have actually matched. */
  getMatchForProfile: (profileId: string) => Match | undefined;
  /** Blocks a member outright, thread or no thread. */
  blockProfile: (profile: ProfileRef) => void;
  /** Likes a member; returns the thread if that completed the pair. */
  likeProfile: (profile: ProfileRef) => Promise<{ match: Match | null; isNew: boolean }>;
}

const MatchesContext = createContext<MatchesContextValue | undefined>(undefined);

const NO_REACTIONS: MessageReaction[] = [];

/** A `chat_messages` row (snake_case, from PostgreSQL/Realtime) → ChatMessage. */
function rowToMessage(row: Record<string, unknown>, userId: string): ChatMessage {
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
  };
}

/**
 * Fills in what the shared `matches` row no longer carries.
 *
 * Since supabase/24_matching.sql a match is (user_a, user_b, mode) and nothing
 * else — a preview column on a row both people can write would be one person's
 * state in the other's hands. The preview comes off the thread instead, and
 * unread is per side: `match_reads` holds when this member last opened each
 * conversation, so the other person reading their copy leaves this one alone.
 */
function withThreadState(
  fresh: Match[],
  history: Record<string, ChatMessage[]>,
  reads: Record<string, string>
): Match[] {
  return fresh
    .map((match) => {
      const thread = history[match.id];
      const last = thread?.[thread.length - 1];
      if (!last) return match;
      const readAt = reads[match.id];
      return {
        ...match,
        lastMessage: previewFor(last),
        lastMessageAt: last.sentAt,
        // Their message, arriving after the last time this side opened the
        // thread. Our own messages never count, however long ago we read.
        unread: !last.fromMe && (!readAt || last.sentAt > readAt),
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);
  // Keyed by message id. Kept beside chatHistory rather than inside it so a
  // reaction arriving on its own never has to rewrite a message row.
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});

  // Guards the cache write below, so one account's match list can never be
  // persisted under another's key during a sign-out/sign-in.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      setMatches([]);
      setBlockedProfiles([]);
      setChatHistory({});
      setReactions({});
      return;
    }
    const userId = user.id;
    let cancelled = false;

    (async () => {
      // The list from last session renders straight away; the server copy
      // replaces it as soon as it arrives.
      const [cachedMatches, cachedBlocked] = await Promise.all([
        cache.read<Match[]>(userId, CACHE_KEYS.matches),
        cache.read<BlockedProfile[]>(userId, CACHE_KEYS.blocked),
      ]);
      if (cancelled) return;
      if (cachedMatches) {
        setMatches(cachedMatches);
        hydratedFor.current = userId;
      }
      if (cachedBlocked) setBlockedProfiles(cachedBlocked);

      const [freshMatches, freshBlocked, freshHistory, freshReactions, freshReads] = await Promise.all([
        matchesService.fetchMatches(userId),
        matchesService.fetchBlocked(userId),
        matchesService.fetchChatHistory(userId),
        reactionsService.fetchReactions(),
        matchesService.fetchReads(userId),
      ]);
      if (cancelled) return;
      setMatches(withThreadState(freshMatches, freshHistory, freshReads));
      setBlockedProfiles(freshBlocked);
      setChatHistory(freshHistory);
      setReactions(freshReactions);
      hydratedFor.current = userId;
    })().catch(() => {
      // Offline: whatever the cache gave us stays on screen.
    });

    // Live chat: Postgres Realtime streams new messages in (including ones sent
    // from another device or session). The seed above supplies the history; the
    // channel supplies everything after, de-duped by message id.
    const applyMessage = (message: ChatMessage) => {
      setChatHistory((prev) => {
        const list = prev[message.matchId] ?? [];
        if (list.some((existing) => existing.id === message.id)) return prev;
        return {
          ...prev,
          [message.matchId]: [...list, message].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
        };
      });
      setMatches((prev) =>
        prev.map((match) => {
          if (match.id !== message.matchId) return match;
          return {
            ...match,
            lastMessage: previewFor(message),
            lastMessageAt: message.sentAt,
            unread: match.unread || !message.fromMe,
          };
        })
      );
    };

    // Reactions ride the same channel as the messages, so one subscription keeps
    // both in step: a reaction added in another session shows up here without a
    // refresh, and one removed there disappears here.
    const applyReaction = (reaction: MessageReaction) => {
      setReactions((prev) => {
        const list = prev[reaction.messageId] ?? [];
        if (list.some((existing) => existing.id === reaction.id)) return prev;
        return { ...prev, [reaction.messageId]: [...list, reaction] };
      });
    };

    const dropReaction = (reaction: MessageReaction) => {
      setReactions((prev) => {
        const list = prev[reaction.messageId];
        if (!list) return prev;
        const next = list.filter((existing) => existing.id !== reaction.id);
        if (next.length === list.length) return prev;
        return { ...prev, [reaction.messageId]: next };
      });
    };

    const channel = supabase
      .channel(`chat_messages_${userId}`)
      // No `profile_id`/`user_id` filter any more. A filter here would put us
      // back to hearing only our own writes, which is exactly what stopped the
      // other person's message from arriving; RLS is what narrows the stream
      // now, and it narrows it to the conversations we are in.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => applyMessage(rowToMessage(payload.new as Record<string, unknown>, userId))
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => applyReaction(rowToReaction(payload.new as Record<string, unknown>))
      )
      .on(
        // The DELETE payload only carries message_id because the table is
        // `replica identity full` (see supabase/20_message_reactions.sql).
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => dropReaction(rowToReaction(payload.old as Record<string, unknown>))
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Catches the live listener's preview/unread updates and every local mutation,
  // so the cached list matches what was last on screen. Chat messages stay out
  // of the cache on purpose — they're already streamed by the Realtime channel.
  useEffect(() => {
    if (!user || hydratedFor.current !== user.id) return;
    cache.write(user.id, CACHE_KEYS.matches, matches);
    cache.write(user.id, CACHE_KEYS.blocked, blockedProfiles);
  }, [user?.id, matches, blockedProfiles]);

  const getMatch = (matchId: string) => matches.find((m) => m.id === matchId);
  const getMessages = (matchId: string) => chatHistory[matchId] ?? [];
  const getReactions = (messageId: string) => reactions[messageId] ?? NO_REACTIONS;

  // Optimistic on both paths: the pill appears (or goes) on the tap, and the
  // Realtime echo of the write is de-duped by id. A failed write puts the list
  // back the way the server still has it.
  const toggleReaction = (messageId: string, emoji: string) => {
    if (!user) return;
    const userId = user.id;
    const mine = (reactions[messageId] ?? []).find((r) => r.userId === userId && r.emoji === emoji);

    if (mine) {
      setReactions((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter((r) => r.id !== mine.id),
      }));
      reactionsService.removeReaction(userId, messageId, emoji).catch(() => {
        setReactions((prev) => ({ ...prev, [messageId]: [...(prev[messageId] ?? []), mine] }));
      });
      return;
    }

    // A placeholder id until the row comes back — swapped for the saved row so
    // the Realtime echo recognises it and a later un-react has a real id to delete.
    const pendingId = `pending-${messageId}-${emoji}`;
    const pending: MessageReaction = {
      id: pendingId,
      messageId,
      userId,
      emoji,
      createdAt: new Date().toISOString(),
    };
    setReactions((prev) => ({ ...prev, [messageId]: [...(prev[messageId] ?? []), pending] }));

    reactionsService
      .addReaction(userId, messageId, emoji)
      .then((saved) => {
        setReactions((prev) => {
          const list = prev[messageId] ?? [];
          if (list.some((r) => r.id === saved.id)) {
            // The channel beat the insert's own response back; drop the placeholder.
            return { ...prev, [messageId]: list.filter((r) => r.id !== pendingId) };
          }
          return { ...prev, [messageId]: list.map((r) => (r.id === pendingId ? saved : r)) };
        });
      })
      .catch(() => {
        setReactions((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] ?? []).filter((r) => r.id !== pendingId),
        }));
      });
  };

  // Local only: the preview lives on the thread now, not on the shared row.
  // The cache write further up keeps it across launches, and `withThreadState`
  // rebuilds it from the messages themselves on the next load.
  const pushMessage = (matchId: string, message: ChatMessage, lastMessagePreview: string) => {
    if (!user) return;
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, lastMessage: lastMessagePreview, lastMessageAt: message.sentAt } : m))
    );
  };

  const sendMessage = (matchId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    matchesService.insertTextMessage(user.id, matchId, trimmed).then((message) => pushMessage(matchId, message, trimmed));
  };

  const sendVoiceMessage = (matchId: string, uri: string, durationSec: number) => {
    if (!user) return;
    matchesService
      .insertVoiceMessage(user.id, matchId, uri, durationSec)
      .then((message) => pushMessage(matchId, message, VOICE_PREVIEW));
  };

  const sendImageMessage = (matchId: string, uri: string) => {
    if (!user) return;
    matchesService.insertImageMessage(user.id, matchId, uri).then((message) => pushMessage(matchId, message, PHOTO_PREVIEW));
  };

  // Per side: this writes only this member's mark, and the other person's
  // unread is untouched by it (supabase/26_two_way_messaging.sql).
  const markMatchRead = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.unread || !user) return;
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, unread: false } : m)));
    matchesService.markRead(user.id, matchId, new Date().toISOString()).catch(() => undefined);
  };

  // Sends a Move to Rishta request as a message in the thread.
  //
  // The 2.2-second `setTimeout` that used to fake an acceptance is gone: it
  // worked by writing a message as the other person, which the participant RLS
  // in supabase/26_two_way_messaging.sql refuses outright — a message is signed
  // by whoever sent it now. The real handshake (a pending state on the shared
  // row, an Accept / Decline banner on the other side) is its own roadmap item;
  // until it lands the request is a message the other member genuinely receives,
  // and nothing flips the mode on their behalf.
  const sendRishtaRequest = (matchId: string, requestText: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.movedToRishta || match.rishtaRequestPending || !user) return;

    matchesService
      .insertTextMessage(user.id, matchId, requestText)
      .then((message) => pushMessage(matchId, message, requestText));
    // Local and in-flight: it keeps the button from being pressed twice in a
    // sitting. The shared row has no column for it, by design.
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, rishtaRequestPending: true } : m)));
  };

  // One row, so unmatching removes the conversation for both sides — which is
  // what "unmatch" has always meant on screen.
  const removeMatch = (matchId: string) => {
    if (!user) return;
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    matchesService.deleteMatch(matchId).catch(() => undefined);
  };

  // Blocking is per person, not per thread: the block trigger in
  // supabase/24_matching.sql clears the pair's likes and match server-side, so
  // this only has to keep the local list in step.
  const blockProfile = (profile: ProfileRef) => {
    if (!user) return;
    const blocked: BlockedProfile = {
      id: profile.id,
      name: profile.name,
      photo: profile.photo,
      blockedAt: new Date().toISOString(),
    };
    // Keyed by person, so blocking someone met a second way updates the
    // existing entry instead of listing them twice.
    setBlockedProfiles((prev) => [blocked, ...prev.filter((b) => b.id !== blocked.id)]);
    setMatches((prev) => prev.filter((m) => m.sourceProfileId !== profile.id));
    matchesService.blockUser(user.id, blocked).catch(() => {
      setBlockedProfiles((prev) => prev.filter((b) => b.id !== blocked.id));
    });
  };

  const blockMatch = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    // Every match row names both people now, so there is always someone to
    // block — no counterpart means no such thread.
    if (!match?.sourceProfileId) return;
    blockProfile({ id: match.sourceProfileId, name: match.name, photo: match.photo, mode: match.mode });
    removeMatch(matchId);
  };

  const unblockUser = (id: string) => {
    if (!user) return;
    setBlockedProfiles((prev) => prev.filter((b) => b.id !== id));
    matchesService.unblockUser(user.id, id);
  };

  const getMatchForProfile = (profileId: string) => matches.find((m) => m.sourceProfileId === profileId);

  /**
   * Likes someone, and returns the conversation if that made the pair mutual.
   *
   * One call: `like_profile` records the like, looks for the reciprocal one and
   * writes the shared row inside a single transaction
   * (supabase/27_like_profile.sql), so there is no window where the like landed
   * and the match did not. `isNew` is true only on the call that created it,
   * which is what a match celebration should fire on — a re-like of someone you
   * already matched is not news.
   */
  const likeProfile = async (profile: ProfileRef): Promise<{ match: Match | null; isNew: boolean }> => {
    if (!user) throw new AppError('authErrors.notSignedIn');

    const outcome = await likesService.likeProfile(profile.id, profile.mode);
    if (!outcome.matched || !outcome.matchId) return { match: null, isNew: false };

    const existing = matches.find((m) => m.id === outcome.matchId);
    if (existing) return { match: existing, isNew: outcome.isNew };

    // The RPC hands back ids; the card we were given is what the list needs
    // until the next load fills it in from `profiles`.
    const match: Match = {
      id: outcome.matchId,
      name: profile.name,
      photo: profile.photo,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unread: false,
      mode: profile.mode,
      movedToRishta: profile.mode === 'rishta',
      rishtaRequestPending: false,
      sourceProfileId: profile.id,
    };
    setMatches((prev) => (prev.some((m) => m.id === match.id) ? prev : [match, ...prev]));
    return { match, isNew: outcome.isNew };
  };

  const unreadCount = useMemo(() => matches.filter((m) => m.unread).length, [matches]);

  const rishtaProfileIds = useMemo(
    () =>
      new Set(
        matches
          .filter((m) => m.movedToRishta)
          .map((m) => m.sourceProfileId)
          .filter((id): id is string => Boolean(id))
      ),
    [matches]
  );

  const value = useMemo(
    () => ({
      matches,
      chatHistory,
      unreadCount,
      rishtaProfileIds,
      blockedProfiles,
      getMatch,
      getMessages,
      getReactions,
      toggleReaction,
      sendMessage,
      sendVoiceMessage,
      sendImageMessage,
      markMatchRead,
      sendRishtaRequest,
      removeMatch,
      blockMatch,
      unblockUser,
      getMatchForProfile,
      blockProfile,
      likeProfile,
    }),
    [matches, chatHistory, reactions, unreadCount, rishtaProfileIds, blockedProfiles, user?.id]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within a MatchesProvider');
  return ctx;
}