/**
 * Tests for encoding-level bin, timeUnit, and sort shorthand expansion.
 *
 * These test the Vega-Lite-aligned encoding sugar that auto-generates
 * transforms (bin, timeUnit) and applies sort to categorical scales.
 */

import type { ScaleBand, ScaleOrdinal, ScalePoint } from 'd3-scale';
import { describe, expect, it } from 'vitest';
import { expandEncodingSugar } from '../compile';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// expandEncodingSugar: bin
// ---------------------------------------------------------------------------

describe('expandEncodingSugar', () => {
  describe('bin expansion', () => {
    it('expands encoding.x.bin: true into a BinTransform', () => {
      const spec = {
        mark: 'bar',
        data: [{ val: 10 }, { val: 20 }],
        encoding: {
          x: { field: 'val', type: 'quantitative', bin: true },
          y: { field: 'count', type: 'quantitative' },
        },
      };

      const result = expandEncodingSugar(spec);

      // Should generate a bin transform
      expect(result.transform).toHaveLength(1);
      expect(result.transform).toEqual([{ bin: true, field: 'val', as: 'bin_val' }]);

      // Encoding field should reference the binned output
      const encoding = result.encoding as Record<string, { field: string; bin?: unknown }>;
      expect(encoding.x.field).toBe('bin_val');
      // bin property should be removed from the encoding channel
      expect(encoding.x.bin).toBeUndefined();
    });

    it('expands encoding.y.bin with BinParams', () => {
      const spec = {
        mark: 'bar',
        data: [],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'score', type: 'quantitative', bin: { maxbins: 20 } },
        },
      };

      const result = expandEncodingSugar(spec);

      expect(result.transform).toHaveLength(1);
      expect(result.transform).toEqual([{ bin: { maxbins: 20 }, field: 'score', as: 'bin_score' }]);

      const encoding = result.encoding as Record<string, { field: string }>;
      expect(encoding.y.field).toBe('bin_score');
    });

    it('does not expand bin: false', () => {
      const spec = {
        mark: 'bar',
        data: [],
        encoding: {
          x: { field: 'val', type: 'quantitative', bin: false },
          y: { field: 'count', type: 'quantitative' },
        },
      };

      const result = expandEncodingSugar(spec);

      // No transform generated, spec returned as-is
      expect(result.transform).toBeUndefined();
      expect(result).toBe(spec);
    });

    it('prepends generated transforms before existing transforms', () => {
      const spec = {
        mark: 'bar',
        data: [],
        encoding: {
          x: { field: 'val', type: 'quantitative', bin: true },
          y: { field: 'count', type: 'quantitative' },
        },
        transform: [{ filter: { field: 'active', equal: true } }],
      };

      const result = expandEncodingSugar(spec);

      expect(result.transform).toHaveLength(2);
      // Generated bin transform comes first
      expect((result.transform as Array<Record<string, unknown>>)[0]).toHaveProperty('bin');
      // User-defined filter comes after
      expect((result.transform as Array<Record<string, unknown>>)[1]).toHaveProperty('filter');
    });
  });

  // ---------------------------------------------------------------------------
  // expandEncodingSugar: timeUnit
  // ---------------------------------------------------------------------------

  describe('timeUnit expansion', () => {
    it('expands encoding.x.timeUnit into a TimeUnitTransform', () => {
      const spec = {
        mark: 'line',
        data: [],
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
          y: { field: 'value', type: 'quantitative' },
        },
      };

      const result = expandEncodingSugar(spec);

      expect(result.transform).toHaveLength(1);
      expect(result.transform).toEqual([
        { timeUnit: 'yearmonth', field: 'date', as: 'yearmonth_date' },
      ]);

      const encoding = result.encoding as Record<string, { field: string; timeUnit?: unknown }>;
      expect(encoding.x.field).toBe('yearmonth_date');
      expect(encoding.x.timeUnit).toBeUndefined();
    });

    it('expands encoding.y.timeUnit: month', () => {
      const spec = {
        mark: 'bar',
        data: [],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'timestamp', type: 'temporal', timeUnit: 'month' },
        },
      };

      const result = expandEncodingSugar(spec);

      expect(result.transform).toHaveLength(1);
      expect(result.transform).toEqual([
        { timeUnit: 'month', field: 'timestamp', as: 'month_timestamp' },
      ]);

      const encoding = result.encoding as Record<string, { field: string }>;
      expect(encoding.y.field).toBe('month_timestamp');
    });
  });

  // ---------------------------------------------------------------------------
  // Combined bin + timeUnit
  // ---------------------------------------------------------------------------

  describe('combined expansions', () => {
    it('expands both bin on x and timeUnit on y', () => {
      const spec = {
        mark: 'point',
        data: [],
        encoding: {
          x: { field: 'amount', type: 'quantitative', bin: true },
          y: { field: 'created', type: 'temporal', timeUnit: 'year' },
        },
      };

      const result = expandEncodingSugar(spec);

      expect(result.transform).toHaveLength(2);
      expect((result.transform as Array<Record<string, unknown>>)[0]).toEqual({
        bin: true,
        field: 'amount',
        as: 'bin_amount',
      });
      expect((result.transform as Array<Record<string, unknown>>)[1]).toEqual({
        timeUnit: 'year',
        field: 'created',
        as: 'year_created',
      });

      const encoding = result.encoding as Record<string, { field: string }>;
      expect(encoding.x.field).toBe('bin_amount');
      expect(encoding.y.field).toBe('year_created');
    });

    it('returns spec unchanged when no encoding sugar is present', () => {
      const spec = {
        mark: 'line',
        data: [],
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      };

      const result = expandEncodingSugar(spec);
      expect(result).toBe(spec); // Same reference, no copy needed
    });

    it('returns spec unchanged when no encoding is present', () => {
      const spec = { mark: 'line', data: [] };
      const result = expandEncodingSugar(spec);
      expect(result).toBe(spec);
    });
  });
});

