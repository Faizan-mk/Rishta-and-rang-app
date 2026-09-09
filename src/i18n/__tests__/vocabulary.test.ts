import { vocabularyLabel, vocabularyLabels } from '../vocabulary';
import { translate } from '../index';
import type { Translate } from '../index';

const t: Translate = (path, params) => translate('en', path, params);
const urT: Translate = (path, params) => translate('ur', path, params);

describe('vocabularyLabel', () => {
  it('translates a stored canonical value via its slugged vocab key', () => {
    // "Lahore" -> slug "lahore" -> vocab.lahore, a real key in en.json.
    expect(vocabularyLabel('Lahore', t)).toBe(translate('en', 'vocab.lahore'));
  });

  it('camel-cases a multi-word value into its slug', () => {
    // "Rahim Yar Khan" -> "rahimYarKhan", a real key in en.json.
    expect(vocabularyLabel('Rahim Yar Khan', t)).toBe(translate('en', 'vocab.rahimYarKhan'));
  });

  it('returns the value unchanged when there is no vocab entry (free text)', () => {
    expect(vocabularyLabel('Some Free Text City', t)).toBe('Some Free Text City');
  });

  it('returns an empty value unchanged rather than looking it up', () => {
    expect(vocabularyLabel('', t)).toBe('');
  });

  it('goes through the given translator for the requested language', () => {
    const en = vocabularyLabel('Lahore', t);
    const ur = vocabularyLabel('Lahore', urT);
    expect(en).toBe(translate('en', 'vocab.lahore'));
    expect(ur).toBe(translate('ur', 'vocab.lahore'));
  });
});

describe('vocabularyLabels', () => {
  it('maps every value through vocabularyLabel', () => {
    const result = vocabularyLabels(['Lahore', 'Karachi'], t);
    expect(result).toEqual([vocabularyLabel('Lahore', t), vocabularyLabel('Karachi', t)]);
  });

  it('drops empty entries rather than rendering them blank', () => {
    expect(vocabularyLabels(['Lahore', '', 'Karachi'], t)).toHaveLength(2);
  });

  it('returns an empty array for undefined input', () => {
    expect(vocabularyLabels(undefined, t)).toEqual([]);
  });
});
