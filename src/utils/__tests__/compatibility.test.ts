import { datingCompatibility, rishtaCompatibility } from '../compatibility';
import type { UserProfile } from '../../types/user';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';

// System time is fixed so ageFromDob (used inside compatibility) is deterministic.
const NOW = new Date('2026-01-15T00:00:00.000Z');

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha',
    email: 'a@example.com',
    dob: '2000-01-15', // exactly 26 as of NOW
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: ['coffee', 'travel'] },
    rishta: {
      religion: 'Islam',
      sect: 'Sunni',
      familyBackground: '',
      education: '',
      readiness: 'ready_now',
    },
    activeMode: 'rishta',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function discoverProfile(overrides: Partial<DiscoverProfile> = {}): DiscoverProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 26,
    gender: 'female',
    city: 'Lahore',
    bio: '',
    vibeTags: ['coffee', 'travel'],
    photos: [],
    ...overrides,
  };
}

function rishtaProfile(overrides: Partial<RishtaListingProfile> = {}): RishtaListingProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 26,
    gender: 'female',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'BSc',
    familyBackground: '',
    readiness: 'ready_now',
    photos: [],
    ...overrides,
  };
}

describe('datingCompatibility', () => {
  it('scores highest for a same-age, same-city, full vibe-tag overlap match', () => {
    const score = datingCompatibility(user(), discoverProfile());
    expect(score).toBe(99); // 30 base + 25 age + 20 city + 25 tags, clamped to 99
  });

  it('gives less credit as the age gap widens', () => {
    const close = datingCompatibility(user(), discoverProfile({ age: 28 })); // diff 2 -> +25
    const mid = datingCompatibility(user(), discoverProfile({ age: 32 })); // diff 6 -> +15
    const far = datingCompatibility(user(), discoverProfile({ age: 40 })); // diff 14 -> +0
    expect(close).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it('does not award the city bonus for different cities', () => {
    // vibeTags cleared so the tag bonus does not push either score into the 99 clamp.
    const same = datingCompatibility(user(), discoverProfile({ city: 'Lahore', vibeTags: [] }));
    const different = datingCompatibility(user(), discoverProfile({ city: 'Karachi', vibeTags: [] }));
    expect(same - different).toBe(20);
  });

  it('is case-insensitive when comparing cities', () => {
    const score = datingCompatibility(user(), discoverProfile({ city: 'LAHORE' }));
    expect(score).toBe(99);
  });

  it('scores zero tag overlap without crashing', () => {
    const score = datingCompatibility(user(), discoverProfile({ vibeTags: ['hiking'] }));
    expect(score).toBe(30 + 25 + 20); // no tag bonus
  });

  it('still returns a valid clamped score when the dob cannot be parsed', () => {
    const noAge = user({ dob: 'not-a-date' });
    const score = datingCompatibility(noAge, discoverProfile({ city: 'Karachi', vibeTags: [] }));
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(99);
  });
});

describe('rishtaCompatibility', () => {
  it('scores highest for a full match on age, city, religion and sect (clamped to 99)', () => {
    const score = rishtaCompatibility(user(), rishtaProfile());
    expect(score).toBe(99); // raw 100 (30+20+15+20+15), clamped to the 99 max
  });

  it('drops the religion bonus when religions differ', () => {
    const score = rishtaCompatibility(user(), rishtaProfile({ religion: 'Christianity' }));
    expect(score).toBe(30 + 20 + 15 + 15); // no religion bonus, sect bonus also gone since compared separately
  });

  it('drops the sect bonus when sects differ but religion matches', () => {
    const score = rishtaCompatibility(user(), rishtaProfile({ sect: 'Shia' }));
    expect(score).toBe(30 + 20 + 15 + 20);
  });

  it('is case-insensitive for religion and sect matching', () => {
    const score = rishtaCompatibility(user(), rishtaProfile({ religion: 'ISLAM', sect: 'SUNNI' }));
    expect(score).toBe(99); // raw 100, clamped
  });

  it('clamps the maximum score to 99', () => {
    const score = rishtaCompatibility(user(), rishtaProfile());
    expect(score).toBeLessThanOrEqual(99);
  });
});
