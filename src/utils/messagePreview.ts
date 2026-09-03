import type { Translate } from '../i18n';
import type { ChatMessage } from '../types/content';

/**
 * Photo and voice messages have no text of their own, so the match list shows a
 * stand-in line instead. The line is a fixed marker rather than finished copy,
 * because it outlives the language it was written under — it is cached across
 * launches and rebuilt from the thread, and the reader may not be reading in
 * the language the sender wrote in.
 *
 * `previewLabel` is what turns a marker back into the reader's language, at
 * render time — so switching to Urdu re-labels history that was written in
 * English, and vice versa.
 *
 * (These were once persisted in `matches.last_message`. That column is gone:
 * the match row is shared by both people since supabase/24_matching.sql, and a
 * preview on it would be one member's state in the other's hands.)
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
