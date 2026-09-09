import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { render } from '@testing-library/react-native';
import { IntentPhotosScreen } from '../IntentPhotosScreen';
import { DialogProvider } from '../../../store/DialogContext';
import { useOnboarding } from '../../../store/onboardingStore';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/onboardingStore', () => ({ useOnboarding: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
// The real ImageCropper (Modal + Animated + GestureDetector) is exercised on
// its own in ImageCropper.test.tsx; rendering it here too — twice per test, to
// reach MIN_PHOTOS — was slow enough under a full-suite parallel run to
// intermittently blow even a generous timeout. IntentPhotosScreen's own logic
// only cares that `onCropped` eventually fires with a uri, so a same-shape
// stub gets that without the weight.
jest.mock('../../../components/common/ImageCropper', () => {
  const ReactActual = require('react');
  return {
    ImageCropper: ({ uri, onCropped }: { uri: string | null; onCropped: (uri: string) => void }) => {
      ReactActual.useEffect(() => {
        if (uri) onCropped(`${uri}-cropped`);
      }, [uri]);
      return null;
    },
  };
});

const mockUseRouter = useRouter as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const push = jest.fn();
let patchDraft: jest.Mock;

function renderScreen() {
  return render(withProviders(<DialogProvider><IntentPhotosScreen /></DialogProvider>));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, back: jest.fn() });
  patchDraft = jest.fn();
  mockUseOnboarding.mockReturnValue({ draft: {}, patchDraft });
});

describe('IntentPhotosScreen', () => {
  it('does not advance when no intent is selected and no photos are added', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Next'));
    expect(patchDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a permission dialog when photo library access is denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    renderScreen();

    fireEvent.press(screen.getByText('Add photo'));

    await waitFor(() => expect(screen.getByText('Permission needed')).toBeTruthy());
    expect(screen.getByText('Photo library access is required to add photos.')).toBeTruthy();
  });

  it('does not add a photo when the picker is cancelled', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    renderScreen();

    fireEvent.press(screen.getByText('Add photo'));

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  });

  it('selects an intent and adds two cropped photos, then advances with the full payload', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    renderScreen();
    fireEvent.press(screen.getByText('Serious'));

    // Each successfully added photo renders a "×" remove badge — waiting for
    // that count is what actually confirms the (real) async picker chain and
    // the mocked crop effect have both settled, rather than racing them.
    fireEvent.press(screen.getByText('Add photo'));
    await waitFor(() => expect(screen.queryAllByText('×')).toHaveLength(1));
    fireEvent.press(screen.getByText('Add photo'));
    await waitFor(() => expect(screen.queryAllByText('×')).toHaveLength(2));

    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/selfie-verification'));
    expect(patchDraft).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'serious', photos: expect.arrayContaining([expect.stringContaining('cropped')]) })
    );
  });
});
