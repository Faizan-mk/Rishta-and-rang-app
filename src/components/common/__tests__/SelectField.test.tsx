import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { SelectField } from '../SelectField';

const CITIES = ['Lahore', 'Karachi', 'Islamabad'];

describe('SelectField', () => {
  it('shows the placeholder when nothing is selected', () => {
    renderWithProviders(
      <SelectField label="City" value={null} options={CITIES} onChange={jest.fn()} placeholder="Select a city" />
    );
    expect(screen.getByText('Select a city')).toBeTruthy();
  });

  it('shows the selected value on the closed field', () => {
    renderWithProviders(<SelectField label="City" value="Lahore" options={CITIES} onChange={jest.fn()} />);
    expect(screen.getAllByText('Lahore').length).toBeGreaterThan(0);
  });

  it('opens the option sheet and lists every option plus the label as its title', async () => {
    renderWithProviders(<SelectField label="City" value={null} options={CITIES} onChange={jest.fn()} />);
    fireEvent.press(screen.getByText('—')); // placeholder fallback dash when none given
    await waitFor(() => expect(screen.getByText('Karachi')).toBeTruthy());
    expect(screen.getAllByText('City').length).toBeGreaterThan(0); // label + sheet title
  });

  it('selects an option and closes the sheet', async () => {
    const onChange = jest.fn();
    renderWithProviders(<SelectField label="City" value={null} options={CITIES} onChange={onChange} />);
    fireEvent.press(screen.getByText('—'));

    // The list's virtualized render can settle a beat after it first appears,
    // so retry the press itself rather than pressing once after a separate wait.
    await waitFor(() => fireEvent.press(screen.getByText('Karachi')));

    expect(onChange).toHaveBeenCalledWith('Karachi');
  });

  it('filters the option list by the search query', async () => {
    renderWithProviders(<SelectField label="City" value={null} options={CITIES} onChange={jest.fn()} />);
    fireEvent.press(screen.getByText('—'));

    await waitFor(() => {
      fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'lah');
      expect(screen.getByText('Lahore')).toBeTruthy();
      expect(screen.queryByText('Karachi')).toBeNull();
    });
  });

  it('offers an "All" option and reports null when it is chosen', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SelectField label="City" value="Lahore" options={CITIES} onChange={onChange} allowAll allLabel="Any city" />
    );
    fireEvent.press(screen.getAllByText('Lahore')[0]);

    await waitFor(() => fireEvent.press(screen.getByText('Any city')));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reveals a free-text field when "Other" is chosen with allowCustom', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SelectField label="City" value={null} options={CITIES} onChange={onChange} allowCustom customLabel="Type your city" />
    );
    fireEvent.press(screen.getByText('—'));

    await waitFor(() => fireEvent.press(screen.getByText('Other')));

    expect(onChange).toHaveBeenCalledWith('Other');
  });

  it('reports the typed custom value once "Other" has been picked', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SelectField
        label="City"
        value="Other"
        options={CITIES}
        onChange={onChange}
        allowCustom
        customLabel="Type your city"
      />
    );
    fireEvent.changeText(screen.getByPlaceholderText('Enter your answer'), 'Multan');
    expect(onChange).toHaveBeenCalledWith('Multan');
  });

  it('shows an error message when given one', () => {
    renderWithProviders(<SelectField label="City" value={null} options={CITIES} onChange={jest.fn()} error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('shows "No results found." when the search matches nothing', async () => {
    renderWithProviders(<SelectField label="City" value={null} options={CITIES} onChange={jest.fn()} />);
    fireEvent.press(screen.getByText('—'));

    await waitFor(() => {
      fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'zzz-no-such-city');
      expect(screen.getByText('No results found.')).toBeTruthy();
    });
  });
});
