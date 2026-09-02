import type { Translate } from '../i18n';
import type { ChatMessage } from '../types/content';

/**
 * Photo and voice messages have no text of their own, so the match list shows a
 * stand-in line instead. That line is persisted (`matches.last_message`), which
 * is why it is stored as these fixed markers rather than as finished copy: the
 * row outlives the language it was written under, and rows already in the
 * database were written with exactly these two strings.
 *
 * `previewLabel` is what turns a marker back into the reader's language, at
 * render time — so switching to Urdu re-labels history that was written in
 * English, and vice versa.
 */
export const PHOTO_PREVIEW = '📷 Photo';
export const VOICE_PREVIEW = '🎤 Voice message';

export function previewFor(message: ChatMessage): string {
  if (message.kind === 'image') return PHOTO_PREVIEW;
  if (message.kind === 'voice') return VOICE_PREVIEW;
  return message.text;
}

/** The stored preview, in the language that is live right now. */
export function previewLabel(stored: string, t: Translate): string {
  if (stored === PHOTO_PREVIEW) return `📷 ${t('matches.previewPhoto')}`;
  if (stored === VOICE_PREVIEW) return `🎤 ${t('matches.previewVoice')}`;
  return stored;
}
