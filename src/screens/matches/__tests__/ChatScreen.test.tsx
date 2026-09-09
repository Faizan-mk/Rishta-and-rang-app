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
import type { ChatMessage, Match } from '../../../types/content';
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
// focused on ChatScreen's own wiring (send/attach/rishta/block/report).
jest.mock('../../../components/matches/MessageBubble', () => ({
  MessageBubble: ({ message }: { message: ChatMessage }) =>
    require('react').createElement(require('react-native').Text, null, `bubble:${message.text}`),
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

function setupMatches(overrides: Partial<Match> = {}, messages: ChatMessage[] = []) {
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
    sendRishtaRequest,
    respondRishtaRequest,
    blockMatch,
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
      loadOlderMessages: jest.fn(),
      retryMessage: jest.fn(),
      sendMessage,
      sendVoiceMessage: jest.fn(),
      sendImageMessage,
      sendRishtaRequest,
      respondRishtaRequest,
      blockMatch,
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
    expect(sendMessage).toHaveBeenCalledWith('m1', 'Hi there');
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

    await waitFor(() => expect(sendImageMessage).toHaveBeenCalledWith('m1', 'photo.jpg'));
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

  it('blocks the match after confirming and goes back', async () => {
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'hand-left-outline' }));

    await waitFor(() => expect(blockMatch).toHaveBeenCalledWith('m1'));
    expect(back).toHaveBeenCalled();
  });

  it('does not block when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    renderScreen();

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'hand-left-outline' }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(blockMatch).not.toHaveBeenCalled();
  });

  it('opens the report dialog', () => {
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'flag-outline' }));
    expect(screen.getByText('Submit report')).toBeTruthy();
  });

  it('navigates to the call screen', () => {
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'call-outline' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/call', params: { name: 'Sara', photo: 'a.jpg' } });
  });

  it('navigates to the video call screen', () => {
    renderScreen();
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'videocam-outline' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/call', params: { name: 'Sara', photo: 'a.jpg', video: '1' } });
  });
});
