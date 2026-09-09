import { supabase } from '../supabase';
import { favoritesService } from '../favoritesService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('favoritesService.fetchFavorites', () => {
  it('maps target_id to id', async () => {
    from.mockReturnValue(
      chain(ok([{ target_id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg' }]))
    );
    const favorites = await favoritesService.fetchFavorites('profile-1');
    expect(favorites).toEqual([{ id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg' }]);
  });

  it('returns an empty list on no rows', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await favoritesService.fetchFavorites('profile-1')).toEqual([]);
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(favoritesService.fetchFavorites('profile-1')).rejects.toThrow('denied');
  });
});

describe('favoritesService.addFavorite', () => {
  it('upserts on (profile_id, target_id) so favouriting twice does not duplicate', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await favoritesService.addFavorite('profile-1', {
      id: 'p1',
      kind: 'rishta',
      name: 'Sara',
      age: 26,
      city: 'Lahore',
      photo: 'a.jpg',
    });

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'profile-1', target_id: 'p1', kind: 'rishta', name: 'Sara' }),
      { onConflict: 'profile_id,target_id' }
    );
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(
      favoritesService.addFavorite('profile-1', { id: 'p1', kind: 'dating', name: '', age: 0, city: '', photo: '' })
    ).rejects.toThrow('nope');
  });
});

describe('favoritesService.updateFavoriteKind', () => {
  it('patches only kind, scoped to the pair', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await favoritesService.updateFavoriteKind('profile-1', 'p1', 'rishta');

    expect(builder.update).toHaveBeenCalledWith({ kind: 'rishta' });
    expect(builder.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
    expect(builder.eq).toHaveBeenCalledWith('target_id', 'p1');
  });
});

describe('favoritesService.removeFavorite', () => {
  it('deletes the pair', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await favoritesService.removeFavorite('profile-1', 'p1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
    expect(builder.eq).toHaveBeenCalledWith('target_id', 'p1');
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(favoritesService.removeFavorite('profile-1', 'p1')).rejects.toThrow('nope');
  });
});
