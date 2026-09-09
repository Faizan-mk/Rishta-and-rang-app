import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { MatchesProvider, useMatches } from '../MatchesContext';
import { matchesService } from '../../services/matchesService';
import { likesService } from '../../services/likesService';
import { pushService } from '../../services/pushService';
import { reactionsService } from '../../services/reactionsService';
import { supabase } from '../../services/supabase';
import { cache } from '../../services/cache';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import type { ChatMessage, Match } from '../../types/content';

jest.mock('../../services/matchesService', () => {
  const actual = jest.requireActual('../../services/matchesService');
  return {
    ...actual,
    matchesService: {
      fetchMatches: jest.fn(),
      fetchThreadPreviews: jest.fn(),
      fetchMessagePage: jest.fn(),
      fetchReads: jest.fn(),
      markRead: jest.fn(),
      fetchBlocked: jest.fn(),
      requestRishta: jest.fn(),
      respondRishta: jest.fn(),
      deleteMatch: jest.fn(),
      insertTextMessage: jest.fn(),
      insertVoiceMessage: jest.fn(),
      insertImageMessage: jest.fn(),
      blockUser: jest.fn(),
      unblockUser: jest.fn(),
    },
  };
});
jest.mock('../../services/likesService', () => ({ likesService: { likeProfile: jest.fn() } }));
jest.mock('../../services/pushService', () => ({
  pushService: {
    notifyMessage: jest.fn(),
    notifyRishtaRequest: jest.fn(),
    notifyRishtaAccepted: jest.fn(),
    notifyRishtaDeclined: jest.fn(),
    notifyLike: jest.fn(),
    notifyMatch: jest.fn(),
  },
}));
jest.mock('../../services/reactionsService', () => ({
  reactionsService: { fetchReactions: jest.fn(), addReaction: jest.fn(), removeReaction: jest.fn() },
  rowToReaction: jest.requireActual('../../services/reactionsService').rowToReaction,
}));
jest.mock('../../services/cache', () => ({
  cache: { read: jest.fn(), write: jest.fn(), clearUser: jest.fn() },
  CACHE_KEYS: { matches: 'matches', blocked: 'blocked' },
}));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../ToastContext', () => ({ useToast: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const showError = jest.fn();

let channelHandlers: Record<string, (payload: unknown) => void> = {};

function mockChannel() {
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_event: string, config: { table: string; event: string }, handler: (payload: unknown) => void) => {
      channelHandlers[`${config.table}:${config.event}`] = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return channel;
}

jest.mock('../../services/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Sara',
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

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg1',
    matchId: 'm1',
    fromMe: false,
    text: 'hi',
    sentAt: '2026-01-01T00:00:00.000Z',
    kind: 'text',
    status: 'sent',
    ...overrides,
  };
}

function renderMatches() {
  return renderHook(() => useMatches(), { wrapper: ({ children }) => <MatchesProvider>{children}</MatchesProvider> });
}

beforeEach(() => {
  jest.clearAllMocks();
  channelHandlers = {};
  mockUseToast.mockReturnValue({ showError });
  (supabase.channel as jest.Mock).mockImplementation(() => mockChannel());
  (cache.read as jest.Mock).mockResolvedValue(null);
  (cache.write as jest.Mock).mockResolvedValue(undefined);
  (matchesService.fetchMatches as jest.Mock).mockResolvedValue([]);
  (matchesService.fetchThreadPreviews as jest.Mock).mockResolvedValue([]);
  (matchesService.fetchBlocked as jest.Mock).mockResolvedValue([]);
  (matchesService.fetchReads as jest.Mock).mockResolvedValue({ mine: {}, theirs: {} });
  (matchesService.markRead as jest.Mock).mockResolvedValue(undefined);
  (reactionsService.fetchReactions as jest.Mock).mockResolvedValue({});
});

