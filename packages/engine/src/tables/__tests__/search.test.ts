import type { ColumnConfig } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { buildSearchIndex, filterBySearch } from '../search';

const data = [
  { name: 'Alice Smith', age: 30, score: 88.5 },
  { name: 'Bob Johnson', age: 25, score: 92.1 },
  { name: 'Charlie Brown', age: 35, score: 76.3 },
];

const columns: ColumnConfig[] = [{ key: 'name' }, { key: 'age' }, { key: 'score' }];

describe('buildSearchIndex', () => {
  it('builds an index for all rows', () => {
    const index = buildSearchIndex(data, columns);
    expect(index.size).toBe(3);
    expect(index.has(0)).toBe(true);
    expect(index.has(1)).toBe(true);
    expect(index.has(2)).toBe(true);
  });

  it('includes all column values in the search string', () => {
    const index = buildSearchIndex(data, columns);
    const row0 = index.get(0)!;
    expect(row0).toContain('alice');
    expect(row0).toContain('30');
  });

  it('lowercases all values', () => {
    const index = buildSearchIndex(data, columns);
    const row0 = index.get(0)!;
    // Should be lowercase
    expect(row0).not.toContain('Alice');
    expect(row0).toContain('alice');
  });
});

describe('filterBySearch', () => {
  it('returns all data for empty query', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, '', index, indices);
    expect(result.data).toHaveLength(3);
    expect(result.indices).toEqual([0, 1, 2]);
  });

  it('returns all data for whitespace-only query', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, '   ', index, indices);
    expect(result.data).toHaveLength(3);
  });

  it('filters by substring match', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, 'alice', index, indices);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Alice Smith');
    expect(result.indices).toEqual([0]);
  });

  it('is case insensitive', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, 'ALICE', index, indices);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Alice Smith');
  });

  it('matches across formatted numeric values', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    // Search for a number value
    const result = filterBySearch(data, '35', index, indices);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Charlie Brown');
  });

  it('returns empty when no match', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, 'zzz_no_match', index, indices);
    expect(result.data).toHaveLength(0);
    expect(result.indices).toHaveLength(0);
  });

  it('preserves original indices through filtering', () => {
    const index = buildSearchIndex(data, columns);
    const indices = [0, 1, 2];
    const result = filterBySearch(data, 'brown', index, indices);
    expect(result.indices).toEqual([2]);
  });
});
