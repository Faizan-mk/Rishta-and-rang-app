import { supabase } from '../supabase';
import { likesService } from '../likesService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
});

describe('likesService.fetchLikesReceived', () => {
  it('maps liker_id to id and created_at to likedAt', async () => {
    from.mockReturnValue(
      chain(
        ok([{ liker_id: 'u2', kind: 'dating', name: 'Bilal', age: 29, city: 'Karachi', photo: 'b.jpg', created_at: '2026-01-01' }])
      )
    );
    const likes = await likesService.fetchLikesReceived('u1');
    expect(likes).toEqual([
      { id: 'u2', kind: 'dating', name: 'Bilal', age: 29, city: 'Karachi', photo: 'b.jpg', likedAt: '2026-01-01' },
    ]);
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(likesService.fetchLikesReceived('u1')).rejects.toThrow('denied');
  });
});

describe('likesService.likeProfile', () => {
  it('reads the single-row RPC response into a LikeOutcome', async () => {
    rpc.mockResolvedValue({
      data: [{ matched: true, match_id: 'match-1', is_new: true, likes_left: 4 }],
      error: null,
    });

    const outcome = await likesService.likeProfile('u2', 'dating');

    expect(rpc).toHaveBeenCalledWith('like_profile', { p_target: 'u2', p_mode: 'dating' });
    expect(outcome).toEqual({ matched: true, matchId: 'match-1', isNew: true, likesLeft: 4 });
  });

  it('handles a plain object response, not just an array', async () => {
    rpc.mockResolvedValue({ data: { matched: false, match_id: null, is_new: false, likes_left: 2 }, error: null });
    const outcome = await likesService.likeProfile('u2', 'rishta');
    expect(outcome).toEqual({ matched: false, matchId: null, isNew: false, likesLeft: 2 });
  });

  it('defaults an empty/undefined response to no match and unlimited likes', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const outcome = await likesService.likeProfile('u2', 'dating');
    expect(outcome).toEqual({ matched: false, matchId: null, isNew: false, likesLeft: -1 });
  });

  it('throws with the server message when the RPC reports a limit error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'daily_like_limit_reached' } });
    await expect(likesService.likeProfile('u2', 'dating')).rejects.toThrow('daily_like_limit_reached');
  });
});

describe('likesService.withdrawLike', () => {
  it('deletes from both likes and likes_received', async () => {
    const likesBuilder = chain(ok(null));
    const receivedBuilder = chain(ok(null));
    from.mockImplementation((table: string) => (table === 'likes' ? likesBuilder : receivedBuilder));

    await likesService.withdrawLike('target-1', 'liker-1');

    expect(likesBuilder.eq).toHaveBeenCalledWith('liker_id', 'liker-1');
    expect(likesBuilder.eq).toHaveBeenCalledWith('target_id', 'target-1');
    expect(receivedBuilder.eq).toHaveBeenCalledWith('profile_id', 'target-1');
    expect(receivedBuilder.eq).toHaveBeenCalledWith('liker_id', 'liker-1');
  });

  it('throws if the first delete fails, without touching likes_received', async () => {
    const likesBuilder = chain(fail('boom'));
    const receivedBuilder = chain(ok(null));
    from.mockImplementation((table: string) => (table === 'likes' ? likesBuilder : receivedBuilder));

    await expect(likesService.withdrawLike('target-1', 'liker-1')).rejects.toThrow('boom');
    expect(receivedBuilder.delete).not.toHaveBeenCalled();
  });
});
