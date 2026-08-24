import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { viewHistoryService } from '../services/viewHistoryService';
import type { ViewedProfile } from '../types/content';
import { useAuth } from './AuthContext';

export type { ViewedProfile };

interface ViewHistoryContextValue {
  history: ViewedProfile[];
  recordView: (profile: Omit<ViewedProfile, 'viewedAt'>) => void;
  clearHistory: () => void;
}

const ViewHistoryContext = createContext<ViewHistoryContextValue | undefined>(undefined);

export function ViewHistoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<ViewedProfile[]>([]);
  // Avoids re-recording the same profile over and over while it just sits on screen.
  const lastRecordedId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    viewHistoryService.fetchHistory(user.id).then(setHistory);
  }, [user?.id]);

  const recordView = (profile: Omit<ViewedProfile, 'viewedAt'>) => {
    if (!user || lastRecordedId.current === profile.id) return;
    lastRecordedId.current = profile.id;
    const viewedAt = new Date().toISOString();
    setHistory((prev) => [{ ...profile, viewedAt }, ...prev.filter((p) => p.id !== profile.id)]);
    viewHistoryService.recordView(user.id, profile);
  };

  const clearHistory = () => {
    if (!user) return;
    setHistory([]);
    viewHistoryService.clearHistory(user.id);
  };

  const value = useMemo(() => ({ history, recordView, clearHistory }), [history, user?.id]);

  return <ViewHistoryContext.Provider value={value}>{children}</ViewHistoryContext.Provider>;
}

export function useViewHistory(): ViewHistoryContextValue {
  const ctx = useContext(ViewHistoryContext);
  if (!ctx) throw new Error('useViewHistory must be used within a ViewHistoryProvider');
  return ctx;
}
