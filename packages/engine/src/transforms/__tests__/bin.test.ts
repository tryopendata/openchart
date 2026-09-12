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

  // ---------------------------------------------------------------------------
  // Log-spaced binning
  // ---------------------------------------------------------------------------

  describe('log-spaced binning (scaleType: "log")', () => {
    // Skewed data typical of campaign finance contributions
    const skewedData = [
      { amount: 1 },
      { amount: 5 },
      { amount: 10 },
      { amount: 50 },
      { amount: 100 },
      { amount: 500 },
      { amount: 1000 },
      { amount: 5000 },
    ];

    it('produces log-spaced bin edges', () => {
      const result = runBin(skewedData, {
        bin: { maxbins: 4, scaleType: 'log' },
        field: 'amount',
        as: ['bin_start', 'bin_end'],
      });

      // With 4 bins over [1, 5000], edges are at 10^(0/4 * log10(5000)), etc.
      // Small values should NOT all collapse into a single bin (the linear bug).
      const binStarts = new Set(result.filter((r) => r.bin_start !== null).map((r) => r.bin_start));
      // With skewed data spanning 4 orders of magnitude, log binning should
      // spread values across multiple bins, not collapse them.
      expect(binStarts.size).toBeGreaterThanOrEqual(3);
    });

    it('bin edges are equal-width in log space', () => {
      const result = runBin(skewedData, {
        bin: { maxbins: 4, scaleType: 'log' },
        field: 'amount',
        as: ['bin_start', 'bin_end'],
      });

      // Collect unique (start, end) pairs
      const edges = new Map<number, number>();
      for (const row of result) {
        if (row.bin_start !== null) {
          edges.set(row.bin_start as number, row.bin_end as number);
        }
      }

      // Each bin's ratio end/start should be roughly equal (equal in log space)
      const ratios = [...edges.entries()].map(([start, end]) => end / start);
      if (ratios.length > 1) {
        const firstRatio = ratios[0];
        for (const ratio of ratios) {
          expect(ratio).toBeCloseTo(firstRatio, 5);
        }
      }
    });

    it('handles zero and negative values by nulling them', () => {
      const dataWithZero = [{ v: 0 }, { v: -5 }, { v: 10 }, { v: 100 }];
      const result = runBin(dataWithZero, {
        bin: { maxbins: 5, scaleType: 'log' },
        field: 'v',
        as: ['bin_start', 'bin_end'],
      });

      // Zero and negative values should be null (log undefined)
      expect(result[0].bin_start).toBeNull();
      expect(result[1].bin_start).toBeNull();
      // Positive values should be binned
      expect(result[2].bin_start).not.toBeNull();
      expect(result[3].bin_start).not.toBeNull();
    });

    it('produces start/end pair for each row', () => {
      const result = runBin(skewedData, {
        bin: { maxbins: 10, scaleType: 'log' },
        field: 'amount',
        as: ['bin_start', 'bin_end'],
      });

      for (const row of result) {
        if (row.bin_start !== null) {
          expect(row.bin_end).not.toBeNull();
          expect(row.bin_end as number).toBeGreaterThan(row.bin_start as number);
        }
      }
    });

    it('works with single-field as (no end)', () => {
      const result = runBin(skewedData, {
        bin: { maxbins: 5, scaleType: 'log' },
        field: 'amount',
        as: 'binned',
      });

      for (const row of result) {
        expect(row).toHaveProperty('binned');
      }
      // Should have multiple distinct bins
      const bins = new Set(result.map((r) => r.binned));
      expect(bins.size).toBeGreaterThanOrEqual(3);
    });

    it('preserves original data fields', () => {
      const dataWithExtra = [{ amount: 100, name: 'test' }];
      const result = runBin(dataWithExtra, {
        bin: { maxbins: 5, scaleType: 'log' },
        field: 'amount',
        as: 'binned',
      });
      expect(result[0].name).toBe('test');
      expect(result[0].amount).toBe(100);
    });
  });
});
