import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { MatchScoreCard } from '../MatchScoreCard';

describe('MatchScoreCard', () => {
  it('renders the clamped score and the subtitle with the name', () => {
    renderWithProviders(<MatchScoreCard name="Sara" score={87.6} bureauVerified={false} mode="dating" onPress={jest.fn()} />);
    expect(screen.getByText('88')).toBeTruthy();
    expect(screen.getByText('How Sara lines up with what you said you want.')).toBeTruthy();
  });

  it('clamps a score above 100 down to 100', () => {
    renderWithProviders(<MatchScoreCard name="Sara" score={140} bureauVerified={false} mode="dating" onPress={jest.fn()} />);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('clamps a negative score up to 0', () => {
    renderWithProviders(<MatchScoreCard name="Sara" score={-20} bureauVerified={false} mode="dating" onPress={jest.fn()} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderWithProviders(<MatchScoreCard name="Sara" score={70} bureauVerified={false} mode="dating" onPress={onPress} />);
    fireEvent.press(screen.getByText('See why you match'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
