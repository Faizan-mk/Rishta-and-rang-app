import React from 'react';
import { render } from '@testing-library/react-native';
import { AuroraBackground } from '../AuroraBackground';
import { lightPalette } from '../../../theme/palettes';

describe('AuroraBackground', () => {
  it('renders for dating mode without throwing', () => {
    expect(() => render(<AuroraBackground colors={lightPalette} mode="dating" />)).not.toThrow();
  });

  it('renders for rishta mode without throwing', () => {
    expect(() => render(<AuroraBackground colors={lightPalette} mode="rishta" />)).not.toThrow();
  });

  it('accepts a bleed value without throwing', () => {
    expect(() => render(<AuroraBackground colors={lightPalette} mode="dating" bleed={20} />)).not.toThrow();
  });
});
