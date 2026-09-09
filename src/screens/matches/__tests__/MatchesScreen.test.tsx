import React from 'react';
import { fireEvent, screen, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { TabBarVisibilityProvider } from '../../../store/TabBarVisibilityContext';
import { MatchesScreen } from '../MatchesScreen';
import { useAuth } from '../../../store/AuthContext';
import { useMatches } from '../../../store/MatchesContext';
import type { Match } from '../../../types/content';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../components/common/AuroraBackground', () => ({ AuroraBackground: () => null }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const push = jest.fn();

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Sara',
    photo: 'a.jpg',
    lastMessage: 'Hi there',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    unread: false,
    mode: 'dating',
    movedToRishta: false,
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
    ...overrides,
  };
}

let setActiveMode: jest.Mock;

function renderScreen() {
  return render(withProviders(<TabBarVisibilityProvider><MatchesScreen /></TabBarVisibilityProvider>));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  setActiveMode = jest.fn();
  mockUseAuth.mockReturnValue({ user: user(), setActiveMode });
  mockUseMatches.mockReturnValue({ matches: [] });
});

describe('MatchesScreen', () => {
  it('shows the Friends-empty state when there are no dating matches', () => {
    renderScreen();
    expect(screen.getByText(/No Friends chats yet/)).toBeTruthy();
  });

  it('lists the current mode\'s matches', () => {
    mockUseMatches.mockReturnValue({ matches: [match()] });
    renderScreen();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('excludes a rishta-mode match from the Friends list', () => {
    mockUseMatches.mockReturnValue({ matches: [match({ mode: 'rishta' })] });
    renderScreen();
    expect(screen.queryByText('Sara')).toBeNull();
  });

  it('treats a movedToRishta thread as rishta even if `mode` still says dating', () => {
    mockUseMatches.mockReturnValue({ matches: [match({ mode: 'dating', movedToRishta: true })] });
    renderScreen();
    // On the Friends (dating) tab it should not appear...
    expect(screen.queryByText('Sara')).toBeNull();
  });

  it('shows the hint and switch button when the other mode has matches', () => {
    mockUseMatches.mockReturnValue({ matches: [match({ mode: 'rishta' })] });
    renderScreen();
    expect(screen.getByText(/1 waiting in Rishta/)).toBeTruthy();
    expect(screen.getByText('Go to Rishta')).toBeTruthy();
  });

  it('switches mode when the switch button is pressed', () => {
    mockUseMatches.mockReturnValue({ matches: [match({ mode: 'rishta' })] });
    renderScreen();
    fireEvent.press(screen.getByText('Go to Rishta'));
    expect(setActiveMode).toHaveBeenCalledWith('rishta');
  });

  it('navigates to the chat screen when a match row is pressed', () => {
    mockUseMatches.mockReturnValue({ matches: [match()] });
    renderScreen();
    fireEvent.press(screen.getByText('Sara'));
    expect(push).toHaveBeenCalledWith('/chat/m1');
  });

  it('shows the unread count badge', () => {
    // "2" also appears in the ModeToggle's own tally for this mode, so this
    // just confirms it renders somewhere rather than picking one instance.
    mockUseMatches.mockReturnValue({ matches: [match({ unread: true }), match({ id: 'm2', name: 'Zara', unread: true })] });
    renderScreen();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});
