import { translate, isRTL } from '../index';

describe('translate', () => {
  it('resolves a dotted path against the requested dictionary', () => {
    expect(translate('en', 'common.save')).toBe('Save changes');
  });

  it('interpolates a {param} placeholder in a real dictionary string', () => {
    expect(translate('en', 'rishtaBrowse.resultsCount', { count: 3 })).toBe('3 profiles match your filters');
  });

  it('interpolates multiple placeholders in one string', () => {
    expect(translate('en', 'discover.filterAgeRange', { min: 20, max: 30 })).toBe('20–30 years');
  });

  it('leaves an unmatched placeholder untouched rather than dropping it', () => {
    expect(translate('en', 'rishtaBrowse.resultsCount', {})).toBe('{count} profiles match your filters');
  });

  it('does not need params for a template with no placeholders', () => {
    expect(translate('en', 'common.other')).toBe('Other');
  });

  it('falls back to the path itself for a missing key', () => {
    expect(translate('en', 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('resolves the same path across all three locales without falling back to the key', () => {
    for (const language of ['en', 'ur', 'roman'] as const) {
      const value = translate(language, 'common.save');
      expect(value).not.toBe('common.save');
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('isRTL', () => {
  it('is true only for Urdu', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('roman')).toBe(false);
  });
});
