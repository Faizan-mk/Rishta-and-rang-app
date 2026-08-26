// ---------------------------------------------------------------------------
// TEMPORARY PLACEHOLDER — no remote storage is wired up yet.
//
// Firebase Cloud Storage needs the paid Blaze plan, and we haven't picked a
// free alternative yet. So that auth, profiles, discovery and chat can be built
// and tested in the meantime, every "upload" here just hands the local device
// URI straight back, and that URI is what gets written to Firestore.
//
// What this means while the placeholder is in place:
//   · Photos, intros and chat media only render on the device that picked them.
//     Another device (or a reinstall) sees a broken/blank image.
//   · Nothing is actually deleted when a photo is removed.
//   · CNIC/selfie images are NOT stored anywhere off-device.
//
// Everything that consumes media goes through this module and nothing else, so
// swapping in a real backend later means rewriting only this file — no changes
// to authService, matchesService, discoveryService or any screen.
// ---------------------------------------------------------------------------

// A local asset picked via expo-image-picker/expo-audio (file://, content://, ph://, ...).
// Anything else is treated as an already-uploaded remote URL.
export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

/** Placeholder: returns the local URI unchanged instead of uploading. */
async function passthrough(_userId: string, localUri: string): Promise<string> {
  return localUri;
}

/** Placeholder: returns the local URI unchanged instead of uploading. */
async function passthroughChat(_userId: string, _matchId: string, localUri: string): Promise<string> {
  return localUri;
}

/** Placeholder: paths and URLs are the same thing while media stays local. */
function publicUrl(path: string): string {
  return path;
}

/** Placeholder: verification media is never uploaded, so the path is the URI. */
async function verificationUrl(path: string): Promise<string | undefined> {
  return path || undefined;
}

/** Placeholder: nothing was uploaded, so there is nothing to delete. */
async function removeFiles(_urls: string[]): Promise<void> {
  // no-op
}

export const mediaUpload = {
  uploadPhoto: passthrough,
  uploadVideoIntro: passthrough,
  uploadVoiceIntro: passthrough,
  uploadCnicPhoto: passthrough,
  uploadSelfiePhoto: passthrough,
  uploadChatImage: passthroughChat,
  uploadChatAudio: passthroughChat,
  publicUrl,
  verificationUrl,
  removeFiles,
  isLocalUri,
};
