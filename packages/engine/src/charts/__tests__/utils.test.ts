import { describe, expect, it } from 'vitest';
import { sortByField } from '../utils';

describe('sortByField', () => {
  // -----------------------------------------------------------------------
  // Numeric sorting
  // -----------------------------------------------------------------------

  it('sorts numeric values ascending', () => {
    const data = [{ v: 30 }, { v: 10 }, { v: 20 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([10, 20, 30]);
  });

  it('sorts negative and positive numbers correctly', () => {
    const data = [{ v: 5 }, { v: -3 }, { v: 0 }, { v: -1 }, { v: 2 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([-3, -1, 0, 2, 5]);
  });

  it('sorts floating point numbers correctly', () => {
    const data = [{ v: 1.5 }, { v: 1.1 }, { v: 1.9 }, { v: 1.3 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([1.1, 1.3, 1.5, 1.9]);
  });

  // -----------------------------------------------------------------------
  // Date string sorting (ISO format)
  // -----------------------------------------------------------------------

  it('sorts ISO date strings (YYYY-MM-DD) lexicographically', () => {
    const data = [
      { date: '2022-01-01', v: 1 },
      { date: '2020-06-15', v: 2 },
      { date: '2021-03-10', v: 3 },
    ];
    const sorted = sortByField(data, 'date');
    expect(sorted.map((r) => r.date)).toEqual(['2020-06-15', '2021-03-10', '2022-01-01']);
  });

  it('sorts dates within the same year by month and day', () => {
    const data = [
      { date: '2020-12-25' },
      { date: '2020-01-01' },
      { date: '2020-06-15' },
      { date: '2020-03-20' },
    ];
    const sorted = sortByField(data, 'date');
    expect(sorted.map((r) => r.date)).toEqual([
      '2020-01-01',
      '2020-03-20',
      '2020-06-15',
      '2020-12-25',
    ]);
  });

  it('sorts full ISO datetime strings with time component', () => {
    const data = [
      { ts: '2020-01-01T23:59:59Z' },
      { ts: '2020-01-01T00:00:00Z' },
      { ts: '2020-01-01T12:30:00Z' },
    ];
    const sorted = sortByField(data, 'ts');
    expect(sorted.map((r) => r.ts)).toEqual([
      '2020-01-01T00:00:00Z',
      '2020-01-01T12:30:00Z',
      '2020-01-01T23:59:59Z',
    ]);
  });

  it('sorts reverse-ordered dates correctly', () => {
    const data = [
      { date: '2025-01-01' },
      { date: '2024-01-01' },
      { date: '2023-01-01' },
      { date: '2022-01-01' },
    ];
    const sorted = sortByField(data, 'date');
    expect(sorted.map((r) => r.date)).toEqual([
      '2022-01-01',
      '2023-01-01',
      '2024-01-01',
      '2025-01-01',
    ]);
  });

  // -----------------------------------------------------------------------
  // String-encoded numbers (year columns from CSV data)
  // -----------------------------------------------------------------------

  it('sorts string-encoded year numbers numerically', () => {
    const data = [{ year: '2022' }, { year: '2020' }, { year: '2021' }];
    const sorted = sortByField(data, 'year');
    expect(sorted.map((r) => r.year)).toEqual(['2020', '2021', '2022']);
  });

  it('sorts string-encoded decimal numbers numerically', () => {
    const data = [{ v: '10.5' }, { v: '2.3' }, { v: '100.1' }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual(['2.3', '10.5', '100.1']);
  });

  // -----------------------------------------------------------------------
  // Date objects
  // -----------------------------------------------------------------------

  it('sorts Date objects by timestamp', () => {
    const d1 = new Date('2020-06-15T00:00:00');
    const d2 = new Date('2021-06-15T00:00:00');
    const d3 = new Date('2022-06-15T00:00:00');
    const data = [{ d: d3 }, { d: d1 }, { d: d2 }];
    const sorted = sortByField(data, 'd');
    expect(sorted.map((r) => r.d)).toEqual([d1, d2, d3]);
  });

  // -----------------------------------------------------------------------
  // Null / undefined handling
  // -----------------------------------------------------------------------

  it('pushes nulls to the end', () => {
    const data = [{ v: null }, { v: 10 }, { v: 30 }, { v: null }, { v: 20 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([10, 20, 30, null, null]);
  });

  it('pushes undefined (missing field) to the end', () => {
    const data = [{ other: 1 }, { v: 10, other: 2 }, { v: 20, other: 3 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([10, 20, undefined]);
  });

  it('handles all-null values without crashing', () => {
    const data = [{ v: null }, { v: null }, { v: null }];
    const sorted = sortByField(data, 'v');
    expect(sorted).toHaveLength(3);
    expect(sorted.every((r) => r.v === null)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Duplicate values
  // -----------------------------------------------------------------------

  it('handles duplicate values preserving both rows', () => {
    const data = [{ v: 20 }, { v: 10 }, { v: 20 }, { v: 10 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([10, 10, 20, 20]);
  });

  it('handles duplicate date strings', () => {
    const data = [
      { date: '2021-01-01', id: 'c' },
      { date: '2020-01-01', id: 'b' },
      { date: '2021-01-01', id: 'a' },
    ];
    const sorted = sortByField(data, 'date');
    // Both 2021 rows follow the 2020 row
    expect(sorted[0].date).toBe('2020-01-01');
    expect(sorted[1].date).toBe('2021-01-01');
    expect(sorted[2].date).toBe('2021-01-01');
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('returns a new array (no mutation)', () => {
    const data = [{ v: 30 }, { v: 10 }];
    const sorted = sortByField(data, 'v');
    expect(sorted).not.toBe(data);
    expect(data[0].v).toBe(30);
  });

  it('handles empty array', () => {
    expect(sortByField([], 'v')).toEqual([]);
  });

  it('handles single element', () => {
    const data = [{ v: 42 }];
    const sorted = sortByField(data, 'v');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].v).toBe(42);
  });

  it('handles already-sorted data', () => {
    const data = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const sorted = sortByField(data, 'v');
    expect(sorted.map((r) => r.v)).toEqual([1, 2, 3]);
  });

  it('sorts pure string values lexicographically', () => {
    const data = [{ name: 'cherry' }, { name: 'apple' }, { name: 'banana' }];
    const sorted = sortByField(data, 'name');
    expect(sorted.map((r) => r.name)).toEqual(['apple', 'banana', 'cherry']);
  });
});
