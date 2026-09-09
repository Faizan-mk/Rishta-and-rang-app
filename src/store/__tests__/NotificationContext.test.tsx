import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { notificationsService } from '../../services/notificationsService';
import { supabase } from '../../services/supabase';
import { useAuth } from '../AuthContext';
import { DEFAULT_NOTIFICATION_PREFS } from '../../types/content';

jest.mock('../../services/notificationsService', () => ({
  notificationsService: {
    fetchPrefs: jest.fn(),
    fetchFeed: jest.fn(),
    setPref: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    addNotification: jest.fn(),
  },
  rowToNotification: jest.requireActual('../../services/notificationsService').rowToNotification,
}));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

let channelHandlers: Array<{ config: unknown; handler: (payload: unknown) => void }> = [];

function mockChannel() {
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_event: string, config: unknown, handler: (payload: unknown) => void) => {
      channelHandlers.push({ config, handler });
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return channel;
}

jest.mock('../../services/supabase', () => ({
  supabase: { channel: jest.fn(), removeChannel: jest.fn() },
}));

function renderNotifications() {
  return renderHook(() => useNotifications(), {
    wrapper: ({ children }) => <NotificationProvider>{children}</NotificationProvider>,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  channelHandlers = [];
  (supabase.channel as jest.Mock).mockImplementation(() => mockChannel());
  (notificationsService.fetchPrefs as jest.Mock).mockResolvedValue(DEFAULT_NOTIFICATION_PREFS);
  (notificationsService.fetchFeed as jest.Mock).mockResolvedValue([]);
});

describe('NotificationProvider', () => {
  it('defaults to empty feed and default prefs when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderNotifications();
    expect(result.current.feed).toEqual([]);
    expect(result.current.prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('loads the feed and prefs for a signed-in member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.fetchFeed as jest.Mock).mockResolvedValue([
      { id: 'n1', type: 'match', title: 'Match', body: 'x', createdAt: '2026-01-01', read: false },
    ]);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.feed).toHaveLength(1));
  });

  it('counts only unread notifications', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.fetchFeed as jest.Mock).mockResolvedValue([
      { id: 'n1', type: 'match', title: '', body: '', createdAt: '2026-01-01', read: false },
      { id: 'n2', type: 'like', title: '', body: '', createdAt: '2026-01-02', read: true },
    ]);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it('adds a live realtime notification and de-dupes by id', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderNotifications();
    await waitFor(() => expect(channelHandlers.length).toBeGreaterThan(0));

    act(() => {
      channelHandlers[0].handler({
        new: { id: 'n9', type: 'like', title: 'Liked', body: 'x', created_at: '2026-01-05', read: false },
      });
    });

    expect(result.current.feed[0].id).toBe('n9');

    act(() => {
      channelHandlers[0].handler({
        new: { id: 'n9', type: 'like', title: 'Liked', body: 'x', created_at: '2026-01-05', read: false },
      });
    });
    expect(result.current.feed).toHaveLength(1); // not duplicated
  });

  it('setPref updates state and persists it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderNotifications();
    await waitFor(() => expect(notificationsService.fetchPrefs).toHaveBeenCalled());

    act(() => {
      result.current.setPref('likes', false);
    });

    expect(result.current.prefs.likes).toBe(false);
    expect(notificationsService.setPref).toHaveBeenCalledWith('u1', expect.objectContaining({ likes: false }));
  });

  it('markAllRead marks every item read locally and on the server', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.fetchFeed as jest.Mock).mockResolvedValue([
      { id: 'n1', type: 'match', title: '', body: '', createdAt: '2026-01-01', read: false },
    ]);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.feed).toHaveLength(1));

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(notificationsService.markAllRead).toHaveBeenCalledWith('u1');
  });

  it('markRead marks a single item', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.fetchFeed as jest.Mock).mockResolvedValue([
      { id: 'n1', type: 'match', title: '', body: '', createdAt: '2026-01-01', read: false },
      { id: 'n2', type: 'like', title: '', body: '', createdAt: '2026-01-02', read: false },
    ]);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.feed).toHaveLength(2));

    act(() => {
      result.current.markRead('n1');
    });

    expect(result.current.unreadCount).toBe(1);
    expect(notificationsService.markRead).toHaveBeenCalledWith('u1', 'n1');
  });

  it('addNotification is skipped when the matching preference toggle is off', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.fetchPrefs as jest.Mock).mockResolvedValue({ ...DEFAULT_NOTIFICATION_PREFS, likes: false });
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.prefs.likes).toBe(false));

    act(() => {
      result.current.addNotification('like', 'Liked', 'x');
    });

    expect(notificationsService.addNotification).not.toHaveBeenCalled();
  });

  it('addNotification writes through and adds the saved row to the feed', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (notificationsService.addNotification as jest.Mock).mockResolvedValue({
      id: 'n1',
      type: 'like',
      title: 'Liked',
      body: 'x',
      createdAt: '2026-01-01',
      read: false,
    });
    const { result } = renderNotifications();
    await waitFor(() => expect(notificationsService.fetchPrefs).toHaveBeenCalled());

    await act(async () => {
      result.current.addNotification('like', 'Liked', 'x');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.feed[0]?.id).toBe('n1');
  });
});
