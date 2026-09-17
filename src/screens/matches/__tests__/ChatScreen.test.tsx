import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { ChatScreen } from '../ChatScreen';
import { useDialog } from '../../../store/DialogContext';
import { useAuth } from '../../../store/AuthContext';
import { useMatches } from '../../../store/MatchesContext';
import { discoveryService } from '../../../services/discoveryService';
import { reportsService } from '../../../services/reportsService';
import type { BlockedProfile, ChatMessage, Match } from '../../../types/content';
import type { UserProfile } from '../../../types/user';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../services/discoveryService', () => ({ discoveryService: { fetchActivity: jest.fn() } }));
jest.mock('../../../services/reportsService', () => ({ reportsService: { submitReport: jest.fn() } }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), currentTime: 3, uri: null })),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(),
}));
// MessageBubble has its own dedicated test; stubbing it here keeps this file
// focused on ChatScreen's own wiring (send/attach/rishta/block/report/reply).
// A pressable "swipe:<text>" stands in for the real swipe gesture, so this
// file can trigger the reply flow without re-testing the gesture itself.
jest.mock('../../../components/matches/MessageBubble', () => ({
  MessageBubble: ({
    message,
    onSwipeReply,
    replyToMessage,
  }: {
    message: ChatMessage;
    onSwipeReply?: (message: ChatMessage) => void;
    replyToMessage?: ChatMessage;
  }) => {
    const { createElement } = require('react');
    const { Text, Pressable } = require('react-native');
    return createElement(
      Pressable,
      { onPress: () => onSwipeReply?.(message) },
      createElement(
        Text,
        null,
        `bubble:${message.text}${replyToMessage ? ` replying-to:${replyToMessage.text}` : ''}`
      )
    );
  },
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

const push = jest.fn();
const back = jest.fn();
let confirm: jest.Mock;
let notify: jest.Mock;
let sendMessage: jest.Mock;
let sendImageMessage: jest.Mock;
let markMatchRead: jest.Mock;
let openThread: jest.Mock;
let sendRishtaRequest: jest.Mock;
let respondRishtaRequest: jest.Mock;
let blockMatch: jest.Mock;
let unblockUser: jest.Mock;
let clearChat: jest.Mock;

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Bilal',
    email: 'b@example.com',
    dob: '1998-01-01',
    gender: 'male',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'serious',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: 'x', education: 'BSc', readiness: 'ready_now' },
    activeMode: 'dating',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    name: 'Sara',
    photo: 'a.jpg',
    lastMessage: '',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    unread: false,
    mode: 'dating',
    movedToRishta: false,
    sourceProfileId: 'p1',
    ...overrides,
  };
}

function setupMatches(
  overrides: Partial<Match> = {},
  messages: ChatMessage[] = [],
  blockedProfiles: BlockedProfile[] = []
) {
  mockUseMatches.mockReturnValue({
    getMatch: () => match(overrides),
    getMessages: () => messages,
    openThread,
    loadOlderMessages: jest.fn(),
    getThreadPaging: () => ({ loading: false, hasMore: false }),
    retryMessage: jest.fn(),
    sendMessage,
    sendVoiceMessage: jest.fn(),
    sendImageMessage,
    markMatchRead,
    refreshReadReceipt: jest.fn().mockResolvedValue(undefined),
    sendRishtaRequest,
    respondRishtaRequest,
    blockMatch,
    blockedProfiles,
    unblockUser,
    clearChat,
  });
}

function renderScreen() {
  return render(withProviders(<ChatScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ id: 'm1' });
  mockUseRouter.mockReturnValue({ push, back });
  confirm = jest.fn().mockResolvedValue(false);
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ confirm, notify });
  mockUseAuth.mockReturnValue({ user: user() });
  sendMessage = jest.fn();
  sendImageMessage = jest.fn();
  markMatchRead = jest.fn();
  openThread = jest.fn();
  sendRishtaRequest = jest.fn().mockResolvedValue(undefined);
  respondRishtaRequest = jest.fn().mockResolvedValue('accepted');
  blockMatch = jest.fn();
  unblockUser = jest.fn();
  clearChat = jest.fn();
  (discoveryService.fetchActivity as jest.Mock).mockResolvedValue(new Map());
  setupMatches();
});

