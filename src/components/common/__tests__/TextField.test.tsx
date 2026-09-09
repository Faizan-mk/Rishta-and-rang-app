import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('renders the label and passes the value through', () => {
    renderWithProviders(<TextField label="Full name" value="Ayesha" onChangeText={jest.fn()} />);
    expect(screen.getByText('Full name')).toBeTruthy();
    expect(screen.getByDisplayValue('Ayesha')).toBeTruthy();
  });

  it('shows an error message when given one', () => {
    renderWithProviders(<TextField label="Email" error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeTruthy();
  });

  it('renders no error text when none is given', () => {
    renderWithProviders(<TextField label="Email" />);
    expect(screen.queryByText('Invalid email')).toBeNull();
  });

  it('forwards onChangeText to the underlying input', () => {
    const onChangeText = jest.fn();
    renderWithProviders(<TextField label="Bio" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('masks a secure field by default and reveals it on toggle', () => {
    renderWithProviders(<TextField label="Password" value="secret123" secureTextEntry onChangeText={jest.fn()} />);
    const eyeButton = screen.UNSAFE_getByProps({ hitSlop: 8 });
    expect(screen.UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(true);

    fireEvent.press(eyeButton);
    expect(screen.UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(false);

    fireEvent.press(eyeButton);
    expect(screen.UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(true);
  });

  it('does not render a reveal toggle for a non-secure field', () => {
    renderWithProviders(<TextField label="Bio" value="hi" onChangeText={jest.fn()} />);
    expect(screen.UNSAFE_queryAllByProps({ hitSlop: 8 })).toHaveLength(0);
  });
});
