import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { WelcomeScreen } from '../WelcomeScreen';
import { useOnboardingGate } from '../../../store/OnboardingGateContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/OnboardingGateContext', () => ({ useOnboardingGate: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: () => null }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseOnboardingGate = useOnboardingGate as jest.Mock;
const push = jest.fn();
const replace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, replace });
  mockUseOnboardingGate.mockReturnValue({ resetOnboardingSeen: jest.fn() });
});

describe('WelcomeScreen', () => {
  it('renders the app name and both entry actions', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Log in')).toBeTruthy();
    expect(screen.getByText('Create an account')).toBeTruthy();
  });

  it('navigates to /login when Log in is pressed', () => {
    renderWithProviders(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Log in'));
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('navigates to /signup when Create an account is pressed', () => {
    renderWithProviders(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Create an account'));
    expect(push).toHaveBeenCalledWith('/signup');
  });

  it('switches the active language when a language pill is tapped', () => {
    renderWithProviders(<WelcomeScreen />);
    fireEvent.press(screen.getByText('اردو'));
    // Re-render pulls the label for the login button in the newly active language.
    expect(screen.queryByText('Log in')).toBeNull();
  });
});
