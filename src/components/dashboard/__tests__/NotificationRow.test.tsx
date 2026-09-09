import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { NotificationRow } from '../NotificationRow';
import type { NotificationItem } from '../../../types/content';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'match',
    title: 'New match',
    body: 'You matched with Sara',
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

describe('NotificationRow', () => {
  it('renders the title and body', () => {
    renderWithProviders(<NotificationRow item={item()} />);
    expect(screen.getByText('New match')).toBeTruthy();
    expect(screen.getByText('You matched with Sara')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<NotificationRow item={item()} onPress={onPress} />);
    fireEvent.press(screen.getByText('New match'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('picks the right icon per notification type', () => {
    renderWithProviders(<NotificationRow item={item({ type: 'like' })} />);
    expect(screen.UNSAFE_getByProps({ name: 'thumbs-up' })).toBeTruthy();
  });

  it.each(['match', 'like', 'message', 'rishta_request', 'system'] as const)(
    'renders the %s type without throwing',
    (type) => {
      expect(() => renderWithProviders(<NotificationRow item={item({ type })} />)).not.toThrow();
    }
  );
});
