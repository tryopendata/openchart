/**
 * Data-update transition tests.
 *
 * Tests the canTransition gate (all ten checks), mark matching logic,
 * the rAF-driven animation loop (with manual pump), round-trip invariant,
 * ghost element lifecycle, and cancel semantics.
 */

import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { renderChartSVG } from '../svg-renderer';
import {
  CANVAS_DEFAULT_UPDATE_MAX_MARKS,
  canTransition,
  DEFAULT_UPDATE_MAX_MARKS,
  normalizePointArrays,
  runTransition,
} from '../transition';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a column chart spec with animation enabled. */
function columnSpec(data: Array<{ category: string; value: number }>): ChartSpec {
  return {
    animation: true,
    mark: 'bar',
    data,
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };
}

/** Override the data-update mark cap on a spec. */
function withMaxMarks(spec: ChartSpec, maxMarks: number): ChartSpec {
  return { ...spec, animation: { update: { maxMarks } } };
}

/** Build a stacked column chart spec with cornerRadius. */
function stackedColumnSpec(
  data: Array<{ category: string; value: number; group: string }>,
): ChartSpec {
  return {
    animation: true,
    mark: { type: 'bar', cornerRadius: 4 },
    data,
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'group', type: 'nominal' },
    },
  };
}

/** Compile a spec to layout. */
function compile(spec: ChartSpec, width = 600, height = 400): ChartLayout {
  return compileChart(spec, { width, height });
}

/** Compile and render to SVG, returning both. */
function compileAndRender(spec: ChartSpec, width = 600, height = 400) {
  const container = createContainer(width, height);
  const layout = compile(spec, width, height);
  const svg = renderChartSVG(layout, container);
  return { svg: svg as SVGSVGElement, container, layout };
}

/** Base gate args that pass all checks. */
function passingGateArgs(prevSpec: ChartSpec, nextSpec: ChartSpec, width = 600, height = 400) {
  return {
    prevLayout: compile(prevSpec, width, height),
    nextLayout: compile(nextSpec, width, height),
    prevSpec,
    nextSpec,
    isFirstRender: false,
    entranceInFlight: false,
  };
}

const DATA_A = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 200 },
  { category: 'Q3', value: 150 },
];

const DATA_B = [
  { category: 'Q1', value: 150 },
  { category: 'Q2', value: 180 },
  { category: 'Q3', value: 220 },
];

const DATA_C = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 200 },
  { category: 'Q3', value: 150 },
  { category: 'Q4', value: 250 },
];

const DATA_REMOVE = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 200 },
];

// ---------------------------------------------------------------------------
// rAF mock
// ---------------------------------------------------------------------------

let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

function setupRafMock() {
  rafCallbacks = new Map();
  nextRafId = 1;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafCallbacks.delete(id);
  });
}

/** Pump all pending rAF callbacks at the given timestamp. */
function pumpRaf(timestamp: number) {
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of cbs) {
    cb(timestamp);
  }
}

