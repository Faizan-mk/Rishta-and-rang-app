import React from 'react';
import { TextInput } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { authService } from '../../../services/authService';
import { AppError } from '../../../utils/appError';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../services/authService', () => ({
  authService: { requestOtp: jest.fn(), verifyOtp: jest.fn(), resetPasswordWithOtp: jest.fn() },
}));

const mockUseRouter = useRouter as jest.Mock;
const back = jest.fn();
const replace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back, replace });
  (authService.requestOtp as jest.Mock).mockResolvedValue({ resendIn: 60 });
  (authService.verifyOtp as jest.Mock).mockResolvedValue('tkt');
  (authService.resetPasswordWithOtp as jest.Mock).mockResolvedValue(undefined);
});

async function reachCodeStep() {
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
  fireEvent.press(screen.getByText('Send code'));
  await waitFor(() => expect(screen.getByTestId('otp-input')).toBeTruthy());
}

async function reachPasswordStep() {
  await reachCodeStep();
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
  });
  await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());
}

describe('ForgotPasswordScreen', () => {
  it('rejects an invalid email without calling the service', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(screen.getByText('Send code'));
    expect(authService.requestOtp).not.toHaveBeenCalled();
  });

  it('sends a reset code and moves to the code step', async () => {
    renderWithProviders(<ForgotPasswordScreen />);
    await reachCodeStep();
    expect(authService.requestOtp).toHaveBeenCalledWith('a@example.com', 'reset', 'en');
    expect(screen.getByText(/We sent a 6-digit code to a@example.com/)).toBeTruthy();
    expect(screen.getByText('Resend code in 60s')).toBeTruthy();
  });

  it('shows an error message when the code cannot be sent', async () => {
    (authService.requestOtp as jest.Mock).mockRejectedValue(new AppError('authErrors.otpSendFailed'));
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.press(screen.getByText('Send code'));

    await waitFor(() => expect(screen.getByText(/could not send the code/)).toBeTruthy());
  });

  it('verifies the code as soon as the sixth digit is typed', async () => {
    renderWithProviders(<ForgotPasswordScreen />);
    await reachPasswordStep();
    expect(authService.verifyOtp).toHaveBeenCalledWith('a@example.com', 'reset', '123456');
  });

  it('shows the attempts left for a wrong code', async () => {
    (authService.verifyOtp as jest.Mock).mockRejectedValue(new AppError('authErrors.otpInvalid', { remaining: 4 }));
    renderWithProviders(<ForgotPasswordScreen />);
    await reachCodeStep();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp-input'), '000000');
    });

    await waitFor(() => expect(screen.getByText(/4 attempts left/)).toBeTruthy());
  });

  it('rejects a weak new password without calling the service', async () => {
    renderWithProviders(<ForgotPasswordScreen />);
    await reachPasswordStep();
    fireEvent.changeText(screen.UNSAFE_getAllByType(TextInput)[0], 'weak');
    fireEvent.press(screen.getByText('Update password'));
    expect(authService.resetPasswordWithOtp).not.toHaveBeenCalled();
  });

  it('writes the new password with the ticket and shows the done notice', async () => {
    renderWithProviders(<ForgotPasswordScreen />);
    await reachPasswordStep();
    const [passwordInput, confirmInput] = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(passwordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password1!');
    fireEvent.press(screen.getByText('Update password'));

    await waitFor(() =>
      expect(authService.resetPasswordWithOtp).toHaveBeenCalledWith('a@example.com', 'tkt', 'Password1!')
    );
    await waitFor(() => expect(screen.getByText(/Your password has been updated/)).toBeTruthy());
    fireEvent.press(screen.getByText('Go to log in'));
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('goes back when the header back button is pressed', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.press(screen.getAllByRole('button')[0]);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
