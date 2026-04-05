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

    // Legend has entries for the two series
    expect(layout.legend.entries.length).toBe(2);

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

  it('has a legend when color encoding is present', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
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

  it('includes accessibility metadata with meaningful content', () => {
    const layout = compileChart(lineSpec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toContain('Line chart');
    expect(layout.a11y.altText).toContain('GDP Growth');
    expect(layout.a11y.role).toBe('img');
    expect(layout.a11y.dataTableFallback.length).toBeGreaterThan(0);
    // With marks present, keyboard navigation should be enabled
    expect(layout.a11y.keyboardNavigable).toBe(true);
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
    expect(dark.theme.colors.background).not.toBe(light.theme.colors.background);
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
