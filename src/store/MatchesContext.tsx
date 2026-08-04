import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { mockMatches, mockChatHistory } from '../data/mockMatches';
import type { ChatMessage, Match } from '../types/content';
import type { ProfileMode } from '../types/user';

interface ProfileRef {
  id: string;
  name: string;
  photo: string;
  mode: ProfileMode;
}

interface MatchesContextValue {
  matches: Match[];
  chatHistory: Record<string, ChatMessage[]>;
  unreadCount: number;
  getMatch: (matchId: string) => Match | undefined;
  getMessages: (matchId: string) => ChatMessage[];
  sendMessage: (matchId: string, text: string) => void;
  markMatchRead: (matchId: string) => void;
  setMovedToRishta: (matchId: string, value: boolean) => void;
  removeMatch: (matchId: string) => void;
  getOrCreateMatchForProfile: (profile: ProfileRef) => Match;
}

const MatchesContext = createContext<MatchesContextValue | undefined>(undefined);

function newMatchId(): string {
  return `match_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>(mockChatHistory);

  useEffect(() => {
    storage.getJSON(storage.KEYS.matches, mockMatches).then(setMatches);
    storage.getJSON(storage.KEYS.chatHistory, mockChatHistory).then(setChatHistory);
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

  const sendMessage = (matchId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      matchId,
      fromMe: true,
      text: trimmed,
      sentAt: new Date().toISOString(),
    };
    persistChatHistory({ ...chatHistory, [matchId]: [...(chatHistory[matchId] ?? []), message] });
    persistMatches(
      matches.map((m) => (m.id === matchId ? { ...m, lastMessage: trimmed, lastMessageAt: message.sentAt } : m))
    );
  };

  const markMatchRead = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.unread) return;
    persistMatches(matches.map((m) => (m.id === matchId ? { ...m, unread: false } : m)));
  };

  const setMovedToRishta = (matchId: string, value: boolean) => {
    persistMatches(matches.map((m) => (m.id === matchId ? { ...m, movedToRishta: value } : m)));
  };

  const removeMatch = (matchId: string) => {
    persistMatches(matches.filter((m) => m.id !== matchId));
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
      getMatch,
      getMessages,
      sendMessage,
      markMatchRead,
      setMovedToRishta,
      removeMatch,
      getOrCreateMatchForProfile,
    }),
    [matches, chatHistory, unreadCount]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within a MatchesProvider');
  return ctx;
}
