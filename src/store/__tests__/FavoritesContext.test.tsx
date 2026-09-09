import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { FavoritesProvider, useFavorites } from '../FavoritesContext';
import { favoritesService } from '../../services/favoritesService';
import { likesService } from '../../services/likesService';
import { useAuth } from '../AuthContext';
import { useMatches } from '../MatchesContext';
import { AppError } from '../../utils/appError';
import type { FavoriteProfile } from '../../types/content';

jest.mock('../../services/favoritesService', () => ({
  favoritesService: { fetchFavorites: jest.fn(), addFavorite: jest.fn(), updateFavoriteKind: jest.fn(), removeFavorite: jest.fn() },
}));
jest.mock('../../services/likesService', () => ({ likesService: { withdrawLike: jest.fn() } }));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../MatchesContext', () => ({ useMatches: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

function renderFavorites() {
  return renderHook(() => useFavorites(), {
    wrapper: ({ children }) => <FavoritesProvider>{children}</FavoritesProvider>,
  });
}

const profile: FavoriteProfile = { id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg' };

let likeProfile: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (favoritesService.fetchFavorites as jest.Mock).mockResolvedValue([]);
  (favoritesService.addFavorite as jest.Mock).mockResolvedValue(undefined);
  (favoritesService.removeFavorite as jest.Mock).mockResolvedValue(undefined);
  (favoritesService.updateFavoriteKind as jest.Mock).mockResolvedValue(undefined);
  (likesService.withdrawLike as jest.Mock).mockResolvedValue(undefined);
  likeProfile = jest.fn().mockResolvedValue({ match: null, isNew: false, likesLeft: 10 });
  mockUseMatches.mockReturnValue({ rishtaProfileIds: new Set<string>(), likeProfile });
});

describe('FavoritesProvider', () => {
  it('starts empty when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderFavorites();
    expect(result.current.favorites).toEqual([]);
  });

  it('loads favorites for a signed-in member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (favoritesService.fetchFavorites as jest.Mock).mockResolvedValue([profile]);
    const { result } = renderFavorites();
    await waitFor(() => expect(result.current.isFavorite('p1')).toBe(true));
  });

  it('toggleFavorite adds the profile, likes it, and reports no match when not mutual', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderFavorites();
    await waitFor(() => expect(favoritesService.fetchFavorites).toHaveBeenCalled());

    let outcome: Awaited<ReturnType<typeof result.current.toggleFavorite>>;
    await act(async () => {
      outcome = await result.current.toggleFavorite(profile);
    });

    expect(result.current.isFavorite('p1')).toBe(true);
    expect(favoritesService.addFavorite).toHaveBeenCalledWith('u1', profile);
    expect(likeProfile).toHaveBeenCalledWith({ id: 'p1', name: 'Sara', photo: 'a.jpg', mode: 'dating' });
    expect(outcome!.match).toBeNull();
  });

  it('toggleFavorite un-favorites and withdraws the like when already favorited', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (favoritesService.fetchFavorites as jest.Mock).mockResolvedValue([profile]);
    const { result } = renderFavorites();
    await waitFor(() => expect(result.current.isFavorite('p1')).toBe(true));

    await act(async () => {
      await result.current.toggleFavorite(profile);
    });

    expect(result.current.isFavorite('p1')).toBe(false);
    expect(favoritesService.removeFavorite).toHaveBeenCalledWith('u1', 'p1');
    expect(likesService.withdrawLike).toHaveBeenCalledWith('p1', 'u1');
  });

  it('toggleFavorite rolls back and throws when the daily like limit is hit', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    likeProfile.mockRejectedValue(new Error('daily_like_limit_reached'));
    const { result } = renderFavorites();
    await waitFor(() => expect(favoritesService.fetchFavorites).toHaveBeenCalled());

    await act(async () => {
      await expect(result.current.toggleFavorite(profile)).rejects.toBeInstanceOf(AppError);
    });

    expect(result.current.isFavorite('p1')).toBe(false);
    expect(favoritesService.removeFavorite).toHaveBeenCalledWith('u1', 'p1');
  });

  it('toggleFavorite keeps the favorite when liking fails for another reason (e.g. offline)', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    likeProfile.mockRejectedValue(new Error('network error'));
    const { result } = renderFavorites();
    await waitFor(() => expect(favoritesService.fetchFavorites).toHaveBeenCalled());

    let outcome: Awaited<ReturnType<typeof result.current.toggleFavorite>>;
    await act(async () => {
      outcome = await result.current.toggleFavorite(profile);
    });

    expect(outcome!).toBeNull();
    expect(result.current.isFavorite('p1')).toBe(true);
  });

  it('toggleFavorite returns null when signed out', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderFavorites();
    const outcome = await result.current.toggleFavorite(profile);
    expect(outcome).toBeNull();
  });

  it('removeFavorite drops the entry and persists it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (favoritesService.fetchFavorites as jest.Mock).mockResolvedValue([profile]);
    const { result } = renderFavorites();
    await waitFor(() => expect(result.current.isFavorite('p1')).toBe(true));

    act(() => {
      result.current.removeFavorite('p1');
    });

    expect(result.current.isFavorite('p1')).toBe(false);
    expect(favoritesService.removeFavorite).toHaveBeenCalledWith('u1', 'p1');
  });

  it('flips a dating favorite to rishta once its thread crosses over', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (favoritesService.fetchFavorites as jest.Mock).mockResolvedValue([profile]); // kind: 'dating'
    mockUseMatches.mockReturnValue({ rishtaProfileIds: new Set(['p1']), likeProfile });

    const { result } = renderFavorites();

    await waitFor(() => {
      const fav = result.current.favorites.find((f) => f.id === 'p1');
      expect(fav?.kind).toBe('rishta');
    });
    expect(favoritesService.updateFavoriteKind).toHaveBeenCalledWith('u1', 'p1', 'rishta');
  });
});
