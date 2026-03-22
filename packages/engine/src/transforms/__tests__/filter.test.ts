import { describe, expect, it } from 'vitest';
import { runFilter } from '../filter';

describe('runFilter', () => {
  const data = [
    { name: 'Alice', age: 25, city: 'NYC' },
    { name: 'Bob', age: 30, city: 'LA' },
    { name: 'Carol', age: 35, city: 'NYC' },
    { name: 'Dave', age: 40, city: 'LA' },
  ];

  it('filters by field equality', () => {
    const result = runFilter(data, { field: 'city', equal: 'NYC' });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Carol']);
  });

  it('filters by numeric comparison', () => {
    const result = runFilter(data, { field: 'age', gt: 30 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Carol', 'Dave']);
  });

  it('filters with logical AND', () => {
    const result = runFilter(data, {
      and: [
        { field: 'city', equal: 'LA' },
        { field: 'age', gte: 35 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dave');
  });

  it('filters with logical OR', () => {
    const result = runFilter(data, {
      or: [
        { field: 'name', equal: 'Alice' },
        { field: 'name', equal: 'Dave' },
      ],
    });
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no rows match', () => {
    const result = runFilter(data, { field: 'age', gt: 100 });
    expect(result).toHaveLength(0);
  });

  it('returns all rows when all match', () => {
    const result = runFilter(data, { field: 'age', gt: 0 });
    expect(result).toHaveLength(4);
  });

  it('handles empty data', () => {
    const result = runFilter([], { field: 'age', gt: 0 });
    expect(result).toHaveLength(0);
  });
});
