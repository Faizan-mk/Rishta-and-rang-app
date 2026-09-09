import React from 'react';
import { fireEvent, screen, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { FavoritesScreen } from '../FavoritesScreen';
import { useFavorites } from '../../../store/FavoritesContext';
import { useAuth } from '../../../store/AuthContext';
import type { FavoriteProfile } from '../../../store/FavoritesContext';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/FavoritesContext', () => ({ useFavorites: jest.fn() }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseFavorites = useFavorites as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const push = jest.fn();
let removeFavorite: jest.Mock;

function favorite(overrides: Partial<FavoriteProfile> = {}): FavoriteProfile {
  return { id: 'p1', name: 'Sara', photo: 'a.jpg', age: 27, city: 'Lahore', kind: 'dating', ...overrides };
}

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha Khan',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'dating',
    isExplorePlus: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderScreen() {
  return render(withProviders(<FavoritesScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  removeFavorite = jest.fn();
  mockUseFavorites.mockReturnValue({ favorites: [], removeFavorite });
  mockUseAuth.mockReturnValue({ user: user() });
});

describe('FavoritesScreen', () => {
  it('shows the empty state when there are no favorites', () => {
    renderScreen();
    expect(screen.getByText('No favorites yet — tap the heart on any profile to save it here.')).toBeTruthy();
  });

  it('renders each favorite profile', () => {
    mockUseFavorites.mockReturnValue({ favorites: [favorite(), favorite({ id: 'p2', name: 'Bilal' })], removeFavorite });
    renderScreen();
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Bilal')).toBeTruthy();
  });

  it('navigates to the profile detail screen when a card is pressed', () => {
    mockUseFavorites.mockReturnValue({ favorites: [favorite()], removeFavorite });
    renderScreen();
    fireEvent.press(screen.getByText('Sara'));
    expect(push).toHaveBeenCalledWith({ pathname: '/profile-detail', params: { kind: 'dating', id: 'p1' } });
  });

  it('removes a favorite when its heart button is pressed', () => {
    mockUseFavorites.mockReturnValue({ favorites: [favorite()], removeFavorite });
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'heart' }));
    expect(removeFavorite).toHaveBeenCalledWith('p1');
  });
});
