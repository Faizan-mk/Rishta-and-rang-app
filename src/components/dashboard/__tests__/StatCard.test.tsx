import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders the value and label', () => {
    renderWithProviders(<StatCard icon="heart" value={12} label="Likes" tint="#FF0000" tintSoft="#FFEEEE" />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Likes')).toBeTruthy();
  });

  it('renders a string value as-is', () => {
    renderWithProviders(<StatCard icon="heart" value="Unlimited" label="Boosts" tint="#FF0000" tintSoft="#FFEEEE" />);
    expect(screen.getByText('Unlimited')).toBeTruthy();
  });

  it('calls onPress when tappable', () => {
    const onPress = jest.fn();
    renderWithProviders(<StatCard icon="heart" value={12} label="Likes" tint="#FF0000" tintSoft="#FFEEEE" onPress={onPress} />);
    fireEvent.press(screen.getByText('Likes'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not throw when tapped with no onPress handler', () => {
    renderWithProviders(<StatCard icon="heart" value={12} label="Likes" tint="#FF0000" tintSoft="#FFEEEE" />);
    expect(() => fireEvent.press(screen.getByText('Likes'))).not.toThrow();
  });
});
