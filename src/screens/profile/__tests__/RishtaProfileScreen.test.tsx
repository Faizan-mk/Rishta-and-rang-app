import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { RishtaProfileScreen } from '../RishtaProfileScreen';
import { useAuth } from '../../../store/AuthContext';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const back = jest.fn();
let updateUser: jest.Mock;

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
  return render(withProviders(<RishtaProfileScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  updateUser = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: user(), updateUser });
});

describe('RishtaProfileScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('shows the existing rishta details', () => {
    renderScreen();
    expect(screen.getByText('Islam')).toBeTruthy();
    expect(screen.getByText('Sunni')).toBeTruthy();
  });

  it('changes the readiness chip', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Ready now'));
    fireEvent.press(screen.getByText('Save changes'));
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ rishta: expect.objectContaining({ readiness: 'ready_now' }) })
    );
  });

  it('changes the religion through the select field', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Islam'));
    fireEvent.press(screen.getByText('Christianity'));
    fireEvent.press(screen.getByText('Save changes'));
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ rishta: expect.objectContaining({ religion: 'Christianity' }) })
    );
  });

  it('updates the family background text field', () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Small family, settled in Lahore'), 'A close-knit family');
    fireEvent.press(screen.getByText('Save changes'));
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ rishta: expect.objectContaining({ familyBackground: 'A close-knit family' }) })
    );
  });

  it('saves and navigates back', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it('cancels without saving', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Cancel'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows the locked v2 attribute badges', () => {
    renderScreen();
    expect(screen.getByText('Prayer habits')).toBeTruthy();
    expect(screen.getByText('Income range')).toBeTruthy();
  });
});
