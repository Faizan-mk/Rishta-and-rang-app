import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { discoveryService } from '../services/discoveryService';
import { cache, CACHE_KEYS } from '../services/cache';
import { mockDiscoverProfiles } from '../data/mockDiscover';
import { mockRishtaProfiles } from '../data/mockRishta';
import type { DiscoverProfile, RishtaListingProfile } from '../types/content';
import { useAuth } from './AuthContext';

// Loads the real member pool from Firestore once per sign-in.
//
// Screens read `datingProfiles` / `rishtaProfiles` instead of the static mock
// arrays. When the backend has no real members yet, we fall back to the demo
// decks so the UI is never empty during development.

// Guaranteed-to-load placeholder, used so no card/avatar is ever blank even if
// a member signed up without uploading photos yet.
const FALLBACK_AVATAR = 'https://placehold.co/900x1200/EDE9E1/8B9A9C/png?text=No+Photo';

function withPhotos<T extends { photos: string[] }>(profiles: T[]): T[] {
  return profiles.map((p) => {
    if (p.photos.length > 0) return p;
    return { ...p, photos: [FALLBACK_AVATAR] };
  });
}

interface DiscoveryContextValue {
  datingProfiles: DiscoverProfile[];
  rishtaProfiles: RishtaListingProfile[];
  loading: boolean;
  reload: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | undefined>(undefined);

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [datingProfiles, setDatingProfiles] = useState<DiscoverProfile[]>(mockDiscoverProfiles);
  const [rishtaProfiles, setRishtaProfiles] = useState<RishtaListingProfile[]>(mockRishtaProfiles);
  const [loading, setLoading] = useState(false);

  // Guards the cache write below: state only gets persisted once it is known to
  // hold this user's real members, never the demo deck or the last account's.
  const hydratedFor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      hydratedFor.current = null;
      setDatingProfiles(mockDiscoverProfiles);
      setRishtaProfiles(mockRishtaProfiles);
      return;
    }

    // Last session's deck goes on screen before the query even runs.
    const [cachedDating, cachedRishta] = await Promise.all([
      cache.read<DiscoverProfile[]>(user.id, CACHE_KEYS.discoverDeck),
      cache.read<RishtaListingProfile[]>(user.id, CACHE_KEYS.rishtaDeck),
    ]);
    if (cachedDating?.length && cachedRishta?.length) {
      setDatingProfiles(withPhotos(cachedDating));
      setRishtaProfiles(withPhotos(cachedRishta));
      hydratedFor.current = user.id;
    }

    setLoading(true);
    try {
      const [dating, rishta] = await Promise.all([
        discoveryService.fetchDiscoverProfiles(user.gender, user.id),
        discoveryService.fetchRishtaProfiles(user.gender, user.id),
      ]);
      // Real members first; demo decks only when there are none to show.
      // Every profile is guaranteed at least one photo (blank-card guard).
      setDatingProfiles(withPhotos(dating.length ? dating : mockDiscoverProfiles));
      setRishtaProfiles(withPhotos(rishta.length ? rishta : mockRishtaProfiles));
      // Both decks read the same collection, so they fill or empty together.
      if (dating.length && rishta.length) hydratedFor.current = user.id;
    } catch {
      // A cached deck beats the demo deck when the fetch fails offline.
      if (hydratedFor.current !== user.id) {
        setDatingProfiles(withPhotos(mockDiscoverProfiles));
        setRishtaProfiles(withPhotos(mockRishtaProfiles));
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.gender]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!user || hydratedFor.current !== user.id) return;
    cache.write(user.id, CACHE_KEYS.discoverDeck, datingProfiles);
    cache.write(user.id, CACHE_KEYS.rishtaDeck, rishtaProfiles);
  }, [user?.id, datingProfiles, rishtaProfiles]);

  const value = useMemo(
    () => ({ datingProfiles, rishtaProfiles, loading, reload }),
    [datingProfiles, rishtaProfiles, loading, reload]
  );

  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) throw new Error('useDiscovery must be used within a DiscoveryProvider');
  return ctx;
}