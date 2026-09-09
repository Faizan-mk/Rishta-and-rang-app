import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { ProfileUtilityBar } from '../ProfileUtilityBar';

function props(overrides: Partial<Parameters<typeof ProfileUtilityBar>[0]> = {}) {
  return {
    liked: false,
    onShare: jest.fn(),
    onToggleFavourite: jest.fn(),
    onBlock: jest.fn(),
    onReport: jest.fn(),
    ...overrides,
  };
}

describe('ProfileUtilityBar', () => {
  it('shows "Favourite" when not liked and "Favourited" when liked', () => {
    const { rerender } = renderWithProviders(<ProfileUtilityBar {...props()} />);
    expect(screen.getByText('Favourite')).toBeTruthy();

    rerender(withProviders(<ProfileUtilityBar {...props({ liked: true })} />));
    expect(screen.getByText('Favourited')).toBeTruthy();
  });

  it('calls onShare when Share profile is pressed', () => {
    const onShare = jest.fn();
    renderWithProviders(<ProfileUtilityBar {...props({ onShare })} />);
    fireEvent.press(screen.getByText('Share profile'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFavourite when Favourite is pressed', () => {
    const onToggleFavourite = jest.fn();
    renderWithProviders(<ProfileUtilityBar {...props({ onToggleFavourite })} />);
    fireEvent.press(screen.getByText('Favourite'));
    expect(onToggleFavourite).toHaveBeenCalledTimes(1);
  });

  it('calls onBlock when Block is pressed', () => {
    const onBlock = jest.fn();
    renderWithProviders(<ProfileUtilityBar {...props({ onBlock })} />);
    fireEvent.press(screen.getByText('Block'));
    expect(onBlock).toHaveBeenCalledTimes(1);
  });

  it('calls onReport when Report is pressed', () => {
    const onReport = jest.fn();
    renderWithProviders(<ProfileUtilityBar {...props({ onReport })} />);
    fireEvent.press(screen.getByText('Report'));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
