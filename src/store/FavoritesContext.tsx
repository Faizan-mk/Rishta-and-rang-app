import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { favoritesService } from '../services/favoritesService';
import type { FavoriteProfile } from '../types/content';
import { useAuth } from './AuthContext';

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
  const [favorites, setFavorites] = useState<FavoriteProfile[]>([]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    favoritesService.fetchFavorites(user.id).then(setFavorites);
  }, [user?.id]);

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const toggleFavorite = (profile: FavoriteProfile) => {
    if (!user) return;
    if (isFavorite(profile.id)) {
      setFavorites((prev) => prev.filter((f) => f.id !== profile.id));
      favoritesService.removeFavorite(user.id, profile.id);
    } else {
      setFavorites((prev) => [profile, ...prev]);
      favoritesService.addFavorite(user.id, profile);
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
