import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

function contentTypeFor(uri: string): string {
  if (/\.(mp4|mov|m4v)$/i.test(uri)) return 'video/mp4';
  if (/\.(m4a|aac|mp3|wav)$/i.test(uri)) return 'audio/m4a';
  return 'image/jpeg';
}

async function upload(localUri: string, path: string): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error(`Could not read selected media (${response.status})`);
  const blob = await response.blob();
  const contentType = blob.type || contentTypeFor(localUri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

function fileName(uri: string): string {
  const extension = uri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ?? 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

async function uploadPublic(userId: string, localUri: string, folder: string): Promise<string> {
  return upload(localUri, `public/${userId}/${folder}/${fileName(localUri)}`);
}

async function uploadVerification(userId: string, localUri: string, folder: string): Promise<string> {
  return upload(localUri, `verification/${userId}/${folder}/${fileName(localUri)}`);
}

export const mediaUpload = {
  uploadPhoto: (userId: string, uri: string) => uploadPublic(userId, uri, 'photos'),
  uploadVideoIntro: (userId: string, uri: string) => uploadPublic(userId, uri, 'video'),
  uploadVoiceIntro: (userId: string, uri: string) => uploadPublic(userId, uri, 'voice'),
  uploadCnicPhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'cnic'),
  uploadSelfiePhoto: (userId: string, uri: string) => uploadVerification(userId, uri, 'selfie'),
  uploadChatImage: (userId: string, matchId: string, uri: string) => upload(uri, `public/${userId}/chat/${matchId}/${fileName(uri)}`),
  uploadChatAudio: (userId: string, matchId: string, uri: string) => upload(uri, `public/${userId}/chat/${matchId}/${fileName(uri)}`),
  publicUrl: (path: string) => path,
  verificationUrl: async (path: string) => path || undefined,
  removeFiles: async (_urls: string[]) => undefined,
  isLocalUri,
};
