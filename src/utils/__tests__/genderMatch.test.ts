import { targetGenders, oppositeGenderProfiles } from '../genderMatch';

describe('targetGenders', () => {
  it('shows only female profiles to a male viewer', () => {
    expect(targetGenders('male')).toEqual(['female']);
  });

  it('shows only male profiles to a female viewer', () => {
    expect(targetGenders('female')).toEqual(['male']);
  });

  it('shows both to an "other" viewer', () => {
    expect(targetGenders('other')).toEqual(['male', 'female']);
  });

  it('shows both when the viewer gender is unknown', () => {
    expect(targetGenders(undefined)).toEqual(['male', 'female']);
  });
});

describe('oppositeGenderProfiles', () => {
  const profiles = [
    { id: '1', gender: 'male' as const },
    { id: '2', gender: 'female' as const },
    { id: '3', gender: 'other' as const },
  ];

  it('filters to female profiles for a male viewer', () => {
    expect(oppositeGenderProfiles(profiles, 'male')).toEqual([{ id: '2', gender: 'female' }]);
  });

  it('filters to male profiles for a female viewer', () => {
    expect(oppositeGenderProfiles(profiles, 'female')).toEqual([{ id: '1', gender: 'male' }]);
  });

  it('never surfaces an "other" row regardless of viewer gender', () => {
    expect(oppositeGenderProfiles(profiles, 'male').some((p) => p.gender === 'other')).toBe(false);
    expect(oppositeGenderProfiles(profiles, 'female').some((p) => p.gender === 'other')).toBe(false);
    expect(oppositeGenderProfiles(profiles, undefined).some((p) => p.gender === 'other')).toBe(false);
  });

  it('returns male and female rows for an unknown viewer gender', () => {
    expect(oppositeGenderProfiles(profiles, undefined)).toEqual([
      { id: '1', gender: 'male' },
      { id: '2', gender: 'female' },
    ]);
  });

  it('returns an empty array for an empty input list', () => {
    expect(oppositeGenderProfiles([], 'male')).toEqual([]);
  });
});
