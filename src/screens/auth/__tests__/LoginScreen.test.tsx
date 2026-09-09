import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { LoginScreen } from '../LoginScreen';
import { useAuth } from '../../../store/AuthContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const push = jest.fn();
let login: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  login = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ login });
});

describe('LoginScreen', () => {
  it('rejects an invalid email without calling login', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(screen.getByText('Log in'));
    expect(login).not.toHaveBeenCalled();
  });

  it('requires a password', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.press(screen.getByText('Log in'));
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in with a valid email and password', async () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(screen.getByText('Log in'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('a@example.com', 'Password1!'));
  });

  it('shows the server error message when login fails', async () => {
    login.mockRejectedValue(new Error('Invalid login credentials'));
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(screen.getByText('Log in'));

    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy());
  });

  it('navigates to /forgot-password', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.press(screen.getByText('Forgot password?'));
    expect(push).toHaveBeenCalledWith('/forgot-password');
  });

  it('navigates to /signup', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.press(screen.getByText('Create an account'));
    expect(push).toHaveBeenCalledWith('/signup');
  });
});
