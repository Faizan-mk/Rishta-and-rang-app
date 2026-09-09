import { supabase } from '../supabase';
import { reportsService } from '../reportsService';
import { chain, ok, fail } from './supabaseTestUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('reportsService.submitReport', () => {
  it('inserts a pending report with trimmed details', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await reportsService.submitReport('reporter-1', {
      targetId: 'target-1',
      reason: 'harassment' as never,
      details: '  extra context  ',
      context: 'chat',
    });

    expect(builder.insert).toHaveBeenCalledWith({
      reporter_id: 'reporter-1',
      target_id: 'target-1',
      reason: 'harassment',
      details: 'extra context',
      context: 'chat',
      status: 'pending',
    });
  });

  it('defaults missing details to an empty string', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await reportsService.submitReport('reporter-1', {
      targetId: 'target-1',
      reason: 'spam' as never,
      context: 'discover',
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ details: '' }));
  });

  it('treats a duplicate report (unique violation) as success', async () => {
    from.mockReturnValue(chain(fail('duplicate key value', '23505')));
    await expect(
      reportsService.submitReport('reporter-1', { targetId: 'target-1', reason: 'spam' as never, context: 'profile' })
    ).resolves.toBeUndefined();
  });

  it('throws for any other error', async () => {
    from.mockReturnValue(chain(fail('permission denied', '42501')));
    await expect(
      reportsService.submitReport('reporter-1', { targetId: 'target-1', reason: 'spam' as never, context: 'profile' })
    ).rejects.toThrow('permission denied');
  });
});
