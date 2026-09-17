import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { MessageBubble } from '../MessageBubble';
import { useMatches } from '../../../store/MatchesContext';
import type { ChatMessage } from '../../../types/content';

jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({ pause: jest.fn(), play: jest.fn(), seekTo: jest.fn() })),
  useAudioPlayerStatus: jest.fn(() => ({ playing: false, currentTime: 0, duration: 7 })),
}));

const mockUseMatches = useMatches as jest.Mock;
let toggleReaction: jest.Mock;

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg1',
    matchId: 'm1',
    fromMe: false,
    text: 'Hello there',
    sentAt: '2026-01-01T10:30:00.000Z',
    kind: 'text',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  toggleReaction = jest.fn();
  mockUseMatches.mockReturnValue({ getReactions: () => [], toggleReaction });
});

describe('MessageBubble', () => {
  it('renders the message text', () => {
    renderWithProviders(<MessageBubble message={message()} />);
    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  it('renders nothing for an empty text message', () => {
    const { toJSON } = renderWithProviders(<MessageBubble message={message({ text: '' })} />);
    expect(toJSON()).toBeNull();
  });

  it('renders an image bubble', () => {
    renderWithProviders(<MessageBubble message={message({ kind: 'image', imageUri: 'a.jpg', text: '' })} />);
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it('renders a voice bubble with its duration', () => {
    renderWithProviders(
      <MessageBubble message={message({ kind: 'voice', audioUri: 'a.m4a', durationSec: 7, text: '' })} />
    );
    expect(screen.getByText('0:07')).toBeTruthy();
  });

  it("shows the voice note's sent time beside its duration", () => {
    // Built from local components (not a UTC literal) so the expected "5:28
    // PM" round-trips correctly regardless of the machine's own timezone.
    const sentAt = new Date(2026, 0, 1, 17, 28).toISOString();
    renderWithProviders(
      <MessageBubble message={message({ kind: 'voice', audioUri: 'a.m4a', durationSec: 51, text: '', sentAt })} />
    );
    expect(screen.getByText('0:51')).toBeTruthy();
    expect(screen.getByText('5:28 PM')).toBeTruthy();
  });

  it('shows an unknown duration rather than a garbled number for bad legacy data', () => {
    // Old rows written before stopRecording read getStatus().durationMillis
    // could carry an epoch-millisecond value in duration_sec instead of an
    // actual elapsed time — this should read as unknown, not as that number.
    renderWithProviders(
      <MessageBubble message={message({ kind: 'voice', audioUri: 'a.m4a', durationSec: 1789561718751, text: '' })} />
    );
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.queryByText(/29826028645/)).toBeNull();
  });

  it('shows a retry action for a failed outgoing message', () => {
    renderWithProviders(<MessageBubble message={message({ fromMe: true, status: 'failed' })} onRetry={jest.fn()} />);
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('calls onRetry when the retry action is pressed', () => {
    const onRetry = jest.fn();
    const failedMessage = message({ fromMe: true, status: 'failed' });
    renderWithProviders(<MessageBubble message={failedMessage} onRetry={onRetry} />);
    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledWith(failedMessage);
  });

  it('shows no retry action for a message that has not failed', () => {
    renderWithProviders(<MessageBubble message={message({ fromMe: true, status: 'sent' })} />);
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('renders a reaction pill with its count', () => {
    mockUseMatches.mockReturnValue({
      getReactions: () => [
        { id: 'r1', messageId: 'msg1', userId: 'u1', emoji: '❤️', createdAt: '2026-01-01' },
        { id: 'r2', messageId: 'msg1', userId: 'u2', emoji: '❤️', createdAt: '2026-01-01' },
      ],
      toggleReaction,
    });
    renderWithProviders(<MessageBubble message={message()} currentUserId="u1" />);
    expect(screen.getByText('❤️')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('toggles a reaction when its pill is pressed', () => {
    mockUseMatches.mockReturnValue({
      getReactions: () => [{ id: 'r1', messageId: 'msg1', userId: 'u1', emoji: '❤️', createdAt: '2026-01-01' }],
      toggleReaction,
    });
    renderWithProviders(<MessageBubble message={message()} currentUserId="u1" />);
    fireEvent.press(screen.getByText('❤️'));
    expect(toggleReaction).toHaveBeenCalledWith('msg1', '❤️');
  });

  it('offers "delete for everyone" on a long press of my own message', () => {
    const onDeleteForEveryone = jest.fn();
    const onDeleteForMe = jest.fn();
    renderWithProviders(
      <MessageBubble
        message={message({ fromMe: true })}
        onDeleteForEveryone={onDeleteForEveryone}
        onDeleteForMe={onDeleteForMe}
      />
    );
    fireEvent(screen.getByLabelText('React to this message'), 'longPress');
    fireEvent.press(screen.getByText('Delete for everyone'));
    expect(onDeleteForEveryone).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg1' }));
    fireEvent(screen.getByLabelText('React to this message'), 'longPress');
    fireEvent.press(screen.getByText('Delete for me'));
    expect(onDeleteForMe).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg1' }));
  });

  it('only offers "delete for me" on someone else\'s message', () => {
    const onDeleteForEveryone = jest.fn();
    const onDeleteForMe = jest.fn();
    renderWithProviders(
      <MessageBubble
        message={message({ fromMe: false })}
        onDeleteForEveryone={onDeleteForEveryone}
        onDeleteForMe={onDeleteForMe}
      />
    );
    fireEvent(screen.getByLabelText('React to this message'), 'longPress');
    expect(screen.queryByText('Delete for everyone')).toBeNull();
    fireEvent.press(screen.getByText('Delete for me'));
    expect(onDeleteForMe).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg1' }));
    expect(onDeleteForEveryone).not.toHaveBeenCalled();
  });

  it('shows no delete row when no delete handler is given', () => {
    renderWithProviders(<MessageBubble message={message({ fromMe: true })} />);
    fireEvent(screen.getByLabelText('React to this message'), 'longPress');
    expect(screen.queryByText('Delete for everyone')).toBeNull();
    expect(screen.queryByText('Delete for me')).toBeNull();
  });

  it('closes the sheet without deleting on Cancel', () => {
    const onDeleteForMe = jest.fn();
    renderWithProviders(<MessageBubble message={message()} onDeleteForMe={onDeleteForMe} />);
    fireEvent(screen.getByLabelText('React to this message'), 'longPress');
    fireEvent.press(screen.getByText('Cancel'));
    expect(onDeleteForMe).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete for me')).toBeNull();
  });
});
