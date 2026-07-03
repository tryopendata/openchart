import type { AxisTick, Encoding, LayoutStrategy } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { scaleLinear, scaleLog } from 'd3-scale';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeAxes, effectiveDensity, thinTicksUntilFit, ticksOverlap } from '../layout/axes';
import { buildContinuousTicks } from '../layout/axes/ticks';
import type { ResolvedScale } from '../layout/scales';
import { computeScales } from '../layout/scales';

const lineSpec: NormalizedChartSpec = {
  markType: 'line',
  markDef: { type: 'line' },
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
  chromeMode: 'full',
  legendMaxHeight: -1,
};

const minimalStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
  chromeMode: 'full',
  legendMaxHeight: -1,
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

  // -------------------------------------------------------------------------
  // Height-aware y-axis tick reduction
  // -------------------------------------------------------------------------

  it('reduces y-axis ticks for very short chart areas (< 80px)', () => {
    const shortArea = { x: 50, y: 50, width: 500, height: 80 };
    const scales = computeScales(lineSpec, shortArea, lineSpec.data);
    const axesShort = computeAxes(scales, shortArea, fullStrategy, theme);

    // Very short chart area -- tick count clamped to at most 4
    expect(axesShort.y!.ticks.length).toBeLessThanOrEqual(4);
  });

  it('reduces y-axis ticks for medium-short chart areas (80-100px)', () => {
    const mediumArea = { x: 50, y: 50, width: 500, height: 160 };
    const tallArea = { x: 50, y: 50, width: 500, height: 400 };

    const scalesMedium = computeScales(lineSpec, mediumArea, lineSpec.data);
    const scalesTall = computeScales(lineSpec, tallArea, lineSpec.data);

    const axesMedium = computeAxes(scalesMedium, mediumArea, fullStrategy, theme);
    const axesTall = computeAxes(scalesTall, tallArea, fullStrategy, theme);

    // Medium height should have fewer ticks than a tall chart with same 'full' density
    expect(axesMedium.y!.ticks.length).toBeLessThanOrEqual(axesTall.y!.ticks.length);
  });

  it('does not increase y-axis ticks beyond base density for short charts', () => {
    const shortArea = { x: 50, y: 50, width: 500, height: 80 };
    const scales = computeScales(lineSpec, shortArea, lineSpec.data);

    // Strategy already says minimal - short height shouldn't change anything
    const axes = computeAxes(scales, shortArea, minimalStrategy, theme);
    expect(axes.y!.ticks.length).toBeLessThanOrEqual(4);
  });

  // -------------------------------------------------------------------------
  // Width-aware x-axis tick reduction
  // -------------------------------------------------------------------------

  it('reduces x-axis ticks for very narrow chart areas (< 150px)', () => {
    const narrowArea = { x: 50, y: 50, width: 100, height: 300 };
    const scales = computeScales(lineSpec, narrowArea, lineSpec.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // Width < 150 forces minimal density for x-axis
    expect(axes.x!.ticks.length).toBeLessThanOrEqual(4);
  });

  it('reduces x-axis ticks for medium-narrow chart areas (150-300px)', () => {
    const mediumArea = { x: 50, y: 50, width: 250, height: 300 };
    const wideArea = { x: 50, y: 50, width: 600, height: 300 };

    const scalesMedium = computeScales(lineSpec, mediumArea, lineSpec.data);
    const scalesWide = computeScales(lineSpec, wideArea, lineSpec.data);

    const axesMedium = computeAxes(scalesMedium, mediumArea, fullStrategy, theme);
    const axesWide = computeAxes(scalesWide, wideArea, fullStrategy, theme);

    expect(axesMedium.x!.ticks.length).toBeLessThanOrEqual(axesWide.x!.ticks.length);
  });

  // -------------------------------------------------------------------------
  // Both axes constrained simultaneously (thumbnail scenario)
  // -------------------------------------------------------------------------

  it('reduces ticks on both axes for thumbnail-sized charts', () => {
    const thumbnailArea = { x: 10, y: 10, width: 120, height: 80 };
    const fullArea = { x: 50, y: 50, width: 600, height: 400 };

    const scalesThumb = computeScales(lineSpec, thumbnailArea, lineSpec.data);
    const scalesFull = computeScales(lineSpec, fullArea, lineSpec.data);

    const axesThumb = computeAxes(scalesThumb, thumbnailArea, fullStrategy, theme);
    const axesFull = computeAxes(scalesFull, fullArea, fullStrategy, theme);

    // Both axes should have minimal ticks in a thumbnail
    expect(axesThumb.x!.ticks.length).toBeLessThanOrEqual(4);
    expect(axesThumb.y!.ticks.length).toBeLessThanOrEqual(4);

    // And fewer than full-size
    expect(axesThumb.x!.ticks.length).toBeLessThanOrEqual(axesFull.x!.ticks.length);
    expect(axesThumb.y!.ticks.length).toBeLessThanOrEqual(axesFull.y!.ticks.length);
  });

  // -------------------------------------------------------------------------
  // labelAngle propagation
  // -------------------------------------------------------------------------

  it('propagates labelAngle from encoding to x-axis layout', () => {
    const specWithAngle: NormalizedChartSpec = {
      ...lineSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { cat: 'California', val: 10 },
        { cat: 'New York', val: 20 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal', axis: { labelAngle: -90 } },
        y: { field: 'val', type: 'quantitative' },
      },
    };
    const scales = computeScales(specWithAngle, chartArea, specWithAngle.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.tickAngle).toBe(-90);
  });

  it('leaves tickAngle undefined when not specified', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.tickAngle).toBeUndefined();
    expect(axes.y!.tickAngle).toBeUndefined();
  });

  it('propagates labelAngle to y-axis layout', () => {
    const specWithAngle: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', axis: { labelAngle: -45 } },
      },
    };
    const scales = computeScales(specWithAngle, chartArea, specWithAngle.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.y!.tickAngle).toBe(-45);
  });
});

