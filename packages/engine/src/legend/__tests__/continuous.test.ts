import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileChart } from '../../compile';
import { applyColorScaleRange } from '../../compile/color-scale-range';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeScales } from '../../layout/scales';
import { computeLegendContent, placeLegend } from '../compute';
import { sampleRampColors } from '../continuous';

const theme = resolveTheme({});
const strategy = {
  axisLabelDensity: 'full' as const,
  labelMode: 'all' as const,
  legendPosition: 'top' as const,
  legendMaxHeight: 1,
  fontScale: 1,
};

const heatmapData = [
  { month: 'Jan', value: 4 },
  { month: 'Feb', value: 12 },
  { month: 'Mar', value: 25 },
  { month: 'Apr', value: 47 },
  { month: 'May', value: 68 },
  { month: 'Jun', value: 90 },
];

function makeSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: heatmapData,
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'value', type: 'quantitative' },
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

describe('continuous legend content', () => {
  it('produces a gradient legend by default for a sequential color scale', () => {
    const content = computeLegendContent(makeSpec(), strategy, theme, 600, 400);

    expect(content.continuous).toBeDefined();
    expect(content.continuous!.mode).toBe('gradient');
    expect(content.entries).toHaveLength(0);
    expect(content.position).toBe('top');
    expect(content.height).toBeGreaterThan(0);
    expect(content.legendWidth).toBe(content.continuous!.barWidth);

    // Default ramp: theme's first sequential palette endpoints, exactly as
    // applyColorScaleRange gives the marks.
    const seqStops = Object.values(theme.colors.sequential)[0];
    expect(content.continuous!.colorStops).toEqual([
      { offset: 0, color: seqStops[0] },
      { offset: 1, color: seqStops[seqStops.length - 1] },
    ]);

    // Sequential: min/max labels only, anchored at the bar ends.
    const ticks = content.continuous!.ticks;
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toMatchObject({ value: 4, x: 0, anchor: 'start' });
    expect(ticks[1]).toMatchObject({
      value: 90,
      x: content.continuous!.barWidth,
      anchor: 'end',
    });
  });

  it('uses tabular figures for value labels', () => {
    const content = computeLegendContent(makeSpec(), strategy, theme, 600, 400);
    expect(content.labelStyle.fontVariant).toBe('tabular-nums');
  });

  it('is removed by legend: { show: false }', () => {
    const spec = makeSpec({ legend: { show: false } });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.continuous).toBeUndefined();
    expect(content.entries).toHaveLength(0);
  });

  it('applies the channel format to labels', () => {
    const spec = makeSpec({
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'value', type: 'quantitative', format: '.1f' },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.continuous!.ticks[0].label).toBe('4.0');
    expect(content.continuous!.ticks[1].label).toBe('90.0');
  });

  it('adds a midpoint label at the center value for diverging ramps', () => {
    const divergingStops = Object.values(theme.colors.diverging)[0];
    const spec = makeSpec({
      data: [
        { month: 'Jan', value: -30 },
        { month: 'Feb', value: 0 },
        { month: 'Mar', value: 50 },
      ],
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'value',
          type: 'quantitative',
          scale: { range: divergingStops },
        },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);

    expect(content.continuous!.mode).toBe('gradient');
    // All diverging stops interpolate piecewise.
    expect(content.continuous!.colorStops).toHaveLength(divergingStops.length);
    const ticks = content.continuous!.ticks;
    expect(ticks).toHaveLength(3);
    // Neutral at the scale's center value: (-30 + 50) / 2 = 10.
    expect(ticks[1]).toMatchObject({
      value: 10,
      x: content.continuous!.barWidth / 2,
      anchor: 'middle',
    });
  });

  it('renders binned swatches with boundary labels for threshold scales', () => {
    const breaks = [20, 40, 60, 80];
    const spec = makeSpec({
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'value',
          type: 'quantitative',
          scale: { type: 'threshold', domain: breaks },
        },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);

    expect(content.continuous!.mode).toBe('binned');
    // 4 breaks -> 5 swatches with 4 boundary labels between them.
    expect(content.continuous!.bins).toHaveLength(5);
    expect(content.continuous!.ticks).toHaveLength(4);
    const binWidth = content.continuous!.barWidth / 5;
    content.continuous!.ticks.forEach((tick, i) => {
      expect(tick.value).toBe(breaks[i]);
      expect(tick.anchor).toBe('middle');
      expect(tick.x).toBeCloseTo(binWidth * (i + 1), 6);
    });
    // Swatches are contiguous, left to right.
    content.continuous!.bins.forEach((bin, i) => {
      expect(bin.x).toBeCloseTo(binWidth * i, 6);
      expect(bin.width).toBeCloseTo(binWidth, 6);
    });
  });

  it('matches the mark color scale exactly (gradient endpoints)', () => {
    const spec = makeSpec();
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    const scales = computeScales(spec, { x: 0, y: 0, width: 400, height: 300 }, spec.data);
    applyColorScaleRange(scales, spec.encoding, theme);
    const colorScale = scales.color!.scale as unknown as (v: number) => string;

    // d3 linear color scales emit rgb(...) strings; normalize hex for comparison.
    const hexToRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const stops = content.continuous!.colorStops;
    expect(hexToRgb(stops[0].color)).toBe(colorScale(4));
    expect(hexToRgb(stops[stops.length - 1].color)).toBe(colorScale(90));
  });

  it('matches the mark color scale exactly (threshold class colors)', () => {
    const spec = makeSpec({
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'value',
          type: 'quantitative',
          scale: { type: 'threshold', domain: [20, 40, 60, 80] },
        },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    const scales = computeScales(spec, { x: 0, y: 0, width: 400, height: 300 }, spec.data);
    applyColorScaleRange(scales, spec.encoding, theme);
    const colorScale = scales.color!.scale as unknown as (v: number) => string;

    // Sample one value per class and compare with the swatch colors.
    const samples = [10, 30, 50, 70, 90];
    content.continuous!.bins.forEach((bin, i) => {
      expect(bin.color).toBe(colorScale(samples[i]));
    });
  });

  it('supports legend position bottom; other positions resolve to top', () => {
    const bottom = computeLegendContent(
      makeSpec({ legend: { position: 'bottom' } }),
      strategy,
      theme,
      600,
      400,
    );
    expect(bottom.position).toBe('bottom');

    const right = computeLegendContent(
      makeSpec({ legend: { position: 'right' } }),
      strategy,
      theme,
      600,
      400,
    );
    expect(right.position).toBe('top');
  });

  it('clamps the bar width to the available width', () => {
    const content = computeLegendContent(makeSpec(), strategy, theme, 120, 400);
    expect(content.continuous!.barWidth).toBeLessThanOrEqual(120);
    expect(content.legendWidth).toBeLessThanOrEqual(120);
  });
});

