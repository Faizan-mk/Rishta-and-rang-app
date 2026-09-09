import { supabase } from '../supabase';
import { discoveryService, DECK_PAGE_SIZE } from '../discoveryService';
import { chain, ok, fail } from './supabaseTestUtils';
import type { ProfileDoc } from '../authService';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as jest.Mock;

const NOW = new Date('2026-01-15T00:00:00.000Z');
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  from.mockReset();
});

function profileDoc(overrides: Partial<ProfileDoc> = {}): ProfileDoc {
  return {
    id: 'p1',
    fullName: 'Sara',
    dob: '2000-01-15', // 26 as of NOW
    gender: 'female',
    city: 'Lahore',
    bio: 'Hello',
    intent: 'matrimonial',
    language: 'en',
    activeMode: 'rishta',
    datingVibeTags: ['coffee'],
    datingIntentionLabel: null,
    rishtaReligion: 'Islam',
    rishtaSect: 'Sunni',
    rishtaFamilyBackground: 'Family in Lahore',
    rishtaEducation: 'BSc',
    rishtaReadiness: 'ready_now',
    rishtaPrayerHabits: null,
    rishtaIncomeRange: null,
    rishtaLivingAbroad: null,
    heightCm: null,
    maritalStatus: null,
    hasChildren: null,
    occupation: null,
    practising: null,
    prayerHabits: null,
    halalOnly: null,
    smoking: null,
    drinking: null,
    religiousDress: null,
    openToRelocate: null,
    preferredCountry: null,
    careerPlans: null,
    educationLevel: null,
    degree: null,
    jobTitle: null,
    industry: null,
    languages: null,
    nationality: null,
    grewUpIn: null,
    country: null,
    selfieVerified: true,
    bureauVerified: false,
    lastActiveAt: null,
    photos: ['a.jpg'],
    voiceIntroUrl: null,
    voiceIntroDurationSec: null,
    videoIntroUrl: null,
    waliName: null,
    waliInvitedAt: null,
    isExplorePlus: false,
    subscriptionPlan: null,
    hasUsedTrial: false,
    subscriptionRenewsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('discoveryService.fetchDeckPage', () => {
  it('maps rows into both dating and rishta shapes', async () => {
    from.mockReturnValue(chain(ok([profileDoc()])));

    const page = await discoveryService.fetchDeckPage('male', undefined, 0);

    expect(page.dating).toHaveLength(1);
    expect(page.dating[0]).toMatchObject({ id: 'p1', name: 'Sara', age: 26, city: 'Lahore' });
    expect(page.rishta).toHaveLength(1);
    expect(page.rishta[0]).toMatchObject({ id: 'p1', name: 'Sara', religion: 'Islam', sect: 'Sunni' });
  });

  it('filters out the viewer from the page', async () => {
    from.mockReturnValue(chain(ok([profileDoc({ id: 'me' }), profileDoc({ id: 'other' })])));

    const page = await discoveryService.fetchDeckPage('male', 'me', 0);

    expect(page.dating.map((p) => p.id)).toEqual(['other']);
  });

  it('reports hasMore true only when a full page came back', async () => {
    const full = Array.from({ length: DECK_PAGE_SIZE }, (_, i) => profileDoc({ id: `p${i}` }));
    from.mockReturnValue(chain(ok(full)));
    expect((await discoveryService.fetchDeckPage('male', undefined, 0)).hasMore).toBe(true);

    from.mockReturnValue(chain(ok(full.slice(0, 5))));
    expect((await discoveryService.fetchDeckPage('male', undefined, 0)).hasMore).toBe(false);
  });

  it('measures hasMore against the raw row count, not the post-filter count', async () => {
    // A full page that happens to contain the viewer: one short after filtering,
    // but the database still returned a full page, so there is probably another.
    const full = Array.from({ length: DECK_PAGE_SIZE }, (_, i) => profileDoc({ id: `p${i}` }));
    from.mockReturnValue(chain(ok(full)));

    const page = await discoveryService.fetchDeckPage('male', 'p0', 0);

    expect(page.dating).toHaveLength(DECK_PAGE_SIZE - 1);
    expect(page.hasMore).toBe(true);
  });

  it('queries only the target genders for the viewer', async () => {
    const builder = chain(ok([]));
    from.mockReturnValue(builder);

    await discoveryService.fetchDeckPage('male', undefined, 0);
    expect(builder.in).toHaveBeenCalledWith('gender', ['female']);
  });

  it('throws when the query errors', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(discoveryService.fetchDeckPage('male', undefined, 0)).rejects.toThrow('denied');
  });
});

describe('discoveryService.fetchActivity', () => {
  it('returns a map of id to last_active_at', async () => {
    from.mockReturnValue(
      chain(ok([{ id: 'p1', last_active_at: '2026-01-10' }, { id: 'p2', last_active_at: null }]))
    );
    const activity = await discoveryService.fetchActivity(['p1', 'p2']);
    expect(activity.get('p1')).toBe('2026-01-10');
    expect(activity.get('p2')).toBeNull();
  });

  it('short-circuits to an empty map without querying for an empty id list', async () => {
    const activity = await discoveryService.fetchActivity([]);
    expect(activity.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('throws on error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(discoveryService.fetchActivity(['p1'])).rejects.toThrow('denied');
  });
});

describe('discoveryService.fetchProfileById', () => {
  it('returns null when the profile row does not exist', async () => {
    from.mockReturnValue(chain(ok(null)));
    expect(await discoveryService.fetchProfileById('p1', 'dating')).toBeNull();
  });

  it('maps to a DiscoverProfile for kind "dating"', async () => {
    from.mockReturnValue(chain(ok(profileDoc())));
    const profile = await discoveryService.fetchProfileById('p1', 'dating');
    expect(profile).toMatchObject({ id: 'p1', name: 'Sara', vibeTags: ['coffee'] });
  });

  it('maps to a RishtaListingProfile for kind "rishta"', async () => {
    from.mockReturnValue(chain(ok(profileDoc())));
    const profile = await discoveryService.fetchProfileById('p1', 'rishta');
    expect(profile).toMatchObject({ id: 'p1', name: 'Sara', religion: 'Islam' });
  });
});
