/**
 * Refline labels are collision citizens: they get measured bounds, they move off
 * marks, and later text annotations route around them.
 *
 * Geometry here is font-size- and width-dependent, so the placement cases sweep
 * the two axis-tick sizes the repo cares about (11 default, 14 deployed) and the
 * three canonical widths (blog mobile, small phone, desktop).
 */

import type { Annotation, ChartSpec, LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { detectCollision } from '@opendata-ai/openchart-core';
import { describe, expect, it, vi } from 'vitest';
import { compileChart } from '../../compile';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeScales } from '../../layout/scales';
import { collectPinnedOverlapWarnings } from '../collisions';
import { computeAnnotations } from '../compute';
import { heuristicMeasure } from '../geometry';
import type { PlacementObstacle } from '../placement';

const strategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const WIDTHS = [330, 360, 680];
const FONT_SIZES = [11, 14];

function makeSpec(annotations: Annotation[]): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { month: 'Jan', jobs: 10 },
      { month: 'Feb', jobs: 20 },
      { month: 'Mar', jobs: 30 },
      { month: 'Apr', jobs: 40 },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'jobs', type: 'quantitative' },
    },
    chrome: {},
    annotations,
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function chartAreaFor(width: number): Rect {
  return { x: 40, y: 20, width: width - 60, height: 260 };
}

/** A slab covering the right half of the plot, where a refline label lands by default. */
function rightHalfMarks(area: Rect): PlacementObstacle[] {
  return [
    {
      x: area.x + area.width / 2,
      y: area.y,
      width: area.width / 2,
      height: area.height,
      kind: 'mark',
    },
  ];
}

function run(
  spec: NormalizedChartSpec,
  area: Rect,
  obstacles: PlacementObstacle[],
  svg: { width: number; height: number },
) {
  const scales = computeScales(spec, area, spec.data);
  return computeAnnotations(spec, {
    scales,
    chartArea: area,
    strategy,
    isDark: false,
    obstacles,
    svg,
    measure: heuristicMeasure,
  });
}

describe('refline label bounds', () => {
  for (const fontSize of FONT_SIZES) {
    for (const width of WIDTHS) {
      it(`measures a refline label into bounds (${width}px, ${fontSize}px)`, () => {
        const area = chartAreaFor(width);
        const spec = makeSpec([{ type: 'refline', y: 25, label: 'avg: 25', fontSize }]);
        const [refline] = run(spec, area, [], { width, height: 320 });

        expect(refline.bounds).toBeDefined();
        expect(refline.bounds!.width).toBeGreaterThan(0);
        expect(refline.bounds!.height).toBeGreaterThan(0);
      });
    }
  }
});

