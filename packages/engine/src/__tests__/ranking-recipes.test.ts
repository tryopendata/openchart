/**
 * Integration tests for the slope + bump chart recipes (plan 14).
 *
 * These are the exact specs published on docs/ranking-and-change.md and
 * pinned as visual fixtures in examples/src/testing/fixtures-ranking.stories.tsx.
 * They use only public spec surface: if a test here needs a private flag to
 * pass, the recipe is broken.
 */

import type { ChartSpec, LineMark, PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileChart } from '../compile';

// ---------------------------------------------------------------------------
// Recipe specs (keep byte-identical to docs/ranking-and-change.md)
// ---------------------------------------------------------------------------

const slopeMarketShareSpec: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2019', brand: 'Samsung', share: 0.216 },
    { year: '2024', brand: 'Samsung', share: 0.19 },
    { year: '2019', brand: 'Huawei', share: 0.176 },
    { year: '2024', brand: 'Huawei', share: 0.043 },
    { year: '2019', brand: 'Apple', share: 0.139 },
    { year: '2024', brand: 'Apple', share: 0.187 },
    { year: '2019', brand: 'Xiaomi', share: 0.092 },
    { year: '2024', brand: 'Xiaomi', share: 0.136 },
    { year: '2019', brand: 'Oppo', share: 0.083 },
    { year: '2024', brand: 'Oppo', share: 0.087 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'share',
      type: 'quantitative',
      axis: false,
      scale: { zero: false },
    },
    color: { field: 'brand', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label value',
    format: '.0%',
  },
  legend: { show: false },
  chrome: {
    title: 'Apple and Xiaomi Split What Huawei Lost',
    subtitle: 'Share of global smartphone shipments, 2019 vs 2024',
    source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  },
};

