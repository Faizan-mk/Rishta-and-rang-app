import React from 'react';
import { fireEvent, screen, act, render } from '@testing-library/react-native';
import { withProviders } from '../../__tests__/testWrappers';
import { BoostSheet } from '../BoostSheet';
import { useBoost } from '../../../store/BoostContext';

jest.mock('../../../store/BoostContext', () => {
  const actual = jest.requireActual('../../../store/BoostContext');
  return { ...actual, useBoost: jest.fn() };
});

const mockUseBoost = useBoost as jest.Mock;

function renderSheet(props: Partial<Parameters<typeof BoostSheet>[0]> = {}) {
  return render(
    withProviders(
      <BoostSheet visible onClose={jest.fn()} onGetMore={jest.fn()} {...props} />
    )
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BoostSheet', () => {
  it('shows the empty state when there are no boosts left', () => {
    mockUseBoost.mockReturnValue({ boostsLeft: 0, activeUntil: null, isBoostActive: false, startBoost: jest.fn() });
    renderSheet();
    expect(screen.getByText("You're out of Boosts")).toBeTruthy();
    expect(screen.queryByText('Boost me now')).toBeNull();
  });

  it('shows the idle state with a Boost me now button when boosts are available', () => {
    const startBoost = jest.fn();
    mockUseBoost.mockReturnValue({ boostsLeft: 3, activeUntil: null, isBoostActive: false, startBoost });
    renderSheet();
    expect(screen.getByText('Boost your profile')).toBeTruthy();
    expect(screen.getByText('You now have 3 Boosts left.')).toBeTruthy();

    fireEvent.press(screen.getByText('Boost me now'));
    expect(startBoost).toHaveBeenCalledTimes(1);
  });

  it('shows the active state with a countdown clock', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mockUseBoost.mockReturnValue({
      boostsLeft: 1,
      activeUntil: new Date('2026-01-01T01:00:05.000Z'),
      isBoostActive: true,
      startBoost: jest.fn(),
    });
    renderSheet();
    expect(screen.getByText("We're already boosting you!")).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('00')).toBeTruthy();
    expect(screen.getByText('05')).toBeTruthy();
    jest.useRealTimers();
  });

  it('ticks the countdown down while the sheet is visible', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mockUseBoost.mockReturnValue({
      boostsLeft: 1,
      activeUntil: new Date('2026-01-01T00:00:03.000Z'),
      isBoostActive: true,
      startBoost: jest.fn(),
    });
    renderSheet();
    expect(screen.getByText('03')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('02')).toBeTruthy();
    jest.useRealTimers();
  });

  it('calls onGetMore when Get more Boosts is pressed', () => {
    const onGetMore = jest.fn();
    mockUseBoost.mockReturnValue({ boostsLeft: 0, activeUntil: null, isBoostActive: false, startBoost: jest.fn() });
    renderSheet({ onGetMore });
    fireEvent.press(screen.getByText('Get more Boosts'));
    expect(onGetMore).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    mockUseBoost.mockReturnValue({ boostsLeft: 0, activeUntil: null, isBoostActive: false, startBoost: jest.fn() });
    renderSheet({ onClose });
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
