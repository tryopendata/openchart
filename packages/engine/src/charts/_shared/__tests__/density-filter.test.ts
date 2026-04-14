import { describe, expect, it } from 'vitest';
import { filterByDensity } from '../density-filter';

describe('filterByDensity', () => {
  const marks = ['a', 'b', 'c', 'd'];

  it("returns [] for 'none'", () => {
    expect(filterByDensity(marks, 'none')).toEqual([]);
  });

  it("returns first + last for 'endpoints'", () => {
    expect(filterByDensity(marks, 'endpoints')).toEqual(['a', 'd']);
  });

  it("returns marks unchanged for 'all'", () => {
    expect(filterByDensity(marks, 'all')).toBe(marks);
  });

  it("returns marks unchanged for 'auto'", () => {
    expect(filterByDensity(marks, 'auto')).toBe(marks);
  });

  it("returns single-element array unchanged for 'endpoints'", () => {
    const single = ['only'];
    expect(filterByDensity(single, 'endpoints')).toBe(single);
  });

  it("returns empty array unchanged for 'endpoints'", () => {
    const empty: string[] = [];
    expect(filterByDensity(empty, 'endpoints')).toBe(empty);
  });
});
