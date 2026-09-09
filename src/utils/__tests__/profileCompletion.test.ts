import { profileCompletion } from '../profileCompletion';
import type { UserProfile } from '../../types/user';

function baseUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: '',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: '', sect: '', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'dating',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('profileCompletion', () => {
  it('is 0% for a brand-new empty profile', () => {
    expect(profileCompletion(baseUser())).toBe(0);
  });

  it('is 100% once every dating-mode check passes', () => {
    const user = baseUser({
      photos: ['a.jpg', 'b.jpg'],
      bio: 'Hello there',
      selfieVerified: true,
      city: 'Lahore',
      activeMode: 'dating',
      dating: { vibeTags: ['coffee'] },
    });
    expect(profileCompletion(user)).toBe(100);
  });

  it('is 100% once every rishta-mode check passes', () => {
    const user = baseUser({
      photos: ['a.jpg', 'b.jpg'],
      bio: 'Hello there',
      selfieVerified: true,
      city: 'Lahore',
      activeMode: 'rishta',
      rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: '', education: 'BSc', readiness: 'ready_now' },
    });
    expect(profileCompletion(user)).toBe(100);
  });

  it('does not credit the dating check in rishta mode without religion/sect/education', () => {
    const user = baseUser({
      photos: ['a.jpg', 'b.jpg'],
      bio: 'Hello there',
      selfieVerified: true,
      city: 'Lahore',
      activeMode: 'rishta',
      dating: { vibeTags: ['coffee'] }, // irrelevant in rishta mode
      rishta: { religion: '', sect: '', familyBackground: '', education: '', readiness: 'browsing' },
    });
    expect(profileCompletion(user)).toBe(80); // 4 of 5 checks pass
  });

  it('requires at least 2 photos, not just 1', () => {
    const user = baseUser({ photos: ['a.jpg'] });
    expect(profileCompletion(user)).toBe(0);
  });

  it('treats a whitespace-only bio as not filled in', () => {
    const user = baseUser({ bio: '   ' });
    expect(profileCompletion(user)).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    // 2 of 5 checks -> 40%, evenly divisible, sanity check on rounding path
    const user = baseUser({ photos: ['a.jpg', 'b.jpg'], bio: 'hi' });
    expect(profileCompletion(user)).toBe(40);
  });
});
