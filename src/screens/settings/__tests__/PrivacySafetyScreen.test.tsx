import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { PrivacySafetyScreen } from '../PrivacySafetyScreen';
import { useAuth } from '../../../store/AuthContext';
import { useDialog } from '../../../store/DialogContext';
import { usePrivacy } from '../../../store/PrivacyContext';
import { useMatches } from '../../../store/MatchesContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/PrivacyContext', () => ({ usePrivacy: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUsePrivacy = usePrivacy as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

const push = jest.fn();
let deleteAccount: jest.Mock;
let confirm: jest.Mock;
let notify: jest.Mock;
let setPref: jest.Mock;

function renderScreen() {
  return render(withProviders(<PrivacySafetyScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  deleteAccount = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ deleteAccount });
  confirm = jest.fn().mockResolvedValue(false);
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ confirm, notify });
  setPref = jest.fn();
  mockUsePrivacy.mockReturnValue({
    prefs: { profileVisible: true, onlineStatusVisible: true, blurPhotos: false },
    setPref,
  });
  mockUseMatches.mockReturnValue({ blockedProfiles: [] });
});

describe('PrivacySafetyScreen', () => {
  it('renders the visibility, safety and account sections', () => {
    renderScreen();
    expect(screen.getByText('Profile visibility')).toBeTruthy();
    expect(screen.getByText('Staying safe')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
  });

  it('shows the blocked users count', () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [{ id: 'p1' }, { id: 'p2' }] });
    renderScreen();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('toggles the blur photos preference', () => {
    renderScreen();
    const switches = screen.UNSAFE_getAllByType(Switch);
    fireEvent(switches[2], 'valueChange', true);
    expect(setPref).toHaveBeenCalledWith('blurPhotos', true);
  });

  it('navigates to blocked users', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Blocked users'));
    expect(push).toHaveBeenCalledWith('/blocked-users');
  });

  it('deletes the account after confirming', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();
    fireEvent.press(screen.getByText('Delete account'));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it('does not delete the account when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();
    fireEvent.press(screen.getByText('Delete account'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('shows a failure notice when deletion fails', async () => {
    confirm.mockResolvedValue(true);
    deleteAccount.mockRejectedValue(new Error('network down'));
    renderScreen();
    fireEvent.press(screen.getByText('Delete account'));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not delete account', message: 'Something went wrong while deleting your account. Please try again.' }))
    );
  });

  it('shows a reauth notice when deletion requires a fresh session', async () => {
    confirm.mockResolvedValue(true);
    deleteAccount.mockRejectedValue(new Error('REAUTH_REQUIRED'));
    renderScreen();
    fireEvent.press(screen.getByText('Delete account'));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'For your security, log out and log back in, then try deleting your account again. Nothing has been deleted yet.',
        })
      )
    );
  });
});
