import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { LikeLimitProvider, useLikeLimit, DAILY_FREE_LIKES } from '../LikeLimitContext';
import { likeLimitService } from '../../services/likeLimitService';
import { useAuth } from '../AuthContext';

jest.mock('../../services/likeLimitService', () => ({ likeLimitService: { fetchState: jest.fn() } }));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function renderLimit() {
  return renderHook(() => useLikeLimit(), {
    wrapper: ({ children }) => <LikeLimitProvider>{children}</LikeLimitProvider>,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LikeLimitProvider', () => {
  it('starts at zero used with the full daily allowance when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderLimit();
    expect(result.current.used).toBe(0);
    expect(result.current.remaining).toBe(DAILY_FREE_LIKES);
    expect(result.current.canLike).toBe(true);
    expect(result.current.isUnlimited).toBe(false);
  });

  it('is unlimited for an Explore+ member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', isExplorePlus: true } });
    const { result } = renderLimit();
    expect(result.current.isUnlimited).toBe(true);
    expect(result.current.canLike).toBe(true);
    await waitFor(() => expect(likeLimitService.fetchState).toHaveBeenCalled());
  });

  it("loads today's stored count for a signed-in member", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: 5 });

    const { result } = renderLimit();

    await waitFor(() => expect(result.current.used).toBe(5));
    expect(result.current.remaining).toBe(DAILY_FREE_LIKES - 5);
  });

  it("discards yesterday's stored count as stale", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-14', count: 10 });

    const { result } = renderLimit();

    await waitFor(() => expect(likeLimitService.fetchState).toHaveBeenCalled());
    expect(result.current.used).toBe(0);
  });

  it('recordLike increments the local count and returns true under the cap', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: 0 });
    const { result } = renderLimit();
    await waitFor(() => expect(likeLimitService.fetchState).toHaveBeenCalled());

    let recorded!: boolean;
    act(() => {
      recorded = result.current.recordLike();
    });

    expect(recorded).toBe(true);
    expect(result.current.used).toBe(1);
  });

  it('recordLike refuses once the daily cap is reached', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: DAILY_FREE_LIKES });
    const { result } = renderLimit();
    await waitFor(() => expect(result.current.used).toBe(DAILY_FREE_LIKES));

    let recorded!: boolean;
    act(() => {
      recorded = result.current.recordLike();
    });

    expect(recorded).toBe(false);
    expect(result.current.canLike).toBe(false);
  });

  it('recordLike always succeeds for an unlimited member without touching the count', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', isExplorePlus: true } });
    const { result } = renderLimit();
    await waitFor(() => expect(likeLimitService.fetchState).toHaveBeenCalled());

    let recorded!: boolean;
    act(() => {
      recorded = result.current.recordLike();
    });

    expect(recorded).toBe(true);
    expect(result.current.used).toBe(0);
  });

  it('recordLike refuses when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderLimit();
    let recorded!: boolean;
    act(() => {
      recorded = result.current.recordLike();
    });
    expect(recorded).toBe(false);
  });

  it('applyServerCount reconciles the local count with likes_left', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: 0 });
    const { result } = renderLimit();
    await waitFor(() => expect(likeLimitService.fetchState).toHaveBeenCalled());

    act(() => {
      result.current.applyServerCount(10); // 5 used out of 15
    });

    expect(result.current.used).toBe(DAILY_FREE_LIKES - 10);
  });

  it('applyServerCount leaves the count alone for an unlimited response (-1)', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (likeLimitService.fetchState as jest.Mock).mockResolvedValue({ date: '2026-01-15', count: 3 });
    const { result } = renderLimit();
    await waitFor(() => expect(result.current.used).toBe(3));

    act(() => {
      result.current.applyServerCount(-1);
    });

    expect(result.current.used).toBe(3);
  });
});
