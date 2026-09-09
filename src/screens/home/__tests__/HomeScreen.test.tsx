import React from 'react';
import { Text, Pressable } from 'react-native';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { TabBarVisibilityProvider } from '../../../store/TabBarVisibilityContext';
import { HomeScreen } from '../HomeScreen';
import { useAuth } from '../../../store/AuthContext';
import { useFavorites } from '../../../store/FavoritesContext';
import { useDialog } from '../../../store/DialogContext';
import { useLikeLimit } from '../../../store/LikeLimitContext';
import { useBoost } from '../../../store/BoostContext';
import { useDiscovery } from '../../../store/DiscoveryContext';
import { useMatches } from '../../../store/MatchesContext';
import { useNotifications } from '../../../store/NotificationContext';
import { useViewHistory } from '../../../store/ViewHistoryContext';
import type { DiscoverProfile } from '../../../types/content';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/FavoritesContext', () => ({ useFavorites: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/LikeLimitContext', () => ({ useLikeLimit: jest.fn() }));
jest.mock('../../../store/BoostContext', () => ({ useBoost: jest.fn() }));
jest.mock('../../../store/DiscoveryContext', () => ({ useDiscovery: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../store/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('../../../store/ViewHistoryContext', () => ({ useViewHistory: jest.fn() }));
jest.mock('../../../services/reportsService', () => ({ reportsService: { submitReport: jest.fn() } }));
jest.mock('../../../services/imageCache', () => ({ prefetchImages: jest.fn() }));

jest.mock('../../../components/common/AuroraBackground', () => ({ AuroraBackground: () => null }));
jest.mock('../../../components/discover/DiscoverProfileCard', () => ({
  DiscoverProfileCard: ({ profile }: { profile: { name: string } }) =>
    require('react').createElement(require('react-native').Text, null, `card:${profile.name}`),
}));
jest.mock('../../../components/discover/MatchCelebration', () => ({
  MatchCelebration: ({ visible, name }: { visible: boolean; name: string }) =>
    visible ? require('react').createElement(require('react-native').Text, null, `celebration:${name}`) : null,
}));
jest.mock('../../../components/discover/HomeTopBar', () => ({
  HomeTopBar: ({ onOpenFilters, onOpenSort, onBoost, onNotifications }: Record<string, () => void>) => {
    const { View, Pressable, Text } = require('react-native');
    return require('react').createElement(
      View,
      null,
      require('react').createElement(Pressable, { onPress: onOpenFilters }, require('react').createElement(Text, null, 'open-filters')),
      require('react').createElement(Pressable, { onPress: onOpenSort }, require('react').createElement(Text, null, 'open-sort')),
      require('react').createElement(Pressable, { onPress: onBoost }, require('react').createElement(Text, null, 'open-boost')),
      require('react').createElement(Pressable, { onPress: onNotifications }, require('react').createElement(Text, null, 'open-notifications'))
    );
  },
}));
jest.mock('../../../components/discover/MatchScoreCard', () => ({ MatchScoreCard: () => null }));
jest.mock('../../../components/discover/SwipeableCard', () => ({
  SwipeableCard: ({ children, onSwipeRight, onSwipeLeft }: { children: React.ReactNode; onSwipeRight: () => void; onSwipeLeft: () => void }) => {
    const { View, Pressable, Text } = require('react-native');
    return require('react').createElement(
      View,
      null,
      children,
      require('react').createElement(Pressable, { onPress: onSwipeRight }, require('react').createElement(Text, null, 'swipe-right')),
      require('react').createElement(Pressable, { onPress: onSwipeLeft }, require('react').createElement(Text, null, 'swipe-left'))
    );
  },
}));
jest.mock('../../../components/discover/SwipeActionBar', () => ({
  SwipeActionBar: ({ onUndo, onPass, onLike }: Record<string, () => void>) => {
    const { View, Pressable, Text } = require('react-native');
    return require('react').createElement(
      View,
      null,
      require('react').createElement(Pressable, { onPress: onUndo }, require('react').createElement(Text, null, 'action-undo')),
      require('react').createElement(Pressable, { onPress: onPass }, require('react').createElement(Text, null, 'action-pass')),
      require('react').createElement(Pressable, { onPress: onLike }, require('react').createElement(Text, null, 'action-like'))
    );
  },
}));
jest.mock('../../../components/discover/BrowseSheets', () => ({
  BrowseFiltersSheet: () => null,
  BrowseSortSheet: () => null,
}));
jest.mock('../../../components/discover/BoostSheet', () => ({ BoostSheet: () => null }));
jest.mock('../../../components/discover/ProfileDetailSections', () => ({
  AboutMeSection: () => null,
  BioSection: () => null,
  ReadinessSection: () => null,
  FaithSection: () => null,
  FuturePlansSection: () => null,
  InterestsSection: () => null,
  PersonalitySection: () => null,
  EducationCareerSection: () => null,
  LanguagesBackgroundSection: () => null,
  SimilaritiesSection: () => null,
  VerificationSection: () => null,
  MidProfilePhoto: () => null,
  IntroMediaSection: () => null,
}));
jest.mock('../../../components/discover/ProfileActionsFooter', () => ({ ProfileActionsFooter: () => null }));
jest.mock('../../../components/discover/ProfileUtilityBar', () => ({
  ProfileUtilityBar: ({ onBlock, onReport }: Record<string, () => void>) => {
    const { View, Pressable, Text } = require('react-native');
    return require('react').createElement(
      View,
      null,
      require('react').createElement(Pressable, { onPress: onBlock }, require('react').createElement(Text, null, 'utility-block')),
      require('react').createElement(Pressable, { onPress: onReport }, require('react').createElement(Text, null, 'utility-report'))
    );
  },
}));
jest.mock('../../../components/common/ReportDialog', () => ({ ReportDialog: () => null }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseFavorites = useFavorites as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseLikeLimit = useLikeLimit as jest.Mock;
const mockUseBoost = useBoost as jest.Mock;
const mockUseDiscovery = useDiscovery as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseNotifications = useNotifications as jest.Mock;
const mockUseViewHistory = useViewHistory as jest.Mock;

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

let toggleFavorite: jest.Mock;
let recordLike: jest.Mock;
let confirm: jest.Mock;
let notify: jest.Mock;
let blockProfile: jest.Mock;
let addNotification: jest.Mock;
let loadMore: jest.Mock;
let reload: jest.Mock;

function renderScreen() {
  return render(withProviders(<TabBarVisibilityProvider><HomeScreen /></TabBarVisibilityProvider>));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockUseAuth.mockReturnValue({ user: user(), setActiveMode: jest.fn() });
  toggleFavorite = jest.fn().mockResolvedValue(null);
  mockUseFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite });
  confirm = jest.fn().mockResolvedValue(false);
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ confirm, notify });
  recordLike = jest.fn().mockReturnValue(true);
  mockUseLikeLimit.mockReturnValue({ recordLike, applyServerCount: jest.fn() });
  mockUseBoost.mockReturnValue({ isBoostActive: false });
  mockUseDiscovery.mockReturnValue({
    datingProfiles: [profile()],
    rishtaProfiles: [],
    loading: false,
    loadMore: (loadMore = jest.fn()),
    reload: (reload = jest.fn()),
  });
  mockUseMatches.mockReturnValue({ matches: [], rishtaProfileIds: new Set(), blockedProfiles: [], blockProfile: (blockProfile = jest.fn()) });
  addNotification = jest.fn();
  mockUseNotifications.mockReturnValue({ addNotification, unreadCount: 2 });
  mockUseViewHistory.mockReturnValue({ recordView: jest.fn() });
});

