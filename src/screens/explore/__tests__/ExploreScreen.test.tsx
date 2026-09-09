import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { TabBarVisibilityProvider } from '../../../store/TabBarVisibilityContext';
import { ExploreScreen } from '../ExploreScreen';
import { useAuth } from '../../../store/AuthContext';
import { useMatches } from '../../../store/MatchesContext';
import { useViewHistory } from '../../../store/ViewHistoryContext';
import { useDialog } from '../../../store/DialogContext';
import { useDiscovery } from '../../../store/DiscoveryContext';
import { likesService } from '../../../services/likesService';
import type { DiscoverProfile } from '../../../types/content';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../store/ViewHistoryContext', () => ({ useViewHistory: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/DiscoveryContext', () => ({ useDiscovery: jest.fn() }));
jest.mock('../../../services/likesService', () => ({ likesService: { fetchLikesReceived: jest.fn() } }));
jest.mock('../../../components/discover/BrowseSheets', () => ({ BrowseFiltersSheet: () => null }));
jest.mock('../../../components/common/AuroraBackground', () => ({ AuroraBackground: () => null }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseViewHistory = useViewHistory as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseDiscovery = useDiscovery as jest.Mock;
const push = jest.fn();

function profile(overrides: Partial<DiscoverProfile> = {}): DiscoverProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 26,
    gender: 'female',
    city: 'Lahore',
    bio: '',
    vibeTags: [],
    photos: ['a.jpg'],
    ...overrides,
  };
}

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Bilal',
    email: 'b@example.com',
    dob: '1998-01-01',
    gender: 'male',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'serious',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: '', sect: '', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'dating',
    createdAt: '2026-01-01T00:00:00.000Z',
    isExplorePlus: false,
    ...overrides,
  };
}

let clearHistory: jest.Mock;
let confirm: jest.Mock;

function renderScreen() {
  return render(withProviders(<TabBarVisibilityProvider><ExploreScreen /></TabBarVisibilityProvider>));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockUseAuth.mockReturnValue({ user: user() });
  mockUseMatches.mockReturnValue({ rishtaProfileIds: new Set(), blockedProfiles: [] });
  clearHistory = jest.fn();
  mockUseViewHistory.mockReturnValue({ history: [], clearHistory });
  confirm = jest.fn().mockResolvedValue(false);
  mockUseDialog.mockReturnValue({ confirm });
  mockUseDiscovery.mockReturnValue({ datingProfiles: [profile()], rishtaProfiles: [], loadMore: jest.fn() });
  (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([]);
});

describe('ExploreScreen', () => {
  it('shows the empty state for "who liked you" when there are no likes', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText(/No likes yet/)).toBeTruthy());
  });

  it('shows a locked teaser (count only) for a free member with likes', async () => {
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([
      { id: 'p9', kind: 'dating', name: 'Bilal', age: 29, city: 'Karachi', photo: 'b.jpg', likedAt: '2026-01-01' },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('1 person liked you')).toBeTruthy());
  });

  it('shows the real faces for an Explore+ member', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true }) });
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([
      { id: 'p9', kind: 'dating', name: 'Zara', age: 29, city: 'Karachi', photo: 'b.jpg', likedAt: '2026-01-01' },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Zara')).toBeTruthy());
  });

  it('lists profiles from the deck under "All profiles"', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Sara').length).toBeGreaterThan(0));
  });

  it('excludes a same-gender profile from the pool', async () => {
    mockUseDiscovery.mockReturnValue({ datingProfiles: [profile({ gender: 'male' })], rishtaProfiles: [], loadMore: jest.fn() });
    renderScreen();
    await waitFor(() => expect(screen.getByText(/No profiles match your filters/)).toBeTruthy());
  });

  it('navigates to the profile detail when a tile is pressed', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Sara').length).toBeGreaterThan(0));
    fireEvent.press(screen.getAllByText('Sara')[0]);
    expect(push).toHaveBeenCalledWith({ pathname: '/profile-detail', params: { kind: 'dating', id: 'p1' } });
  });

  it('switches to the History tab and shows the empty state', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('My History'));
    expect(screen.getByText('Profiles you view will show up here.')).toBeTruthy();
  });

  it('lists view history and confirms before clearing it', async () => {
    mockUseViewHistory.mockReturnValue({
      history: [{ id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg', viewedAt: '2026-01-01' }],
      clearHistory,
    });
    confirm.mockResolvedValue(true);
    renderScreen();
    fireEvent.press(screen.getByText('My History'));
    expect(screen.getAllByText('Sara').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Clear history'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(clearHistory).toHaveBeenCalledTimes(1));
  });

  it('does not clear history when the confirmation is declined', async () => {
    mockUseViewHistory.mockReturnValue({
      history: [{ id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg', viewedAt: '2026-01-01' }],
      clearHistory,
    });
    confirm.mockResolvedValue(false);
    renderScreen();
    fireEvent.press(screen.getByText('My History'));
    fireEvent.press(screen.getByText('Clear history'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(clearHistory).not.toHaveBeenCalled();
  });
});
