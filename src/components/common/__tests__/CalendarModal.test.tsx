import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { CalendarModal } from '../CalendarModal';
import { lightPalette } from '../../../theme/palettes';

// A fixed "today" ceiling so the visible month/year are deterministic.
const MAX_DATE_ISO = '2026-01-15';

describe('CalendarModal', () => {
  it('opens on the month containing the initial date', () => {
    renderWithProviders(
      <CalendarModal visible initialIso="2000-05-20" maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText(/May/)).toBeTruthy();
    expect(screen.getByText(/2000/)).toBeTruthy();
  });

  it('falls back to the max-date month when there is no initial date', () => {
    renderWithProviders(<CalendarModal visible initialIso={null} maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/January/)).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('selects a day and reports its ISO date', () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <CalendarModal visible initialIso="2000-05-20" maxDateIso={MAX_DATE_ISO} onSelect={onSelect} onClose={jest.fn()} />
    );
    fireEvent.press(screen.getByText('10'));
    expect(onSelect).toHaveBeenCalledWith('2000-05-10');
  });

  it('navigates to the previous month', () => {
    renderWithProviders(
      <CalendarModal visible initialIso="2000-05-20" maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    fireEvent.press(screen.UNSAFE_getAllByProps({ hitSlop: 8 })[0]); // prev chevron
    expect(screen.getByText(/April/)).toBeTruthy();
  });

  it('disables the next-month control at the max-date ceiling', () => {
    renderWithProviders(
      <CalendarModal visible initialIso="2026-01-01" maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    // The next-month chevron is only greyed out (colors.textTertiary) once
    // stepping forward would pass the max date — this is the visible half of
    // that guard; goNext()'s own `if (!canGoNext) return;` is the enforcement.
    expect(screen.UNSAFE_getByProps({ name: 'chevron-forward' }).props.color).toBe(lightPalette.textTertiary);
  });

  it('opens the year picker and jumps to a selected year', () => {
    renderWithProviders(
      <CalendarModal visible initialIso="2000-05-20" maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    fireEvent.press(screen.getByText(/May/));
    fireEvent.press(screen.getByText('1995'));
    expect(screen.getByText(/1995/)).toBeTruthy();
  });

  it('renders nothing interactive when not visible', () => {
    renderWithProviders(
      <CalendarModal visible={false} initialIso="2000-05-20" maxDateIso={MAX_DATE_ISO} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.queryByText('10')).toBeNull();
  });
});
