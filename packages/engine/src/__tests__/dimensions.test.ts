import type { LayoutStrategy, LegendLayout } from '@opendata-ai/openchart-core';
import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeDimensions } from '../layout/dimensions';
import { legendGap } from '../legend/wrap';

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
        x: { field: 'category', type: 'nominal', axis: { labelAngle: -90 } },
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
        x: { field: 'date', type: 'temporal', axis: { labelAngle: 5 } },
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

  it('does not reserve annotation margin when strategy is tooltip-only', () => {
    const specWithAnnotations: NormalizedChartSpec = {
      ...baseSpec,
      annotations: [{ type: 'text', x: '2021-01-01', y: 20, text: 'Right-edge annotation' }],
    };

    const inlineStrategy: LayoutStrategy = {
      labelMode: 'all',
      legendPosition: 'right',
      annotationPosition: 'inline',
      axisLabelDensity: 'full',
    };
    const tooltipOnlyStrategy: LayoutStrategy = {
      labelMode: 'none',
      legendPosition: 'top',
      annotationPosition: 'tooltip-only',
      axisLabelDensity: 'minimal',
    };

    const dimsInline = computeDimensions(
      specWithAnnotations,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
      inlineStrategy,
    );
    const dimsTooltipOnly = computeDimensions(
      specWithAnnotations,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
      tooltipOnlyStrategy,
    );
    const dimsNoAnnotations = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // Inline strategy should reserve extra right margin for the annotation
    expect(dimsInline.margins.right).toBeGreaterThan(dimsNoAnnotations.margins.right);
    // Tooltip-only should NOT reserve extra margin (annotations are hidden)
    expect(dimsTooltipOnly.margins.right).toBe(dimsNoAnnotations.margins.right);
  });

  it('clamps y-axis label margin on narrow containers to preserve chart area', () => {
    const longLabelSpec: NormalizedChartSpec = {
      ...baseSpec,
      markType: 'bar',
      markDef: { type: 'bar' },
      data: [
        {
          category: 'This is a very long category label that would consume lots of space',
          value: 10,
        },
        { category: 'Another extremely verbose category name', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
    };

    const narrowDims = computeDimensions(
      longLabelSpec,
      { width: 350, height: 300 },
      emptyLegend,
      lightTheme,
    );

    // On narrow viewports, left margin should be clamped so the chart area
    // retains at least ~45% of the container width
    expect(narrowDims.chartArea.width).toBeGreaterThanOrEqual(350 * 0.4);
  });

  it('tightens legend gap on narrow viewports', () => {
    const wideDims = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      topLegend,
      lightTheme,
    );
    const narrowDims = computeDimensions(
      baseSpec,
      { width: 360, height: 400 },
      topLegend,
      lightTheme,
    );

    // Narrow viewport should have more chart height available (smaller legend gap)
    expect(narrowDims.chartArea.height).toBeGreaterThanOrEqual(wideDims.chartArea.height - 10);
  });

  it('exposes xAxisHeight on the layout dimensions', () => {
    const dims = computeDimensions(baseSpec, { width: 600, height: 400 }, emptyLegend, lightTheme);
    // Default x-axis (no rotation, no title): 26px reservation.
    expect(dims.xAxisHeight).toBeGreaterThan(0);
  });

  it('reserves extra bottom space for a bottom legend so it sits below the x-axis', () => {
    // Defect-3 regression: bottom-positioned legends used to render in the
    // same band as the x-axis tick row. dimensions.ts now adds xAxisHeight
    // on top of legendHeight + gap so the legend lands BELOW the axis.
    const bottomLegend: LegendLayout = {
      ...emptyLegend,
      position: 'bottom',
      entries: [{ label: 'US', color: '#1b7fa3', shape: 'line' }],
      bounds: { x: 0, y: 0, width: 400, height: 28 },
    };

    const dimsNoLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsBottom = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      bottomLegend,
      lightTheme,
    );

    // Bottom legend reserves at minimum legendHeight + gap + xAxisHeight extra.
    const gap = legendGap(600);
    const expectedExtra = bottomLegend.bounds.height + gap + dimsNoLegend.xAxisHeight;
    expect(dimsBottom.margins.bottom - dimsNoLegend.margins.bottom).toBe(expectedExtra);
  });
});

describe('bottom legend placement (defect-3 regression)', () => {
  it('places the bottom legend below the x-axis tick row, not over it', () => {
    // Multi-series area with explicit bottom legend should render the legend
    // beneath the x-axis ticks. Asserts:
    //   legend.bounds.y >= chartArea.y + chartArea.height + xAxisHeight + gap
    const spec = {
      mark: 'area' as const,
      data: [
        { year: '2020', value: 10, series: 'A' },
        { year: '2021', value: 20, series: 'A' },
        { year: '2022', value: 15, series: 'A' },
        { year: '2020', value: 8, series: 'B' },
        { year: '2021', value: 18, series: 'B' },
        { year: '2022', value: 12, series: 'B' },
        { year: '2020', value: 5, series: 'C' },
        { year: '2021', value: 12, series: 'C' },
        { year: '2022', value: 9, series: 'C' },
      ],
      encoding: {
        x: { field: 'year', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'series', type: 'nominal' as const },
      },
      legend: { position: 'bottom' as const, show: true },
    };

    const layout = compileChart(spec, { width: 800, height: 500 });

    expect(layout.legend.entries.length).toBeGreaterThan(0);
    expect(layout.legend.position).toBe('bottom');

    // Recompute the gap the engine uses internally to make a tight assertion.
    const gap = legendGap(800);

    // Use the same axis-height fallback dimensions.ts uses for an unrotated
    // x-axis without an axis title (26px). Asserting `>=` means the legend
    // top is at or below the bottom of the x-axis tick row.
    const xAxisHeight = 26;
    const chartBottom = layout.area.y + layout.area.height;
    const minLegendY = chartBottom + xAxisHeight + gap;

    expect(layout.legend.bounds.y).toBeGreaterThanOrEqual(minLegendY - 0.5);
  });
});
