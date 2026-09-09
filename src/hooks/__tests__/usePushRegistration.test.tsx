import { renderHook, waitFor } from '@testing-library/react-native';
import { usePushRegistration } from '../usePushRegistration';
import { pushService } from '../../services/pushService';
import { useAuth } from '../../store/AuthContext';

jest.mock('../../services/pushService', () => ({
  pushService: { requestPushToken: jest.fn(), registerPushToken: jest.fn(), unregisterPushToken: jest.fn() },
}));
jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (pushService.registerPushToken as jest.Mock).mockResolvedValue(undefined);
  (pushService.unregisterPushToken as jest.Mock).mockResolvedValue(undefined);
});

describe('usePushRegistration', () => {
  it('does nothing when there is no push token available (declined/no hardware)', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (pushService.requestPushToken as jest.Mock).mockResolvedValue(null);

    renderHook(() => usePushRegistration());

    await waitFor(() => expect(pushService.requestPushToken).toHaveBeenCalled());
    expect(pushService.registerPushToken).not.toHaveBeenCalled();
  });

  it('registers the token once signed in', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (pushService.requestPushToken as jest.Mock).mockResolvedValue('token-1');

    renderHook(() => usePushRegistration());

    await waitFor(() => expect(pushService.registerPushToken).toHaveBeenCalledWith('token-1'));
  });

  it('unregisters the previously stored token on sign-out', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (pushService.requestPushToken as jest.Mock).mockResolvedValue('token-1');
    const { rerender } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(pushService.registerPushToken).toHaveBeenCalledWith('token-1'));

    mockUseAuth.mockReturnValue({ user: null });
    rerender(undefined);

    await waitFor(() => expect(pushService.unregisterPushToken).toHaveBeenCalledWith('token-1'));
  });

  it('does not attempt to unregister when no token was ever stored', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => usePushRegistration());
    expect(pushService.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('swallows a registration failure without throwing', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (pushService.requestPushToken as jest.Mock).mockResolvedValue('token-1');
    (pushService.registerPushToken as jest.Mock).mockRejectedValue(new Error('rpc not deployed'));

    expect(() => renderHook(() => usePushRegistration())).not.toThrow();
    await waitFor(() => expect(pushService.registerPushToken).toHaveBeenCalled());
  });
});
