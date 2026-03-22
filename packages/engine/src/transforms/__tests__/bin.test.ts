import { describe, expect, it } from 'vitest';
import { runBin } from '../bin';

describe('runBin', () => {
  const data = [{ value: 2 }, { value: 7 }, { value: 12 }, { value: 18 }, { value: 23 }];

  it('bins with default params (bin: true)', () => {
    const result = runBin(data, { bin: true, field: 'value', as: 'binned' });
    expect(result).toHaveLength(5);
    // Each row should have a 'binned' field
    for (const row of result) {
      expect(row).toHaveProperty('binned');
    }
    // Original data should be preserved
    expect(result[0].value).toBe(2);
  });

  it('bins with explicit maxbins', () => {
    const result = runBin(data, {
      bin: { maxbins: 5 },
      field: 'value',
      as: 'binned',
    });
    // With 5 bins over range 2-23, step should be roughly 5
    const binValues = new Set(result.map((r) => r.binned));
    expect(binValues.size).toBeGreaterThanOrEqual(2);
    expect(binValues.size).toBeLessThanOrEqual(6);
  });

  it('bins with explicit step', () => {
    const result = runBin(data, {
      bin: { step: 10 },
      field: 'value',
      as: 'binned',
    });
    // Step=10 from extent [2,23]: bins at 2, 12, 22
    const binValues = [...new Set(result.map((r) => r.binned))].sort(
      (a, b) => (a as number) - (b as number),
    );
    expect(binValues.length).toBeGreaterThanOrEqual(2);
  });

  it('produces [start, end] when as is a tuple', () => {
    const result = runBin(data, {
      bin: { step: 10 },
      field: 'value',
      as: ['bin_start', 'bin_end'],
    });
    for (const row of result) {
      expect(row).toHaveProperty('bin_start');
      expect(row).toHaveProperty('bin_end');
      if (row.bin_start !== null) {
        expect((row.bin_end as number) - (row.bin_start as number)).toBe(10);
      }
    }
  });

  it('bins with explicit extent', () => {
    const result = runBin(data, {
      bin: { extent: [0, 30], step: 10 },
      field: 'value',
      as: 'binned',
    });
    // All values should fall in bins starting at 0, 10, 20
    const binValues = new Set(result.map((r) => r.binned));
    for (const v of binValues) {
      expect([0, 10, 20]).toContain(v);
    }
  });

  it('handles NaN values gracefully', () => {
    const dataWithNaN = [{ value: 5 }, { value: NaN }];
    const result = runBin(dataWithNaN, { bin: true, field: 'value', as: 'binned' });
    expect(result[1].binned).toBeNull();
  });

  it('handles empty data', () => {
    const result = runBin([], { bin: true, field: 'value', as: 'binned' });
    expect(result).toHaveLength(0);
  });

  it('preserves existing fields', () => {
    const dataWithExtra = [{ value: 5, name: 'test' }];
    const result = runBin(dataWithExtra, { bin: true, field: 'value', as: 'binned' });
    expect(result[0].name).toBe('test');
    expect(result[0].value).toBe(5);
  });
});
