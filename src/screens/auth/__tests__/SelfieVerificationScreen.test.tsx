import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { SelfieVerificationScreen } from '../SelfieVerificationScreen';
import { DialogProvider } from '../../../store/DialogContext';
import { useAuth } from '../../../store/AuthContext';
import { useOnboarding } from '../../../store/onboardingStore';
import { analyzeIdCardPhoto } from '../../../utils/idCardImageCheck';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/onboardingStore', () => ({ useOnboarding: jest.fn() }));
jest.mock('../../../utils/idCardImageCheck', () => ({ analyzeIdCardPhoto: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  CameraType: { front: 'front' },
}));
// ImageCropper has its own dedicated test; stub it here so this file stays
// focused on SelfieVerificationScreen's own wiring rather than re-rendering
// the real Modal/Animated/GestureDetector cropper, which under a full-suite
// parallel run caused CPU-contention flakiness (see IntentPhotosScreen for
// the same fix).
jest.mock('../../../components/common/ImageCropper', () => ({
  ImageCropper: ({ uri, onCropped }: { uri: string | null; onCropped: (uri: string) => void }) => {
    const React2 = require('react');
    React2.useEffect(() => {
      if (uri) onCropped(uri);
    }, [uri]);
    return null;
  },
}));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
let signup: jest.Mock;

const DRAFT = {
  fullName: 'Ayesha',
  email: 'a@example.com',
  password: 'Password1!',
  dob: '1998-05-20',
  gender: 'female' as const,
  city: 'Lahore',
  intent: 'serious' as const,
  bio: '',
  photos: ['a.jpg', 'b.jpg'],
  cnicNumber: '12345-1234567-2',
};

function renderScreen() {
  return render(withProviders(<DialogProvider><SelfieVerificationScreen /></DialogProvider>));
}

async function captureSelfie() {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///selfie.jpg' }],
  });
  fireEvent.press(screen.getByText('Take selfie'));
  await waitFor(() => expect(screen.getByText('Retake')).toBeTruthy());
}

async function uploadCnicPhoto() {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cnic.jpg' }],
  });
  (analyzeIdCardPhoto as jest.Mock).mockResolvedValue({ looksValid: true });
  fireEvent.press(screen.getByText('Upload ID photo'));
  await waitFor(() => expect(analyzeIdCardPhoto).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back: jest.fn() });
  signup = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ signup });
  mockUseOnboarding.mockReturnValue({ draft: DRAFT });
});

describe('SelfieVerificationScreen', () => {
  it('does not finish without a selfie and a CNIC photo', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Done'));
    expect(signup).not.toHaveBeenCalled();
  });

  it('rejects a CNIC photo that fails the image check', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cnic.jpg' }],
    });
    (analyzeIdCardPhoto as jest.Mock).mockResolvedValue({ looksValid: false, reason: 'wrongShape' });
    renderScreen();

    fireEvent.press(screen.getByText('Upload ID photo'));

    await waitFor(() =>
      expect(screen.getByText(/make sure the whole card fills the frame/)).toBeTruthy()
    );
  });

  it('signs up with the draft plus the captured selfie and CNIC photo', async () => {
    renderScreen();
    await captureSelfie();
    await uploadCnicPhoto();

    fireEvent.press(screen.getByText('Done'));

    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Ayesha',
          email: 'a@example.com',
          intent: 'serious',
          selfieVerified: true,
          selfieUri: 'file:///selfie.jpg',
          cnicPhotoUri: 'file:///cnic.jpg',
        })
      )
    );
  });

  it('shows an error message when signup fails', async () => {
    signup.mockRejectedValue(new Error('signup failed'));
    renderScreen();
    await captureSelfie();
    await uploadCnicPhoto();

    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => expect(screen.getByText('signup failed')).toBeTruthy());
  });
});