describe('MatchesProvider hydration', () => {
  it('starts empty when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderMatches();
    expect(result.current.matches).toEqual([]);
  });

  it('loads matches, sorted with the newest thread first', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([
      match({ id: 'm1', lastMessageAt: '2026-01-01T00:00:00.000Z' }),
      match({ id: 'm2', lastMessageAt: '2026-01-05T00:00:00.000Z' }),
    ]);

    const { result } = renderMatches();

    await waitFor(() => expect(result.current.matches).toHaveLength(2));
    expect(result.current.matches.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('seeds the thread with its preview message and marks it unread from the other side', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.fetchThreadPreviews as jest.Mock).mockResolvedValue([
      message({ text: 'hello there', sentAt: '2026-01-02T00:00:00.000Z', fromMe: false }),
    ]);

    const { result } = renderMatches();

    await waitFor(() => expect(result.current.getMatch('m1')?.lastMessage).toBe('hello there'));
    expect(result.current.getMatch('m1')?.unread).toBe(true);
    expect(result.current.getMessages('m1')).toHaveLength(1);
  });

  it('shows a toast and keeps the cached list when the fetch fails offline', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (cache.read as jest.Mock).mockImplementation((_id: string, key: string) =>
      Promise.resolve(key === 'matches' ? [match()] : null)
    );
    (matchesService.fetchMatches as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = renderMatches();

    await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'netErrors.matchesRefresh' })));
    expect(result.current.matches).toHaveLength(1);
  });
});

describe('MatchesProvider.sendMessage', () => {
  it('shows an optimistic message immediately, then settles it on success', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    let resolveSend!: (value: ChatMessage) => void;
    (matchesService.insertTextMessage as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    act(() => {
      result.current.sendMessage('m1', 'hello');
    });

    expect(result.current.getMessages('m1')).toHaveLength(1);
    expect(result.current.getMessages('m1')[0].status).toBe('sending');

    await act(async () => {
      resolveSend(message({ id: 'saved-1', text: 'hello', fromMe: true, status: 'sent' }));
    });

    await waitFor(() => expect(result.current.getMessages('m1')[0].status).toBe('sent'));
    expect(pushService.notifyMessage).toHaveBeenCalledWith('m1', 'hello');
  });

  it('marks the message failed and offers a retry when the send fails', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.insertTextMessage as jest.Mock).mockRejectedValue(new Error('network down'));
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    await act(async () => {
      result.current.sendMessage('m1', 'hello');
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.getMessages('m1')[0].status).toBe('failed'));
    expect(showError).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'netErrors.messageNotSent' }));
  });

  it('ignores a blank message', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    act(() => {
      result.current.sendMessage('m1', '   ');
    });

    expect(result.current.getMessages('m1')).toHaveLength(0);
    expect(matchesService.insertTextMessage).not.toHaveBeenCalled();
  });

  it('retryMessage re-sends a failed message and drops the old copy', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.insertTextMessage as jest.Mock).mockResolvedValue(message({ id: 'saved-1', fromMe: true }));
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    const failed: ChatMessage = { ...message({ fromMe: true, text: 'retry me' }), id: 'pending-1', status: 'failed' };

    await act(async () => {
      result.current.retryMessage(failed);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.getMessages('m1').some((m) => m.id === 'pending-1')).toBe(false);
    expect(matchesService.insertTextMessage).toHaveBeenCalledWith('u1', 'm1', 'retry me');
  });

  it('retryMessage is a no-op for a message that did not fail', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderMatches();
    await waitFor(() => expect(matchesService.fetchMatches).toHaveBeenCalled());
    act(() => {
      result.current.retryMessage(message({ status: 'sent' }));
    });
    expect(matchesService.insertTextMessage).not.toHaveBeenCalled();
  });
});

describe('MatchesProvider.toggleReaction', () => {
  it('adds a reaction optimistically and swaps in the saved row', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (reactionsService.addReaction as jest.Mock).mockResolvedValue({
      id: 'r1',
      messageId: 'msg1',
      userId: 'u1',
      emoji: '❤️',
      createdAt: '2026-01-01',
    });
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    await act(async () => {
      result.current.toggleReaction('msg1', '❤️');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.getReactions('msg1')).toEqual([
      expect.objectContaining({ id: 'r1', emoji: '❤️' }),
    ]);
  });

  it('removes an existing reaction from the same user/emoji pair', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (reactionsService.fetchReactions as jest.Mock).mockResolvedValue({
      msg1: [{ id: 'r1', messageId: 'msg1', userId: 'u1', emoji: '❤️', createdAt: '2026-01-01' }],
    });
    (reactionsService.removeReaction as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getReactions('msg1')).toHaveLength(1));

    act(() => {
      result.current.toggleReaction('msg1', '❤️');
    });

    expect(result.current.getReactions('msg1')).toHaveLength(0);
  });

  it('rolls back an add when the write fails', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (reactionsService.addReaction as jest.Mock).mockRejectedValue(new Error('offline'));
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    await act(async () => {
      result.current.toggleReaction('msg1', '❤️');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.getReactions('msg1')).toHaveLength(0);
  });
});

