import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders its label', () => {
    renderWithProviders(<Badge label="Moved to Rishta" />);
    expect(screen.getByText('Moved to Rishta')).toBeTruthy();
  });

  it('renders without an icon when none is given', () => {
    renderWithProviders(<Badge label="Verified" />);
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it.each(['success', 'neutral', 'locked', 'dating', 'rishta', 'danger', 'premium'] as const)(
    'renders the %s tone without throwing',
    (tone) => {
      expect(() => renderWithProviders(<Badge label="Label" tone={tone} />)).not.toThrow();
    }
  );

  it('renders an icon when given one', () => {
    renderWithProviders(<Badge label="Verified" icon="checkmark-circle" />);
    expect(screen.UNSAFE_getByProps({ name: 'checkmark-circle' })).toBeTruthy();
  });
});
