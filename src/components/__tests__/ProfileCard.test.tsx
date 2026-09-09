import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from './testWrappers';
import { ProfileCard } from '../ProfileCard';

describe('ProfileCard', () => {
  it('renders the name and city', () => {
    renderWithProviders(
      <ProfileCard photo="a.jpg" name="Sara" age={26} city="Lahore" kind="dating" onPress={jest.fn()} />
    );
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Lahore')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(
      <ProfileCard photo="a.jpg" name="Sara" age={26} city="Lahore" kind="dating" onPress={onPress} />
    );
    fireEvent.press(screen.getByText('Sara'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the Friends badge for dating-mode cards', () => {
    renderWithProviders(
      <ProfileCard photo="a.jpg" name="Sara" age={26} city="Lahore" kind="dating" onPress={jest.fn()} />
    );
    expect(screen.getByText('Friends')).toBeTruthy();
  });

  it('shows the Rishta badge for rishta-mode cards', () => {
    renderWithProviders(
      <ProfileCard photo="a.jpg" name="Sara" age={26} city="Lahore" kind="rishta" onPress={jest.fn()} />
    );
    expect(screen.getByText('Rishta')).toBeTruthy();
  });

  it('renders the trailing action slot', () => {
    renderWithProviders(
      <ProfileCard
        photo="a.jpg"
        name="Sara"
        age={26}
        city="Lahore"
        kind="dating"
        onPress={jest.fn()}
        action={<Text>Remove</Text>}
      />
    );
    expect(screen.getByText('Remove')).toBeTruthy();
  });
});
