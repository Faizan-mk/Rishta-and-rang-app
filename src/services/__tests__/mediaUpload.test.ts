import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { mediaUpload, isLocalUri } from '../mediaUpload';
import { AppError } from '../../utils/appError';

jest.mock('../supabase', () => ({
  PUBLIC_BUCKET: 'public-media',
  VERIFICATION_BUCKET: 'private-verification',
  publicMediaUrl: jest.fn((path: string) => `https://project.supabase.co/storage/v1/object/public/public-media/${path}`),
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

const mockFileInstances: Array<{ exists: boolean; bytes: jest.Mock }> = [];

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => {
    const instance = { exists: true, bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    mockFileInstances.push(instance);
    return instance;
  }),
}));

const storageFrom = supabase.storage.from as jest.Mock;

beforeEach(() => {
  storageFrom.mockReset();
  mockFileInstances.length = 0;
});

describe('isLocalUri', () => {
  it('treats a remote http(s) URL as not local', () => {
    expect(isLocalUri('https://cdn.example.com/a.jpg')).toBe(false);
    expect(isLocalUri('http://cdn.example.com/a.jpg')).toBe(false);
  });

  it('treats a file:// or content:// URI as local', () => {
    expect(isLocalUri('file:///data/user/photo.jpg')).toBe(true);
    expect(isLocalUri('content://media/photo.jpg')).toBe(true);
  });
});

describe('mediaUpload.uploadPhoto', () => {
  it('uploads to the public bucket under <userId>/photos/ and returns its public URL', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    storageFrom.mockReturnValue({ upload });

    const url = await mediaUpload.uploadPhoto('user-1', 'file:///tmp/photo.jpg');

    expect(storageFrom).toHaveBeenCalledWith('public-media');
    const [path, , options] = upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/photos\/.+\.jpg$/);
    expect(options).toMatchObject({ contentType: 'image/jpeg', upsert: true });
    expect(url).toContain('user-1/photos/');
  });

  it('throws when the storage upload reports an error', async () => {
    const upload = jest.fn().mockResolvedValue({ error: { message: 'quota exceeded' } });
    storageFrom.mockReturnValue({ upload });

    await expect(mediaUpload.uploadPhoto('user-1', 'file:///tmp/photo.jpg')).rejects.toThrow('quota exceeded');
  });

  it('throws AppError when the local file does not exist', async () => {
    const { File } = jest.requireMock('expo-file-system');
    (File as jest.Mock).mockImplementationOnce(() => ({ exists: false }));

    await expect(mediaUpload.uploadPhoto('user-1', 'file:///tmp/missing.jpg')).rejects.toThrow(AppError);
  });
});

describe('mediaUpload.uploadCnicPhoto', () => {
  it('uploads to the verification bucket and returns the storage path, not a URL', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    storageFrom.mockReturnValue({ upload });

    const path = await mediaUpload.uploadCnicPhoto('user-1', 'file:///tmp/cnic.jpg');

    expect(storageFrom).toHaveBeenCalledWith('private-verification');
    expect(path).toMatch(/^user-1\/cnic\/.+\.jpg$/);
  });
});

describe('mediaUpload.verificationUrl', () => {
  it('returns undefined for a null path without touching storage', async () => {
    expect(await mediaUpload.verificationUrl(null)).toBeUndefined();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('returns the signed URL for a real path', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/a' } });
    storageFrom.mockReturnValue({ createSignedUrl });

    const url = await mediaUpload.verificationUrl('user-1/cnic/a.jpg');

    expect(createSignedUrl).toHaveBeenCalledWith('user-1/cnic/a.jpg', 60 * 60);
    expect(url).toBe('https://signed.example/a');
  });
});

describe('mediaUpload.removeFiles', () => {
  it('removes only the storage path parsed from a public-media URL', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    storageFrom.mockReturnValue({ remove });

    await mediaUpload.removeFiles([
      'https://project.supabase.co/storage/v1/object/public/public-media/user-1/photos/a.jpg',
    ]);

    expect(remove).toHaveBeenCalledWith(['user-1/photos/a.jpg']);
  });

  it('skips a URL it cannot parse a storage path from, without throwing', async () => {
    const remove = jest.fn();
    storageFrom.mockReturnValue({ remove });

    await expect(mediaUpload.removeFiles(['not-a-storage-url'])).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });

  it('swallows a storage error rather than breaking the caller', async () => {
    storageFrom.mockReturnValue({ remove: jest.fn().mockRejectedValue(new Error('network down')) });
    await expect(
      mediaUpload.removeFiles(['https://project.supabase.co/storage/v1/object/public/public-media/x.jpg'])
    ).resolves.toBeUndefined();
  });
});
