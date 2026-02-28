import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeScales } from '../layout/scales';

const lineSpec: NormalizedChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 50, country: 'US' },
    { date: '2022-01-01', value: 30, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {},
  annotations: [],
  responsive: true,
  theme: {},
  darkMode: 'off',
  labels: { density: 'auto', format: '' },
};

const barSpec: NormalizedChartSpec = {
  type: 'bar',
  data: [
    { category: 'A', count: 10 },
    { category: 'B', count: 30 },
    { category: 'C', count: 20 },
  ],
  encoding: {
    x: { field: 'count', type: 'quantitative' },
    y: { field: 'category', type: 'nominal' },
  },
  chrome: {},
  annotations: [],
  responsive: true,
  theme: {},
  darkMode: 'off',
  labels: { density: 'auto', format: '' },
};

const chartArea = { x: 50, y: 50, width: 500, height: 300 };

describe('computeScales', () => {
  it('creates a time scale for temporal x encoding', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    expect(scales.x).toBeDefined();
    expect(scales.x!.type).toBe('time');

    // The scale should map dates within the range
    const pos = scales.x!.scale(new Date('2020-06-01'));
    expect(pos).toBeGreaterThanOrEqual(chartArea.x);
    expect(pos).toBeLessThanOrEqual(chartArea.x + chartArea.width);
  });

  it('creates a linear scale for quantitative y encoding', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    expect(scales.y).toBeDefined();
    expect(scales.y!.type).toBe('linear');

    // Y is inverted (SVG coordinates)
    const domain = scales.y!.scale.domain();
    expect(domain[0]).toBeLessThanOrEqual(0); // Should include 0
    expect(domain[1]).toBeGreaterThanOrEqual(50);
  });

  it('includes zero in quantitative domain by default', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const domain = scales.y!.scale.domain();
    expect(domain[0]).toBe(0);
  });

  it('creates an ordinal scale for color encoding', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    expect(scales.color).toBeDefined();
    expect(scales.color!.type).toBe('ordinal');

    const usColor = scales.color!.scale('US');
    const ukColor = scales.color!.scale('UK');
    expect(typeof usColor).toBe('string');
    expect(usColor).not.toBe(ukColor);
  });

  it('creates band scales for bar chart categorical axis', () => {
    const scales = computeScales(barSpec, chartArea, barSpec.data);
    expect(scales.y).toBeDefined();
    expect(scales.y!.type).toBe('band');

    // Band scale should have bandwidth
    expect(scales.y!.scale.bandwidth()).toBeGreaterThan(0);
  });

  it('derives correct domain from data', () => {
    const scales = computeScales(barSpec, chartArea, barSpec.data);

    // Y should have all categories
    const yDomain = scales.y!.scale.domain();
    expect(yDomain).toContain('A');
    expect(yDomain).toContain('B');
    expect(yDomain).toContain('C');

    // X domain should span 0 to >= max value
    const xDomain = scales.x!.scale.domain();
    expect(xDomain[0]).toBe(0);
    expect(xDomain[1]).toBeGreaterThanOrEqual(30);
  });
});
