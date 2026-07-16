/**
 * Scrolly step-pattern matrix for `chart.update(spec)`.
 *
 * A scrollytelling driver patches a base spec per step ({ data?, encoding?,
 * annotations?, highlight? }) and calls update() as the reader scrolls. This
 * suite exercises each step pattern end-to-end through the public
 * createChart()/update() API on one column chart and one line chart:
 *
 * - data-only change (same keys, new values)
 * - y-domain change (values that force a rescale)
 * - annotation add / remove / move
 * - highlight change
 * - series / category add & remove (enter/exit ghosts)
 * - rapid-fire interrupted updates (scroll jitter)
 * - reduced motion (snap, no tween)
 * - entrance-in-flight (update during entrance snaps)
 *
 * All specs here use `animation: { enter: false }`. With `animation: true`,
 * createChart() arms an entrance-cleanup timer (~1.2s real setTimeout) and
 * any update() inside that window fails canTransition gate 6
 * (entranceInFlight) -- the chart snaps instead of tweening. The
 * entrance-in-flight test at the bottom pins that behavior down explicitly.
 *
 * transition.test.ts covers the transition internals (gates, runTransition,
 * normalizePointArrays); this file stays on the public API surface.
 */

import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { renderChartSVG } from '../svg-renderer';

// ---------------------------------------------------------------------------
// rAF mock (same pattern as transition.test.ts)
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

/** Run any in-flight transition to completion. */
function runToCompletion(totalMs = 5000) {
  pumpRaf(0);
  pumpRaf(totalMs);
}

beforeEach(() => {
  setupRafMock();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  // restoreAllMocks does NOT undo vi.stubGlobal; without this the
  // reduced-motion matchMedia stub leaks into later tests and masks
  // the entrance-window gate behind the reduced-motion gate.
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Spec builders
// ---------------------------------------------------------------------------

/**
 * update/exit enabled, enter disabled: the scrolly configuration that lets
 * update() transition immediately after mount (see file header).
 */
const SCROLLY_ANIMATION = { enter: false } as const;

function columnSpec(
  data: Array<{ category: string; value: number }>,
  extra: Partial<ChartSpec> = {},
): ChartSpec {
  return {
    animation: SCROLLY_ANIMATION,
    mark: 'bar',
    data,
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
    ...extra,
  };
}

function lineSpec(
  data: Array<{ month: string; value: number; series: string }>,
  extra: Partial<ChartSpec> = {},
): ChartSpec {
  return {
    animation: SCROLLY_ANIMATION,
    mark: 'line',
    data,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
    ...extra,
  };
}

const COL_A = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 200 },
  { category: 'Q3', value: 150 },
];

const COL_B = [
  { category: 'Q1', value: 150 },
  { category: 'Q2', value: 180 },
  { category: 'Q3', value: 220 },
];

/** Same categories, values an order of magnitude larger: forces a y rescale. */
const COL_RESCALE = [
  { category: 'Q1', value: 1200 },
  { category: 'Q2', value: 2400 },
  { category: 'Q3', value: 1800 },
];

const COL_EXIT = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 200 },
];

const COL_ENTER = [...COL_A, { category: 'Q4', value: 250 }];

function seriesData(values: Record<string, number[]>) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr'];
  return Object.entries(values).flatMap(([series, vals]) =>
    vals.map((value, i) => ({ month: months[i], value, series })),
  );
}

const LINE_AB = seriesData({ A: [10, 20, 15, 30], B: [40, 35, 45, 50] });
const LINE_AB2 = seriesData({ A: [15, 25, 35, 20], B: [30, 45, 40, 60] });
const LINE_A_ONLY = seriesData({ A: [10, 20, 15, 30] });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(spec: ChartSpec, width = 600, height = 400): ChartLayout {
  return compileChart(spec, { width, height });
}

function mountChart(spec: ChartSpec) {
  const container = createContainer();
  const chart = createChart(container, spec);
  return {
    chart,
    container,
    svg: () => container.querySelector('svg') as SVGSVGElement,
  };
}

