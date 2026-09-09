import React from 'react';
import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import Index from '../index';
import { useAuth } from '../../hooks/useAuth';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../store/OnboardingGateContext', () => ({ useOnboardingGate: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboardingGate = useOnboardingGate as jest.Mock;
const MockRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Index route', () => {
  it('redirects to /home when signed in, regardless of onboarding state', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseOnboardingGate.mockReturnValue({ seenOnboarding: null });
    render(<Index />);
    expect(MockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/home' }), undefined);
  });

  it('renders nothing while the onboarding flag is still loading and signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseOnboardingGate.mockReturnValue({ seenOnboarding: null });
    const { toJSON } = render(<Index />);
    expect(toJSON()).toBeNull();
    expect(MockRedirect).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding on a first-ever, signed-out visit', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseOnboardingGate.mockReturnValue({ seenOnboarding: false });
    render(<Index />);
    expect(MockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/onboarding' }), undefined);
  });

  it('redirects to /welcome for a returning, signed-out visitor', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseOnboardingGate.mockReturnValue({ seenOnboarding: true });
    render(<Index />);
    expect(MockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/welcome' }), undefined);
  });
});
