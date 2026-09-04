import { rishtaProfileComplete } from '../rishtaProfile';
import type { UserProfile } from '../../types/user';

// The gate that decides whether "Move to Rishta" may be tapped at all. It is
// enforced in the database (`public.rishta_profile_complete`); this is the copy
// the button reads, so the two have to agree field for field — including that a
// field holding only spaces is not filled in.

function profile(rishta: Partial<UserProfile['rishta']> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: {
      religion: 'Islam',
      sect: 'Sunni',
      familyBackground: 'Lahore family, three siblings',
      education: 'BSc Computer Science',
      readiness: 'ready_now',
      ...rishta,
    },
    activeMode: 'rishta',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('rishtaProfileComplete', () => {
  it('passes a filled-in rishta profile', () => {
    expect(rishtaProfileComplete(profile())).toBe(true);
  });

  it('refuses a signed-out member', () => {
    expect(rishtaProfileComplete(null)).toBe(false);
  });

  it.each(['religion', 'education', 'familyBackground'] as const)('refuses an empty %s', (field) => {
    expect(rishtaProfileComplete(profile({ [field]: '' }))).toBe(false);
  });

  it('refuses a field holding only spaces, as the database does', () => {
    expect(rishtaProfileComplete(profile({ familyBackground: '   ' }))).toBe(false);
  });

  // `sect` is deliberately not part of the gate — the database does not check
  // it either, and a member may not have one to give.
  it('does not require a sect', () => {
    expect(rishtaProfileComplete(profile({ sect: '' }))).toBe(true);
  });

  it('refuses the default readiness, since browsing is not an answer', () => {
    expect(rishtaProfileComplete(profile({ readiness: 'browsing' }))).toBe(false);
  });

  it('accepts either committed readiness', () => {
    expect(rishtaProfileComplete(profile({ readiness: 'few_months' }))).toBe(true);
    expect(rishtaProfileComplete(profile({ readiness: 'ready_now' }))).toBe(true);
  });
});
