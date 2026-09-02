import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { PUBLIC_BUCKET, VERIFICATION_BUCKET, publicMediaUrl, supabase } from './supabase';
import { AppError } from '../utils/appError';

export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

function contentTypeFor(uri: string): string {
  if (/\.(mp4|mov|m4v)$/i.test(uri)) return 'video/mp4';
  if (/\.(m4a|aac|mp3|wav)$/i.test(uri)) return 'audio/m4a';
  return 'image/jpeg';
}

function fileName(uri: string): string {
  const extension = uri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ?? 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
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

async function upload(localUri: string, bucket: string, path: string): Promise<void> {
  const body = await readLocalFile(localUri);
  const contentType = (body instanceof Blob && body.type) || contentTypeFor(localUri);
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

async function uploadPublic(userId: string, localUri: string, folder: string): Promise<string> {
  const path = `${userId}/${folder}/${fileName(localUri)}`;
  await upload(localUri, PUBLIC_BUCKET, path);
  return publicMediaUrl(path);
}

async function uploadVerification(userId: string, localUri: string, folder: string): Promise<string> {
  const path = `${userId}/${folder}/${fileName(localUri)}`;
  await upload(localUri, VERIFICATION_BUCKET, path);
  return path;
}

/** The fragment of a public-media URL that maps back to a storage path. */
const PUBLIC_URL_MARKER = '/storage/v1/object/public/public-media/';

function storagePathFromPublicUrl(url: string): string | null {
  const index = url.indexOf(PUBLIC_URL_MARKER);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + PUBLIC_URL_MARKER.length));
}

async function removeFile(url: string): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  try {
    await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
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
  uploadVoiceIntro: (userId: string, uri: string) => uploadPublic(userId, uri, 'voice'),
  uploadCnicPhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'cnic'),
  uploadSelfiePhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'selfie'),
  uploadChatImage: (userId: string, matchId: string, uri: string) =>
    uploadPublic(userId, uri, `chat/${matchId}`),
  uploadChatAudio: (userId: string, matchId: string, uri: string) =>
    uploadPublic(userId, uri, `chat/${matchId}`),
  publicUrl: publicMediaUrl,
  verificationUrl,
  removeFiles: async (urls: string[]) => {
    await Promise.all(urls.filter(Boolean).map(removeFile));
  },
  isLocalUri,
};
