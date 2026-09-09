import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ProfileActionsFooter } from '../ProfileActionsFooter';

describe('ProfileActionsFooter', () => {
  it('renders the salaam heading with the name', () => {
    renderWithProviders(<ProfileActionsFooter name="Sara" onSendCompliment={jest.fn()} />);
    expect(screen.getByText('Start with a salaam to Sara.')).toBeTruthy();
  });

  it('shows the character count as text is typed', () => {
    renderWithProviders(<ProfileActionsFooter name="Sara" onSendCompliment={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText('Write a short, respectful note'), 'Hello');
    expect(screen.getByText('5/200')).toBeTruthy();
  });

  it('does not send an empty or whitespace-only compliment', () => {
    const onSendCompliment = jest.fn();
    renderWithProviders(<ProfileActionsFooter name="Sara" onSendCompliment={onSendCompliment} />);
    fireEvent.changeText(screen.getByPlaceholderText('Write a short, respectful note'), '   ');
    fireEvent.press(screen.getByText('Send salaam'));
    expect(onSendCompliment).not.toHaveBeenCalled();
  });

  it('sends the trimmed compliment and clears the input', async () => {
    const onSendCompliment = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(<ProfileActionsFooter name="Sara" onSendCompliment={onSendCompliment} />);
    fireEvent.changeText(screen.getByPlaceholderText('Write a short, respectful note'), '  Salaam, you seem lovely  ');
    fireEvent.press(screen.getByText('Send salaam'));

    await waitFor(() => expect(onSendCompliment).toHaveBeenCalledWith('Salaam, you seem lovely'));
    await waitFor(() => expect(screen.getByText('0/200')).toBeTruthy());
  });
});
