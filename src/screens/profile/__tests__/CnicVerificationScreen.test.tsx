import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { CnicVerificationScreen } from '../CnicVerificationScreen';
import { useAuth } from '../../../store/AuthContext';
import { useDialog } from '../../../store/DialogContext';
import { analyzeIdCardPhoto } from '../../../utils/idCardImageCheck';
import type { UserProfile } from '../../../types/user';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../../../utils/idCardImageCheck', () => ({ analyzeIdCardPhoto: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
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
  return render(withProviders(<CnicVerificationScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  updateUser = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: user(), updateUser });
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ notify });
});

describe('CnicVerificationScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('shows the not-verified notice for an unverified member', () => {
    renderScreen();
    expect(screen.getByText("Your ID photo is collected during account creation, so this isn't available here.")).toBeTruthy();
  });

  it('shows the masked CNIC and reveals it on tap', () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    renderScreen();

    expect(screen.getByText('•••••-•••••••-2')).toBeTruthy();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'eye-outline' }));
    expect(screen.getByText('12345-1234567-2')).toBeTruthy();
  });

  it('enters edit mode and validates an invalid CNIC format', () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.changeText(screen.getByPlaceholderText('12345-1234567-1'), '123');
    fireEvent.press(screen.getByText('Save changes'));

    expect(screen.getByText('Enter a valid 13-digit CNIC number (12345-1234567-1).')).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('rejects a CNIC number whose gender digit does not match', () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.changeText(screen.getByPlaceholderText('12345-1234567-1'), '1234512345671');
    fireEvent.press(screen.getByText('Save changes'));

    expect(
      screen.getByText("This CNIC number doesn't match the gender you selected — security check failed.")
    ).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('saves a valid CNIC update and shows a success notice', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.changeText(screen.getByPlaceholderText('12345-1234567-1'), '1234512345674');
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ cnicNumber: '12345-1234567-4' }))
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'CNIC / ID document' }))
    );
  });

  it('shows a permission notice when photo library access is denied', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.press(screen.getByText('Upload ID photo'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Permission needed' })));
  });

  it('shows an error when the picked photo does not look like an ID card', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'photo.jpg' }] });
    (analyzeIdCardPhoto as jest.Mock).mockResolvedValue({ looksValid: false, reason: 'wrongShape' });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.press(screen.getByText('Upload ID photo'));

    await waitFor(() =>
      expect(
        screen.getByText("That doesn't look like an ID card photo — make sure the whole card fills the frame.")
      ).toBeTruthy()
    );
  });

  it('accepts a valid ID card photo', async () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'photo.jpg' }] });
    (analyzeIdCardPhoto as jest.Mock).mockResolvedValue({ looksValid: true });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.press(screen.getByText('Upload ID photo'));

    await waitFor(() => expect(screen.getByText('Retake')).toBeTruthy());
  });

  it('cancels edit mode without saving', () => {
    mockUseAuth.mockReturnValue({
      user: user({ cnicVerified: true, cnicNumber: '12345-1234567-2' }),
      updateUser,
    });
    renderScreen();

    fireEvent.press(screen.getByText('Update CNIC'));
    fireEvent.press(screen.getByText('Cancel'));

    expect(screen.getByText('Update CNIC')).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
