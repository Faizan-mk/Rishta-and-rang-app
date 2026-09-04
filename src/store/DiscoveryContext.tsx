import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { discoveryService } from '../services/discoveryService';
import { cache, CACHE_KEYS } from '../services/cache';
import type { DiscoverProfile, RishtaListingProfile } from '../types/content';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

// Set to true (in dev only) to fill gaps in the swipe deck with fabricated
// demo profiles.  Production builds must NEVER show mock people as real members.
const ENABLE_MOCK_PROFILES = false;
const USE_MOCK = __DEV__ && ENABLE_MOCK_PROFILES;

// Lazy-load mock data so it is excluded from production bundles entirely.
let _mockDiscover: DiscoverProfile[] | undefined;
let _mockRishta: RishtaListingProfile[] | undefined;
if (USE_MOCK) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _mockDiscover = require('../data/mockDiscover').mockDiscoverProfiles;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _mockRishta = require('../data/mockRishta').mockRishtaProfiles;
}

// Loads the real member pool from Supabase once per sign-in.
//
// Screens read `datingProfiles` / `rishtaProfiles` instead of the static mock
// arrays. During development (USE_MOCK) the demo decks fill gaps when the backend
// has few real members; in production, low-inventory areas show an honest empty
// deck rather than fabricated people.

// Guaranteed-to-load placeholder, used so no card/avatar is ever blank even if
// a member signed up without uploading photos yet.
const FALLBACK_AVATAR = 'https://placehold.co/900x1200/EDE9E1/8B9A9C/png?text=No+Photo';

// Below this many real members, the demo deck (dev-only) is appended so there is
// always something to browse. Demo profiles never overwrite real ones — they follow them.
const MIN_DECK_SIZE = 8;

function fillWithDemo<T extends { id: string }>(real: T[], demo: T[] | undefined): T[] {
  if (real.length >= MIN_DECK_SIZE) return real;
  if (!demo?.length) return real;
  return [...real, ...demo];
}

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
  /** Whether another page of members may exist behind the ones held. */
  hasMore: boolean;
  /** Fetches the next page. Safe to call repeatedly — it ignores overlaps. */
  loadMore: () => void;
  reload: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | undefined>(undefined);

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [datingProfiles, setDatingProfiles] = useState<DiscoverProfile[]>(_mockDiscover ?? []);
  const [rishtaProfiles, setRishtaProfiles] = useState<RishtaListingProfile[]>(_mockRishta ?? []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Guards the cache write below: state only gets persisted once it is known to
  // hold this user's real members, never the demo deck or the last account's.
  const hydratedFor = useRef<string | null>(null);
  // The last page fetched, and whether one is in flight. Refs rather than
  // state: `loadMore` is called from a scroll handler that would otherwise fire
  // several times against the same render's value.
  const page = useRef(0);
  const fetching = useRef(false);
  const { showError } = useToast();

  const reload = useCallback(async () => {
    if (!user) {
      hydratedFor.current = null;
      setDatingProfiles(_mockDiscover ?? []);
      setRishtaProfiles(_mockRishta ?? []);
      return;
    }

    // Last session's deck goes on screen before the query even runs.
    const [cachedDating, cachedRishta] = await Promise.all([
      cache.read<DiscoverProfile[]>(user.id, CACHE_KEYS.discoverDeck),
      cache.read<RishtaListingProfile[]>(user.id, CACHE_KEYS.rishtaDeck),
    ]);
    if (cachedDating?.length && cachedRishta?.length) {
      setDatingProfiles(withPhotos(fillWithDemo(cachedDating, _mockDiscover)));
      setRishtaProfiles(withPhotos(fillWithDemo(cachedRishta, _mockRishta)));
      hydratedFor.current = user.id;
    }

    setLoading(true);
    fetching.current = true;
    try {
      // One page, not the whole table. The deck used to fetch every matching
      // member up front — twice, once per mode — which is fine at fifty members
      // and is the first thing to fall over at five hundred.
      const first = await discoveryService.fetchDeckPage(user.gender, user.id, 0);
      page.current = 0;
      setHasMore(first.hasMore);
      // Real members first, then the demo deck behind them (dev-only) until there
      // are enough real ones to fill a session. In production, a low-inventory
      // area honestly shows an empty deck instead of fabricated profiles.
      setDatingProfiles(withPhotos(fillWithDemo(first.dating, _mockDiscover)));
      setRishtaProfiles(withPhotos(fillWithDemo(first.rishta, _mockRishta)));
      // Both decks read the same rows, so they fill or empty together.
      if (first.dating.length) hydratedFor.current = user.id;
    } catch {
      setHasMore(false);
      // A cached deck beats the demo deck when the fetch fails offline.
      if (hydratedFor.current !== user.id) {
        setDatingProfiles(withPhotos(_mockDiscover ?? []));
        setRishtaProfiles(withPhotos(_mockRishta ?? []));
      }
      showError({ messageKey: 'netErrors.deckRefresh', onRetry: () => void reload() });
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [user?.id, user?.gender, showError]);

  /**
   * Appends the next page.
   *
   * Called as the deck runs low rather than on a fixed schedule, so a member
   * who swipes twice and leaves never pays for a page they would not have seen.
   * De-duped by id: a member who signs up between two pages would otherwise
   * shift the window and repeat someone.
   */
  const loadMore = useCallback(async () => {
    if (!user || fetching.current || !hasMore) return;
    fetching.current = true;
    try {
      const next = await discoveryService.fetchDeckPage(user.gender, user.id, page.current + 1);
      page.current += 1;
      setHasMore(next.hasMore);
      setDatingProfiles((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...withPhotos(next.dating.filter((p) => !seen.has(p.id)))];
      });
      setRishtaProfiles((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...withPhotos(next.rishta.filter((p) => !seen.has(p.id)))];
      });
    } catch {
      // Not fatal: the deck keeps what it has, and the next low-water mark asks
      // again. Said out loud so a deck that stops growing is not a mystery.
      showError({ messageKey: 'netErrors.deckRefresh', onRetry: () => void loadMore() });
    } finally {
      fetching.current = false;
    }
  }, [user?.id, user?.gender, hasMore, showError]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!user || hydratedFor.current !== user.id) return;
    cache.write(user.id, CACHE_KEYS.discoverDeck, datingProfiles);
    cache.write(user.id, CACHE_KEYS.rishtaDeck, rishtaProfiles);
  }, [user?.id, datingProfiles, rishtaProfiles]);

  const value = useMemo(
    () => ({ datingProfiles, rishtaProfiles, loading, hasMore, loadMore, reload }),
    [datingProfiles, rishtaProfiles, loading, hasMore, loadMore, reload]
  );

  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) throw new Error('useDiscovery must be used within a DiscoveryProvider');
  return ctx;
}