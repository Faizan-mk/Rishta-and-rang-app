import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { favoritesService } from '../services/favoritesService';
import { likesService } from '../services/likesService';
import { cache, CACHE_KEYS } from '../services/cache';
import { AppError } from '../utils/appError';
import type { FavoriteProfile, Match } from '../types/content';
import { useAuth } from './AuthContext';
import { useMatches } from './MatchesContext';

export type { FavoriteProfile };

interface FavoritesContextValue {
  favorites: FavoriteProfile[];
  /** Saved to Favorites: a private bookmark, nothing sent to them. */
  isFavorite: (id: string) => boolean;
  /** Liked them (or matched, which takes two likes). */
  isLiked: (id: string) => boolean;
  /** Everyone liked, as ids: server likes plus matches. For History's Liked list. */
  likedIdList: string[];
  /**
   * Likes or un-likes a member. Liking resolves with the conversation if that
   * completed the pair — `isNew` true only on the call that formed it, which is
   * what a celebration may fire on. Un-liking resolves with null.
   */
  toggleLike: (
    profile: FavoriteProfile
  ) => Promise<{ match: Match | null; isNew: boolean; likesLeft: number } | null>;
  /** Saves to or drops from Favorites. Never likes, notifies or counts a like. */
  toggleFavorite: (profile: FavoriteProfile) => void;
  removeFavorite: (id: string) => void;
  /** Empties Favorites. Likes are untouched. */
  clearFavorites: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

function withoutId(set: Set<string>, id: string): Set<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { rishtaProfileIds, likeProfile, matches } = useMatches();
  const [favorites, setFavorites] = useState<FavoriteProfile[]>([]);
  // Who this member has actually liked, straight from the server. A like is
  // what "liked" means on a card; a favourite row can be missing one (it's
  // written separately, and Favorites can drop it without un-liking).
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Guards the cache write below, so one account's favourites can never be
  // persisted under another's key during a sign-out/sign-in.
  const hydratedFor = useRef<string | null>(null);
  // Bumped by every add/remove/clear made here. The server copy fetched on
  // sign-in only lands if nothing changed while it was on its way; otherwise
  // it would put back what was just removed (a Clear right after opening the
  // app came back a moment later).
  const localEdits = useRef(0);

  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      setFavorites([]);
      setLikedIds(new Set());
      return;
    }
    const userId = user.id;
    let cancelled = false;
    likesService
      .fetchMyLikedIds()
      .then((ids) => {
        if (!cancelled) setLikedIds(new Set(ids));
      })
      .catch(() => undefined);
    (async () => {
      const cached = await cache.read<FavoriteProfile[]>(userId, CACHE_KEYS.favorites);
      if (cancelled) return;
      if (cached) {
        setFavorites(cached);
        hydratedFor.current = userId;
      }
      const editsBefore = localEdits.current;
      const fresh = await favoritesService.fetchFavorites(userId);
      if (cancelled) return;
      if (localEdits.current === editsBefore) setFavorites(fresh);
      hydratedFor.current = userId;
    })().catch(() => {
      // Offline: whatever the cache gave us stays on screen.
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Local toggles land here too, so the cache keeps step without every handler
  // having to remember to write it.
  useEffect(() => {
    if (!user || hydratedFor.current !== user.id) return;
    cache.write(user.id, CACHE_KEYS.favorites, favorites);
  }, [user?.id, favorites]);

  // A favourite is tagged with whichever deck it was saved from, so without this
  // it would keep showing "Friends" long after the conversation crossed over.
  useEffect(() => {
    if (!user || hydratedFor.current !== user.id) return;
    const crossed = favorites.filter((f) => f.kind === 'dating' && rishtaProfileIds.has(f.id));
    if (crossed.length === 0) return;
    setFavorites((prev) =>
      prev.map((f) => (f.kind === 'dating' && rishtaProfileIds.has(f.id) ? { ...f, kind: 'rishta' } : f))
    );
    crossed.forEach((f) => {
      favoritesService.updateFavoriteKind(user.id, f.id, 'rishta').catch(() => undefined);
    });
  }, [rishtaProfileIds, favorites, user?.id]);

  // A match only forms from two likes, so anyone matched was liked too; that
  // holds even before my_liked_ids is deployed or has answered.
  const matchedIds = useMemo(
    () => new Set(matches.map((m) => m.sourceProfileId).filter((id): id is string => typeof id === 'string')),
    [matches]
  );
  // Like and Favourite are separate now. A star used to send a like (and its
  // notification, and count against the daily cap), and a like filled the star;
  // a bookmark someone meant to keep to themselves told the other person.
  const isLiked = (id: string) => likedIds.has(id) || matchedIds.has(id);
  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const toggleLike = async (profile: FavoriteProfile) => {
    if (!user) return null;
    // Already matched: the heart shows filled and stays that way. Withdrawing
    // the like here would leave the conversation standing with half its basis
    // gone; ending a match is block / unmatch, not a second tap on Like.
    if (matchedIds.has(profile.id)) return null;
    if (isLiked(profile.id)) {
      setLikedIds((prev) => withoutId(prev, profile.id));
      // Taking a like back also takes it off the other member's "who liked you".
      likesService.withdrawLike(profile.id, user.id).catch(() => undefined);
      return null;
    }
    // One call does the like, the reciprocity check and the match. The card the
    // other side sees in "who liked you" is copied from our own profile inside
    // the RPC, so there is nothing to pass and nothing to disagree with.
    setLikedIds((prev) => new Set(prev).add(profile.id));
    try {
      return await likeProfile({ id: profile.id, name: profile.name, photo: profile.photo, mode: profile.kind });
    } catch (error) {
      // The cap is enforced server-side, so this is where hitting it surfaces.
      // Take the like back off — nothing was recorded — and let the caller
      // decide what to show.
      const reason = error instanceof Error ? error.message : '';
      if (reason.includes('daily_like_limit_reached')) {
        setLikedIds((prev) => withoutId(prev, profile.id));
        throw new AppError('discover.limitReachedBody');
      }
      // Offline, or refused for another reason. The like stands locally; the
      // caller simply learns of no match.
      return null;
    }
  };

  const toggleFavorite = (profile: FavoriteProfile) => {
    if (!user) return;
    localEdits.current += 1;
    if (isFavorite(profile.id)) {
      setFavorites((prev) => prev.filter((f) => f.id !== profile.id));
      favoritesService.removeFavorite(user.id, profile.id);
      return;
    }
    setFavorites((prev) => [profile, ...prev]);
    favoritesService.addFavorite(user.id, profile);
  };

  const removeFavorite = (id: string) => {
    if (!user) return;
    localEdits.current += 1;
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    favoritesService.removeFavorite(user.id, id);
  };

  const clearFavorites = () => {
    if (!user) return;
    const before = favorites;
    localEdits.current += 1;
    setFavorites([]);
    // One request for the lot. If it fails they're put back, rather than
    // looking cleared now and reappearing on the next launch.
    favoritesService.removeAllFavorites(user.id).catch(() => {
      localEdits.current += 1;
      setFavorites(before);
    });
  };

  const value = useMemo(
    () => ({
      favorites,
      isFavorite,
      isLiked,
      likedIdList: [...new Set([...likedIds, ...matchedIds])],
      toggleLike,
      toggleFavorite,
      removeFavorite,
      clearFavorites,
    }),
    [favorites, likedIds, matchedIds, user?.id]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
