import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { DiscoverProfileCard } from '../DiscoverProfileCard';
import type { BrowseProfile } from '../../../types/content';

function profile(overrides: Partial<BrowseProfile> = {}): BrowseProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 27,
    gender: 'female',
    city: 'Lahore',
    photos: ['a.jpg', 'b.jpg'],
    ...overrides,
  };
}

describe('DiscoverProfileCard', () => {
  it('renders the name and city', () => {
    renderWithProviders(<DiscoverProfileCard profile={profile()} liked={false} mode="dating" />);
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Lahore')).toBeTruthy();
  });

  it('shows the distance when available', () => {
    renderWithProviders(<DiscoverProfileCard profile={profile({ distanceKm: 4.6 })} liked={false} mode="dating" />);
    expect(screen.getByText(/5 KM AWAY · Lahore/)).toBeTruthy();
  });

  it('shows fact chips for intent, practising, sect and occupation', () => {
    renderWithProviders(
      <DiscoverProfileCard
        profile={profile({ intent: 'serious', practising: true, sect: 'Sunni', occupation: 'Doctor' })}
        liked={false}
        mode="rishta"
      />
    );
    expect(screen.getByText('Sunni')).toBeTruthy();
    expect(screen.getByText('Doctor')).toBeTruthy();
  });

  it('shows the liked badge and hidden-photos blur when the member liked and photos are blurred', () => {
    renderWithProviders(
      <DiscoverProfileCard profile={profile({ photosBlurred: true })} liked={false} mode="dating" />
    );
    expect(screen.getByText('Photos hidden until you match')).toBeTruthy();
  });

  it('does not blur photos once the member has liked', () => {
    renderWithProviders(<DiscoverProfileCard profile={profile({ photosBlurred: true })} liked mode="dating" />);
    expect(screen.queryByText('Photos hidden until you match')).toBeNull();
  });

  it('calls onPressPhoto with the active photo when the centre is tapped', () => {
    const onPressPhoto = jest.fn();
    renderWithProviders(<DiscoverProfileCard profile={profile()} liked={false} mode="dating" onPressPhoto={onPressPhoto} />);
    // The three tap zones (side, centre, side) are the only bare Pressables in
    // the tree — the centre one opens the full-screen preview.
    const isPressable = (c: any) => c.type?.displayName === 'Pressable' || c.type?.name === 'Pressable';
    const zones = screen.root.findAll(isPressable);
    fireEvent.press(zones[1]);
    expect(onPressPhoto).toHaveBeenCalledWith('a.jpg');
  });
});
