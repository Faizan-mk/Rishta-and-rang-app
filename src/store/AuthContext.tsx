import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService, SignupInput } from '../services/authService';
import { supabase } from '../services/supabase';
import { cache, CACHE_KEYS } from '../services/cache';
import type { Intent, ProfileMode, RishtaReadiness, UserProfile } from '../types/user';

interface AuthContextValue {
  user: UserProfile | null;
  initializing: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updated: UserProfile) => Promise<void>;
  setActiveMode: (mode: ProfileMode) => void;
  setIntent: (intent: Intent) => void;
  setReadiness: (readiness: RishtaReadiness) => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  // signup/login drive `user` themselves. Supabase fires onAuthStateChange the
  // instant the credential is created — before signup has written the profile
  // rows — so without this guard the listener would read back "no profile"
  // and kick the user out of the flow they're halfway through.
  const authActionInFlight = useRef(false);
  // getSession() and the SIGNED_IN listener can both fire for the same restored
  // session; this keeps the profile fetch single-flight across them.
  const hydratingId = useRef<string | null>(null);

  const hydrate = useCallback(async (userId: string) => {
    if (hydratingId.current === userId) return;
    hydratingId.current = userId;

    // Show the last known profile immediately, so a returning user lands in the
    // app instead of on the splash while the rows come down the wire. The fresh
    // copy replaces it a moment later.
    // Fire-and-forget: the badge other members see is only as honest as this.
    authService.touchLastActive(userId).catch(() => undefined);

    const cached = await cache.read<UserProfile>(userId, CACHE_KEYS.profile);
    if (cached) {
      setUser(cached);
      setInitializing(false);
    }
    try {
      const fresh = await authService.getCurrentUser();
      setUser(fresh);
      if (fresh) await cache.write(userId, CACHE_KEYS.profile, fresh);
    } catch {
      // Offline with a cached profile is a usable state; offline without one
      // is not, so only that case falls back to signed-out.
      if (!cached) setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Session is restored asynchronously, so this listener plus getSession()
    // tells us whether there was a session at all, and catches session loss we
    // didn't initiate (revoked or expired credentials → SIGNED_OUT).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'TOKEN_REFRESHED') return;
      if (authActionInFlight.current) return;
      if (!session?.user) {
        setUser(null);
        setInitializing(false);
        return;
      }
      hydrate(session.user.id);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session?.user) {
        setUser(null);
        setInitializing(false);
        return;
      }
      hydrate(session.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrate]);

  const runAuthAction = useCallback(async (action: () => Promise<UserProfile | null>) => {
    authActionInFlight.current = true;
    try {
      const next = await action();
      setUser(next);
      if (next) await cache.write(next.id, CACHE_KEYS.profile, next);
    } finally {
      authActionInFlight.current = false;
      setInitializing(false);
    }
  }, []);

  const signup = useCallback(
    async (input: SignupInput) => runAuthAction(() => authService.signup(input)),
    [runAuthAction]
  );

  const login = useCallback(
    async (email: string, password: string) => runAuthAction(() => authService.login(email, password)),
    [runAuthAction]
  );

  const logout = useCallback(async () => {
    const userId = user?.id;
    await authService.logout();
    setUser(null);
    // Nothing of one account may survive into the next sign-in on this device.
    if (userId) await cache.clearUser(userId);
  }, [user]);

  const updateUser = useCallback(async (updated: UserProfile) => {
    const saved = await authService.updateUser(updated);
    setUser(saved);
    await cache.write(saved.id, CACHE_KEYS.profile, saved);
  }, []);

  // The toggle has to move on the tap, not on the round trip: state and cache
  // flip immediately and the one-field write follows behind. If that write
  // fails the old value goes back, rather than leaving the UI showing a mode
  // the server never accepted.
  const setActiveMode = useCallback(
    (mode: ProfileMode) => {
      if (!user || user.activeMode === mode) return;
      const previous = user;
      const optimistic = { ...user, activeMode: mode };
      setUser(optimistic);
      cache.write(optimistic.id, CACHE_KEYS.profile, optimistic);
      authService.setActiveMode(optimistic.id, mode).catch(() => {
        setUser(previous);
        cache.write(previous.id, CACHE_KEYS.profile, previous);
      });
    },
    [user]
  );

  // Same optimistic shape as setActiveMode: the chip moves on the tap, the
  // one-field write follows, and a failure puts the old value back.
  const setIntent = useCallback(
    (intent: Intent) => {
      if (!user || user.intent === intent) return;
      const previous = user;
      // Intent picks the deck: matrimonial browses rishta, everything else dating.
      const activeMode: ProfileMode = intent === 'matrimonial' ? 'rishta' : 'dating';
      const optimistic = { ...user, intent, activeMode };
      setUser(optimistic);
      cache.write(optimistic.id, CACHE_KEYS.profile, optimistic);
      authService.setIntent(optimistic.id, intent, activeMode).catch(() => {
        setUser(previous);
        cache.write(previous.id, CACHE_KEYS.profile, previous);
      });
    },
    [user]
  );

  const setReadiness = useCallback(
    (readiness: RishtaReadiness) => {
      if (!user || user.rishta.readiness === readiness) return;
      const previous = user;
      const optimistic = { ...user, rishta: { ...user.rishta, readiness } };
      setUser(optimistic);
      cache.write(optimistic.id, CACHE_KEYS.profile, optimistic);
      authService.setReadiness(optimistic.id, readiness).catch(() => {
        setUser(previous);
        cache.write(previous.id, CACHE_KEYS.profile, previous);
      });
    },
    [user]
  );

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await authService.deleteAccount(user.id);
    setUser(null);
    await cache.clearUser(user.id);
  }, [user]);

  const value = useMemo(
    () => ({ user, initializing, signup, login, logout, updateUser, setActiveMode, setIntent, setReadiness, deleteAccount }),
    [user, initializing, signup, login, logout, updateUser, setActiveMode, setIntent, setReadiness, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}