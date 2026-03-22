import type { LegendLayout } from '@opendata-ai/openchart-core';
import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeDimensions } from '../layout/dimensions';

const baseSpec: NormalizedChartSpec = {
  markType: 'line',
  markDef: { type: 'line' },
  data: [
    { date: '2020-01-01', value: 10 },
    { date: '2021-01-01', value: 20 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: { text: 'Test Chart' } },
  annotations: [],
  responsive: true,
  theme: {},
  darkMode: 'off',
  labels: { density: 'auto', format: '' },
};

const lightTheme = resolveTheme(baseSpec.theme);
const darkTheme = adaptTheme(lightTheme);

const emptyLegend: LegendLayout = {
  position: 'top',
  entries: [],
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  labelStyle: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 400,
    fill: '#333',
    lineHeight: 1.3,
  },
  swatchSize: 12,
  swatchGap: 6,
  entryGap: 16,
};

const rightLegend: LegendLayout = {
  ...emptyLegend,
  position: 'right',
  entries: [{ label: 'US', color: '#1b7fa3', shape: 'line' }],
  bounds: { x: 500, y: 0, width: 100, height: 200 },
};

const topLegend: LegendLayout = {
  ...emptyLegend,
  position: 'top',
  entries: [{ label: 'US', color: '#1b7fa3', shape: 'line' }],
  bounds: { x: 0, y: 0, width: 400, height: 28 },
};

describe('computeDimensions', () => {
  it('computes chart area within total dimensions', () => {
    const dims = computeDimensions(baseSpec, { width: 600, height: 400 }, emptyLegend, lightTheme);

    expect(dims.total).toEqual({ x: 0, y: 0, width: 600, height: 400 });
    expect(dims.chartArea.width).toBeLessThan(600);
    expect(dims.chartArea.height).toBeLessThan(400);
    expect(dims.chartArea.width).toBeGreaterThan(0);
    expect(dims.chartArea.height).toBeGreaterThan(0);
  });

  it('accounts for chrome height in chart area', () => {
    const noChrome: NormalizedChartSpec = { ...baseSpec, chrome: {} };
    const withChrome = baseSpec;

    const dimsNoChrome = computeDimensions(
      noChrome,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsWithChrome = computeDimensions(
      withChrome,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // With chrome, the chart area should be shorter (less height available)
    expect(dimsWithChrome.chartArea.height).toBeLessThan(dimsNoChrome.chartArea.height);
    // Chrome should have nonzero top height
    expect(dimsWithChrome.chrome.topHeight).toBeGreaterThan(0);
  });

  it('reserves space for right-positioned legend', () => {
    const withoutLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const withLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      rightLegend,
      lightTheme,
    );

    expect(withLegend.chartArea.width).toBeLessThan(withoutLegend.chartArea.width);
  });

  it('reserves space for top-positioned legend', () => {
    const withoutLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const withLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      topLegend,
      lightTheme,
    );

    expect(withLegend.chartArea.height).toBeLessThan(withoutLegend.chartArea.height);
  });

  it('applies dark mode theme adaptation', () => {
    const lightDims = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const darkDims = computeDimensions(
      baseSpec,
      { width: 600, height: 400, darkMode: true },
      emptyLegend,
      darkTheme,
    );

    expect(lightDims.theme.isDark).toBe(false);
    expect(darkDims.theme.isDark).toBe(true);
    expect(darkDims.theme.colors.background).not.toBe(lightDims.theme.colors.background);
  });

  it('prevents negative chart area dimensions', () => {
    // Tiny container
    const dims = computeDimensions(baseSpec, { width: 50, height: 30 }, emptyLegend, lightTheme);
    expect(dims.chartArea.width).toBeGreaterThanOrEqual(0);
    expect(dims.chartArea.height).toBeGreaterThanOrEqual(0);
  });

  it('reserves extra bottom space for rotated x-axis labels', () => {
    const rotatedSpec: NormalizedChartSpec = {
      ...baseSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { category: 'California', value: 10 },
        { category: 'New York', value: 20 },
        { category: 'Massachusetts', value: 15 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal', axis: { tickAngle: -90 } },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const normalSpec: NormalizedChartSpec = {
      ...baseSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: rotatedSpec.data,
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const dimsRotated = computeDimensions(
      rotatedSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsNormal = computeDimensions(
      normalSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // Rotated labels should reserve more bottom space, shrinking the chart area
    expect(dimsRotated.chartArea.height).toBeLessThan(dimsNormal.chartArea.height);
    expect(dimsRotated.margins.bottom).toBeGreaterThan(dimsNormal.margins.bottom);
  });

  it('does not change bottom space for small tick angles', () => {
    const smallAngleSpec: NormalizedChartSpec = {
      ...baseSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { tickAngle: 5 } },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const dimsSmall = computeDimensions(
      smallAngleSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsNone = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // Small angles (< 10 degrees) should not trigger rotated label logic
    expect(dimsSmall.margins.bottom).toBe(dimsNone.margins.bottom);
  });
});
