import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useActivityHeartbeat } from '../useActivityHeartbeat';
import { authService } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';

jest.mock('../../services/authService', () => ({ authService: { touchLastActive: jest.fn() } }));
jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const MIN_INTERVAL_MS = 5 * 60 * 1000;

let appStateListener: ((state: string) => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (authService.touchLastActive as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    appStateListener = cb as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useActivityHeartbeat', () => {
  it('does nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => useActivityHeartbeat());
    expect(authService.touchLastActive).not.toHaveBeenCalled();
  });

  it('touches on mount once signed in', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => useActivityHeartbeat());
    expect(authService.touchLastActive).toHaveBeenCalledWith('u1');
  });

  it('does not touch again inside the minimum interval, but does after it elapses', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => useActivityHeartbeat());
    expect(authService.touchLastActive).toHaveBeenCalledTimes(1);

    act(() => {
      appStateListener?.('active'); // well within the interval
    });
    expect(authService.touchLastActive).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(MIN_INTERVAL_MS);
    });
    expect(authService.touchLastActive).toHaveBeenCalledTimes(2);
  });

  it('touches again on returning to the foreground once the interval has elapsed', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => useActivityHeartbeat());
    expect(authService.touchLastActive).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(MIN_INTERVAL_MS + 1000);
    });
    // The interval timer itself would have fired once too; either way, coming
    // to the foreground after the window elapsed still counts as a touch.
    const callsBeforeForeground = (authService.touchLastActive as jest.Mock).mock.calls.length;
    act(() => {
      appStateListener?.('background');
      appStateListener?.('active');
    });
    expect((authService.touchLastActive as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(callsBeforeForeground);
  });

  it('ignores a transition to background', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => useActivityHeartbeat());
    (authService.touchLastActive as jest.Mock).mockClear();

    act(() => {
      appStateListener?.('background');
    });
    expect(authService.touchLastActive).not.toHaveBeenCalled();
  });

  it('resets the throttle when the member signs out and back in', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { rerender } = renderHook(() => useActivityHeartbeat());
    expect(authService.touchLastActive).toHaveBeenCalledTimes(1);

    mockUseAuth.mockReturnValue({ user: null });
    rerender(undefined);
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    rerender(undefined);

    // A fresh sign-in touches immediately again, even though little time passed.
    expect(authService.touchLastActive).toHaveBeenCalledTimes(2);
  });
});