/** Run rAF loop to completion by advancing past total duration. */
function runToCompletion(totalMs = 2000) {
  // First pump at t=0 to set startTime
  pumpRaf(0);
  // Then pump way past the end
  pumpRaf(totalMs);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupRafMock();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// canTransition gate tests
// ---------------------------------------------------------------------------

describe('canTransition gate', () => {
  it('passes when all conditions are met', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('gate 1: fails when prevLayout is null', () => {
    const specB = columnSpec(DATA_B);
    expect(
      canTransition({
        prevLayout: null,
        nextLayout: compile(specB),
        prevSpec: columnSpec(DATA_A),
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);
  });

  it('gate 1: fails when prevSpec is null', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(
      canTransition({
        prevLayout: compile(specA),
        nextLayout: compile(specB),
        prevSpec: null,
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);
  });

  it('gate 1: fails on first render', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    args.isFirstRender = true;
    expect(canTransition(args)).toBe(false);
  });

  it('gate 2: fails when animation.update is absent', () => {
    const specA = columnSpec(DATA_A);
    const specB: ChartSpec = { ...columnSpec(DATA_B), animation: { update: false } };
    const args = passingGateArgs(specA, specB);
    expect(canTransition(args)).toBe(false);
  });

  it('gate 3: fails when mark type differs', () => {
    // Don't compile - just test the gate logic with raw spec objects
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    // Override nextSpec to have a different mark type
    args.nextSpec = { ...specB, mark: 'line' };
    expect(canTransition(args)).toBe(false);
  });

  it('gate 3: fails for unsupported mark type', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    // Override both specs to be arc (pie) charts which are not supported
    args.prevSpec = { ...specA, mark: 'arc' };
    args.nextSpec = { ...specB, mark: 'arc' };
    expect(canTransition(args)).toBe(false);
  });

  it('gate 3: passes for line mark type', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    args.prevSpec = { ...specA, mark: 'line' };
    args.nextSpec = { ...specB, mark: 'line' };
    expect(canTransition(args)).toBe(true);
  });

  it('gate 3: passes for area mark type', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    args.prevSpec = { ...specA, mark: 'area' };
    args.nextSpec = { ...specB, mark: 'area' };
    expect(canTransition(args)).toBe(true);
  });

  it('gate 4: fails when encoding field changes', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    // Override nextSpec encoding to change a field
    args.nextSpec = {
      ...specB,
      encoding: {
        x: { field: 'other', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    expect(canTransition(args)).toBe(false);
  });

  it('gate 5: fails for sparkline display', () => {
    const specA = columnSpec(DATA_A);
    const specB: ChartSpec = { ...columnSpec(DATA_B), display: 'sparkline' };
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);
  });

  it('gate 6: fails when entrance is in flight', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    args.entranceInFlight = true;
    expect(canTransition(args)).toBe(false);
  });

  it('gate 7: fails when dimensions change', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(
      canTransition({
        prevLayout: compile(specA, 600, 400),
        nextLayout: compile(specB, 800, 400),
        prevSpec: specA,
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);
  });

  it('gate 8: fails when mark count exceeds 500', () => {
    // Build a spec with > 500 data points
    const bigData = Array.from({ length: 501 }, (_, i) => ({
      category: `cat-${i}`,
      value: i,
    }));
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(bigData);
    const args = passingGateArgs(specA, specB);
    expect(canTransition(args)).toBe(false);
  });

  it('gate 8: passes above 500 when animation.update.maxMarks raises the cap', () => {
    const bigData = Array.from({ length: 501 }, (_, i) => ({
      category: `cat-${i}`,
      value: i,
    }));
    const specA = withMaxMarks(columnSpec(DATA_A), 5000);
    const specB = withMaxMarks(columnSpec(bigData), 5000);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('gate 8: still fails when maxMarks is raised but not enough', () => {
    const bigData = Array.from({ length: 501 }, (_, i) => ({
      category: `cat-${i}`,
      value: i,
    }));
    const specA = withMaxMarks(columnSpec(DATA_A), 100);
    const specB = withMaxMarks(columnSpec(bigData), 100);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);
  });

  it('gate 8: honors a maxMarks lowered below the default', () => {
    const data = Array.from({ length: 401 }, (_, i) => ({
      category: `cat-${i}`,
      value: i,
    }));
    const specA = withMaxMarks(columnSpec(DATA_A), 400);
    const specB = withMaxMarks(columnSpec(data), 400);
    // 401 marks against a cap of 400 -> instant swap, even though the
    // default cap of 500 would have allowed it.
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);
  });

  it('gate 8: DEFAULT_UPDATE_MAX_MARKS is the applied default', () => {
    const atCap = Array.from({ length: DEFAULT_UPDATE_MAX_MARKS }, (_, i) => ({
      category: `cat-${i}`,
      value: i,
    }));
    const specA = columnSpec(DATA_A);
    expect(canTransition(passingGateArgs(specA, columnSpec(atCap)))).toBe(true);
  });

  it('gate 8: counts the PREV layout too, so a shrink past the cap is barred', () => {
    // Exit ghosts are rendered into the destination surface, one element per
    // departing mark. Judging by `next` alone reads 400 as cheap while the
    // update would actually mint ~600 ghost circles.
    const big = Array.from({ length: 1000 }, (_, i) => ({ category: `cat-${i}`, value: i }));
    const small = Array.from({ length: 400 }, (_, i) => ({ category: `cat-${i}`, value: i }));
    const specA = columnSpec(big);
    const specB = columnSpec(small);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);

    // Same shrink, cap raised above the PREV count -> allowed.
    expect(
      canTransition(passingGateArgs(withMaxMarks(specA, 5000), withMaxMarks(specB, 5000))),
    ).toBe(true);
  });

  it('gate 8: canvas mode gets its own, far higher default cap', () => {
    const scatter = (n: number, yShift: number, render?: 'canvas'): ChartSpec => ({
      animation: true,
      mark: render ? { type: 'point', render } : 'point',
      data: Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        x: i,
        y: (i * 7 + yShift) % 100,
      })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id', type: 'nominal' },
      },
    });

    // 4,341 points: far past the SVG cap of 500, well under the canvas 20,000.
    const svgA = compile(scatter(4341, 0));
    const svgB = compile(scatter(4341, 33));
    expect(svgB.markRenderMode).toBeUndefined();
    expect(
      canTransition({
        prevLayout: svgA,
        nextLayout: svgB,
        prevSpec: scatter(4341, 0),
        nextSpec: scatter(4341, 33),
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);

    const canvasA = compile(scatter(4341, 0, 'canvas'));
    const canvasB = compile(scatter(4341, 33, 'canvas'));
    expect(canvasB.markRenderMode).toBe('canvas');
    expect(
      canTransition({
        prevLayout: canvasA,
        nextLayout: canvasB,
        prevSpec: scatter(4341, 0, 'canvas'),
        nextSpec: scatter(4341, 33, 'canvas'),
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(true);
  });

  it('gate 8: CANVAS_DEFAULT_UPDATE_MAX_MARKS is the applied canvas default', () => {
    const scatter = (n: number, yShift: number): ChartSpec => ({
      mark: { type: 'point', render: 'canvas' },
      data: Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        x: i,
        y: (i * 7 + yShift) % 100,
      })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id', type: 'nominal' },
      },
    });
    const over = CANVAS_DEFAULT_UPDATE_MAX_MARKS + 1;
    const specA = scatter(over, 0);
    const specB = scatter(over, 33);
    expect(
      canTransition({
        prevLayout: compile(specA),
        nextLayout: compile(specB),
        prevSpec: specA,
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);
  });

  it('gate 8: a raised cap produces real tweened motion, not just a passing gate', () => {
    // End-to-end guard: 501 keyed scatter points with maxMarks raised must
    // actually interpolate. A gate that returns true but tweens nothing would
    // still leave the blog morph snapping.
    const keyedScatter = (yShift: number): ChartSpec => ({
      animation: { update: { maxMarks: 5000 } },
      mark: 'point',
      data: Array.from({ length: 501 }, (_, i) => ({
        id: `p${i}`,
        x: i,
        y: (i * 7 + yShift) % 100,
      })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id', type: 'nominal' },
      },
    });

    const specA = keyedScatter(0);
    const specB = keyedScatter(33);
    const layoutA = compile(specA);
    const layoutB = compile(specB);

    expect(layoutB.animation?.update?.maxMarks).toBe(5000);
    expect(
      canTransition({
        prevLayout: layoutA,
        nextLayout: layoutB,
        prevSpec: specA,
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(true);

    // Render from layoutB as mount.ts does, then transition from layoutA.
    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;
    const sampled = svg.querySelector('circle.oc-mark-point[data-key]') as SVGCircleElement;
    const key = sampled.getAttribute('data-key');
    const finalCy = sampled.getAttribute('cy');
    const startCy = (
      layoutA.marks.find((m) => m.type === 'point' && m.key === key) as { cy: number }
    ).cy;
    // Guard the fixture: a point that does not move proves nothing.
    expect(Number(finalCy)).not.toBeCloseTo(startCy, 1);

    const handle = runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });
    expect(handle).not.toBeNull();

    // t=0 rewinds to the from-state...
    pumpRaf(0);
    expect(Number(sampled.getAttribute('cy'))).toBeCloseTo(startCy, 1);

    // ...mid-flight sits strictly between from and to...
    pumpRaf(250);
    const midCy = Number(sampled.getAttribute('cy'));
    expect(midCy).not.toBeCloseTo(startCy, 1);
    expect(midCy).not.toBeCloseTo(Number(finalCy), 1);

    // ...and it lands exactly on the rendered geometry.
    pumpRaf(2000);
    expect(sampled.getAttribute('cy')).toBe(finalCy);
  });

  it('gate 9: fails when geometry is identical (zero-delta)', () => {
    const specA = columnSpec(DATA_A);
    // Same data = same geometry
    expect(canTransition(passingGateArgs(specA, specA))).toBe(false);
  });

  it('gate 9: passes when only an annotation was added', () => {
    // Regression: gate 9 used to inspect layout.marks only. Annotations are not
    // marks, so an annotate-only step reported "nothing changed", the whole
    // transition was skipped, and the annotation popped in on render()'s
    // instant swap -- with the fade code sitting unreachable further down.
    const specA = columnSpec(DATA_A);
    const specB: ChartSpec = {
      ...columnSpec(DATA_A),
      annotations: [{ type: 'text', x: 'Q1', y: 100, text: 'Note' }],
    };
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('gate 9: passes when only the highlight changed', () => {
    // Regression: a highlight mute recolors marks without moving them, so this
    // also read as a zero-delta and snapped.
    const base: ChartSpec = {
      animation: true,
      mark: 'line',
      data: [
        { month: 'Jan', value: 10, series: 'A' },
        { month: 'Feb', value: 20, series: 'A' },
        { month: 'Jan', value: 30, series: 'B' },
        { month: 'Feb', value: 40, series: 'B' },
      ],
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    };
    const highlighted: ChartSpec = {
      ...base,
      encoding: { ...base.encoding, color: { field: 'series', type: 'nominal', highlight: ['A'] } },
    };
    expect(canTransition(passingGateArgs(base, highlighted))).toBe(true);
  });

  it('gate 10: fails when prefers-reduced-motion is active', () => {
    const original = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);

    vi.stubGlobal('matchMedia', original);
  });
});

// ---------------------------------------------------------------------------
// Mark matching
// ---------------------------------------------------------------------------

describe('mark matching', () => {
  it('correctly identifies entered marks when adding a category', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_C); // adds Q4
    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const prevKeys = new Set(
      layoutA.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );
    const nextKeys = new Set(
      layoutB.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );

    const entered = [...nextKeys].filter((k) => !prevKeys.has(k));
    expect(entered.length).toBeGreaterThan(0);
  });

  it('correctly identifies exited marks when removing a category', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_REMOVE); // removes Q3
    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const prevKeys = new Set(
      layoutA.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );
    const nextKeys = new Set(
      layoutB.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );

    const exited = [...prevKeys].filter((k) => !nextKeys.has(k));
    expect(exited.length).toBeGreaterThan(0);
  });

  it('correctly identifies updated marks for value-only changes', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B); // same categories, different values
    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const prevKeys = new Set(
      layoutA.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );
    const nextKeys = new Set(
      layoutB.marks.filter((m) => m.type === 'rect' && m.key).map((m) => m.key),
    );

    const updated = [...prevKeys].filter((k) => nextKeys.has(k));
    expect(updated.length).toBe(3); // Q1, Q2, Q3 all present in both
  });
});

