import { supabase } from '../supabase';
import { reactionsService, rowToReaction } from '../reactionsService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('rowToReaction', () => {
  it('maps a realtime row (snake_case) into a MessageReaction', () => {
    const reaction = rowToReaction({
      id: 'r1',
      message_id: 'm1',
      user_id: 'u1',
      emoji: '❤️',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(reaction).toEqual({
      id: 'r1',
      messageId: 'm1',
      userId: 'u1',
      emoji: '❤️',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('stringifies non-string ids', () => {
    const reaction = rowToReaction({ id: 1, message_id: 2, user_id: 3, emoji: '😍' });
    expect(reaction.id).toBe('1');
    expect(reaction.messageId).toBe('2');
    expect(reaction.userId).toBe('3');
  });
});

describe('reactionsService.fetchReactions', () => {
  it('groups reactions by messageId', async () => {
    from.mockReturnValue(
      chain(
        ok([
          { id: 'r1', messageId: 'm1', userId: 'u1', emoji: '❤️', createdAt: '2026-01-01' },
          { id: 'r2', messageId: 'm1', userId: 'u2', emoji: '😂', createdAt: '2026-01-02' },
          { id: 'r3', messageId: 'm2', userId: 'u1', emoji: '👍', createdAt: '2026-01-03' },
        ])
      )
    );

    const byMessage = await reactionsService.fetchReactions();

    expect(Object.keys(byMessage).sort()).toEqual(['m1', 'm2']);
    expect(byMessage.m1).toHaveLength(2);
    expect(byMessage.m2).toHaveLength(1);
    expect(byMessage.m1[0].emoji).toBe('❤️');
  });

  it('returns an empty object when there is nothing to fetch', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await reactionsService.fetchReactions()).toEqual({});
  });

  it('throws when the query errors', async () => {
    from.mockReturnValue(chain(fail('boom')));
    await expect(reactionsService.fetchReactions()).rejects.toThrow('boom');
  });
});

describe('reactionsService.addReaction', () => {
  it('inserts and returns the saved row, id included', async () => {
    const builder = chain(ok({ id: 'r9', messageId: 'm1', userId: 'u1', emoji: '🙏', createdAt: '2026-01-01' }));
    from.mockReturnValue(builder);

    const reaction = await reactionsService.addReaction('u1', 'm1', '🙏');

    expect(builder.insert).toHaveBeenCalledWith({ message_id: 'm1', user_id: 'u1', emoji: '🙏' });
    expect(reaction.id).toBe('r9');
  });

  it('throws on insert error', async () => {
    from.mockReturnValue(chain(fail('duplicate')));
    await expect(reactionsService.addReaction('u1', 'm1', '🙏')).rejects.toThrow('duplicate');
  });
});

describe('reactionsService.removeReaction', () => {
  it('deletes by message, user and emoji', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await reactionsService.removeReaction('u1', 'm1', '🙏');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('message_id', 'm1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('emoji', '🙏');
  });

  it('throws on delete error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(reactionsService.removeReaction('u1', 'm1', '🙏')).rejects.toThrow('nope');
  });
});
