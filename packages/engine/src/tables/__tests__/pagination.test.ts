import { describe, expect, it } from 'vitest';
import { paginateData } from '../pagination';

const data = Array.from({ length: 50 }, (_, i) => ({ id: i, value: i * 10 }));

describe('paginateData', () => {
  it('returns the correct page slice', () => {
    const result = paginateData(data, 0, 10);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].id).toBe(0);
    expect(result.rows[9].id).toBe(9);
  });

  it('returns correct second page', () => {
    const result = paginateData(data, 1, 10);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].id).toBe(10);
    expect(result.rows[9].id).toBe(19);
  });

  it('returns correct last page (partial)', () => {
    // 50 items, page size 15 = 4 pages (15+15+15+5)
    const result = paginateData(data, 3, 15);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0].id).toBe(45);
  });

  it('clamps page to valid range (too high)', () => {
    const result = paginateData(data, 999, 10);
    expect(result.page).toBe(4); // Last page (0-indexed)
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].id).toBe(40);
  });

  it('clamps page to valid range (negative)', () => {
    const result = paginateData(data, -5, 10);
    expect(result.page).toBe(0);
    expect(result.rows[0].id).toBe(0);
  });

  it('computes totalPages correctly', () => {
    const result = paginateData(data, 0, 10);
    expect(result.totalPages).toBe(5);
    expect(result.totalRows).toBe(50);
  });

  it('computes totalPages for non-even division', () => {
    const result = paginateData(data, 0, 15);
    expect(result.totalPages).toBe(4); // ceil(50/15) = 4
  });

  it('handles disabled pagination (pageSize <= 0)', () => {
    const result = paginateData(data, 0, 0);
    expect(result.rows).toHaveLength(50);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(0);
  });

  it('handles negative pageSize as disabled', () => {
    const result = paginateData(data, 0, -10);
    expect(result.rows).toHaveLength(50);
    expect(result.totalPages).toBe(1);
  });

  it('handles empty data', () => {
    const result = paginateData([], 0, 10);
    expect(result.rows).toHaveLength(0);
    expect(result.totalRows).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(0);
  });

  it('handles single row', () => {
    const result = paginateData([{ id: 1 }], 0, 10);
    expect(result.rows).toHaveLength(1);
    expect(result.totalPages).toBe(1);
  });
});
