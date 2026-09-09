import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { WaliDashboardScreen } from '../WaliDashboardScreen';
import { useAuth } from '../../../store/AuthContext';
import { useDialog } from '../../../store/DialogContext';
import { useMatches } from '../../../store/MatchesContext';
import type { UserProfile } from '../../../types/user';
import type { Match } from '../../../types/content';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

let updateUser: jest.Mock;
let notify: jest.Mock;
let confirm: jest.Mock;

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

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Sara',
    photo: 'a.jpg',
    lastMessage: '',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    unread: false,
    mode: 'rishta',
    movedToRishta: true,
    sourceProfileId: 'p1',
    ...overrides,
  };
}

function renderScreen() {
  return render(withProviders(<WaliDashboardScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  updateUser = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: user(), updateUser });
  notify = jest.fn().mockResolvedValue(undefined);
  confirm = jest.fn().mockResolvedValue(false);
  mockUseDialog.mockReturnValue({ notify, confirm });
  mockUseMatches.mockReturnValue({ matches: [] });
});

describe('WaliDashboardScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('shows the invite form when there is no wali yet', () => {
    renderScreen();
    expect(screen.getByText('Send invite')).toBeTruthy();
  });

  it('shows a validation error when a field is missing', () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Abu Bakr'), 'Uncle Bakr');
    fireEvent.press(screen.getByText('Send invite'));
    expect(screen.getByText('Please fill in both fields.')).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('sends the invite once both fields are filled', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Abu Bakr'), 'Uncle Bakr');
    fireEvent.changeText(screen.getByPlaceholderText('Phone or email'), 'bakr@example.com');
    fireEvent.press(screen.getByText('Send invite'));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ waliName: 'Uncle Bakr', waliContact: 'bakr@example.com' })
      )
    );
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Invite sent' })));
  });

  it('shows the wali card and shared activity once a wali exists', () => {
    mockUseAuth.mockReturnValue({
      user: user({ waliName: 'Uncle Bakr', waliContact: 'bakr@example.com' }),
      updateUser,
    });
    mockUseMatches.mockReturnValue({ matches: [match()] });
    renderScreen();
    expect(screen.getByText('Uncle Bakr')).toBeTruthy();
    expect(screen.getByText('bakr@example.com')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('shows the empty state when there is no shared activity', () => {
    mockUseAuth.mockReturnValue({
      user: user({ waliName: 'Uncle Bakr', waliContact: 'bakr@example.com' }),
      updateUser,
    });
    renderScreen();
    expect(screen.getByText('No rishta-stage matches yet.')).toBeTruthy();
  });

  it('removes the wali after confirming', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ waliName: 'Uncle Bakr', waliContact: 'bakr@example.com' }),
      updateUser,
    });
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('Remove wali'));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ waliName: undefined, waliContact: undefined })
      )
    );
  });

  it('does not remove the wali when the confirmation is declined', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ waliName: 'Uncle Bakr', waliContact: 'bakr@example.com' }),
      updateUser,
    });
    confirm.mockResolvedValue(false);
    renderScreen();

    fireEvent.press(screen.getByText('Remove wali'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(updateUser).not.toHaveBeenCalled();
  });
});
