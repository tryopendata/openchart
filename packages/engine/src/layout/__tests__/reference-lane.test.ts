import type { ChartSpec, RefLineAnnotation } from '@opendata-ai/openchart-core';
import { getHeightClass } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { annotationReferenceSpecs } from '../../../../../examples/src/gallery/features-annotations.demos';
import {
  NO_REFERENCE_RESERVE,
  packReferenceRows,
  type ReferenceLaneLabel,
  referenceLaneHeights,
} from '../../annotations/reference-layout';
import { compileChart } from '../../compile';
import type { LeafContext } from '../../compile/internal-options';
import { computeFacetGrid } from '../facet';
import { REFERENCE_LANE_SHARE_MAX } from '../stack';

// Mirrors ReferenceLaneOverflow in examples/src/charts/mobile-regression.stories.tsx.
const overflowSpec: ChartSpec = {
  mark: 'line',
  data: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((year, i) => ({
    year: String(year),
    rate: 4 + Math.sin(i / 1.5) * 1.6 + i * 0.25,
  })),
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { title: undefined } },
    y: { field: 'rate', type: 'quantitative', axis: { title: 'Unemployment rate (%)' } },
  },
  chrome: {
    title: 'Three policy changes, one labor market',
    subtitle: 'Unemployment rate around each policy event',
  },
  annotations: [
    {
      type: 'refline',
      x: '2017',
      label: 'Minimum wage increase takes effect statewide',
      labelPlacement: 'outside',
    },
    {
      type: 'refline',
      x: '2020',
      label: 'Pandemic emergency declaration and closures',
      labelPlacement: 'outside',
    },
    {
      type: 'refline',
      x: '2022',
      label: 'Expanded child tax credit expires nationwide',
      labelPlacement: 'outside',
    },
    {
      type: 'refline',
      y: 6,
      label: 'Long-run average across the full period',
      labelPlacement: 'outside',
    },
  ],
};

const compile = (spec: ChartSpec, width: number, height: number) => {
  const warnings: string[] = [];
  const leafContext: LeafContext = {};
  const layout = compileChart(spec, {
    width,
    height,
    onWarn: (w) => warnings.push(w),
    leafContext,
  } as Parameters<typeof compileChart>[1]);
  return { layout, warnings, budget: leafContext.budget!, plan: leafContext.plan! };
};

const laneWarnings = (warnings: string[]) =>
  warnings.filter((w) => w.includes('exceed their available lane'));

/** Vertical reference labels (rule x constant) with their spec index. */
const verticalLabels = (layout: ReturnType<typeof compileChart>) =>
  layout.annotations.filter(
    (a) => a.type === 'refline' && a.line!.start.x === a.line!.end.x && a.label,
  );

describe('top reference lane: plot height steps down by at most one capped row', () => {
  // The responsive strategy compacts chrome in short containers; that
  // breakpoint is its own step, so heights are compared within a height class.
  const heights = Array.from({ length: 26 }, (_, i) => 300 + i * 20);
  const cases: Array<[string, ChartSpec, number]> = [
    ['ReferenceLaneOverflow', overflowSpec, 358],
    ['annotationReferenceSpecs[0] narrow', annotationReferenceSpecs[0], 358],
    ['annotationReferenceSpecs[0] wide', annotationReferenceSpecs[0], 640],
    ...annotationReferenceSpecs
      .slice(1)
      .map((spec, i): [string, ChartSpec, number] => [
        `annotationReferenceSpecs[${i + 1}]`,
        spec,
        358,
      ]),
  ];
  it.each(cases)('%s', (_name, spec, width) => {
    // Admitting a row reserves it whole (no partly empty lane), so growing
    // past an admission threshold may shrink the plot by that row, which the
    // share cap bounds. Anywhere else the plot grows with the figure.
    let previous: { height: number; plot: number; lane: number } | undefined;
    for (const height of heights) {
      const { layout, budget } = compile(spec, width, height);
      const lane = budget.reference.top;
      expect(lane).toBeLessThanOrEqual(REFERENCE_LANE_SHARE_MAX * height + 1e-9);
      if (previous && getHeightClass(previous.height) === getHeightClass(height)) {
        const admitted = lane - previous.lane;
        expect(
          layout.area.height,
          `plot at ${height} vs ${previous.height}`,
        ).toBeGreaterThanOrEqual(previous.plot - Math.max(0, admitted) - 1e-9);
        if (admitted <= 0)
          expect(layout.area.height, `plot at ${height}`).toBeGreaterThanOrEqual(
            previous.plot - 1e-9,
          );
      }
      previous = { height, plot: layout.area.height, lane };
    }
  });

  it('keeps authored chrome at 358x400: the lane yields first', () => {
    const { layout, budget } = compile(overflowSpec, 358, 400);
    expect(layout.chrome.subtitle).toBeDefined();
    // One row (2017 + 2022) fits the 25% share; the 2020 label falls back
    // inside the plot, clear of the lane above it.
    expect(budget.reference.rows.map((r) => r.members)).toEqual([[0, 2]]);
    const fallback = verticalLabels(layout).find((a) => a.specIndex === 1)!;
    expect(fallback.bounds!.y).toBeGreaterThanOrEqual(layout.area.y);
    expect(budget.degraded).not.toContain('chrome-compact');
    expect(budget.degraded).not.toContain('chrome-hidden');
  });
});

