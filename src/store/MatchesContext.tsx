import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { matchesService } from '../services/matchesService';
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

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [matches, setMatches] = useState<Match[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);

  useEffect(() => {
    if (!user) {
      setMatches([]);
      setChatHistory({});
      setBlockedProfiles([]);
      return;
    }
    matchesService.fetchMatches(user.id).then(setMatches);
    matchesService.fetchChatHistory(user.id).then(setChatHistory);
    matchesService.fetchBlocked(user.id).then(setBlockedProfiles);
  }, [user?.id]);

  const getMatch = (matchId: string) => matches.find((m) => m.id === matchId);
  const getMessages = (matchId: string) => chatHistory[matchId] ?? [];

  const pushMessage = (matchId: string, message: ChatMessage, lastMessagePreview: string) => {
    setChatHistory((prev) => ({ ...prev, [matchId]: [...(prev[matchId] ?? []), message] }));
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, lastMessage: lastMessagePreview, lastMessageAt: message.sentAt } : m))
    );
    matchesService.updateMatch(matchId, { last_message: lastMessagePreview, last_message_at: message.sentAt });
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
    if (!match || !match.unread) return;
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, unread: false } : m)));
    matchesService.updateMatch(matchId, { unread: false });
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
    matchesService.updateMatch(matchId, { rishta_request_pending: true });

    setTimeout(() => {
      matchesService.insertTextMessage(userId, matchId, false, acceptedText).then((acceptedMessage) => {
        setChatHistory((prev) => ({ ...prev, [matchId]: [...(prev[matchId] ?? []), acceptedMessage] }));
        setMatches((prev) =>
          prev.map((m) =>
            m.id === matchId && m.rishtaRequestPending
              ? { ...m, movedToRishta: true, rishtaRequestPending: false, lastMessage: acceptedText, lastMessageAt: acceptedMessage.sentAt }
              : m
          )
        );
        matchesService.updateMatch(matchId, {
          moved_to_rishta: true,
          rishta_request_pending: false,
          last_message: acceptedText,
          last_message_at: acceptedMessage.sentAt,
        });
        addNotification('rishta_request', match.name, acceptedText);
      });
    }, 2200);
  };

  const removeMatch = (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    matchesService.deleteMatch(matchId);
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

  const value = useMemo(
    () => ({
      matches,
      chatHistory,
      unreadCount,
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
    [matches, chatHistory, unreadCount, blockedProfiles, user?.id]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within a MatchesProvider');
  return ctx;
}
