import { Platform } from 'react-native';
import { cachedImageUri, prefetchImages, clearImageCache } from '../imageCache';

// expo-file-system's Directory/File are native classes with getter-style `exists`
// flags; this mock tracks that state in one place so each test can flip it
// without reaching into constructor internals. Names are prefixed `mock` so
// Jest allows them inside the hoisted jest.mock() factory below.
const mockState = { directoryExists: false, fileExists: false };
const mockDirectoryDelete = jest.fn();
const mockDownloadFileAsync = jest.fn(async () => {
  mockState.fileExists = true;
});

jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(() => ({
    get exists() {
      return mockState.fileExists;
    },
    uri: 'file:///cache/mock-file.jpg',
  }));
  (File as unknown as { downloadFileAsync: (...args: unknown[]) => Promise<void> }).downloadFileAsync = (
    ...args: unknown[]
  ) => mockDownloadFileAsync(...(args as Parameters<typeof mockDownloadFileAsync>));

  const Directory = jest.fn().mockImplementation(() => ({
    get exists() {
      return mockState.directoryExists;
    },
    create: jest.fn(),
    delete: mockDirectoryDelete,
  }));

  return { File, Directory, Paths: { cache: 'mock-cache-dir' } };
});

beforeEach(() => {
  mockState.directoryExists = false;
  mockState.fileExists = false;
  mockDirectoryDelete.mockClear();
  mockDownloadFileAsync.mockClear();
});

describe('cachedImageUri', () => {
  it('returns null on web (no filesystem to cache into)', async () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    expect(await cachedImageUri('https://cdn.example.com/a.jpg')).toBeNull();
    (Platform as { OS: string }).OS = original;
  });

  it('returns null for a non-remote (already-local) uri', async () => {
    expect(await cachedImageUri('file:///local/a.jpg')).toBeNull();
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it('downloads and returns the cached file uri for a remote image on first sight', async () => {
    const uri = await cachedImageUri('https://cdn.example.com/photos/a.jpg');
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
    expect(uri).toBe('file:///cache/mock-file.jpg');
  });

  it('does not re-download a file already on disk', async () => {
    mockState.fileExists = true;
    const uri = await cachedImageUri('https://cdn.example.com/photos/cached.jpg');
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
    expect(uri).toBe('file:///cache/mock-file.jpg');
  });

  it('returns null rather than throwing when the download fails', async () => {
    mockDownloadFileAsync.mockRejectedValueOnce(new Error('network error'));
    const uri = await cachedImageUri('https://cdn.example.com/photos/fails.jpg');
    expect(uri).toBeNull();
  });

  it('returns null when the download resolves but the file still is not there', async () => {
    mockDownloadFileAsync.mockImplementationOnce(async () => {
      // mockState.fileExists deliberately left false
    });
    const uri = await cachedImageUri('https://cdn.example.com/photos/ghost.jpg');
    expect(uri).toBeNull();
  });

  it('dedupes concurrent requests for the same url into one download', async () => {
    const url = 'https://cdn.example.com/photos/concurrent.jpg';
    let resolveDownload!: () => void;
    mockDownloadFileAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = () => {
            mockState.fileExists = true;
            resolve();
          };
        })
    );

    const first = cachedImageUri(url);
    const second = cachedImageUri(url);
    resolveDownload();
    await Promise.all([first, second]);

    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
  });
});

describe('prefetchImages', () => {
  it('kicks off caching for every defined url and ignores undefined entries', () => {
    expect(() =>
      prefetchImages(['https://cdn.example.com/a.jpg', undefined, 'https://cdn.example.com/b.jpg'])
    ).not.toThrow();
  });
});

describe('clearImageCache', () => {
  it('deletes the cache directory when it exists', () => {
    mockState.directoryExists = true;
    clearImageCache();
    expect(mockDirectoryDelete).toHaveBeenCalled();
  });

  it('does nothing when the directory does not exist', () => {
    mockState.directoryExists = false;
    clearImageCache();
    expect(mockDirectoryDelete).not.toHaveBeenCalled();
  });

  it('never throws even if deleting fails', () => {
    mockState.directoryExists = true;
    mockDirectoryDelete.mockImplementationOnce(() => {
      throw new Error('fs error');
    });
    expect(() => clearImageCache()).not.toThrow();
  });
});
