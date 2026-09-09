import React from 'react';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ProgressBar } from '../ProgressBar';

// The fill width is driven by a reanimated shared value (see the note in
// TabBarVisibilityContext's tests on why that isn't observable under the test
// renderer without extra native-adjacent tooling) — this just pins that the
// component renders cleanly across the range of progress values it is given.
describe('ProgressBar', () => {
  it('renders at 0%, midway and 100% without throwing', () => {
    expect(() => renderWithProviders(<ProgressBar progress={0} />)).not.toThrow();
    expect(() => renderWithProviders(<ProgressBar progress={50} />)).not.toThrow();
    expect(() => renderWithProviders(<ProgressBar progress={100} />)).not.toThrow();
  });

  it('renders with a custom tint color without throwing', () => {
    expect(() => renderWithProviders(<ProgressBar progress={40} color="#FF00FF" />)).not.toThrow();
  });
});
