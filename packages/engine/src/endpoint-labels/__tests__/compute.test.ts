/**
 * Tests for the endpoint-labels compute module.
 *
 * Covers:
 *  - Multi-series produces N entries
 *  - Long labels wrap to multiple lines
 *  - `endpointLabels: false` returns an empty layout
 *  - Bidirectional collision sweep displaces overlapping entries
 *  - `showLeader: true` when an entry is displaced past the threshold
 *  - Entries clamp at the chart top/bottom edges
 *  - Marker positions are correct (right edge of chart area, on the line)
 *  - Single-series produces an empty layout
 *  - Compact strategy returns empty
 */

import type { AreaMark, LineMark, Mark, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import type { NormalizedChartSpec } from '../../compiler/types';
import { computeEndpointLabels } from '../compute';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 50, y: 20, width: 500, height: 300 };
const theme: ResolvedTheme = resolveTheme();

function makeSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2020', value: 10, country: 'US' },
      { date: '2021', value: 40, country: 'US' },
      { date: '2020', value: 5, country: 'UK' },
      { date: '2021', value: 35, country: 'UK' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'country', type: 'nominal' },
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

function makeLineMark(
  seriesKey: string,
  lastY: number,
  value: number,
  stroke = '#3366cc',
): LineMark {
  const lastX = chartArea.x + chartArea.width;
  return {
    type: 'line',
    points: [
      { x: chartArea.x, y: lastY + 20 },
      { x: lastX, y: lastY },
    ],
    stroke,
    strokeWidth: 2,
    seriesKey,
    data: [
      { date: '2020', value: value - 5, country: seriesKey },
      { date: '2021', value, country: seriesKey },
    ],
    dataPoints: [
      {
        x: chartArea.x,
        y: lastY + 20,
        datum: { date: '2020', value: value - 5, country: seriesKey },
      },
      { x: lastX, y: lastY, datum: { date: '2021', value, country: seriesKey } },
    ],
    aria: { label: seriesKey },
  };
}

