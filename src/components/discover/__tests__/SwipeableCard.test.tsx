import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { SwipeableCard } from '../SwipeableCard';

// The pan gesture itself is driven by react-native-reanimated shared values,
// which aren't inspectable from plain JS in Jest (see ImageCropper/
// TabBarVisibilityContext for the same limit) — so this stays a behavioural
// smoke test: it renders its children and swipe-hint stamps without throwing,
// and doesn't blow up when the profile changes.
describe('SwipeableCard', () => {
  it('renders its children', () => {
    renderWithProviders(
      <SwipeableCard profileId="p1" onSwipeRight={jest.fn()} onSwipeLeft={jest.fn()}>
        <Text>Profile content</Text>
      </SwipeableCard>
    );
    expect(screen.getByText('Profile content')).toBeTruthy();
  });

  it('renders the like and pass swipe hints', () => {
    renderWithProviders(
      <SwipeableCard profileId="p1" onSwipeRight={jest.fn()} onSwipeLeft={jest.fn()}>
        <Text>Profile content</Text>
      </SwipeableCard>
    );
    expect(screen.getByText('Like')).toBeTruthy();
    expect(screen.getByText('Pass')).toBeTruthy();
  });

  it('does not throw when the profile id changes', () => {
    const { rerender } = renderWithProviders(
      <SwipeableCard profileId="p1" onSwipeRight={jest.fn()} onSwipeLeft={jest.fn()}>
        <Text>First</Text>
      </SwipeableCard>
    );
    expect(() =>
      rerender(
        withProviders(
          <SwipeableCard profileId="p2" onSwipeRight={jest.fn()} onSwipeLeft={jest.fn()}>
            <Text>Second</Text>
          </SwipeableCard>
        )
      )
    ).not.toThrow();
    expect(screen.getByText('Second')).toBeTruthy();
  });
});
