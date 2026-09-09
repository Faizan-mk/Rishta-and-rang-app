import { AppError, errorMessage } from '../appError';
import type { Translate } from '../../i18n';

// AppError carries a translation key; errorMessage decides how to turn
// whatever a `catch` caught into a line the member actually sees.

const t: Translate = (path, params) => (params ? `${path}:${JSON.stringify(params)}` : path);

describe('AppError', () => {
  it('stores the key and params, and uses the key as the raw message', () => {
    const err = new AppError('errors.tooManyLikes', { count: 5 });
    expect(err.key).toBe('errors.tooManyLikes');
    expect(err.params).toEqual({ count: 5 });
    expect(err.message).toBe('errors.tooManyLikes');
    expect(err.name).toBe('AppError');
  });

  it('works without params', () => {
    const err = new AppError('errors.generic');
    expect(err.params).toBeUndefined();
  });
});

describe('errorMessage', () => {
  it('translates an AppError using its key and params', () => {
    const err = new AppError('errors.tooManyLikes', { count: 5 });
    expect(errorMessage(err, t)).toBe('errors.tooManyLikes:{"count":5}');
  });

  it('keeps a plain Error message untranslated (server strings we do not author)', () => {
    const err = new Error('duplicate key value violates unique constraint');
    expect(errorMessage(err, t)).toBe('duplicate key value violates unique constraint');
  });

  it('falls back to the fallback key for an Error with an empty message', () => {
    const err = new Error('');
    expect(errorMessage(err, t)).toBe('common.somethingWentWrong');
  });

  it('falls back to a custom fallback key when given one', () => {
    const err = new Error('');
    expect(errorMessage(err, t, 'custom.fallback')).toBe('custom.fallback');
  });

  it('falls back for a non-Error thrown value', () => {
    expect(errorMessage('a string was thrown', t)).toBe('common.somethingWentWrong');
    expect(errorMessage(null, t)).toBe('common.somethingWentWrong');
    expect(errorMessage(undefined, t)).toBe('common.somethingWentWrong');
  });
});
