import { describe, expect, it } from 'vitest';
import { sortData } from '../sort';

describe('sortData', () => {
  it('sorts numbers numerically ascending', () => {
    const data = [
      { name: 'C', value: 30 },
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
    ];
    const result = sortData(data, { column: 'value', direction: 'asc' });
    expect(result.data.map((r) => r.value)).toEqual([10, 20, 30]);
  });

  it('sorts numbers numerically descending', () => {
    const data = [
      { name: 'A', value: 10 },
      { name: 'C', value: 30 },
      { name: 'B', value: 20 },
    ];
    const result = sortData(data, { column: 'value', direction: 'desc' });
    expect(result.data.map((r) => r.value)).toEqual([30, 20, 10]);
  });

  it('sorts strings via localeCompare', () => {
    const data = [
      { name: 'Charlie', value: 1 },
      { name: 'Alice', value: 2 },
      { name: 'Bob', value: 3 },
    ];
    const result = sortData(data, { column: 'name', direction: 'asc' });
    expect(result.data.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts dates by timestamp', () => {
    const d1 = new Date('2020-01-01');
    const d2 = new Date('2021-06-15');
    const d3 = new Date('2019-12-31');
    const data = [
      { date: d1, val: 1 },
      { date: d2, val: 2 },
      { date: d3, val: 3 },
    ];
    const result = sortData(data, { column: 'date', direction: 'asc' });
    expect(result.data.map((r) => r.val)).toEqual([3, 1, 2]);
  });

  it('puts null values last regardless of sort direction', () => {
    const data = [
      { name: 'A', value: null },
      { name: 'B', value: 20 },
      { name: 'C', value: 10 },
    ];

    const asc = sortData(data, { column: 'value', direction: 'asc' });
    expect(asc.data.map((r) => r.name)).toEqual(['C', 'B', 'A']);

    const desc = sortData(data, { column: 'value', direction: 'desc' });
    expect(desc.data.map((r) => r.name)).toEqual(['B', 'C', 'A']);
  });

  it('is stable (preserves order for equal values)', () => {
    const data = [
      { name: 'First', value: 10 },
      { name: 'Second', value: 10 },
      { name: 'Third', value: 10 },
    ];
    const result = sortData(data, { column: 'value', direction: 'asc' });
    expect(result.data.map((r) => r.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('does not mutate the original array', () => {
    const data = [{ value: 30 }, { value: 10 }, { value: 20 }];
    const original = [...data];
    sortData(data, { column: 'value', direction: 'asc' });
    expect(data).toEqual(original);
  });

  it('handles single element array', () => {
    const data = [{ value: 42 }];
    const result = sortData(data, { column: 'value', direction: 'asc' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].value).toBe(42);
  });

  it('handles all null values', () => {
    const data = [
      { name: 'A', value: null },
      { name: 'B', value: null },
    ];
    const result = sortData(data, { column: 'value', direction: 'asc' });
    // Stable sort: original order preserved
    expect(result.data.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('returns correct originalIndices for sorted data', () => {
    const data = [
      { name: 'C', value: 30 },
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
    ];
    const result = sortData(data, { column: 'value', direction: 'asc' });
    // A (index 1) < B (index 2) < C (index 0)
    expect(result.originalIndices).toEqual([1, 2, 0]);
    expect(result.data.map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
});
