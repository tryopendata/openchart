import { describe, expect, it } from 'vitest';
import { compileChart, compileGraph, compileTable } from '../compile';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec = {
  mark: 'line' as const,
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' as const },
    y: { field: 'value', type: 'quantitative' as const },
    color: { field: 'country', type: 'nominal' as const },
  },
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

const barSpec = {
  mark: 'bar' as const,
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
    { name: 'C', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' as const },
    y: { field: 'name', type: 'nominal' as const },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileChart', () => {
  it('returns a ChartLayout with all required fields populated', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });

    // Chart area has real dimensions within the total viewport
    expect(layout.area.width).toBeGreaterThan(0);
    expect(layout.area.height).toBeGreaterThan(0);
    expect(layout.area.x).toBeGreaterThanOrEqual(0);
    expect(layout.area.y).toBeGreaterThanOrEqual(0);

    // Chrome is resolved with positions
    expect(layout.chrome.topHeight).toBeGreaterThan(0);
    expect(layout.chrome.title?.text).toBe('GDP Growth');

    // Axes have ticks
    expect(layout.axes.x?.ticks.length).toBeGreaterThan(0);
    expect(layout.axes.y?.ticks.length).toBeGreaterThan(0);

    // Marks were produced by the registered renderer
    expect(layout.marks.length).toBeGreaterThan(0);

    // Annotations array exists (empty for this spec since none were specified)
    expect(layout.annotations).toEqual([]);

    // Legend is auto-suppressed for line charts with endpoint labels
    expect(layout.legend.entries.length).toBe(0);

    // Tooltip descriptors is a Map (may or may not have entries depending on marks)
    expect(layout.tooltipDescriptors).toBeInstanceOf(Map);

    // Accessibility metadata is populated
    expect(layout.a11y.altText.length).toBeGreaterThan(0);
    expect(layout.a11y.role).toBe('img');

    // Theme is resolved with actual color values
    expect(layout.theme.colors.background).toBeTruthy();
    expect(layout.theme.colors.categorical.length).toBeGreaterThan(0);

    // Dimensions match the input
    expect(layout.dimensions).toEqual({ width: 600, height: 400 });
  });

  it('has correct total dimensions', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.dimensions.width).toBe(600);
    expect(layout.dimensions.height).toBe(400);
  });

  it('chart area fits within total dimensions', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.area.x).toBeGreaterThan(0);
    expect(layout.area.y).toBeGreaterThan(0);
    expect(layout.area.x + layout.area.width).toBeLessThan(600);
    expect(layout.area.y + layout.area.height).toBeLessThan(400);
  });

  it('chrome title and subtitle are resolved with correct text and positions', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.chrome.topHeight).toBeGreaterThan(0);

    // Title
    expect(layout.chrome.title!.text).toBe('GDP Growth');
    expect(layout.chrome.title!.x).toBeGreaterThanOrEqual(0);
    expect(layout.chrome.title!.y).toBeGreaterThan(0);
    expect(layout.chrome.title!.maxWidth).toBeGreaterThan(0);
    expect(layout.chrome.title!.style.fontSize).toBeGreaterThan(0);

    // Subtitle
    expect(layout.chrome.subtitle!.text).toBe('US vs UK over time');
    expect(layout.chrome.subtitle!.y).toBeGreaterThan(layout.chrome.title!.y);
  });

  it('bottom chrome source is resolved with text and position', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.chrome.bottomHeight).toBeGreaterThan(0);
    expect(layout.chrome.source!.text).toBe('World Bank');
    expect(layout.chrome.source!.x).toBeGreaterThanOrEqual(0);
    expect(layout.chrome.source!.y).toBeGreaterThan(0);
    expect(layout.chrome.source!.style.fontSize).toBeGreaterThan(0);
  });

  it('emits bottomAnchorY below the chart area', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.chrome.bottomAnchorY).toBeDefined();
    expect(layout.chrome.bottomAnchorY).toBeGreaterThanOrEqual(layout.area.y + layout.area.height);
  });

  it('has axes with ticks and valid positions for a line chart', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });

    // X axis
    const xTicks = layout.axes.x!.ticks;
    expect(xTicks.length).toBeGreaterThan(0);
    for (const tick of xTicks) {
      expect(tick.position).toBeGreaterThanOrEqual(0);
      expect(tick.label).toBeTruthy();
    }

    // Y axis
    const yTicks = layout.axes.y!.ticks;
    expect(yTicks.length).toBeGreaterThan(0);
    for (const tick of yTicks) {
      expect(tick.position).toBeGreaterThanOrEqual(0);
      expect(tick.label).toBeTruthy();
    }

    // Axes have start and end points
    expect(layout.axes.x!.start.x).toBeLessThan(layout.axes.x!.end.x);
    expect(layout.axes.y!.start.y).not.toBe(layout.axes.y!.end.y);
  });

  it('has a legend when color encoding is present and legend forced on', () => {
    const layout = compileChart(
      { ...lineSpec, legend: { show: true } },
      { width: 600, height: 400 },
    );
    expect(layout.legend.entries.length).toBeGreaterThan(0);
    expect(layout.legend.entries.some((e) => e.label === 'US')).toBe(true);
    expect(layout.legend.entries.some((e) => e.label === 'UK')).toBe(true);
  });

  it('legend entries have colors and shapes', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    for (const entry of layout.legend.entries) {
      expect(entry.color).toBeTruthy();
      expect(['circle', 'square', 'line']).toContain(entry.shape);
    }
  });

  it('legend position is "right" at full width', () => {
    const layout = compileChart(lineSpec, { width: 800, height: 400 });
    expect(layout.legend.position).toBe('right');
  });

  it('legend position is "top" at compact width', () => {
    const layout = compileChart(lineSpec, { width: 320, height: 400 });
    expect(layout.legend.position).toBe('top');
  });

  it('aligns the top legend left edge to the plot area, not the container edge', () => {
    // A y-axis title + numeric ticks reserves a left gutter, pushing the plot
    // area right of the container padding. The top legend should start at the
    // plot's left edge (above the y-axis guide), not flush against the container.
    const layout = compileChart(
      {
        ...lineSpec,
        encoding: {
          ...lineSpec.encoding,
          y: { field: 'value', type: 'quantitative' as const, axis: { title: 'GDP ($B)' } },
        },
        legend: { position: 'top' as const, show: true },
      },
      { width: 360, height: 400 },
    );
    expect(layout.legend.position).toBe('top');
    expect(layout.legend.entries.length).toBeGreaterThan(0);
    // Plot area is inset from the container by the y-axis gutter.
    expect(layout.area.x).toBeGreaterThan(0);
    // Legend left edge now matches the plot left edge (within a pixel).
    expect(layout.legend.bounds.x).toBeCloseTo(layout.area.x, 0);
    // And the legend never paints past the container's right padding edge.
    // Default theme spacing.padding is 20.
    expect(layout.legend.bounds.x + layout.legend.bounds.width).toBeLessThanOrEqual(360 - 20 + 0.5);
  });

  it('produces line marks with dataPoints (no PointMarks by default)', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.marks.length).toBeGreaterThan(0);

    const lineMarks = layout.marks.filter((m) => m.type === 'line');
    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(lineMarks.length).toBeGreaterThan(0);
    // Default: no PointMarks (voronoi overlay handles tooltips)
    expect(pointMarks.length).toBe(0);

    // Line marks should have points and dataPoints with valid coordinates
    for (const mark of lineMarks) {
      if (mark.type === 'line') {
        expect(mark.points.length).toBeGreaterThan(0);
        expect(mark.stroke).toBeTruthy();
        expect(mark.strokeWidth).toBeGreaterThan(0);
        expect(mark.dataPoints).toBeDefined();
        expect(mark.dataPoints!.length).toBeGreaterThan(0);
      }
    }
  });

  it('produces PointMarks when mark.point is true', () => {
    const specWithPoints = { ...lineSpec, mark: { type: 'line' as const, point: true as const } };
    const layout = compileChart(specWithPoints, { width: 600, height: 400 });

    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBeGreaterThan(0);
  });

  it('produces PointMarks on a multi-series area when mark.point is true', () => {
    // Multi-series areas derive their lines from area tops, which bypasses the
    // line renderer's point emission. mark.point must still place dots.
    const areaSpec = {
      ...lineSpec,
      mark: { type: 'area' as const, point: true as const },
    };
    const layout = compileChart(areaSpec, { width: 600, height: 400 });

    const areaMarks = layout.marks.filter((m) => m.type === 'area');
    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(areaMarks.length).toBe(2); // US + UK
    // One point per data row across both series (2 points x 2 series).
    expect(pointMarks.length).toBe(4);
    for (const p of pointMarks) {
      if (p.type === 'point') expect(p.r).toBeGreaterThan(0);
    }
  });

  it('does not produce PointMarks on a multi-series area by default', () => {
    const areaSpec = { ...lineSpec, mark: 'area' as const };
    const layout = compileChart(areaSpec, { width: 600, height: 400 });

    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBe(0);
  });

  it('includes accessibility metadata with meaningful content', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toContain('Line chart');
    expect(layout.a11y.altText).toContain('GDP Growth');
    expect(layout.a11y.role).toBe('img');
    expect(layout.a11y.dataTableFallback.length).toBeGreaterThan(0);
    // With marks present, keyboard navigation should be enabled
    expect(layout.a11y.keyboardNavigable).toBe(true);
    // No author opt-out by default
    expect(layout.a11y.hidden).toBeUndefined();
  });

  it('a11y.description replaces the auto-generated alt text', () => {
    const spec = { ...lineSpec, a11y: { description: 'GDP growth for US and UK, 2020 to 2021.' } };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toBe('GDP growth for US and UK, 2020 to 2021.');
  });

  it('top-level description (VL alias) replaces the auto-generated alt text', () => {
    const spec = { ...lineSpec, description: 'Two-country GDP comparison.' };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toBe('Two-country GDP comparison.');
  });

  it('a11y.description wins over the top-level description', () => {
    const spec = {
      ...lineSpec,
      description: 'Alias text',
      a11y: { description: 'Canonical text' },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toBe('Canonical text');
  });

  it('a11y.hidden flows into the layout metadata', () => {
    const spec = { ...lineSpec, a11y: { hidden: true } };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.a11y.hidden).toBe(true);
  });

  it('produces different strategies at different widths', () => {
    const narrow = compileChart(lineSpec, { width: 320, height: 400 });
    const wide = compileChart(lineSpec, { width: 800, height: 400 });

    // At 320px the legend should be on top, at 800px on the right
    expect(narrow.legend.position).toBe('top');
    expect(wide.legend.position).toBe('right');
  });

  it('dark mode adapts the theme colors', () => {
    const light = compileChart(lineSpec, { width: 600, height: 400 });
    const dark = compileChart(lineSpec, { width: 600, height: 400, darkMode: true });

    expect(light.theme.isDark).toBe(false);
    expect(dark.theme.isDark).toBe(true);
    // Both modes preserve transparent background — dark mode swaps text/axis/gridline
    // colors but keeps transparency so the host surface shows through.
    expect(dark.theme.colors.background).toBe('transparent');
    expect(light.theme.colors.background).toBe('transparent');
    // Dark mode text should be light, light mode text should be dark
    expect(dark.theme.colors.text).not.toBe(light.theme.colors.text);
  });

  it('compiles a bar chart with rect marks and both axes', () => {
    const layout = compileChart(barSpec, { width: 600, height: 400 });

    // Bar charts produce rect marks
    expect(layout.marks.length).toBe(3);
    for (const mark of layout.marks) {
      expect(mark.type).toBe('rect');
      if (mark.type === 'rect') {
        expect(mark.width).toBeGreaterThan(0);
        expect(mark.height).toBeGreaterThan(0);
        expect(mark.fill).toBeTruthy();
      }
    }

    // Both axes should be present with ticks
    expect(layout.axes.x!.ticks.length).toBeGreaterThan(0);
    expect(layout.axes.y!.ticks.length).toBe(3); // A, B, C
  });

  it('bar chart y-axis labels match the nominal field values', () => {
    const layout = compileChart(barSpec, { width: 600, height: 400 });
    const yLabels = layout.axes.y!.ticks.map((t) => t.label);
    expect(yLabels).toContain('A');
    expect(yLabels).toContain('B');
    expect(yLabels).toContain('C');
  });

  it('throws on invalid spec', () => {
    expect(() => compileChart({ type: 'bogus' }, { width: 600, height: 400 })).toThrow();
  });

  it('throws if a table spec is passed', () => {
    expect(() =>
      compileChart(
        { type: 'table', data: [{ a: 1 }], columns: [{ key: 'a' }] },
        { width: 600, height: 400 },
      ),
    ).toThrow('compileTable');
  });

  // ---------------------------------------------------------------------------
  // hiddenSeries
  // ---------------------------------------------------------------------------

  it('hiddenSeries filters out data for hidden series from marks', () => {
    const spec = {
      ...lineSpec,
      hiddenSeries: ['UK'],
      legend: { show: true },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });

    // With UK hidden, only US marks should be present.
    // Line marks carry a series property.
    const lineMarks = layout.marks.filter((m) => m.type === 'line');
    for (const mark of lineMarks) {
      if (mark.type === 'line') {
        expect(mark.series).not.toBe('UK');
      }
    }

    // Legend should still have entries for both series (hidden ones are dimmed, not removed)
    expect(layout.legend.entries.length).toBe(2);
    expect(layout.legend.entries.some((e) => e.label === 'US')).toBe(true);
    expect(layout.legend.entries.some((e) => e.label === 'UK')).toBe(true);
  });

  it('hiddenSeries with all series hidden produces no marks', () => {
    const spec = {
      ...lineSpec,
      hiddenSeries: ['US', 'UK'],
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    // No data left means no marks
    expect(layout.marks.length).toBe(0);
  });

  it('hiddenSeries with empty array behaves normally', () => {
    const spec = {
      ...lineSpec,
      hiddenSeries: [],
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.marks.length).toBeGreaterThan(0);
  });

  it('hiddenSeries keeps remaining series on their original palette colors', () => {
    // Regression: filtering renderData by hiddenSeries used to shrink the
    // ordinal color scale's domain, which shifted every visible series down
    // one palette index.
    type LineLike = { type: string; seriesKey?: string; stroke?: string };
    const findStroke = (marks: { type: string }[], series: string) =>
      (marks.find((m) => m.type === 'line' && (m as LineLike).seriesKey === series) as LineLike)
        ?.stroke;

    const baseline = compileChart({ ...lineSpec, hiddenSeries: [] }, { width: 600, height: 400 });
    const baselineUS = findStroke(baseline.marks, 'US');
    const baselineUK = findStroke(baseline.marks, 'UK');
    expect(baselineUS).toBeTruthy();
    expect(baselineUK).toBeTruthy();

    // Hide UK → US should keep its color.
    const ukHidden = compileChart(
      { ...lineSpec, hiddenSeries: ['UK'] },
      { width: 600, height: 400 },
    );
    expect(findStroke(ukHidden.marks, 'US')).toBe(baselineUS);

    // Hide US → UK should keep its color (reverse direction).
    const usHidden = compileChart(
      { ...lineSpec, hiddenSeries: ['US'] },
      { width: 600, height: 400 },
    );
    expect(findStroke(usHidden.marks, 'UK')).toBe(baselineUK);
  });

  it('hiddenSeries keeps middle-of-N series colors stable in 3-series charts', () => {
    // Pre-fix bug shifted EVERY series after the hidden one — a 2-series
    // case only proves shift-by-one. A 3-series case where the middle is
    // hidden proves the late series doesn't drift either.
    type LineLike = { type: string; seriesKey?: string; stroke?: string };
    const findStroke = (marks: { type: string }[], series: string) =>
      (marks.find((m) => m.type === 'line' && (m as LineLike).seriesKey === series) as LineLike)
        ?.stroke;

    const threeSeriesSpec = {
      mark: 'line' as const,
      data: [
        { date: '2020-01-01', value: 10, country: 'US' },
        { date: '2021-01-01', value: 40, country: 'US' },
        { date: '2020-01-01', value: 15, country: 'UK' },
        { date: '2021-01-01', value: 35, country: 'UK' },
        { date: '2020-01-01', value: 12, country: 'JP' },
        { date: '2021-01-01', value: 38, country: 'JP' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'country', type: 'nominal' as const },
      },
    };

    const baseline = compileChart(threeSeriesSpec, { width: 600, height: 400 });
    const baselineUS = findStroke(baseline.marks, 'US');
    const baselineJP = findStroke(baseline.marks, 'JP');

    // Hide the middle series.
    const ukHidden = compileChart(
      { ...threeSeriesSpec, hiddenSeries: ['UK'] },
      { width: 600, height: 400 },
    );
    expect(findStroke(ukHidden.marks, 'US')).toBe(baselineUS); // first stays
    expect(findStroke(ukHidden.marks, 'JP')).toBe(baselineJP); // last doesn't shift up
  });

  // ---------------------------------------------------------------------------
  // scale.clip
  // ---------------------------------------------------------------------------

  it('scale.clip filters data rows outside the y-axis domain', () => {
    const spec = {
      mark: 'point' as const,
      data: [
        { x: 1, y: 5 },
        { x: 2, y: 15 },
        { x: 3, y: 25 },
        { x: 4, y: 35 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' as const },
        y: {
          field: 'y',
          type: 'quantitative' as const,
          scale: { domain: [10, 30] as [number, number], clip: true },
        },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });

    // Only y=15 and y=25 should remain (y=5 and y=35 are outside [10,30])
    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBe(2);
  });

  it('scale.clip filters data rows outside the x-axis domain', () => {
    const spec = {
      mark: 'point' as const,
      data: [
        { x: 1, y: 10 },
        { x: 5, y: 20 },
        { x: 10, y: 30 },
        { x: 15, y: 40 },
      ],
      encoding: {
        x: {
          field: 'x',
          type: 'quantitative' as const,
          scale: { domain: [3, 12] as [number, number], clip: true },
        },
        y: { field: 'y', type: 'quantitative' as const },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });

    // Only x=5 and x=10 should remain
    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBe(2);
  });

  it('scale.clip=false does not filter data even with domain set', () => {
    const spec = {
      mark: 'point' as const,
      data: [
        { x: 1, y: 5 },
        { x: 2, y: 15 },
        { x: 3, y: 25 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' as const },
        y: {
          field: 'y',
          type: 'quantitative' as const,
          scale: { domain: [10, 20] as [number, number], clip: false },
        },
      },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });

    // All 3 points should still be present (clip is false)
    const pointMarks = layout.marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // display field + breakpoint override
  // ---------------------------------------------------------------------------

  it('display defaults to "full" when not specified', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.display).toBe('full');
  });

  it('display: "sparkline" propagates through to ChartLayout', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );
    expect(layout.display).toBe('sparkline');
  });

  it('breakpoint override flips display at compact width', () => {
    const spec = {
      ...lineSpec,
      overrides: {
        compact: { display: 'sparkline' as const },
      },
    };

    const compactLayout = compileChart(spec, { width: 320, height: 200 });
    expect(compactLayout.display).toBe('sparkline');

    const desktopLayout = compileChart(spec, { width: 1200, height: 600 });
    expect(desktopLayout.display).toBe('full');
  });

  it('sparkline mode forces watermark off when not user-explicit', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );
    expect(layout.watermark).toBe(false);
  });

  it('sparkline mode respects explicit watermark: true', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const, watermark: true },
      { width: 400, height: 80 },
    );
    expect(layout.watermark).toBe(true);
  });

  it('sparkline mode forces crosshair off when not user-explicit', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );
    expect(layout.crosshair).toBe(false);
  });

  it('sparkline mode respects explicit crosshair: true', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const, crosshair: true },
      { width: 400, height: 80 },
    );
    expect(layout.crosshair).toBe(true);
  });

  it('crosshair defaults on for line marks in full mode', () => {
    const layout = compileChart(lineSpec, { width: 400, height: 300 });
    expect(layout.crosshair).toBe(true);
  });

  it('crosshair respects explicit crosshair: false on a line chart', () => {
    const layout = compileChart({ ...lineSpec, crosshair: false }, { width: 400, height: 300 });
    expect(layout.crosshair).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Sparkline layout profile (dimensions, axes, legend)
  // ---------------------------------------------------------------------------

  it('sparkline produces near-edge-to-edge chart area (margins <= 4px per side)', () => {
    const layout = compileChart(
      { ...lineSpec, chrome: undefined, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );

    // No chrome, no axes, no legend by default. Mark area should be tight.
    expect(layout.area.x).toBeLessThanOrEqual(4);
    expect(layout.area.y).toBeLessThanOrEqual(4);
    const rightMargin = 400 - (layout.area.x + layout.area.width);
    const bottomMargin = 80 - (layout.area.y + layout.area.height);
    expect(rightMargin).toBeLessThanOrEqual(4);
    expect(bottomMargin).toBeLessThanOrEqual(4);
  });

  it('sparkline returns no axes by default', () => {
    const layout = compileChart(
      { ...lineSpec, chrome: undefined, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );
    expect(layout.axes.x).toBeUndefined();
    expect(layout.axes.y).toBeUndefined();
  });

  it('sparkline + explicit encoding.x.axis still reserves x-axis', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        chrome: undefined,
        display: 'sparkline' as const,
        encoding: {
          ...lineSpec.encoding,
          x: { ...lineSpec.encoding.x, axis: { title: 'date' } },
        },
      },
      { width: 400, height: 200 },
    );
    expect(layout.axes.x).toBeDefined();
  });

  it('sparkline + explicit chrome.title still renders chrome', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        chrome: { title: 'Q4 Revenue' },
        display: 'sparkline' as const,
      },
      { width: 400, height: 200 },
    );
    expect(layout.chrome.title).toBeDefined();
    expect(layout.chrome.title?.text).toBe('Q4 Revenue');
  });

  it('sparkline hides legend by default even with color encoding', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        chrome: undefined,
        display: 'sparkline' as const,
      },
      { width: 400, height: 80 },
    );
    expect('entries' in layout.legend && layout.legend.entries.length).toBe(0);
  });

  it('sparkline + explicit legend.show: true renders legend', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        chrome: undefined,
        display: 'sparkline' as const,
        legend: { show: true },
      },
      { width: 400, height: 200 },
    );
    expect('entries' in layout.legend && layout.legend.entries.length).toBeGreaterThan(0);
  });

  it('sparkline works at heights as low as 30px', () => {
    const layout = compileChart(
      { ...lineSpec, chrome: undefined, display: 'sparkline' as const },
      { width: 200, height: 30 },
    );
    expect(layout.area.height).toBeGreaterThan(0);
    expect(layout.area.width).toBeGreaterThan(0);
  });

  it('chrome: {} does not count as user-explicit chrome (still stripped in sparkline)', () => {
    // Empty chrome object is the idiom for "silence defaults" — should not
    // opt-in to chrome rendering in sparkline mode.
    const layout = compileChart(
      { ...lineSpec, chrome: {}, display: 'sparkline' as const },
      { width: 400, height: 80 },
    );
    expect(layout.chrome.title).toBeUndefined();
    expect(layout.chrome.topHeight).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Sparkline visual defaults (trend color, endpoint dot, gradient, bar pill)
  // -------------------------------------------------------------------------

  const upTrendData = [
    { date: '2026-01-01', value: 10 },
    { date: '2026-01-02', value: 12 },
    { date: '2026-01-03', value: 14 },
    { date: '2026-01-04', value: 18 },
    { date: '2026-01-05', value: 22 },
  ];

  const downTrendData = [
    { date: '2026-01-01', value: 22 },
    { date: '2026-01-02', value: 18 },
    { date: '2026-01-03', value: 14 },
    { date: '2026-01-04', value: 12 },
    { date: '2026-01-05', value: 10 },
  ];

  const sparkLineSpec = {
    mark: 'line' as const,
    data: upTrendData,
    encoding: {
      x: { field: 'date', type: 'temporal' as const },
      y: { field: 'value', type: 'quantitative' as const },
    },
    display: 'sparkline' as const,
  };

  it('sparkline line emits a single decorative endpoint dot at the last point', () => {
    const layout = compileChart(sparkLineSpec, { width: 200, height: 40 });
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBe(1);
    expect(points[0].aria?.decorative).toBe(true);
  });

  it('sparkline line uses the positive theme token for an up-trending series', () => {
    const layout = compileChart(sparkLineSpec, { width: 200, height: 40 });
    const lineMark = layout.marks.find((m) => m.type === 'line');
    expect(lineMark?.stroke).toBe('#16a34a');
  });

  it('sparkline line uses the negative theme token for a down-trending series', () => {
    const layout = compileChart(
      { ...sparkLineSpec, data: downTrendData },
      { width: 200, height: 40 },
    );
    const lineMark = layout.marks.find((m) => m.type === 'line');
    expect(lineMark?.stroke).toBe('#dc2626');
  });

  it('explicit markDef.stroke wins over the trend default in sparkline mode', () => {
    const layout = compileChart(
      { ...sparkLineSpec, mark: { type: 'line' as const, stroke: '#ff00ff' } },
      { width: 200, height: 40 },
    );
    const lineMark = layout.marks.find((m) => m.type === 'line');
    expect(lineMark?.stroke).toBe('#ff00ff');
  });

  it('explicit markDef.point: false suppresses the auto-injected endpoint dot', () => {
    const layout = compileChart(
      { ...sparkLineSpec, mark: { type: 'line' as const, point: false } },
      { width: 200, height: 40 },
    );
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBe(0);
  });

  it('sparkline area injects a trend-colored gradient fill by default', () => {
    const layout = compileChart(
      { ...sparkLineSpec, mark: 'area' as const },
      { width: 200, height: 40 },
    );
    const areaMark = layout.marks.find((m) => m.type === 'area');
    // fill should be a gradient object (not a flat string)
    expect(typeof areaMark?.fill).toBe('object');
    expect((areaMark?.fill as { gradient?: string }).gradient).toBe('linear');
  });

  it('sparkline single-series vertical bars use a [min, max] domain', () => {
    // With values 100, 105, 110, 120 and zero: false, the y-domain should
    // start near 100 — not 0 — so the shortest bar is still visible.
    const layout = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { cat: 'a', value: 100 },
          { cat: 'b', value: 105 },
          { cat: 'c', value: 110 },
          { cat: 'd', value: 120 },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' as const },
          y: { field: 'value', type: 'quantitative' as const },
        },
        display: 'sparkline' as const,
      },
      { width: 200, height: 40 },
    );
    // The shortest bar (value 100) should NOT have a height that fills the
    // chart down from y=0; with zero:false it sits near the bottom.
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects.length).toBe(4);
    // Heights should differ meaningfully across the four bars.
    const heights = rects.map((r) => (r as { height: number }).height);
    const maxH = Math.max(...heights);
    const minH = Math.min(...heights);
    expect(maxH - minH).toBeGreaterThan(maxH * 0.5);
  });

  it('sparkline stacked vertical bars retain the [0, max] baseline', () => {
    // Stacked bars MUST baseline at zero — non-zero baselines break stack
    // arithmetic. The total bar should equal the category sum.
    const layout = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { cat: 'a', series: 's1', value: 50 },
          { cat: 'a', series: 's2', value: 50 },
          { cat: 'b', series: 's1', value: 30 },
          { cat: 'b', series: 's2', value: 70 },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' as const },
          y: { field: 'value', type: 'quantitative' as const, stack: 'zero' as const },
          color: { field: 'series', type: 'nominal' as const },
        },
        display: 'sparkline' as const,
      },
      { width: 200, height: 80 },
    );
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects.length).toBe(4);
    // For stacked bars, both categories sum to the same total (100), so the
    // tallest stacked column should fill close to the full chart area height.
    // Verify by checking that at least one bar starts at the chart-area top
    // (its y matches chartArea.y within a rounding tolerance).
    const minY = Math.min(...rects.map((r) => (r as { y: number }).y));
    expect(minY).toBeCloseTo(layout.area.y, -1);
  });

  it('sparkline bar gets pill cornerRadius by default', () => {
    const layout = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { cat: 'a', value: 5 },
          { cat: 'b', value: 8 },
          { cat: 'c', value: 6 },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' as const },
          y: { field: 'value', type: 'quantitative' as const },
        },
        display: 'sparkline' as const,
      },
      { width: 200, height: 40 },
    );
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects.length).toBeGreaterThan(0);
    // 'pill' translates to rx = barWidth / 2 in column compute. Each rect's
    // cornerRadius should equal half the bar's width (or thickness).
    const r = rects[0] as { width: number; cornerRadius: number };
    expect(r.cornerRadius).toBeCloseTo(r.width / 2, 1);
  });

  it('sparkline stacked bars: only top segment per stack gets pill rounding (top corners)', () => {
    // Stacked segments below the top stay square so the seams between
    // segments are flush. Each topmost segment receives the pill radius
    // with `cornerRadiusSides` constrained to the top corners — the
    // renderer emits a path with rounded top + square bottom.
    const layout = compileChart(
      {
        mark: 'bar' as const,
        data: [
          { cat: 'a', series: 's1', value: 50 },
          { cat: 'a', series: 's2', value: 50 },
          { cat: 'b', series: 's1', value: 30 },
          { cat: 'b', series: 's2', value: 70 },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' as const },
          y: { field: 'value', type: 'quantitative' as const, stack: 'zero' as const },
          color: { field: 'series', type: 'nominal' as const },
        },
        display: 'sparkline' as const,
      },
      { width: 200, height: 80 },
    );
    type Rect = {
      type: 'rect';
      cornerRadius?: number;
      cornerRadiusSides?: { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean };
      stackGroup?: string;
      y: number;
    };
    const rects = layout.marks.filter((m): m is Rect => m.type === 'rect') as Rect[];

    // Group by stackGroup, find topmost (smallest y) per group.
    const tops = new Map<string, Rect>();
    for (const r of rects) {
      if (!r.stackGroup) continue;
      const cur = tops.get(r.stackGroup);
      if (!cur || r.y < cur.y) tops.set(r.stackGroup, r);
    }
    expect(tops.size).toBe(2);

    for (const r of rects) {
      const isTop = tops.get(r.stackGroup ?? '') === r;
      if (isTop) {
        expect(r.cornerRadius).toBeGreaterThan(0);
        expect(r.cornerRadiusSides).toEqual({
          tl: true,
          tr: true,
          br: false,
          bl: false,
        });
      } else {
        expect(r.cornerRadius ?? 0).toBe(0);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Explicit-at-any-level wins (precedence matrix)
  // ---------------------------------------------------------------------------

  it('top-level animation: true wins even when breakpoint flips to sparkline', () => {
    const spec = {
      ...lineSpec,
      animation: true as const,
      overrides: { compact: { display: 'sparkline' as const } },
    };
    const layout = compileChart(spec, { width: 320, height: 200 });
    expect(layout.display).toBe('sparkline');
    expect(layout.animation?.enter).toBeDefined();
  });

  it('breakpoint chrome wins when top-level is sparkline', () => {
    const spec = {
      ...lineSpec,
      chrome: undefined,
      display: 'sparkline' as const,
      overrides: { full: { chrome: { title: 'Q4 revenue' } } },
    };
    const layout = compileChart(spec, { width: 1200, height: 600 });
    // At full breakpoint, chrome.title from override should render even
    // though display is sparkline at top-level.
    expect(layout.chrome.title?.text).toBe('Q4 revenue');
  });

  it('top-level display: sparkline + breakpoint display: full restores all defaults', () => {
    const spec = {
      ...lineSpec,
      display: 'sparkline' as const,
      overrides: { full: { display: 'full' as const } },
    };
    const layout = compileChart(spec, { width: 1200, height: 600 });
    expect(layout.display).toBe('full');
    // Watermark default is true in full mode.
    expect(layout.watermark).toBe(true);
  });

  it('explicit watermark: true in sparkline mode actually paints the watermark', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        chrome: undefined,
        display: 'sparkline' as const,
        watermark: true,
      },
      { width: 400, height: 200 },
    );
    expect(layout.watermark).toBe(true);
  });

  it('breakpoint encoding.x.axis opts back into x-axis at that breakpoint', () => {
    const spec = {
      ...lineSpec,
      chrome: undefined,
      display: 'sparkline' as const,
      overrides: {
        full: {
          encoding: {
            x: { field: 'date', type: 'temporal' as const, axis: { title: 'date' } },
          },
        },
      },
    };
    const layoutFull = compileChart(spec, { width: 1200, height: 600 });
    expect(layoutFull.axes.x).toBeDefined();
    const layoutCompact = compileChart(spec, { width: 320, height: 200 });
    expect(layoutCompact.axes.x).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Animation duration: sparkline mode bumps the entrance to 1100ms when on
  // ---------------------------------------------------------------------------

  it('sparkline + animation: true bumps entrance duration to 1100ms', () => {
    const layout = compileChart(
      { ...lineSpec, display: 'sparkline' as const, animation: true },
      { width: 400, height: 80 },
    );
    expect(layout.animation?.enter).toBeDefined();
    expect(layout.animation?.enter?.duration).toBe(1100);
  });

  it('sparkline + animation: { enter: { duration: 500 } } respects user duration', () => {
    const layout = compileChart(
      {
        ...lineSpec,
        display: 'sparkline' as const,
        animation: { enter: { duration: 500 } },
      },
      { width: 400, height: 80 },
    );
    expect(layout.animation?.enter?.duration).toBe(500);
  });

  it('full mode + animation: true uses default 500ms (sparkline bump does not leak)', () => {
    const layout = compileChart({ ...lineSpec, animation: true }, { width: 600, height: 400 });
    expect(layout.animation?.enter?.duration).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // Breakpoint encoding deep-merge: nested axis state survives an override that
  // only touches one axis property.
  // ---------------------------------------------------------------------------

  it('breakpoint encoding.x.axis deep-merges with base axis config', () => {
    const spec = {
      ...lineSpec,
      encoding: {
        ...lineSpec.encoding,
        x: {
          field: 'date',
          type: 'temporal' as const,
          axis: { title: 'date', tickCount: 8, format: '%b' },
        },
      },
      overrides: {
        compact: {
          encoding: {
            x: { axis: { title: 'd' } },
          },
        },
      },
    };
    const layout = compileChart(spec, { width: 320, height: 200 });
    // The compact override only touched axis.title; tickCount and format
    // should survive the deep merge.
    expect(layout.axes.x).toBeDefined();
    expect(layout.axes.x?.label).toBe('d');
    // Tick count flows from base spec — if shallow-merged, tickCount would be lost.
    expect(layout.axes.x?.ticks.length).toBeGreaterThan(0);
  });
});

describe('compileTable', () => {
  it('returns a valid TableLayout with resolved columns and rows', () => {
    const layout = compileTable(
      {
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
        chrome: { title: 'People' },
      },
      { width: 600, height: 400 },
    );

    // Chrome title is resolved
    expect(layout.chrome.title!.text).toBe('People');
    expect(layout.chrome.topHeight).toBeGreaterThan(0);

    // Columns are resolved with labels and widths
    expect(layout.columns).toHaveLength(2);
    expect(layout.columns[0].key).toBe('name');
    expect(layout.columns[0].label).toBeTruthy();
    expect(layout.columns[0].width).toBeGreaterThan(0);
    expect(layout.columns[1].key).toBe('age');

    // Rows contain formatted cell values
    expect(layout.rows).toHaveLength(1);
    expect(layout.rows[0].cells).toHaveLength(2);
    expect(layout.rows[0].cells[0].formattedValue).toBe('Alice');
    expect(layout.rows[0].cells[1].formattedValue).toBe('30');

    // Accessibility caption includes the title
    expect(layout.a11y.caption).toContain('People');

    // Theme is resolved
    expect(layout.theme.isDark).toBe(false);
    expect(layout.theme.colors.background).toBeTruthy();
  });

  it('throws if a chart spec is passed', () => {
    expect(() => compileTable(lineSpec, { width: 600, height: 400 })).toThrow('compileChart');
  });
});

describe('compileGraph', () => {
  it('returns a valid GraphCompilation for a graph spec', () => {
    const result = compileGraph(
      {
        type: 'graph',
        nodes: [{ id: 'a' }],
        edges: [],
      },
      { width: 600, height: 400 },
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.dimensions).toEqual({ width: 600, height: 400 });
  });

  it('throws for non-graph specs', () => {
    expect(() =>
      compileGraph(
        {
          mark: 'point',
          data: [{ x: 1, y: 2 }],
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        { width: 600, height: 400 },
      ),
    ).toThrow('compileGraph received a non-graph spec');
  });

  it('propagates labelAngle through the full compilation pipeline', () => {
    const columnSpec = {
      mark: 'bar' as const,
      data: [
        { state: 'California', pop: 39000000 },
        { state: 'Texas', pop: 29000000 },
        { state: 'Florida', pop: 22000000 },
        { state: 'New York', pop: 20000000 },
        { state: 'Pennsylvania', pop: 13000000 },
      ],
      encoding: {
        x: { field: 'state', type: 'nominal' as const, axis: { labelAngle: -90 } },
        y: { field: 'pop', type: 'quantitative' as const },
      },
    };

    const layout = compileChart(columnSpec, { width: 400, height: 300 });

    // labelAngle should be propagated to the x-axis layout as tickAngle
    expect(layout.axes.x!.tickAngle).toBe(-90);
    // y-axis should not have a tickAngle
    expect(layout.axes.y!.tickAngle).toBeUndefined();
  });

  it('reserves extra bottom margin for rotated x-axis labels', () => {
    const baseColumnSpec = {
      mark: 'bar' as const,
      data: [
        { state: 'California', pop: 39000000 },
        { state: 'Texas', pop: 29000000 },
        { state: 'Massachusetts', pop: 7000000 },
      ],
      encoding: {
        x: { field: 'state', type: 'nominal' as const },
        y: { field: 'pop', type: 'quantitative' as const },
      },
    };
    const rotatedColumnSpec = {
      ...baseColumnSpec,
      encoding: {
        x: { field: 'state', type: 'nominal' as const, axis: { labelAngle: -90 } },
        y: { field: 'pop', type: 'quantitative' as const },
      },
    };

    const layoutNormal = compileChart(baseColumnSpec, { width: 400, height: 300 });
    const layoutRotated = compileChart(rotatedColumnSpec, { width: 400, height: 300 });

    // Rotated labels should shrink the chart area height
    expect(layoutRotated.area.height).toBeLessThan(layoutNormal.area.height);
  });

  it('hides legend when legend.show is false', () => {
    const spec = {
      ...lineSpec,
      legend: { show: false },
    };
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.legend.entries).toHaveLength(0);
    expect(layout.legend.bounds.width).toBe(0);
    expect(layout.legend.bounds.height).toBe(0);
  });

  it('applies compact breakpoint overrides to chrome', () => {
    const spec = {
      ...lineSpec,
      chrome: {
        title: 'Full width title with extra context',
        subtitle: 'Long subtitle with methodology details',
      },
      overrides: {
        compact: {
          chrome: {
            title: 'Short title',
            subtitle: 'Short sub',
          },
        },
      },
    };

    // At compact width (< 400), overrides should apply
    const compactLayout = compileChart(spec, { width: 350, height: 400 });
    expect(compactLayout.chrome.title!.text).toBe('Short title');
    expect(compactLayout.chrome.subtitle!.text).toBe('Short sub');

    // At full width, base spec should apply
    const fullLayout = compileChart(spec, { width: 800, height: 400 });
    expect(fullLayout.chrome.title!.text).toBe('Full width title with extra context');
    expect(fullLayout.chrome.subtitle!.text).toBe('Long subtitle with methodology details');
  });

  it('applies medium breakpoint overrides', () => {
    const spec = {
      ...lineSpec,
      chrome: { title: 'Full title' },
      overrides: {
        medium: {
          chrome: { title: 'Medium title' },
        },
      },
    };

    // At medium width (400-700), override should apply
    const mediumLayout = compileChart(spec, { width: 500, height: 400 });
    expect(mediumLayout.chrome.title!.text).toBe('Medium title');

    // At full width, base spec should apply
    const fullLayout = compileChart(spec, { width: 800, height: 400 });
    expect(fullLayout.chrome.title!.text).toBe('Full title');
  });

  it('applies breakpoint override for legend show', () => {
    const spec = {
      ...lineSpec,
      legend: { show: true },
      overrides: {
        compact: {
          legend: { show: false },
        },
      },
    };

    // At compact, legend hidden
    const compactLayout = compileChart(spec, { width: 350, height: 400 });
    expect(compactLayout.legend.entries).toHaveLength(0);

    // At full, legend shown
    const fullLayout = compileChart(spec, { width: 800, height: 400 });
    expect(fullLayout.legend.entries.length).toBeGreaterThan(0);
  });
});
