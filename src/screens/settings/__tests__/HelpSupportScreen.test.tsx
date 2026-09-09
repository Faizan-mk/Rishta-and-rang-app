import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { HelpSupportScreen } from '../HelpSupportScreen';
import { useDialog } from '../../../store/DialogContext';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));

const mockUseDialog = useDialog as jest.Mock;
let notify: jest.Mock;

function renderScreen() {
  return render(withProviders(<HelpSupportScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ notify });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('HelpSupportScreen', () => {
  it('renders the FAQ questions collapsed', () => {
    renderScreen();
    expect(screen.getByText('Why do you need a verification selfie?')).toBeTruthy();
    expect(screen.queryByText(/confirms you're a real person/)).toBeNull();
  });

  it('expands and collapses a FAQ answer', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Why do you need a verification selfie?'));
    expect(screen.getByText(/confirms you're a real person/)).toBeTruthy();

    fireEvent.press(screen.getByText('Why do you need a verification selfie?'));
    expect(screen.queryByText(/confirms you're a real person/)).toBeNull();
  });

  it('opens a mailto link when Email us directly is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Email us directly'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('mailto:'));
  });

  it('shows a validation error when a field is missing', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Send message'));
    expect(screen.getByText('Please fill in both fields.')).toBeTruthy();
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends the message once both fields are filled', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText("What's this about?"), 'Billing question');
    fireEvent.changeText(screen.getByPlaceholderText('Describe the issue or question...'), 'I was charged twice.');
    fireEvent.press(screen.getByText('Send message'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Message sent' })), {
      timeout: 2000,
    });
    expect(screen.queryByDisplayValue('Billing question')).toBeNull();
  });
});
