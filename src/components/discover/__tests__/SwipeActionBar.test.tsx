import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { SwipeActionBar } from '../SwipeActionBar';

function props(overrides: Partial<Parameters<typeof SwipeActionBar>[0]> = {}) {
  return {
    canUndo: true,
    liked: false,
    locked: false,
    onUndo: jest.fn(),
    onPass: jest.fn(),
    onLike: jest.fn(),
    bottomInset: 20,
    mode: 'dating' as const,
    ...overrides,
  };
}

describe('SwipeActionBar', () => {
  it('renders the Pass, Rewind and Like labels', () => {
    renderWithProviders(<SwipeActionBar {...props()} />);
    expect(screen.getByText('Pass')).toBeTruthy();
    expect(screen.getByText('Rewind')).toBeTruthy();
    expect(screen.getByText('Like')).toBeTruthy();
  });

  it('calls onPass when Pass is pressed', () => {
    const onPass = jest.fn();
    renderWithProviders(<SwipeActionBar {...props({ onPass })} />);
    fireEvent.press(screen.getByText('Pass'));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo when Rewind is pressed and undo is available', () => {
    const onUndo = jest.fn();
    renderWithProviders(<SwipeActionBar {...props({ onUndo, canUndo: true })} />);
    fireEvent.press(screen.getByText('Rewind'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not call onUndo when Rewind is disabled', () => {
    const onUndo = jest.fn();
    renderWithProviders(<SwipeActionBar {...props({ onUndo, canUndo: false })} />);
    fireEvent.press(screen.getByText('Rewind'));
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('calls onLike when Like is pressed', () => {
    const onLike = jest.fn();
    renderWithProviders(<SwipeActionBar {...props({ onLike })} />);
    fireEvent.press(screen.getByText('Like'));
    expect(onLike).toHaveBeenCalledTimes(1);
  });
});