describe('top reference lane packing', () => {
  const label = (index: number, width = 80, height = 30): ReferenceLaneLabel => ({
    index,
    width,
    height,
  });
  const plot = { x: 0 };
  const container = { x: 0, width: 1000 };

  it('shares a row between labels whose extents do not overlap; stacks overlapping ones', () => {
    const positions = [100, 400, 130, 700];
    const rows = packReferenceRows(
      [label(0), label(1), label(2, 80, 50), label(3)],
      (i) => positions[i],
      plot,
      container,
    );
    // 0, 1 and 3 are far apart; 2 overlaps 0 and opens a second row.
    expect(rows.map((r) => r.members)).toEqual([[0, 1, 3], [2]]);
    expect(rows.map((r) => r.height)).toEqual([30, 50]);
    expect(referenceLaneHeights(rows)).toEqual([30 + 8 + 24, 30 + 8 + 50 + 8 + 24]);
  });

  it('is deterministic and keeps source order within rows', () => {
    const labels = [label(0), label(1), label(2), label(3)];
    const xOf = (i: number) => [500, 100, 520, 300][i];
    const first = packReferenceRows(labels, xOf, plot, container);
    expect(packReferenceRows(labels, xOf, plot, container)).toEqual(first);
    expect(first.map((r) => r.members)).toEqual([[0, 1, 3], [2]]);
  });

  it('gives each label its own row without rule positions, and skips unresolved rules', () => {
    expect(packReferenceRows([label(0), label(1)]).map((r) => r.members)).toEqual([[0], [1]]);
    expect(
      packReferenceRows([label(0), label(1)], (i) => (i === 0 ? null : 50), plot, container).map(
        (r) => r.members,
      ),
    ).toEqual([[1]]);
  });

  it('places non-overlapping labels on one row in a compiled chart', () => {
    const { layout, budget } = compile(overflowSpec, 358, 800);
    const [first, second, third] = verticalLabels(layout);
    // 2017 and 2022 sit far enough apart to share the first row; 2020 overlaps both.
    expect(budget.reference.rows.map((r) => r.members)).toEqual([[0, 2], [1]]);
    expect(first.bounds!.y).toBeCloseTo(third.bounds!.y);
    expect(second.bounds!.y).toBeGreaterThan(first.bounds!.y + first.bounds!.height);
    expect(first.bounds!.x + first.bounds!.width).toBeLessThanOrEqual(third.bounds!.x);
    for (const a of [first, second, third])
      expect(a.bounds!.y + a.bounds!.height).toBeLessThanOrEqual(layout.area.y);
  });
});

describe('top reference lane cap', () => {
  // Rules close together overlap, so each label needs its own row.
  const crowded: ChartSpec = {
    mark: 'point',
    data: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    chrome: { title: 'Quarterly revenue', subtitle: 'Indexed to the first quarter' },
    annotations: [4, 4.5, 5, 5.5, 6].map(
      (x, i): RefLineAnnotation => ({
        type: 'refline',
        x,
        label: `Policy change ${i} announced in the spring`,
        labelPlacement: 'outside',
      }),
    ),
  };

  it('admits rows up to the share cap; excess labels fall back inside with one warning', () => {
    const { layout, warnings, budget } = compile(crowded, 640, 500);
    expect(budget.reference.top).toBeLessThanOrEqual(500 * REFERENCE_LANE_SHARE_MAX);
    const admitted = new Set(budget.reference.rows.flatMap((r) => r.members));
    expect(admitted.size).toBeGreaterThan(0);
    expect(admitted.size).toBeLessThan(5);
    const labels = verticalLabels(layout);
    const lane = labels.filter((a) => admitted.has(a.specIndex!));
    const titleBottom = layout.chrome.subtitle!.y + layout.chrome.subtitle!.style.fontSize;
    for (const a of labels) {
      const b = a.bounds!;
      if (admitted.has(a.specIndex!)) {
        expect(b.y + b.height).toBeLessThanOrEqual(layout.area.y);
        continue;
      }
      // Individually placed with the automatic fallback: inside the plot,
      // below the chrome, and clear of every admitted lane label.
      expect(b.y).toBeGreaterThan(titleBottom);
      expect(b.y).toBeGreaterThanOrEqual(layout.area.y);
      expect(b.y + b.height).toBeLessThanOrEqual(layout.area.y + layout.area.height + 1e-9);
      for (const other of lane) {
        const o = other.bounds!;
        const overlaps =
          b.x < o.x + o.width &&
          o.x < b.x + b.width &&
          b.y < o.y + o.height &&
          o.y < b.y + b.height;
        expect(overlaps).toBe(false);
      }
    }
    expect(laneWarnings(warnings)).toHaveLength(1);
    expect(budget.degraded).toContain('reference-lane');
    expect(layout.chrome.subtitle).toBeDefined();
  });

  it('admits every row once the figure is tall enough, without a warning', () => {
    const { layout, warnings, budget } = compile(crowded, 640, 1400);
    expect(budget.reference.rows.flatMap((r) => r.members)).toHaveLength(5);
    for (const a of verticalLabels(layout))
      expect(a.bounds!.y + a.bounds!.height).toBeLessThanOrEqual(layout.area.y);
    expect(laneWarnings(warnings)).toHaveLength(0);
  });
});

