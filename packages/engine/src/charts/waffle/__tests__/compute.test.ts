import type { LayoutStrategy, Rect, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileChart } from '../../../compile';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeWaffleMarks, largestRemainderCells } from '../compute';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 40, y: 20, width: 400, height: 400 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const energyMix = [
  { source: 'Fossil', share: 60 },
  { source: 'Renewables', share: 30 },
  { source: 'Nuclear', share: 10 },
];

function makeWaffleSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
  return {
    markType: 'waffle',
    markDef: { type: 'waffle' },
    data: [...energyMix],
    encoding: {
      y: { field: 'share', type: 'quantitative' },
      color: { field: 'source', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
    ...overrides,
  } as NormalizedChartSpec;
}

function marksFor(spec: NormalizedChartSpec): RectMark[] {
  const scales = computeScales(spec, chartArea, spec.data);
  return computeWaffleMarks(spec, scales, chartArea, fullStrategy);
}

/** Deterministic LCG so the property test carries no runtime randomness. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// ---------------------------------------------------------------------------
// largestRemainderCells
// ---------------------------------------------------------------------------

describe('largestRemainderCells', () => {
  it('sums exactly to units', () => {
    expect(largestRemainderCells([60, 30, 10], 100).reduce((a, b) => a + b, 0)).toBe(100);
    expect(largestRemainderCells([1, 1, 1], 100).reduce((a, b) => a + b, 0)).toBe(100);
    expect(largestRemainderCells([7, 13, 3], 40).reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('rounds a 0.4-cell category by largest remainder while the total stays exact', () => {
    // Quotas 33.2 / 33.2 / 33.2 / 0.4: the 0.4 remainder is the largest, so
    // the small category wins the single leftover cell.
    expect(largestRemainderCells([33.2, 33.2, 33.2, 0.4], 100)).toEqual([33, 33, 33, 1]);

    // Quotas 49.8 / 49.8 / 0.4: both 0.8 remainders beat 0.4, so the small
    // category legitimately rounds to 0 cells (no minimum-1-cell rule).
    expect(largestRemainderCells([49.8, 49.8, 0.4], 100)).toEqual([50, 50, 0]);
  });

  it('breaks equal remainders by larger raw value, then stable input index', () => {
    // Quotas 1.5 / 2.5 / 3.5 / 2.5 (all remainders 0.5), two leftover cells:
    // the largest raw value (35) wins first, then the 25s tie and the earlier
    // input index (1) wins over index 3.
    expect(largestRemainderCells([15, 25, 35, 25], 10)).toEqual([1, 3, 4, 2]);

    // Fully symmetric tie: value tiebreak is moot, index order decides.
    expect(largestRemainderCells([25, 25, 25, 25], 10)).toEqual([3, 3, 2, 2]);
  });

  it('allocates 0 cells to non-finite and negative values', () => {
    expect(largestRemainderCells([Number.NaN, 50, -10, 50], 10)).toEqual([0, 5, 0, 5]);
  });

  it('returns all zeros when there is nothing to allocate', () => {
    expect(largestRemainderCells([0, 0], 100)).toEqual([0, 0]);
    expect(largestRemainderCells([], 100)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeWaffleMarks geometry
// ---------------------------------------------------------------------------

describe('computeWaffleMarks', () => {
  it('emits square cells with a gap of cell/6', () => {
    const marks = marksFor(makeWaffleSpec());
    expect(marks).toHaveLength(100);

    const first = marks[0];
    expect(first.width).toBeCloseTo(first.height);

    // Neighbor in the same row sits one cell + gap to the right.
    const second = marks[1];
    expect(second.y).toBe(first.y);
    expect(second.x - (first.x + first.width)).toBeCloseTo(first.width / 6);
  });

  it('fills bottom-left to top-right by rows', () => {
    const marks = marksFor(makeWaffleSpec());

    // First cell is the leftmost column; the first 10 cells share the bottom row.
    const xs = marks.map((m) => m.x);
    const ys = marks.map((m) => m.y);
    expect(marks[0].x).toBe(Math.min(...xs));
    expect(marks[0].y).toBe(Math.max(...ys));
    for (let i = 1; i < 10; i++) {
      expect(marks[i].y).toBe(marks[0].y);
      expect(marks[i].x).toBeGreaterThan(marks[i - 1].x);
    }
    // Cell 10 wraps to the next row up.
    expect(marks[10].x).toBe(marks[0].x);
    expect(marks[10].y).toBeLessThan(marks[0].y);
    // Last cell tops out the grid.
    expect(marks[99].y).toBe(Math.min(...ys));
  });

  it('centers the grid in the chart area', () => {
    const marks = marksFor(makeWaffleSpec());
    const minX = Math.min(...marks.map((m) => m.x));
    const maxX = Math.max(...marks.map((m) => m.x + m.width));
    const minY = Math.min(...marks.map((m) => m.y));
    const maxY = Math.max(...marks.map((m) => m.y + m.height));

    expect(minX - chartArea.x).toBeCloseTo(chartArea.x + chartArea.width - maxX);
    expect(minY - chartArea.y).toBeCloseTo(chartArea.y + chartArea.height - maxY);
  });

  it('assigns category cells contiguously in data order with stable keys', () => {
    const marks = marksFor(makeWaffleSpec());

    const bySource = (s: string) =>
      marks.filter((m) => (m.data as { source: string }).source === s);
    expect(bySource('Fossil')).toHaveLength(60);
    expect(bySource('Renewables')).toHaveLength(30);
    expect(bySource('Nuclear')).toHaveLength(10);

    expect(marks[0].key).toBe('Fossil|0');
    expect(marks[59].key).toBe('Fossil|59');
    expect(marks[60].key).toBe('Renewables|0');
    expect(marks[99].key).toBe('Nuclear|9');
  });

  it('respects units and columns mark options', () => {
    const spec = makeWaffleSpec({
      markDef: { type: 'waffle', units: 40, columns: 8 },
    });
    const marks = marksFor(spec);
    expect(marks).toHaveLength(40);

    // 8 columns x 5 rows: cells 0-7 share the bottom row, cell 8 wraps.
    expect(marks[7].y).toBe(marks[0].y);
    expect(marks[8].x).toBe(marks[0].x);
    expect(marks[8].y).toBeLessThan(marks[0].y);
  });

  it('labels the first cell of each category "x of N units" and marks the rest decorative', () => {
    const marks = marksFor(makeWaffleSpec());

    expect(marks[0].aria.label).toBe('Fossil: 60 of 100 units (60.0%)');
    expect(marks[0].aria.decorative).toBeUndefined();
    expect(marks[1].aria.label).toBe('Fossil: 60 of 100 units (60.0%)');
    expect(marks[1].aria.decorative).toBe(true);
    expect(marks[60].aria.label).toBe('Renewables: 30 of 100 units (30.0%)');
    expect(marks[60].aria.decorative).toBeUndefined();
  });

  it('defaults cornerRadius to 1 and honors a mark-level override', () => {
    expect(marksFor(makeWaffleSpec())[0].cornerRadius).toBe(1);

    const spec = makeWaffleSpec({ markDef: { type: 'waffle', cornerRadius: 3 } });
    expect(marksFor(spec)[0].cornerRadius).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// compileChart integration (spec in, layout out)
// ---------------------------------------------------------------------------

describe('compileChart with waffle marks', () => {
  const baseSpec = {
    mark: 'waffle' as const,
    data: [...energyMix],
    encoding: {
      theta: { field: 'share', type: 'quantitative' as const },
      color: { field: 'source', type: 'nominal' as const },
    },
  };

  it('renders exactly units cells for random distributions summing to 100% (property test)', () => {
    const rand = lcg(20260711);

    for (let trial = 0; trial < 25; trial++) {
      const categoryCount = 2 + Math.floor(rand() * 7);
      const raw = Array.from({ length: categoryCount }, () => 0.01 + rand());
      const total = raw.reduce((a, b) => a + b, 0);
      const data = raw.map((v, i) => ({ category: `C${i}`, share: (v / total) * 100 }));

      const layout = compileChart(
        {
          mark: 'waffle',
          data,
          encoding: {
            theta: { field: 'share', type: 'quantitative' },
            color: { field: 'category', type: 'nominal' },
          },
        },
        { width: 600, height: 400 },
      );

      const cells = layout.marks.filter((m) => m.type === 'rect');
      expect(cells).toHaveLength(100);
    }
  });

  it('accepts theta as the value channel and compiles without axes or gridlines', () => {
    const layout = compileChart(baseSpec, { width: 600, height: 400 });

    expect(layout.marks.filter((m) => m.type === 'rect')).toHaveLength(100);
    expect(layout.axes.x).toBeUndefined();
    expect(layout.axes.y).toBeUndefined();
  });

  it('shares one tooltip object across every cell of a category', () => {
    const layout = compileChart(baseSpec, { width: 600, height: 400 });

    const rects = layout.marks
      .map((m, i) => ({ mark: m as RectMark, id: `rect-${i}` }))
      .filter(({ mark }) => mark.type === 'rect');

    const fossilIds = rects
      .filter(({ mark }) => (mark.data as { source: string }).source === 'Fossil')
      .map(({ id }) => id);
    const nuclearIds = rects
      .filter(({ mark }) => (mark.data as { source: string }).source === 'Nuclear')
      .map(({ id }) => id);
    expect(fossilIds).toHaveLength(60);

    const fossilTooltip = layout.tooltipDescriptors.get(fossilIds[0]);
    expect(fossilTooltip).toBeDefined();
    // Literally the same object for all cells: one hover target per category.
    for (const id of fossilIds) {
      expect(layout.tooltipDescriptors.get(id)).toBe(fossilTooltip);
    }
    expect(layout.tooltipDescriptors.get(nuclearIds[0])).not.toBe(fossilTooltip);

    expect(fossilTooltip!.title).toBe('Fossil');
    const share = fossilTooltip!.fields.find((f) => f.label === 'Share');
    expect(share?.value).toBe('60 of 100 units');
  });

  it('lists a category in the legend even when it rounds to 0 cells', () => {
    const layout = compileChart(
      {
        mark: 'waffle',
        data: [
          { source: 'A', share: 49.8 },
          { source: 'B', share: 49.8 },
          { source: 'C', share: 0.4 },
        ],
        encoding: {
          theta: { field: 'share', type: 'quantitative' },
          color: { field: 'source', type: 'nominal' },
        },
      },
      { width: 600, height: 400 },
    );

    const cells = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    expect(cells).toHaveLength(100);
    expect(cells.some((m) => (m.data as { source: string }).source === 'C')).toBe(false);

    expect(layout.legend.type).toBe('categorical');
    const labels =
      layout.legend.type === 'categorical' ? layout.legend.entries.map((e) => e.label) : [];
    expect(labels).toContain('C');
  });

  it('generates alt text with the unit framing', () => {
    const layout = compileChart(baseSpec, { width: 600, height: 400 });
    expect(layout.a11y.altText).toContain('Waffle chart');
    expect(layout.a11y.altText).toContain('dividing 100 units');
  });
});