const bumpConstructorsSpec: ChartSpec = {
  mark: { type: 'line', interpolate: 'monotone', point: true },
  data: [
    { season: '2019', team: 'Mercedes', position: 1 },
    { season: '2020', team: 'Mercedes', position: 1 },
    { season: '2021', team: 'Mercedes', position: 1 },
    { season: '2022', team: 'Mercedes', position: 3 },
    { season: '2023', team: 'Mercedes', position: 2 },
    { season: '2024', team: 'Mercedes', position: 4 },
    { season: '2019', team: 'Red Bull', position: 3 },
    { season: '2020', team: 'Red Bull', position: 2 },
    { season: '2021', team: 'Red Bull', position: 2 },
    { season: '2022', team: 'Red Bull', position: 1 },
    { season: '2023', team: 'Red Bull', position: 1 },
    { season: '2024', team: 'Red Bull', position: 3 },
    { season: '2019', team: 'Ferrari', position: 2 },
    { season: '2020', team: 'Ferrari', position: 6 },
    { season: '2021', team: 'Ferrari', position: 3 },
    { season: '2022', team: 'Ferrari', position: 2 },
    { season: '2023', team: 'Ferrari', position: 3 },
    { season: '2024', team: 'Ferrari', position: 2 },
    { season: '2019', team: 'McLaren', position: 4 },
    { season: '2020', team: 'McLaren', position: 3 },
    { season: '2021', team: 'McLaren', position: 4 },
    { season: '2022', team: 'McLaren', position: 5 },
    { season: '2023', team: 'McLaren', position: 4 },
    { season: '2024', team: 'McLaren', position: 1 },
    { season: '2019', team: 'Alpine', position: 5 },
    { season: '2020', team: 'Alpine', position: 5 },
    { season: '2021', team: 'Alpine', position: 5 },
    { season: '2022', team: 'Alpine', position: 4 },
    { season: '2023', team: 'Alpine', position: 6 },
    { season: '2024', team: 'Alpine', position: 6 },
  ],
  encoding: {
    x: { field: 'season', type: 'ordinal' },
    y: {
      field: 'position',
      type: 'quantitative',
      scale: { reverse: true, zero: false },
      axis: { values: [1, 2, 3, 4, 5, 6], format: 'ordinal' },
    },
    color: { field: 'team', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label',
    showMarker: false,
  },
  legend: { show: false },
  chrome: {
    title: 'McLaren Went From Midfield to Champions',
    subtitle: 'Formula 1 constructors championship, final position by season',
    source: 'Source: FIA official standings',
  },
};

// ---------------------------------------------------------------------------
// Slope recipe
// ---------------------------------------------------------------------------

describe('slope chart recipe', () => {
  it('renders both-end labels for all five series', () => {
    const layout = compileChart(slopeMarketShareSpec, { width: 640, height: 420 });

    expect(layout.endpointLabels?.entries).toHaveLength(5);
    expect(layout.endpointLabels?.leading).toHaveLength(5);
  });

  it("composes 'name value' on one line at both ends", () => {
    const layout = compileChart(slopeMarketShareSpec, { width: 640, height: 420 });

    const left = layout.endpointLabels!.leading!.find((e) => e.seriesKey === 'Samsung');
    expect(left!.labelLines[0]).toBe('Samsung 22%');
    expect(left!.value).toBe('');

    const right = layout.endpointLabels!.entries.find((e) => e.seriesKey === 'Samsung');
    expect(right!.labelLines[0]).toBe('Samsung 19%');
    expect(right!.value).toBe('');
  });

  it('renders no y axis and no gridlines', () => {
    const layout = compileChart(slopeMarketShareSpec, { width: 640, height: 420 });

    expect(layout.axes.y).toBeUndefined();
  });

  it('orders labels by value at each end (Huawei falls from 2nd to last)', () => {
    const layout = compileChart(slopeMarketShareSpec, { width: 640, height: 420 });

    const byY = (a: { labelY: number }, b: { labelY: number }) => a.labelY - b.labelY;
    const leftOrder = [...layout.endpointLabels!.leading!].sort(byY).map((e) => e.seriesKey);
    expect(leftOrder).toEqual(['Samsung', 'Huawei', 'Apple', 'Xiaomi', 'Oppo']);

    const rightOrder = [...layout.endpointLabels!.entries].sort(byY).map((e) => e.seriesKey);
    expect(rightOrder).toEqual(['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Huawei']);
  });

  it('keeps both-end labels and a positive plot area at 320px (compact breakpoint)', () => {
    const layout = compileChart(slopeMarketShareSpec, { width: 320, height: 360 });

    expect(layout.endpointLabels?.entries).toHaveLength(5);
    expect(layout.endpointLabels?.leading).toHaveLength(5);
    expect(layout.area.width).toBeGreaterThan(0);
    // Both label columns fit inside the 320px canvas.
    expect(layout.endpointLabels!.leadingBounds!.x).toBeGreaterThanOrEqual(0);
    expect(
      layout.endpointLabels!.bounds.x + layout.endpointLabels!.bounds.width,
    ).toBeLessThanOrEqual(320);
  });
});

// ---------------------------------------------------------------------------
// Bump recipe
// ---------------------------------------------------------------------------

describe('bump chart recipe', () => {
  it('puts rank 1 at the top via scale.reverse', () => {
    const layout = compileChart(bumpConstructorsSpec, { width: 640, height: 460 });

    const ticks = layout.axes.y!.ticks;
    const first = ticks.find((t) => t.value === 1);
    const last = ticks.find((t) => t.value === 6);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    expect(first!.position).toBeLessThan(last!.position);
  });

  it('labels rank ticks as ordinals, 1st through 6th top to bottom', () => {
    const layout = compileChart(bumpConstructorsSpec, { width: 640, height: 460 });

    const labels = [...layout.axes.y!.ticks]
      .sort((a, b) => a.position - b.position)
      .map((t) => t.label);
    expect(labels).toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th']);
  });

  it('draws a point marker at every step of every series', () => {
    const layout = compileChart(bumpConstructorsSpec, { width: 640, height: 460 });

    const points = layout.marks.filter(
      (m): m is PointMark => m.type === 'point' && m.opacity !== 0,
    );
    // 5 teams x 6 seasons.
    expect(points).toHaveLength(30);
  });

  it('orders both-end name labels by rank at each end', () => {
    const layout = compileChart(bumpConstructorsSpec, { width: 640, height: 460 });

    const byY = (a: { labelY: number }, b: { labelY: number }) => a.labelY - b.labelY;
    // 2019: Mercedes 1st, Ferrari 2nd, Red Bull 3rd, McLaren 4th, Alpine 5th.
    const leftOrder = [...layout.endpointLabels!.leading!].sort(byY).map((e) => e.seriesKey);
    expect(leftOrder).toEqual(['Mercedes', 'Ferrari', 'Red Bull', 'McLaren', 'Alpine']);
    // 2024: McLaren 1st, Ferrari 2nd, Red Bull 3rd, Mercedes 4th, Alpine 6th.
    const rightOrder = [...layout.endpointLabels!.entries].sort(byY).map((e) => e.seriesKey);
    expect(rightOrder).toEqual(['McLaren', 'Ferrari', 'Red Bull', 'Mercedes', 'Alpine']);
  });

  it('renders name-only labels (no value line)', () => {
    const layout = compileChart(bumpConstructorsSpec, { width: 640, height: 460 });

    for (const entry of layout.endpointLabels!.entries) {
      expect(entry.labelLines).toEqual([entry.seriesKey]);
      expect(entry.value).toBe('');
    }
  });

  it('maps tied ranks to the same y (ties share a row)', () => {
    const tieSpec: ChartSpec = {
      ...bumpConstructorsSpec,
      data: [
        { season: '2023', team: 'A', position: 1 },
        { season: '2024', team: 'A', position: 2 },
        { season: '2023', team: 'B', position: 2 },
        { season: '2024', team: 'B', position: 2 },
        { season: '2023', team: 'C', position: 3 },
        { season: '2024', team: 'C', position: 1 },
      ],
      encoding: {
        ...bumpConstructorsSpec.encoding,
        y: {
          field: 'position',
          type: 'quantitative',
          scale: { reverse: true, zero: false },
          axis: { values: [1, 2, 3], format: 'ordinal' },
        },
      },
    };
    const layout = compileChart(tieSpec, { width: 640, height: 400 });

    const lines = layout.marks.filter(
      (m): m is LineMark => m.type === 'line' && m.seriesKey != null,
    );
    const lastY = (key: string) => {
      const mark = lines.find((m) => m.seriesKey === key)!;
      const pts = mark.dataPoints ?? [];
      return pts[pts.length - 1]!.y;
    };
    // A and B tie for 2nd in 2024: identical y.
    expect(lastY('A')).toBeCloseTo(lastY('B'), 6);
    // C is 1st, above the tied pair (smaller y = higher rank).
    expect(lastY('C')).toBeLessThan(lastY('A'));
  });
});
