import { supabase } from '../supabase';
import { privacyService } from '../privacyService';
import { chain, ok, fail } from './supabaseTestUtils';
import { DEFAULT_PRIVACY_PREFS } from '../../types/content';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
});

describe('privacyService.fetchPrefs', () => {
  it('maps a stored row from snake_case', async () => {
    from.mockReturnValue(chain(ok({ profile_visible: false, online_status_visible: true, blur_photos: true })));
    expect(await privacyService.fetchPrefs('p1')).toEqual({
      profileVisible: false,
      onlineStatusVisible: true,
      blurPhotos: true,
    });
  });

  it('falls back to defaults when no row exists', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await privacyService.fetchPrefs('p1')).toEqual(DEFAULT_PRIVACY_PREFS);
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(privacyService.fetchPrefs('p1')).rejects.toThrow('denied');
  });
});

describe('privacyService.setPrefs', () => {
  it('upserts the prefs row in snake_case', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await privacyService.setPrefs('p1', { profileVisible: true, onlineStatusVisible: false, blurPhotos: true });
    expect(builder.upsert).toHaveBeenCalledWith(
      { id: 'p1', profile_visible: true, online_status_visible: false, blur_photos: true },
      { onConflict: 'id' }
    );
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('nope')));
    await expect(privacyService.setPrefs('p1', DEFAULT_PRIVACY_PREFS)).rejects.toThrow('nope');
  });
});
