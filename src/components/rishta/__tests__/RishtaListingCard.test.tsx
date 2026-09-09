import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { RishtaListingCard } from '../RishtaListingCard';
import type { RishtaListingProfile } from '../../../types/content';

function profile(overrides: Partial<RishtaListingProfile> = {}): RishtaListingProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 27,
    gender: 'female',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'BSc Computer Science',
    familyBackground: 'Small, close-knit family.',
    readiness: 'browsing',
    photos: ['a.jpg'],
    ...overrides,
  };
}

describe('RishtaListingCard', () => {
  it('renders the name, city/sect meta line and family background', () => {
    renderWithProviders(<RishtaListingCard profile={profile()} onPress={jest.fn()} />);
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Lahore · Sunni')).toBeTruthy();
    expect(screen.getByText('Small, close-knit family.')).toBeTruthy();
  });

  it('calls onPress when the card is pressed', () => {
    const onPress = jest.fn();
    renderWithProviders(<RishtaListingCard profile={profile()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Sara'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a photo count badge for more than one photo', () => {
    renderWithProviders(<RishtaListingCard profile={profile({ photos: ['a.jpg', 'b.jpg', 'c.jpg'] })} onPress={jest.fn()} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows the "Ready now" badge beside the name for a ready-now member', () => {
    renderWithProviders(<RishtaListingCard profile={profile({ readiness: 'ready_now' })} onPress={jest.fn()} />);
    expect(screen.getByText('Ready now')).toBeTruthy();
  });

  it('shows the readiness badge below the meta line for a browsing member', () => {
    renderWithProviders(<RishtaListingCard profile={profile({ readiness: 'browsing' })} onPress={jest.fn()} />);
    expect(screen.getByText('Just browsing')).toBeTruthy();
  });

  it('hides the like button when onToggleLike is not provided', () => {
    renderWithProviders(<RishtaListingCard profile={profile()} onPress={jest.fn()} />);
    expect(screen.UNSAFE_queryAllByProps({ name: 'heart-outline' })).toHaveLength(0);
    expect(screen.UNSAFE_queryAllByProps({ name: 'heart' })).toHaveLength(0);
  });

  it('toggles the like state when the heart is pressed', () => {
    const onToggleLike = jest.fn();
    renderWithProviders(<RishtaListingCard profile={profile()} onPress={jest.fn()} onToggleLike={onToggleLike} liked={false} />);
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'heart-outline' }));
    expect(onToggleLike).toHaveBeenCalledTimes(1);
  });

  it('shows a filled heart once liked', () => {
    renderWithProviders(<RishtaListingCard profile={profile()} onPress={jest.fn()} onToggleLike={jest.fn()} liked />);
    expect(screen.UNSAFE_getByProps({ name: 'heart' })).toBeTruthy();
  });
});
