import React from 'react';
import { fireEvent, screen, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { NotificationsScreen } from '../NotificationsScreen';
import { useNotifications } from '../../../store/NotificationContext';
import { useAuth } from '../../../store/AuthContext';
import type { NotificationItem } from '../../../types/content';
import type { UserProfile } from '../../../types/user';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseNotifications = useNotifications as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
let markAllRead: jest.Mock;
let markRead: jest.Mock;

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'match',
    title: 'New match!',
    body: 'You matched with Sara.',
    createdAt: '2026-01-01T00:00:00.000Z',
    read: false,
    ...overrides,
  };
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
  return render(withProviders(<NotificationsScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  markAllRead = jest.fn();
  markRead = jest.fn();
  mockUseNotifications.mockReturnValue({ feed: [], unreadCount: 0, markAllRead, markRead });
  mockUseAuth.mockReturnValue({ user: user() });
});

describe('NotificationsScreen', () => {
  it('shows the empty state when there is no activity', () => {
    renderScreen();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });

  it('renders each notification', () => {
    mockUseNotifications.mockReturnValue({
      feed: [notification(), notification({ id: 'n2', title: 'Someone liked you' })],
      unreadCount: 2,
      markAllRead,
      markRead,
    });
    renderScreen();
    expect(screen.getByText('New match!')).toBeTruthy();
    expect(screen.getByText('Someone liked you')).toBeTruthy();
  });

  it('hides the Mark all read pill when there is nothing unread', () => {
    mockUseNotifications.mockReturnValue({ feed: [notification({ read: true })], unreadCount: 0, markAllRead, markRead });
    renderScreen();
    expect(screen.queryByText('Mark all read')).toBeNull();
  });

  it('marks all as read when the pill is pressed', () => {
    mockUseNotifications.mockReturnValue({ feed: [notification()], unreadCount: 1, markAllRead, markRead });
    renderScreen();
    fireEvent.press(screen.getByText('Mark all read'));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('marks a single notification as read when tapped', () => {
    mockUseNotifications.mockReturnValue({ feed: [notification()], unreadCount: 1, markAllRead, markRead });
    renderScreen();
    fireEvent.press(screen.getByText('New match!'));
    expect(markRead).toHaveBeenCalledWith('n1');
  });
});
