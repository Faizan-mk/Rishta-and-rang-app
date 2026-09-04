import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// ---------------------------------------------------------------------------
// A disk cache for remote photos.
//
// Profile photos are the heaviest thing this app downloads and the most often
// re-downloaded: the same faces come back on every deck refresh, in the match
// list, in the chat header and again on the profile detail. React Native keeps
// a memory cache per session and Android keeps a modest disk one, but neither
// survives a restart in any way we can rely on, and on a metered connection
// that is the difference between a deck that costs nothing to reopen and one
// that costs its weight in data every time.
//
// Deliberately small and boring: a file per URL, named by a hash of it, in the
// OS cache directory — the one the system is allowed to empty when it needs the
// space, which is exactly the right guarantee for photos that can be fetched
// again. No index, no eviction policy of our own, no expiry: a photo URL in
// this app is a Supabase storage path that does not change its contents.
// ---------------------------------------------------------------------------

const CACHE_DIR = 'photo-cache';

/**
 * A stable, filesystem-safe name for one URL.
 *
 * FNV-1a rather than anything cryptographic: this is a cache key, not a
 * security boundary, and it has to run on every photo of every card without
 * being noticed. Collisions would show the wrong photo, so the URL's length is
 * mixed in as a second dimension — two distinct URLs must collide in both.
 */
function keyFor(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const extension = /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url)?.[1] ?? 'img';
  return `${hash.toString(16)}-${url.length.toString(36)}.${extension.toLowerCase()}`;
}

/** Only remote http(s) images are worth caching — a local file already is one. */
function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function directory(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// One promise per URL while it downloads, so a screen rendering the same face
// in four places downloads it once rather than four times.
const inFlight = new Map<string, Promise<string | null>>();

/**
 * The local URI for a remote photo, downloading it on first sight.
 *
 * Returns null rather than throwing when anything goes wrong — a cache that
 * cannot write is a reason to fall back to the network, never a reason for a
 * card to fail to render. On web there is no filesystem to cache into and the
 * browser has its own, so it returns null immediately.
 */
export async function cachedImageUri(url: string): Promise<string | null> {
  if (Platform.OS === 'web' || !isRemote(url)) return null;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const task = (async () => {
    try {
      const target = new File(directory(), keyFor(url));
      if (target.exists) return target.uri;
      await File.downloadFileAsync(url, target, { idempotent: true });
      return target.exists ? target.uri : null;
    } catch {
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, task);
  return task;
}

/**
 * Pulls photos into the cache ahead of being shown.
 *
 * The Home deck already warmed the *next* card's photos through React Native's
 * `Image.prefetch`, which only fills the in-memory cache; this fills the disk
 * one, so the warm survives the app being closed.
 */
export function prefetchImages(urls: (string | undefined)[]): void {
  for (const url of urls) {
    if (url) void cachedImageUri(url);
  }
}

/** Empties the cache. Nothing calls it yet; the OS reclaims this directory itself. */
export function clearImageCache(): void {
  try {
    const dir = new Directory(Paths.cache, CACHE_DIR);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to do about it, and nothing depends on it having worked.
  }
}
