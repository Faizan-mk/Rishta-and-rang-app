import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { likeLimitService, DailyLikeState } from '../services/likeLimitService';
import { useAuth } from './AuthContext';

export const DAILY_FREE_LIKES = 15;

interface LikeLimitContextValue {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  canLike: boolean;
  /**
   * Optimistic pre-check, so the paywall appears without a round trip. It is
   * not the enforcement — `like_profile` counts and refuses server-side
   * (supabase/29_entitlements.sql) — and `applyServerCount` reconciles this
   * against what the server actually recorded.
   */
  recordLike: () => boolean;
  /** `likes_left` as the RPC reported it; -1 means unlimited. */
  applyServerCount: (likesLeft: number) => void;
}

const LikeLimitContext = createContext<LikeLimitContextValue | undefined>(undefined);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LikeLimitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<DailyLikeState>({ date: todayKey(), count: 0 });

  useEffect(() => {
    if (!user) {
      setState({ date: todayKey(), count: 0 });
      return;
    }
    likeLimitService.fetchState(user.id).then((stored) => {
      setState(stored && stored.date === todayKey() ? stored : { date: todayKey(), count: 0 });
    });
  }, [user?.id]);

  const isUnlimited = Boolean(user?.isExplorePlus);
  const used = state.date === todayKey() ? state.count : 0;
  const remaining = Math.max(DAILY_FREE_LIKES - used, 0);

  const recordLike = (): boolean => {
    if (isUnlimited) return true;
    if (!user) return false;
    const current = state.date === todayKey() ? state : { date: todayKey(), count: 0 };
    if (current.count >= DAILY_FREE_LIKES) return false;
    // Local only. The row itself is written by the RPC — this table has no
    // update policy any more, so a write from here would silently do nothing.
    setState({ date: todayKey(), count: current.count + 1 });
    return true;
  };

  const applyServerCount = (likesLeft: number) => {
    if (likesLeft < 0) return; // unlimited; the count is not kept for them
    setState({ date: todayKey(), count: Math.max(DAILY_FREE_LIKES - likesLeft, 0) });
  };

  const value = useMemo(
    () => ({
      used,
      limit: DAILY_FREE_LIKES,
      remaining,
      isUnlimited,
      canLike: isUnlimited || used < DAILY_FREE_LIKES,
      recordLike,
      applyServerCount,
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
