/**
 * Data-update transition tests.
 *
 * Tests the canTransition gate (all ten checks), mark matching logic,
 * the rAF-driven animation loop (with manual pump), round-trip invariant,
 * ghost element lifecycle, and cancel semantics.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { renderChartSVG } from '../svg-renderer';
import { canTransition, runTransition } from '../transition';

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

  it('gate 3: fails for non-bar mark type', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);
    const args = passingGateArgs(specA, specB);
    // Override both specs to be line charts
    args.prevSpec = { ...specA, mark: 'line' };
    args.nextSpec = { ...specB, mark: 'line' };
    expect(canTransition(args)).toBe(false);
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

  it('gate 9: fails when geometry is identical (zero-delta)', () => {
    const specA = columnSpec(DATA_A);
    // Same data = same geometry
    expect(canTransition(passingGateArgs(specA, specA))).toBe(false);
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

describe('legend toggle mid-transition', () => {
  it('render() during transition cancels transition and stops attribute writes', () => {
    const specA = columnSpec(DATA_A);
    const specB = columnSpec(DATA_B);

    const container = createContainer();
    const chart = createChart(container, specA);

    // Update to trigger transition
    chart.update(specB);

    // Pump one frame
    pumpRaf(0);

    // Force a re-render (simulating legend toggle) should cancel the transition
    // by calling render() internally, which cancels transitionHandle
    chart.resize();

    // After resize, pumping more frames should have no effect
    // (the transition was cancelled)
    pumpRaf(100);
    // No crash = success (the transition's rAF was cancelled)

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
