import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { authService } from '../../../services/authService';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../services/authService', () => ({ authService: { requestPasswordReset: jest.fn() } }));

const mockUseRouter = useRouter as jest.Mock;
const back = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  (authService.requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
});

describe('ForgotPasswordScreen', () => {
  it('rejects an invalid email without calling the service', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(screen.getByText('Send reset link'));
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the reset link and shows the confirmation notice', async () => {
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@example.com'));
    await waitFor(() => expect(screen.getByText(/reset link is on its way/)).toBeTruthy());
  });

  it('shows an error message when the request fails', async () => {
    (authService.requestPasswordReset as jest.Mock).mockRejectedValue(new Error('network down'));
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy());
  });

  it('goes back when the header back button is pressed', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByRole('button'));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
