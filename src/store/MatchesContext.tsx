import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { mockMatches, mockChatHistory } from '../data/mockMatches';
import type { ChatMessage, Match } from '../types/content';
import type { ProfileMode } from '../types/user';
import { useNotifications } from './NotificationContext';

interface ProfileRef {
  id: string;
  name: string;
  photo: string;
  mode: ProfileMode;
}

export interface BlockedProfile {
  id: string;
  // Links back to the Discover/Rishta listing this block originated from (if any),
  // so Discover/Rishta decks can exclude the profile even though `id` here is the
  // match's own id, not the listing's.
  sourceProfileId?: string;
  name: string;
  photo: string;
  blockedAt: string;
}

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
  getOrCreateMatchForProfile: (profile: ProfileRef) => Match;
}

const MatchesContext = createContext<MatchesContextValue | undefined>(undefined);

function newMatchId(): string {
  return `match_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const { addNotification } = useNotifications();
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>(mockChatHistory);
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);

  useEffect(() => {
    storage.getJSON(storage.KEYS.matches, mockMatches).then(setMatches);
    storage.getJSON(storage.KEYS.chatHistory, mockChatHistory).then(setChatHistory);
    storage.getJSON<BlockedProfile[]>(storage.KEYS.blockedUsers, []).then(setBlockedProfiles);
  }, []);

  const persistMatches = (next: Match[]) => {
    setMatches(next);
    storage.setJSON(storage.KEYS.matches, next);
  };

  const persistChatHistory = (next: Record<string, ChatMessage[]>) => {
    setChatHistory(next);
    storage.setJSON(storage.KEYS.chatHistory, next);
  };

  const getMatch = (matchId: string) => matches.find((m) => m.id === matchId);
  const getMessages = (matchId: string) => chatHistory[matchId] ?? [];

  const pushMessage = (matchId: string, message: ChatMessage, lastMessagePreview: string) => {
    persistChatHistory({ ...chatHistory, [matchId]: [...(chatHistory[matchId] ?? []), message] });
    persistMatches(
      matches.map((m) => (m.id === matchId ? { ...m, lastMessage: lastMessagePreview, lastMessageAt: message.sentAt } : m))
    );
  };

  const sendMessage = (matchId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      matchId,
      fromMe: true,
      text: trimmed,
      sentAt: new Date().toISOString(),
      kind: 'text',
    };
    pushMessage(matchId, message, trimmed);
  };

  const sendVoiceMessage = (matchId: string, uri: string, durationSec: number) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      matchId,
      fromMe: true,
      text: '',
      sentAt: new Date().toISOString(),
      kind: 'voice',
      audioUri: uri,
      durationSec,
    };
    pushMessage(matchId, message, '🎤 Voice message');
  };

  const sendImageMessage = (matchId: string, uri: string) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      matchId,
      fromMe: true,
      text: '',
      sentAt: new Date().toISOString(),
      kind: 'image',
      imageUri: uri,
    };
    pushMessage(matchId, message, '📷 Photo');
  };

  const markMatchRead = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.unread) return;
    persistMatches(matches.map((m) => (m.id === matchId ? { ...m, unread: false } : m)));
  };

  // Sends a Move to Rishta request and simulates the other side responding after a
  // short delay. There's no live backend/second user in this app, so a real accept/
  // decline from a counterparty isn't possible — this models the pending state and
  // resolution honestly rather than flipping the match to "moved" instantly.
  const sendRishtaRequest = (matchId: string, requestText: string, acceptedText: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.movedToRishta || match.rishtaRequestPending) return;

    const requestMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      matchId,
      fromMe: true,
      text: requestText,
      sentAt: new Date().toISOString(),
      kind: 'text',
    };
    pushMessage(matchId, requestMessage, requestText);
    persistMatches(matches.map((m) => (m.id === matchId ? { ...m, rishtaRequestPending: true } : m)));

    setTimeout(() => {
      const acceptedMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        matchId,
        fromMe: false,
        text: acceptedText,
        sentAt: new Date().toISOString(),
        kind: 'text',
      };
      setChatHistory((prev) => {
        const next = { ...prev, [matchId]: [...(prev[matchId] ?? []), acceptedMessage] };
        storage.setJSON(storage.KEYS.chatHistory, next);
        return next;
      });
      setMatches((prev) => {
        const next = prev.map((m) =>
          m.id === matchId && m.rishtaRequestPending
            ? { ...m, movedToRishta: true, rishtaRequestPending: false, lastMessage: acceptedText, lastMessageAt: acceptedMessage.sentAt }
            : m
        );
        storage.setJSON(storage.KEYS.matches, next);
        return next;
      });
      addNotification('rishta_request', match.name, acceptedText);
    }, 2200);
  };

  const removeMatch = (matchId: string) => {
    persistMatches(matches.filter((m) => m.id !== matchId));
  };

  const persistBlocked = (next: BlockedProfile[]) => {
    setBlockedProfiles(next);
    storage.setJSON(storage.KEYS.blockedUsers, next);
  };

  const blockMatch = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (match) {
      persistBlocked([
        {
          id: match.id,
          sourceProfileId: match.sourceProfileId,
          name: match.name,
          photo: match.photo,
          blockedAt: new Date().toISOString(),
        },
        ...blockedProfiles,
      ]);
    }
    removeMatch(matchId);
  };

  const unblockUser = (id: string) => {
    persistBlocked(blockedProfiles.filter((b) => b.id !== id));
  };

  const getOrCreateMatchForProfile = (profile: ProfileRef): Match => {
    const existing = matches.find((m) => m.sourceProfileId === profile.id);
    if (existing) return existing;

    const created: Match = {
      id: newMatchId(),
      name: profile.name,
      photo: profile.photo,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unread: false,
      mode: profile.mode,
      movedToRishta: false,
      sourceProfileId: profile.id,
    };
    persistMatches([created, ...matches]);
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
    [matches, chatHistory, unreadCount, blockedProfiles]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within a MatchesProvider');
  return ctx;
}
