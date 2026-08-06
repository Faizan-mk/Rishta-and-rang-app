import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { useAuth } from './AuthContext';

export const DAILY_FREE_LIKES = 15;

interface DailyLikeState {
  date: string;
  count: number;
}

interface LikeLimitContextValue {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  canLike: boolean;
  recordLike: () => boolean;
}

const LikeLimitContext = createContext<LikeLimitContextValue | undefined>(undefined);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LikeLimitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<DailyLikeState>({ date: todayKey(), count: 0 });

  useEffect(() => {
    storage.getJSON<DailyLikeState>(storage.KEYS.dailyLikes, { date: todayKey(), count: 0 }).then((stored) => {
      setState(stored.date === todayKey() ? stored : { date: todayKey(), count: 0 });
    });
  }, []);

  const isUnlimited = Boolean(user?.isExplorePlus);
  const used = state.date === todayKey() ? state.count : 0;
  const remaining = Math.max(DAILY_FREE_LIKES - used, 0);

  const recordLike = (): boolean => {
    if (isUnlimited) return true;
    const current = state.date === todayKey() ? state : { date: todayKey(), count: 0 };
    if (current.count >= DAILY_FREE_LIKES) return false;
    const next = { date: todayKey(), count: current.count + 1 };
    setState(next);
    storage.setJSON(storage.KEYS.dailyLikes, next);
    return true;
  };

  const value = useMemo(
    () => ({
      used,
      limit: DAILY_FREE_LIKES,
      remaining,
      isUnlimited,
      canLike: isUnlimited || used < DAILY_FREE_LIKES,
      recordLike,
    }),
    [used, remaining, isUnlimited, state]
  );

  return <LikeLimitContext.Provider value={value}>{children}</LikeLimitContext.Provider>;
}

export function useLikeLimit(): LikeLimitContextValue {
  const ctx = useContext(LikeLimitContext);
  if (!ctx) throw new Error('useLikeLimit must be used within a LikeLimitProvider');
  return ctx;
}
