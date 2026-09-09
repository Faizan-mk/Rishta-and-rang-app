import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { BrowseFiltersSheet, BrowseSortSheet } from '../BrowseSheets';
import { DEFAULT_BROWSE_FILTERS, type BrowseFilters } from '../browseOptions';

describe('BrowseFiltersSheet', () => {
  function filters(overrides: Partial<BrowseFilters> = {}): BrowseFilters {
    return { ...DEFAULT_BROWSE_FILTERS, ...overrides };
  }

  it('renders the age range and filter groups', () => {
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters()} mode="dating" onChange={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText('18–60 years')).toBeTruthy();
    expect(screen.getByText('Here for')).toBeTruthy();
  });

  it('shows sect and readiness only for the rishta deck', () => {
    const { rerender } = renderWithProviders(
      <BrowseFiltersSheet visible filters={filters()} mode="dating" onChange={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.queryByText('Rishta readiness')).toBeNull();

    rerender(withProviders(<BrowseFiltersSheet visible filters={filters()} mode="rishta" onChange={jest.fn()} onClose={jest.fn()} />));
    expect(screen.getByText('Rishta readiness')).toBeTruthy();
  });

  it('increases the minimum age when the min stepper + is pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters({ ageMin: 20, ageMax: 40 })} mode="dating" onChange={onChange} onClose={jest.fn()} />
    );
    const addButtons = screen.UNSAFE_getAllByProps({ name: 'add' });
    fireEvent.press(addButtons[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ageMin: 21, ageMax: 40 }));
  });

  it('selects an intent filter chip', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters()} mode="dating" onChange={onChange} onClose={jest.fn()} />
    );
    fireEvent.press(screen.getByText('Serious'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ intent: 'serious' }));
  });

  it('toggles the verified-only switch', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters()} mode="dating" onChange={onChange} onClose={jest.fn()} />
    );
    const switches = screen.UNSAFE_getAllByType(Switch);
    fireEvent(switches[0], 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ verifiedOnly: true }));
  });

  it('resets to the default filters', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters({ ageMin: 25 })} mode="dating" onChange={onChange} onClose={jest.fn()} />
    );
    fireEvent.press(screen.getByText('Reset'));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_BROWSE_FILTERS);
  });

  it('closes when Apply is pressed', () => {
    const onClose = jest.fn();
    renderWithProviders(
      <BrowseFiltersSheet visible filters={filters()} mode="dating" onChange={jest.fn()} onClose={onClose} />
    );
    fireEvent.press(screen.getByText('Apply'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BrowseSortSheet', () => {
  it('renders the sort options with the current sort checked', () => {
    renderWithProviders(<BrowseSortSheet visible sort="recommended" onChange={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Sort by')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Best match first')).toBeTruthy();
  });

  it('does not call onChange until Confirm is pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(<BrowseSortSheet visible sort="recommended" onChange={onChange} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('Best match first'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Confirm'));
    expect(onChange).toHaveBeenCalledWith('bestMatch');
  });

  it('calls onClose without onChange when the X is pressed', () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    renderWithProviders(<BrowseSortSheet visible sort="recommended" onChange={onChange} onClose={onClose} />);
    fireEvent.press(screen.getByText('Best match first'));
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
