import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';

// NOTE: This is a coarse, honest heuristic — NOT identity verification, NOT OCR.
// It only checks whether an uploaded photo's color profile and aspect ratio
// plausibly resemble a Pakistani CNIC (green/white ID-1 card), to catch obviously
// wrong uploads (screenshots, random photos, blank/blurry shots). It cannot and
// does not confirm the card is genuine, unexpired, or belongs to the uploader.

const SAMPLE_WIDTH = 48;
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Standard ID-1 card ratio (85.60mm x 53.98mm) — used to pre-crop the photo so
// it actually matches the shape this check expects, instead of guessing at the
// aspect of a raw, uncropped camera photo.
export const CNIC_ASPECT = 1.586;

export type IdCardCheckReason = 'tooSmall' | 'wrongShape' | 'notCardColored';

export interface IdCardCheckResult {
  looksValid: boolean;
  reason?: IdCardCheckReason;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = BASE64_CHARS.indexOf(clean[i]);
    const e2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const e3 = BASE64_CHARS.indexOf(clean[i + 2]);
    const e4 = BASE64_CHARS.indexOf(clean[i + 3]);
    bytes.push((e1 << 2) | (e2 >> 4));
    if (e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== -1) bytes.push(((e3 & 3) << 6) | e4);
  }
  return Uint8Array.from(bytes);
}

export async function analyzeIdCardPhoto(uri: string): Promise<IdCardCheckResult> {
  const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: SAMPLE_WIDTH } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!resized.base64 || !resized.width || !resized.height) {
    return { looksValid: false, reason: 'tooSmall' };
  }

  // Pakistani CNIC is a standard ID-1 card (~1.586:1). Compare the long side to the
  // short side rather than width/height directly — the camera (unlike the old
  // gallery picker) is just as likely to hand back a portrait-oriented photo of a
  // landscape card, and that's still a valid shot.
  const aspect = Math.max(resized.width, resized.height) / Math.min(resized.width, resized.height);
  if (aspect < 1.2 || aspect > 2.2) {
    return { looksValid: false, reason: 'wrongShape' };
  }

  const { data, width, height } = jpeg.decode(base64ToUint8Array(resized.base64), { useTArray: true });
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return { looksValid: false, reason: 'tooSmall' };
  }

  let greenish = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // The CNIC's dominant background tone is a muted green.
    if (g > r + 5 && g > b + 5 && g > 45 && g < 235) greenish++;
    // CNIC cards carry large white text panels.
    if (r > 150 && g > 150 && b > 150) light++;
  }

  const greenRatio = greenish / totalPixels;
  const lightRatio = light / totalPixels;

  // A Pakistani CNIC's layout is specifically a green background band *plus*
  // white text panels — either one alone (all-white driving licence/student
  // card, or a plain green surface) isn't enough to tell it apart from other
  // ID-1 cards, so both signals are required together.
  if (greenRatio < 0.05 || lightRatio < 0.05) {
    return { looksValid: false, reason: 'notCardColored' };
  }

  return { looksValid: true };
}
