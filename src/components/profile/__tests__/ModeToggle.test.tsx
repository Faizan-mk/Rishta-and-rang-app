import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ModeToggle } from '../ModeToggle';

describe('ModeToggle', () => {
  it('renders both labels', () => {
    renderWithProviders(<ModeToggle mode="dating" onChange={jest.fn()} datingLabel="Friends" rishtaLabel="Rishta" />);
    expect(screen.getByText('Friends')).toBeTruthy();
    expect(screen.getByText('Rishta')).toBeTruthy();
  });

  it('calls onChange("rishta") when the Rishta side is tapped', () => {
    const onChange = jest.fn();
    renderWithProviders(<ModeToggle mode="dating" onChange={onChange} datingLabel="Friends" rishtaLabel="Rishta" />);
    fireEvent.press(screen.getByText('Rishta'));
    expect(onChange).toHaveBeenCalledWith('rishta');
  });

  it('calls onChange("dating") when the Friends side is tapped', () => {
    const onChange = jest.fn();
    renderWithProviders(<ModeToggle mode="rishta" onChange={onChange} datingLabel="Friends" rishtaLabel="Rishta" />);
    fireEvent.press(screen.getByText('Friends'));
    expect(onChange).toHaveBeenCalledWith('dating');
  });

  it('shows an optional count badge next to a label', () => {
    renderWithProviders(
      <ModeToggle mode="dating" onChange={jest.fn()} datingLabel="Friends" rishtaLabel="Rishta" datingCount={3} />
    );
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows no count badge when the count is zero', () => {
    renderWithProviders(
      <ModeToggle mode="dating" onChange={jest.fn()} datingLabel="Friends" rishtaLabel="Rishta" datingCount={0} />
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});
