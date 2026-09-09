import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { MatchCelebration } from '../MatchCelebration';

describe('MatchCelebration', () => {
  it('renders nothing visible when not visible', () => {
    renderWithProviders(<MatchCelebration visible={false} name="Sara" photo="a.jpg" onClose={jest.fn()} />);
    expect(screen.queryByText("It's a Match!")).toBeNull();
  });

  it('shows the match copy with the name when visible', () => {
    renderWithProviders(<MatchCelebration visible name="Sara" photo="a.jpg" onClose={jest.fn()} />);
    expect(screen.getByText("It's a Match!")).toBeTruthy();
    expect(screen.getByText('You and Sara liked each other.')).toBeTruthy();
  });

  it('calls onClose when Continue is pressed', () => {
    const onClose = jest.fn();
    renderWithProviders(<MatchCelebration visible name="Sara" photo="a.jpg" onClose={onClose} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
