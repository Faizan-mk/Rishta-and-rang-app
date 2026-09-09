import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '../supabase';
import { pushService, requestPushToken, registerPushToken, unregisterPushToken } from '../pushService';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn(), functions: { invoke: jest.fn() } } }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { extra: { eas: { projectId: 'project-1' } }, version: '1.0.0' } },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare', Standalone: 'standalone' },
}));

jest.mock('expo-device', () => ({ isDevice: true, osVersion: '17.0', modelName: 'iPhone' }));

// `pushService` reads Constants/Device/Platform at call time (not at import
// time), so mutating these shared mock objects per test is enough — no need to
// re-require the module between scenarios.
const mockNotifications = {
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[abc]' }),
  addNotificationResponseReceivedListener: jest.fn((_cb: (response: unknown) => void) => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3 },
};

jest.mock('expo-notifications', () => mockNotifications);

const rpc = supabase.rpc as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mockNotifications.addNotificationResponseReceivedListener.mockImplementation(() => ({ remove: jest.fn() }));
  mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
  (Constants as unknown as { executionEnvironment: string }).executionEnvironment = 'bare';
  (Constants as unknown as { expoConfig: unknown }).expoConfig = {
    extra: { eas: { projectId: 'project-1' } },
    version: '1.0.0',
  };
  (Device as unknown as { isDevice: boolean }).isDevice = true;
  (Platform as unknown as { OS: string }).OS = 'ios';
});

describe('requestPushToken', () => {
  it('returns null inside Expo Go without touching notifications at all', async () => {
    (Constants as unknown as { executionEnvironment: string }).executionEnvironment = ExecutionEnvironment.StoreClient;

    const token = await requestPushToken();

    expect(token).toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null on a simulator/emulator (no push hardware)', async () => {
    (Device as unknown as { isDevice: boolean }).isDevice = false;
    expect(await requestPushToken()).toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied and not already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    expect(await requestPushToken()).toBeNull();
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('does not re-prompt when permission was already granted', async () => {
    const token = await requestPushToken();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[abc]');
  });

  it('sets up an Android notification channel before asking for a token', async () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    await requestPushToken();
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'Default' })
    );
  });

  it('returns null when there is no EAS projectId configured', async () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: {} };
    expect(await requestPushToken()).toBeNull();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when getExpoPushTokenAsync rejects', async () => {
    mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('no FCM credentials'));
    expect(await requestPushToken()).toBeNull();
  });
});

describe('registerPushToken / unregisterPushToken', () => {
  it('registers the token together with device info', async () => {
    rpc.mockResolvedValue({ error: null });
    await registerPushToken('token-1');
    expect(rpc).toHaveBeenCalledWith(
      'register_push_token',
      expect.objectContaining({ p_token: 'token-1', p_device_info: expect.objectContaining({ platform: 'ios' }) })
    );
  });

  it('throws when registration errors', async () => {
    rpc.mockResolvedValue({ error: { message: 'boom' } });
    await expect(registerPushToken('token-1')).rejects.toThrow('boom');
  });

  it('unregisters by token', async () => {
    rpc.mockResolvedValue({ error: null });
    await unregisterPushToken('token-1');
    expect(rpc).toHaveBeenCalledWith('unregister_push_token', { p_token: 'token-1' });
  });
});

describe('pushService.onNotificationTap / initialNotificationTap', () => {
  it("routes a tapped notification's data through to the handler", () => {
    let capturedListener: ((response: unknown) => void) | undefined;
    mockNotifications.addNotificationResponseReceivedListener.mockImplementation((cb: (r: unknown) => void) => {
      capturedListener = cb;
      return { remove: jest.fn() };
    });
    const handler = jest.fn();
    pushService.onNotificationTap(handler);

    capturedListener!({ notification: { request: { content: { data: { event: 'message', matchId: 'm1' } } } } });

    expect(handler).toHaveBeenCalledWith({ event: 'message', matchId: 'm1' });
  });

  it('reads routing off the app-launching tap when there is one', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { event: 'match' } } } },
    });
    expect(await pushService.initialNotificationTap()).toEqual({ event: 'match', matchId: undefined });
  });

  it('returns null when the app was not opened from a notification', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
    expect(await pushService.initialNotificationTap()).toBeNull();
  });
});

describe('notify helpers (never throw)', () => {
  it('invokes send-push with the event payload', async () => {
    invoke.mockResolvedValue({ error: null });
    await pushService.notifyMatch('target-1');
    expect(invoke).toHaveBeenCalledWith('send-push', { body: { event: 'match', targetId: 'target-1' } });
  });

  it('swallows a failure from the edge function rather than throwing', async () => {
    invoke.mockRejectedValue(new Error('function down'));
    await expect(pushService.notifyLike('target-1')).resolves.toBeUndefined();
  });
});
