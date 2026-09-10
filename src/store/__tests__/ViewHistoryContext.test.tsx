import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ViewHistoryProvider, useViewHistory } from '../ViewHistoryContext';
import { viewHistoryService } from '../../services/viewHistoryService';
import { useAuth } from '../AuthContext';

jest.mock('../../services/viewHistoryService', () => ({
  viewHistoryService: { fetchHistory: jest.fn(), recordView: jest.fn(), clearHistory: jest.fn() },
}));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function renderHistory() {
  return renderHook(() => useViewHistory(), {
    wrapper: ({ children }) => <ViewHistoryProvider>{children}</ViewHistoryProvider>,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (viewHistoryService.fetchHistory as jest.Mock).mockResolvedValue([]);
  (viewHistoryService.recordView as jest.Mock).mockResolvedValue(undefined);
  (viewHistoryService.clearHistory as jest.Mock).mockResolvedValue(undefined);
});

const profile = { id: 'p1', kind: 'dating' as const, name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg' };

describe('ViewHistoryProvider', () => {
  it('starts empty when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHistory();
    expect(result.current.history).toEqual([]);
  });

  it('loads history for a signed-in member', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (viewHistoryService.fetchHistory as jest.Mock).mockResolvedValue([{ ...profile, viewedAt: '2026-01-01' }]);
    const { result } = renderHistory();
    await waitFor(() => expect(result.current.history).toHaveLength(1));
  });

  it('recordView prepends the profile and persists it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderHistory();
    await waitFor(() => expect(viewHistoryService.fetchHistory).toHaveBeenCalled());

    act(() => {
      result.current.recordView(profile);
    });

    expect(result.current.history[0]).toMatchObject({ id: 'p1', name: 'Sara' });
    expect(viewHistoryService.recordView).toHaveBeenCalledWith('u1', profile);
  });

  it('recordView does not duplicate the same profile viewed twice in a row', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderHistory();
    await waitFor(() => expect(viewHistoryService.fetchHistory).toHaveBeenCalled());

    act(() => {
      result.current.recordView(profile);
    });
    act(() => {
      result.current.recordView(profile);
    });

    expect(viewHistoryService.recordView).toHaveBeenCalledTimes(1);
  });

  it('recordView moves a re-viewed (non-consecutive) profile back to the front', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const other = { ...profile, id: 'p2', name: 'Bilal' };
    const { result } = renderHistory();
    await waitFor(() => expect(viewHistoryService.fetchHistory).toHaveBeenCalled());

    act(() => {
      result.current.recordView(profile);
    });
    act(() => {
      result.current.recordView(other);
    });
    act(() => {
      result.current.recordView(profile);
    });

    expect(result.current.history.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('recordView is a no-op when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHistory();
    act(() => {
      result.current.recordView(profile);
    });
    expect(result.current.history).toEqual([]);
    expect(viewHistoryService.recordView).not.toHaveBeenCalled();
  });

  it('clearHistory empties the list and persists it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { result } = renderHistory();
    await waitFor(() => expect(viewHistoryService.fetchHistory).toHaveBeenCalled());
    act(() => {
      result.current.recordView(profile);
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(viewHistoryService.clearHistory).toHaveBeenCalledWith('u1');
  });
});
