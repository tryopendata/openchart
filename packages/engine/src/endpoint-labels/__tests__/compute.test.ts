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
import { bidirectionalSweep, computeEndpointLabels } from '../compute';
import { ENDPOINT_MARKER_RADIUS } from '../constants';

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
      // dataX is the original line endpoint; x is offset right by radius so the
      // line terminates at the circle edge rather than its center.
      expect(entry.marker!.dataX).toBe(lastX);
      expect(entry.marker!.x).toBe(lastX + ENDPOINT_MARKER_RADIUS);
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
    // v8: area stacks by default, and stacked areas suppress the endpoint
    // column in favor of the traditional legend. Stamp stack: null to
    // exercise the overlap path this test targets.
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: null },
        color: { field: 'country', type: 'nominal' },
      },
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
    // v8: stamp stack: null so this overlap-mode fixture still shows the
    // endpoint column (stacked areas suppress it in favor of the legend).
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: null },
        color: { field: 'country', type: 'nominal' },
      },
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

  it('bidirectional sweep produces non-overlapping tops when stack fits in area (deterministic fuzz)', () => {
    // Seeded LCG so the fuzz is reproducible without dragging in a dep.
    const rand = (() => {
      let s = 0x12345678 >>> 0;
      return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })();

    const areaTop = 0;
    const areaBottom = 600;
    const areaHeight = areaBottom - areaTop;

    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rand() * 9); // 2..10 entries
      const heights: number[] = [];
      let totalHeight = 0;
      for (let i = 0; i < n; i++) {
        const h = 12 + Math.floor(rand() * 30); // 12..41
        heights.push(h);
        totalHeight += h;
      }
      // Skip trials whose stack can't fit — the algorithm explicitly cannot
      // promise non-overlap when the chart is too short for the entries.
      if (totalHeight > areaHeight) continue;

      const sweepEntries = heights.map((h, idx) => ({
        naturalTop: areaTop + rand() * (areaBottom - h),
        height: h,
        index: idx,
      }));
      const tops = bidirectionalSweep(sweepEntries, areaTop, areaBottom);

      // Resort by final top to validate the sorted-stack invariant the
      // algorithm guarantees: every entry sits inside [areaTop, areaBottom-h]
      // and adjacent entries never overlap.
      const sortedFinals = sweepEntries
        .map((e) => ({ top: tops[e.index], height: e.height }))
        .sort((a, b) => a.top - b.top);

      for (let i = 0; i < sortedFinals.length; i++) {
        const { top, height } = sortedFinals[i];
        expect(top).toBeGreaterThanOrEqual(areaTop - 1e-6);
        expect(top + height).toBeLessThanOrEqual(areaBottom + 1e-6);
        if (i + 1 < sortedFinals.length) {
          const next = sortedFinals[i + 1];
          expect(top + height).toBeLessThanOrEqual(next.top + 1e-6);
        }
      }
    }
  });

  it('dedupe prefers line mark even when area appears later in the marks array', () => {
    // Defect-1 regression: area marks listed AFTER line marks should not
    // overwrite the line's canonical stroke color in the endpoint entry.
    // v8: stamp stack: null so this overlap-mode fixture still shows the
    // endpoint column (stacked areas suppress it in favor of the legend).
    const spec = makeSpec({
      markType: 'area',
      markDef: { type: 'area' },
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: null },
        color: { field: 'country', type: 'nominal' },
      },
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

  it('produces leading entries when ends: "both"', () => {
    const spec = makeSpec({ endpointLabels: { ends: 'both' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.entries).toHaveLength(2);
    expect(layout.leading).toBeDefined();
    expect(layout.leading).toHaveLength(2);
    const leadingKeys = layout.leading!.map((e) => e.seriesKey).sort();
    expect(leadingKeys).toEqual(['UK', 'US']);
  });

  it('positions leading column to the left of the chart area', () => {
    const spec = makeSpec({ endpointLabels: { ends: 'both' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.leadingBounds).toBeDefined();
    expect(layout.leadingBounds!.x + layout.leadingBounds!.width).toBeLessThanOrEqual(chartArea.x);
    expect(layout.leadingBounds!.width).toBeGreaterThan(0);
  });

  it('leading entries use the first data point value', () => {
    const spec = makeSpec({ endpointLabels: { ends: 'both' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const usTrailing = layout.entries.find((e) => e.seriesKey === 'US');
    const usLeading = layout.leading!.find((e) => e.seriesKey === 'US');
    expect(usTrailing).toBeDefined();
    expect(usLeading).toBeDefined();
    // The first data point has value - 5 (35 for US), the last has the full value (40).
    expect(usLeading!.value).not.toBe(usTrailing!.value);
  });

  it('does not produce leading entries when ends is unset (default)', () => {
    const spec = makeSpec();
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    expect(layout.leading).toBeUndefined();
    expect(layout.leadingBounds).toBeUndefined();
  });

  it('leading entries get markers at the first data point', () => {
    const spec = makeSpec({ endpointLabels: { ends: 'both' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    for (const entry of layout.leading!) {
      expect(entry.marker).toBeDefined();
      expect(entry.marker!.dataX).toBe(chartArea.x);
      // Leading marker offset: x = dataX - radius (left side).
      expect(entry.marker!.x).toBe(chartArea.x - ENDPOINT_MARKER_RADIUS);
    }
  });

  it("content: 'label value' joins name and value on one line and drops the value line", () => {
    const spec = makeSpec({ endpointLabels: { content: 'label value' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const us = layout.entries.find((e) => e.seriesKey === 'US');
    expect(us!.labelLines[0]).toBe('US 40');
    expect(us!.value).toBe('');
  });

  it("content: 'value' renders the formatted value alone", () => {
    const spec = makeSpec({ endpointLabels: { content: 'value' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const us = layout.entries.find((e) => e.seriesKey === 'US');
    expect(us!.labelLines).toEqual(['40']);
    expect(us!.value).toBe('');
  });

  it("content: 'label' renders the series name alone", () => {
    const spec = makeSpec({ endpointLabels: { content: 'label' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    const us = layout.entries.find((e) => e.seriesKey === 'US');
    expect(us!.labelLines).toEqual(['US']);
    expect(us!.value).toBe('');
  });

  it('per-side content object resolves leading and trailing independently', () => {
    const spec = makeSpec({
      endpointLabels: {
        ends: 'both',
        content: { leading: 'label value', trailing: 'value' },
      },
    });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea);

    // Leading: first data point value (value - 5) joined with the name.
    const usLeading = layout.leading!.find((e) => e.seriesKey === 'US');
    expect(usLeading!.labelLines[0]).toBe('US 35');
    // Trailing: last value alone.
    const usTrailing = layout.entries.find((e) => e.seriesKey === 'US');
    expect(usTrailing!.labelLines).toEqual(['40']);
  });

  it('keeps the column at compact breakpoints when endpoint labels are explicitly on', () => {
    // Slope/bump recipes carry their values on the labels: explicit user
    // config must survive the compact strategy strip (labelMode: 'none').
    const spec = makeSpec({ endpointLabels: { ends: 'both', content: 'label value' } });
    const marks: Mark[] = [makeLineMark('US', 100, 40), makeLineMark('UK', 200, 35, '#cc6633')];
    const layout = computeEndpointLabels(spec, marks, theme, chartArea, {
      labelMode: 'none',
      legendPosition: 'top',
      annotationPosition: 'tooltip-only',
      axisLabelDensity: 'minimal',
      chromeMode: 'full',
      legendMaxHeight: -1,
    });

    expect(layout.entries).toHaveLength(2);
    expect(layout.leading).toHaveLength(2);
  });
});