// ---------------------------------------------------------------------------
// Sort on categorical scales
// ---------------------------------------------------------------------------

describe('categorical sort', () => {
  const chartArea = { x: 0, y: 0, width: 400, height: 300 };

  const makeBarSpec = (
    sort: 'ascending' | 'descending' | null | undefined,
  ): NormalizedChartSpec => ({
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'Banana', count: 10 },
      { category: 'Apple', count: 30 },
      { category: 'Cherry', count: 20 },
    ],
    encoding: {
      x: { field: 'count', type: 'quantitative' },
      y: { field: 'category', type: 'nominal', sort },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    watermark: true,
    hiddenSeries: [],
    seriesStyles: {},
  });

  it('preserves data order by default (undefined sort)', () => {
    const spec = makeBarSpec(undefined);
    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    // Data order: Banana, Apple, Cherry
    expect(domain).toEqual(['Banana', 'Apple', 'Cherry']);
  });

  it('sorts domain ascending when sort is "ascending"', () => {
    const spec = makeBarSpec('ascending');
    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    expect(domain).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('sorts domain descending when sort is "descending"', () => {
    const spec = makeBarSpec('descending');
    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    expect(domain).toEqual(['Cherry', 'Banana', 'Apple']);
  });

  it('preserves data order when sort is null', () => {
    const spec = makeBarSpec(null);
    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    // Data order: Banana, Apple, Cherry
    expect(domain).toEqual(['Banana', 'Apple', 'Cherry']);
  });

  it('applies sort to point scales (nominal x on line chart)', () => {
    const spec: NormalizedChartSpec = {
      markType: 'line',
      markDef: { type: 'line' },
      data: [
        { name: 'Zara', score: 10 },
        { name: 'Alice', score: 20 },
        { name: 'Mike', score: 15 },
      ],
      encoding: {
        x: { field: 'name', type: 'nominal', sort: 'descending' },
        y: { field: 'score', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '', prefix: '' },
      watermark: true,
      hiddenSeries: [],
      seriesStyles: {},
    };

    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.x!.scale as ScalePoint<string>).domain();
    expect(domain).toEqual(['Zara', 'Mike', 'Alice']);
  });

  it('applies sort to ordinal color scales', () => {
    const spec: NormalizedChartSpec = {
      markType: 'line',
      markDef: { type: 'line' },
      data: [
        { date: '2020-01-01', value: 10, group: 'Gamma' },
        { date: '2020-01-01', value: 20, group: 'Alpha' },
        { date: '2020-01-01', value: 15, group: 'Beta' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'group', type: 'nominal', sort: 'ascending' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '', prefix: '' },
      watermark: true,
      hiddenSeries: [],
      seriesStyles: {},
    };

    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.color!.scale as ScaleOrdinal<string, string>).domain();
    expect(domain).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts numerically when values are numeric strings', () => {
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar' },
      data: [
        { category: '10', count: 1 },
        { category: '2', count: 2 },
        { category: '1', count: 3 },
      ],
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'category', type: 'nominal', sort: 'ascending' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '', prefix: '' },
      watermark: true,
      hiddenSeries: [],
      seriesStyles: {},
    };

    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    // numeric: true in localeCompare means "1" < "2" < "10"
    expect(domain).toEqual(['1', '2', '10']);
  });

  it('does not sort when explicit scale.domain is provided', () => {
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar' },
      data: [
        { category: 'C', count: 10 },
        { category: 'A', count: 20 },
        { category: 'B', count: 30 },
      ],
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: {
          field: 'category',
          type: 'nominal',
          sort: 'ascending',
          scale: { domain: ['C', 'B', 'A'] },
        },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '', prefix: '' },
      watermark: true,
      hiddenSeries: [],
      seriesStyles: {},
    };

    const scales = computeScales(spec, chartArea, spec.data);
    const domain = (scales.y!.scale as ScaleBand<string>).domain();
    // Explicit domain takes precedence over sort
    expect(domain).toEqual(['C', 'B', 'A']);
  });
});