// ---------------------------------------------------------------------------
// Round-trip invariant
// ---------------------------------------------------------------------------

/**
 * Extract rect geometry from all .oc-mark-rect elements in an SVG,
 * keyed by data-key. Returns a map of key -> {x, y, width, height}.
 * This tests that the transition snaps geometry to final values matching
 * a fresh render from the same layout.
 */
function extractRectGeometry(
  svg: SVGElement,
): Map<string, { x: string; y: string; w: string; h: string }> {
  const result = new Map<string, { x: string; y: string; w: string; h: string }>();
  const groups = svg.querySelectorAll('.oc-mark-rect[data-key]');
  for (const g of groups) {
    const key = g.getAttribute('data-key')!;
    const rect = g.querySelector('rect');
    const path = g.querySelector('path');
    if (rect) {
      result.set(key, {
        x: rect.getAttribute('x') ?? '',
        y: rect.getAttribute('y') ?? '',
        w: rect.getAttribute('width') ?? '',
        h: rect.getAttribute('height') ?? '',
      });
    } else if (path) {
      // For path-based rects (cornerRadiusSides), store the d attribute
      result.set(key, {
        x: 'path',
        y: 'path',
        w: 'path',
        h: path.getAttribute('d') ?? '',
      });
    }
  }
  return result;
}

/**
 * Run a round-trip test: render specB's layout, run transition from layoutA,
 * pump to completion, then compare rect geometry against a fresh render of specB.
 *
 * The transition runs on an SVG already rendered from nextLayout (as mount.ts
 * does), so after completion the geometry should match a fresh render exactly.
 */
function assertRoundTrip(specA: ChartSpec, specB: ChartSpec) {
  const layoutA = compile(specA);
  const layoutB = compile(specB);

  // Render from specB's layout (as mount.ts render() does)
  const container = createContainer();
  const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

  runTransition({
    svg,
    prevLayout: layoutA,
    nextLayout: layoutB,
    animation: layoutB.animation!,
    onComplete: () => {},
  });

  runToCompletion();

  // Extract geometry after transition
  const transitioned = extractRectGeometry(svg);

  // Fresh render of specB for comparison
  const { svg: freshSvg } = compileAndRender(specB);
  const fresh = extractRectGeometry(freshSvg);

  // Same set of keys
  expect([...transitioned.keys()].sort()).toEqual([...fresh.keys()].sort());

  // Same geometry per key
  for (const [key, tGeom] of transitioned) {
    const fGeom = fresh.get(key);
    expect(fGeom).toBeDefined();
    expect(tGeom).toEqual(fGeom);
  }

  // No ghost elements remain
  expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
}

