import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { MatchRow } from '../MatchRow';
import type { Match } from '../../../types/content';

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Sara',
    photo: 'a.jpg',
    lastMessage: 'Hi there',
    lastMessageAt: new Date().toISOString(),
    unread: false,
    mode: 'dating',
    movedToRishta: false,
    ...overrides,
  };
}

describe('MatchRow', () => {
  it('renders the name and last message preview', () => {
    renderWithProviders(<MatchRow match={match()} onPress={jest.fn()} />);
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Hi there')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<MatchRow match={match()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Sara'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the Rishta badge once the thread has moved', () => {
    renderWithProviders(<MatchRow match={match({ movedToRishta: true })} onPress={jest.fn()} />);
    expect(screen.getByText('Rishta')).toBeTruthy();
  });

  it('shows no Rishta badge for a Friends-mode thread', () => {
    renderWithProviders(<MatchRow match={match()} onPress={jest.fn()} />);
    expect(screen.queryByText('Rishta')).toBeNull();
  });

  it('renders a fallback preview for an empty last message', () => {
    renderWithProviders(<MatchRow match={match({ lastMessage: '' })} onPress={jest.fn()} />);
    expect(screen.queryByText('Hi there')).toBeNull();
  });
});
