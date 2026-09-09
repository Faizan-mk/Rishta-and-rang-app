import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { LegalScreen } from '../LegalScreen';
import { useDialog } from '../../../store/DialogContext';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));

const mockUseDialog = useDialog as jest.Mock;
let notify: jest.Mock;

function renderScreen() {
  return render(withProviders(<LegalScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ notify });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
});

describe('LegalScreen', () => {
  it('renders the privacy policy and terms sections', () => {
    renderScreen();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText('Terms of service')).toBeTruthy();
    expect(screen.getByText('1. Who we are')).toBeTruthy();
    expect(screen.getByText('1. You must be 18')).toBeTruthy();
  });

  it('shows a link-unavailable notice when no hosted privacy URL is configured', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Open the privacy policy in your browser'));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Privacy policy & terms', message: 'That link is not available yet.' })
      )
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('shows a link-unavailable notice when no hosted terms URL is configured', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Open the terms of service in your browser'));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'That link is not available yet.' }))
    );
  });

  it('opens a mailto link for the contact line', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Questions about either document? Email support@rishtaandrang.app.'));
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:support@rishtaandrang.app');
  });
});
