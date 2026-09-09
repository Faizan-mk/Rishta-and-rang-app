import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<IconButton icon="heart" onPress={onPress} />);
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'heart' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows no badge when none is given', () => {
    renderWithProviders(<IconButton icon="heart" onPress={jest.fn()} />);
    expect(screen.queryByText('1')).toBeNull();
  });

  it('shows the badge count when positive', () => {
    renderWithProviders(<IconButton icon="heart" onPress={jest.fn()} badge={4} />);
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('hides the badge when it is zero', () => {
    renderWithProviders(<IconButton icon="heart" onPress={jest.fn()} badge={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('caps the displayed badge at "9+"', () => {
    renderWithProviders(<IconButton icon="heart" onPress={jest.fn()} badge={42} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });
});
