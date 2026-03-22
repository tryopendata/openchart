import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeScales } from '../layout/scales';

const lineSpec: NormalizedChartSpec = {
  markType: 'line',
  markDef: { type: 'line' },
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
  markType: 'bar',
  markDef: { type: 'bar' },
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

// ---------------------------------------------------------------------------
// Expanded scale type tests
// ---------------------------------------------------------------------------

/** Helper to make a spec with an explicit scale type on the y axis. */
function makeQuantSpec(scaleConfig: Record<string, unknown>): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { x: 1, y: 1 },
      { x: 2, y: 10 },
      { x: 3, y: 100 },
      { x: 4, y: 1000 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative', scale: scaleConfig },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  } as NormalizedChartSpec;
}

describe('expanded scale types', () => {
  it('creates a log scale with explicit type override', () => {
    const spec = makeQuantSpec({ type: 'log' });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('log');
    // Log scale maps multiplicatively - position for 10 should be between 1 and 100
    const pos1 = scales.y!.scale(1) as number;
    const pos10 = scales.y!.scale(10) as number;
    const pos100 = scales.y!.scale(100) as number;
    expect(pos10).toBeLessThan(pos1); // Y is inverted
    expect(pos10).toBeGreaterThan(pos100);
  });

  it('applies base config to log scale', () => {
    const spec = makeQuantSpec({ type: 'log', base: 2 });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('log');
  });

  it('creates a pow scale with exponent', () => {
    const spec = makeQuantSpec({ type: 'pow', exponent: 2 });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('pow');
    // Pow scale should still map data to pixel range
    const pos = scales.y!.scale(50) as number;
    expect(pos).toBeGreaterThanOrEqual(chartArea.y);
    expect(pos).toBeLessThanOrEqual(chartArea.y + chartArea.height);
  });

  it('creates a sqrt scale', () => {
    const spec = makeQuantSpec({ type: 'sqrt' });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('sqrt');
  });

  it('creates a symlog scale with constant', () => {
    const spec = makeQuantSpec({ type: 'symlog', constant: 2 });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('symlog');
  });

  it('creates a utc scale for explicit utc type', () => {
    const spec: NormalizedChartSpec = {
      markType: 'line',
      markDef: { type: 'line' },
      data: [
        { date: '2020-01-01', value: 10 },
        { date: '2022-01-01', value: 30 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal', scale: { type: 'utc' } },
        y: { field: 'value', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.x!.type).toBe('utc');
  });

  it('creates a quantile scale', () => {
    const spec = makeQuantSpec({ type: 'quantile' });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('quantile');
  });

  it('creates a quantize scale', () => {
    const spec = makeQuantSpec({ type: 'quantize' });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('quantize');
  });

  it('creates a threshold scale', () => {
    const spec = makeQuantSpec({ type: 'threshold', domain: [10, 100] });
    const scales = computeScales(spec, chartArea, spec.data);
    expect(scales.y!.type).toBe('threshold');
  });
});

describe('scale config properties', () => {
  it('applies clamp to linear scale', () => {
    const spec = makeQuantSpec({ type: 'linear', domain: [0, 100], clamp: true });
    const scales = computeScales(spec, chartArea, spec.data);
    // Values outside domain should be clamped to range edges
    const posAbove = scales.y!.scale(200) as number;
    const posAtMax = scales.y!.scale(100) as number;
    expect(posAbove).toBe(posAtMax);
  });

  it('applies reverse to linear scale', () => {
    const specNormal = makeQuantSpec({ type: 'linear' });
    const specReversed = makeQuantSpec({ type: 'linear', reverse: true });
    const normal = computeScales(specNormal, chartArea, specNormal.data);
    const reversed = computeScales(specReversed, chartArea, specReversed.data);

    // In a reversed scale, higher values should map to the opposite end
    const normalRange = normal.y!.scale.range() as number[];
    const reversedRange = reversed.y!.scale.range() as number[];
    expect(normalRange[0]).toBe(reversedRange[1]);
    expect(normalRange[1]).toBe(reversedRange[0]);
  });

  it('applies padding to band scale', () => {
    const specDefault: NormalizedChartSpec = {
      ...barSpec,
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
    };
    const specPadded: NormalizedChartSpec = {
      ...barSpec,
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'category', type: 'nominal', scale: { padding: 0.1 } },
      },
    };

    const defaultScales = computeScales(specDefault, chartArea, specDefault.data);
    const paddedScales = computeScales(specPadded, chartArea, specPadded.data);

    // Smaller padding = wider bands
    const defaultBandwidth = defaultScales.y!.scale.bandwidth!() as number;
    const paddedBandwidth = paddedScales.y!.scale.bandwidth!() as number;
    expect(paddedBandwidth).toBeGreaterThan(defaultBandwidth);
  });

  it('backward compatible: existing specs still work', () => {
    // lineSpec and barSpec from before should still produce valid scales
    const lineScales = computeScales(lineSpec, chartArea, lineSpec.data);
    expect(lineScales.x!.type).toBe('time');
    expect(lineScales.y!.type).toBe('linear');
    expect(lineScales.color!.type).toBe('ordinal');

    const barScales = computeScales(barSpec, chartArea, barSpec.data);
    expect(barScales.x!.type).toBe('linear');
    expect(barScales.y!.type).toBe('band');
  });
});
