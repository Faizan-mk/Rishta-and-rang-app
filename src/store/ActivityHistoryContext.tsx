import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cache, CACHE_KEYS } from '../services/cache';
import type { ProfileMode } from '../types/user';
import { useAuth } from './AuthContext';

// What this member did to other profiles, for Explore's History tab: who they
// passed and who they sent a compliment to. Neither is readable back from the
// server — a pass is never recorded there, and `profile_notes` has no select
// policy by design (supabase/41_profile_notes.sql) — so both are kept on this
// device, per account. Likes and favourites have their own sources of truth
// (FavoritesContext) and aren't duplicated here.

export interface ActivityEntry {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  at: string;
  // The compliment's text; only on compliment entries.
  note?: string;
}

// Kept long enough to be a history, short enough not to grow without end.
const MAX_ENTRIES = 200;
const NEVER_EXPIRES = Number.POSITIVE_INFINITY;

interface ActivityHistoryContextValue {
  passed: ActivityEntry[];
  compliments: ActivityEntry[];
  recordPass: (profile: Omit<ActivityEntry, 'at' | 'note'>) => void;
  recordCompliment: (profile: Omit<ActivityEntry, 'at' | 'note'>, note: string) => void;
  clearPassed: () => void;
  /** Clears the list only; the notes themselves stay sent. */
  clearCompliments: () => void;
  /**
   * Liked people taken off History's Liked list. Only the list: the likes
   * stand, so matches and "who liked you" are unaffected. Liking someone
   * again brings them back (`unhideLiked`).
   */
  hiddenLiked: Set<string>;
  clearLiked: (ids: string[]) => void;
  unhideLiked: (id: string) => void;
}

const ActivityHistoryContext = createContext<ActivityHistoryContextValue | undefined>(undefined);

function firstById(entry: ActivityEntry, index: number, all: ActivityEntry[]): boolean {
  return all.findIndex((e) => e.id === entry.id) === index;
}

function prepend(list: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
}

export function ActivityHistoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [passed, setPassed] = useState<ActivityEntry[]>([]);
  const [compliments, setCompliments] = useState<ActivityEntry[]>([]);
  const [hiddenLiked, setHiddenLiked] = useState<Set<string>>(new Set());
  // Writes wait until this account's lists have loaded, so a sign-in never
  // saves an empty list over the one already on the device.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    loadedFor.current = null;
    setPassed([]);
    setCompliments([]);
    setHiddenLiked(new Set());
    if (!user) return;
    const userId = user.id;
    let cancelled = false;
    Promise.all([
      cache.read<ActivityEntry[]>(userId, CACHE_KEYS.passed, NEVER_EXPIRES),
      cache.read<ActivityEntry[]>(userId, CACHE_KEYS.compliments, NEVER_EXPIRES),
      cache.read<string[]>(userId, CACHE_KEYS.likedHidden, NEVER_EXPIRES),
    ]).then(([p, c, h]) => {
      if (cancelled) return;
      // Merged, not replaced: a pass made in the moment before the saved list
      // finished loading stays on top instead of being overwritten.
      setPassed((prev) => [...prev, ...(p ?? [])].filter(firstById).slice(0, MAX_ENTRIES));
      setCompliments((prev) => [...prev, ...(c ?? [])].filter(firstById).slice(0, MAX_ENTRIES));
      setHiddenLiked((prev) => new Set([...prev, ...(h ?? [])]));
      loadedFor.current = userId;
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (user && loadedFor.current === user.id) cache.write(user.id, CACHE_KEYS.passed, passed);
  }, [user?.id, passed]);
  useEffect(() => {
    if (user && loadedFor.current === user.id) cache.write(user.id, CACHE_KEYS.compliments, compliments);
  }, [user?.id, compliments]);
  useEffect(() => {
    if (user && loadedFor.current === user.id) cache.write(user.id, CACHE_KEYS.likedHidden, [...hiddenLiked]);
  }, [user?.id, hiddenLiked]);

  const value = useMemo<ActivityHistoryContextValue>(
    () => ({
      passed,
      compliments,
      recordPass: (profile) => setPassed((prev) => prepend(prev, { ...profile, at: new Date().toISOString() })),
      recordCompliment: (profile, note) =>
        setCompliments((prev) => prepend(prev, { ...profile, at: new Date().toISOString(), note })),
      clearPassed: () => setPassed([]),
      clearCompliments: () => setCompliments([]),
      hiddenLiked,
      clearLiked: (ids) => setHiddenLiked((prev) => new Set([...prev, ...ids])),
      unhideLiked: (id) =>
        setHiddenLiked((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    }),
    [passed, compliments, hiddenLiked]
  );

  return <ActivityHistoryContext.Provider value={value}>{children}</ActivityHistoryContext.Provider>;
}

export function useActivityHistory(): ActivityHistoryContextValue {
  const ctx = useContext(ActivityHistoryContext);
  if (!ctx) throw new Error('useActivityHistory must be used within an ActivityHistoryProvider');
  return ctx;
}