describe('layout plan reads the budget margin stack', () => {
  it.each([400, 600, 800])('plans ticks for the final plot height at 358x%s', (height) => {
    const { layout, plan } = compile(overflowSpec, 358, height);
    expect(plan.plotArea).toEqual(layout.area);
  });

  it('accounts for the metric bar and a subtract-mode note band', () => {
    const { layout, plan } = compile(
      {
        ...overflowSpec,
        chromeLayout: 'subtract',
        metrics: [
          { label: 'Peak', value: '6.4%' },
          { label: 'Latest', value: '5.1%' },
        ],
        annotations: [
          ...overflowSpec.annotations!,
          { type: 'text', x: '2019', y: 5, text: 'A note that demotes at this width' },
        ],
      },
      640,
      700,
    );
    expect(layout.metrics).toBeDefined();
    expect(plan.plotArea).toEqual(layout.area);
  });
});

describe('facet reference lane cap', () => {
  // Same crowded rules as the single-chart cap, in a 2x2 grid.
  const crowdedFacet: ChartSpec = {
    mark: 'point',
    data: ['A', 'B', 'C', 'D'].flatMap((group) => [
      { x: 0, y: 0, group },
      { x: 10, y: 10, group },
    ]),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      facet: { field: 'group', type: 'nominal', columns: 2 },
    },
    chrome: { title: 'Quarterly revenue', subtitle: 'Indexed to the first quarter' },
    annotations: [4, 4.5, 5, 5.5, 6].map(
      (x, i): RefLineAnnotation => ({
        type: 'refline',
        x,
        label: `Policy change ${i} announced in the spring`,
        labelPlacement: 'outside',
      }),
    ),
  };
  // Panel header band (HEADER_HEIGHT in layout/facet.ts) sits above the lane.
  const HEADER_HEIGHT = 20;
  const laneOf = (panel: NonNullable<ReturnType<typeof compileChart>['facet']>['panels'][number]) =>
    panel.area.y - (panel.header.y - HEADER_HEIGHT * 0.6 + HEADER_HEIGHT);
  const rowSlot = (layout: ReturnType<typeof compileChart>) => {
    const panels = layout.facet!.panels;
    const rows = new Set(panels.map((p) => p.header.y)).size;
    const top = Math.min(...panels.map((p) => p.header.y)) - HEADER_HEIGHT * 0.6;
    const bottom = Math.max(...panels.map((p) => p.area.y + p.area.height));
    return { rows, top, bottom };
  };

  // Each wrapped label is 62px tall, so a lane row costs 94px (one) to 374px (all five).
  it.each([
    500, 1000, 1800,
  ])('caps each panel lane at the share of its grid row at 640x%s', (height) => {
    const { layout, warnings } = compile(
      { ...crowdedFacet, chromeLayout: 'subtract' },
      640,
      height,
    );
    const { rows } = rowSlot(layout);
    for (const panel of layout.facet!.panels) {
      const slot = (layout.area.height - (rows - 1) * 12) / rows;
      expect(laneOf(panel)).toBeLessThanOrEqual(REFERENCE_LANE_SHARE_MAX * slot + 1e-9);
      // Snapped admission: the lane holds whole rows and admitted labels sit in it.
      const lane = verticalLabels({ annotations: panel.annotations } as ReturnType<
        typeof compileChart
      >);
      const above = lane.filter((a) => a.bounds!.y + a.bounds!.height <= panel.area.y);
      expect(above.length).toBeLessThan(5);
      if (height > 500) expect(above.length).toBeGreaterThan(0);
      else expect(above).toHaveLength(0);
      for (const a of lane) expect(a.bounds!.y).toBeGreaterThan(panel.header.y);
    }
    expect(laneWarnings(warnings).length).toBeGreaterThan(0);
  });

  it('admits every row once the figure is tall enough, without a warning', () => {
    const { layout, warnings } = compile({ ...crowdedFacet, chromeLayout: 'subtract' }, 640, 3400);
    for (const panel of layout.facet!.panels)
      for (const a of verticalLabels({ annotations: panel.annotations } as ReturnType<
        typeof compileChart
      >))
        expect(a.bounds!.y + a.bounds!.height).toBeLessThanOrEqual(panel.area.y);
    expect(laneWarnings(warnings)).toHaveLength(0);
  });

  it('plot height steps down by at most one capped row as the figure grows', () => {
    let previous: { height: number; plot: number; lane: number } | undefined;
    for (let height = 400; height <= 2000; height += 40) {
      const { layout } = compile({ ...crowdedFacet, chromeLayout: 'subtract' }, 640, height);
      const panel = layout.facet!.panels[0];
      const lane = laneOf(panel);
      if (previous && getHeightClass(previous.height) === getHeightClass(height)) {
        const admitted = lane - previous.lane;
        expect(panel.area.height, `plot at ${height}`).toBeGreaterThanOrEqual(
          previous.plot - Math.max(0, admitted) - 1e-9,
        );
        if (admitted <= 0) expect(panel.area.height).toBeGreaterThanOrEqual(previous.plot - 1e-9);
      }
      previous = { height, plot: panel.area.height, lane };
    }
  });
});

