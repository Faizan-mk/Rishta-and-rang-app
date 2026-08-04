import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import type { ProfileMode } from '../types/user';

export interface FavoriteProfile {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
}

interface FavoritesContextValue {
  favorites: FavoriteProfile[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (profile: FavoriteProfile) => void;
  removeFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteProfile[]>([]);

  useEffect(() => {
    storage.getJSON<FavoriteProfile[]>(storage.KEYS.favorites, []).then(setFavorites);
  }, []);

  const persist = (next: FavoriteProfile[]) => {
    setFavorites(next);
    storage.setJSON(storage.KEYS.favorites, next);
  };

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const toggleFavorite = (profile: FavoriteProfile) => {
    if (isFavorite(profile.id)) {
      persist(favorites.filter((f) => f.id !== profile.id));
    } else {
      persist([profile, ...favorites]);
    }
  };

  const removeFavorite = (id: string) => persist(favorites.filter((f) => f.id !== id));

  const value = useMemo(() => ({ favorites, isFavorite, toggleFavorite, removeFavorite }), [favorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
