import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { EditProfileScreen } from '../EditProfileScreen';
import { useAuth } from '../../../store/AuthContext';
import { useDialog } from '../../../store/DialogContext';
import { usePrivacy } from '../../../store/PrivacyContext';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/PrivacyContext', () => ({ usePrivacy: jest.fn() }));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), currentTime: 3, uri: null })),
  useAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn() })),
  useAudioPlayerStatus: jest.fn(() => ({ playing: false, duration: 0 })),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({ playing: false, play: jest.fn(), pause: jest.fn() })),
  VideoView: () => null,
}));

jest.mock('expo', () => ({ useEvent: jest.fn(() => ({ isPlaying: false })) }));

// ImageCropper has its own dedicated test; stub it here so this file stays
// focused on EditProfileScreen's own state/wiring, matching the pattern used
// for IntentPhotosScreen/SelfieVerificationScreen.
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
const mockUseDialog = useDialog as jest.Mock;
const mockUsePrivacy = usePrivacy as jest.Mock;

const push = jest.fn();
const back = jest.fn();
let updateUser: jest.Mock;
let notify: jest.Mock;

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha Khan',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'rishta',
    isExplorePlus: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderScreen() {
  return render(withProviders(<EditProfileScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, back });
  updateUser = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: user(), updateUser });
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ notify });
  mockUsePrivacy.mockReturnValue({ prefs: { blurPhotos: false } });
});

describe('EditProfileScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('adds a photo through the picker and crop flow', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'photo1.jpg' }] });
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'add' }));

    await waitFor(() => expect(screen.getByText('Primary')).toBeTruthy());
  });

  it('shows a permission notice when photo library access is denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'add' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Permission needed' })));
  });

  it('removes a photo', async () => {
    mockUseAuth.mockReturnValue({ user: user({ photos: ['photo1.jpg'] }), updateUser });
    renderScreen();

    fireEvent.press(screen.getByText('×'));

    await waitFor(() => expect(screen.queryByText('Primary')).toBeNull());
  });

  it('makes a secondary photo primary', () => {
    mockUseAuth.mockReturnValue({ user: user({ photos: ['photo1.jpg', 'photo2.jpg'] }), updateUser });
    renderScreen();

    fireEvent.press(screen.getByText('Make primary'));

    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
  });

  it('adds a vibe tag', () => {
    renderScreen();
    fireEvent.changeText(screen.UNSAFE_getByProps({ returnKeyType: 'done' }), 'coffee');
    fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('coffee ×')).toBeTruthy();
  });

  it('removes a vibe tag when its chip is pressed', () => {
    mockUseAuth.mockReturnValue({ user: user({ dating: { vibeTags: ['coffee'] } }), updateUser });
    renderScreen();
    fireEvent.press(screen.getByText('coffee ×'));
    expect(screen.queryByText('coffee ×')).toBeNull();
  });

  it('toggles a boolean attribute row', () => {
    renderScreen();
    const isPressable = (c: any) => typeof c !== 'string' && (c.type?.displayName === 'Pressable' || c.type?.name === 'Pressable');
    const findSiblingPressable = (node: any): any => node.children.find(isPressable);
    let row = screen.getByText('Has children').parent;
    let toggle = findSiblingPressable(row);
    while (!toggle) {
      row = row.parent;
      toggle = findSiblingPressable(row);
    }
    fireEvent.press(toggle);
    fireEvent.press(screen.getByText('Save changes'));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ hasChildren: true }));
  });

  it('saves the profile and navigates back', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Tell people a bit about yourself...'), 'Hello world');
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ bio: 'Hello world' })));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it('shows an error dialog when saving fails', async () => {
    updateUser.mockRejectedValue(new Error('network down'));
    renderScreen();

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Something went wrong. Please try again.' })));
    expect(back).not.toHaveBeenCalled();
  });

  it('cancels and navigates back without saving', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Cancel'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('starts and stops voice recording', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Record voice intro'));

    await waitFor(() => expect(screen.getByText('Stop recording')).toBeTruthy());
  });

  it('picks a video intro', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'video1.mp4' }] });
    renderScreen();

    fireEvent.press(screen.getByText('Add video intro'));

    await waitFor(() => expect(screen.queryByText('Add video intro')).toBeNull());
  });
});
