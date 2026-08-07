import { Dimensions, Platform } from 'react-native';

// Design baseline: a standard 375pt-wide phone (iPhone-class device).
const BASE_WIDTH = 375;
// On web, ResponsiveFrame caps the visible app at this width once the browser
// is wider than a phone, so scale against that instead of the raw (huge) window.
const WEB_MAX_REFERENCE_WIDTH = 480;
// Keep scaling sane on outliers (small foldables, large tablets) instead of
// letting text balloon or shrink without bound.
const MIN_SCALE = 0.85;
const MAX_SCALE = 2.2;

function referenceWidth(): number {
  const { width } = Dimensions.get('window');
  return Platform.OS === 'web' ? Math.min(width, WEB_MAX_REFERENCE_WIDTH) : width;
}

// Computed once at launch: this app is portrait-locked (see app.json), so device
// width doesn't change mid-session on native. On web the value is re-evaluated
// per reload, matching ResponsiveFrame's own fixed-width behavior within a session.
const rawScale = referenceWidth() / BASE_WIDTH;
const deviceScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

// Dampened scaling: only `factor` of the raw device-scale delta is applied, so a
// tablet (scale ~2x) grows text/spacing noticeably without doubling it, and a
// small phone (scale ~0.85x) only shrinks slightly, staying legible.
function moderateScale(size: number, factor: number): number {
  return size + (deviceScale - 1) * size * factor;
}

export function scaleFont(size: number): number {
  return Math.round(moderateScale(size, 0.3));
}

export function scaleSpace(size: number): number {
  return Math.round(moderateScale(size, 0.4));
}
