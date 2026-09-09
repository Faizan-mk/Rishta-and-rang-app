import { supabase } from '../supabase';
import { notificationsService, rowToNotification } from '../notificationsService';
import { chain, ok, fail } from './supabaseTestUtils';
import { DEFAULT_NOTIFICATION_PREFS } from '../../types/content';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('rowToNotification', () => {
  it('maps a realtime row (snake_case) into a NotificationItem', () => {
    const item = rowToNotification({
      id: 'n1',
      type: 'match',
      title: 'New match',
      body: 'You matched with Sara',
      created_at: '2026-01-01T00:00:00.000Z',
      read: false,
    });
    expect(item).toEqual({
      id: 'n1',
      type: 'match',
      title: 'New match',
      body: 'You matched with Sara',
      createdAt: '2026-01-01T00:00:00.000Z',
      read: false,
    });
  });

  it('defaults absent title/body to empty strings and read to false', () => {
    const item = rowToNotification({ id: 1, type: 'system' });
    expect(item.title).toBe('');
    expect(item.body).toBe('');
    expect(item.read).toBe(false);
    expect(item.id).toBe('1');
  });
});

describe('notificationsService.fetchFeed', () => {
  it('maps rows newest-first as returned by the query', async () => {
    from.mockReturnValue(
      chain(
        ok([
          { id: 'n2', type: 'like', title: 'Liked', body: 'Someone liked you', created_at: '2026-01-02', read: false },
          { id: 'n1', type: 'match', title: 'Match', body: 'You matched', created_at: '2026-01-01', read: true },
        ])
      )
    );

    const feed = await notificationsService.fetchFeed('profile-1');

    expect(from).toHaveBeenCalledWith('notifications');
    expect(feed).toEqual([
      { id: 'n2', type: 'like', title: 'Liked', body: 'Someone liked you', createdAt: '2026-01-02', read: false },
      { id: 'n1', type: 'match', title: 'Match', body: 'You matched', createdAt: '2026-01-01', read: true },
    ]);
  });

  it('returns an empty list when there are no rows', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await notificationsService.fetchFeed('profile-1')).toEqual([]);
  });

  it('throws when the query errors', async () => {
    from.mockReturnValue(chain(fail('permission denied')));
    await expect(notificationsService.fetchFeed('profile-1')).rejects.toThrow('permission denied');
  });
});

describe('notificationsService.fetchPrefs', () => {
  it('maps a stored row from snake_case', async () => {
    from.mockReturnValue(
      chain(
        ok({
          new_matches: false,
          messages: true,
          likes: true,
          rishta_requests: false,
          product_updates: true,
        })
      )
    );
    const prefs = await notificationsService.fetchPrefs('profile-1');
    expect(prefs).toEqual({
      newMatches: false,
      messages: true,
      likes: true,
      rishtaRequests: false,
      productUpdates: true,
    });
  });

  it('falls back to defaults when no row exists yet', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await notificationsService.fetchPrefs('profile-1')).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('fills a null column with its default rather than null', async () => {
    from.mockReturnValue(
      chain(ok({ new_matches: null, messages: null, likes: null, rishta_requests: null, product_updates: null }))
    );
    expect(await notificationsService.fetchPrefs('profile-1')).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});

describe('notificationsService.setPref', () => {
  it('upserts the prefs row in snake_case', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await notificationsService.setPref('profile-1', {
      newMatches: true,
      messages: false,
      likes: true,
      rishtaRequests: true,
      productUpdates: false,
    });

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'profile-1',
        new_matches: true,
        messages: false,
        likes: true,
        rishta_requests: true,
        product_updates: false,
      },
      { onConflict: 'id' }
    );
  });

  it('throws on a write error', async () => {
    from.mockReturnValue(chain(fail('constraint violation')));
    await expect(
      notificationsService.setPref('profile-1', DEFAULT_NOTIFICATION_PREFS)
    ).rejects.toThrow('constraint violation');
  });
});

describe('notificationsService.addNotification', () => {
  it('inserts and returns the mapped row', async () => {
    const builder = chain(
      ok({ id: 'n9', type: 'like', title: 'Liked', body: 'x', created_at: '2026-01-03', read: false })
    );
    from.mockReturnValue(builder);

    const item = await notificationsService.addNotification('profile-1', 'like', 'Liked', 'x');

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'profile-1', type: 'like', title: 'Liked', body: 'x', read: false })
    );
    expect(item.id).toBe('n9');
  });
});

describe('notificationsService.markAllRead / markRead', () => {
  it('markRead throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(notificationsService.markRead('profile-1', 'n1')).rejects.toThrow('nope');
  });

  it('markAllRead resolves even when the update reports no error', async () => {
    from.mockReturnValue(chain(ok(null)));
    await expect(notificationsService.markAllRead('profile-1')).resolves.toBeUndefined();
  });
});
