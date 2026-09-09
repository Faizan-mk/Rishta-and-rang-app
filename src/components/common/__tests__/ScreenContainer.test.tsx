import React from 'react';
import { Text, ScrollView } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ScreenContainer } from '../ScreenContainer';

describe('ScreenContainer', () => {
  it('renders its children', () => {
    renderWithProviders(
      <ScreenContainer>
        <Text>Hello</Text>
      </ScreenContainer>
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('wraps children in a ScrollView by default', () => {
    renderWithProviders(
      <ScreenContainer>
        <Text>Hello</Text>
      </ScreenContainer>
    );
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('renders a plain View instead of a ScrollView when scroll is disabled', () => {
    renderWithProviders(
      <ScreenContainer scroll={false}>
        <Text>Hello</Text>
      </ScreenContainer>
    );
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });

  it('forwards onScroll to the underlying ScrollView', () => {
    const onScroll = jest.fn();
    renderWithProviders(
      <ScreenContainer onScroll={onScroll}>
        <Text>Hello</Text>
      </ScreenContainer>
    );
    fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), {
      nativeEvent: { contentOffset: { y: 50 }, contentSize: { height: 500 }, layoutMeasurement: { height: 100 } },
    });
    expect(onScroll).toHaveBeenCalled();
  });
});
