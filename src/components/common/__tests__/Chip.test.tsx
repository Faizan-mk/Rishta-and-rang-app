import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { Chip } from '../Chip';

describe('Chip', () => {
  it('renders its label', () => {
    renderWithProviders(<Chip label="Coffee" />);
    expect(screen.getByText('Coffee')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<Chip label="Coffee" onPress={onPress} />);
    fireEvent.press(screen.getByText('Coffee'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not throw when pressed with no onPress handler', () => {
    renderWithProviders(<Chip label="Coffee" />);
    expect(() => fireEvent.press(screen.getByText('Coffee'))).not.toThrow();
  });

  it('renders in both selected and unselected states without throwing', () => {
    const { rerender } = renderWithProviders(<Chip label="Coffee" selected={false} />);
    expect(() => rerender(withProviders(<Chip label="Coffee" selected />))).not.toThrow();
    expect(screen.getByText('Coffee')).toBeTruthy();
  });
});
