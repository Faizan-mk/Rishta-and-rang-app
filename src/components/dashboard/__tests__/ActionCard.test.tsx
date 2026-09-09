import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ActionCard } from '../ActionCard';

describe('ActionCard', () => {
  it('renders its title', () => {
    renderWithProviders(<ActionCard icon="heart" title="Boost" tint="#FF0000" tintSoft="#FFEEEE" onPress={jest.fn()} />);
    expect(screen.getByText('Boost')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<ActionCard icon="heart" title="Boost" tint="#FF0000" tintSoft="#FFEEEE" onPress={onPress} />);
    fireEvent.press(screen.getByText('Boost'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
