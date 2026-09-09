import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { PrivacyProvider, usePrivacy } from '../PrivacyContext';
import { privacyService } from '../../services/privacyService';
import { useAuth } from '../AuthContext';
import { DEFAULT_PRIVACY_PREFS } from '../../types/content';

jest.mock('../../services/privacyService', () => ({
  privacyService: { fetchPrefs: jest.fn(), setPrefs: jest.fn() },
}));

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function renderPrivacy() {
  return renderHook(() => usePrivacy(), { wrapper: ({ children }) => <PrivacyProvider>{children}</PrivacyProvider> });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrivacyProvider', () => {
  it('defaults to DEFAULT_PRIVACY_PREFS when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderPrivacy();
    expect(result.current.prefs).toEqual(DEFAULT_PRIVACY_PREFS);
  });

  it('loads prefs for the signed-in user', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (privacyService.fetchPrefs as jest.Mock).mockResolvedValue({
      profileVisible: false,
      onlineStatusVisible: false,
      blurPhotos: true,
    });

    const { result } = renderPrivacy();

    await waitFor(() => expect(result.current.prefs.blurPhotos).toBe(true));
    expect(privacyService.fetchPrefs).toHaveBeenCalledWith('u1');
  });

  it('setPref updates state locally and persists it', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    (privacyService.fetchPrefs as jest.Mock).mockResolvedValue(DEFAULT_PRIVACY_PREFS);
    const { result } = renderPrivacy();
    await waitFor(() => expect(privacyService.fetchPrefs).toHaveBeenCalled());

    act(() => {
      result.current.setPref('blurPhotos', true);
    });

    expect(result.current.prefs.blurPhotos).toBe(true);
    expect(privacyService.setPrefs).toHaveBeenCalledWith('u1', expect.objectContaining({ blurPhotos: true }));
  });

  it('setPref is a no-op when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderPrivacy();
    act(() => {
      result.current.setPref('blurPhotos', true);
    });
    expect(privacyService.setPrefs).not.toHaveBeenCalled();
  });
});