describe('nudgeRefLineLabel via computeAnnotations', () => {
  for (const fontSize of FONT_SIZES) {
    for (const width of WIDTHS) {
      it(`moves an auto refline label off a mark obstacle (${width}px, ${fontSize}px)`, () => {
        const area = chartAreaFor(width);
        const obstacles = rightHalfMarks(area);
        const spec = makeSpec([{ type: 'refline', y: 25, label: 'avg: 25', fontSize }]);
        const [refline] = run(spec, area, obstacles, { width, height: 320 });

        expect(refline.bounds).toBeDefined();
        expect(detectCollision(refline.bounds!, obstacles[0])).toBe(false);
        // Default placement is the right end of the rule; the first clear
        // candidate is the other end, which flips the text anchor with it.
        expect(refline.label!.style.textAnchor).toBe('start');
        expect(refline.label!.x).toBeLessThan(area.x + area.width / 2);
      });

      it(`leaves an explicit labelOffset alone (${width}px, ${fontSize}px)`, () => {
        const area = chartAreaFor(width);
        const obstacles = rightHalfMarks(area);
        const spec = makeSpec([
          {
            type: 'refline',
            y: 25,
            label: 'avg: 25',
            fontSize,
            labelOffset: { dx: -20, dy: 12 },
          },
        ]);
        const [pinned] = run(spec, area, obstacles, { width, height: 320 });

        const unpinnedSpec = makeSpec([{ type: 'refline', y: 25, label: 'avg: 25', fontSize }]);
        const [unpinned] = run(unpinnedSpec, area, [], { width, height: 320 });

        // The pinned label sits exactly where the author put it: the auto
        // placement's position plus the offset, obstacles notwithstanding.
        expect(pinned.label!.x).toBeCloseTo(unpinned.label!.x - 20, 5);
        expect(pinned.label!.y).toBeCloseTo(unpinned.label!.y + 12, 5);
        expect(pinned.label!.style.textAnchor).toBe(unpinned.label!.style.textAnchor);
      });
    }
  }

  it('flips a vertical refline label across its own rule', () => {
    const width = 680;
    const area = chartAreaFor(width);
    // Cover the right side of the plot, where a vertical refline label defaults.
    const obstacles: PlacementObstacle[] = [
      { x: area.x, y: area.y, width: area.width, height: 40, kind: 'mark' },
    ];
    const spec = makeSpec([{ type: 'refline', x: 'Mar', label: 'launch' }]);
    const [refline] = run(spec, area, obstacles, { width, height: 320 });

    expect(detectCollision(refline.bounds!, obstacles[0])).toBe(false);
  });

  it('ignores area-fill obstacles', () => {
    const width = 680;
    const area = chartAreaFor(width);
    const fill: PlacementObstacle[] = [{ ...area, kind: 'area-fill' }];
    const spec = makeSpec([{ type: 'refline', y: 25, label: 'avg: 25' }]);

    const [moved] = run(spec, area, fill, { width, height: 320 });
    const [still] = run(spec, area, [], { width, height: 320 });

    expect(moved.label!.x).toBeCloseTo(still.label!.x, 5);
    expect(moved.label!.y).toBeCloseTo(still.label!.y, 5);
  });
});

describe('text annotations avoid refline labels', () => {
  for (const width of WIDTHS) {
    it(`an auto-placed callout does not overlap the refline label (${width}px)`, () => {
      const area = chartAreaFor(width);
      const spec = makeSpec([
        { type: 'refline', y: 25, label: 'avg: 25' },
        { type: 'text', x: 'Apr', y: 40, text: 'Record hiring' },
      ]);
      const [refline, text] = run(spec, area, [], { width, height: 320 });

      expect(refline.bounds).toBeDefined();
      expect(text.bounds).toBeDefined();
      expect(detectCollision(text.bounds!, refline.bounds!)).toBe(false);
    });

    it(`an explicitly anchored callout clears the refline label (${width}px)`, () => {
      const area = chartAreaFor(width);
      const spec = makeSpec([
        { type: 'refline', y: 25, label: 'avg: 25' },
        // Anchored (not auto), so it takes the greedy text pass rather than the
        // scored search -- the path that only sees the refline once its bounds
        // are seeded into `placedBounds`.
        { type: 'text', x: 'Apr', y: 25, text: 'Record hiring', anchor: 'right' },
      ]);
      const [refline, text] = run(spec, area, [], { width, height: 320 });

      expect(detectCollision(text.bounds!, refline.bounds!)).toBe(false);
    });
  }

  it('the greedy text pass moves a callout that would sit on the refline label', () => {
    // Differential: same chart, refline with and without a label. The only thing
    // that can move the callout is the refline label claiming its space.
    const width = 680;
    const area = chartAreaFor(width);
    const callout: Annotation = {
      type: 'text',
      x: 'Apr',
      y: 25,
      text: 'Record hiring',
      anchor: 'right',
    };

    const withLabel = run(
      makeSpec([{ type: 'refline', y: 25, label: 'avg: 25' }, callout]),
      area,
      [],
      {
        width,
        height: 320,
      },
    );
    const withoutLabel = run(makeSpec([{ type: 'refline', y: 25 }, callout]), area, [], {
      width,
      height: 320,
    });

    expect(detectCollision(withoutLabel[1].bounds!, withLabel[0].bounds!)).toBe(true);
    expect(detectCollision(withLabel[1].bounds!, withLabel[0].bounds!)).toBe(false);
    expect(withLabel[1].label!.y).not.toBeCloseTo(withoutLabel[1].label!.y, 1);
  });
});

