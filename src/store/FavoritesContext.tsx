import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { favoritesService } from '../services/favoritesService';
import { likesService } from '../services/likesService';
import { ageFromDob } from '../utils/date';
import { cache, CACHE_KEYS } from '../services/cache';
import type { FavoriteProfile } from '../types/content';
import { useAuth } from './AuthContext';
import { useMatches } from './MatchesContext';

export type { FavoriteProfile };

interface FavoritesContextValue {
  favorites: FavoriteProfile[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (profile: FavoriteProfile) => void;
  removeFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { rishtaProfileIds, checkForMatch } = useMatches();
  const [favorites, setFavorites] = useState<FavoriteProfile[]>([]);

  // Guards the cache write below, so one account's favourites can never be
  // persisted under another's key during a sign-out/sign-in.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      setFavorites([]);
      return;
    }
    const userId = user.id;
    let cancelled = false;
    (async () => {
      const cached = await cache.read<FavoriteProfile[]>(userId, CACHE_KEYS.favorites);
      if (cancelled) return;
      if (cached) {
        setFavorites(cached);
        hydratedFor.current = userId;
      }
      const fresh = await favoritesService.fetchFavorites(userId);
      if (cancelled) return;
      setFavorites(fresh);
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

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const toggleFavorite = (profile: FavoriteProfile) => {
    if (!user) return;
    if (isFavorite(profile.id)) {
      setFavorites((prev) => prev.filter((f) => f.id !== profile.id));
      favoritesService.removeFavorite(user.id, profile.id);
      // Taking a like back also takes it off the other member's "who liked you".
      likesService.withdrawLike(profile.id, user.id).catch(() => undefined);
    } else {
      setFavorites((prev) => [profile, ...prev]);
      favoritesService.addFavorite(user.id, profile);
      // The other side can't read our favourites, so the like is mirrored onto
      // their own record — that list is what Explore+ unlocks.
      likesService
        .sendLike(profile.id, {
          id: user.id,
          kind: profile.kind,
          name: user.fullName,
          age: ageFromDob(user.dob) ?? 0,
          city: user.city ?? '',
          photo: user.photos?.[0] ?? '',
        })
        // A like is half a match. If the other side had already liked back, this
        // is the moment the pair forms, and the shared row gets written.
        .then(() =>
          checkForMatch({ id: profile.id, name: profile.name, photo: profile.photo, mode: profile.kind })
        )
        .catch(() => undefined);
    }
  };

  const removeFavorite = (id: string) => {
    if (!user) return;
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    favoritesService.removeFavorite(user.id, id);
  };

  const value = useMemo(() => ({ favorites, isFavorite, toggleFavorite, removeFavorite }), [favorites, user?.id]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
