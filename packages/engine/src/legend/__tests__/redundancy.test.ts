import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import type { NormalizedChartSpec } from '../../compiler/types';
import { computeLegendContent } from '../compute';

const theme = resolveTheme({});
const strategy = {
  axisLabelDensity: 'full' as const,
  labelMode: 'all' as const,
  legendPosition: 'top' as const,
  legendMaxHeight: 1,
  fontScale: 1,
};

function makeBarSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ],
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    hiddenSeries: [],
    seriesStyles: {},
    watermark: true,
    display: 'full',
    userExplicit: {
      chrome: false,
      legend: false,
      endpointLabels: false,
      xAxis: false,
      yAxis: false,
      labels: false,
      animation: false,
      watermark: false,
      crosshair: false,
    },
    ...overrides,
  };
}

describe('bar/column legend redundancy rule', () => {
  it('hides legend when color.field matches the category axis field', () => {
    const spec = makeBarSpec();
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });

  it('shows legend when user explicitly sets legend config', () => {
    const spec = makeBarSpec({
      legend: { show: true },
      userExplicit: {
        chrome: false,
        legend: true,
        endpointLabels: false,
        xAxis: false,
        yAxis: false,
        labels: false,
        animation: false,
        watermark: false,
        crosshair: false,
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('shows legend when color.field differs from category axis field', () => {
    const spec = makeBarSpec({
      data: [
        { category: 'A', value: 10, series: 'X' },
        { category: 'B', value: 20, series: 'Y' },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('works for horizontal bars (y is category, x is quantitative)', () => {
    const spec = makeBarSpec({
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
        color: { field: 'category', type: 'nominal' },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });
});
