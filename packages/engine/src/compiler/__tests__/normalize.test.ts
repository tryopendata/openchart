import type { ChartSpec, GraphSpec, TableSpec } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { normalizeSpec } from '../normalize';
import type { NormalizedChartSpec, NormalizedGraphSpec, NormalizedTableSpec } from '../types';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 20, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'GDP Growth',
    subtitle: { text: 'Over time', style: { fontSize: 16 } },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeSpec', () => {
  describe('chart spec normalization', () => {
    it('fills default values for optionals', () => {
      const warnings: string[] = [];
      const result = normalizeSpec(lineSpec, warnings) as NormalizedChartSpec;

      expect(result.responsive).toBe(true);
      expect(result.darkMode).toBe('off');
      expect(result.annotations).toEqual([]);
      expect(result.theme).toEqual({});
      expect(result.labels).toEqual({ density: 'auto', format: '' });
    });

    it('preserves explicit values', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        responsive: false,
        darkMode: 'force',
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;

      expect(result.responsive).toBe(false);
      expect(result.darkMode).toBe('force');
    });

    it('normalizes chrome strings to ChromeText objects', () => {
      const result = normalizeSpec(lineSpec) as NormalizedChartSpec;

      // Plain string becomes ChromeText
      expect(result.chrome.title).toEqual({ text: 'GDP Growth' });
      // ChromeText with style is preserved
      expect(result.chrome.subtitle).toEqual({
        text: 'Over time',
        style: { fontSize: 16 },
      });
      // Undefined fields stay undefined
      expect(result.chrome.source).toBeUndefined();
    });

    it('infers encoding types from data when not specified', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        type: 'scatter',
        data: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        encoding: {
          // No type specified, should be inferred as quantitative
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y' } as any,
        },
      };

      const result = normalizeSpec(spec, warnings) as NormalizedChartSpec;
      expect(result.encoding.y?.type).toBe('quantitative');
      expect(warnings.some((w) => w.includes('Inferred'))).toBe(true);
    });

    it('infers temporal type from date strings', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        type: 'line',
        data: [
          { date: '2020-01-01', value: 10 },
          { date: '2021-06-15', value: 20 },
        ],
        encoding: {
          x: { field: 'date' } as any,
          y: { field: 'value', type: 'quantitative' },
        },
      };

      const result = normalizeSpec(spec, warnings) as NormalizedChartSpec;
      expect(result.encoding.x?.type).toBe('temporal');
    });

    it('warns on type mismatch (temporal declared as nominal)', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        type: 'line',
        data: [
          { date: '2020-01-01', value: 10 },
          { date: '2021-06-15', value: 20 },
        ],
        encoding: {
          x: { field: 'date', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      };

      normalizeSpec(spec, warnings);
      expect(warnings.some((w) => w.includes('looks temporal but was declared as nominal'))).toBe(
        true,
      );
    });

    it('preserves explicit label config', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        labels: { density: 'none', format: ',.0f' },
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;
      expect(result.labels).toEqual({ density: 'none', format: ',.0f' });
    });

    it('fills partial label config with defaults', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        labels: { density: 'endpoints' },
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;
      expect(result.labels).toEqual({ density: 'endpoints', format: '' });
    });

    it('normalizes annotations with default styles', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        annotations: [
          { type: 'refline', y: 15 },
          { type: 'text', x: '2020-01-01', y: 10, text: 'Start' },
          { type: 'range', y1: 10, y2: 20 },
        ],
      };

      const result = normalizeSpec(spec) as NormalizedChartSpec;
      const refline = result.annotations[0] as any;
      expect(refline.style).toBe('dashed');
      expect(refline.strokeWidth).toBe(1);

      const text = result.annotations[1] as any;
      expect(text.fontSize).toBe(12);

      const range = result.annotations[2] as any;
      expect(range.opacity).toBe(0.1);
    });
  });

  describe('table spec normalization', () => {
    it('fills default values', () => {
      const spec: TableSpec = {
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
      };

      const result = normalizeSpec(spec) as NormalizedTableSpec;
      expect(result.search).toBe(false);
      expect(result.pagination).toBe(false);
      expect(result.stickyFirstColumn).toBe(false);
      expect(result.compact).toBe(false);
      expect(result.responsive).toBe(true);
      expect(result.darkMode).toBe('off');
    });
  });

  describe('graph spec normalization', () => {
    it('fills default values', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
      };

      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.encoding).toEqual({});
      expect(result.layout).toEqual({ type: 'force', chargeStrength: -300, linkDistance: 30 });
      expect(result.annotations).toEqual([]);
      expect(result.darkMode).toBe('off');
    });
  });
});
