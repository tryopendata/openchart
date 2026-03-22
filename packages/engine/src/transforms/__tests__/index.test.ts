import { describe, expect, it } from 'vitest';
import { runTransforms } from '../index';

describe('runTransforms', () => {
  it('runs transforms in order', () => {
    const data = [
      { name: 'Alice', value: 10 },
      { name: 'Bob', value: 20 },
      { name: 'Carol', value: 30 },
    ];

    // First filter, then calculate on the filtered result
    const result = runTransforms(data, [
      { filter: { field: 'value', gte: 15 } },
      { calculate: { op: '*', field: 'value', value: 2 }, as: 'doubled' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Bob');
    expect(result[0].doubled).toBe(40);
    expect(result[1].name).toBe('Carol');
    expect(result[1].doubled).toBe(60);
  });

  it('applies filter after calculate', () => {
    const data = [{ value: 3 }, { value: 7 }, { value: 12 }];

    // Calculate first, then filter on the calculated field
    const result = runTransforms(data, [
      { calculate: { op: '*', field: 'value', value: 10 }, as: 'scaled' },
      { filter: { field: 'scaled', gt: 50 } },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].scaled).toBe(70);
    expect(result[1].scaled).toBe(120);
  });

  it('chains bin and filter', () => {
    const data = [{ value: 5 }, { value: 15 }, { value: 25 }, { value: 35 }];

    const result = runTransforms(data, [
      { bin: { step: 10, extent: [0, 40] }, field: 'value', as: 'binned' },
      { filter: { field: 'binned', gte: 20 } },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(25);
    expect(result[1].value).toBe(35);
  });

  it('chains timeUnit and filter', () => {
    const data = [
      { date: new Date(2024, 0, 15) }, // January
      { date: new Date(2024, 5, 15) }, // June
      { date: new Date(2024, 11, 15) }, // December
    ];

    const result = runTransforms(data, [
      { timeUnit: 'month' as const, field: 'date', as: 'month' },
      { filter: { field: 'month', gte: 5 } }, // June onwards (0-indexed)
    ]);

    expect(result).toHaveLength(2);
  });

  it('returns original data for empty transform array', () => {
    const data = [{ x: 1 }];
    const result = runTransforms(data, []);
    expect(result).toEqual(data);
    expect(result).toBe(data); // Same reference since no transforms applied
  });

  it('handles multiple filters in sequence', () => {
    const data = [
      { x: 1, y: 10 },
      { x: 5, y: 20 },
      { x: 8, y: 30 },
      { x: 12, y: 40 },
    ];

    const result = runTransforms(data, [
      { filter: { field: 'x', gt: 3 } },
      { filter: { field: 'y', lt: 35 } },
    ]);

    // x>3 keeps: {5,20}, {8,30}, {12,40}
    // y<35 keeps: {5,20}, {8,30}
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 5, y: 20 });
    expect(result[1]).toEqual({ x: 8, y: 30 });
  });
});
