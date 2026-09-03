import { counterpartOf, mapChatMessageDoc, mapMatchRow } from '../matchesService';
import type { ChatMessageDoc, MatchRow } from '../matchesService';

// The mapping layer is where the paired-row schema meets the screens, and it is
// the part that changed shape most: a match row no longer says who is reading
// it, and a message no longer stores which side it came from. Both are worked
// out here, per reader — so both are worth pinning down.

// Deliberately ordered: `matches` stores the pair ascending, and several of the
// behaviours below only make sense against that.
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

function matchRow(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'match-1',
    user_a: ALICE,
    user_b: BOB,
    mode: 'dating',
    created_at: '2026-01-01T00:00:00.000Z',
    rishta_requested_by: null,
    rishta_requested_at: null,
    ...overrides,
  };
}

describe('counterpartOf', () => {
  it('returns the other person, from either side of the pair', () => {
    const row = matchRow();
    expect(counterpartOf(row, ALICE)).toBe(BOB);
    expect(counterpartOf(row, BOB)).toBe(ALICE);
  });
});

describe('mapMatchRow', () => {
  it('gives both members the same match id', () => {
    const row = matchRow();
    expect(mapMatchRow(row, ALICE).id).toBe(mapMatchRow(row, BOB).id);
  });

  it('points each member at the other as the source profile', () => {
    const row = matchRow();
    expect(mapMatchRow(row, ALICE).sourceProfileId).toBe(BOB);
    expect(mapMatchRow(row, BOB).sourceProfileId).toBe(ALICE);
  });

  it('takes the counterpart card when one is supplied', () => {
    const match = mapMatchRow(matchRow(), ALICE, { name: 'Bob', photo: 'bob.jpg' });
    expect(match.name).toBe('Bob');
    expect(match.photo).toBe('bob.jpg');
  });

  it('falls back to empty strings when the profile is unreadable', () => {
    // Hidden, or blocked since. The thread still lists rather than crashing.
    const match = mapMatchRow(matchRow(), ALICE);
    expect(match.name).toBe('');
    expect(match.photo).toBe('');
  });

  it('reads the crossing-over off the shared mode, for both sides', () => {
    const row = matchRow({ mode: 'rishta' });
    expect(mapMatchRow(row, ALICE).movedToRishta).toBe(true);
    expect(mapMatchRow(row, BOB).movedToRishta).toBe(true);
  });

  describe('a pending rishta request', () => {
    const row = matchRow({ rishta_requested_by: ALICE, rishta_requested_at: '2026-01-02T00:00:00.000Z' });

    it('reads as waiting for the member who asked', () => {
      const forAlice = mapMatchRow(row, ALICE);
      expect(forAlice.rishtaRequestPending).toBe(true);
      expect(forAlice.rishtaRequestIncoming).toBe(false);
    });

    it('reads as something to answer for the other member', () => {
      const forBob = mapMatchRow(row, BOB);
      expect(forBob.rishtaRequestPending).toBe(false);
      expect(forBob.rishtaRequestIncoming).toBe(true);
    });

    it('is neither when nothing is pending', () => {
      const forAlice = mapMatchRow(matchRow(), ALICE);
      expect(forAlice.rishtaRequestPending).toBe(false);
      expect(forAlice.rishtaRequestIncoming).toBe(false);
    });
  });

  it('sorts by when the match formed until the thread supplies a preview', () => {
    const match = mapMatchRow(matchRow(), ALICE);
    expect(match.lastMessage).toBe('');
    expect(match.lastMessageAt).toBe('2026-01-01T00:00:00.000Z');
    // Per-side state has no column on the shared row; the caller folds it in.
    expect(match.unread).toBe(false);
  });
});

describe('mapChatMessageDoc', () => {
  function messageDoc(senderId: string): ChatMessageDoc {
    return {
      id: 'message-1',
      matchId: 'match-1',
      senderId,
      text: 'hello',
      kind: 'text',
      audioUrl: null,
      durationSec: null,
      imageUrl: null,
      sentAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('is from me when I sent it', () => {
    expect(mapChatMessageDoc('message-1', messageDoc(ALICE), ALICE).fromMe).toBe(true);
  });

  it('is not from me when the other person sent it', () => {
    expect(mapChatMessageDoc('message-1', messageDoc(BOB), ALICE).fromMe).toBe(false);
  });

  it('reads the same row oppositely for the two members', () => {
    const doc = messageDoc(ALICE);
    expect(mapChatMessageDoc('message-1', doc, ALICE).fromMe).toBe(true);
    expect(mapChatMessageDoc('message-1', doc, BOB).fromMe).toBe(false);
  });

  it('turns absent media columns into undefined rather than null', () => {
    const message = mapChatMessageDoc('message-1', messageDoc(ALICE), ALICE);
    expect(message.audioUri).toBeUndefined();
    expect(message.imageUri).toBeUndefined();
    expect(message.durationSec).toBeUndefined();
  });

  it('carries voice and image messages through', () => {
    const voice = mapChatMessageDoc(
      'message-2',
      { ...messageDoc(BOB), kind: 'voice', audioUrl: 'https://media/a.m4a', durationSec: 7 },
      ALICE
    );
    expect(voice.audioUri).toBe('https://media/a.m4a');
    expect(voice.durationSec).toBe(7);

    const image = mapChatMessageDoc(
      'message-3',
      { ...messageDoc(BOB), kind: 'image', imageUrl: 'https://media/a.jpg' },
      ALICE
    );
    expect(image.imageUri).toBe('https://media/a.jpg');
  });
});
