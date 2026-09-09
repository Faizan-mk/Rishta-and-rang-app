import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { AccentHeading } from '../AccentHeading';

const GRADIENT = ['#111111', '#222222'] as const;

describe('AccentHeading', () => {
  it('renders the title and subtitle', () => {
    renderWithProviders(<AccentHeading title="Matches" subtitle="Everyone who liked you back" gradient={GRADIENT} />);
    expect(screen.getByText('Matches')).toBeTruthy();
    expect(screen.getByText('Everyone who liked you back')).toBeTruthy();
  });

  it('renders no subtitle text when none is given', () => {
    renderWithProviders(<AccentHeading title="Matches" gradient={GRADIENT} />);
    expect(screen.queryByText('Everyone who liked you back')).toBeNull();
  });

  it('renders the trailing content passed via `right`', () => {
    renderWithProviders(<AccentHeading title="Matches" gradient={GRADIENT} right={<Text>Filter</Text>} />);
    expect(screen.getByText('Filter')).toBeTruthy();
  });

  it('renders both the "screen" and "section" size variants without throwing', () => {
    expect(() => renderWithProviders(<AccentHeading title="Matches" gradient={GRADIENT} size="screen" />)).not.toThrow();
    expect(() => renderWithProviders(<AccentHeading title="Matches" gradient={GRADIENT} size="section" />)).not.toThrow();
  });
});
