import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { PUBLIC_BUCKET, VERIFICATION_BUCKET, VOICE_BUCKET, publicMediaUrl, supabase, voiceMediaUrl } from './supabase';
import { AppError } from '../utils/appError';

export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

// The extension a content type implies, for the handful of formats this app
// actually stores. Used to name the object so the URL a member's browser or
// phone later fetches is self-describing.
const EXTENSION_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/**
 * What to tell storage this file is.
 *
 * A caller that already knows — `expo-image-picker` hands back the asset's
 * real `mimeType` — gets that honoured verbatim. Only when nobody knows do we
 * fall back to sniffing the extension, and the last-resort `image/jpeg` is a
 * guess that has cost this app real bugs: a picker that returned a PNG (or a
 * content:// URI with no extension at all) was being uploaded byte-for-byte
 * as PNG while Supabase stored and served it as `image/jpeg`. Browsers sniff
 * past that, but Fresco on Android trusts the declared type, fails to decode,
 * and the photo rendered as nothing. Declaring what the file actually is is
 * the whole fix.
 */
function contentTypeFor(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  if (/\.(mp4|mov|m4v)$/i.test(uri)) return 'video/mp4';
  if (/\.(m4a|aac|mp3|wav)$/i.test(uri)) return 'audio/m4a';
  if (/\.png$/i.test(uri)) return 'image/png';
  if (/\.webp$/i.test(uri)) return 'image/webp';
  if (/\.(heic|heif)$/i.test(uri)) return 'image/heic';
  return 'image/jpeg';
}

function fileName(uri: string, mimeType?: string | null): string {
  // Prefer an extension the URI actually carries; a `content://` URI from
  // Android's picker has none, so fall back to the one the content type
  // implies rather than blindly stamping `.jpg` on every file.
  const fromUri = uri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1];
  const fromMime = mimeType ? EXTENSION_FOR_MIME[mimeType.toLowerCase()] : undefined;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${fromUri ?? fromMime ?? 'jpg'}`;
}

/**
 * Bytes of a picked file, ready to hand to storage.
 *
 * React Native has no usable `fetch('file://…')` — it rejects with a bare
 * "Network request failed", which is what every upload here used to die on —
 * and supabase-js documents that Blob/File/FormData bodies don't upload
 * correctly on native either. Reading the file through expo-file-system and
 * sending the raw bytes is the supported path on device; on web the picker
 * hands back blob:/data: URIs that only `fetch` can resolve, so that branch
 * keeps the old route.
 */
async function readLocalFile(localUri: string): Promise<Uint8Array | Blob> {
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    if (!response.ok) throw new AppError('media.fileUnavailable');
    return response.blob();
  }

  const file = new File(localUri);
  if (!file.exists) throw new AppError('media.fileUnavailable');
  return file.bytes();
}

// Mirrors the bucket caps in supabase/51_storage_upload_limits.sql, so an
// oversized file gets a sentence the member can act on instead of a storage
// rejection. The bucket setting is what actually enforces it.
const MAX_UPLOAD_BYTES: Record<string, number> = {
  [PUBLIC_BUCKET]: 50 * 1024 * 1024,
  [VERIFICATION_BUCKET]: 10 * 1024 * 1024,
  [VOICE_BUCKET]: 10 * 1024 * 1024,
};

async function upload(localUri: string, bucket: string, path: string, mimeType?: string | null): Promise<void> {
  const body = await readLocalFile(localUri);
  const size = body instanceof Blob ? body.size : body.byteLength;
  const maxBytes = MAX_UPLOAD_BYTES[bucket];
  if (maxBytes && size > maxBytes) {
    throw new AppError('media.fileTooLarge', { mb: Math.round(maxBytes / (1024 * 1024)) });
  }
  const contentType = (body instanceof Blob && body.type) || contentTypeFor(localUri, mimeType);
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

async function uploadPublic(
  userId: string,
  localUri: string,
  folder: string,
  mimeType?: string | null
): Promise<string> {
  const path = `${userId}/${folder}/${fileName(localUri, mimeType)}`;
  await upload(localUri, PUBLIC_BUCKET, path, mimeType);
  return publicMediaUrl(path);
}

// Voice goes to its own bucket, which takes audio only and caps a file at
// 10 MB — public-media no longer accepts audio (supabase/54_voice_limits.sql).
async function uploadVoice(
  userId: string,
  localUri: string,
  folder: string,
  mimeType?: string | null
): Promise<string> {
  const path = `${userId}/${folder}/${fileName(localUri, mimeType)}`;
  await upload(localUri, VOICE_BUCKET, path, mimeType);
  return voiceMediaUrl(path);
}

async function uploadVerification(userId: string, localUri: string, folder: string): Promise<string> {
  const path = `${userId}/${folder}/${fileName(localUri)}`;
  await upload(localUri, VERIFICATION_BUCKET, path);
  return path;
}

/** Maps a public URL back to its bucket and storage path. */
function storageLocationFromPublicUrl(url: string): { bucket: string; path: string } | null {
  for (const bucket of [PUBLIC_BUCKET, VOICE_BUCKET]) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index !== -1) return { bucket, path: decodeURIComponent(url.slice(index + marker.length)) };
  }
  return null;
}

async function removeFile(url: string): Promise<void> {
  const location = storageLocationFromPublicUrl(url);
  if (!location) return;
  try {
    await supabase.storage.from(location.bucket).remove([location.path]);
  } catch {
    // Best-effort: a failed delete must never break the surrounding flow.
  }
}

/**
 * Signed URL for a private-verification path. The bucket is owner-only read,
 * and the app only ever resolves its own CNIC/selfie paths this way.
 */
async function verificationUrl(path: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? undefined;
}

export const mediaUpload = {
  uploadPhoto: (userId: string, uri: string) => uploadPublic(userId, uri, 'photos'),
  uploadVideoIntro: (userId: string, uri: string) => uploadPublic(userId, uri, 'video'),
  uploadVoiceIntro: (userId: string, uri: string) => uploadVoice(userId, uri, 'voice'),
  uploadCnicPhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'cnic'),
  uploadSelfiePhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'selfie'),
  uploadChatImage: (userId: string, matchId: string, uri: string, mimeType?: string | null) =>
    uploadPublic(userId, uri, `chat/${matchId}`, mimeType),
  uploadChatAudio: (userId: string, matchId: string, uri: string, mimeType?: string | null) =>
    uploadVoice(userId, uri, `chat/${matchId}`, mimeType),
  uploadStoryMedia: (userId: string, uri: string, mimeType?: string | null) =>
    uploadPublic(userId, uri, 'stories', mimeType),
  publicUrl: publicMediaUrl,
  verificationUrl,
  removeFiles: async (urls: string[]) => {
    await Promise.all(urls.filter(Boolean).map(removeFile));
  },
  /** CNIC / selfie paths in the private bucket. Best-effort, like removeFiles. */
  removeVerificationFiles: async (paths: string[]) => {
    const keep = paths.filter(Boolean);
    if (!keep.length) return;
    try {
      await supabase.storage.from(VERIFICATION_BUCKET).remove(keep);
    } catch {
      // A failed delete must never block the account deletion around it.
    }
  },
  isLocalUri,
};
