import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { BoostProvider, useBoost, STARTING_BOOSTS, BOOST_DURATION_HOURS } from '../BoostContext';
import { boostService } from '../../services/boostService';
import { useAuth } from '../AuthContext';

jest.mock('../../services/boostService', () => ({ boostService: { fetchState: jest.fn(), setState: jest.fn() } }));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function renderBoost() {
  return renderHook(() => useBoost(), { wrapper: ({ children }) => <BoostProvider>{children}</BoostProvider> });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  (boostService.fetchState as jest.Mock).mockResolvedValue({ boostsLeft: STARTING_BOOSTS, activeUntil: null });
  (boostService.setState as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BoostProvider', () => {
  it('defaults to the starting boost count when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderBoost();
    expect(result.current.boostsLeft).toBe(STARTING_BOOSTS);
    expect(result.current.isBoostActive).toBe(false);
  });

  it('loads the stored boost state for a signed-in member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (boostService.fetchState as jest.Mock).mockResolvedValue({ boostsLeft: 1, activeUntil: null });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.boostsLeft).toBe(1));
  });

  it('startBoost consumes one boost and starts the active window', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.boostsLeft).toBe(STARTING_BOOSTS));

    let started!: boolean;
    act(() => {
      started = result.current.startBoost();
    });

    expect(started).toBe(true);
    expect(result.current.boostsLeft).toBe(STARTING_BOOSTS - 1);
    expect(result.current.isBoostActive).toBe(true);
    expect(boostService.setState).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ boostsLeft: STARTING_BOOSTS - 1 })
    );
  });

  it('startBoost refuses when there are no boosts left', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (boostService.fetchState as jest.Mock).mockResolvedValue({ boostsLeft: 0, activeUntil: null });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.boostsLeft).toBe(0));

    let started!: boolean;
    act(() => {
      started = result.current.startBoost();
    });

    expect(started).toBe(false);
  });

  it('startBoost refuses while a boost is already running', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (boostService.fetchState as jest.Mock).mockResolvedValue({
      boostsLeft: 2,
      activeUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.isBoostActive).toBe(true));

    let started!: boolean;
    act(() => {
      started = result.current.startBoost();
    });

    expect(started).toBe(false);
    expect(result.current.boostsLeft).toBe(2);
  });

  it('flips back to idle on its own once the active window elapses', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const soon = new Date(Date.now() + 5000).toISOString();
    (boostService.fetchState as jest.Mock).mockResolvedValue({ boostsLeft: 2, activeUntil: soon });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.isBoostActive).toBe(true));

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.isBoostActive).toBe(false);
  });

  it('addBoosts increases the count without touching the active window', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderBoost();
    await waitFor(() => expect(result.current.boostsLeft).toBe(STARTING_BOOSTS));

    act(() => {
      result.current.addBoosts(5);
    });

    expect(result.current.boostsLeft).toBe(STARTING_BOOSTS + 5);
  });

  it('exposes the configured boost duration', () => {
    expect(BOOST_DURATION_HOURS).toBe(3);
  });
});