/** Rect geometry keyed by data-key. */
function rectGeometry(svg: SVGElement): Map<string, string> {
  const result = new Map<string, string>();
  for (const g of svg.querySelectorAll('.oc-mark-rect[data-key]')) {
    const key = g.getAttribute('data-key') as string;
    const rect = g.querySelector('rect');
    const path = g.querySelector('path');
    if (rect) {
      result.set(
        key,
        [
          rect.getAttribute('x'),
          rect.getAttribute('y'),
          rect.getAttribute('width'),
          rect.getAttribute('height'),
        ].join(','),
      );
    } else if (path) {
      result.set(key, path.getAttribute('d') ?? '');
    }
  }
  return result;
}

/** Line path `d` strings keyed by data-key. */
function linePaths(svg: SVGElement): Map<string, string> {
  const result = new Map<string, string>();
  for (const g of svg.querySelectorAll('.oc-mark-line[data-key]')) {
    const key = g.getAttribute('data-key') as string;
    const path = g.querySelector('path');
    if (path) {
      result.set(key, path.getAttribute('d') ?? '');
    }
  }
  return result;
}

/** Render a spec into a standalone SVG (what update() must converge to). */
function freshRender(spec: ChartSpec): SVGSVGElement {
  const container = createContainer();
  return renderChartSVG(compile(spec), container) as SVGSVGElement;
}

function expectGeometryMatches(actual: Map<string, string>, expected: Map<string, string>) {
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [key, geom] of actual) {
    expect(geom, `geometry for ${key}`).toBe(expected.get(key));
  }
}

function ghosts(root: ParentNode): number {
  return root.querySelectorAll('.oc-ghost').length;
}

// ---------------------------------------------------------------------------
// Column chart step patterns
// ---------------------------------------------------------------------------

