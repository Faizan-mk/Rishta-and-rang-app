import React from 'react';
import { fireEvent, screen, act, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { CallScreen } from '../CallScreen';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(),
  CameraView: () => null,
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseCameraPermissions = useCameraPermissions as jest.Mock;
const back = jest.fn();
const requestPermission = jest.fn();

function renderScreen() {
  return render(withProviders(<CallScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUseRouter.mockReturnValue({ back });
  mockUseLocalSearchParams.mockReturnValue({ name: 'Sara', photo: 'a.jpg' });
  mockUseCameraPermissions.mockReturnValue([{ granted: false }, requestPermission]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CallScreen (voice)', () => {
  it('starts in the ringing state', () => {
    renderScreen();
    expect(screen.getByText('Ringing...')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('connects after the ringing delay and starts counting seconds', () => {
    renderScreen();
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.getByText('Call in progress')).toBeTruthy();
    expect(screen.getByText('00:00')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:03')).toBeTruthy();
  });

  it('ends the call and goes back', () => {
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'call' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('toggles mute', () => {
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'mic-outline' }));
    expect(screen.UNSAFE_getByProps({ name: 'mic-off' })).toBeTruthy();
  });

  it('does not request camera permission for a voice-only call', () => {
    renderScreen();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('CallScreen (video)', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ name: 'Sara', photo: 'a.jpg', video: '1' });
  });

  it('requests camera permission on mount', () => {
    renderScreen();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('shows the permission prompt when camera access is not granted', () => {
    renderScreen();
    expect(screen.getByText('Camera access is needed for video calls.')).toBeTruthy();
    expect(screen.getByText('Grant access')).toBeTruthy();
  });

  it('shows the camera view once permission is granted', () => {
    mockUseCameraPermissions.mockReturnValue([{ granted: true }, requestPermission]);
    renderScreen();
    expect(screen.queryByText('Camera access is needed for video calls.')).toBeNull();
  });

  it('flips the camera facing direction', () => {
    mockUseCameraPermissions.mockReturnValue([{ granted: true }, requestPermission]);
    renderScreen();
    expect(() => fireEvent.press(screen.UNSAFE_getByProps({ name: 'camera-reverse-outline' }))).not.toThrow();
  });
});
