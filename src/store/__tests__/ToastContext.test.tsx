import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../ToastContext';
import { ThemeProvider } from '../ThemeContext';
import { LanguageProvider } from '../LanguageContext';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

function Probe({ onRetry }: { onRetry?: () => void }) {
  const { showError } = useToast();
  return (
    <Pressable
      testID="trigger"
      onPress={() => showError({ messageKey: 'netErrors.matchesRefresh', onRetry })}
    >
      <Text>Trigger</Text>
    </Pressable>
  );
}

function renderToast(props: { onRetry?: () => void } = {}) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <Probe {...props} />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe('ToastProvider', () => {
  it('shows nothing until showError is called', () => {
    renderToast();
    expect(screen.queryByText("Couldn't refresh your matches.")).toBeNull();
  });

  it('shows the translated message after a failure is reported', async () => {
    renderToast();
    fireEvent.press(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByText("Couldn't refresh your matches.")).toBeTruthy());
  });

  it('shows a Retry action and calls onRetry when there is one', async () => {
    const onRetry = jest.fn();
    renderToast({ onRetry });
    fireEvent.press(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());

    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
    // Pressing Retry dismisses the toast too.
    await waitFor(() => expect(screen.queryByText('Retry')).toBeNull());
  });

  it('shows no Retry action when none was given', async () => {
    renderToast();
    fireEvent.press(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByText("Couldn't refresh your matches.")).toBeTruthy());
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('replaces an already-showing toast with a new one rather than stacking', async () => {
    renderToast();
    fireEvent.press(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getAllByText("Couldn't refresh your matches.")).toHaveLength(1));

    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getAllByText("Couldn't refresh your matches.")).toHaveLength(1);
  });
});

describe('useToast', () => {
  it('throws when used outside a ToastProvider', () => {
    let caught: unknown;
    function Thrower() {
      try {
        useToast();
      } catch (e) {
        caught = e;
      }
      return null;
    }
    render(<Thrower />);
    expect(caught).toBeInstanceOf(Error);
  });
});
