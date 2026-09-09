import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { DateField } from '../DateField';

describe('DateField', () => {
  it('displays an ISO value in DD/MM/YYYY form', () => {
    renderWithProviders(<DateField label="Date of birth" value="1998-05-20" onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('20/05/1998')).toBeTruthy();
  });

  it('shows an empty field for an empty value', () => {
    renderWithProviders(<DateField label="Date of birth" value="" onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('')).toBeTruthy();
  });

  it('auto-inserts slashes as digits are typed and reports the ISO date once complete', () => {
    const onChange = jest.fn();
    renderWithProviders(<DateField label="Date of birth" value="" onChange={onChange} />);
    const input = screen.UNSAFE_getByType(TextInput);

    fireEvent.changeText(input, '20051998');

    expect(onChange).toHaveBeenLastCalledWith('1998-05-20');
  });

  it('reports an empty string while the typed date is incomplete or invalid', () => {
    const onChange = jest.fn();
    renderWithProviders(<DateField label="Date of birth" value="" onChange={onChange} />);
    const input = screen.UNSAFE_getByType(TextInput);

    fireEvent.changeText(input, '2005');

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('strips non-digit characters from typed input', () => {
    const onChange = jest.fn();
    renderWithProviders(<DateField label="Date of birth" value="" onChange={onChange} />);
    const input = screen.UNSAFE_getByType(TextInput);

    fireEvent.changeText(input, '20-05-1998');

    expect(onChange).toHaveBeenLastCalledWith('1998-05-20');
  });

  it('shows an error message when given one', () => {
    renderWithProviders(<DateField label="Date of birth" value="" onChange={jest.fn()} error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy();
  });
});
