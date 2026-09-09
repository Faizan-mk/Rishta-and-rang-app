import { countActiveFilters, DEFAULT_BROWSE_FILTERS } from '../browseOptions';
import type { BrowseFilters } from '../browseOptions';

describe('countActiveFilters', () => {
  it('counts zero when every filter is at its default', () => {
    expect(countActiveFilters(DEFAULT_BROWSE_FILTERS, 'dating')).toBe(0);
  });

  it('counts a narrowed age range as one', () => {
    const filters: BrowseFilters = { ...DEFAULT_BROWSE_FILTERS, ageMin: 25 };
    expect(countActiveFilters(filters, 'dating')).toBe(1);
  });

  it('counts city, intent, verifiedOnly and activeToday independently', () => {
    const filters: BrowseFilters = {
      ...DEFAULT_BROWSE_FILTERS,
      city: 'Lahore',
      intent: 'casual',
      verifiedOnly: true,
      activeToday: true,
    };
    expect(countActiveFilters(filters, 'dating')).toBe(4);
  });

  it('counts sect and readiness on the rishta deck', () => {
    const filters: BrowseFilters = { ...DEFAULT_BROWSE_FILTERS, sect: 'Sunni', readiness: 'ready_now' };
    expect(countActiveFilters(filters, 'rishta')).toBe(2);
  });

  it('does not count sect or readiness on the dating deck, since they filter nothing there', () => {
    const filters: BrowseFilters = { ...DEFAULT_BROWSE_FILTERS, sect: 'Sunni', readiness: 'ready_now' };
    expect(countActiveFilters(filters, 'dating')).toBe(0);
  });
});
