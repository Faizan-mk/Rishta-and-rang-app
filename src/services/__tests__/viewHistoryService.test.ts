import { supabase } from '../supabase';
import { viewHistoryService } from '../viewHistoryService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('viewHistoryService.fetchHistory', () => {
  it('maps viewed_id to id and viewed_at to viewedAt', async () => {
    from.mockReturnValue(
      chain(ok([{ viewed_id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg', viewed_at: '2026-01-01' }]))
    );
    const history = await viewHistoryService.fetchHistory('profile-1');
    expect(history).toEqual([
      { id: 'p1', kind: 'dating', name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg', viewedAt: '2026-01-01' },
    ]);
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(viewHistoryService.fetchHistory('profile-1')).rejects.toThrow('denied');
  });
});

describe('viewHistoryService.recordView', () => {
  const profile = { id: 'p1', kind: 'dating' as const, name: 'Sara', age: 26, city: 'Lahore', photo: 'a.jpg' };

  it('upserts the entry and trims nothing when under the cap', async () => {
    const upsertBuilder = chain(ok(null));
    const selectBuilder = chain(ok([{ id: '1' }, { id: '2' }])); // well under MAX_HISTORY (60)
    let call = 0;
    from.mockImplementation(() => (call++ === 0 ? upsertBuilder : selectBuilder));

    await viewHistoryService.recordView('profile-1', profile);

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'profile-1', viewed_id: 'p1', kind: 'dating' }),
      { onConflict: 'profile_id,viewed_id' }
    );
    // No overflow, so no third (delete) call was ever made.
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('trims entries past MAX_HISTORY (60)', async () => {
    const upsertBuilder = chain(ok(null));
    const ids = Array.from({ length: 65 }, (_, i) => ({ id: `id-${i}` }));
    const selectBuilder = chain(ok(ids));
    const deleteBuilder = chain(ok(null));
    let call = 0;
    from.mockImplementation(() => {
      const builders = [upsertBuilder, selectBuilder, deleteBuilder];
      return builders[call++] ?? deleteBuilder;
    });

    await viewHistoryService.recordView('profile-1', profile);

    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.in).toHaveBeenCalledWith(
      'id',
      ids.slice(60).map((row) => row.id)
    );
    expect(deleteBuilder.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
  });

  it('throws if the upsert itself fails', async () => {
    from.mockReturnValue(chain(fail('constraint violation')));
    await expect(viewHistoryService.recordView('profile-1', profile)).rejects.toThrow('constraint violation');
  });
});

describe('viewHistoryService.clearHistory', () => {
  it('deletes all rows for the profile', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await viewHistoryService.clearHistory('profile-1');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(viewHistoryService.clearHistory('profile-1')).rejects.toThrow('nope');
  });
});
