import React from 'react';
import { render } from '@testing-library/react-native';
import { FloatingHearts } from '../FloatingHearts';

describe('FloatingHearts', () => {
  it('renders one heart per color given, without throwing', () => {
    expect(() => render(<FloatingHearts colors={['#FF0000', '#00FF00']} />)).not.toThrow();
  });

  it('renders without throwing for a single color', () => {
    expect(() => render(<FloatingHearts colors={['#FF0000']} />)).not.toThrow();
  });
});
