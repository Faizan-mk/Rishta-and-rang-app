import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

// How often the held deck's last-seen times are re-read, and how many of them.
// Shorter than the badge's ten-minute "now" window, so a member who comes online
// while the deck is on screen shows as online before that window has passed.
const ACTIVITY_REFRESH_MS = 3 * 60 * 1000;
const ACTIVITY_REFRESH_LIMIT = 100;

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

  // The current decks, for the activity refresh below — which is set up once per
  // sign-in and so cannot read them from its own closure.
  const decks = useRef({ dating: datingProfiles, rishta: rishtaProfiles });
  useEffect(() => {
    decks.current = { dating: datingProfiles, rishta: rishtaProfiles };
  }, [datingProfiles, rishtaProfiles]);

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

  /**
   * Re-reads only the last-seen times of the profiles already held.
   *
   * The deck is fetched once, so without this the "Active now" badge could only
   * ever be right for the instant the deck loaded — someone who came online a
   * minute ago went on reading as whatever they were then. Two columns for the
   * ids on hand, patched in place, so nothing about the deck's order or the
   * member's position in it moves.
   */
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const refresh = async () => {
      // Read through the ref, not the closure: this effect is deliberately set
      // up once per sign-in, so the lists it captured would be whatever the deck
      // held before the first fetch landed — usually nothing.
      const { dating, rishta } = decks.current;
      // The front of the deck is what is being looked at; beyond that the badge
      // will be refreshed by the time it is reached.
      const ids = [...new Set([...dating, ...rishta].slice(0, ACTIVITY_REFRESH_LIMIT).map((p) => p.id))];
      if (ids.length === 0) return;
      try {
        const activity = await discoveryService.fetchActivity(ids);
        if (cancelled || activity.size === 0) return;
        // Returns the very same array when nothing moved, so a quiet refresh —
        // which is most of them — costs no re-render and no cache write.
        const patch = <T extends { id: string; lastActiveAt?: string }>(list: T[]): T[] => {
          let changed = false;
          const next = list.map((profile) => {
            if (!activity.has(profile.id)) return profile;
            const lastActiveAt = activity.get(profile.id) ?? undefined;
            if (lastActiveAt === profile.lastActiveAt) return profile;
            changed = true;
            return { ...profile, lastActiveAt };
          });
          return changed ? next : list;
        };
        setDatingProfiles(patch);
        setRishtaProfiles(patch);
      } catch {
        // A stale badge is the cost, and it only ever understates how recently
        // someone was here. Not worth a toast.
      }
    };

    void refresh();
    const timer = setInterval(refresh, ACTIVITY_REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
    // Deliberately not re-run per deck change — that would tear down and rebuild
    // the timer on every page appended. The current deck reaches it through the
    // ref above instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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