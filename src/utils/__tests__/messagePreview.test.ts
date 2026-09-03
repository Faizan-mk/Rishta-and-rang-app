import { PHOTO_PREVIEW, VOICE_PREVIEW, previewFor, previewLabel } from '../messagePreview';
import type { ChatMessage } from '../../types/content';

// Previews are markers rather than finished copy, so that a thread written in
// English still reads in Urdu when the member switches. These two functions are
// the two halves of that: one stores, the other renders.

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    matchId: 'match-1',
    fromMe: true,
    text: 'hello',
    kind: 'text',
    sentAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('previewFor', () => {
  it('uses the text of a text message', () => {
    expect(previewFor(message({ text: 'salaam' }))).toBe('salaam');
  });

  it('stands in for media, which has no text of its own', () => {
    expect(previewFor(message({ kind: 'image', text: '' }))).toBe(PHOTO_PREVIEW);
    expect(previewFor(message({ kind: 'voice', text: '' }))).toBe(VOICE_PREVIEW);
  });
});

describe('previewLabel', () => {
  const t = ((key: string) => (key === 'matches.previewPhoto' ? 'Tasveer' : 'Voice note')) as never;

  it('renders a stored marker in the language that is live now', () => {
    expect(previewLabel(PHOTO_PREVIEW, t)).toBe('📷 Tasveer');
    expect(previewLabel(VOICE_PREVIEW, t)).toBe('🎤 Voice note');
  });

  it('leaves a real message alone', () => {
    expect(previewLabel('salaam', t)).toBe('salaam');
  });
});
