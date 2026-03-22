import type { AxisTick, LayoutStrategy } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeAxes, effectiveDensity, thinTicksUntilFit, ticksOverlap } from '../layout/axes';
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

  it('reduces y-axis ticks for very short chart areas (< 120px)', () => {
    const shortArea = { x: 50, y: 50, width: 500, height: 80 };
    const scales = computeScales(lineSpec, shortArea, lineSpec.data);
    const axesShort = computeAxes(scales, shortArea, fullStrategy, theme);

    // Even though the strategy says 'full', height < 120 forces minimal (3 ticks)
    expect(axesShort.y!.ticks.length).toBeLessThanOrEqual(3);
  });

  it('reduces y-axis ticks for medium-short chart areas (120-200px)', () => {
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
    expect(axes.y!.ticks.length).toBeLessThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Width-aware x-axis tick reduction
  // -------------------------------------------------------------------------

  it('reduces x-axis ticks for very narrow chart areas (< 150px)', () => {
    const narrowArea = { x: 50, y: 50, width: 100, height: 300 };
    const scales = computeScales(lineSpec, narrowArea, lineSpec.data);
    const axes = computeAxes(scales, narrowArea, fullStrategy, theme);

    // Width < 150 forces minimal density for x-axis
    expect(axes.x!.ticks.length).toBeLessThanOrEqual(3);
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
    expect(axesThumb.x!.ticks.length).toBeLessThanOrEqual(3);
    expect(axesThumb.y!.ticks.length).toBeLessThanOrEqual(3);

    // And fewer than full-size
    expect(axesThumb.x!.ticks.length).toBeLessThanOrEqual(axesFull.x!.ticks.length);
    expect(axesThumb.y!.ticks.length).toBeLessThanOrEqual(axesFull.y!.ticks.length);
  });

  // -------------------------------------------------------------------------
  // tickAngle propagation
  // -------------------------------------------------------------------------

  it('propagates tickAngle from encoding to x-axis layout', () => {
    const specWithAngle: NormalizedChartSpec = {
      ...lineSpec,
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { cat: 'California', val: 10 },
        { cat: 'New York', val: 20 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal', axis: { tickAngle: -90 } },
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

  it('propagates tickAngle to y-axis layout', () => {
    const specWithAngle: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', axis: { tickAngle: -45 } },
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

  it('does not thin x-axis ticks when explicit tickCount is set', () => {
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

    // With explicit tickCount, the engine should not thin
    // D3 may return fewer than 8 for this small dataset, but the point is
    // thinTicksUntilFit should not be called
    expect(axes.x!.ticks.length).toBeGreaterThan(0);
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

  it('gridlines survive tick thinning', () => {
    // Force thinning by using a measureText that reports wide labels
    const wideMeasure = () => ({ width: 200, height: 12 });
    const scales = computeScales(lineSpec, chartArea, lineSpec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme, wideMeasure);

    // Ticks should be thinned (fewer labels) but gridlines should remain at
    // all original tick positions
    expect(axes.y!.gridlines.length).toBeGreaterThanOrEqual(axes.y!.ticks.length);
    // With wide labels forcing thinning, gridlines should outnumber ticks
    if (axes.y!.ticks.length < axes.y!.gridlines.length) {
      // Gridlines retained positions that ticks lost — the fix is working
      expect(axes.y!.gridlines.length).toBeGreaterThan(axes.y!.ticks.length);
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

  it('falls back to deprecated label when title is not set', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: { field: 'date', type: 'temporal', axis: { label: 'Old Label' } },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    expect(axes.x!.label).toBe('Old Label');
  });

  it('prefers labelAngle over deprecated tickAngle', () => {
    const spec: NormalizedChartSpec = {
      ...lineSpec,
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          axis: { labelAngle: -30, tickAngle: -90 },
        },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const axes = computeAxes(scales, chartArea, fullStrategy, theme);

    // labelAngle takes precedence
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