function makeAreaMark(seriesKey: string, lastY: number, value: number, fill = '#3366cc'): AreaMark {
  const lastX = chartArea.x + chartArea.width;
  return {
    type: 'area',
    topPoints: [
      { x: chartArea.x, y: lastY + 20 },
      { x: lastX, y: lastY },
    ],
    bottomPoints: [
      { x: chartArea.x, y: chartArea.y + chartArea.height },
      { x: lastX, y: chartArea.y + chartArea.height },
    ],
    path: '',
    topPath: '',
    fill,
    fillOpacity: 0.3,
    stroke: fill,
    strokeWidth: 2,
    seriesKey,
    data: [
      { date: '2020', value: value - 5, country: seriesKey },
      { date: '2021', value, country: seriesKey },
    ],
    dataPoints: [
      {
        x: chartArea.x,
        y: lastY + 20,
        datum: { date: '2020', value: value - 5, country: seriesKey },
      },
      { x: lastX, y: lastY, datum: { date: '2021', value, country: seriesKey } },
    ],
    aria: { label: seriesKey },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeEndpointLabels', () => {
  it('produces one entry per series for a multi-series line chart', () => {
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(2);
    const keys = layout.entries.map((e) => e.seriesKey).sort();
    expect(keys).toEqual(['UK', 'US']);
  });

  it('returns an empty layout when endpointLabels: false', () => {
    const spec = makeSpec({ endpointLabels: false });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35)];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(0);
    expect(layout.bounds.width).toBe(0);
  });

  it('returns an empty layout for a single-series chart', () => {
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40)];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(0);
  });

  it('returns an empty layout when strategy.labelMode is "none" (compact breakpoint)', () => {
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35)];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea, {
      labelMode: 'none',
      legendPosition: 'top',
      annotationPosition: 'tooltip-only',
      axisLabelDensity: 'minimal',
      chromeMode: 'full',
      legendMaxHeight: -1,
    });

    expect(layout.entries).toHaveLength(0);
  });

  it('wraps long series names to multiple lines', () => {
    const longName = 'A really long multi-word series name that should wrap';
    const spec = makeSpec({
      data: [
        { date: '2020', value: 10, country: longName },
        { date: '2021', value: 40, country: longName },
        { date: '2020', value: 5, country: 'UK' },
        { date: '2021', value: 35, country: 'UK' },
      ],
      endpointLabels: { width: 80 },
    });
    const marks: Mark[] = [makeLineMark(longName, 100, 40), makeLineMark('UK', 200, 35)];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const longEntry = layout.entries.find((e) => e.seriesKey === longName);
    expect(longEntry).toBeDefined();
    expect(longEntry!.labelLines.length).toBeGreaterThan(1);
  });

  it('displaces overlapping entries via the bidirectional collision sweep', () => {
    // Two series whose last data points are very close together (same y).
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 102, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(2);
    const [a, b] = layout.entries;
    // Their labelY values should be separated by at least their height (no overlap).
    const distance = Math.abs(a.labelY - b.labelY);
    // Each entry has at least one line of label height.
    expect(distance).toBeGreaterThanOrEqual(11 * 1.25 - 0.5);
  });

  it('marks displaced entries with showLeader: true when opted in', () => {
    // Leaders are off by default; opt in via endpointLabels.showLeader.
    const spec = makeSpec({ endpointLabels: { showLeader: true } });
    // Force overlap at the same y to guarantee displacement.
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 100, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const anyDisplaced = layout.entries.some((e) => e.showLeader);
    expect(anyDisplaced).toBe(true);
  });

  it('keeps showLeader off by default even when displaced', () => {
    // Default (no showLeader config): displacement does not produce a leader.
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 100, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries.every((e) => !e.showLeader)).toBe(true);
  });

  it('does not flag undisplaced entries with showLeader', () => {
    // Two series far apart vertically — no collision, no leader, even when opted in.
    const spec = makeSpec({ endpointLabels: { showLeader: true } });
    const marks: Mark[] = [makeLineMark('US', 50, 40), makeLineMark('UK', 280, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries.every((e) => !e.showLeader)).toBe(true);
  });

  it('clamps entries inside the chart area at the top edge', () => {
    const spec = makeSpec();
    // Series whose last point is at the very top of the chart area.
    const marks: Mark[] = [
      makeLineMark('US', chartArea.y, 40),
      makeLineMark('UK', chartArea.y + 5, 35, '#cc6633'),
    ];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    for (const entry of layout.entries) {
      expect(entry.labelY).toBeGreaterThanOrEqual(chartArea.y - 0.0001);
    }
  });

  it('clamps entries inside the chart area at the bottom edge', () => {
    const spec = makeSpec();
    const bottomY = chartArea.y + chartArea.height;
    const marks: Mark[] = [
      makeLineMark('US', bottomY, 40),
      makeLineMark('UK', bottomY - 5, 35, '#cc6633'),
    ];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    // Some line height; height = 11 * 1.25 ≈ 13.75
    const labelLineHeight = 11 * 1.25;
    for (const entry of layout.entries) {
      expect(entry.labelY + labelLineHeight).toBeLessThanOrEqual(bottomY + 0.5);
    }
  });

  it('attaches a marker on the line at the chart right edge', () => {
    const spec = makeSpec();
    const lastX = chartArea.x + chartArea.width;
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    for (const entry of layout.entries) {
      expect(entry.marker).toBeDefined();
      expect(entry.marker!.x).toBe(lastX);
      // Marker y is at the actual data point (not displaced labelY).
      expect(entry.marker!.y).toBe(entry.dataY);
      // Open-circle convention: fill = background, stroke = series color.
      expect(entry.marker!.stroke).toBe(entry.color);
    }
  });

  it('omits the marker when showMarker is explicitly false', () => {
    const spec = makeSpec({ endpointLabels: { showMarker: false } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    for (const entry of layout.entries) {
      expect(entry.marker).toBeUndefined();
    }
  });

  it('formats values via the spec format string', () => {
    const spec = makeSpec({ endpointLabels: { format: '$.2f' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    for (const entry of layout.entries) {
      expect(entry.value.startsWith('$')).toBe(true);
    }
  });

  it('positions the column to the right of the chart area', () => {
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.bounds.x).toBeGreaterThanOrEqual(chartArea.x + chartArea.width);
    expect(layout.bounds.width).toBeGreaterThan(0);
  });

  it('handles area marks (overlap, not stacked)', () => {
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
    });
    const marks: Mark[] = [makeAreaMark('US', 100, 40), makeAreaMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(2);
  });

  it('dedupes by seriesKey when both an area and a derived line exist for a series', () => {
    // Defect-1 regression: the area renderer emits BOTH an AreaMark AND a
    // derived LineMark per series (see linesFromAreas in
    // packages/engine/src/charts/line/index.ts). Without dedupe, each series
    // produces two endpoint entries.
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
    });
    const lineColor = '#3366cc';
    const areaColor = '#ddee99'; // fake gradient-derived color, distinct from the line stroke
    const marks: Mark[] = [
      makeAreaMark('US', 100, 40, areaColor),
      makeAreaMark('UK', 200, 35, areaColor),
      makeLineMark('US', 100, 40, lineColor),
      makeLineMark('UK', 200, 35, lineColor),
    ];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    // Single entry per series.
    expect(layout.entries).toHaveLength(2);
    const keys = layout.entries.map((e) => e.seriesKey).sort();
    expect(keys).toEqual(['UK', 'US']);

    // Line marks win — entry color should match the line stroke, not the
    // area-derived gradient color.
    for (const entry of layout.entries) {
      expect(entry.color).toBe(lineColor);
    }
  });

  it('dedupe prefers line mark even when area appears later in the marks array', () => {
    // Defect-1 regression: area marks listed AFTER line marks should not
    // overwrite the line's canonical stroke color in the endpoint entry.
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
    });
    const lineColor = '#3366cc';
    const areaColor = '#ddee99';
    const marks: Mark[] = [
      makeLineMark('US', 100, 40, lineColor),
      makeLineMark('UK', 200, 35, lineColor),
      makeAreaMark('US', 100, 40, areaColor),
      makeAreaMark('UK', 200, 35, areaColor),
    ];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(2);
    for (const entry of layout.entries) {
      expect(entry.color).toBe(lineColor);
    }
  });
});
