import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { boostService, type BoostState } from '../services/boostService';
import { useAuth } from './AuthContext';

// How long one boost runs, and how much reach it claims — both shown in the boost sheet.
export const BOOST_DURATION_HOURS = 3;
export const BOOST_MULTIPLIER = 11;
// What a new member starts with before buying any.
export const STARTING_BOOSTS = 3;

const BOOST_DURATION_MS = BOOST_DURATION_HOURS * 60 * 60 * 1000;

interface BoostContextValue {
  boostsLeft: number;
  // Null when nothing is running; otherwise when the running boost ends.
  activeUntil: Date | null;
  isBoostActive: boolean;
  // Consumes one boost. Returns false when there is none left or one is already running.
  startBoost: () => boolean;
  // Used by the paywall once a purchase goes through.
  addBoosts: (count: number) => void;
}

const BoostContext = createContext<BoostContextValue | undefined>(undefined);

const EMPTY: BoostState = { boostsLeft: STARTING_BOOSTS, activeUntil: null };

export function BoostProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<BoostState>(EMPTY);

  useEffect(() => {
    if (!user) {
      setState(EMPTY);
      return;
    }
    boostService.fetchState(user.id).then((stored) => setState(stored ?? EMPTY));
  }, [user?.id]);

  const activeUntilMs = state.activeUntil ? new Date(state.activeUntil).getTime() : 0;
  const isBoostActive = activeUntilMs > Date.now();

  // Flip the UI back to the idle state the moment the running boost expires,
  // without polling every second.
  useEffect(() => {
    if (!isBoostActive) return;
    const timer = setTimeout(() => setState((s) => ({ ...s, activeUntil: null })), activeUntilMs - Date.now());
    return () => clearTimeout(timer);
  }, [isBoostActive, activeUntilMs]);

  const persist = useCallback(
    (next: BoostState) => {
      setState(next);
      if (user) boostService.setState(user.id, next).catch(() => undefined);
    },
    [user?.id]
  );

  const startBoost = useCallback((): boolean => {
    if (isBoostActive || state.boostsLeft <= 0) return false;
    persist({
      boostsLeft: state.boostsLeft - 1,
      activeUntil: new Date(Date.now() + BOOST_DURATION_MS).toISOString(),
    });
    return true;
  }, [isBoostActive, state.boostsLeft, persist]);

  const addBoosts = useCallback(
    (count: number) => {
      persist({ ...state, boostsLeft: state.boostsLeft + count });
    },
    [state, persist]
  );

  const value = useMemo(
    () => ({
      boostsLeft: state.boostsLeft,
      activeUntil: isBoostActive ? new Date(activeUntilMs) : null,
      isBoostActive,
      startBoost,
      addBoosts,
    }),
    [state.boostsLeft, isBoostActive, activeUntilMs, startBoost, addBoosts]
  );

  return <BoostContext.Provider value={value}>{children}</BoostContext.Provider>;
}

export function useBoost(): BoostContextValue {
  const ctx = useContext(BoostContext);
  if (!ctx) throw new Error('useBoost must be used within a BoostProvider');
  return ctx;
}