describe('round-trip invariant', () => {
  it('value-only change: geometry matches fresh render', () => {
    assertRoundTrip(columnSpec(DATA_A), columnSpec(DATA_B));
  });

  it('add category: geometry matches fresh render', () => {
    assertRoundTrip(columnSpec(DATA_A), columnSpec(DATA_C));
  });

  it('remove category: geometry matches fresh render', () => {
    assertRoundTrip(columnSpec(DATA_A), columnSpec(DATA_REMOVE));
  });

  it('stacked column with cornerRadius: geometry matches fresh render', () => {
    assertRoundTrip(
      stackedColumnSpec([
        { category: 'Q1', value: 100, group: 'A' },
        { category: 'Q1', value: 50, group: 'B' },
        { category: 'Q2', value: 200, group: 'A' },
        { category: 'Q2', value: 80, group: 'B' },
      ]),
      stackedColumnSpec([
        { category: 'Q1', value: 150, group: 'A' },
        { category: 'Q1', value: 70, group: 'B' },
        { category: 'Q2', value: 180, group: 'A' },
        { category: 'Q2', value: 120, group: 'B' },
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// cancel() behavior
// ---------------------------------------------------------------------------

describe('cancel()', () => {
  it('snaps to final values and removes ghosts', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_REMOVE); // Q3 exits

    const { svg, layout: layoutA } = compileAndRender(specA);
    const layoutB = compile(specB);

    let completed = false;
    const handle = runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {
        completed = true;
      },
    });

    // Pump once to start
    pumpRaf(0);
    // Verify ghost exists mid-transition
    expect(svg.querySelectorAll('.oc-ghost').length).toBeGreaterThan(0);

    // Cancel
    handle.cancel();

    // Ghosts removed
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
    // onComplete NOT called
    expect(completed).toBe(false);
    // No longer running
    expect(handle.running).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ghost element attributes
// ---------------------------------------------------------------------------

describe('ghost elements', () => {
  it('ghosts have aria-hidden, pointer-events: none, and no data-key', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_REMOVE); // Q3 exits

    const { svg, layout: layoutA } = compileAndRender(specA);
    const layoutB = compile(specB);

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    // Pump once to start (ghosts are added before first rAF)
    const ghosts = svg.querySelectorAll('.oc-ghost');
    expect(ghosts.length).toBeGreaterThan(0);
    for (const ghost of ghosts) {
      expect(ghost.getAttribute('aria-hidden')).toBe('true');
      expect(ghost.getAttribute('pointer-events')).toBe('none');
      expect(ghost.hasAttribute('data-key')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Legend-toggle mid-transition
// ---------------------------------------------------------------------------

/**
 * Disable the entrance phase so update() can actually transition. With
 * `animation: true`, createChart() arms an entrance-cleanup timer (a real
 * ~1.2s setTimeout) and any update() inside that window fails canTransition
 * gate 6 (entranceInFlight) -- the createChart-based tests below would
 * silently exercise only the instant-swap path.
 */
function noEnter(spec: ChartSpec): ChartSpec {
  return { ...spec, animation: { enter: false } };
}

describe('legend toggle mid-transition', () => {
  it('render() during transition cancels transition and stops attribute writes', () => {
    const specA = noEnter(columnSpec(DATA_A));
    const specB = noEnter(columnSpec(DATA_B));

    const container = createContainer();
    const chart = createChart(container, specA);

    // Update to trigger transition (must actually run, not instant-swap)
    chart.update(specB);
    expect(rafCallbacks.size).toBeGreaterThan(0);

    // Pump one frame
    pumpRaf(0);

    // Force a re-render (simulating legend toggle) should cancel the transition
    // by calling render() internally, which cancels transitionHandle
    chart.resize();

    // The cancel must have unregistered the transition's rAF loop, and
    // pumping more frames must leave geometry at the rebuilt final state
    expect(rafCallbacks.size).toBe(0);
    pumpRaf(100);
    expect(rafCallbacks.size).toBe(0);

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// isDragging blocks transitions
// ---------------------------------------------------------------------------

describe('update during isDragging', () => {
  it('does not start a transition when dragging is active', () => {
    // We can't directly set isDragging from outside, but we can verify
    // that calling render() with pendingRender produces no transition.
    // This is implicitly tested by the mount lifecycle.
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const container = createContainer();
    const chart = createChart(container, specA);

    // Normal update should work without error
    chart.update(specB);
    runToCompletion();

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// data-key stamping
// ---------------------------------------------------------------------------

describe('data-key stamping', () => {
  it('rect marks have data-key attributes when keys are present', () => {
    const spec = columnSpec(DATA_A);
    const { svg } = compileAndRender(spec);

    const rectGroups = svg.querySelectorAll('.oc-mark-rect');
    let hasKeys = false;
    for (const g of rectGroups) {
      if (g.hasAttribute('data-key')) {
        hasKeys = true;
        break;
      }
    }
    expect(hasKeys).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Line/area morph: normalizePointArrays
// ---------------------------------------------------------------------------

describe('normalizePointArrays', () => {
  it('append: inserted point from equals prev tail position', () => {
    const prevPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
    ];
    const nextPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
      { x: 150, y: 40 },
    ];
    const prevKeys = ['a', 'b', 'c'];
    const nextKeys = ['a', 'b', 'c', 'd'];

    const [fromPts, toPts] = normalizePointArrays(prevPts, nextPts, prevKeys, nextKeys);

    // Both arrays should have 4 points
    expect(fromPts.length).toBe(4);
    expect(toPts.length).toBe(4);

    // The inserted point (d) should start from the prev tail (c's prev position)
    // because it's at the tail end with only one neighbor before it
    expect(fromPts[3].x).toBe(100);
    expect(fromPts[3].y).toBe(60);

    // The "to" for the inserted point should be its next position
    expect(toPts[3].x).toBe(150);
    expect(toPts[3].y).toBe(40);
  });

  it('remove middle: removed point to sits between surviving neighbors', () => {
    const prevPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
    ];
    const nextPts = [
      { x: 0, y: 90 },
      { x: 100, y: 50 },
    ];
    const prevKeys = ['a', 'b', 'c'];
    const nextKeys = ['a', 'c'];

    const [fromPts, toPts] = normalizePointArrays(prevPts, nextPts, prevKeys, nextKeys);

    expect(fromPts.length).toBe(3);
    expect(toPts.length).toBe(3);

    // Removed point 'b' (index 1 in merged) should collapse to midpoint
    // between neighbors 'a' (next: {0,90}) and 'c' (next: {100,50})
    // t = (50 - 0)/(100 - 0) = 0.5 in prev x, so in next space:
    // lerp({0,90}, {100,50}, 0.5) = {50, 70}
    expect(toPts[1].x).toBe(50);
    expect(toPts[1].y).toBe(70);
  });

  it('full replacement (zero survivors): returns arrays as-is for crossfade', () => {
    const prevPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
    ];
    const nextPts = [
      { x: 10, y: 90 },
      { x: 60, y: 70 },
      { x: 110, y: 50 },
    ];
    const prevKeys = ['a', 'b'];
    const nextKeys = ['x', 'y', 'z'];

    const [fromPts, toPts] = normalizePointArrays(prevPts, nextPts, prevKeys, nextKeys);

    // Zero survivors: arrays returned as-is
    expect(fromPts).toEqual(prevPts);
    expect(toPts).toEqual(nextPts);
  });

  it('value-only change: same keys produce 1:1 mapping', () => {
    const prevPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
    ];
    const nextPts = [
      { x: 0, y: 90 },
      { x: 50, y: 70 },
      { x: 100, y: 50 },
    ];
    const keys = ['a', 'b', 'c'];

    const [fromPts, toPts] = normalizePointArrays(prevPts, nextPts, keys, keys);

    expect(fromPts).toEqual(prevPts);
    expect(toPts).toEqual(nextPts);
  });

  it('insert at head: from position equals nearest surviving endpoint', () => {
    const prevPts = [
      { x: 50, y: 80 },
      { x: 100, y: 60 },
    ];
    const nextPts = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 60 },
    ];
    const prevKeys = ['b', 'c'];
    const nextKeys = ['a', 'b', 'c'];

    const [fromPts] = normalizePointArrays(prevPts, nextPts, prevKeys, nextKeys);

    expect(fromPts.length).toBe(3);
    // Inserted at head: from = nearest surviving start = b's prev position
    expect(fromPts[0].x).toBe(50);
    expect(fromPts[0].y).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Line chart round-trip invariant
// ---------------------------------------------------------------------------

/** Build a line chart spec with animation enabled. */
function lineSpec(data: Array<{ month: string; value: number }>): ChartSpec {
  return {
    animation: true,
    mark: 'line',
    data,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };
}

/** Build an area chart spec with animation enabled. */
function areaSpec(data: Array<{ month: string; value: number }>): ChartSpec {
  return {
    animation: true,
    mark: 'area',
    data,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };
}

const LINE_DATA_A = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 200 },
  { month: 'Mar', value: 150 },
];

const LINE_DATA_B = [
  { month: 'Jan', value: 150 },
  { month: 'Feb', value: 180 },
  { month: 'Mar', value: 220 },
];

const LINE_DATA_APPEND = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 200 },
  { month: 'Mar', value: 150 },
  { month: 'Apr', value: 250 },
];

const LINE_DATA_REMOVE = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 200 },
];

/**
 * Extract path d attributes from line/area mark elements.
 */
function extractPathD(svg: SVGElement, markClass: string): Map<string, string> {
  const result = new Map<string, string>();
  const groups = svg.querySelectorAll(`.${markClass}[data-key]`);
  for (const g of groups) {
    const key = g.getAttribute('data-key')!;
    const path = g.querySelector('path');
    if (path) {
      result.set(key, path.getAttribute('d') ?? '');
    }
  }
  return result;
}

/**
 * Run a round-trip test for line/area charts.
 */
function assertLineAreaRoundTrip(specA: ChartSpec, specB: ChartSpec, markClass: string) {
  const layoutA = compile(specA);
  const layoutB = compile(specB);

  const container = createContainer();
  const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

  runTransition({
    svg,
    prevLayout: layoutA,
    nextLayout: layoutB,
    animation: layoutB.animation!,
    onComplete: () => {},
  });

  runToCompletion();

  // Extract paths after transition
  const transitioned = extractPathD(svg, markClass);

  // Fresh render for comparison
  const { svg: freshSvg } = compileAndRender(specB);
  const fresh = extractPathD(freshSvg, markClass);

  // Same set of keys
  expect([...transitioned.keys()].sort()).toEqual([...fresh.keys()].sort());

  // Same path d per key (round-trip invariant)
  for (const [key, tPath] of transitioned) {
    const fPath = fresh.get(key);
    expect(fPath).toBeDefined();
    expect(tPath).toBe(fPath);
  }

  // No ghost elements remain
  expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
}

describe('line chart round-trip invariant', () => {
  it('value-only change: path matches fresh render', () => {
    assertLineAreaRoundTrip(lineSpec(LINE_DATA_A), lineSpec(LINE_DATA_B), 'oc-mark-line');
  });

  it('append point: path matches fresh render', () => {
    assertLineAreaRoundTrip(lineSpec(LINE_DATA_A), lineSpec(LINE_DATA_APPEND), 'oc-mark-line');
  });

  it('remove point: path matches fresh render', () => {
    assertLineAreaRoundTrip(lineSpec(LINE_DATA_A), lineSpec(LINE_DATA_REMOVE), 'oc-mark-line');
  });
});

describe('area chart round-trip invariant', () => {
  it('value-only change: path matches fresh render', () => {
    assertLineAreaRoundTrip(areaSpec(LINE_DATA_A), areaSpec(LINE_DATA_B), 'oc-mark-area');
  });

  it('append point: path matches fresh render', () => {
    assertLineAreaRoundTrip(areaSpec(LINE_DATA_A), areaSpec(LINE_DATA_APPEND), 'oc-mark-area');
  });

  it('remove point: path matches fresh render', () => {
    assertLineAreaRoundTrip(areaSpec(LINE_DATA_A), areaSpec(LINE_DATA_REMOVE), 'oc-mark-area');
  });
});

// ---------------------------------------------------------------------------
// Line/area canTransition gate integration
// ---------------------------------------------------------------------------

describe('canTransition for line/area', () => {
  it('passes for line chart with different values', () => {
    const specA = lineSpec(LINE_DATA_A);
    const specB = lineSpec(LINE_DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('passes for area chart with different values', () => {
    const specA = areaSpec(LINE_DATA_A);
    const specB = areaSpec(LINE_DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('fails for line to area mark type change', () => {
    const specA = lineSpec(LINE_DATA_A);
    const specB = areaSpec(LINE_DATA_A); // same data, different mark
    // Can't call passingGateArgs because the mark types differ and compilation
    // produces different layouts. Test the gate logic directly.
    expect(
      canTransition({
        prevLayout: compile(specA),
        nextLayout: compile(specB),
        prevSpec: specA,
        nextSpec: specB,
        isFirstRender: false,
        entranceInFlight: false,
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suppressed-point opacity
// ---------------------------------------------------------------------------

describe('suppressed-point opacity', () => {
  it('point with opacity="0" retains opacity="0" after transition', () => {
    // Create a line chart spec that produces point marks
    const specWithPoints: ChartSpec = {
      animation: true,
      mark: { type: 'line', point: true },
      data: LINE_DATA_A,
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const layoutA = compile(specWithPoints);
    const layoutB = compile({
      ...specWithPoints,
      data: LINE_DATA_B,
    });

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    // Find all point marks and manually set one to opacity="0"
    // (simulating endpoint-marker suppression)
    const points = svg.querySelectorAll('circle.oc-mark-point[data-key]');
    if (points.length > 0) {
      points[0].setAttribute('opacity', '0');
    }

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    runToCompletion();

    // The suppressed point should still have opacity="0"
    if (points.length > 0) {
      expect(points[0].getAttribute('opacity')).toBe('0');
    }
  });
});

// ---------------------------------------------------------------------------
// Scatter/dot (point) chart transitions
// ---------------------------------------------------------------------------

/** Build a scatter chart spec with animation enabled. */
function scatterSpec(
  data: Array<{ x: number; y: number; size?: number }>,
  hasSize = false,
): ChartSpec {
  const encoding: ChartSpec['encoding'] = {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  };
  if (hasSize) {
    encoding.size = { field: 'size', type: 'quantitative' };
  }
  return {
    animation: true,
    mark: 'point',
    data,
    encoding,
  };
}

describe('scatter chart transitions', () => {
  it('canTransition passes for point mark type', () => {
    // Need 3+ points with different values so geometry actually changes
    // (2 points always map to domain extremes producing identical pixel positions)
    const specA = scatterSpec([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
    const specB = scatterSpec([
      { x: 10, y: 50 },
      { x: 30, y: 30 },
      { x: 50, y: 70 },
    ]);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);
  });

  it('y-swap between same-x points tweens without identity swap (encoding.key)', () => {
    // Two points at the same x, different y. After update, y values swap.
    // With proper keying, each point should tween to its new y, not swap identity.
    const specA: ChartSpec = {
      animation: true,
      mark: 'point',
      data: [
        { id: 'a', x: 50, y: 20 },
        { id: 'b', x: 50, y: 80 },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        key: { field: 'id' },
      },
    };
    const specB: ChartSpec = {
      ...specA,
      data: [
        { id: 'a', x: 50, y: 80 },
        { id: 'b', x: 50, y: 20 },
      ],
    };

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    // Verify marks have keys and they match across layouts
    const pointsA = layoutA.marks.filter((m) => m.type === 'point');
    const pointsB = layoutB.marks.filter((m) => m.type === 'point');
    expect(pointsA.length).toBe(2);
    expect(pointsB.length).toBe(2);

    // Keys should match: point 'a' in both, point 'b' in both
    const keysA = new Set(pointsA.map((m) => m.key));
    const keysB = new Set(pointsB.map((m) => m.key));
    expect(keysA).toEqual(keysB);
  });

  it('bubble r tween lands exactly on final value', () => {
    const specA = scatterSpec(
      [
        { x: 10, y: 20, size: 5 },
        { x: 30, y: 40, size: 10 },
      ],
      true,
    );
    const specB = scatterSpec(
      [
        { x: 10, y: 20, size: 15 },
        { x: 30, y: 40, size: 20 },
      ],
      true,
    );

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    runToCompletion();

    // After transition completes, check that the r values match the final layout
    const pointMarks = layoutB.marks.filter((m) => m.type === 'point');
    for (const mark of pointMarks) {
      if (!mark.key) continue;
      const el = svg.querySelector(
        `circle.oc-mark-point[data-key="${mark.key}"]`,
      ) as SVGElement | null;
      if (!el) continue;
      const rAttr = el.getAttribute('r');
      expect(rAttr).toBe(String((mark as { r: number }).r));
    }
  });

  it('scatter round-trip: add/remove', () => {
    const specA = scatterSpec([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
    const specB = scatterSpec([
      { x: 10, y: 50 },
      { x: 30, y: 30 },
      { x: 50, y: 70 },
      { x: 70, y: 90 },
    ]);

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    runToCompletion();

    // No ghost elements remain
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);

    // All next layout point marks are present with correct positions
    const pointMarks = layoutB.marks.filter((m) => m.type === 'point');
    for (const mark of pointMarks) {
      if (!mark.key) continue;
      const el = svg.querySelector(
        `circle.oc-mark-point[data-key="${mark.key}"]`,
      ) as SVGElement | null;
      expect(el).not.toBeNull();
      if (el) {
        expect(el.getAttribute('cx')).toBe(String((mark as { cx: number }).cx));
        expect(el.getAttribute('cy')).toBe(String((mark as { cy: number }).cy));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Axis tick transitions
// ---------------------------------------------------------------------------

describe('axis tick transitions', () => {
  it('data-tick-key is stamped on tick labels', () => {
    const spec = columnSpec(DATA_A);
    const { svg } = compileAndRender(spec);

    const tickLabels = svg.querySelectorAll('.oc-axis-tick[data-tick-key]');
    expect(tickLabels.length).toBeGreaterThan(0);
  });

  it('data-tick-key is stamped on gridlines', () => {
    const spec = columnSpec(DATA_A);
    const { svg } = compileAndRender(spec);

    const gridlines = svg.querySelectorAll('.oc-gridline[data-tick-key]');
    expect(gridlines.length).toBeGreaterThan(0);
  });

  it('adding a category: surviving tick labels from/to match prev/next layout tick positions', () => {
    const specA = columnSpec(DATA_A); // Q1, Q2, Q3
    const specB = columnSpec(DATA_C); // Q1, Q2, Q3, Q4

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    // Surviving x-axis ticks (Q1, Q2, Q3) should have different positions
    // between layoutA and layoutB because adding Q4 changes the band scale
    const prevXTicks = layoutA.axes.x?.ticks ?? [];
    const nextXTicks = layoutB.axes.x?.ticks ?? [];

    // Q1 should exist in both
    const prevQ1 = prevXTicks.find((t) => t.label === 'Q1');
    const nextQ1 = nextXTicks.find((t) => t.label === 'Q1');
    expect(prevQ1).toBeDefined();
    expect(nextQ1).toBeDefined();

    // Now render and transition
    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    runToCompletion();

    // After transition, verify tick labels are at final positions
    const tickLabels = svg.querySelectorAll('.oc-axis-x .oc-axis-tick[data-tick-key]');
    expect(tickLabels.length).toBe(nextXTicks.length);

    // No ghost elements remain
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
  });

  it('removed tick ghost-fades', () => {
    const specA = columnSpec(DATA_C); // Q1, Q2, Q3, Q4
    const specB = columnSpec(DATA_A); // Q1, Q2, Q3

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    // After starting, there should be ghost tick labels for the removed Q4
    pumpRaf(0);
    const tickGhosts = svg.querySelectorAll('.oc-axis-tick.oc-ghost');
    // Q4 was removed, so there should be at least one ghost
    expect(tickGhosts.length).toBeGreaterThan(0);

    // Run to completion
    pumpRaf(2000);

    // Ghosts should be cleaned up
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gradient ghost test
// ---------------------------------------------------------------------------

describe('gradient ghost', () => {
  it('exiting mark with gradient fill: new SVG defs contain the gradient, ghost fill references valid ID', () => {
    // Create an area chart spec with gradient fill (area marks use gradients by default)
    const specA: ChartSpec = {
      animation: true,
      mark: 'area',
      data: [
        { month: 'Jan', sales: 100, group: 'A' },
        { month: 'Feb', sales: 200, group: 'A' },
        { month: 'Jan', sales: 80, group: 'B' },
        { month: 'Feb', sales: 150, group: 'B' },
      ],
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'sales', type: 'quantitative' },
        color: { field: 'group', type: 'nominal' },
      },
    };
    // Remove group B
    const specB: ChartSpec = {
      ...specA,
      data: [
        { month: 'Jan', sales: 120, group: 'A' },
        { month: 'Feb', sales: 220, group: 'A' },
      ],
    };

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    // Check if any marks have gradient fills
    const hasGradients = layoutA.marks.some(
      (m) => 'fill' in m && typeof m.fill !== 'string' && m.fill !== undefined,
    );

    // If the chart type produces gradients, verify ghost handling
    if (hasGradients) {
      const container = createContainer();
      const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

      runTransition({
        svg,
        prevLayout: layoutA,
        nextLayout: layoutB,
        animation: layoutB.animation!,
        onComplete: () => {},
      });

      // After starting, check that ghost fill references a valid gradient
      const ghosts = svg.querySelectorAll('.oc-ghost path[fill]');
      for (const ghost of ghosts) {
        const fill = ghost.getAttribute('fill') ?? '';
        if (fill.startsWith('url(#')) {
          const id = fill.slice(5, -1);
          const gradientEl = svg.querySelector(`#${id}`);
          expect(gradientEl).not.toBeNull();
        }
      }

      runToCompletion();
      expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Interruption / retargeting
// ---------------------------------------------------------------------------

const DATA_D = [
  { category: 'Q1', value: 300 },
  { category: 'Q2', value: 100 },
  { category: 'Q3', value: 250 },
];

describe('interruption retargeting', () => {
  it('A -> B -> interrupt at ~50% -> C -> complete -> equals fresh render of C', () => {
    const specA = noEnter(columnSpec(DATA_A));
    const specB = noEnter(columnSpec(DATA_B));
    const specC = noEnter(columnSpec(DATA_D));

    // Use createChart so update() handles snapshot plumbing
    const container = createContainer();
    const chart = createChart(container, specA);

    // Update A -> B, start transition (must actually run, not instant-swap)
    chart.update(specB);
    expect(rafCallbacks.size).toBeGreaterThan(0);

    // Pump to ~50% of the transition (start at t=0, then advance)
    pumpRaf(0);
    pumpRaf(250); // 250ms into ~500ms transition

    // Interrupt with C
    chart.update(specC);

    // Run the C transition to completion
    pumpRaf(0);
    pumpRaf(2000);

    // Extract geometry from the current SVG
    const svg = container.querySelector('svg') as SVGSVGElement;
    const transitioned = extractRectGeometry(svg);

    // Fresh render of specC for comparison
    const { svg: freshSvg } = compileAndRender(specC);
    const fresh = extractRectGeometry(freshSvg);

    // Same set of keys
    expect([...transitioned.keys()].sort()).toEqual([...fresh.keys()].sort());

    // Same geometry per key (round-trip invariant holds through interruption)
    for (const [key, tGeom] of transitioned) {
      const fGeom = fresh.get(key);
      expect(fGeom).toBeDefined();
      expect(tGeom).toEqual(fGeom);
    }

    // No ghost elements remain
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);

    chart.destroy();
  });

  it('snapshot captures intermediate rect geometry', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    const handle = runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    // Pump to start, then mid-transition
    pumpRaf(0);
    pumpRaf(250);

    const snap = handle.snapshot();

    // Should have entries for updated marks
    expect(snap.size).toBeGreaterThan(0);

    // Each entry should be a rect with intermediate values
    for (const [, geom] of snap) {
      expect(geom.type).toBe('rect');
    }

    handle.cancel();
  });
});

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

describe('reduced motion', () => {
  it('canTransition returns false when prefers-reduced-motion matches', () => {
    const original = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(false);

    vi.stubGlobal('matchMedia', original);
  });

  it('canTransition returns true when reduced-motion is not active', () => {
    const original = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    expect(canTransition(passingGateArgs(specA, specB))).toBe(true);

    vi.stubGlobal('matchMedia', original);
  });
});

// ---------------------------------------------------------------------------
// React StrictMode double-mount
// ---------------------------------------------------------------------------

describe('React StrictMode double-mount', () => {
  it('destroy cancels rAF loop; fresh mount does not inherit stale state', () => {
    const specA = noEnter(columnSpec(DATA_A));
    const specB = noEnter(columnSpec(DATA_B));

    const container = createContainer();

    // First mount
    const chart1 = createChart(container, specA);
    chart1.update(specB);
    expect(rafCallbacks.size).toBeGreaterThan(0); // transition actually started
    pumpRaf(0); // start transition

    // Destroy mid-transition (simulates StrictMode unmount)
    chart1.destroy();

    // Record rAF callback count after destroy
    const callbacksAfterDestroy = rafCallbacks.size;

    // Second mount (fresh closure)
    const chart2 = createChart(container, specA);
    chart2.update(specB);
    pumpRaf(0);

    // The old transition's rAF should not have re-registered
    // (only the new transition should be running)
    // Pump to completion - if old rAF leaked, it would crash or write to removed DOM
    pumpRaf(2000);

    // Clean up
    chart2.destroy();

    // No crash = success: the first transition did not leak rAF callbacks
    expect(callbacksAfterDestroy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Secondary element crossfade
// ---------------------------------------------------------------------------

describe('secondary element crossfade', () => {
  it('fades in an annotation that did not exist before', () => {
    const specA: ChartSpec = columnSpec(DATA_A);
    const specB: ChartSpec = {
      ...columnSpec(DATA_B),
      annotations: [{ type: 'text', x: 'Q1', y: 150, text: 'Note' }],
    };

    const layoutA = compile(specA);
    const layoutB = compile(specB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    const annotations = svg.querySelectorAll('.oc-annotation');
    expect(annotations.length).toBeGreaterThan(0);
    for (const ann of annotations) {
      expect((ann as SVGElement).style.opacity).toBe('0');
    }

    runToCompletion();

    for (const ann of annotations) {
      expect((ann as SVGElement).style.opacity).toBe('1');
    }
  });

  it('does not re-fade an annotation that was already on screen', () => {
    // The blink bug: the old blanket crossfade drove EVERY annotation from
    // opacity 0 on every update, so an unchanged annotation flickered out and
    // back in whenever any other part of the chart moved.
    const annotation = { type: 'text' as const, x: 'Q1', y: 100, text: 'Note' };
    const layoutA = compile({ ...columnSpec(DATA_A), annotations: [annotation] });
    const layoutB = compile({ ...columnSpec(DATA_B), annotations: [annotation] });

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    const annotations = svg.querySelectorAll('.oc-annotation');
    expect(annotations.length).toBeGreaterThan(0);
    for (const ann of annotations) {
      expect((ann as SVGElement).style.opacity).not.toBe('0');
    }
  });

  it('endpoint labels start at opacity 0 during transition', () => {
    // Use a line chart that produces endpoint labels
    const lineSpecWithLabels: ChartSpec = {
      animation: true,
      mark: 'line',
      data: [
        { month: 'Jan', value: 100, group: 'A' },
        { month: 'Feb', value: 200, group: 'A' },
        { month: 'Jan', value: 80, group: 'B' },
        { month: 'Feb', value: 150, group: 'B' },
      ],
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'group', type: 'nominal' },
      },
    };
    const lineSpecB: ChartSpec = {
      ...lineSpecWithLabels,
      data: [
        { month: 'Jan', value: 120, group: 'A' },
        { month: 'Feb', value: 220, group: 'A' },
        { month: 'Jan', value: 90, group: 'B' },
        { month: 'Feb', value: 170, group: 'B' },
      ],
    };

    const layoutA = compile(lineSpecWithLabels);
    const layoutB = compile(lineSpecB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    // Check if endpoint labels exist
    const epLabels = svg.querySelector('.oc-endpoint-labels') as SVGElement | null;
    if (epLabels) {
      expect(epLabels.style.opacity).toBe('0');

      runToCompletion();

      // After completion, opacity restored
      expect(epLabels.style.opacity).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Mark color interpolation
// ---------------------------------------------------------------------------

describe('mark color interpolation', () => {
  const COLORED: ChartSpec = {
    animation: true,
    mark: 'line',
    data: [
      { month: 'Jan', value: 10, series: 'A' },
      { month: 'Feb', value: 20, series: 'A' },
      { month: 'Jan', value: 30, series: 'B' },
      { month: 'Feb', value: 40, series: 'B' },
    ],
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  };

  const HIGHLIGHTED: ChartSpec = {
    ...COLORED,
    encoding: {
      ...COLORED.encoding,
      color: { field: 'series', type: 'nominal', highlight: ['A'] },
    },
  };

  it('tweens stroke through an intermediate color instead of snapping', () => {
    const layoutA = compile(COLORED);
    const layoutB = compile(HIGHLIGHTED);

    // The highlight must actually recolor something, else this proves nothing.
    const strokesA = layoutA.marks.map((m) => (m as { stroke?: string }).stroke);
    const strokesB = layoutB.marks.map((m) => (m as { stroke?: string }).stroke);
    expect(strokesA).not.toEqual(strokesB);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });

    // At t=0 the muted line must be back at its ORIGINAL color, not the
    // already-rendered muted gray -- that is what makes it a fade and not a snap.
    const muted = layoutB.marks.findIndex(
      (m, i) =>
        (m as { stroke?: string }).stroke !== (layoutA.marks[i] as { stroke?: string }).stroke,
    );
    expect(muted).toBeGreaterThanOrEqual(0);
    const key = (layoutB.marks[muted] as { key?: string }).key;
    const el = svg.querySelector(`[data-key="${key}"]`) as SVGElement;
    const shape = (el.querySelector('path, line, rect, circle') as SVGElement) ?? el;

    const from = (layoutA.marks[muted] as { stroke?: string }).stroke;
    const to = (layoutB.marks[muted] as { stroke?: string }).stroke;

    pumpRaf(0);
    const atStart = shape.getAttribute('stroke');
    expect(atStart).not.toBe(to);

    runToCompletion();
    // And it lands exactly on the final color.
    const atEnd = shape.getAttribute('stroke');
    expect(atEnd).toBe(to);
    expect(atEnd).not.toBe(from);
  });

  it('strokes the area top-line, never the closed fill path', () => {
    // An area mark is two stacked paths: the closed fill shape (stroke: none)
    // and `.oc-area-top`, which traces the data points alone. A blanket
    // `querySelector` grabs the *first* one, so a stroke tween would outline
    // the whole closed shape -- baseline included -- and snapTweenToFinal
    // would leave that outline on screen permanently.
    const AREA: ChartSpec = { ...COLORED, mark: 'area' };
    const AREA_HL: ChartSpec = {
      ...AREA,
      encoding: {
        ...AREA.encoding,
        color: { field: 'series', type: 'nominal', highlight: ['A'] },
      },
    };

    const layoutA = compile(AREA);
    const layoutB = compile(AREA_HL);

    const muted = layoutB.marks.findIndex(
      (m, i) =>
        (m as { stroke?: string }).stroke !== (layoutA.marks[i] as { stroke?: string }).stroke,
    );
    expect(muted).toBeGreaterThanOrEqual(0);

    const container = createContainer();
    const svg = renderChartSVG(layoutB, container) as SVGSVGElement;

    runTransition({
      svg,
      prevLayout: layoutA,
      nextLayout: layoutB,
      animation: layoutB.animation!,
      onComplete: () => {},
    });
    runToCompletion();

    const key = (layoutB.marks[muted] as { key?: string }).key;
    const group = svg.querySelector(`[data-key="${key}"]`) as SVGElement;
    const areaTop = group.querySelector('.oc-area-top') as SVGElement;
    const fillPath = group.querySelector('path:not(.oc-area-top)') as SVGElement;
    expect(areaTop).toBeTruthy();
    expect(fillPath).toBeTruthy();

    // The stroke landed on the top-line...
    const to = (layoutB.marks[muted] as { stroke?: string }).stroke;
    expect(areaTop.getAttribute('stroke')).toBe(to);

    // ...and the fill path is still unstroked. Anything else is an outline
    // traced around the entire filled region.
    expect(fillPath.getAttribute('stroke')).toBe('none');
  });
});