// ---------------------------------------------------------------------------
// effectiveDensity unit tests
// ---------------------------------------------------------------------------

describe('effectiveDensity', () => {
  const MINIMAL_THRESHOLD = 120;
  const REDUCED_THRESHOLD = 200;

  it('returns base density when axis length exceeds all thresholds', () => {
    expect(effectiveDensity('full', 500, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('full');
    expect(effectiveDensity('reduced', 500, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('reduced');
    expect(effectiveDensity('minimal', 500, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
  });

  it('forces minimal density below the minimal threshold', () => {
    expect(effectiveDensity('full', 80, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
    expect(effectiveDensity('reduced', 80, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
    expect(effectiveDensity('minimal', 80, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
  });

  it('caps at reduced density between thresholds', () => {
    // 'full' base should step down to 'reduced'
    expect(effectiveDensity('full', 160, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('reduced');
  });

  it('does not increase density beyond base when between thresholds', () => {
    // 'minimal' base should stay 'minimal' even between thresholds
    expect(effectiveDensity('minimal', 160, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
    // 'reduced' base should stay 'reduced'
    expect(effectiveDensity('reduced', 160, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('reduced');
  });

  it('handles exact threshold boundaries', () => {
    // At exactly the minimal threshold, we're NOT below it
    expect(effectiveDensity('full', 120, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('reduced');
    // At exactly the reduced threshold, we're NOT below it
    expect(effectiveDensity('full', 200, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('full');
  });

  it('handles zero and negative lengths', () => {
    expect(effectiveDensity('full', 0, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
    expect(effectiveDensity('full', -10, MINIMAL_THRESHOLD, REDUCED_THRESHOLD)).toBe('minimal');
  });

  it('works with custom thresholds (x-axis uses different values)', () => {
    const X_MINIMAL = 150;
    const X_REDUCED = 300;

    expect(effectiveDensity('full', 100, X_MINIMAL, X_REDUCED)).toBe('minimal');
    expect(effectiveDensity('full', 200, X_MINIMAL, X_REDUCED)).toBe('reduced');
    expect(effectiveDensity('full', 400, X_MINIMAL, X_REDUCED)).toBe('full');
  });
});

// ---------------------------------------------------------------------------
// ticksOverlap unit tests
// ---------------------------------------------------------------------------

describe('ticksOverlap', () => {
  const fontSize = 12;
  const fontWeight = 400;

  it('returns false for empty or single tick', () => {
    expect(ticksOverlap([], fontSize, fontWeight)).toBe(false);
    expect(ticksOverlap([{ value: 0, position: 100, label: 'A' }], fontSize, fontWeight)).toBe(
      false,
    );
  });

  it('returns false when ticks are well-spaced', () => {
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'A' },
      { value: 1, position: 200, label: 'B' },
      { value: 2, position: 400, label: 'C' },
    ];
    expect(ticksOverlap(ticks, fontSize, fontWeight)).toBe(false);
  });

  it('returns true when ticks are too close together', () => {
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'January 2025' },
      { value: 1, position: 30, label: 'February 2025' },
      { value: 2, position: 60, label: 'March 2025' },
    ];
    expect(ticksOverlap(ticks, fontSize, fontWeight)).toBe(true);
  });

  it('uses measureText when provided', () => {
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'A' },
      { value: 1, position: 100, label: 'B' },
    ];

    // With a measureText that reports very wide labels, they should overlap
    const wideMeasure = () => ({ width: 200, height: 12 });
    expect(ticksOverlap(ticks, fontSize, fontWeight, wideMeasure)).toBe(true);

    // With a measureText that reports very narrow labels, they should not overlap
    const narrowMeasure = () => ({ width: 1, height: 12 });
    expect(ticksOverlap(ticks, fontSize, fontWeight, narrowMeasure)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// thinTicksUntilFit unit tests
// ---------------------------------------------------------------------------

describe('thinTicksUntilFit', () => {
  const fontSize = 12;
  const fontWeight = 400;

  it('returns original array when no overlap', () => {
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'A' },
      { value: 1, position: 200, label: 'B' },
      { value: 2, position: 400, label: 'C' },
    ];
    const result = thinTicksUntilFit(ticks, fontSize, fontWeight);
    expect(result).toBe(ticks); // Same reference, not a copy
  });

  it('thins overlapping ticks while keeping first and last', () => {
    // Ticks at 10px intervals with long labels that will overlap
    const ticks: AxisTick[] = Array.from({ length: 8 }, (_, i) => ({
      value: i,
      position: i * 10,
      label: 'Long Label Text',
    }));

    const result = thinTicksUntilFit(ticks, fontSize, fontWeight);

    // Should have fewer ticks than the original
    expect(result.length).toBeLessThan(ticks.length);
    // Should always keep first and last
    expect(result[0]).toBe(ticks[0]);
    expect(result[result.length - 1]).toBe(ticks[ticks.length - 1]);
    // Should have at least MIN_TICK_COUNT (2)
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns at least 2 ticks even when labels are very wide', () => {
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'Very Long Label That Is Wide' },
      { value: 1, position: 5, label: 'Another Very Long Label' },
      { value: 2, position: 10, label: 'Yet Another Long Label Here' },
    ];
    const result = thinTicksUntilFit(ticks, fontSize, fontWeight);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Text-aware tick density integration tests
// ---------------------------------------------------------------------------

describe('text-aware tick density', () => {
  it('produces fewer x-axis ticks in narrow charts', () => {
    const narrowArea = { x: 50, y: 50, width: 200, height: 300 };
    const wideArea = { x: 50, y: 50, width: 800, height: 300 };

    const scalesNarrow = computeScales(lineSpec, narrowArea, lineSpec.data);
    const scalesWide = computeScales(lineSpec, wideArea, lineSpec.data);

    const axesNarrow = computeAxes(scalesNarrow, narrowArea, fullStrategy, theme);
    const axesWide = computeAxes(scalesWide, wideArea, fullStrategy, theme);

    expect(axesNarrow.x!.ticks.length).toBeLessThanOrEqual(axesWide.x!.ticks.length);
  });

  it('still thins x-axis ticks when tickCount is set but D3 overshoots', () => {
    const narrowArea = { x: 50, y: 50, width: 200, height: 300 };
    const specWithTickCount: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { tickCount: 8 } },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const scales = computeScales(specWithTickCount, narrowArea, specWithTickCount.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // tickCount is advisory for D3 - if it overshoots, thinning still applies
    // to prevent overlap. The result should still have ticks, just not more
    // than the narrow area can display without overlap.
    expect(axes.x!.ticks.length).toBeGreaterThan(0);
  });

  it('does not thin x-axis ticks when explicit values are set', () => {
    const narrowArea = { x: 50, y: 50, width: 200, height: 300 };
    const specWithValues: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          axis: { values: ['2020-01-01', '2021-01-01', '2022-01-01'] },
        },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const scales = computeScales(specWithValues, narrowArea, specWithValues.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // Explicit values should be preserved exactly as specified
    expect(axes.x!.ticks.length).toBe(3);
  });

  it('band scale shows all categories regardless of width', () => {
    const categories = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
    const barSpec: NormalizedChartSpec = {
      ...lineSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: categories.map((cat, i) => ({ cat, val: (i + 1) * 10 })),
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'val', type: 'quantitative' },
      },
    };

    const narrowArea = { x: 50, y: 50, width: 200, height: 300 };
    const scales = computeScales(barSpec, narrowArea, barSpec.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // Band scales show all categories (auto-rotation handles overlap instead)
    expect(axes.x!.ticks.length).toBe(categories.length);
  });

  it('y-axis gridlines match ticks so every gridline has a label', () => {
    // Force thinning by using a measureText that reports wide labels
    const wideMeasure = () => ({ width: 200, height: 12 });
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, wideMeasure);

    // Y-axis gridlines should always match ticks 1:1 (every gridline gets a label)
    expect(axes.y!.gridlines.length).toBe(axes.y!.ticks.length);
    for (let i = 0; i < axes.y!.ticks.length; i++) {
      expect(axes.y!.gridlines[i].position).toBe(axes.y!.ticks[i].position);
    }
  });

  it('x-axis gridlines survive tick thinning when grid is enabled', () => {
    const specWithGrid: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { grid: true } },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const wideMeasure = () => ({ width: 200, height: 12 });
    const scales = computeScales(specWithGrid, chartArea, specWithGrid.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, wideMeasure);

    expect(axes.x!.gridlines.length).toBeGreaterThanOrEqual(axes.x!.ticks.length);
  });

  it('passes measureText to auto-rotation detection', () => {
    const barSpec: NormalizedChartSpec = {
      ...lineSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { cat: 'A', val: 10 },
        { cat: 'B', val: 20 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'val', type: 'quantitative' },
      },
    };

    // measureText that reports very wide labels should trigger rotation
    const wideMeasure = () => ({ width: 1000, height: 12 });
    const scales = computeScales(barSpec, chartArea, barSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, wideMeasure);

    expect(axes.x!.tickAngle).toBe(-45);
  });
});

// ---------------------------------------------------------------------------
// Axis config expansion tests
// ---------------------------------------------------------------------------

describe('axis config properties', () => {
  it('uses title instead of deprecated label', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { title: 'Year' } },
        y: { field: 'value', type: 'quantitative', axis: { title: 'Amount ($)' } },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.label).toBe('Year');
    expect(axes.y!.label).toBe('Amount ($)');
  });

  it('propagates labelAngle to layout tickAngle', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          axis: { labelAngle: -30 },
        },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.tickAngle).toBe(-30);
  });

  it('passes orient config to axis layout', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { orient: 'top' } },
        y: { field: 'value', type: 'quantitative', axis: { orient: 'right' } },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.orient).toBe('top');
    expect(axes.y!.orient).toBe('right');
  });

  it('passes domain and ticks visibility to axis layout', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { domain: false, ticks: false } },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.domainLine).toBe(false);
    expect(axes.x!.tickMarks).toBe(false);
  });

  it('passes offset and padding configs to axis layout', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          axis: { offset: 10, titlePadding: 8, labelPadding: 4 },
        },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.offset).toBe(10);
    expect(axes.x!.titlePadding).toBe(8);
    expect(axes.x!.labelPadding).toBe(4);
  });

  it('passes labelOverlap and labelFlush to axis layout', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          axis: { labelOverlap: 'parity', labelFlush: true },
        },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.labelOverlap).toBe('parity');
    expect(axes.x!.labelFlush).toBe(true);
  });

  it('uses explicit tick values when provided', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: {
          field: 'value',
          type: 'quantitative',
          axis: { values: [0, 250, 500] },
        },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // Should produce exactly 3 ticks matching our explicit values
    expect(axes.y!.ticks.length).toBe(3);
    expect(axes.y!.ticks[0].value).toBe(0);
    expect(axes.y!.ticks[1].value).toBe(250);
    expect(axes.y!.ticks[2].value).toBe(500);
  });

  it('defaults are undefined when axis config properties are not set', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // All new properties should be undefined when not set
    expect(axes.x!.orient).toBeUndefined();
    expect(axes.x!.domainLine).toBeUndefined();
    expect(axes.x!.tickMarks).toBeUndefined();
    expect(axes.x!.offset).toBeUndefined();
    expect(axes.x!.titlePadding).toBeUndefined();
    expect(axes.x!.labelPadding).toBeUndefined();
    expect(axes.x!.labelOverlap).toBeUndefined();
    expect(axes.x!.labelFlush).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Y-axis produces ~5 ticks at standard sizes
// ---------------------------------------------------------------------------

describe('y-axis tick density', () => {
  it('produces 5+ y-axis ticks at standard chart size with full density', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // A 500x300 chart with domain [100, 500] should show ~5+ ticks, not just 2
    expect(axes.y!.ticks.length).toBeGreaterThanOrEqual(5);
  });

  it('y-axis thinning uses vertical overlap, not horizontal text width', () => {
    // Even with a measureText that reports very wide labels, y-axis should
    // not thin aggressively because overlap is checked vertically
    const wideMeasure = () => ({ width: 500, height: 12 });
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, wideMeasure);

    // Wide label text shouldn't cause y-axis thinning (only height matters)
    expect(axes.y!.ticks.length).toBeGreaterThanOrEqual(5);
  });

  it('does not collapse to min/max when nice() domain creates a close last tick', () => {
    // Regression: domain [0, 340] nice()'s to [0, 350]. The old thinning path
    // kept both 340 and the endpoint 350, causing cascaded thinning down to
    // [0, 340] (2 ticks). Fix re-requests at lower counts from D3 instead.
    const barSpec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar' },
      data: [
        { year: '2019', v: 110 },
        { year: '2023', v: 340 },
      ],
      encoding: {
        x: { field: 'year', type: 'nominal' },
        y: { field: 'v', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
    const scales = computeScales(barSpec, chartArea, barSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // The specific bug produced exactly [0, 340] — only the min and max with
    // no interior gridlines. Any output with interior values is a pass, even
    // if the count varies with D3's step choice across platforms.
    const values = axes.y!.ticks.map((t) => t.value);
    expect(values).not.toEqual([0, 340]);
    expect(values).not.toEqual([0, 350]);
    expect(axes.y!.ticks.length).toBeGreaterThanOrEqual(4);
  });

  it('adapts y-axis tick count down for short charts', () => {
    const shortArea = { x: 50, y: 50, width: 500, height: 140 };
    const scales = computeScales(lineSpec, shortArea, lineSpec.data);
    const axes = computeAxes(scales, shortArea, fullStrategy, theme);

    // Short charts should still show multiple ticks but fewer than tall ones
    expect(axes.y!.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axes.y!.ticks.length).toBeLessThan(10);
  });

  it('steps continuous x-axis down when D3 overshoots on narrow temporal scales', () => {
    // D3 time scales jump between calendar units — a request for 6 ticks on
    // a 3-year range can return 4 (yearly) or 14 (quarterly). On a narrow
    // chart we want the sparser choice, not the dense one.
    const narrowTimeSpec: NormalizedChartSpec = {
      ...lineSpec,
      data: [
        { date: '2022-01-01', value: 10 },
        { date: '2022-12-01', value: 40 },
      ],
    };
    const narrowArea = { x: 50, y: 50, width: 300, height: 300 };
    const scales = computeScales(narrowTimeSpec, narrowArea, narrowTimeSpec.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // A 300px-wide time axis should show at most ~6 labels, not the 10-14
    // that D3 produces when its nice() step hops into monthly territory.
    expect(axes.x!.ticks.length).toBeLessThanOrEqual(6);
    expect(axes.x!.ticks.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Vertical orientation overlap detection
// ---------------------------------------------------------------------------

describe('ticksOverlap with vertical orientation', () => {
  const fontSize = 12;
  const fontWeight = 400;

  it('returns false when vertical ticks have sufficient spacing', () => {
    // Labels at 30px intervals with 12px font (14.4px with lineHeight)
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: '100' },
      { value: 1, position: 30, label: '200' },
      { value: 2, position: 60, label: '300' },
      { value: 3, position: 90, label: '400' },
      { value: 4, position: 120, label: '500' },
    ];
    expect(ticksOverlap(ticks, fontSize, fontWeight, undefined, 'vertical')).toBe(false);
  });

  it('returns true when vertical ticks are too close', () => {
    // Labels at 10px intervals with 12px font - should overlap vertically
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: '100' },
      { value: 1, position: 10, label: '200' },
      { value: 2, position: 20, label: '300' },
    ];
    expect(ticksOverlap(ticks, fontSize, fontWeight, undefined, 'vertical')).toBe(true);
  });

  it('ignores label text width for vertical orientation', () => {
    // Very wide labels but well-spaced vertically - should NOT overlap
    const ticks: AxisTick[] = [
      { value: 0, position: 0, label: 'Very Long Label Text Here' },
      { value: 1, position: 40, label: 'Another Very Long Label' },
      { value: 2, position: 80, label: 'Yet Another Long Label' },
    ];
    // Horizontal would detect overlap, vertical should not
    expect(ticksOverlap(ticks, fontSize, fontWeight, undefined, 'horizontal')).toBe(true);
    expect(ticksOverlap(ticks, fontSize, fontWeight, undefined, 'vertical')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Horizontal bar chart: y-axis category label regression
// Mobile/compact viewports must show all category labels on horizontal bar
// charts, regardless of axisLabelDensity. Thinning is only valid on x-axis
// band scales where many category names can overlap horizontally.
// ---------------------------------------------------------------------------

describe('horizontal bar y-axis label thinning regression', () => {
  const countries = [
    'USA',
    'Germany',
    'France',
    'Japan',
    'UK',
    'Canada',
    'Australia',
    'Netherlands',
    'Sweden',
    'Switzerland',
  ];

  const hBarSpec: NormalizedChartSpec = {
    markType: 'bar',
    markDef: { type: 'bar', orient: 'horizontal' },
    data: countries.map((country, i) => ({ country, value: (i + 1) * 100 })),
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'country', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };

  it('shows all category labels on y-axis at minimal density (mobile regression)', () => {
    const scales = computeScales(hBarSpec, chartArea, hBarSpec.data);
    const axes = computeAxes(scales, chartArea, minimalStrategy, theme);

    // Every bar must have a label -- thinning to 3 on mobile was the bug
    expect(axes.y!.ticks.length).toBe(countries.length);
  });

  it('shows all category labels on y-axis at reduced density', () => {
    const reducedStrategy: LayoutStrategy = {
      ...minimalStrategy,
      axisLabelDensity: 'reduced',
    };
    const scales = computeScales(hBarSpec, chartArea, hBarSpec.data);
    const axes = computeAxes(scales, chartArea, reducedStrategy, theme);

    expect(axes.y!.ticks.length).toBe(countries.length);
  });

  it('still thins x-axis band scale labels at minimal density (column chart)', () => {
    const vBarSpec: NormalizedChartSpec = {
      ...hBarSpec,
      markDef: { type: 'bar', orient: 'vertical' },
      encoding: {
        x: { field: 'country', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const narrowArea = { x: 50, y: 50, width: 200, height: 300 };
    const scales = computeScales(vBarSpec, narrowArea, vBarSpec.data);
    const axes = computeAxes(scales, narrowArea, minimalStrategy, theme);

    // X-axis band scale with 10 categories at minimal density on a narrow chart
    // should thin -- showing all 10 on 200px would overlap
    expect(axes.x!.ticks.length).toBeLessThan(countries.length);
  });
});

// ---------------------------------------------------------------------------
// Log scale tick filtering — buildContinuousTicks
// D3 log scales ignore the count hint and return ticks at every sub-power
// position. The engine must filter these down to powers of the base only.
// ---------------------------------------------------------------------------

/**
 * Build a ResolvedScale backed by a D3 log scale, matching what buildLogScale produces.
 * Using a single `base` parameter keeps the D3 scale and channel config in sync,
 * mirroring how they're always derived from the same spec field.
 */
function makeLogScale(domain: [number, number], base = 10): ResolvedScale {
  const scale = scaleLog().domain(domain).range([400, 0]);
  scale.base(base);
  return {
    scale,
    type: 'log',
    channel: {
      field: 'value',
      type: 'quantitative',
      scale: base !== 10 ? { base } : undefined,
    },
  } as ResolvedScale;
}

describe('buildContinuousTicks — log scale power filtering', () => {
  it('returns only power-of-10 ticks for [5, 25000] at tickCount 5', () => {
    const resolved = makeLogScale([5, 25000]);
    const ticks = buildContinuousTicks(resolved, 5);
    const values = ticks.map((t) => t.value as number);
    // Should be exactly the powers of 10 in domain: 10, 100, 1000, 10000
    expect(values).toEqual([10, 100, 1000, 10000]);
  });

  it('returns only power-of-10 ticks for [1, 1000000] at tickCount 5', () => {
    const resolved = makeLogScale([1, 1_000_000]);
    const ticks = buildContinuousTicks(resolved, 5);
    const values = ticks.map((t) => t.value as number);
    // Assert invariants rather than exact output: every tick is a power of 10,
    // and we get at least 5 (the domain spans 6 decades).
    for (const v of values) {
      const exp = Math.log10(v);
      expect(Math.abs(exp - Math.round(exp))).toBeLessThan(1e-9);
    }
    expect(values.length).toBeGreaterThanOrEqual(5);
  });

  it('returns only powers-of-2 for [1, 64] base-2 at tickCount 5', () => {
    const resolved = makeLogScale([1, 64], 2);
    const ticks = buildContinuousTicks(resolved, 5);
    const values = ticks.map((t) => t.value as number);
    expect(values).toEqual([1, 2, 4, 8, 16, 32, 64]);
  });

  it('handles fractional powers for [0.001, 100] at tickCount 5', () => {
    const resolved = makeLogScale([0.001, 100]);
    const ticks = buildContinuousTicks(resolved, 5);
    const values = ticks.map((t) => t.value as number);
    // Tolerance check prevents floating-point false negatives on 0.001, 0.01, 0.1
    expect(values).toEqual([0.001, 0.01, 0.1, 1, 10, 100]);
  });

  it('still produces ticks at tickCount 3 (regression guard)', () => {
    const resolved = makeLogScale([1, 1000]);
    const ticks = buildContinuousTicks(resolved, 3);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    const values = ticks.map((t) => t.value as number);
    // Every value must be a power of 10
    for (const v of values) {
      const exp = Math.log10(v);
      expect(Math.abs(exp - Math.round(exp))).toBeLessThan(1e-6);
    }
  });

  it('does not over-filter linear scales with the same domain', () => {
    const scale = scaleLinear().domain([5, 25000]).range([400, 0]);
    const resolved: ResolvedScale = {
      scale,
      type: 'linear',
      channel: { field: 'value', type: 'quantitative' },
    } as ResolvedScale;
    const ticks = buildContinuousTicks(resolved, 5);
    // Linear scale should return normal D3 ticks — not just power-of-10 values
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    // At least one tick should NOT be a power of 10 (e.g. 5000, 10000, 15000, 20000, 25000)
    const values = ticks.map((t) => t.value as number);
    const nonPowerOf10 = values.filter((v) => {
      if (v <= 0) return true;
      const exp = Math.log10(v);
      return Math.abs(exp - Math.round(exp)) >= 0.01;
    });
    expect(nonPowerOf10.length).toBeGreaterThan(0);
  });
});

describe('axis tickPosition', () => {
  it('defaults y-axis to inline for line charts', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, undefined, {
      data: lineSpec.data,
      encoding: lineSpec.encoding,
      markType: 'line',
    });

    expect(axes.y!.tickPosition).toBe('inline');
    expect(axes.y!.domainLine).toBe(false);
    expect(axes.y!.tickMarks).toBe(false);
    expect(axes.x!.tickPosition).toBe('gutter');
  });

  it('defaults y-axis to inline for area charts', () => {
    const areaSpec: NormalizedChartSpec = {
      ...lineSpec,
      markType: 'area',
      markDef: { type: 'area' },
    };
    const scales = computeScales(areaSpec, chartArea, areaSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, undefined, {
      data: areaSpec.data,
      encoding: areaSpec.encoding,
      markType: 'area',
    });

    expect(axes.y!.tickPosition).toBe('inline');
  });

  it('defaults y-axis to gutter when markType is unknown', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.y!.tickPosition).toBe('gutter');
  });

  it('respects explicit user override on y-axis', () => {
    const overrideSpec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        y: { ...lineSpec.encoding.y!, axis: { tickPosition: 'gutter' } },
      },
    };
    const scales = computeScales(overrideSpec, chartArea, overrideSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, undefined, {
      data: overrideSpec.data,
      encoding: overrideSpec.encoding,
      markType: 'line',
    });

    expect(axes.y!.tickPosition).toBe('gutter');
  });

  it('right-side y-axis stays gutter even on line charts', () => {
    const dualSpec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        y: { ...lineSpec.encoding.y!, axis: { orient: 'right' } },
      },
    };
    const scales = computeScales(dualSpec, chartArea, dualSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, undefined, {
      data: dualSpec.data,
      encoding: dualSpec.encoding,
      markType: 'line',
    });

    expect(axes.y!.tickPosition).toBe('gutter');
  });
});

describe('axis extent and titlePosition', () => {
  it('emits x-axis extent for a basic line chart', () => {
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.extent).toBeGreaterThan(0);
    expect(axes.x!.extent).toBeLessThan(200);
  });

  it('extent is larger when axis has a title', () => {
    const specWithTitle: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        x: { ...lineSpec.encoding.x, axis: { title: 'Year' } },
      },
    };
    const scales = computeScales(specWithTitle, chartArea, specWithTitle.data);
    const axesWithTitle = computeAxes(scales, chartArea, fullStrategy, theme);

    const scalesNoTitle = computeScales(lineSpec, chartArea, lineSpec.data);
    const axesNoTitle = computeAxes(scalesNoTitle, chartArea, fullStrategy, theme);

    expect(axesWithTitle.x!.extent).toBeGreaterThan(axesNoTitle.x!.extent!);
  });

  it('emits titlePosition for x-axis with title', () => {
    const specWithTitle: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        x: { ...lineSpec.encoding.x, axis: { title: 'Year' } },
      },
    };
    const scales = computeScales(specWithTitle, chartArea, specWithTitle.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.titlePosition).toBeDefined();
    expect(axes.x!.titlePosition!.x).toBeCloseTo(chartArea.x + chartArea.width / 2, 0);
    expect(axes.x!.titlePosition!.y).toBeGreaterThan(chartArea.y + chartArea.height);
  });

  it('emits titlePosition for y-axis with title', () => {
    const specWithYTitle: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        y: { ...lineSpec.encoding.y, axis: { title: 'Value' } },
      },
    };
    const scales = computeScales(specWithYTitle, chartArea, specWithYTitle.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, undefined, {
      data: specWithYTitle.data,
      encoding: specWithYTitle.encoding as Encoding,
      skipX: false,
      skipY: false,
      markType: 'line',
      totalWidth: 600,
    });

    expect(axes.y!.titlePosition).toBeDefined();
    expect(axes.y!.titlePosition!.x).toBeLessThan(chartArea.x);
    expect(axes.y!.titlePosition!.angle).toBe(-90);
  });
});
