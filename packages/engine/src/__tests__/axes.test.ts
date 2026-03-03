import type { LayoutStrategy } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeAxes } from '../layout/axes';
import { computeScales } from '../layout/scales';

const lineSpec: NormalizedChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 100 },
    { date: '2021-01-01', value: 500 },
    { date: '2022-01-01', value: 300 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {},
  annotations: [],
  responsive: true,
  theme: {},
  darkMode: 'off',
  labels: { density: 'auto', format: '' },
};

const chartArea = { x: 50, y: 50, width: 500, height: 300 };
const theme = resolveTheme();

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const minimalStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
};

describe('computeAxes', () => {
  it('produces x and y axes for a line chart', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x).toBeDefined();
    expect(axes.y).toBeDefined();
  });

  it('generates ticks for both axes', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.ticks.length).toBeGreaterThan(0);
    expect(axes.y!.ticks.length).toBeGreaterThan(0);
  });

  it('tick positions are within chart area', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    for (const tick of axes.x!.ticks) {
      expect(tick.position).toBeGreaterThanOrEqual(chartArea.x - 1);
      expect(tick.position).toBeLessThanOrEqual(chartArea.x + chartArea.width + 1);
    }

    for (const tick of axes.y!.ticks) {
      expect(tick.position).toBeGreaterThanOrEqual(chartArea.y - 1);
      expect(tick.position).toBeLessThanOrEqual(chartArea.y + chartArea.height + 1);
    }
  });

  it('tick labels are formatted strings', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    for (const tick of axes.y!.ticks) {
      expect(typeof tick.label).toBe('string');
      expect(tick.label.length).toBeGreaterThan(0);
    }
  });

  it('produces fewer ticks with minimal density', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axesFull = computeAxes(scales, chartArea, fullStrategy, theme);
    const axesMinimal = computeAxes(scales, chartArea, minimalStrategy, theme);

    // Minimal should have fewer or equal ticks
    expect(axesMinimal.y!.ticks.length).toBeLessThanOrEqual(axesFull.y!.ticks.length);
  });

  it('y-axis has gridlines by default', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.y!.gridlines.length).toBeGreaterThan(0);
  });

  it('axes have correct start/end positions', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // X axis sits at the bottom of the chart area
    expect(axes.x!.start.y).toBe(chartArea.y + chartArea.height);
    expect(axes.x!.end.y).toBe(chartArea.y + chartArea.height);

    // Y axis sits at the left of the chart area
    expect(axes.y!.start.x).toBe(chartArea.x);
    expect(axes.y!.end.x).toBe(chartArea.x);
  });
});
