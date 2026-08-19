import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../services/storage';
import type { ProfileMode } from '../types/user';

export interface ViewedProfile {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  viewedAt: string;
}

const MAX_HISTORY = 60;

interface ViewHistoryContextValue {
  history: ViewedProfile[];
  recordView: (profile: Omit<ViewedProfile, 'viewedAt'>) => void;
  clearHistory: () => void;
}

const ViewHistoryContext = createContext<ViewHistoryContextValue | undefined>(undefined);

export function ViewHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ViewedProfile[]>([]);
  // Avoids re-recording the same profile over and over while it just sits on screen.
  const lastRecordedId = useRef<string | null>(null);

  useEffect(() => {
    storage.getJSON<ViewedProfile[]>(storage.KEYS.viewHistory, []).then(setHistory);
  }, []);

  const persist = (next: ViewedProfile[]) => {
    setHistory(next);
    storage.setJSON(storage.KEYS.viewHistory, next);
  };

  const recordView = (profile: Omit<ViewedProfile, 'viewedAt'>) => {
    if (lastRecordedId.current === profile.id) return;
    lastRecordedId.current = profile.id;
    setHistory((prev) => {
      const next = [{ ...profile, viewedAt: new Date().toISOString() }, ...prev.filter((p) => p.id !== profile.id)].slice(
        0,
        MAX_HISTORY
      );
      storage.setJSON(storage.KEYS.viewHistory, next);
      return next;
    });
  };

  const clearHistory = () => persist([]);

  const value = useMemo(() => ({ history, recordView, clearHistory }), [history]);

  return <ViewHistoryContext.Provider value={value}>{children}</ViewHistoryContext.Provider>;
}

export function useViewHistory(): ViewHistoryContextValue {
  const ctx = useContext(ViewHistoryContext);
  if (!ctx) throw new Error('useViewHistory must be used within a ViewHistoryProvider');
  return ctx;
}
