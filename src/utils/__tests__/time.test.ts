import { dayKey, dayLabel, sameDay } from '../time';
import type { Translate } from '../../i18n';

// A bubble carries a clock time and nothing else, so the day divider is the only
// thing telling a reader that "12:48 PM" was last Tuesday rather than an hour
// ago. These are the two ways that goes wrong: a day boundary read in the wrong
// timezone, and "today" computed from a fixed idea of when today is.

// Enough of the dictionary for the labels under test; anything else comes back
// as its own path, which makes a missing key obvious in a failure.
const t: Translate = (path, params) => {
  const dict: Record<string, string> = {
    'chat.today': 'Today',
    'chat.yesterday': 'Yesterday',
    'chat.dateShort': '{day} {month}',
    'chat.dateFull': '{day} {month} {year}',
    'calendar.month0': 'January',
    'calendar.month8': 'September',
    'calendar.month11': 'December',
  };
  const template = dict[path] ?? path;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
};

/** A local-time instant, so these tests do not depend on the runner's zone. */
function at(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month, day, hour, minute).toISOString();
}

describe('dayKey', () => {
  it('reads the day in local time, not off the front of the UTC string', () => {
    // 1am local on the 10th. In any timezone ahead of UTC this is still the 9th
    // in the ISO string, which is exactly the slice-the-string bug.
    expect(dayKey(at(2026, 8, 10, 1))).toBe(dayKey(at(2026, 8, 10, 23)));
  });

  it('separates two adjacent days', () => {
    expect(dayKey(at(2026, 8, 10))).not.toBe(dayKey(at(2026, 8, 11)));
  });

  it('is empty for an unparseable timestamp rather than throwing', () => {
    expect(dayKey('not a date')).toBe('');
  });
});

describe('sameDay', () => {
  it('is true across a whole local day', () => {
    expect(sameDay(at(2026, 8, 10, 0, 1), at(2026, 8, 10, 23, 59))).toBe(true);
  });

  it('is false a minute later, on the next day', () => {
    expect(sameDay(at(2026, 8, 10, 23, 59), at(2026, 8, 11, 0, 0))).toBe(false);
  });

  it('is false when either side is unparseable — never accidentally true', () => {
    expect(sameDay('not a date', 'not a date')).toBe(false);
  });
});

describe('dayLabel', () => {
  it('says Today for today', () => {
    expect(dayLabel(new Date().toISOString(), t)).toBe('Today');
  });

  it('says Yesterday for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayLabel(yesterday.toISOString(), t)).toBe('Yesterday');
  });

  it('drops the year within the current one, where it says nothing', () => {
    const thisYear = new Date().getFullYear();
    // Two months back, so it can be neither today nor yesterday whenever this runs.
    const past = new Date();
    past.setMonth(past.getMonth() - 2);
    const label = dayLabel(past.toISOString(), t);
    expect(label).not.toContain(String(thisYear));
    expect(label).toContain(String(past.getDate()));
  });

  it('keeps the year on a date from another year', () => {
    expect(dayLabel(at(2024, 0, 5), t)).toBe('5 January 2024');
  });

  it('is empty for an unparseable timestamp', () => {
    expect(dayLabel('not a date', t)).toBe('');
  });
});
