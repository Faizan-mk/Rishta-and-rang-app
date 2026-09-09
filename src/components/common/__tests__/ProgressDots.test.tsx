import React from 'react';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ProgressDots } from '../ProgressDots';

// Purely presentational (no accessible text), so these tests pin the one
// thing worth pinning: it renders cleanly across the range of step counts and
// positions a signup/onboarding flow will actually pass it.
describe('ProgressDots', () => {
  it('renders the current, done and upcoming steps without throwing', () => {
    expect(() => renderWithProviders(<ProgressDots total={4} current={0} />)).not.toThrow();
    expect(() => renderWithProviders(<ProgressDots total={4} current={2} />)).not.toThrow();
    expect(() => renderWithProviders(<ProgressDots total={4} current={3} />)).not.toThrow();
  });

  it('renders a single step without throwing', () => {
    expect(() => renderWithProviders(<ProgressDots total={1} current={0} />)).not.toThrow();
  });

  it('renders zero steps without throwing', () => {
    expect(() => renderWithProviders(<ProgressDots total={0} current={0} />)).not.toThrow();
  });
});
