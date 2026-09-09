import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from './testWrappers';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its label', () => {
    renderWithProviders(<Button label="Continue" onPress={jest.fn()} />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner instead of the label while loading', () => {
    renderWithProviders(<Button label="Continue" onPress={jest.fn()} loading />);
    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders the given icon beside the label', () => {
    renderWithProviders(<Button label="Continue" onPress={jest.fn()} icon={<Text>★</Text>} />);
    expect(screen.getByText('★')).toBeTruthy();
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('renders the %s variant without throwing', (variant) => {
    expect(() => renderWithProviders(<Button label="Continue" onPress={jest.fn()} variant={variant} />)).not.toThrow();
  });

  it('renders with a gradient without throwing', () => {
    expect(() =>
      renderWithProviders(<Button label="Continue" onPress={jest.fn()} gradient={['#111111', '#222222']} />)
    ).not.toThrow();
  });
});
