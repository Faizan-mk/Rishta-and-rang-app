import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { DiscoveryProvider, useDiscovery } from '../DiscoveryContext';
import { discoveryService } from '../../services/discoveryService';
import { cache } from '../../services/cache';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';

jest.mock('../../services/discoveryService', () => ({
  discoveryService: { fetchDeckPage: jest.fn(), fetchActivity: jest.fn(), fetchProfileById: jest.fn() },
}));
jest.mock('../../services/cache', () => ({
  cache: { read: jest.fn(), write: jest.fn(), clearUser: jest.fn() },
  CACHE_KEYS: { discoverDeck: 'discoverDeck', rishtaDeck: 'rishtaDeck' },
}));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../ToastContext', () => ({ useToast: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const showError = jest.fn();

function renderDiscovery() {
  return renderHook(() => useDiscovery(), {
    wrapper: ({ children }) => <DiscoveryProvider>{children}</DiscoveryProvider>,
  });
}

function discoverProfile(overrides: Partial<DiscoverProfile> = {}): DiscoverProfile {
  return { id: 'p1', name: 'Sara', age: 26, gender: 'female', city: 'Lahore', bio: '', vibeTags: [], photos: [], ...overrides };
}

function rishtaProfile(overrides: Partial<RishtaListingProfile> = {}): RishtaListingProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 26,
    gender: 'female',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: '',
    familyBackground: '',
    readiness: 'browsing',
    photos: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseToast.mockReturnValue({ showError });
  (cache.read as jest.Mock).mockResolvedValue(null);
  (cache.write as jest.Mock).mockResolvedValue(undefined);
  (discoveryService.fetchActivity as jest.Mock).mockResolvedValue(new Map());
});

describe('DiscoveryProvider', () => {
  it('resets to the empty (non-mock) deck when signed out', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderDiscovery();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.datingProfiles).toEqual([]);
    expect(result.current.rishtaProfiles).toEqual([]);
  });

  it('loads the first page for a signed-in member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock).mockResolvedValue({
      dating: [discoverProfile()],
      rishta: [rishtaProfile()],
      hasMore: true,
    });

    const { result } = renderDiscovery();

    await waitFor(() => expect(result.current.datingProfiles).toHaveLength(1));
    expect(discoveryService.fetchDeckPage).toHaveBeenCalledWith('male', 'u1', 0);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('falls back to a placeholder avatar for a profile with no photos', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock).mockResolvedValue({
      dating: [discoverProfile({ photos: [] })],
      rishta: [],
      hasMore: false,
    });

    const { result } = renderDiscovery();

    await waitFor(() => expect(result.current.datingProfiles).toHaveLength(1));
    expect(result.current.datingProfiles[0].photos).toHaveLength(1);
    expect(result.current.datingProfiles[0].photos[0]).toMatch(/^https:\/\//);
  });

  it('shows the cached deck immediately behind the fresh fetch', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (cache.read as jest.Mock).mockImplementation((_id: string, key: string) =>
      Promise.resolve(
        key === 'discoverDeck' ? [discoverProfile({ id: 'cached', name: 'Cached' })] : [rishtaProfile({ id: 'cached' })]
      )
    );
    let resolveFetch!: (value: unknown) => void;
    (discoveryService.fetchDeckPage as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderDiscovery();

    await waitFor(() => expect(result.current.datingProfiles[0]?.name).toBe('Cached'));

    await act(async () => {
      resolveFetch({ dating: [discoverProfile({ id: 'fresh', name: 'Fresh' })], rishta: [rishtaProfile({ id: 'fresh' })], hasMore: false });
    });
    await waitFor(() => expect(result.current.datingProfiles[0]?.name).toBe('Fresh'));
  });

  it('falls back to an empty deck and shows a toast when the fetch fails with nothing cached', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = renderDiscovery();

    // `loading` starts false (it only flips true once the fetch is under way),
    // so the fetch having been called is what's worth waiting on here.
    await waitFor(() => expect(discoveryService.fetchDeckPage).toHaveBeenCalled());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(showError).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'netErrors.deckRefresh' }));
  });

  it('loadMore appends a de-duped next page', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock)
      .mockResolvedValueOnce({ dating: [discoverProfile({ id: 'p1' })], rishta: [rishtaProfile({ id: 'p1' })], hasMore: true })
      .mockResolvedValueOnce({
        dating: [discoverProfile({ id: 'p1' }), discoverProfile({ id: 'p2' })], // p1 repeated
        rishta: [rishtaProfile({ id: 'p2' })],
        hasMore: false,
      });

    const { result } = renderDiscovery();
    await waitFor(() => expect(result.current.datingProfiles).toHaveLength(1));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.datingProfiles.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.hasMore).toBe(false);
    expect(discoveryService.fetchDeckPage).toHaveBeenLastCalledWith('male', 'u1', 1);
  });

  it('loadMore is a no-op when there is no more to fetch', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock).mockResolvedValue({ dating: [], rishta: [], hasMore: false });
    const { result } = renderDiscovery();
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    (discoveryService.fetchDeckPage as jest.Mock).mockClear();
    await act(async () => {
      await result.current.loadMore();
    });
    expect(discoveryService.fetchDeckPage).not.toHaveBeenCalled();
  });

  it('reload() re-fetches the first page from scratch', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', gender: 'male' } });
    (discoveryService.fetchDeckPage as jest.Mock).mockResolvedValue({
      dating: [discoverProfile()],
      rishta: [rishtaProfile()],
      hasMore: false,
    });
    const { result } = renderDiscovery();
    await waitFor(() => expect(result.current.datingProfiles).toHaveLength(1));

    (discoveryService.fetchDeckPage as jest.Mock).mockClear();
    await act(async () => {
      await result.current.reload();
    });
    expect(discoveryService.fetchDeckPage).toHaveBeenCalledWith('male', 'u1', 0);
  });
});
