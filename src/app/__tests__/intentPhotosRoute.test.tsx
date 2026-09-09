import React from 'react';
import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import IntentPhotosRoute from '../(auth)/intent-photos';
import { useOnboarding } from '../../store/onboardingStore';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('../../store/onboardingStore', () => ({ useOnboarding: jest.fn() }));
jest.mock('../../screens/auth/IntentPhotosScreen', () => ({ IntentPhotosScreen: () => null }));

const mockUseOnboarding = useOnboarding as jest.Mock;
const MockRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('IntentPhotosRoute', () => {
  it('redirects to /signup when there is no draft (reload/deep link with nothing to extend)', () => {
    mockUseOnboarding.mockReturnValue({ draft: null });
    render(<IntentPhotosRoute />);
    expect(MockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/signup' }), undefined);
  });

  it('renders the screen when a draft is in progress', () => {
    mockUseOnboarding.mockReturnValue({ draft: { fullName: 'Ayesha' } });
    render(<IntentPhotosRoute />);
    expect(MockRedirect).not.toHaveBeenCalled();
  });
});
