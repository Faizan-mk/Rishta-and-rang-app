import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { FadeIn } from '../FadeInUp';

describe('FadeIn', () => {
  it('renders its children', () => {
    renderWithProviders(
      <FadeIn>
        <Text>Welcome</Text>
      </FadeIn>
    );
    expect(screen.getByText('Welcome')).toBeTruthy();
  });

  it('renders with a delay and the "down" direction without throwing', () => {
    expect(() =>
      renderWithProviders(
        <FadeIn delay={200} from="down">
          <Text>Welcome</Text>
        </FadeIn>
      )
    ).not.toThrow();
  });
});
