import React from 'react';
import { fireEvent, screen, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { BlockedUsersScreen } from '../BlockedUsersScreen';
import { useMatches } from '../../../store/MatchesContext';
import type { BlockedProfile } from '../../../store/MatchesContext';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));

const mockUseMatches = useMatches as jest.Mock;
let unblockUser: jest.Mock;

function blocked(overrides: Partial<BlockedProfile> = {}): BlockedProfile {
  return { id: 'p1', name: 'Bilal', photo: 'a.jpg', blockedAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

function renderScreen() {
  return render(withProviders(<BlockedUsersScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  unblockUser = jest.fn();
  mockUseMatches.mockReturnValue({ blockedProfiles: [], unblockUser });
});

describe('BlockedUsersScreen', () => {
  it('shows the empty state when nobody is blocked', () => {
    renderScreen();
    expect(screen.getByText("You haven't blocked anyone.")).toBeTruthy();
  });

  it('renders each blocked profile', () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [blocked(), blocked({ id: 'p2', name: 'Sara' })], unblockUser });
    renderScreen();
    expect(screen.getByText('Bilal')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('unblocks a user when Unblock is pressed', () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [blocked()], unblockUser });
    renderScreen();
    fireEvent.press(screen.getByText('Unblock'));
    expect(unblockUser).toHaveBeenCalledWith('p1');
  });
});
