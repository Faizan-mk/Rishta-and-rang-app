import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { ResetPasswordScreen } from '../ResetPasswordScreen';
import { authService } from '../../../services/authService';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../store/AuthContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-linking', () => ({ useURL: jest.fn(), getInitialURL: jest.fn() }));
jest.mock('../../../services/authService', () => ({
  authService: { openPasswordResetLink: jest.fn(), updatePassword: jest.fn() },
}));
jest.mock('../../../services/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseURL = Linking.useURL as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const replace = jest.fn();
const back = jest.fn();
let logout: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace, back });
  logout = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ logout });
  mockUseURL.mockReturnValue('rishta://reset-password#access_token=a&refresh_token=b');
  (authService.openPasswordResetLink as jest.Mock).mockResolvedValue(undefined);
  (authService.updatePassword as jest.Mock).mockResolvedValue(undefined);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
});

describe('ResetPasswordScreen', () => {
  it('shows the password form once the reset link verifies', async () => {
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());
    expect(authService.openPasswordResetLink).toHaveBeenCalledWith(
      'rishta://reset-password#access_token=a&refresh_token=b'
    );
  });

  it('shows the invalid-link notice when the link fails to verify', async () => {
    (authService.openPasswordResetLink as jest.Mock).mockRejectedValue(new Error('link expired'));
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('link expired')).toBeTruthy());
    expect(screen.getByText('Request a new link')).toBeTruthy();
  });

  it('falls back to checking for a live session when there is no link', async () => {
    mockUseURL.mockReturnValue(null);
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'x' } } });
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());
  });

  it('rejects a weak password', async () => {
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());

    const [newPasswordInput] = screen.getAllByDisplayValue('');
    fireEvent.changeText(newPasswordInput, 'weak');
    fireEvent.press(screen.getByText('Update password'));

    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());

    const [newPasswordInput, confirmInput] = screen.getAllByDisplayValue('');
    fireEvent.changeText(newPasswordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password2!');
    fireEvent.press(screen.getByText('Update password'));

    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password, signs out and shows the done state', async () => {
    renderWithProviders(<ResetPasswordScreen />);
    await waitFor(() => expect(screen.getByText('Update password')).toBeTruthy());

    const [newPasswordInput, confirmInput] = screen.getAllByDisplayValue('');
    fireEvent.changeText(newPasswordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password1!');
    fireEvent.press(screen.getByText('Update password'));

    await waitFor(() => expect(authService.updatePassword).toHaveBeenCalledWith('Password1!'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Go to log in')).toBeTruthy());
  });
});
