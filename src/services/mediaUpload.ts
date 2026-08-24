import { supabase } from './supabase';

const PUBLIC_BUCKET = 'public-media';
const VERIFICATION_BUCKET = 'private-verification';

// A local asset picked via expo-image-picker/expo-audio (file://, content://, ph://, ...).
// Anything else is treated as an already-uploaded remote URL.
export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

function extFromUri(uri: string, fallback: string): string {
  const match = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

async function uploadToBucket(bucket: string, path: string, localUri: string, contentType: string): Promise<void> {
  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, arraybuffer, { contentType, upsert: true });
  if (error) throw error;
}

async function uploadPhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/photos/${Date.now()}_${Math.floor(Math.random() * 1e6)}.${extFromUri(localUri, 'jpg')}`;
  await uploadToBucket(PUBLIC_BUCKET, path, localUri, 'image/jpeg');
  return path;
}

async function uploadVideoIntro(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/video-intro/${Date.now()}.${extFromUri(localUri, 'mp4')}`;
  await uploadToBucket(PUBLIC_BUCKET, path, localUri, 'video/mp4');
  return path;
}

async function uploadVoiceIntro(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/voice-intro/${Date.now()}.${extFromUri(localUri, 'm4a')}`;
  await uploadToBucket(PUBLIC_BUCKET, path, localUri, 'audio/m4a');
  return path;
}

async function uploadCnicPhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/cnic.${extFromUri(localUri, 'jpg')}`;
  await uploadToBucket(VERIFICATION_BUCKET, path, localUri, 'image/jpeg');
  return path;
}

async function uploadSelfiePhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/selfie.${extFromUri(localUri, 'jpg')}`;
  await uploadToBucket(VERIFICATION_BUCKET, path, localUri, 'image/jpeg');
  return path;
}

async function uploadChatImage(userId: string, matchId: string, localUri: string): Promise<string> {
  const path = `${userId}/chat/${matchId}/${Date.now()}_${Math.floor(Math.random() * 1e6)}.${extFromUri(localUri, 'jpg')}`;
  await uploadToBucket(PUBLIC_BUCKET, path, localUri, 'image/jpeg');
  return path;
}

async function uploadChatAudio(userId: string, matchId: string, localUri: string): Promise<string> {
  const path = `${userId}/chat/${matchId}/${Date.now()}_${Math.floor(Math.random() * 1e6)}.${extFromUri(localUri, 'm4a')}`;
  await uploadToBucket(PUBLIC_BUCKET, path, localUri, 'audio/m4a');
  return path;
}

function publicUrl(path: string): string {
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Public-media paths are exposed to the app as full public URLs. When a
// profile is re-saved with an unchanged photo, we need the storage path back
// to avoid re-uploading — this reverses publicUrl().
function pathFromPublicUrl(url: string): string {
  const marker = `/object/public/${PUBLIC_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) throw new Error(`Not a ${PUBLIC_BUCKET} public URL: ${url}`);
  return url.slice(index + marker.length);
}

async function signedVerificationUrl(path: string, expiresInSec = 60 * 60 * 24): Promise<string> {
  const { data, error } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

async function removePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabase.storage.from(PUBLIC_BUCKET).remove(paths);
}

export const mediaUpload = {
  uploadPhoto,
  uploadVideoIntro,
  uploadVoiceIntro,
  uploadCnicPhoto,
  uploadSelfiePhoto,
  uploadChatImage,
  uploadChatAudio,
  publicUrl,
  pathFromPublicUrl,
  signedVerificationUrl,
  removePhotos,
  isLocalUri,
};