describe('placeLegend (continuous)', () => {
  const chartArea = { x: 50, y: 80, width: 500, height: 280 };

  it('places a top continuous legend above the chart area with absolute geometry', () => {
    const content = computeLegendContent(makeSpec(), strategy, theme, 600, 400);
    const layout = placeLegend(content, chartArea, 600, theme, 0);

    expect(layout.type).toBe('continuous');
    if (layout.type !== 'continuous') return;
    expect(layout.bounds.y + layout.bounds.height).toBeLessThanOrEqual(chartArea.y);
    expect(layout.bar.x).toBe(layout.bounds.x);
    expect(layout.bar.y).toBe(layout.bounds.y);
    // Ticks offset into chart coordinates.
    expect(layout.ticks[0].x).toBe(layout.bar.x);
    expect(layout.ticks[layout.ticks.length - 1].x).toBe(layout.bar.x + layout.bar.width);
    // Labels sit below the bar, inside the bounds.
    expect(layout.labelY).toBeGreaterThan(layout.bar.y + layout.bar.height);
    expect(layout.labelY).toBeLessThanOrEqual(layout.bounds.y + layout.bounds.height);
  });
});

describe('compileChart integration', () => {
  const heatmapChartSpec = {
    mark: 'bar' as const,
    data: heatmapData,
    encoding: {
      x: { field: 'month', type: 'nominal' as const },
      y: { field: 'value', type: 'quantitative' as const },
      color: { field: 'value', type: 'quantitative' as const },
    },
  };

  it('reserves legend space so the bar never overlaps the chart area', () => {
    const layout = compileChart(heatmapChartSpec, { width: 600, height: 400 });
    expect(layout.legend.type).toBe('continuous');
    expect(layout.legend.bounds.y + layout.legend.bounds.height).toBeLessThanOrEqual(layout.area.y);

    const hidden = compileChart(
      { ...heatmapChartSpec, legend: { show: false } },
      { width: 600, height: 400 },
    );
    expect(hidden.legend.type).toBe('categorical');
    expect(layout.area.y).toBeGreaterThan(hidden.area.y);
  });

  it('stays inside a 320px container', () => {
    const layout = compileChart(heatmapChartSpec, { width: 320, height: 300 });
    expect(layout.legend.type).toBe('continuous');
    expect(layout.legend.bounds.x + layout.legend.bounds.width).toBeLessThanOrEqual(320);
    expect(layout.legend.bounds.y + layout.legend.bounds.height).toBeLessThanOrEqual(layout.area.y);
  });
});

describe('sampleRampColors', () => {
  const ramp = ['#a', '#b', '#c', '#d', '#e', '#f'];

  it('returns the ramp unchanged when lengths match', () => {
    expect(sampleRampColors(ramp, 6)).toEqual(ramp);
  });

  it('keeps the endpoints when downsampling', () => {
    const sampled = sampleRampColors(ramp, 3);
    expect(sampled).toHaveLength(3);
    expect(sampled[0]).toBe('#a');
    expect(sampled[2]).toBe('#f');
  });
});
