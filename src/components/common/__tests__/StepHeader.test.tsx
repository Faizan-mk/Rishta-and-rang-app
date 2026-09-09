import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { StepHeader } from '../StepHeader';

describe('StepHeader', () => {
  it('calls onBack when the back button is pressed', () => {
    const onBack = jest.fn();
    renderWithProviders(<StepHeader total={3} current={1} onBack={onBack} />);
    fireEvent.press(screen.UNSAFE_getByProps({ hitSlop: 10 }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders across the first, middle and last step without throwing', () => {
    expect(() => renderWithProviders(<StepHeader total={3} current={0} onBack={jest.fn()} />)).not.toThrow();
    expect(() => renderWithProviders(<StepHeader total={3} current={1} onBack={jest.fn()} />)).not.toThrow();
    expect(() => renderWithProviders(<StepHeader total={3} current={2} onBack={jest.fn()} />)).not.toThrow();
  });
});
