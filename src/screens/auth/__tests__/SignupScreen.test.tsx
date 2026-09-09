import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { renderWithProviders } from '../../../components/__tests__/testWrappers';
import { SignupScreen } from '../SignupScreen';
import { useOnboarding } from '../../../store/onboardingStore';
import { authService } from '../../../services/authService';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../store/onboardingStore', () => ({ useOnboarding: jest.fn() }));
jest.mock('../../../services/authService', () => ({ authService: { inspectEmail: jest.fn() } }));

const mockUseRouter = useRouter as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const push = jest.fn();
const back = jest.fn();
let startDraft: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, back });
  startDraft = jest.fn();
  mockUseOnboarding.mockReturnValue({ startDraft });
  (authService.inspectEmail as jest.Mock).mockResolvedValue('free');
});

/** [email, password, confirmPassword, fullName, dob, cnic, bio] in render order. */
function getFields() {
  const [emailInput, passwordInput, confirmInput, fullNameInput, dobInput, cnicInput, bioInput] =
    screen.UNSAFE_getAllByType(TextInput);
  return { emailInput, passwordInput, confirmInput, fullNameInput, dobInput, cnicInput, bioInput };
}

/** Fills every field with a fully valid signup, short of whatever the test overrides after. */
function fillValidForm() {
  const { emailInput, passwordInput, confirmInput, fullNameInput, dobInput, cnicInput, bioInput } = getFields();
  fireEvent.changeText(emailInput, 'a@example.com');
  fireEvent.changeText(passwordInput, 'Password1!');
  fireEvent.changeText(confirmInput, 'Password1!');
  fireEvent.changeText(fullNameInput, 'Ayesha Khan');
  fireEvent.changeText(dobInput, '20051998'); // -> 1998-05-20
  fireEvent.press(screen.getByText('Female'));
  fireEvent.changeText(cnicInput, '123451234567' + '2'); // even last digit -> female
  fireEvent.changeText(bioInput, 'Hello there');
  for (const node of screen.getAllByText('City')) fireEvent.press(node);
  fireEvent.press(screen.getByText('Lahore'));
  fireEvent.press(screen.getByRole('checkbox'));
}

describe('SignupScreen validation', () => {
  it('rejects an invalid email', () => {
    renderWithProviders(<SignupScreen />);
    fireEvent.changeText(getFields().emailInput, 'not-an-email');
    fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });

  it('rejects a weak password', () => {
    renderWithProviders(<SignupScreen />);
    const { emailInput, passwordInput } = getFields();
    fireEvent.changeText(emailInput, 'a@example.com');
    fireEvent.changeText(passwordInput, 'weak');
    fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByText(/8\+ characters/)).toBeTruthy();
  });

  it('rejects mismatched passwords', () => {
    renderWithProviders(<SignupScreen />);
    const { emailInput, passwordInput, confirmInput } = getFields();
    fireEvent.changeText(emailInput, 'a@example.com');
    fireEvent.changeText(passwordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password2!');
    fireEvent.press(screen.getByText('Continue'));
    // Shown twice: the live "Passwords don't match." hint under the confirm
    // field, and the same text in the submit error card.
    expect(screen.getAllByText("Passwords don't match.").length).toBeGreaterThan(0);
  });

  it('rejects an invalid CNIC/gender combination', () => {
    renderWithProviders(<SignupScreen />);
    const { emailInput, passwordInput, confirmInput, fullNameInput, dobInput, cnicInput } = getFields();
    fireEvent.changeText(emailInput, 'a@example.com');
    fireEvent.changeText(passwordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password1!');
    fireEvent.changeText(fullNameInput, 'Ayesha Khan');
    fireEvent.changeText(dobInput, '20051998');
    fireEvent.press(screen.getByText('Female'));
    fireEvent.changeText(cnicInput, '1234512345671'); // odd last digit -> male, mismatched
    for (const node of screen.getAllByText('City')) fireEvent.press(node);
    fireEvent.press(screen.getByText('Lahore'));

    fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByText(/security check failed/)).toBeTruthy();
  });

  it('requires accepting the legal terms', () => {
    renderWithProviders(<SignupScreen />);
    const { emailInput, passwordInput, confirmInput, fullNameInput, dobInput, cnicInput } = getFields();
    fireEvent.changeText(emailInput, 'a@example.com');
    fireEvent.changeText(passwordInput, 'Password1!');
    fireEvent.changeText(confirmInput, 'Password1!');
    fireEvent.changeText(fullNameInput, 'Ayesha Khan');
    fireEvent.changeText(dobInput, '20051998');
    fireEvent.press(screen.getByText('Female'));
    fireEvent.changeText(cnicInput, '1234512345672');
    for (const node of screen.getAllByText('City')) fireEvent.press(node);
    fireEvent.press(screen.getByText('Lahore'));

    fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByText(/Confirm you are 18 or older/)).toBeTruthy();
  });
});

describe('SignupScreen happy path', () => {
  it('starts the onboarding draft and moves to step 2 for a fresh email', async () => {
    renderWithProviders(<SignupScreen />);
    fillValidForm();

    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(authService.inspectEmail).toHaveBeenCalledWith('a@example.com', 'Password1!'));
    await waitFor(() =>
      expect(startDraft).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@example.com', fullName: 'Ayesha Khan', dob: '1998-05-20', city: 'Lahore' })
      )
    );
    expect(push).toHaveBeenCalledWith('/intent-photos');
  });

  it('shows an error and does not proceed when the email is already taken', async () => {
    (authService.inspectEmail as jest.Mock).mockResolvedValue('taken');
    renderWithProviders(<SignupScreen />);
    fillValidForm();

    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(screen.getByText(/account with this email already exists/)).toBeTruthy());
    expect(startDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('proceeds for a "resume" (half-finished) signup, same as a fresh one', async () => {
    (authService.inspectEmail as jest.Mock).mockResolvedValue('resume');
    renderWithProviders(<SignupScreen />);
    fillValidForm();

    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => expect(startDraft).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith('/intent-photos');
  });
});
