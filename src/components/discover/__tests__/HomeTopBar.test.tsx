import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { HomeTopBar } from '../HomeTopBar';

function props(overrides: Partial<Parameters<typeof HomeTopBar>[0]> = {}) {
  return {
    activeFilterCount: 0,
    onOpenFilters: jest.fn(),
    onOpenSort: jest.fn(),
    onBoost: jest.fn(),
    boostActive: false,
    notificationCount: 0,
    onNotifications: jest.fn(),
    mode: 'dating' as const,
    ...overrides,
  };
}

describe('HomeTopBar', () => {
  it('renders the Filters, Sort and Boost chips', () => {
    renderWithProviders(<HomeTopBar {...props()} />);
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByText('Sort')).toBeTruthy();
    expect(screen.getByText('Boost')).toBeTruthy();
  });

  it('hides the active-filter count pill when there are no active filters', () => {
    renderWithProviders(<HomeTopBar {...props()} />);
    expect(screen.queryByText('3')).toBeNull();
  });

  it('shows the active-filter count pill', () => {
    renderWithProviders(<HomeTopBar {...props({ activeFilterCount: 3 })} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('calls onOpenFilters when Filters is pressed', () => {
    const onOpenFilters = jest.fn();
    renderWithProviders(<HomeTopBar {...props({ onOpenFilters })} />);
    fireEvent.press(screen.getByText('Filters'));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenSort when Sort is pressed', () => {
    const onOpenSort = jest.fn();
    renderWithProviders(<HomeTopBar {...props({ onOpenSort })} />);
    fireEvent.press(screen.getByText('Sort'));
    expect(onOpenSort).toHaveBeenCalledTimes(1);
  });

  it('calls onBoost when the Boost chip is pressed, active or not', () => {
    const onBoost = jest.fn();
    const { rerender } = renderWithProviders(<HomeTopBar {...props({ onBoost })} />);
    fireEvent.press(screen.getByText('Boost'));
    expect(onBoost).toHaveBeenCalledTimes(1);

    rerender(withProviders(<HomeTopBar {...props({ onBoost, boostActive: true })} />));
    fireEvent.press(screen.getByText('Boost'));
    expect(onBoost).toHaveBeenCalledTimes(2);
  });

  it('shows the notification count badge, capped at 9+', () => {
    renderWithProviders(<HomeTopBar {...props({ notificationCount: 15 })} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('calls onNotifications when the bell is pressed', () => {
    const onNotifications = jest.fn();
    renderWithProviders(<HomeTopBar {...props({ onNotifications })} />);
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'notifications-outline' }));
    expect(onNotifications).toHaveBeenCalledTimes(1);
  });
});