describe('ChatScreen', () => {
  it('renders the match name and marks the thread read on open', () => {
    renderScreen();
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(markMatchRead).toHaveBeenCalledWith('m1');
    expect(openThread).toHaveBeenCalledWith('m1');
  });

  it('renders nothing when the match cannot be found', () => {
    mockUseMatches.mockReturnValue({
      getMatch: () => undefined,
      getMessages: () => [],
      getThreadPaging: () => ({ loading: false, hasMore: false }),
      openThread,
      markMatchRead,
      refreshReadReceipt: jest.fn().mockResolvedValue(undefined),
      loadOlderMessages: jest.fn(),
      retryMessage: jest.fn(),
      sendMessage,
      sendVoiceMessage: jest.fn(),
      sendImageMessage,
      sendRishtaRequest,
      respondRishtaRequest,
      blockMatch,
      blockedProfiles: [],
      unblockUser,
    });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('renders messages from the thread', () => {
    setupMatches({}, [
      { id: 'msg1', matchId: 'm1', fromMe: false, text: 'Hello', sentAt: '2026-01-01T10:00:00.000Z', kind: 'text' },
    ]);
    renderScreen();
    expect(screen.getByText('bubble:Hello')).toBeTruthy();
  });

  it('sends a typed message and clears the input', () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Type a message...'), 'Hi there');
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'send' }));
    // Third arg is the swipe-to-reply target's id — undefined here, since
    // nothing was swiped to reply to.
    expect(sendMessage).toHaveBeenCalledWith('m1', 'Hi there', undefined);
  });

  it('shows a reply bar with the quoted preview after swiping a message, and sends the reply', () => {
    setupMatches(
      {},
      [{ id: 'msg1', matchId: 'm1', fromMe: false, text: 'Hello there', sentAt: '2026-01-01T10:00:00.000Z', kind: 'text' }]
    );
    renderScreen();

    // The mocked MessageBubble stands in for the real swipe gesture with a press.
    fireEvent.press(screen.getByText('bubble:Hello there'));
    expect(screen.getByText('Hello there')).toBeTruthy(); // the reply bar's own quoted preview

    fireEvent.changeText(screen.getByPlaceholderText('Type a message...'), 'Sure, sounds good');
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'send' }));
    expect(sendMessage).toHaveBeenCalledWith('m1', 'Sure, sounds good', 'msg1');

    // The bar is gone once the reply has actually gone out.
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it('clears the reply bar without sending when its close button is pressed', () => {
    setupMatches(
      {},
      [{ id: 'msg1', matchId: 'm1', fromMe: false, text: 'Hello there', sentAt: '2026-01-01T10:00:00.000Z', kind: 'text' }]
    );
    renderScreen();

    fireEvent.press(screen.getByText('bubble:Hello there'));
    expect(screen.getByText('Hello there')).toBeTruthy();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'close' }));
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it("resolves a message's own replyToMessage from the thread already in memory", () => {
    setupMatches(
      {},
      [
        { id: 'msg1', matchId: 'm1', fromMe: false, text: 'Original', sentAt: '2026-01-01T10:00:00.000Z', kind: 'text' },
        {
          id: 'msg2',
          matchId: 'm1',
          fromMe: true,
          text: 'A reply',
          sentAt: '2026-01-01T10:01:00.000Z',
          kind: 'text',
          replyToId: 'msg1',
        },
      ]
    );
    renderScreen();

    expect(screen.getByText('bubble:A reply replying-to:Original')).toBeTruthy();
  });

  it('shows no send button while the input is empty (mic button shows instead)', () => {
    renderScreen();
    expect(screen.UNSAFE_queryAllByProps({ name: 'send' })).toHaveLength(0);
    expect(screen.UNSAFE_getByProps({ name: 'mic' })).toBeTruthy();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('shows a permission dialog when picking a photo without library access', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'image-outline' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Permission needed' })));
  });

  it('sends a picked image', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'photo.jpg' }] });
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'image-outline' }));

    await waitFor(() => expect(sendImageMessage).toHaveBeenCalledWith('m1', 'photo.jpg', undefined));
  });

  it('shows the Move to Rishta bar and sends a request once confirmed', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('Move to Rishta'));

    await waitFor(() => expect(sendRishtaRequest).toHaveBeenCalledWith('m1', expect.any(String)));
  });

  it('directs to the rishta profile screen when the profile is incomplete', async () => {
    mockUseAuth.mockReturnValue({ user: user({ rishta: { religion: '', sect: '', familyBackground: '', education: '', readiness: 'browsing' } }) });
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('Move to Rishta'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/rishta-profile'));
    expect(sendRishtaRequest).not.toHaveBeenCalled();
  });

  it('shows the incoming-request banner and accepts it', async () => {
    setupMatches({ rishtaRequestIncoming: true });
    renderScreen();

    expect(screen.getByText(/wants to move this to Rishta stage/)).toBeTruthy();
    fireEvent.press(screen.getByText('Accept'));

    await waitFor(() => expect(respondRishtaRequest).toHaveBeenCalledWith('m1', true));
  });

  it('declines an incoming rishta request', async () => {
    setupMatches({ rishtaRequestIncoming: true });
    respondRishtaRequest.mockResolvedValue('declined');
    renderScreen();

    fireEvent.press(screen.getByText('Not yet'));

    await waitFor(() => expect(respondRishtaRequest).toHaveBeenCalledWith('m1', false));
  });

  // The header's five actions collapsed into one "⋮" overflow menu, so every
  // one of them is reached by opening it first.
  const openHeaderMenu = () => fireEvent.press(screen.UNSAFE_getByProps({ name: 'ellipsis-vertical' }));

  it('blocks the match after confirming, staying on the thread', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();

    openHeaderMenu();
    fireEvent.press(screen.getByText('Block'));

    await waitFor(() => expect(blockMatch).toHaveBeenCalledWith('m1'));
    // Blocking used to also delete the match, so the screen navigated away —
    // it keeps the thread now (supabase/35_block_keeps_thread.sql), so the
    // member stays put and sees the blocked banner instead.
    expect(back).not.toHaveBeenCalled();
  });

  it('shows the blocked banner instead of the composer, and unblocks from it', () => {
    setupMatches({}, [], [{ id: 'p1', name: 'Sara', photo: 'a.jpg', blockedAt: '2026-01-01T00:00:00.000Z' }]);
    renderScreen();

    expect(screen.getByText('You blocked Sara. Unblock to send messages again.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Type a message...')).toBeNull();

    fireEvent.press(screen.getByText('Unblock'));
    expect(unblockUser).toHaveBeenCalledWith('p1');
  });

  it('drops "Block" from the menu once already blocked — unblocking lives on the banner instead', () => {
    setupMatches({}, [], [{ id: 'p1', name: 'Sara', photo: 'a.jpg', blockedAt: '2026-01-01T00:00:00.000Z' }]);
    renderScreen();

    openHeaderMenu();
    expect(screen.queryByText('Block')).toBeNull();
  });

  it('does not block when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();

    openHeaderMenu();
    fireEvent.press(screen.getByText('Block'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(blockMatch).not.toHaveBeenCalled();
  });

  it('clears the chat after confirming', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();

    openHeaderMenu();
    fireEvent.press(screen.getByText('Clear chat'));

    await waitFor(() => expect(clearChat).toHaveBeenCalledWith('m1'));
  });

  it('does not clear the chat when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();

    openHeaderMenu();
    fireEvent.press(screen.getByText('Clear chat'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(clearChat).not.toHaveBeenCalled();
  });

  it('opens the report dialog', () => {
    renderScreen();
    openHeaderMenu();
    fireEvent.press(screen.getByText('Report'));
    expect(screen.getByText('Submit report')).toBeTruthy();
  });

  it('navigates to the call screen', () => {
    renderScreen();
    openHeaderMenu();
    fireEvent.press(screen.getByText('Voice call'));
    expect(push).toHaveBeenCalledWith({ pathname: '/call', params: { name: 'Sara', photo: 'a.jpg' } });
  });

  it('navigates to the video call screen', () => {
    renderScreen();
    openHeaderMenu();
    fireEvent.press(screen.getByText('Video call'));
    expect(push).toHaveBeenCalledWith({ pathname: '/call', params: { name: 'Sara', photo: 'a.jpg', video: '1' } });
  });

  it('closes the menu without acting when the backdrop is tapped', () => {
    renderScreen();
    openHeaderMenu();
    fireEvent.press(screen.getByTestId('chat-header-menu-backdrop'));
    expect(screen.queryByText('Clear chat')).toBeNull();
    expect(blockMatch).not.toHaveBeenCalled();
  });
});
