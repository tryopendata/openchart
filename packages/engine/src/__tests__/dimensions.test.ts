import type { LayoutStrategy, LegendLayout } from '@opendata-ai/openchart-core';
import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeDimensions } from '../layout/dimensions';
import { INLINE_TICK_OVERHANG_PAD } from '../layout/shared';
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

  it('reserves enough left margin for y-axis title to clear tick labels', () => {
    const specWithYTitle: NormalizedChartSpec = {
      ...baseSpec,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', axis: { title: 'Share of districts' } },
      },
    };
    const specWithoutYTitle: NormalizedChartSpec = {
      ...baseSpec,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const dimsWithTitle = computeDimensions(
      specWithYTitle,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsWithoutTitle = computeDimensions(
      specWithoutYTitle,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // A chart with a y-axis title needs more left margin than one without
    expect(dimsWithTitle.margins.left).toBeGreaterThan(dimsWithoutTitle.margins.left);
    // The difference should be at least enough for the rotated title glyph
    // plus breathing room (halfGlyph ~7 + trailing pad 4 = 11px minimum)
    expect(dimsWithTitle.margins.left - dimsWithoutTitle.margins.left).toBeGreaterThanOrEqual(11);
  });

  it('y-axis title margin scales with tick label width (gutter ticks)', () => {
    // Bar chart: y-tick labels sit in a left gutter, so the title must clear
    // them. Wider tick labels ("2,000,000" vs "9") push the title further out.
    const barBase: NormalizedChartSpec = {
      ...baseSpec,
      markType: 'bar',
      markDef: { type: 'bar' },
    };
    const smallValues: NormalizedChartSpec = {
      ...barBase,
      data: [
        { cat: 'a', value: 5 },
        { cat: 'b', value: 9 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', axis: { title: 'Count' } },
      },
    };
    const largeValues: NormalizedChartSpec = {
      ...barBase,
      data: [
        { cat: 'a', value: 1_500_000 },
        { cat: 'b', value: 2_000_000 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: {
          field: 'value',
          type: 'quantitative',
          axis: { title: 'Revenue ($)', format: ',.0f' },
        },
      },
    };

    const dimsSmall = computeDimensions(
      smallValues,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsLarge = computeDimensions(
      largeValues,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // Explicit format ",.0f" on large values produces "2,000,000" tick labels
    // that are much wider than the abbreviated "0.0" from small values,
    // so the y-axis title margin should grow to keep clearance
    expect(dimsLarge.margins.left).toBeGreaterThan(dimsSmall.margins.left);
  });

  it('y-axis title margin ignores tick label width for inline ticks (line)', () => {
    // Line chart with continuous y: tick labels render inline (above their
    // gridline inside the plot), not in a left gutter. The title only needs to
    // clear the chart edge, so wide tick values must NOT inflate the margin —
    // that dead padding is the exact bug this guards against.
    const smallValues: NormalizedChartSpec = {
      ...baseSpec,
      data: [
        { date: '2020-01-01', value: 5 },
        { date: '2021-01-01', value: 9 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', axis: { title: 'Count' } },
      },
    };
    const largeValues: NormalizedChartSpec = {
      ...baseSpec,
      data: [
        { date: '2020-01-01', value: 1_500_000 },
        { date: '2021-01-01', value: 2_000_000 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: {
          field: 'value',
          type: 'quantitative',
          axis: { title: 'Revenue ($)', format: ',.0f' },
        },
      },
    };

    const dimsSmall = computeDimensions(
      smallValues,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const dimsLarge = computeDimensions(
      largeValues,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    expect(dimsLarge.margins.left).toBe(dimsSmall.margins.left);
  });

  it('reserves gutter margin when an explicit band scale forces gutter ticks (line)', () => {
    // A line chart's y-tick position is decided by the RESOLVED scale type, not
    // the field type. An explicit `scale.type: 'band'` on a quantitative field
    // resolves to a categorical (gutter) axis, so computeAxes draws a gutter
    // title. The margin reservation must agree — reserving the inline (narrow)
    // margin here would let the title collide with the gutter tick labels.
    const bandScaleLine: NormalizedChartSpec = {
      ...baseSpec,
      data: [
        { date: '2020-01-01', value: 1_500_000 },
        { date: '2021-01-01', value: 2_000_000 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: {
          field: 'value',
          type: 'quantitative',
          scale: { type: 'band' },
          axis: { title: 'Revenue ($)', format: ',.0f' },
        },
      },
    };
    const inlineLine: NormalizedChartSpec = {
      ...baseSpec,
      data: [
        { date: '2020-01-01', value: 1_500_000 },
        { date: '2021-01-01', value: 2_000_000 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: {
          field: 'value',
          type: 'quantitative',
          axis: { title: 'Revenue ($)', format: ',.0f' },
        },
      },
    };

    const bandDims = computeDimensions(
      bandScaleLine,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    const inlineDims = computeDimensions(
      inlineLine,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // The gutter (band-scale) reservation includes the wide tick-label width, so
    // it must exceed the inline reservation that omits it.
    expect(bandDims.margins.left).toBeGreaterThan(inlineDims.margins.left);
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
    // Both modes use transparent background — the dark adaptation changes text/axis
    // colors while keeping transparency so the host surface shows through.
    expect(darkDims.theme.colors.background).toBe('transparent');
    expect(lightDims.theme.colors.background).toBe('transparent');
    // Dark mode uses a different text color
    expect(darkDims.theme.colors.text).not.toBe(lightDims.theme.colors.text);
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

  describe('metrics bar', () => {
    const fourMetrics = [
      { label: 'CLOSE', value: '$186.10', delta: '+1.4%', deltaTone: 'up' as const },
      { label: 'ALL-TIME HIGH', value: '$202.00' },
      { label: '3-YR RETURN', value: '+1228%', secondary: '10.3x' },
      { label: 'AVG MONTHLY', value: '$104.95' },
    ];

    it('reserves space and emits cells when metrics fit', () => {
      const spec: NormalizedChartSpec = { ...baseSpec, metrics: fourMetrics };
      const dims = computeDimensions(spec, { width: 800, height: 500 }, emptyLegend, lightTheme);

      expect(dims.metrics).toBeDefined();
      expect(dims.metrics?.cells).toHaveLength(4);
      // First cell sits at the container left padding (aligned with title /
      // eyebrow), not indented to the chart area's left gutter.
      expect(dims.metrics?.cells[0].x).toBeLessThanOrEqual(dims.chartArea.x);
      expect(dims.metrics?.cells[0].x).toBeGreaterThan(0);
      // Cells span the metrics area evenly
      const totalSpan =
        (dims.metrics?.cells[3].x ?? 0) +
        (dims.metrics?.cells[3].cellWidth ?? 0) -
        (dims.metrics?.cells[0].x ?? 0);
      const cellWidth = totalSpan / 4;
      expect(dims.metrics?.cells[1].x).toBeCloseTo((dims.metrics?.cells[0].x ?? 0) + cellWidth, 1);
    });

    it('shrinks chart-area top to accommodate metric bar', () => {
      const noMetrics = computeDimensions(
        baseSpec,
        { width: 800, height: 500 },
        emptyLegend,
        lightTheme,
      );
      const withMetrics = computeDimensions(
        { ...baseSpec, metrics: fourMetrics },
        { width: 800, height: 500 },
        emptyLegend,
        lightTheme,
      );

      expect(withMetrics.chartArea.height).toBeLessThan(noMetrics.chartArea.height);
      expect(withMetrics.margins.top).toBeGreaterThan(noMetrics.margins.top);
    });

    it('strips metric bar on narrow widths', () => {
      const spec: NormalizedChartSpec = { ...baseSpec, metrics: fourMetrics };
      const dims = computeDimensions(spec, { width: 400, height: 400 }, emptyLegend, lightTheme);
      expect(dims.metrics).toBeUndefined();

      // Top margin should match the no-metrics case (no leftover reservation)
      const noMetrics = computeDimensions(
        baseSpec,
        { width: 400, height: 400 },
        emptyLegend,
        lightTheme,
      );
      expect(dims.margins.top).toBe(noMetrics.margins.top);
    });

    it('strips metric bar when value text would overflow', () => {
      const oversizeMetrics = [
        { label: 'A', value: 'this is an extraordinarily long monetary value that cannot fit' },
        { label: 'B', value: 'another impossibly long string to force overflow detection' },
        { label: 'C', value: 'still more text that pushes well past the cell width' },
        { label: 'D', value: 'and one more lengthy figure for good measure here too' },
      ];
      const spec: NormalizedChartSpec = { ...baseSpec, metrics: oversizeMetrics };
      const dims = computeDimensions(spec, { width: 600, height: 400 }, emptyLegend, lightTheme);
      expect(dims.metrics).toBeUndefined();
    });

    it('returns undefined when metrics array is empty', () => {
      const spec: NormalizedChartSpec = { ...baseSpec, metrics: [] };
      const dims = computeDimensions(spec, { width: 800, height: 500 }, emptyLegend, lightTheme);
      expect(dims.metrics).toBeUndefined();
    });
  });

  it('avoids doubling axisMargin and legendGap when top legend is present', () => {
    const dimsWithTopLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      topLegend,
      lightTheme,
    );
    const dimsNoLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );

    // Without a top legend, the full topAxisGap (axisMargin + inlineTickOverhang)
    // separates chrome from chart area. With a top legend, legendGap already
    // provides separation, so only inlineTickOverhang is added (not the full
    // topAxisGap). This means the chart area gains back ~axisMargin (6px)
    // that would otherwise be redundant spacing.
    //
    // The top margin with legend includes: gapAbove(6) + legendHeight(28)
    // + legendGap(8) + inlineTickOverhang(17) instead of the no-legend
    // topAxisGap(23). Net: margin delta = 6 + 28 + 8 + 17 - 23 = 36px.
    // If axisMargin were doubling up: 6 + 28 + 8 + 23 - 23 = 42px.
    const topMarginDelta = dimsWithTopLegend.margins.top - dimsNoLegend.margins.top;
    expect(topMarginDelta).toBeLessThan(topLegend.bounds.height + legendGap(600) + 1);
    // With a legend present, the chart area should still be shorter
    expect(dimsWithTopLegend.chartArea.height).toBeLessThan(dimsNoLegend.chartArea.height);
  });

  it('returns effectiveAxisGap on the primary return path', () => {
    const overhang = lightTheme.fonts.sizes.axisTick + INLINE_TICK_OVERHANG_PAD;

    // With a top legend only the inline-tick overhang separates legend and
    // chart area (placeLegend consumes this to lift the legend above it).
    const withTopLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      topLegend,
      lightTheme,
    );
    expect(withTopLegend.effectiveAxisGap).toBe(overhang);

    // Without a top legend the full topAxisGap applies.
    const noLegend = computeDimensions(
      baseSpec,
      { width: 600, height: 400 },
      emptyLegend,
      lightTheme,
    );
    expect(noLegend.effectiveAxisGap).toBe(lightTheme.spacing.axisMargin + overhang);
  });

  it('returns effectiveAxisGap on the chrome-strip guardrail path', () => {
    // A cramped height forces the guardrail early-return with stripped chrome.
    const talkativeSpec: NormalizedChartSpec = {
      ...baseSpec,
      chrome: {
        title: { text: 'A chart title that occupies chrome space' },
        subtitle: { text: 'A subtitle that gets stripped in compact chrome' },
        source: { text: 'Source: somewhere' },
      },
    };
    const dims = computeDimensions(
      talkativeSpec,
      { width: 600, height: 120 },
      topLegend,
      lightTheme,
    );
    // Prove the guardrail fired: compact chrome drops the subtitle.
    expect(dims.chrome.subtitle).toBeUndefined();
    expect(dims.effectiveAxisGap).toBe(lightTheme.fonts.sizes.axisTick + INLINE_TICK_OVERHANG_PAD);
  });

  // A chrome block that eats too much of a fixed-height plot budget trips the
  // guardrail even when the chart area still clears the min-dimension floor.
  // 300x360 is tall enough that a no-chrome layout would leave ~274x238 of
  // plot (well above the 60x40 min), so the width/height triggers don't fire.
  // The long title/subtitle push pre-strip chrome past 40% of the 360 budget,
  // which is what actually flips full -> compact here.
  const plotEatingChrome = {
    title: {
      text: 'A fairly long chart title that wraps across several lines in a narrow container to consume vertical chrome space',
    },
    subtitle: {
      text: 'A supporting subtitle line that also wraps and adds even more chrome height in a narrow layout',
    },
  };

  it('trips the guardrail when chrome exceeds the plot-share cap (subtract mode)', () => {
    const spec: NormalizedChartSpec = { ...baseSpec, chrome: plotEatingChrome };
    const dims = computeDimensions(spec, { width: 300, height: 360 }, emptyLegend, lightTheme);

    // Chrome ate too much of the fixed-height budget: compact chrome drops the
    // subtitle and the strip flag is set for the tick-regeneration gate.
    expect(dims.chrome.subtitle).toBeUndefined();
    expect(dims.chromeStripped).toBe(true);
  });

  it('trips the guardrail at a normal height class, not just short containers', () => {
    // 380px height is a `normal` height class (> 350), so the responsive
    // strategy leaves chromeMode `full` on its own. The subtitle drop here comes
    // from the plot-share guardrail (chrome > 40% of the budget), proving the new
    // trigger is not merely piggybacking on the short-height compact path.
    const spec: NormalizedChartSpec = { ...baseSpec, chrome: plotEatingChrome };
    const dims = computeDimensions(spec, { width: 300, height: 380 }, emptyLegend, lightTheme);

    expect(dims.chromeStripped).toBe(true);
    expect(dims.chrome.subtitle).toBeUndefined();
  });

  it('leaves normal chrome intact in subtract mode (guardrail does not over-fire)', () => {
    // A short, single-line title well under 40% of the budget must NOT trip the
    // guardrail: the default path stays byte-identical for the common case.
    const spec: NormalizedChartSpec = {
      ...baseSpec,
      chrome: { title: { text: 'Short title' } },
    };
    const dims = computeDimensions(spec, { width: 600, height: 400 }, emptyLegend, lightTheme);

    expect(dims.chromeStripped).toBeFalsy();
    expect(dims.chrome.title).toBeDefined();
  });

  it('does not trip the plot-share guardrail in grow mode', () => {
    // Same spec, but grow mode gives the plot its full height budget, so the
    // plot-share check is gated off and chrome is preserved intact.
    const spec: NormalizedChartSpec = {
      ...baseSpec,
      chrome: plotEatingChrome,
      chromeLayout: 'grow',
    };
    const dims = computeDimensions(spec, { width: 300, height: 360 }, emptyLegend, lightTheme);

    expect(dims.chrome.subtitle).toBeDefined();
    expect(dims.chromeStripped).toBeFalsy();
  });

  it('grows the output SVG height in grow mode through the full compileChart pipeline', () => {
    // End-to-end guard: computeDimensions unit tests inject chromeLayout onto a
    // NormalizedChartSpec, which the real normalize step does not produce. This
    // test drives the actual pipeline (normalize -> layout -> output) so a
    // dropped chromeLayout field or an ungrown output dimension is caught.
    const spec = {
      mark: 'bar' as const,
      data: [
        { r: 'A', p: 16 },
        { r: 'B', p: 41 },
        { r: 'C', p: 73 },
        { r: 'D', p: 84 },
        { r: 'F', p: 90 },
      ],
      encoding: {
        x: { field: 'r', type: 'nominal' as const },
        y: { field: 'p', type: 'quantitative' as const },
      },
      chrome: {
        title:
          'A long headline that wraps to several lines on a narrow phone viewport and would otherwise compress the plot',
        subtitle: 'A supporting subtitle line that also wraps in the narrow layout here',
      },
    };
    const opts = { width: 340, height: 500 };

    const subtract = compileChart(spec, opts);
    const growSpec = compileChart({ ...spec, chromeLayout: 'grow' as const }, opts);
    const growOption = compileChart(spec, { ...opts, chromeLayout: 'grow' as const });

    // Default and explicit subtract leave the SVG at the requested height.
    expect(subtract.dimensions.height).toBe(500);
    // Spec-level grow grows the SVG past the budget by the chrome height.
    expect(growSpec.dimensions.height).toBeGreaterThan(subtract.dimensions.height);
    // Option-level grow reaches the same height (both surfaces work).
    expect(growOption.dimensions.height).toBe(growSpec.dimensions.height);
  });

  it('regenerates y-ticks against the post-strip plot when the guardrail fires (compileChart)', () => {
    // A long title exceeds 40% of the 400px budget in a narrow container, so
    // the guardrail strips chrome and the plot grows. The plan pinned y-ticks
    // against the pre-strip (shorter) plot; dims.chromeStripped tells compile
    // to drop them so computeAxes regenerates against the final chartArea.
    const spec = {
      mark: 'line' as const,
      data: [
        { date: '2020-01-01', value: 10 },
        { date: '2020-06-01', value: 55 },
        { date: '2021-01-01', value: 40 },
        { date: '2021-06-01', value: 90 },
        { date: '2022-01-01', value: 25 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
      },
      chrome: {
        title:
          'A very long chart title that will wrap across several lines in a narrow container and eat well over forty percent of the plot budget forcing the guardrail',
        subtitle:
          'A supporting subtitle that also occupies chrome vertical space in the narrow layout',
      },
    };
    const layout = compileChart(spec, { width: 320, height: 400 });

    // Guardrail fired: compact chrome dropped the subtitle.
    expect(layout.chrome.subtitle).toBeUndefined();
    // Y-ticks were regenerated for the final (taller) plot rather than frozen
    // at a degenerate min/max pair. A ~100px plot warrants several gridlines.
    expect(layout.axes.y?.ticks.length).toBeGreaterThanOrEqual(3);
    expect(layout.axes.y?.gridlines.length).toBeGreaterThanOrEqual(3);
  });

  it('carries maxLines to the compiled title and bounds reserved chrome height (compileChart)', () => {
    // Integration guard: chrome.title.style.maxLines must survive normalize ->
    // layout and land on the resolved element the renderer reads, and the
    // reserved chrome height must reflect the cap (fewer reserved lines -> a
    // taller plot than the same title uncapped).
    const longTitle =
      'A very long headline that would wrap to many lines on a narrow phone viewport indeed for sure now here we go';
    const opts = { width: 320, height: 500 };
    const capped = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { r: 'A', p: 16 },
          { r: 'B', p: 41 },
          { r: 'C', p: 73 },
        ],
        encoding: {
          x: { field: 'r', type: 'nominal' as const },
          y: { field: 'p', type: 'quantitative' as const },
        },
        chrome: { title: { text: longTitle, style: { maxLines: 2 } } },
      },
      opts,
    );
    const uncapped = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { r: 'A', p: 16 },
          { r: 'B', p: 41 },
          { r: 'C', p: 73 },
        ],
        encoding: {
          x: { field: 'r', type: 'nominal' as const },
          y: { field: 'p', type: 'quantitative' as const },
        },
        chrome: { title: { text: longTitle } },
      },
      opts,
    );

    // The cap reaches the resolved element the renderer truncates against.
    expect(capped.chrome.title?.maxLines).toBe(2);
    // Bounding the title to 2 lines reserves less top space, so the plot is
    // taller than the same title left to wrap freely.
    expect(capped.area.height).toBeGreaterThan(uncapped.area.height);
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
    // same band as the x-axis tick row. The reservation now flows through
    // chrome.bottomHeight (via bottomLegendReservation) so chrome stacks
    // below the legend band rather than colliding with it. The base bottom
    // margin already includes xAxisHeight, so the additional reservation
    // collapses to legendHeight + gap.
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

    // Reservation is legendHeight + gap, threaded through chrome.bottomHeight.
    const gap = legendGap(600);
    const expectedExtra = bottomLegend.bounds.height + gap;
    expect(dimsBottom.margins.bottom - dimsNoLegend.margins.bottom).toBeCloseTo(expectedExtra, 5);
    // The reservation lives on chrome.bottomHeight, not as a separate margin
    // delta, so renderers reading chrome.source.y get the legend offset baked
    // in for free.
    expect(dimsBottom.chrome.bottomHeight - dimsNoLegend.chrome.bottomHeight).toBeCloseTo(
      expectedExtra,
      5,
    );
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

  it('positions bottom chrome (source) below the bottom legend band', () => {
    // Follow-up regression: a bottom legend reserved space below the x-axis
    // tick row, but source/byline/footer chrome was still positioned via
    // chartBottom + xAxisExtent + chartToFooter, landing in the same band as
    // the legend swatches. Threading bottomLegendReservation into computeChrome
    // now shifts chrome.source.y so it stacks below the legend.
    const spec = {
      mark: 'area' as const,
      data: [
        { year: '2020', value: 10, series: 'A' },
        { year: '2021', value: 20, series: 'A' },
        { year: '2022', value: 15, series: 'A' },
        { year: '2020', value: 8, series: 'B' },
        { year: '2021', value: 18, series: 'B' },
        { year: '2022', value: 12, series: 'B' },
      ],
      encoding: {
        x: { field: 'year', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'series', type: 'nominal' as const },
      },
      legend: { position: 'bottom' as const, show: true },
      chrome: {
        source: 'World Bank, 2024',
        byline: 'OpenChart Newsroom',
      },
    };

    const layout = compileChart(spec, { width: 800, height: 500 });

    // Sanity: legend and chrome both rendered.
    expect(layout.legend.position).toBe('bottom');
    expect(layout.legend.entries.length).toBeGreaterThan(0);
    expect(layout.chrome.source).toBeDefined();
    expect(layout.chrome.byline).toBeDefined();

    // Compute chrome's absolute y the same way the renderer does:
    // bottomOffset = chartBottom + xAxisExtent (= 26 for default unrotated x-axis).
    const xAxisExtent = 26;
    const bottomOffset = layout.area.y + layout.area.height + xAxisExtent;
    const sourceAbsoluteY = bottomOffset + layout.chrome.source!.y;
    const bylineAbsoluteY = bottomOffset + layout.chrome.byline!.y;

    // Legend's bottom edge.
    const legendBottom = layout.legend.bounds.y + layout.legend.bounds.height;

    // Source must land below the legend band, with at least a small gap
    // (chartToFooter ≈ 12px) for breathing room.
    expect(sourceAbsoluteY).toBeGreaterThan(legendBottom);
    expect(bylineAbsoluteY).toBeGreaterThan(sourceAbsoluteY);
  });

  // Guards issue 2 (narrow-width space efficiency). The responsive metrics
  // (scaled container padding, halved horizontal padding, collapsed legend/
  // chrome gaps below the compact breakpoint) already keep the plot area's
  // share of a phone-sized container within a couple of points of desktop.
  // These floors lock that in: if a future change stops scaling padding down
  // on narrow viewports, the plot share drops and the test fails.
  describe('plot-area share stays efficient at narrow widths', () => {
    const titledSpec: NormalizedChartSpec = {
      ...baseSpec,
      markType: 'bar',
      markDef: { type: 'bar' },
      encoding: {
        x: { field: 'date', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      chrome: {
        title: { text: 'A representative chart title' },
        subtitle: { text: 'A subtitle line' },
        source: { text: 'Source: somewhere' },
      },
    };

    it('reserves at least 85% of container width for the plot at 375px', () => {
      const dims = computeDimensions(
        titledSpec,
        { width: 375, height: 500 },
        emptyLegend,
        lightTheme,
      );
      expect(dims.chartArea.width / 375).toBeGreaterThanOrEqual(0.85);
    });

    it('reserves at least 55% of container height for the plot at 375px', () => {
      const dims = computeDimensions(
        titledSpec,
        { width: 375, height: 500 },
        emptyLegend,
        lightTheme,
      );
      expect(dims.chartArea.height / 500).toBeGreaterThanOrEqual(0.55);
    });

    it('narrow plot width share is no worse than desktop', () => {
      const narrow = computeDimensions(
        titledSpec,
        { width: 375, height: 500 },
        emptyLegend,
        lightTheme,
      );
      const desktop = computeDimensions(
        titledSpec,
        { width: 700, height: 500 },
        emptyLegend,
        lightTheme,
      );
      // Narrow viewports must not waste more horizontal space than desktop:
      // the halved horizontal padding keeps the share on par (allow 2pt slack).
      expect(narrow.chartArea.width / 375).toBeGreaterThanOrEqual(
        desktop.chartArea.width / 700 - 0.02,
      );
    });
  });

  it('keeps the inline y-axis title inside the container on narrow, large-font charts', () => {
    // Regression (mobile): the inline y-tick fix reserved a narrow left margin,
    // but computeAxes still positioned the rotated y-title with the GUTTER
    // offset (tick-label width + viewport floor). On a phone at deck-scale
    // fonts that pushed the title's rotation center to x ≈ -1, clipping the
    // whole title off the left edge. The title offset now honors the inline
    // flag, so titlePosition.x stays a comfortable distance inside x = 0.
    const spec = {
      mark: { type: 'line' as const, point: true },
      data: [
        { year: '2009-10', pct: 94.2 },
        { year: '2015-16', pct: 93.8 },
        { year: '2020-21', pct: 95.0 },
      ],
      encoding: {
        x: { field: 'year', type: 'ordinal' as const },
        y: {
          field: 'pct',
          type: 'quantitative' as const,
          axis: { title: 'Kindergartners with 2-dose MMR', grid: true, format: '.0f' },
          scale: { domain: [90, 96], nice: false },
        },
      },
      theme: { fonts: { sizes: { body: 21, axisTick: 18 } } },
      chrome: { title: 'T', subtitle: 'S', source: 'Src' },
    };

    for (const width of [320, 360, 390]) {
      const layout = compileChart(spec, { width, height: 600 });
      const yAxis = layout.axes.y;
      expect(yAxis?.tickPosition).toBe('inline');
      const title = yAxis?.titlePosition;
      expect(title).toBeDefined();
      // The title is rotated -90° anchored middle; its glyph box straddles the
      // rotation center by ~half the title font. The left edge must stay on the
      // canvas (x >= 0). Assert the rotation center clears half a glyph.
      const halfGlyph = Math.ceil(layout.theme.fonts.sizes.body / 2);
      expect(title!.x - halfGlyph).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('computeDimensions chromeLayout: grow', () => {
  const chromeSpec: NormalizedChartSpec = {
    ...baseSpec,
    chrome: {
      title: { text: 'Test Chart' },
      subtitle: { text: 'A subtitle that adds chrome height' },
    },
  };
  const size = { width: 600, height: 400 } as const;

  it('grows the plot area and SVG by the chrome height vs subtract', () => {
    const subtractDims = computeDimensions(
      { ...chromeSpec, chromeLayout: 'subtract' },
      size,
      emptyLegend,
      lightTheme,
    );
    const growDims = computeDimensions(
      { ...chromeSpec, chromeLayout: 'grow' },
      size,
      emptyLegend,
      lightTheme,
    );

    const chromeHeight = subtractDims.chrome.topHeight + subtractDims.chrome.bottomHeight;
    expect(chromeHeight).toBeGreaterThan(0);

    // Plot grows by the chrome height (never asserts chartArea === height).
    expect(growDims.chartArea.height).toBeGreaterThan(subtractDims.chartArea.height);
    expect(growDims.chartArea.height).toBeCloseTo(subtractDims.chartArea.height + chromeHeight, 0);

    // The final SVG total grows by the chrome height; subtract stays at height.
    expect(subtractDims.total.height).toBe(size.height);
    expect(growDims.total.height).toBeCloseTo(size.height + chromeHeight, 0);
  });

  it('defaults to subtract when chromeLayout is omitted', () => {
    const defaultDims = computeDimensions(chromeSpec, size, emptyLegend, lightTheme);
    const subtractDims = computeDimensions(
      { ...chromeSpec, chromeLayout: 'subtract' },
      size,
      emptyLegend,
      lightTheme,
    );

    expect(defaultDims.chartArea.height).toBe(subtractDims.chartArea.height);
    expect(defaultDims.total.height).toBe(subtractDims.total.height);
    expect(defaultDims.total.height).toBe(size.height);
  });
});

describe('radial chart horizontal centering', () => {
  const arcSpec = {
    mark: 'arc' as const,
    data: [
      { category: 'A', value: 23 },
      { category: 'B', value: 30 },
      { category: 'C', value: 16 },
    ],
    encoding: {
      color: { field: 'category', type: 'nominal' as const },
      theta: { field: 'value', type: 'quantitative' as const },
    },
  };

  it('centers the plot box in the figure', () => {
    // Regression guard for the arc off-centering that the right-legend default
    // caused: the gutter reserved for a right-hand legend skewed the plot box
    // left, and the arc then centered correctly inside a box that was itself
    // off-center (475 of a 1000px figure). Any future change that reserves
    // asymmetric horizontal margins for a radial chart trips this.
    const width = 1000;
    const layout = compileChart(arcSpec, { width, height: 500 });
    const { x, width: areaWidth } = layout.area;
    const leftGap = x;
    const rightGap = width - x - areaWidth;
    expect(rightGap).toBeCloseTo(leftGap, 0);
    expect(x + areaWidth / 2).toBeCloseTo(width / 2, 0);
  });

  it('centers the arc mark on the figure midline', () => {
    const width = 1000;
    const layout = compileChart(arcSpec, { width, height: 500 });
    const arc = layout.marks.find((m) => m.type === 'arc');
    expect(arc).toBeDefined();
    expect((arc as { center: { x: number } }).center.x).toBeCloseTo(width / 2, 0);
  });
});