describe('collectPinnedOverlapWarnings', () => {
  const width = 680;
  const area = chartAreaFor(width);
  const marks: PlacementObstacle[] = [{ ...area, kind: 'mark' }];

  it('warns for a pinned text annotation buried in the marks', () => {
    const specAnnotations: Annotation[] = [
      {
        type: 'text',
        x: 'Feb',
        y: 20,
        text: 'Pinned note',
        anchor: 'top',
        offset: { dx: 10, dy: 40 },
      },
    ];
    const spec = makeSpec(specAnnotations);
    const annotations = run(spec, area, [], { width, height: 320 });

    const warnings = collectPinnedOverlapWarnings(annotations, specAnnotations, marks);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Pinned note"');
    expect(warnings[0]).toContain('pinned by an explicit offset');
  });

  it('warns for a pinned refline label buried in the marks', () => {
    const specAnnotations: Annotation[] = [
      { type: 'refline', y: 25, label: 'avg: 25', labelOffset: { dx: -120, dy: 40 } },
    ];
    const spec = makeSpec(specAnnotations);
    const annotations = run(spec, area, [], { width, height: 320 });

    expect(collectPinnedOverlapWarnings(annotations, specAnnotations, marks)).toHaveLength(1);
  });

  it('stays silent for auto-placed annotations over the same marks', () => {
    const specAnnotations: Annotation[] = [
      { type: 'text', x: 'Feb', y: 20, text: 'Auto note' },
      { type: 'refline', y: 25, label: 'avg: 25' },
    ];
    const spec = makeSpec(specAnnotations);
    const annotations = run(spec, area, [], { width, height: 320 });

    expect(collectPinnedOverlapWarnings(annotations, specAnnotations, marks)).toEqual([]);
  });

  it('stays silent when a pinned block only clips a mark', () => {
    const specAnnotations: Annotation[] = [
      {
        type: 'text',
        x: 'Feb',
        y: 20,
        text: 'Pinned note',
        anchor: 'top',
        offset: { dx: 10, dy: 40 },
      },
    ];
    const spec = makeSpec(specAnnotations);
    const annotations = run(spec, area, [], { width, height: 320 });
    const bounds = annotations[0].bounds!;
    // A sliver under the block's bottom edge: well under the 25% threshold.
    const sliver: PlacementObstacle[] = [
      {
        x: bounds.x,
        y: bounds.y + bounds.height - 2,
        width: bounds.width,
        height: 20,
        kind: 'mark',
      },
    ];

    expect(collectPinnedOverlapWarnings(annotations, specAnnotations, sliver)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// compileChart integration (dev gate)
// ---------------------------------------------------------------------------

describe('compileChart pinned-overlap warning', () => {
  /** A callout parked on top of the bars by an offset the data has outgrown. */
  const pinnedSpec: ChartSpec = {
    mark: 'bar',
    data: [
      { month: 'Jan', jobs: 10 },
      { month: 'Feb', jobs: 20 },
      { month: 'Mar', jobs: 30 },
      { month: 'Apr', jobs: 40 },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'jobs', type: 'quantitative' },
    },
    annotations: [
      {
        type: 'text',
        x: 'Apr',
        y: 40,
        text: 'Pinned note',
        anchor: 'top',
        offset: { dx: -20, dy: 120 },
      },
    ],
  };

  it('fires only under dev, and not for the same annotation without an offset', () => {
    const warn = vi.fn();

    compileChart(pinnedSpec, { width: 680, height: 400, onWarn: warn });
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes('pinned by an explicit offset')),
    ).toEqual([]);

    compileChart(pinnedSpec, { width: 680, height: 400, dev: true, onWarn: warn });
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes('pinned by an explicit offset')).length,
    ).toBe(1);

    warn.mockClear();
    const autoSpec: ChartSpec = {
      ...pinnedSpec,
      annotations: [{ type: 'text', x: 'Apr', y: 40, text: 'Pinned note' }],
    };
    compileChart(autoSpec, { width: 680, height: 400, dev: true, onWarn: warn });
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes('pinned by an explicit offset')),
    ).toEqual([]);
  });
});
