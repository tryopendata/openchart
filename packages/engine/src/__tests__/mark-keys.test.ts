/**
 * Integration tests for mark key stamping across chart types.
 *
 * Verifies that compileChart() stamps stable `key` fields on marks
 * for data-update transitions. Each chart type has its own keying
 * strategy; these tests verify the end-to-end pipeline.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const dims = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Column chart keys
// ---------------------------------------------------------------------------

describe('column chart mark keys', () => {
  it('stamps unique keys on simple column marks', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const layout = compileChart(spec, dims);
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects.length).toBe(3);

    for (const m of rects) {
      expect((m as { key?: string }).key).toBeDefined();
    }

    const keys = rects.map((m) => (m as { key?: string }).key);
    expect(new Set(keys).size).toBe(3);
  });

  it('deduplicates keys for duplicate category values', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { category: 'A', value: 10 },
        { category: 'A', value: 20 },
        { category: 'B', value: 30 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const layout = compileChart(spec, dims);
    const rects = layout.marks.filter((m) => m.type === 'rect');
    const keys = rects.map((m) => (m as { key?: string }).key);
    // All keys must be unique even with duplicate categories
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stamps keys on grouped columns', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { category: 'Q1', series: 'Revenue', value: 100 },
        { category: 'Q1', series: 'Cost', value: 60 },
        { category: 'Q2', series: 'Revenue', value: 150 },
        { category: 'Q2', series: 'Cost', value: 90 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    };
    const layout = compileChart(spec, dims);
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects.length).toBeGreaterThanOrEqual(4);

    const keys = rects.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// Bar chart keys
// ---------------------------------------------------------------------------

describe('bar chart mark keys', () => {
  it('stamps unique keys on horizontal bar marks', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'Alpha', value: 10 },
        { name: 'Beta', value: 30 },
        { name: 'Gamma', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
    };
    const layout = compileChart(spec, dims);
    const rects = layout.marks.filter((m) => m.type === 'rect');
    const keys = rects.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// Line chart keys
// ---------------------------------------------------------------------------

describe('line chart mark keys', () => {
  it('stamps key on line marks for multi-series', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data: [
        { date: '2020-01-01', value: 10, country: 'US' },
        { date: '2021-01-01', value: 40, country: 'US' },
        { date: '2020-01-01', value: 15, country: 'UK' },
        { date: '2021-01-01', value: 35, country: 'UK' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const layout = compileChart(spec, dims);
    const lines = layout.marks.filter((m) => m.type === 'line');
    expect(lines.length).toBe(2);

    const keys = lines.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(2);
  });

  it('stamps pointKeys on line marks with temporal x', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data: [
        { date: '2020-01-01', value: 10 },
        { date: '2021-01-01', value: 40 },
        { date: '2022-01-01', value: 25 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const layout = compileChart(spec, dims);
    const lines = layout.marks.filter((m) => m.type === 'line');
    expect(lines.length).toBe(1);

    const line = lines[0] as { pointKeys?: string[] };
    expect(line.pointKeys).toBeDefined();
    expect(line.pointKeys!.length).toBe(3);

    // Each point key should be a unique, defined string
    for (const pk of line.pointKeys!) {
      expect(pk).toBeDefined();
      expect(typeof pk).toBe('string');
    }
    expect(new Set(line.pointKeys!).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Scatter chart keys
// ---------------------------------------------------------------------------

describe('scatter chart mark keys', () => {
  it('stamps keys on scatter point marks', () => {
    const spec: ChartSpec = {
      mark: 'point',
      data: [
        { x: 10, y: 20, label: 'A' },
        { x: 30, y: 40, label: 'B' },
        { x: 50, y: 60, label: 'C' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    const layout = compileChart(spec, dims);
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBe(3);

    const keys = points.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(3);
  });

  it('uses encoding.key field when specified', () => {
    const spec: ChartSpec = {
      mark: 'point',
      data: [
        { x: 10, y: 20, id: 'item-1' },
        { x: 30, y: 40, id: 'item-2' },
        { x: 50, y: 60, id: 'item-3' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id' },
      },
    };
    const layout = compileChart(spec, dims);
    const points = layout.marks.filter((m) => m.type === 'point');
    const keys = points.map((m) => (m as { key?: string }).key);

    expect(keys).toContain('item-1');
    expect(keys).toContain('item-2');
    expect(keys).toContain('item-3');
  });
});

// ---------------------------------------------------------------------------
// Pie chart keys
// ---------------------------------------------------------------------------

describe('pie chart mark keys', () => {
  it('stamps keys on arc marks', () => {
    const spec: ChartSpec = {
      mark: 'arc',
      data: [
        { category: 'Desktop', share: 60 },
        { category: 'Mobile', share: 30 },
        { category: 'Tablet', share: 10 },
      ],
      encoding: {
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'category', type: 'nominal' },
      },
    };
    const layout = compileChart(spec, dims);
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBe(3);

    const keys = arcs.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Area chart keys
// ---------------------------------------------------------------------------

describe('area chart mark keys', () => {
  it('stamps key on area marks', () => {
    const spec: ChartSpec = {
      mark: 'area',
      data: [
        { date: '2020-01-01', value: 10, series: 'A' },
        { date: '2021-01-01', value: 40, series: 'A' },
        { date: '2020-01-01', value: 15, series: 'B' },
        { date: '2021-01-01', value: 35, series: 'B' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    };
    const layout = compileChart(spec, dims);
    const areas = layout.marks.filter((m) => m.type === 'area');
    expect(areas.length).toBe(2);

    const keys = areas.map((m) => (m as { key?: string }).key);
    for (const k of keys) {
      expect(k).toBeDefined();
    }
    expect(new Set(keys).size).toBe(2);
  });
});
