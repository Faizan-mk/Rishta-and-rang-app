import React from 'react';
import { render } from '@testing-library/react-native';
import { SwingingLogo } from '../SwingingLogo';

describe('SwingingLogo', () => {
  it('renders without throwing with default size', () => {
    expect(() => render(<SwingingLogo color="#FFFFFF" ringColor="#111111" />)).not.toThrow();
  });

  it('renders without throwing with a custom size', () => {
    expect(() => render(<SwingingLogo size={120} color="#FFFFFF" ringColor="#111111" />)).not.toThrow();
  });
});
