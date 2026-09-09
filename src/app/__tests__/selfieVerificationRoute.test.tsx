import React from 'react';
import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import SelfieVerificationRoute from '../(auth)/selfie-verification';
import { useOnboarding } from '../../store/onboardingStore';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('../../store/onboardingStore', () => ({ useOnboarding: jest.fn() }));
jest.mock('../../screens/auth/SelfieVerificationScreen', () => ({ SelfieVerificationScreen: () => null }));

const mockUseOnboarding = useOnboarding as jest.Mock;
const MockRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SelfieVerificationRoute', () => {
  it('redirects to /signup when there is no draft', () => {
    mockUseOnboarding.mockReturnValue({ draft: null });
    render(<SelfieVerificationRoute />);
    expect(MockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/signup' }), undefined);
  });

  it('renders the screen when a draft is in progress', () => {
    mockUseOnboarding.mockReturnValue({ draft: { fullName: 'Ayesha' } });
    render(<SelfieVerificationRoute />);
    expect(MockRedirect).not.toHaveBeenCalled();
  });
});
