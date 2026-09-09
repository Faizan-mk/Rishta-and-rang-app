import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from './testWrappers';
import { Header } from '../Header';

describe('Header', () => {
  it('renders the title', () => {
    renderWithProviders(<Header title="Settings" />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders an optional subtitle', () => {
    renderWithProviders(<Header title="Settings" subtitle="Manage your account" />);
    expect(screen.getByText('Manage your account')).toBeTruthy();
  });

  it('renders no back button when onBack is not given', () => {
    renderWithProviders(<Header title="Settings" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onBack when the back button is pressed', () => {
    const onBack = jest.fn();
    renderWithProviders(<Header title="Settings" onBack={onBack} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders trailing content passed via `right`', () => {
    renderWithProviders(<Header title="Settings" right={<Text>Edit</Text>} />);
    expect(screen.getByText('Edit')).toBeTruthy();
  });
});
