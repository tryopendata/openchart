import type { ChartSpec, LineMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MUTED_COLOR = '#d4d4d8';

const data = [
  { date: '2020', country: 'Germany', value: 100 },
  { date: '2020', country: 'France', value: 90 },
  { date: '2020', country: 'Italy', value: 80 },
  { date: '2020', country: 'Spain', value: 70 },
  { date: '2020', country: 'Poland', value: 60 },
  { date: '2021', country: 'Germany', value: 110 },
  { date: '2021', country: 'France', value: 95 },
  { date: '2021', country: 'Italy', value: 85 },
  { date: '2021', country: 'Spain', value: 75 },
  { date: '2021', country: 'Poland', value: 65 },
  { date: '2022', country: 'Germany', value: 120 },
  { date: '2022', country: 'France', value: 100 },
  { date: '2022', country: 'Italy', value: 90 },
  { date: '2022', country: 'Spain', value: 80 },
  { date: '2022', country: 'Poland', value: 70 },
];

const compileOptions = { width: 600, height: 400 };

function makeSpec(highlight?: string | string[]): ChartSpec {
  const colorChannel: Record<string, unknown> = {
    field: 'country',
    type: 'nominal',
  };
  if (highlight !== undefined) {
    colorChannel.highlight = highlight;
  }
  return {
    mark: 'line',
    data,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: colorChannel,
    },
  } as ChartSpec;
}

// ---------------------------------------------------------------------------
// Color partitioning
// ---------------------------------------------------------------------------

describe('highlight — color partitioning', () => {
  it('assigns palette color to highlighted series and muted color to others', () => {
    const layout = compileChart(makeSpec(['Germany']), compileOptions);
    const marks = layout.marks as LineMark[];

    const germany = marks.find((m) => m.seriesKey === 'Germany');
    const france = marks.find((m) => m.seriesKey === 'France');
    const italy = marks.find((m) => m.seriesKey === 'Italy');

    expect(germany).toBeDefined();
    expect(france).toBeDefined();
    expect(italy).toBeDefined();

    // Germany should have a real palette color (not the muted gray)
    expect(germany!.stroke).not.toBe(MUTED_COLOR);

    // Non-highlighted series should get the muted color
    expect(france!.stroke).toBe(MUTED_COLOR);
    expect(italy!.stroke).toBe(MUTED_COLOR);
  });

  it('assigns palette colors to multiple highlighted series', () => {
    const layout = compileChart(makeSpec(['Germany', 'France']), compileOptions);
    const marks = layout.marks as LineMark[];

    const germany = marks.find((m) => m.seriesKey === 'Germany');
    const france = marks.find((m) => m.seriesKey === 'France');
    const italy = marks.find((m) => m.seriesKey === 'Italy');

    // Both highlighted series should have distinct palette colors
    expect(germany!.stroke).not.toBe(MUTED_COLOR);
    expect(france!.stroke).not.toBe(MUTED_COLOR);
    expect(germany!.stroke).not.toBe(france!.stroke);

    // Non-highlighted series should be muted
    expect(italy!.stroke).toBe(MUTED_COLOR);
  });

  it('assigns all series palette colors when no highlight is active', () => {
    const layout = compileChart(makeSpec(), compileOptions);
    const marks = layout.marks as LineMark[];

    // Every series should get a real palette color
    for (const mark of marks) {
      expect(mark.stroke).not.toBe(MUTED_COLOR);
    }
  });
});

// ---------------------------------------------------------------------------
// Z-order: muted marks sort before highlighted marks
// ---------------------------------------------------------------------------

describe('highlight — z-order', () => {
  it('places muted series marks before highlighted series marks', () => {
    const layout = compileChart(makeSpec(['Germany']), compileOptions);
    const marks = layout.marks as LineMark[];

    // Find the index of the first highlighted mark and the last muted mark
    const germanyIndex = marks.findIndex((m) => m.seriesKey === 'Germany');
    const lastMutedIndex = marks.reduce(
      (maxIdx, m, i) => (m.seriesKey !== 'Germany' ? Math.max(maxIdx, i) : maxIdx),
      -1,
    );

    // All muted marks should come before the highlighted mark in the array
    expect(germanyIndex).toBeGreaterThan(lastMutedIndex);
  });

  it('places all muted marks before all highlighted marks with multiple highlights', () => {
    const layout = compileChart(makeSpec(['Germany', 'France']), compileOptions);
    const marks = layout.marks as LineMark[];
    const highlightSet = new Set(['Germany', 'France']);

    const firstHighlightIndex = marks.findIndex((m) => highlightSet.has(m.seriesKey ?? ''));
    const lastMutedIndex = marks.reduce(
      (maxIdx, m, i) => (!highlightSet.has(m.seriesKey ?? '') ? Math.max(maxIdx, i) : maxIdx),
      -1,
    );

    expect(firstHighlightIndex).toBeGreaterThan(lastMutedIndex);
  });
});

// ---------------------------------------------------------------------------
// Muted line stroke width
// ---------------------------------------------------------------------------

describe('highlight — muted line stroke width', () => {
  it('reduces stroke width for muted series', () => {
    const layout = compileChart(makeSpec(['Germany']), compileOptions);
    const marks = layout.marks as LineMark[];

    const germany = marks.find((m) => m.seriesKey === 'Germany');
    const france = marks.find((m) => m.seriesKey === 'France');

    expect(germany).toBeDefined();
    expect(france).toBeDefined();

    expect(germany!.strokeWidth).toBeDefined();
    expect(france!.strokeWidth).toBeDefined();
    expect(france!.strokeWidth).toBeLessThan(germany!.strokeWidth);
    expect(france!.strokeWidth).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Endpoint label suppression
// ---------------------------------------------------------------------------

describe('highlight — endpoint labels', () => {
  it('only includes highlighted series in endpoint labels', () => {
    const spec = { ...makeSpec(['Germany']), endpointLabels: { show: true } } as ChartSpec;
    const layout = compileChart(spec, compileOptions);

    expect(layout.endpointLabels).toBeDefined();
    expect(layout.endpointLabels!.entries.length).toBeGreaterThan(0);
    const labelSeriesKeys = layout.endpointLabels!.entries.map((e) => e.seriesKey);

    expect(labelSeriesKeys).toContain('Germany');
    expect(labelSeriesKeys).not.toContain('France');
    expect(labelSeriesKeys).not.toContain('Italy');
    expect(labelSeriesKeys).not.toContain('Spain');
    expect(labelSeriesKeys).not.toContain('Poland');
  });

  it('includes all series in endpoint labels when no highlight is active', () => {
    const spec = makeSpec();
    const layout = compileChart(spec, compileOptions);

    expect(layout.endpointLabels).toBeDefined();
    expect(layout.endpointLabels!.entries.length).toBeGreaterThan(0);
    const labelSeriesKeys = layout.endpointLabels!.entries.map((e) => e.seriesKey);

    expect(labelSeriesKeys).toContain('Germany');
    expect(labelSeriesKeys).toContain('France');
    expect(labelSeriesKeys).toContain('Italy');
  });
});
