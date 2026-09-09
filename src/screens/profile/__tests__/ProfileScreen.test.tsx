import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { TabBarVisibilityProvider } from '../../../store/TabBarVisibilityContext';
import { ProfileScreen } from '../ProfileScreen';
import { useAuth } from '../../../store/AuthContext';
import { useDialog } from '../../../store/DialogContext';
import { useNotifications } from '../../../store/NotificationContext';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('../../../components/discover/ProfileDetailSections', () => ({
  AboutMeSection: () => null,
  FaithSection: () => null,
  FuturePlansSection: () => null,
  EducationCareerSection: () => null,
  LanguagesBackgroundSection: () => null,
  VerificationSection: () => null,
  IntroMediaSection: () => null,
}));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseNotifications = useNotifications as jest.Mock;
const push = jest.fn();

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
    activeMode: 'rishta',
    isExplorePlus: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

let setIntent: jest.Mock;
let setReadiness: jest.Mock;
let logout: jest.Mock;
let updateUser: jest.Mock;
let confirm: jest.Mock;
let notify: jest.Mock;

function renderScreen() {
  return render(withProviders(<TabBarVisibilityProvider><ProfileScreen /></TabBarVisibilityProvider>));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  setIntent = jest.fn();
  setReadiness = jest.fn();
  logout = jest.fn();
  updateUser = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: user(), setIntent, setReadiness, logout, updateUser });
  confirm = jest.fn().mockResolvedValue(false);
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ confirm, notify });
  mockUseNotifications.mockReturnValue({ unreadCount: 0 });
});

describe('ProfileScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, setIntent, setReadiness, logout, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('renders the member\'s name and city', () => {
    renderScreen();
    expect(screen.getByText('Ayesha Khan')).toBeTruthy();
    expect(screen.getByText('Lahore')).toBeTruthy();
  });

  it('shows the join year and profile completion', () => {
    renderScreen();
    expect(screen.getByText('2024')).toBeTruthy();
    // profileCompletion: only "city filled in" passes for this fixture
    // (no photos, no bio, not selfie-verified, incomplete rishta fields) — 1/5.
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('navigates to Edit Profile', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Edit profile'));
    expect(push).toHaveBeenCalledWith('/edit-profile');
  });

  it('changes intent when a different option is picked', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Casual'));
    expect(setIntent).toHaveBeenCalledWith('casual');
  });

  it('changes readiness when a different chip is picked', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Ready now'));
    expect(setReadiness).toHaveBeenCalledWith('ready_now');
  });

  it('shows rishta details for a rishta-mode member', () => {
    renderScreen();
    expect(screen.getByText('Islam')).toBeTruthy();
    expect(screen.getByText('Sunni')).toBeTruthy();
  });

  it('shows vibe tags for a dating-mode member', () => {
    mockUseAuth.mockReturnValue({
      user: user({ activeMode: 'dating', dating: { vibeTags: ['coffee', 'travel'] } }),
      setIntent,
      setReadiness,
      logout,
      updateUser,
    });
    renderScreen();
    expect(screen.getByText('coffee')).toBeTruthy();
  });

  it('navigates to quick links', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Favorites'));
    expect(push).toHaveBeenCalledWith('/favorites');
  });

  it('logs out after confirming', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();
    fireEvent.press(screen.getByText('Log out'));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('does not log out when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();
    fireEvent.press(screen.getByText('Log out'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
  });
});