describe('MatchesProvider.markMatchRead', () => {
  it('clears unread and writes the read mark', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match({ unread: true })]);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')?.unread).toBe(true));

    act(() => {
      result.current.markMatchRead('m1');
    });

    expect(result.current.getMatch('m1')?.unread).toBe(false);
    expect(matchesService.markRead).toHaveBeenCalledWith('u1', 'm1', expect.any(String));
  });

  it('does nothing for an already-read match', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderMatches();
    await waitFor(() => expect(matchesService.fetchMatches).toHaveBeenCalled());
    act(() => {
      result.current.markMatchRead('does-not-exist');
    });
    expect(matchesService.markRead).not.toHaveBeenCalled();
  });
});

describe('MatchesProvider rishta handshake', () => {
  it('sendRishtaRequest marks the match pending and notifies', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.requestRishta as jest.Mock).mockResolvedValue(undefined);
    (matchesService.insertTextMessage as jest.Mock).mockResolvedValue(message({ fromMe: true }));
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    await act(async () => {
      await result.current.sendRishtaRequest('m1', 'Would you like to move to Rishta?');
    });

    expect(result.current.getMatch('m1')?.rishtaRequestPending).toBe(true);
    expect(pushService.notifyRishtaRequest).toHaveBeenCalledWith('m1');
  });

  it('respondRishtaRequest(accept) moves the match and notifies acceptance', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match({ rishtaRequestIncoming: true })]);
    (matchesService.respondRishta as jest.Mock).mockResolvedValue('accepted');
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    let outcome!: string;
    await act(async () => {
      outcome = await result.current.respondRishtaRequest('m1', true);
    });

    expect(outcome).toBe('accepted');
    expect(result.current.getMatch('m1')?.movedToRishta).toBe(true);
    expect(pushService.notifyRishtaAccepted).toHaveBeenCalledWith('m1');
  });

  it('respondRishtaRequest(decline) notifies decline and clears the flags', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match({ rishtaRequestIncoming: true })]);
    (matchesService.respondRishta as jest.Mock).mockResolvedValue('declined');
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    await act(async () => {
      await result.current.respondRishtaRequest('m1', false);
    });

    expect(result.current.getMatch('m1')?.movedToRishta).toBe(false);
    expect(pushService.notifyRishtaDeclined).toHaveBeenCalledWith('m1');
  });
});

describe('MatchesProvider block / unmatch', () => {
  it('removeMatch drops the thread and persists the deletion', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.deleteMatch as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    act(() => {
      result.current.removeMatch('m1');
    });

    expect(result.current.getMatch('m1')).toBeUndefined();
    expect(matchesService.deleteMatch).toHaveBeenCalledWith('m1');
  });

  it('blockMatch blocks the counterpart and removes the thread', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    (matchesService.blockUser as jest.Mock).mockResolvedValue(undefined);
    (matchesService.deleteMatch as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('m1')).toBeTruthy());

    act(() => {
      result.current.blockMatch('m1');
    });

    expect(result.current.blockedProfiles[0]?.id).toBe('p1');
    expect(result.current.getMatch('m1')).toBeUndefined();
  });

  it('unblockUser removes the entry locally and on the server', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchBlocked as jest.Mock).mockResolvedValue([
      { id: 'p1', name: 'Sara', photo: 'a.jpg', blockedAt: '2026-01-01' },
    ]);
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.blockedProfiles).toHaveLength(1));

    act(() => {
      result.current.unblockUser('p1');
    });

    expect(result.current.blockedProfiles).toHaveLength(0);
    expect(matchesService.unblockUser).toHaveBeenCalledWith('u1', 'p1');
  });
});

