import { renderHook } from '@testing-library/react-native';
import { useBillingRegistration } from '../useBillingRegistration';
import { configureBilling, logOutBilling } from '../../services/billingService';
import { useAuth } from '../../store/AuthContext';

jest.mock('../../services/billingService', () => ({
  configureBilling: jest.fn(),
  logOutBilling: jest.fn(),
}));
jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (logOutBilling as jest.Mock).mockResolvedValue(undefined);
});

describe('useBillingRegistration', () => {
  it('configures billing for the signed-in member', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    renderHook(() => useBillingRegistration());
    expect(configureBilling).toHaveBeenCalledWith('u1');
  });

  it('logs billing out on sign-out', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { rerender } = renderHook(() => useBillingRegistration());

    mockUseAuth.mockReturnValue({ user: null });
    rerender(undefined);

    expect(logOutBilling).toHaveBeenCalled();
  });

  it('does nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => useBillingRegistration());
    expect(configureBilling).not.toHaveBeenCalled();
  });
});
