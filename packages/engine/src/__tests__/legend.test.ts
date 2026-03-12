import type { LayoutStrategy, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeLegend } from '../legend/compute';

const specWithColor: NormalizedChartSpec = {
  type: 'line',
  data: [
    { date: '2020', value: 10, country: 'US' },
    { date: '2021', value: 20, country: 'UK' },
    { date: '2022', value: 30, country: 'Germany' },
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

const specWithoutColor: NormalizedChartSpec = {
  ...specWithColor,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

const chartArea: Rect = { x: 50, y: 50, width: 500, height: 300 };
const theme: ResolvedTheme = resolveTheme();

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
  chromeMode: 'full',
  legendMaxHeight: -1,
};

const compactStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
  chromeMode: 'full',
  legendMaxHeight: -1,
};

describe('computeLegend', () => {
  it('derives entries from color encoding unique values', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(3);
    expect(legend.entries.map((e) => e.label)).toEqual(['US', 'UK', 'Germany']);
  });

  it('assigns distinct colors from the theme palette', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    const colors = legend.entries.map((e) => e.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(3);
  });

  it('returns empty entries when no color encoding', () => {
    const legend = computeLegend(specWithoutColor, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(0);
    expect(legend.bounds.width).toBe(0);
    expect(legend.bounds.height).toBe(0);
  });

  it('positions legend on right at full width', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(legend.position).toBe('right');
    expect(legend.bounds.width).toBeGreaterThan(0);
  });

  it('positions legend on top at compact width', () => {
    const legend = computeLegend(specWithColor, compactStrategy, theme, chartArea);
    expect(legend.position).toBe('top');
    expect(legend.bounds.height).toBeGreaterThan(0);
  });

  it('returns empty entries when show is false', () => {
    const specHidden: NormalizedChartSpec = {
      ...specWithColor,
      legend: { show: false },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(specHidden, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(0);
    expect(legend.bounds.width).toBe(0);
    expect(legend.bounds.height).toBe(0);
  });

  it('still shows legend when show is true', () => {
    const specShown: NormalizedChartSpec = {
      ...specWithColor,
      legend: { show: true },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(specShown, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(3);
  });

  it('uses correct swatch shape for chart type', () => {
    const lineLegend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(lineLegend.entries[0].shape).toBe('line');

    const barSpec: NormalizedChartSpec = {
      ...specWithColor,
      type: 'bar',
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'date', type: 'nominal' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const barLegend = computeLegend(barSpec, fullStrategy, theme, chartArea);
    expect(barLegend.entries[0].shape).toBe('square');

    const scatterSpec: NormalizedChartSpec = {
      ...specWithColor,
      type: 'scatter',
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const scatterLegend = computeLegend(scatterSpec, fullStrategy, theme, chartArea);
    expect(scatterLegend.entries[0].shape).toBe('circle');
  });
});
