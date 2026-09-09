import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { PasswordRequirements } from '../PasswordRequirements';

// Mirrors the exact five checks isStrongPassword makes (src/utils/validation.ts)
// — this component exists so the rule the member is held to is visible.

describe('PasswordRequirements', () => {
  it('shows every check unmet for an empty password', () => {
    renderWithProviders(<PasswordRequirements password="" />);
    expect(screen.getAllByText(/^○/)).toHaveLength(5);
    expect(screen.queryByText(/^✓/)).toBeNull();
  });

  it('shows every check met for a fully compliant password', () => {
    renderWithProviders(<PasswordRequirements password="Abcdef1!" />);
    expect(screen.getAllByText(/^✓/)).toHaveLength(5);
  });

  it('marks only length as met for a long password missing everything else', () => {
    renderWithProviders(<PasswordRequirements password="aaaaaaaa" />);
    // length + lowercase both pass for an all-lowercase 8-char string.
    expect(screen.getAllByText(/^✓/)).toHaveLength(2);
  });

  it('marks the number check independently of the others', () => {
    const without = renderWithProviders(<PasswordRequirements password="abc" />);
    const before = without.queryAllByText(/^✓/).length;
    without.unmount();

    const withDigit = renderWithProviders(<PasswordRequirements password="abc1" />);
    const after = withDigit.getAllByText(/^✓/).length;
    expect(after).toBeGreaterThan(before);
  });
});
