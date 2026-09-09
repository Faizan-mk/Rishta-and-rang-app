import { renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { usePushNavigation } from '../usePushNavigation';
import { pushService } from '../../services/pushService';
import { useAuth } from '../../store/AuthContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../services/pushService', () => ({
  pushService: { initialNotificationTap: jest.fn(), onNotificationTap: jest.fn() },
}));
jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

let push: jest.Mock;
let unsubscribe: jest.Mock;
let capturedHandler: ((routing: { event?: string; matchId?: string }) => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  push = jest.fn();
  unsubscribe = jest.fn();
  mockUseRouter.mockReturnValue({ push });
  (pushService.initialNotificationTap as jest.Mock).mockResolvedValue(null);
  (pushService.onNotificationTap as jest.Mock).mockImplementation((handler) => {
    capturedHandler = handler;
    return unsubscribe;
  });
});

describe('usePushNavigation', () => {
  it('does not subscribe at all while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => usePushNavigation());
    expect(pushService.onNotificationTap).not.toHaveBeenCalled();
  });

  it('subscribes once signed in and unsubscribes on unmount', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { unmount } = renderHook(() => usePushNavigation());
    expect(pushService.onNotificationTap).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('routes a message tap to the chat thread', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => usePushNavigation());
    capturedHandler!({ matchId: 'm1' });
    expect(push).toHaveBeenCalledWith('/chat/m1');
  });

  it('routes a rishta-request tap to the matching thread over the event route', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => usePushNavigation());
    capturedHandler!({ event: 'rishta_request', matchId: 'm2' });
    expect(push).toHaveBeenCalledWith('/chat/m2');
  });

  it('routes a new-match tap (no matchId) to the messages list', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => usePushNavigation());
    capturedHandler!({ event: 'match' });
    expect(push).toHaveBeenCalledWith('/(tabs)/messages');
  });

  it('routes a like tap to notifications', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => usePushNavigation());
    capturedHandler!({ event: 'like' });
    expect(push).toHaveBeenCalledWith('/notifications');
  });

  it('does nothing for an unrecognised event with no matchId', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => usePushNavigation());
    capturedHandler!({ event: 'system' });
    expect(push).not.toHaveBeenCalled();
  });
});
