import { supabase } from '../supabase';
import { likeLimitService } from '../likeLimitService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('likeLimitService.fetchState', () => {
  it('maps the stored row', async () => {
    from.mockReturnValue(chain(ok({ date: '2026-01-01', count: 5 })));
    expect(await likeLimitService.fetchState('p1')).toEqual({ date: '2026-01-01', count: 5 });
  });

  it('returns null when no row exists yet (nothing liked today)', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await likeLimitService.fetchState('p1')).toBeNull();
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(likeLimitService.fetchState('p1')).rejects.toThrow('denied');
  });
});
