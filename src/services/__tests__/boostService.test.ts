import { supabase } from '../supabase';
import { boostService } from '../boostService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('boostService.fetchState', () => {
  it('maps the stored row', async () => {
    from.mockReturnValue(chain(ok({ boosts_left: 3, active_until: '2026-01-01T00:00:00.000Z' })));
    expect(await boostService.fetchState('p1')).toEqual({ boostsLeft: 3, activeUntil: '2026-01-01T00:00:00.000Z' });
  });

  it('returns null when no row exists', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await boostService.fetchState('p1')).toBeNull();
  });

  it('defaults a null boosts_left to 0 and non-string active_until to null', async () => {
    from.mockReturnValue(chain(ok({ boosts_left: null, active_until: null })));
    expect(await boostService.fetchState('p1')).toEqual({ boostsLeft: 0, activeUntil: null });
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(boostService.fetchState('p1')).rejects.toThrow('denied');
  });
});

describe('boostService.setState', () => {
  it('upserts boosts_left and active_until in snake_case', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await boostService.setState('p1', { boostsLeft: 2, activeUntil: null });
    expect(builder.upsert).toHaveBeenCalledWith(
      { id: 'p1', boosts_left: 2, active_until: null },
      { onConflict: 'id' }
    );
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(boostService.setState('p1', { boostsLeft: 1, activeUntil: null })).rejects.toThrow('nope');
  });
});
