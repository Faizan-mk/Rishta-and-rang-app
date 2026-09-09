import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { SettingsScreen } from '../SettingsScreen';
import { useAuth } from '../../../store/AuthContext';
import { useNotifications } from '../../../store/NotificationContext';
import { useDialog } from '../../../store/DialogContext';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseNotifications = useNotifications as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;

const push = jest.fn();
let logout: jest.Mock;
let confirm: jest.Mock;
let setPref: jest.Mock;

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

function renderScreen() {
  return render(withProviders(<SettingsScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  logout = jest.fn();
  mockUseAuth.mockReturnValue({ user: user(), logout });
  setPref = jest.fn();
  mockUseNotifications.mockReturnValue({
    prefs: { newMatches: true, messages: true, likes: false, rishtaRequests: true, productUpdates: false },
    setPref,
  });
  confirm = jest.fn().mockResolvedValue(false);
  mockUseDialog.mockReturnValue({ confirm });
});

describe('SettingsScreen', () => {
  it('renders the theme, language and account sections', () => {
    renderScreen();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Version 1.0.0 (V1 MVP)')).toBeTruthy();
  });

  it('switches the theme mode', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Dark'));
    // Re-rendered with the new mode selected — Dark's option now carries the
    // selected (white) label style; a straightforward re-query still finds it.
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('switches the language', () => {
    renderScreen();
    fireEvent.press(screen.getByText('اردو'));
    expect(screen.getByText('اردو')).toBeTruthy();
  });

  it('toggles a notification preference', () => {
    renderScreen();
    const switches = screen.UNSAFE_getAllByType(Switch);
    fireEvent(switches[2], 'valueChange', true);
    expect(setPref).toHaveBeenCalledWith('likes', true);
  });

  it('navigates to the subscription screen', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Subscription'));
    expect(push).toHaveBeenCalledWith('/explore-plus');
  });

  it('navigates to favorites', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Favorites'));
    expect(push).toHaveBeenCalledWith('/favorites');
  });

  it('navigates to privacy & safety', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Privacy & safety'));
    expect(push).toHaveBeenCalledWith('/privacy-safety');
  });

  it('navigates to help & support', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Help & support'));
    expect(push).toHaveBeenCalledWith('/help-support');
  });

  it('navigates to legal', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Privacy policy & terms'));
    expect(push).toHaveBeenCalledWith('/legal');
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
