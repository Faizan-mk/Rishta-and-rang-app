import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { FilterSheet } from '../FilterSheet';

describe('FilterSheet', () => {
  it('renders its children once open', async () => {
    renderWithProviders(
      <FilterSheet visible title="Filters" onClose={jest.fn()} onApply={jest.fn()} onReset={jest.fn()}>
        <Text>Age range</Text>
      </FilterSheet>
    );
    await waitFor(() => expect(screen.getByText('Age range')).toBeTruthy());
    expect(screen.getByText('Filters')).toBeTruthy();
  });

  it('calls onReset when Reset is pressed', async () => {
    const onReset = jest.fn();
    renderWithProviders(
      <FilterSheet visible title="Filters" onClose={jest.fn()} onApply={jest.fn()} onReset={onReset}>
        <Text>Age range</Text>
      </FilterSheet>
    );
    await waitFor(() => fireEvent.press(screen.getByText('Reset')));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('calls onApply when Apply is pressed', async () => {
    const onApply = jest.fn();
    renderWithProviders(
      <FilterSheet visible title="Filters" onClose={jest.fn()} onApply={onApply} onReset={jest.fn()}>
        <Text>Age range</Text>
      </FilterSheet>
    );
    await waitFor(() => fireEvent.press(screen.getByText('Apply')));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