describe('column chart: scrolly step patterns through update()', () => {
  it('data-only change tweens through intermediate geometry and lands on the fresh render', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A));
    const before = rectGeometry(svg());

    chart.update(columnSpec(COL_B));
    // A transition must actually be scheduled -- not the instant-swap path.
    expect(rafCallbacks.size).toBeGreaterThan(0);

    pumpRaf(0);
    pumpRaf(250); // mid-flight of the 500ms default update phase
    const mid = rectGeometry(svg());
    const final = rectGeometry(freshRender(columnSpec(COL_B)));
    // Mid-flight geometry is between states: differs from both start and end.
    expect(mid).not.toEqual(before);
    expect(mid).not.toEqual(final);

    pumpRaf(5000);
    expectGeometryMatches(rectGeometry(svg()), final);
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });

  it('y-domain change rescales: geometry and y-axis ticks match the fresh render', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A));
    const ticksBefore = [...svg().querySelectorAll('.oc-axis-y .oc-axis-tick')].map(
      (t) => t.textContent,
    );

    chart.update(columnSpec(COL_RESCALE));
    runToCompletion();

    const fresh = freshRender(columnSpec(COL_RESCALE));
    expectGeometryMatches(rectGeometry(svg()), rectGeometry(fresh));

    const ticksAfter = [...svg().querySelectorAll('.oc-axis-y .oc-axis-tick')].map(
      (t) => t.textContent,
    );
    const ticksFresh = [...fresh.querySelectorAll('.oc-axis-y .oc-axis-tick')].map(
      (t) => t.textContent,
    );
    expect(ticksAfter).not.toEqual(ticksBefore);
    expect(ticksAfter).toEqual(ticksFresh);
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });

  it('category exit ghosts the removed bar, then cleans it up', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A));

    chart.update(columnSpec(COL_EXIT)); // Q3 exits
    // Ghosts are created synchronously before the first frame.
    expect(ghosts(svg())).toBeGreaterThan(0);

    runToCompletion();
    expect(ghosts(svg())).toBe(0);
    expectGeometryMatches(rectGeometry(svg()), rectGeometry(freshRender(columnSpec(COL_EXIT))));

    chart.destroy();
  });

  it('category enter adds the new bar and converges on the fresh render', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A));

    chart.update(columnSpec(COL_ENTER)); // Q4 enters
    runToCompletion();

    const geometry = rectGeometry(svg());
    expect(geometry.size).toBe(4);
    expectGeometryMatches(geometry, rectGeometry(freshRender(columnSpec(COL_ENTER))));
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });

  it('rapid-fire interrupted updates settle on the last spec with no orphaned ghosts', () => {
    const { chart, container, svg } = mountChart(columnSpec(COL_A));

    // Scroll jitter: four steps in quick succession, some mid-tween, some
    // back-to-back with no frame in between, including an exit step whose
    // ghost must not survive the interruption.
    chart.update(columnSpec(COL_B));
    pumpRaf(0);
    pumpRaf(120);
    chart.update(columnSpec(COL_EXIT)); // spawns a ghost for Q3
    pumpRaf(0);
    pumpRaf(60);
    chart.update(columnSpec(COL_RESCALE)); // no frame pumped since last update
    chart.update(columnSpec(COL_ENTER));
    runToCompletion();

    expectGeometryMatches(rectGeometry(svg()), rectGeometry(freshRender(columnSpec(COL_ENTER))));
    // No ghost anywhere in the container, and no rAF loop left running.
    expect(ghosts(container)).toBe(0);
    expect(rafCallbacks.size).toBe(0);

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// Line chart step patterns
// ---------------------------------------------------------------------------

describe('line chart: scrolly step patterns through update()', () => {
  it('data-only change morphs paths and lands on the fresh render', () => {
    const { chart, svg } = mountChart(lineSpec(LINE_AB));
    const before = linePaths(svg());

    chart.update(lineSpec(LINE_AB2));
    expect(rafCallbacks.size).toBeGreaterThan(0);

    pumpRaf(0);
    pumpRaf(250);
    const mid = linePaths(svg());
    const final = linePaths(freshRender(lineSpec(LINE_AB2)));
    expect(mid).not.toEqual(before);
    expect(mid).not.toEqual(final);

    pumpRaf(5000);
    expectGeometryMatches(linePaths(svg()), final);
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });

  it('series exit ghosts the removed line, then cleans it up', () => {
    const { chart, svg } = mountChart(lineSpec(LINE_AB));

    chart.update(lineSpec(LINE_A_ONLY)); // series B exits
    expect(ghosts(svg())).toBeGreaterThan(0);

    runToCompletion();
    expect(ghosts(svg())).toBe(0);
    const paths = linePaths(svg());
    expect(paths.size).toBe(1);
    expectGeometryMatches(paths, linePaths(freshRender(lineSpec(LINE_A_ONLY))));

    chart.destroy();
  });

  it('series enter adds the new line and converges on the fresh render', () => {
    const { chart, svg } = mountChart(lineSpec(LINE_A_ONLY));

    chart.update(lineSpec(LINE_AB)); // series B enters
    runToCompletion();

    const paths = linePaths(svg());
    expect(paths.size).toBe(2);
    expectGeometryMatches(paths, linePaths(freshRender(lineSpec(LINE_AB))));
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });

  it('highlight change fades stroke to the muted color instead of snapping', () => {
    const base = lineSpec(LINE_AB);
    const highlighted = lineSpec(LINE_AB, {
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal', highlight: ['A'] },
      },
    });

    // Find a mark whose stroke the highlight mutes.
    const layoutBase = compile(base);
    const layoutHl = compile(highlighted);
    const mutedIdx = layoutHl.marks.findIndex(
      (m, i) =>
        (m as { stroke?: string }).stroke !== (layoutBase.marks[i] as { stroke?: string }).stroke,
    );
    expect(mutedIdx).toBeGreaterThanOrEqual(0);
    const mutedKey = (layoutHl.marks[mutedIdx] as { key?: string }).key as string;
    const toStroke = (layoutHl.marks[mutedIdx] as { stroke?: string }).stroke;

    const { chart, svg } = mountChart(base);
    chart.update(highlighted);

    const el = svg().querySelector(`[data-key="${mutedKey}"] path`) as SVGElement;
    pumpRaf(0);
    // At the start of the fade the stroke is NOT yet the muted color.
    expect(el.getAttribute('stroke')).not.toBe(toStroke);

    pumpRaf(5000);
    expect(el.getAttribute('stroke')).toBe(toStroke);

    chart.destroy();
  });

  it('rapid-fire interrupted updates settle on the last spec with no orphaned ghosts', () => {
    const { chart, container, svg } = mountChart(lineSpec(LINE_AB));

    chart.update(lineSpec(LINE_A_ONLY)); // B exits: ghost path in flight
    pumpRaf(0);
    pumpRaf(100);
    chart.update(lineSpec(LINE_AB2)); // B re-enters mid-exit
    pumpRaf(0);
    chart.update(lineSpec(LINE_AB)); // no frame pumped since last update
    runToCompletion();

    expectGeometryMatches(linePaths(svg()), linePaths(freshRender(lineSpec(LINE_AB))));
    expect(ghosts(container)).toBe(0);
    expect(rafCallbacks.size).toBe(0);

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// Annotation steps
// ---------------------------------------------------------------------------

describe('annotation steps through update()', () => {
  const NOTE = { id: 'note', type: 'text' as const, x: 'Q2', y: 180, text: 'Peak' };

  it('annotation add fades the new annotation in', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A));

    chart.update(columnSpec(COL_A, { annotations: [NOTE] }));

    const annotation = svg().querySelector('.oc-annotation') as SVGElement;
    expect(annotation).not.toBeNull();
    // From-state applied synchronously: fading in from 0.
    expect(annotation.style.opacity).toBe('0');

    runToCompletion();
    expect(annotation.style.opacity).toBe('1');

    chart.destroy();
  });

  it('annotation move tweens via a transform offset and clears it on completion', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A, { annotations: [NOTE] }));

    chart.update(columnSpec(COL_A, { annotations: [{ ...NOTE, x: 'Q3', y: 120 }] }));

    const annotation = svg().querySelector('.oc-annotation') as SVGElement;
    pumpRaf(0);
    pumpRaf(250);
    // Mid-flight: sliding from the old position via an SVG transform.
    expect(annotation.getAttribute('transform')).toMatch(/translate/);
    // A moved annotation is the same annotation: it must not re-fade.
    expect(annotation.style.opacity).not.toBe('0');

    pumpRaf(5000);
    // Completion drops the offset so the DOM matches what render() produced.
    expect(annotation.hasAttribute('transform')).toBe(false);

    chart.destroy();
  });

  it('annotation remove disappears immediately (known limitation: no exit fade)', () => {
    const { chart, svg } = mountChart(columnSpec(COL_A, { annotations: [NOTE] }));
    expect(svg().querySelector('.oc-annotation')).not.toBeNull();

    chart.update(columnSpec(COL_A));
    // render() tears the old SVG down and annotations are not ghosted, so the
    // annotation is gone before the first frame. Documented in
    // docs/integration-guide.md ("Driving charts from scroll").
    expect(svg().querySelector('.oc-annotation')).toBeNull();

    runToCompletion();
    expect(svg().querySelector('.oc-annotation')).toBeNull();
    expect(ghosts(svg())).toBe(0);

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

describe('reduced motion through update()', () => {
  it('snaps to the final state with no tween and no ghosts', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { chart, svg } = mountChart(columnSpec(COL_A));
    chart.update(columnSpec(COL_EXIT));

    // No transition scheduled: geometry is already final, nothing ghosted.
    expect(rafCallbacks.size).toBe(0);
    expect(ghosts(svg())).toBe(0);
    expectGeometryMatches(rectGeometry(svg()), rectGeometry(freshRender(columnSpec(COL_EXIT))));

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// Entrance-in-flight
// ---------------------------------------------------------------------------

describe('update() during the entrance animation window', () => {
  it('snaps instead of transitioning while the entrance cleanup timer is armed', () => {
    // Full `animation: true`: mount arms the entrance-cleanup timer, and an
    // update() inside that window (~duration + stagger + 700ms) fails
    // canTransition gate 6. Scrolly drivers that want step 1 -> step 2 to
    // tween must disable the entrance phase ({ enter: false }) or tolerate
    // the first step snapping when the reader scrolls immediately.
    const spec = { ...columnSpec(COL_A), animation: true } as ChartSpec;
    const { chart, svg } = mountChart(spec);

    chart.update({ ...columnSpec(COL_B), animation: true } as ChartSpec);

    expect(rafCallbacks.size).toBe(0); // no transition scheduled
    expect(ghosts(svg())).toBe(0);
    expectGeometryMatches(
      rectGeometry(svg()),
      rectGeometry(freshRender({ ...columnSpec(COL_B), animation: true } as ChartSpec)),
    );

    chart.destroy();
  });
});
