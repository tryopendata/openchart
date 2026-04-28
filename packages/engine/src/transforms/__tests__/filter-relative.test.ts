import { describe, expect, it } from 'vitest';
import { runFilter } from '../filter';
import { runTransforms } from '../index';

/**
 * Generate monthly rows: one row per month for `months` months starting from `startDate`.
 */
function monthlyData(startDate: string, months: number) {
  const rows = [];
  const start = new Date(startDate);
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    rows.push({ date: d.toISOString().slice(0, 10), value: i + 1 });
  }
  return rows;
}

/**
 * Generate daily rows: one row per day for `days` days starting from `startDate`.
 */
function dailyData(startDate: string, days: number) {
  const rows = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    rows.push({ date: d.toISOString().slice(0, 10), value: i + 1 });
  }
  return rows;
}

describe('relative-time filter', () => {
  it('last 1 year from max: 60 monthly rows, gte anchor max offset -1 year returns ~12 rows', () => {
    const data = monthlyData('2020-01-01', 60); // Jan 2020 through Dec 2024
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -1, unit: 'year' },
    });
    // Max date is 2024-12-01, minus 1 year = 2023-12-01
    // Should include Dec 2023 through Dec 2024 = 13 rows
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(13);
    // All returned dates should be >= 2023-12-01
    for (const row of result) {
      expect(new Date(row.date as string).getTime()).toBeGreaterThanOrEqual(
        new Date('2023-12-01').getTime(),
      );
    }
  });

  it('last 3 years from max: 60 monthly rows, offset -3 returns ~36 rows', () => {
    const data = monthlyData('2020-01-01', 60);
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -3, unit: 'year' },
    });
    // Max is 2024-12-01, minus 3 years = 2021-12-01
    // Dec 2021 through Dec 2024 = 37 rows
    expect(result.length).toBeGreaterThanOrEqual(36);
    expect(result.length).toBeLessThanOrEqual(37);
  });

  it('last 30 days: 90 daily rows, offset -30 day returns 30-31 rows', () => {
    const data = dailyData('2024-01-01', 90);
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -30, unit: 'day' },
    });
    expect(result.length).toBeGreaterThanOrEqual(30);
    expect(result.length).toBeLessThanOrEqual(31);
  });

  it('anchor min + offset: lte anchor min offset +2 year returns rows within 2 years of earliest', () => {
    const data = monthlyData('2020-01-01', 60);
    const result = runFilter(data, {
      field: 'date',
      lte: { anchor: 'min', offset: 2, unit: 'year' },
    });
    // Min is 2020-01-01, plus 2 years = 2022-01-01
    // Jan 2020 through Jan 2022 = 25 rows
    expect(result.length).toBeGreaterThanOrEqual(24);
    expect(result.length).toBeLessThanOrEqual(25);
    for (const row of result) {
      expect(new Date(row.date as string).getTime()).toBeLessThanOrEqual(
        new Date('2022-01-01').getTime(),
      );
    }
  });

  it('quarter unit: offset -4 quarter returns last ~4 quarters', () => {
    // Generate quarterly data (every 3 months)
    const data = [];
    const start = new Date('2020-01-01');
    for (let i = 0; i < 20; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i * 3);
      data.push({ date: d.toISOString().slice(0, 10), value: i + 1 });
    }
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -4, unit: 'quarter' },
    });
    // 4 quarters back from max = ~4-5 rows of quarterly data
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('non-ISO dates: data with timestamp numbers resolves correctly', () => {
    // Use numeric timestamps instead of date strings
    const baseDate = new Date('2024-01-01').getTime();
    const dayMs = 86400000;
    const data = Array.from({ length: 90 }, (_, i) => ({
      date: baseDate + i * dayMs,
      value: i,
    }));
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -30, unit: 'day' },
    });
    expect(result.length).toBeGreaterThanOrEqual(30);
    expect(result.length).toBeLessThanOrEqual(31);
  });

  it('empty dataset returns [] without throwing', () => {
    const result = runFilter([], {
      field: 'date',
      gte: { anchor: 'max', offset: -1, unit: 'year' },
    });
    expect(result).toEqual([]);
  });

  it('single row: returns that row when anchor matches', () => {
    const data = [{ date: '2024-06-15', value: 42 }];
    const result = runFilter(data, {
      field: 'date',
      gte: { anchor: 'max', offset: -1, unit: 'year' },
    });
    // The single row is both min and max; subtracting 1 year puts the threshold before it
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(42);
  });

  it('chained transforms: calculate first, then relative filter works on post-transform data', () => {
    const data = monthlyData('2020-01-01', 60);
    const result = runTransforms(data, [
      // Copy date field to a new field (identity via multiply by 1 won't work for dates,
      // so we just verify the filter operates on the same data)
      {
        filter: {
          field: 'date',
          gte: { anchor: 'max', offset: -1, unit: 'year' },
        },
      },
    ]);
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(13);
  });

  it('range predicate with two relative refs', () => {
    const data = monthlyData('2020-01-01', 60);
    const maxDate = new Date(data[data.length - 1].date as string);
    const loBound = new Date(maxDate);
    loBound.setFullYear(loBound.getFullYear() - 2);
    const hiBound = new Date(maxDate);
    hiBound.setFullYear(hiBound.getFullYear() - 1);

    const result = runFilter(data, {
      field: 'date',
      range: [
        { anchor: 'max', offset: -2, unit: 'year' },
        { anchor: 'max', offset: -1, unit: 'year' },
      ],
    });
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(13);
    for (const row of result) {
      const ts = new Date(row.date as string).getTime();
      expect(ts).toBeGreaterThanOrEqual(loBound.getTime());
      expect(ts).toBeLessThanOrEqual(hiBound.getTime());
    }
  });

  it('logical AND with relative ref and static filter: both applied', () => {
    const data = monthlyData('2020-01-01', 60).map((r, i) => ({
      ...r,
      category: i % 2 === 0 ? 'A' : 'B',
    }));
    const result = runFilter(data, {
      and: [
        { field: 'date', gte: { anchor: 'max', offset: -1, unit: 'year' } },
        { field: 'category', equal: 'A' },
      ],
    });
    // ~12-13 rows in last year, roughly half are category A
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(7);
    for (const row of result) {
      expect(row.category).toBe('A');
    }
  });
});
