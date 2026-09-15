import React from 'react';
import { fireEvent, screen, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { BlockedUsersScreen } from '../BlockedUsersScreen';
import { useMatches } from '../../../store/MatchesContext';
import type { BlockedProfile } from '../../../store/MatchesContext';
import type { Match } from '../../../types/content';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));

const mockUseMatches = useMatches as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
let unblockUser: jest.Mock;
let getMatchForProfile: jest.Mock;
let push: jest.Mock;

function blocked(overrides: Partial<BlockedProfile> = {}): BlockedProfile {
  return { id: 'p1', name: 'Bilal', photo: 'a.jpg', blockedAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Bilal',
    photo: 'a.jpg',
    lastMessage: '',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    unread: false,
    mode: 'dating',
    movedToRishta: false,
    sourceProfileId: 'p1',
    ...overrides,
  };
}

function renderScreen() {
  return render(withProviders(<BlockedUsersScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  unblockUser = jest.fn();
  getMatchForProfile = jest.fn().mockReturnValue(undefined);
  push = jest.fn();
  mockUseRouter.mockReturnValue({ push });
  mockUseMatches.mockReturnValue({ blockedProfiles: [], unblockUser, getMatchForProfile });
});

describe('BlockedUsersScreen', () => {
  it('shows the empty state when nobody is blocked', () => {
    renderScreen();
    expect(screen.getByText("You haven't blocked anyone.")).toBeTruthy();
  });

  it('renders each blocked profile', () => {
    mockUseMatches.mockReturnValue({
      blockedProfiles: [blocked(), blocked({ id: 'p2', name: 'Sara' })],
      unblockUser,
      getMatchForProfile,
    });
    renderScreen();
    expect(screen.getByText('Bilal')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('unblocks a user when Unblock is pressed', () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [blocked()], unblockUser, getMatchForProfile });
    renderScreen();
    fireEvent.press(screen.getByText('Unblock'));
    expect(unblockUser).toHaveBeenCalledWith('p1');
  });

  it('opens the kept thread when a blocked profile still has one', () => {
    getMatchForProfile.mockReturnValue(match());
    mockUseMatches.mockReturnValue({ blockedProfiles: [blocked()], unblockUser, getMatchForProfile });
    renderScreen();
    fireEvent.press(screen.getByText('Bilal'));
    expect(push).toHaveBeenCalledWith('/chat/m1');
  });
});
