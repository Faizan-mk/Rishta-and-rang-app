import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { OnboardingScreen } from '../OnboardingScreen';
import { useOnboardingGate } from '../../../store/OnboardingGateContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/OnboardingGateContext', () => ({ useOnboardingGate: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseOnboardingGate = useOnboardingGate as jest.Mock;
const replace = jest.fn();
let markOnboardingSeen: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace });
  markOnboardingSeen = jest.fn();
  mockUseOnboardingGate.mockReturnValue({ markOnboardingSeen });
});

describe('OnboardingScreen', () => {
  it('starts on the first page showing "Next"', () => {
    renderWithProviders(<OnboardingScreen />);
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('advances to the last page and shows "Get Started"', () => {
    renderWithProviders(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('marks onboarding seen and goes to /welcome when Skip is pressed', () => {
    renderWithProviders(<OnboardingScreen />);
    // The skip button is the only Pressable with hitSlop 10 (the "close" icon).
    fireEvent.press(screen.UNSAFE_getByProps({ hitSlop: 10 }));
    expect(markOnboardingSeen).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/welcome');
  });

  it('marks onboarding seen and goes to /welcome when finishing the last page', () => {
    renderWithProviders(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Next'));
    fireEvent.press(screen.getByText('Get Started'));
    expect(markOnboardingSeen).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/welcome');
  });
});
