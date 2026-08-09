import type { PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import { compile } from '../../../compiler';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random sequence (mulberry32) for repeatable fixtures. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ['Northeast', 'Midwest', 'South', 'West'];

/** Deterministic observation rows: income value, region lane, population size. */
function makeRows(count: number, seed = 1): Array<Record<string, unknown>> {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => ({
    income: Math.round(((rand() + rand()) / 2) * 120 + 20),
    region: REGIONS[i % REGIONS.length],
    pop: Math.round(rand() * 900 + 10),
  }));
}

function singleLaneSpec(count = 300) {
  return {
    mark: 'beeswarm' as const,
    data: makeRows(count),
    encoding: {
      x: { field: 'income', type: 'quantitative' as const },
    },
  };
}

function groupedSpec(count = 200) {
  return {
    mark: 'beeswarm' as const,
    data: makeRows(count),
    encoding: {
      x: { field: 'income', type: 'quantitative' as const },
      y: { field: 'region', type: 'nominal' as const },
      color: { field: 'region', type: 'nominal' as const },
    },
  };
}

const OPTIONS = { width: 800, height: 500 };

function pointMarks(layout: ReturnType<typeof compileChart>): PointMark[] {
  return layout.marks.filter((m): m is PointMark => m.type === 'point');
}

/** Assert every pair of circles keeps at least (r1 + r2) separation. */
function expectNoOverlap(marks: PointMark[]): void {
  const epsilon = 1e-6;
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      const dx = marks[i].cx - marks[j].cx;
      const dy = marks[i].cy - marks[j].cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(marks[i].r + marks[j].r - epsilon);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('beeswarm compile', () => {
  it('renders a 300-point single-lane swarm with zero overlapping circles', () => {
    const layout = compileChart(singleLaneSpec(300), OPTIONS);
    const marks = pointMarks(layout);
    expect(marks).toHaveLength(300);
    expectNoOverlap(marks);
  });

  it('compiles the same spec twice to identical positions (determinism)', () => {
    const spec = singleLaneSpec(300);
    const first = pointMarks(compileChart(spec, OPTIONS)).map((m) => [m.cx, m.cy, m.r]);
    const second = pointMarks(compileChart(spec, OPTIONS)).map((m) => [m.cx, m.cy, m.r]);
    expect(second).toEqual(first);
  });

  it('drops rows whose value is null or the field is missing', () => {
    // The validator rejects a quantitative field that carries non-numeric or
    // non-finite values (strings, NaN, Infinity), but tolerates null/undefined
    // (`val != null` skips them). Those null/missing rows must then be dropped
    // by the compute pass rather than producing NaN-positioned dots.
    const spec = {
      mark: 'beeswarm' as const,
      data: [
        { income: 40 },
        { income: null },
        { notIncome: 5 }, // field missing entirely -> undefined
        { income: 90 },
      ],
      encoding: {
        x: { field: 'income', type: 'quantitative' as const },
      },
    };
    const marks = pointMarks(compileChart(spec, OPTIONS));
    // Only the two rows with finite values (40 and 90) survive.
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(Number.isFinite(mark.cx)).toBe(true);
      expect(Number.isFinite(mark.cy)).toBe(true);
    }
  });

  it('renders only the value axis for a single-lane swarm', () => {
    const layout = compileChart(singleLaneSpec(60), OPTIONS);
    expect(layout.axes.x?.ticks.length).toBeGreaterThan(0);
    expect(layout.axes.y).toBeUndefined();
  });

  it('centers a single-lane horizontal swarm on the middle of the chart area', () => {
    const layout = compileChart(singleLaneSpec(1), OPTIONS);
    const [mark] = pointMarks(layout);
    expect(mark.cy).toBeCloseTo(layout.area.y + layout.area.height / 2, 6);
  });

  it('renders 4 grouped lanes as non-overlapping swarms with lane labels', () => {
    const layout = compileChart(groupedSpec(200), OPTIONS);
    const marks = pointMarks(layout);
    expect(marks).toHaveLength(200);
    expectNoOverlap(marks);

    // One swarm per lane: 4 distinct lane groups in the data
    const lanes = new Set(marks.map((m) => String(m.data.region)));
    expect(lanes).toEqual(new Set(REGIONS));

    // Lane labels render on the band axis
    const tickLabels = (layout.axes.y?.ticks ?? []).map((t) => t.label);
    for (const region of REGIONS) {
      expect(tickLabels).toContain(region);
    }

    // Each lane's dots cluster around its own band center: lanes must not
    // share a mean cross-axis position.
    const meansByLane = REGIONS.map((region) => {
      const laneMarks = marks.filter((m) => m.data.region === region);
      return laneMarks.reduce((sum, m) => sum + m.cy, 0) / laneMarks.length;
    });
    const uniqueMeans = new Set(meansByLane.map((m) => Math.round(m / 10)));
    expect(uniqueMeans.size).toBe(REGIONS.length);
  });

  it('renders a vertical swarm when y is quantitative', () => {
    const data = [
      { income: 20, region: 'West' },
      { income: 140, region: 'West' },
    ];
    const layout = compileChart(
      {
        mark: 'beeswarm' as const,
        data,
        encoding: {
          y: { field: 'income', type: 'quantitative' as const },
          x: { field: 'region', type: 'nominal' as const },
        },
      },
      OPTIONS,
    );
    const marks = pointMarks(layout);
    expect(marks).toHaveLength(2);
    // SVG y grows downward: the larger value sits higher (smaller cy)
    const low = marks.find((m) => m.data.income === 20)!;
    const high = marks.find((m) => m.data.income === 140)!;
    expect(high.cy).toBeLessThan(low.cy);
  });

  it('sizes dots from the size encoding and keeps them collision-free', () => {
    const spec = {
      ...groupedSpec(120),
      encoding: {
        ...groupedSpec(120).encoding,
        size: { field: 'pop', type: 'quantitative' as const },
      },
    };
    const layout = compileChart(spec, OPTIONS);
    const marks = pointMarks(layout);
    const radii = new Set(marks.map((m) => m.r));
    expect(radii.size).toBeGreaterThan(1);
    for (const mark of marks) {
      expect(mark.r).toBeGreaterThanOrEqual(2);
      expect(mark.r).toBeLessThanOrEqual(10);
    }
    expectNoOverlap(marks);
  });

  it('stamps stable unique keys on every dot', () => {
    const layout = compileChart(singleLaneSpec(100), OPTIONS);
    const keys = pointMarks(layout).map((m) => m.key);
    expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('encoding.key keys are stable across layouts when values change', () => {
    // The property data-update transitions depend on: with an explicit
    // encoding.key, a dot's key must survive a value change so the transition
    // pairs it as a move, not exit+enter. (The lane|value fallback key does
    // not have this property; see plans/completed docs.)
    const keyedSpec = (shift: number) => ({
      mark: 'beeswarm' as const,
      data: makeRows(60).map((row, i) => ({
        ...row,
        entity: `e${i}`,
        income: (row.income as number) + shift,
      })),
      encoding: {
        x: { field: 'income', type: 'quantitative' as const },
        y: { field: 'region', type: 'nominal' as const },
        key: { field: 'entity', type: 'nominal' as const },
      },
    });

    const layoutA = compileChart(keyedSpec(0), OPTIONS);
    const layoutB = compileChart(keyedSpec(17), OPTIONS);

    const keyByEntity = (layout: ReturnType<typeof compileChart>) =>
      new Map(pointMarks(layout).map((m) => [(m.data as { entity: string }).entity, m.key]));

    const keysA = keyByEntity(layoutA);
    const keysB = keyByEntity(layoutB);
    expect(keysA.size).toBe(60);
    expect(keysB.size).toBe(60);
    for (const [entity, key] of keysA) {
      // Same entity, same key, no dedupe-suffix drift.
      expect(keysB.get(entity)).toBe(key);
      expect(key).toBe(entity);
    }
  });

  it('produces tooltips and a11y coverage for every dot', () => {
    const layout = compileChart(groupedSpec(40), OPTIONS);
    const marks = pointMarks(layout);
    expect(layout.tooltipDescriptors.size).toBe(marks.length);
    expect(layout.a11y.keyboardNavigable).toBe(true);
    expect(layout.a11y.altText).toContain('Beeswarm chart');
    expect(layout.a11y.altText).toContain('distribution of income by region');
    for (const mark of marks) {
      expect(mark.aria.label).toContain('income=');
    }
  });
});

describe('beeswarm validation', () => {
  it('rejects a spec with two quantitative axes', () => {
    expect(() =>
      compileChart(
        {
          mark: 'beeswarm',
          data: [{ a: 1, b: 2 }],
          encoding: {
            x: { field: 'a', type: 'quantitative' },
            y: { field: 'b', type: 'quantitative' },
          },
        },
        OPTIONS,
      ),
    ).toThrow(/only one quantitative axis/);
  });

  it('rejects a spec with no positional channel', () => {
    expect(() =>
      compileChart({ mark: 'beeswarm', data: [{ a: 1 }], encoding: {} }, OPTIONS),
    ).toThrow(/quantitative encoding\.x or encoding\.y/);
  });

  it('rejects a spec where no declared axis is quantitative', () => {
    expect(() =>
      compileChart(
        {
          mark: 'beeswarm',
          data: [{ a: 'x', b: 'y' }],
          encoding: {
            x: { field: 'a', type: 'nominal' },
            y: { field: 'b', type: 'nominal' },
          },
        },
        OPTIONS,
      ),
    ).toThrow(/requires one quantitative axis/);
  });
});

describe('beeswarm overplotting guard', () => {
  it('warns past the ~2000-point budget and suggests alternatives', () => {
    const { warnings } = compile(singleLaneSpec(2001));
    const warning = warnings.find((w) => w.includes('beeswarm'));
    expect(warning).toBeDefined();
    expect(warning).toContain('2001 data points');
    expect(warning).toContain("mark: 'tick'");
    expect(warning).toContain('histogram');
  });

  it('stays quiet at or under the budget', () => {
    const { warnings } = compile(singleLaneSpec(2000));
    expect(warnings.filter((w) => w.includes('beeswarm'))).toEqual([]);
  });

  it('never escalates the budget to an error: the chart still compiles', () => {
    const layout = compileChart(singleLaneSpec(2001), OPTIONS);
    expect(pointMarks(layout)).toHaveLength(2001);
  });
});