describe('facet grid lane admission', () => {
  // Five labels of `height` px: lane heights height + 32, then + height + 8 per row.
  const grid = (height: number, labelHeight = 40) =>
    computeFacetGrid(
      ['A', 'B'],
      2,
      { x: 0, y: 0, width: 640, height },
      { left: 0, bottom: 24 },
      {
        measure: () => ({
          ...NO_REFERENCE_RESERVE,
          labelWidth: 80,
          labels: [0, 1, 2, 3, 4].map((index) => ({ index, width: 80, height: labelHeight })),
        }),
        innerAxisWidth: 0,
      },
    );

  it('admits the leading rows that fit the share of the grid row', () => {
    // One grid row of 600px: the cap is 150px, so the first two rows (72, 120) fit.
    const { panels } = grid(600);
    for (const panel of panels) {
      expect(panel.referenceReserve!.rows.map((r) => r.members)).toEqual([[0], [1]]);
      expect(panel.area.y - panel.referenceContainer!.y).toBe(120);
      expect(panel.referenceReserve!.rows[0].above).toBe(120);
    }
  });

  it('measures a short grid at the height it grows to', () => {
    // Too short for the panel minimum: the lane is what fits a minimum-height
    // row (20 + 100 + 24 + lane, lane <= 25%): 10px labels give 42 (fits 46.5),
    // then 60 (over 51). minimumHeight includes it, and the grown grid agrees.
    const { panels, minimumHeight } = grid(100, 10);
    expect(panels[0].referenceReserve!.rows.map((r) => r.members)).toEqual([[0]]);
    expect(minimumHeight).toBeCloseTo(20 + 100 + 24 + 42);
    const grown = grid(minimumHeight!, 10);
    expect(grown.panels[0].area.height).toBeCloseTo(100);
    expect(grown.panels[0].referenceReserve!.rows.map((r) => r.members)).toEqual([[0]]);
  });
});

describe('right reference lane edge inset', () => {
  const spec: ChartSpec = {
    mark: 'point',
    data: [0, 1, 2, 3, 4].map((x) => ({ x, y: x * 2 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    chrome: { title: 'Right lane', source: 'Source: test' },
    annotations: [{ type: 'refline', y: 4, label: 'Target', labelPlacement: 'outside' }],
  };

  it.each([
    [960, 600],
    [640, 400],
    [358, 400],
  ])('ends the label at the chrome padding at %sx%s', (width, height) => {
    const { layout } = compile(spec, width, height);
    const pad = layout.chrome.title!.x;
    const label = layout.annotations.find((a) => a.type === 'refline')!;
    const b = label.bounds!;
    expect(b.x).toBeGreaterThan(layout.area.x + layout.area.width);
    expect(width - (b.x + b.width)).toBeGreaterThanOrEqual(pad - 1e-9);
    expect(width - (b.x + b.width)).toBeLessThan(pad + 1);
  });
});