describe('HomeScreen', () => {
  it('renders nothing while there is no signed-in user', () => {
    mockUseAuth.mockReturnValue({ user: null, setActiveMode: jest.fn() });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('renders the current profile card', () => {
    renderScreen();
    expect(screen.getByText('card:Sara')).toBeTruthy();
  });

  it('shows the out-of-profiles empty state when the deck is empty', () => {
    mockUseDiscovery.mockReturnValue({ datingProfiles: [], rishtaProfiles: [], loading: false, loadMore: jest.fn(), reload: jest.fn() });
    renderScreen();
    expect(screen.getByText(/Not enough profiles nearby yet/)).toBeTruthy();
  });

  it('filters out the opposite-gender-only deck to nobody sharing the viewer\'s own gender', () => {
    mockUseDiscovery.mockReturnValue({
      datingProfiles: [profile({ gender: 'male' })], // viewer is male; same-gender is filtered out
      rishtaProfiles: [],
      loading: false,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });
    renderScreen();
    expect(screen.getByText(/Not enough profiles nearby yet/)).toBeTruthy();
  });

  it('excludes a blocked profile from the deck', () => {
    mockUseMatches.mockReturnValue({
      matches: [],
      rishtaProfileIds: new Set(),
      blockedProfiles: [{ id: 'p1', name: 'Sara', photo: 'a.jpg', blockedAt: '2026-01-01' }],
      blockProfile: jest.fn(),
    });
    renderScreen();
    expect(screen.queryByText('card:Sara')).toBeNull();
  });

  it('likes the current profile, celebrates a new match, and notifies', async () => {
    toggleFavorite.mockResolvedValue({ match: { id: 'm1' }, isNew: true, likesLeft: 10 });
    renderScreen();

    fireEvent.press(screen.getByText('swipe-right'));

    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })));
    await waitFor(() => expect(screen.getByText('celebration:Sara')).toBeTruthy());
    expect(addNotification).toHaveBeenCalledWith('match', "It's a Match!", expect.any(String));
  });

  it('prompts the paywall and does not like when the daily limit is reached', async () => {
    recordLike.mockReturnValue(false);
    confirm.mockResolvedValue(false);
    renderScreen();

    fireEvent.press(screen.getByText('action-like'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('navigates to Explore+ when the paywall prompt is accepted', async () => {
    recordLike.mockReturnValue(false);
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('action-like'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/explore-plus'));
  });

  it('passing advances past the current profile to the empty state', () => {
    renderScreen();
    fireEvent.press(screen.getByText('action-pass'));
    expect(screen.getByText(/Not enough profiles nearby yet/)).toBeTruthy();
  });

  it('locks Undo behind Explore+ for a free member', async () => {
    // Two profiles, so the action bar (and its Undo button) is still on screen
    // after advancing past the first one.
    mockUseDiscovery.mockReturnValue({
      datingProfiles: [profile({ id: 'p1' }), profile({ id: 'p2', name: 'Zara' })],
      rishtaProfiles: [],
      loading: false,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });
    renderScreen();
    fireEvent.press(screen.getByText('action-pass')); // advance once so undo has something to undo
    fireEvent.press(screen.getByText('action-undo'));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) })));
  });

  it('blocks the current profile after confirming', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('utility-block'));

    await waitFor(() => expect(blockProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })));
  });

  it('does not block when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();

    fireEvent.press(screen.getByText('utility-block'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(blockProfile).not.toHaveBeenCalled();
  });

  it('opens the filters, sort, boost and notifications from the top bar', () => {
    renderScreen();
    expect(() => {
      fireEvent.press(screen.getByText('open-filters'));
      fireEvent.press(screen.getByText('open-sort'));
      fireEvent.press(screen.getByText('open-boost'));
    }).not.toThrow();

    fireEvent.press(screen.getByText('open-notifications'));
    expect(push).toHaveBeenCalledWith('/notifications');
  });
});