describe('MatchesProvider.likeProfile', () => {
  it('returns the existing thread and does not notify a match again for an already-matched pair', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match({ id: 'existing-match' })]);
    (likesService.likeProfile as jest.Mock).mockResolvedValue({
      matched: true,
      matchId: 'existing-match',
      isNew: false,
      likesLeft: 3,
    });
    const { result } = renderMatches();
    await waitFor(() => expect(result.current.getMatch('existing-match')).toBeTruthy());

    let outcome!: { match: Match | null };
    await act(async () => {
      outcome = await result.current.likeProfile({ id: 'p9', name: 'Bilal', photo: 'b.jpg', mode: 'dating' });
    });

    expect(outcome.match?.id).toBe('existing-match');
    expect(pushService.notifyMatch).not.toHaveBeenCalled();
  });

  it('creates and returns a brand-new match, notifying it as new', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likesService.likeProfile as jest.Mock).mockResolvedValue({
      matched: true,
      matchId: 'new-match',
      isNew: true,
      likesLeft: 3,
    });
    const { result } = renderMatches();
    await waitFor(() => expect(matchesService.fetchMatches).toHaveBeenCalled());

    let outcome!: { match: Match | null };
    await act(async () => {
      outcome = await result.current.likeProfile({ id: 'p9', name: 'Bilal', photo: 'b.jpg', mode: 'dating' });
    });

    expect(outcome.match?.id).toBe('new-match');
    expect(result.current.getMatch('new-match')).toBeTruthy();
    expect(pushService.notifyMatch).toHaveBeenCalledWith('p9');
  });

  it('notifies a one-sided like when there is no match', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likesService.likeProfile as jest.Mock).mockResolvedValue({ matched: false, matchId: null, isNew: false, likesLeft: 2 });
    const { result } = renderMatches();
    await waitFor(() => expect(matchesService.fetchMatches).toHaveBeenCalled());

    await act(async () => {
      await result.current.likeProfile({ id: 'p9', name: 'Bilal', photo: 'b.jpg', mode: 'dating' });
    });

    expect(pushService.notifyLike).toHaveBeenCalledWith('p9');
  });

  it('throws when signed out', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderMatches();
    await expect(
      result.current.likeProfile({ id: 'p9', name: 'Bilal', photo: 'b.jpg', mode: 'dating' })
    ).rejects.toThrow();
  });
});

describe('MatchesProvider realtime channel', () => {
  it('appends a live message and updates the match preview', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(channelHandlers['chat_messages:INSERT']).toBeTruthy());

    act(() => {
      channelHandlers['chat_messages:INSERT']({
        new: {
          id: 'live-1',
          match_id: 'm1',
          sender_id: 'other-user',
          text: 'live message',
          kind: 'text',
          audio_path: null,
          duration_sec: null,
          image_path: null,
          sent_at: '2026-01-10T00:00:00.000Z',
        },
      });
    });

    expect(result.current.getMessages('m1').some((m) => m.text === 'live message')).toBe(true);
    expect(result.current.getMatch('m1')?.lastMessage).toBe('live message');
    expect(result.current.getMatch('m1')?.unread).toBe(true);
  });

  it('applies a rishta request/response arriving on the shared match row', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(channelHandlers['matches:UPDATE']).toBeTruthy());

    act(() => {
      channelHandlers['matches:UPDATE']({
        new: { id: 'm1', mode: 'dating', rishta_requested_by: 'other-user' },
      });
    });

    expect(result.current.getMatch('m1')?.rishtaRequestIncoming).toBe(true);
    expect(result.current.getMatch('m1')?.rishtaRequestPending).toBe(false);
  });

  it('applies the other member opening the thread as a read receipt', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(channelHandlers['match_reads:INSERT']).toBeTruthy());

    act(() => {
      channelHandlers['match_reads:INSERT']({
        new: { match_id: 'm1', user_id: 'other-user', last_read_at: '2026-01-10T00:00:00.000Z' },
      });
    });

    expect(result.current.getMatch('m1')?.theirReadAt).toBe('2026-01-10T00:00:00.000Z');
  });

  it('ignores its own read mark echoed back on the channel', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(channelHandlers['match_reads:INSERT']).toBeTruthy());

    act(() => {
      channelHandlers['match_reads:INSERT']({
        new: { match_id: 'm1', user_id: 'u1', last_read_at: '2026-01-10T00:00:00.000Z' },
      });
    });

    expect(result.current.getMatch('m1')?.theirReadAt).toBeUndefined();
  });

  it('adds and drops a live reaction', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (matchesService.fetchMatches as jest.Mock).mockResolvedValue([match()]);
    const { result } = renderMatches();
    await waitFor(() => expect(channelHandlers['message_reactions:INSERT']).toBeTruthy());

    act(() => {
      channelHandlers['message_reactions:INSERT']({
        new: { id: 'r1', message_id: 'msg1', user_id: 'other-user', emoji: '😂', created_at: '2026-01-10' },
      });
    });
    expect(result.current.getReactions('msg1')).toHaveLength(1);

    act(() => {
      channelHandlers['message_reactions:DELETE']({
        old: { message_id: 'msg1', id: 'r1' },
      });
    });
    expect(result.current.getReactions('msg1')).toHaveLength(0);
  });
});
