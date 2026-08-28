import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { matchesService } from '../services/matchesService';
import { supabase } from '../services/supabase';
import { cache, CACHE_KEYS } from '../services/cache';
import type { BlockedProfile, ChatMessage, Match } from '../types/content';
import type { ProfileMode } from '../types/user';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

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
  sendMessage: (matchId: string, text: string) => void;
  sendVoiceMessage: (matchId: string, uri: string, durationSec: number) => void;
  sendImageMessage: (matchId: string, uri: string) => void;
  markMatchRead: (matchId: string) => void;
  sendRishtaRequest: (matchId: string, requestText: string, acceptedText: string) => void;
  removeMatch: (matchId: string) => void;
  blockMatch: (matchId: string) => void;
  unblockUser: (id: string) => void;
  getOrCreateMatchForProfile: (profile: ProfileRef) => Promise<Match>;
}

const MatchesContext = createContext<MatchesContextValue | undefined>(undefined);

function previewFor(message: ChatMessage): string {
  if (message.kind === 'image') return '📷 Photo';
  if (message.kind === 'voice') return '🎤 Voice message';
  return message.text;
}

/** A `chat_messages` row (snake_case, from PostgreSQL/Realtime) → ChatMessage. */
function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    fromMe: Boolean(row.from_me),
    text: (row.text as string) ?? '',
    sentAt: (row.sent_at as string) ?? new Date().toISOString(),
    kind: (row.kind as ChatMessage['kind']) ?? 'text',
    audioUri: row.audio_path ? String(row.audio_path) : undefined,
    durationSec: typeof row.duration_sec === 'number' ? row.duration_sec : undefined,
    imageUri: row.image_path ? String(row.image_path) : undefined,
  };
}

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [matches, setMatches] = useState<Match[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);

  // Guards the cache write below, so one account's match list can never be
  // persisted under another's key during a sign-out/sign-in.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      setMatches([]);
      setBlockedProfiles([]);
      setChatHistory({});
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

      const [freshMatches, freshBlocked, freshHistory] = await Promise.all([
        matchesService.fetchMatches(userId),
        matchesService.fetchBlocked(userId),
        matchesService.fetchChatHistory(userId),
      ]);
      if (cancelled) return;
      setMatches(freshMatches);
      setBlockedProfiles(freshBlocked);
      setChatHistory(freshHistory);
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

    const channel = supabase
      .channel(`chat_messages_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `profile_id=eq.${userId}` },
        (payload) => applyMessage(rowToMessage(payload.new as Record<string, unknown>))
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

  const pushMessage = (matchId: string, message: ChatMessage, lastMessagePreview: string) => {
    if (!user) return;
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, lastMessage: lastMessagePreview, lastMessageAt: message.sentAt } : m))
    );
    matchesService.updateMatch(user.id, matchId, { lastMessage: lastMessagePreview, lastMessageAt: message.sentAt });
  };

  const sendMessage = (matchId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    matchesService.insertTextMessage(user.id, matchId, true, trimmed).then((message) => pushMessage(matchId, message, trimmed));
  };

  const sendVoiceMessage = (matchId: string, uri: string, durationSec: number) => {
    if (!user) return;
    matchesService
      .insertVoiceMessage(user.id, matchId, uri, durationSec)
      .then((message) => pushMessage(matchId, message, '🎤 Voice message'));
  };

  const sendImageMessage = (matchId: string, uri: string) => {
    if (!user) return;
    matchesService.insertImageMessage(user.id, matchId, uri).then((message) => pushMessage(matchId, message, '📷 Photo'));
  };

  const markMatchRead = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.unread || !user) return;
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, unread: false } : m)));
    matchesService.updateMatch(user.id, matchId, { unread: false });
  };

  // Sends a Move to Rishta request and simulates the other side responding after a
  // short delay. There's no live backend/second user in this app, so a real accept/
  // decline from a counterparty isn't possible — this models the pending state and
  // resolution honestly rather than flipping the match to "moved" instantly.
  const sendRishtaRequest = (matchId: string, requestText: string, acceptedText: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.movedToRishta || match.rishtaRequestPending || !user) return;
    const userId = user.id;

    matchesService.insertTextMessage(userId, matchId, true, requestText).then((message) => pushMessage(matchId, message, requestText));
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, rishtaRequestPending: true } : m)));
    matchesService.updateMatch(userId, matchId, { rishtaRequestPending: true });

    setTimeout(() => {
      matchesService.insertTextMessage(userId, matchId, false, acceptedText).then((acceptedMessage) => {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === matchId && m.rishtaRequestPending
              ? {
                  ...m,
                  // The thread itself crosses over: a friendship match that both
                  // sides moved is a rishta-stage match from here on.
                  mode: 'rishta' as const,
                  movedToRishta: true,
                  rishtaRequestPending: false,
                  lastMessage: acceptedText,
                  lastMessageAt: acceptedMessage.sentAt,
                }
              : m
          )
        );
        matchesService.updateMatch(userId, matchId, {
          mode: 'rishta',
          movedToRishta: true,
          rishtaRequestPending: false,
          lastMessage: acceptedText,
          lastMessageAt: acceptedMessage.sentAt,
        });
        addNotification('rishta_request', match.name, acceptedText);
      });
    }, 2200);
  };

  const removeMatch = (matchId: string) => {
    if (!user) return;
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    matchesService.deleteMatch(user.id, matchId);
  };

  const blockMatch = (matchId: string) => {
    if (!user) return;
    const match = matches.find((m) => m.id === matchId);
    if (match) {
      const blocked: BlockedProfile = {
        id: match.id,
        sourceProfileId: match.sourceProfileId,
        name: match.name,
        photo: match.photo,
        blockedAt: new Date().toISOString(),
      };
      setBlockedProfiles((prev) => [blocked, ...prev]);
      matchesService.blockUser(user.id, blocked);
    }
    removeMatch(matchId);
  };

  const unblockUser = (id: string) => {
    if (!user) return;
    setBlockedProfiles((prev) => prev.filter((b) => b.id !== id));
    matchesService.unblockUser(user.id, id);
  };

  const getOrCreateMatchForProfile = async (profile: ProfileRef): Promise<Match> => {
    const existing = matches.find((m) => m.sourceProfileId === profile.id);
    if (existing) return existing;
    if (!user) throw new Error('Not signed in.');

    const created = await matchesService.createMatch(user.id, {
      name: profile.name,
      photo: profile.photo,
      mode: profile.mode,
      sourceProfileId: profile.id,
    });
    setMatches((prev) => [created, ...prev]);
    return created;
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
      sendMessage,
      sendVoiceMessage,
      sendImageMessage,
      markMatchRead,
      sendRishtaRequest,
      removeMatch,
      blockMatch,
      unblockUser,
      getOrCreateMatchForProfile,
    }),
    [matches, chatHistory, unreadCount, rishtaProfileIds, blockedProfiles, user?.id]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within a MatchesProvider');
  return ctx;
}