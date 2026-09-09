import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { DialogProvider, useDialog } from '../DialogContext';
import { ThemeProvider } from '../ThemeContext';
import { LanguageProvider } from '../LanguageContext';

function Probe({ onResult }: { onResult: (value: boolean) => void }) {
  const { confirm, notify } = useDialog();
  return (
    <>
      <Pressable
        testID="ask-destructive"
        onPress={async () => onResult(await confirm({ title: 'Delete account?', message: 'This cannot be undone.', destructive: true }))}
      >
        <Text>Ask</Text>
      </Pressable>
      <Pressable testID="notify" onPress={() => notify({ title: 'Saved' })}>
        <Text>Notify</Text>
      </Pressable>
    </>
  );
}

function renderDialog(onResult: (value: boolean) => void) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <DialogProvider>
          <Probe onResult={onResult} />
        </DialogProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe('DialogProvider.confirm', () => {
  it('renders nothing until confirm is called', () => {
    renderDialog(jest.fn());
    expect(screen.queryByText('Delete account?')).toBeNull();
  });

  it('shows the dialog and resolves true when Confirm is pressed', async () => {
    const onResult = jest.fn();
    renderDialog(onResult);

    fireEvent.press(screen.getByTestId('ask-destructive'));
    await waitFor(() => expect(screen.getByText('Delete account?')).toBeTruthy());
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();

    fireEvent.press(screen.getByText('Done')); // default confirm label
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByText('Delete account?')).toBeNull();
  });

  it('resolves false when Cancel is pressed', async () => {
    const onResult = jest.fn();
    renderDialog(onResult);

    fireEvent.press(screen.getByTestId('ask-destructive'));
    await waitFor(() => expect(screen.getByText('Delete account?')).toBeTruthy());

    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});

describe('DialogProvider.notify', () => {
  it('renders confirm-only, with no Cancel button', async () => {
    renderDialog(jest.fn());
    fireEvent.press(screen.getByTestId('notify'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});
