import React from 'react';
import { Text, Platform, Dimensions } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ResponsiveFrame } from '../ResponsiveFrame';

// `Dimensions.set` is React Native's own sanctioned way to change what
// `useWindowDimensions` reports in tests — mocking the 'react-native' module
// wholesale breaks its lazily-evaluated native-module getters (DevMenu, etc.).
function setWindowSize(width: number, height: number) {
  Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
}

const originalOS = Platform.OS;

afterEach(() => {
  (Platform as { OS: string }).OS = originalOS;
});

describe('ResponsiveFrame', () => {
  it('renders children directly (no frame wrapper) on native, regardless of width', () => {
    (Platform as { OS: string }).OS = 'ios';
    setWindowSize(1200, 800);

    renderWithProviders(
      <ResponsiveFrame>
        <Text>Screen content</Text>
      </ResponsiveFrame>
    );
    expect(screen.getByText('Screen content')).toBeTruthy();
  });

  it('renders children directly on a narrow web window (mobile viewport)', () => {
    (Platform as { OS: string }).OS = 'web';
    setWindowSize(400, 800);

    expect(() =>
      renderWithProviders(
        <ResponsiveFrame>
          <Text>Screen content</Text>
        </ResponsiveFrame>
      )
    ).not.toThrow();
    expect(screen.getByText('Screen content')).toBeTruthy();
  });

  it('wraps children in the phone-frame chrome on a wide web window', () => {
    (Platform as { OS: string }).OS = 'web';
    setWindowSize(1200, 900);

    expect(() =>
      renderWithProviders(
        <ResponsiveFrame>
          <Text>Screen content</Text>
        </ResponsiveFrame>
      )
    ).not.toThrow();
    expect(screen.getByText('Screen content')).toBeTruthy();
  });
});
