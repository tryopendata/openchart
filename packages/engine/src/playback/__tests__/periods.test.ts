import { describe, expect, it } from 'vitest';
import { orderPeriods, type PlaybackPeriod, readPeriod } from '../periods';

function ordinals(...values: string[]): PlaybackPeriod[] {
  return values.map((value) => ({ value, sortKey: 0 }));
}

describe('readPeriod', () => {
  it('reads years, ISO dates and numbers by type', () => {
    expect(readPeriod(1999, 'temporal')).toEqual({ value: 1999, sortKey: 1999 });
    expect(readPeriod('2001-03-01', 'temporal')).toEqual({
      value: '2001-03-01',
      sortKey: Date.UTC(2001, 2, 1),
    });
    expect(readPeriod('12', 'quantitative')).toEqual({ value: '12', sortKey: 12 });
  });

  it('rejects values that cannot be a period of the type', () => {
    expect(readPeriod('not a date', 'temporal')).toBeUndefined();
    expect(readPeriod(null, 'ordinal')).toBeUndefined();
  });
});

describe('orderPeriods', () => {
  it('keeps first-seen order for ordinal periods without a sort', () => {
    const periods = ordinals('b', 'c', 'a');
    orderPeriods(periods, { type: 'ordinal' });
    expect(periods).toEqual([
      { value: 'b', sortKey: 0 },
      { value: 'c', sortKey: 1 },
      { value: 'a', sortKey: 2 },
    ]);
  });

  it('reverses first-seen order for ordinal sort "descending"', () => {
    const periods = ordinals('b', 'c', 'a');
    orderPeriods(periods, { type: 'ordinal', sort: 'descending' });
    expect(periods).toEqual([
      { value: 'a', sortKey: 0 },
      { value: 'c', sortKey: 1 },
      { value: 'b', sortKey: 2 },
    ]);
  });

  it('lets a sort array win over first-seen order', () => {
    const periods = ordinals('b', 'c', 'a');
    orderPeriods(periods, { type: 'ordinal', sort: ['c', 'a', 'b'] });
    expect(periods.map(({ value }) => value)).toEqual(['c', 'a', 'b']);
  });

  it('sorts mixed temporal years and dates by time', () => {
    const periods = [readPeriod(2002, 'temporal'), readPeriod('2001-06-01', 'temporal')].filter(
      (period) => period !== undefined,
    );
    orderPeriods(periods, { type: 'temporal' });
    expect(periods.map(({ value }) => value)).toEqual(['2001-06-01', 2002]);
  });
});
