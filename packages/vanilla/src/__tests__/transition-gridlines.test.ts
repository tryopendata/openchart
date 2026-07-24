/**
 * Characterization tests for the SVG gridline tween.
 *
 * These pin the CURRENT observable behavior of the tick-to-gridline matching
 * and interpolation in `transition.ts` so that extracting the matching logic
 * into a shared (canvas-reusable) pure function is provably behavior-preserving.
 *
 * Every expectation here was read off a real run, not derived from what the
 * code "should" do. Expected geometry comes from a fresh render of the next
 * layout rather than hardcoded pixels.
 *
 * Notes on behaviors that are non-obvious and therefore worth pinning:
 * - Gridlines are matched to prev/next by TICK VALUE, not by pixel position.
 *   A tick value is only eligible if the layout has a gridline sitting at the
 *   exact same position as the tick.
 * - Only the y-axis renders gridlines by default; the x-axis renders none, so
 *   these tests are y-axis only.
 * - Exiting gridlines get a real ghost `<line class="oc-gridline oc-ghost">`
 *   appended to the axis group, which fades opacity 1 -> 0 over the EXIT
 *   duration (shorter than the update duration) and is then removed.
 */

import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { renderChartSVG } from '../svg-renderer';
import { runTransition } from '../transition';

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

/** Render a layout into a fresh container (mount.ts renders the NEXT layout). */
function render(layout: ChartLayout, width = 600, height = 400): SVGSVGElement {
  return renderChartSVG(layout, createContainer(width, height)) as SVGSVGElement;
}

/** The y-axis gridline carrying a given tick key, or null. */
function gridlineByKey(svg: SVGSVGElement, key: string): SVGElement | null {
  return svg.querySelector(`.oc-axis-y .oc-gridline[data-tick-key="${key}"]`) as SVGElement | null;
}

/** The y-axis tick label carrying a given tick key, or null. */
function tickLabelByKey(svg: SVGSVGElement, key: string): SVGElement | null {
  return svg.querySelector(`.oc-axis-y .oc-axis-tick[data-tick-key="${key}"]`) as SVGElement | null;
}

/** Gridline ghosts (exiting gridlines) currently in the DOM. */
function gridlineGhosts(svg: SVGSVGElement): SVGElement[] {
  return Array.from(svg.querySelectorAll('.oc-gridline.oc-ghost')) as SVGElement[];
}

/** Set of tick keys present on rendered y-axis gridlines. */
function gridlineKeys(layout: ChartLayout): Set<string> {
  const svg = render(layout);
  const keys = new Set<string>();
  for (const gl of svg.querySelectorAll('.oc-axis-y .oc-gridline[data-tick-key]')) {
    const k = gl.getAttribute('data-tick-key');
    if (k) keys.add(k);
  }
  svg.parentElement?.remove();
  return keys;
}

/** Read a numeric attribute. */
function num(el: Element | null, attr: string): number {
  return Number(el?.getAttribute(attr));
}

// ---------------------------------------------------------------------------
// rAF mock (mirrors transition.test.ts)
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
  pumpRaf(0);
  pumpRaf(totalMs);
}

beforeEach(() => {
  setupRafMock();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
//
// DOMAIN_20 -> DOMAIN_25 keeps every tick VALUE (0,5,10,15,20) but moves each
// one to a new pixel position and adds a new tick (25). That gives us surviving
// gridlines + one entering gridline with zero exits.
//
// DOMAIN_900 -> DOMAIN_20 replaces the whole tick set (0,200,...,800 becomes
// 0,5,...,20), producing exits for 200/400/600/800.
// ---------------------------------------------------------------------------

const DOMAIN_20 = [
  { category: 'Q1', value: 10 },
  { category: 'Q2', value: 20 },
  { category: 'Q3', value: 15 },
];

const DOMAIN_25 = [
  { category: 'Q1', value: 10 },
  { category: 'Q2', value: 25 },
  { category: 'Q3', value: 15 },
];

const DOMAIN_900 = [
  { category: 'Q1', value: 100 },
  { category: 'Q2', value: 900 },
  { category: 'Q3', value: 400 },
];

// ---------------------------------------------------------------------------
// Fixture guards
// ---------------------------------------------------------------------------

describe('gridline tween fixtures', () => {
  it('only the y-axis renders gridlines (x-axis has none by default)', () => {
    const { svg } = compileAndRender(columnSpec(DOMAIN_20));
    expect(svg.querySelectorAll('.oc-axis-y .oc-gridline[data-tick-key]').length).toBeGreaterThan(
      0,
    );
    expect(svg.querySelectorAll('.oc-axis-x .oc-gridline').length).toBe(0);
  });

  it('DOMAIN_20 -> DOMAIN_25 keeps every tick value and moves it', () => {
    const prev = gridlineKeys(compile(columnSpec(DOMAIN_20)));
    const next = gridlineKeys(compile(columnSpec(DOMAIN_25)));
    // Every prev key survives...
    for (const k of prev) expect(next.has(k)).toBe(true);
    // ...and exactly one new key enters.
    expect([...next].filter((k) => !prev.has(k))).toEqual(['25']);
  });

  it('DOMAIN_900 -> DOMAIN_20 drops tick values (produces exits)', () => {
    const prev = gridlineKeys(compile(columnSpec(DOMAIN_900)));
    const next = gridlineKeys(compile(columnSpec(DOMAIN_20)));
    const exiting = [...prev].filter((k) => !next.has(k));
    expect(exiting.sort()).toEqual(['200', '400', '600', '800']);
  });
});

// ---------------------------------------------------------------------------
// Surviving gridlines
// ---------------------------------------------------------------------------

describe('surviving gridlines', () => {
  it('tween from the prev position to the next position', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));

    // Expected endpoints come from a fresh render of each layout, never hardcoded.
    const prevRender = render(prevLayout);
    const nextRender = render(nextLayout);
    const KEY = '15';
    const startY = num(gridlineByKey(prevRender, KEY), 'y1');
    const finalY1 = gridlineByKey(nextRender, KEY)?.getAttribute('y1');
    const finalY = Number(finalY1);
    // Guard the fixture: a gridline that does not move proves nothing.
    expect(Math.abs(finalY - startY)).toBeGreaterThan(10);

    // mount.ts renders the NEXT layout, then transitions from the prev one.
    const svg = render(nextLayout);
    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    const gl = gridlineByKey(svg, KEY);
    expect(gl).not.toBeNull();

    // t=0 rewinds to the prev position...
    pumpRaf(0);
    expect(num(gl, 'y1')).toBeCloseTo(startY, 4);
    expect(num(gl, 'y2')).toBeCloseTo(startY, 4);

    // ...mid-flight sits strictly between prev and next...
    pumpRaf(250);
    const midY = num(gl, 'y1');
    expect(midY).toBeGreaterThan(Math.min(startY, finalY));
    expect(midY).toBeLessThan(Math.max(startY, finalY));
    expect(num(gl, 'y2')).toBeCloseTo(midY, 10);

    // ...and lands exactly on the freshly-rendered geometry.
    pumpRaf(2000);
    expect(gl?.getAttribute('y1')).toBe(finalY1);
    expect(gl?.getAttribute('y2')).toBe(finalY1);
  });

  it('surviving gridlines never have their opacity touched', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const svg = render(nextLayout);

    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    const gl = gridlineByKey(svg, '15');
    pumpRaf(0);
    expect(gl?.style.opacity).toBe('');
    pumpRaf(250);
    expect(gl?.style.opacity).toBe('');
    pumpRaf(2000);
    expect(gl?.style.opacity).toBe('');
  });

  it('every surviving gridline lands on its fresh-render position', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const nextRender = render(nextLayout);
    const svg = render(nextLayout);

    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });
    runToCompletion();

    for (const key of gridlineKeys(nextLayout)) {
      const expected = gridlineByKey(nextRender, key)?.getAttribute('y1');
      expect(gridlineByKey(svg, key)?.getAttribute('y1')).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Entering gridlines
// ---------------------------------------------------------------------------

describe('entering gridlines', () => {
  it('hold their final position and fade in from 0', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));

    // '25' has no counterpart in prev, so it enters.
    const ENTER_KEY = '25';
    const nextRender = render(nextLayout);
    const finalY = nextRender
      .querySelector(`.oc-axis-y .oc-gridline[data-tick-key="${ENTER_KEY}"]`)
      ?.getAttribute('y1');
    expect(finalY).not.toBeNull();

    const svg = render(nextLayout);
    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    const gl = gridlineByKey(svg, ENTER_KEY);
    expect(gl).not.toBeNull();

    // Fades in rather than sliding: position is pinned to the final value the
    // whole way through.
    pumpRaf(0);
    expect(Number(gl?.style.opacity)).toBe(0);
    expect(gl?.getAttribute('y1')).toBe(finalY);

    // Enters are delayed 40% of the update duration, so t=150 is still hidden.
    pumpRaf(150);
    expect(Number(gl?.style.opacity)).toBe(0);

    // Past the delay it is partway in.
    pumpRaf(350);
    const midOpacity = Number(gl?.style.opacity);
    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);
    expect(gl?.getAttribute('y1')).toBe(finalY);

    // Ends fully opaque at the fresh-render position.
    pumpRaf(2000);
    expect(gl?.style.opacity).toBe('1');
    expect(gl?.getAttribute('y1')).toBe(finalY);
    expect(gl?.getAttribute('y2')).toBe(finalY);
  });

  it('final opacity is visually identical to a fresh render', () => {
    // The tween ends at inline opacity '1'; a fresh render leaves the inline
    // style unset (visibility comes from the stroke-opacity attribute). Both
    // paint the same, so read the stroke-opacity off a fresh render rather than
    // asserting a magic number.
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const nextRender = render(nextLayout);
    const fresh = gridlineByKey(nextRender, '25');
    expect(fresh?.style.opacity).toBe('');
    const freshStrokeOpacity = fresh?.getAttribute('stroke-opacity');

    const svg = render(nextLayout);
    runTransition({
      svg,
      prevLayout: compile(columnSpec(DOMAIN_20)),
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });
    runToCompletion();

    const gl = gridlineByKey(svg, '25');
    expect(gl?.style.opacity).toBe('1');
    expect(gl?.getAttribute('stroke-opacity')).toBe(freshStrokeOpacity);
  });
});

// ---------------------------------------------------------------------------
// Exiting gridlines
//
// PINNED BEHAVIOR: exits DO animate. A ghost <line class="oc-gridline oc-ghost">
// is appended to the axis group at the PREV position, fades opacity 1 -> 0 over
// the EXIT duration (300ms, shorter than the 500ms update duration), does NOT
// move, and is removed from the DOM when the transition finishes or is cancelled.
// ---------------------------------------------------------------------------

describe('exiting gridlines', () => {
  it('get ghost <line> elements at the prev position that fade out and are removed', () => {
    const prevLayout = compile(columnSpec(DOMAIN_900));
    const nextLayout = compile(columnSpec(DOMAIN_20));

    const prevRender = render(prevLayout);
    const exitingKeys = ['200', '400', '600', '800'];
    const exitPositions = exitingKeys.map((k) => num(gridlineByKey(prevRender, k), 'y1'));

    const svg = render(nextLayout);
    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    // One ghost per exiting gridline, each a bare <line> with no data-tick-key.
    pumpRaf(0);
    const ghosts = gridlineGhosts(svg);
    expect(ghosts.length).toBe(exitingKeys.length);
    for (const ghost of ghosts) {
      expect(ghost.tagName).toBe('line');
      expect(ghost.getAttribute('data-tick-key')).toBeNull();
      expect(ghost.getAttribute('aria-hidden')).toBe('true');
      expect(ghost.getAttribute('pointer-events')).toBe('none');
      expect(Number(ghost.style.opacity)).toBe(1);
    }

    // Ghosts sit at the PREV gridline positions.
    const ghostYs = ghosts.map((g) => num(g, 'y1')).sort((a, b) => a - b);
    for (const [i, y] of ghostYs.entries()) {
      expect(y).toBeCloseTo([...exitPositions].sort((a, b) => a - b)[i], 4);
    }
    // ...spanning the full plot width, horizontally.
    for (const ghost of ghosts) {
      expect(num(ghost, 'y1')).toBeCloseTo(num(ghost, 'y2'), 10);
      expect(num(ghost, 'x1')).toBeCloseTo(nextLayout.area.x, 4);
      expect(num(ghost, 'x2')).toBeCloseTo(nextLayout.area.x + nextLayout.area.width, 4);
    }

    // Mid-flight they are partly faded but have NOT moved.
    pumpRaf(150);
    for (const [i, ghost] of ghosts.entries()) {
      const o = Number(ghost.style.opacity);
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThan(1);
      expect(num(ghost, 'y1')).toBeCloseTo(exitPositions[i], 4);
    }

    // Exits run on the (shorter) exit duration, so they are done well before
    // the update duration expires.
    const exitDuration = nextLayout.animation?.exit?.duration ?? 300;
    expect(exitDuration).toBeLessThan(nextLayout.animation!.update!.duration);
    pumpRaf(exitDuration);
    for (const ghost of ghosts) {
      expect(Number(ghost.style.opacity)).toBeCloseTo(0, 6);
    }

    // On completion the ghosts are gone entirely.
    pumpRaf(2000);
    expect(gridlineGhosts(svg).length).toBe(0);
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
  });

  it('the real gridline elements left after an exit are only the next-layout ones', () => {
    const prevLayout = compile(columnSpec(DOMAIN_900));
    const nextLayout = compile(columnSpec(DOMAIN_20));
    const nextRender = render(nextLayout);
    const svg = render(nextLayout);

    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });
    runToCompletion();

    const after = Array.from(svg.querySelectorAll('.oc-axis-y .oc-gridline')).map((g) =>
      g.getAttribute('data-tick-key'),
    );
    const expected = Array.from(nextRender.querySelectorAll('.oc-axis-y .oc-gridline')).map((g) =>
      g.getAttribute('data-tick-key'),
    );
    expect(after).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Cancel / snap
// ---------------------------------------------------------------------------

describe('cancel snaps gridlines to final', () => {
  it('surviving and entering gridlines land on fresh-render geometry', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const nextRender = render(nextLayout);
    const svg = render(nextLayout);

    const handle = runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    // Interrupt mid-flight, while positions are provably interpolated.
    pumpRaf(0);
    pumpRaf(200);
    expect(num(gridlineByKey(svg, '15'), 'y1')).not.toBeCloseTo(
      num(gridlineByKey(nextRender, '15'), 'y1'),
      2,
    );

    handle.cancel();
    expect(handle.running).toBe(false);

    for (const key of gridlineKeys(nextLayout)) {
      const expected = gridlineByKey(nextRender, key)?.getAttribute('y1');
      const gl = gridlineByKey(svg, key);
      expect(gl?.getAttribute('y1')).toBe(expected);
      expect(gl?.getAttribute('y2')).toBe(expected);
    }
    // Entering gridline is snapped fully visible.
    expect(gridlineByKey(svg, '25')?.style.opacity).toBe('1');
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
  });

  it('exit ghosts are removed on cancel, not left dangling', () => {
    const prevLayout = compile(columnSpec(DOMAIN_900));
    const nextLayout = compile(columnSpec(DOMAIN_20));
    const nextRender = render(nextLayout);
    const svg = render(nextLayout);

    const handle = runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    pumpRaf(0);
    pumpRaf(120);
    expect(gridlineGhosts(svg).length).toBeGreaterThan(0);

    handle.cancel();

    expect(gridlineGhosts(svg).length).toBe(0);
    expect(svg.querySelectorAll('.oc-ghost').length).toBe(0);
    const after = Array.from(svg.querySelectorAll('.oc-axis-y .oc-gridline')).map((g) => [
      g.getAttribute('data-tick-key'),
      g.getAttribute('y1'),
    ]);
    const expected = Array.from(nextRender.querySelectorAll('.oc-axis-y .oc-gridline')).map((g) => [
      g.getAttribute('data-tick-key'),
      g.getAttribute('y1'),
    ]);
    expect(after).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Tick labels stay in lockstep with gridlines
//
// This matters because a later change gives canvas gridlines and SVG tick
// labels a shared clock: if they ever drift apart, labels detach from their
// lines mid-flight.
// ---------------------------------------------------------------------------

describe('tick labels stay in sync with gridlines', () => {
  it('label y matches gridline y at t=0, mid-flight, and at the end', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const svg = render(nextLayout);

    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    const survivingKeys = ['5', '10', '15', '20'];

    for (const t of [0, 125, 250, 375, 2000]) {
      pumpRaf(t);
      for (const key of survivingKeys) {
        const gl = gridlineByKey(svg, key);
        const label = tickLabelByKey(svg, key);
        expect(gl, `gridline ${key}`).not.toBeNull();
        expect(label, `label ${key}`).not.toBeNull();
        expect(num(label, 'y')).toBeCloseTo(num(gl, 'y1'), 6);
      }
    }
  });

  it('both actually moved mid-flight (not just trivially equal)', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const prevRender = render(prevLayout);
    const nextRender = render(nextLayout);
    const KEY = '20';
    const startY = num(gridlineByKey(prevRender, KEY), 'y1');
    const finalY = num(gridlineByKey(nextRender, KEY), 'y1');

    const svg = render(nextLayout);
    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    pumpRaf(0);
    pumpRaf(250);
    const glY = num(gridlineByKey(svg, KEY), 'y1');
    const labelY = num(tickLabelByKey(svg, KEY), 'y');
    for (const y of [glY, labelY]) {
      expect(y).toBeGreaterThan(Math.min(startY, finalY));
      expect(y).toBeLessThan(Math.max(startY, finalY));
    }
    expect(labelY).toBeCloseTo(glY, 6);
  });

  it('an entering gridline and its label fade in on the same clock', () => {
    const prevLayout = compile(columnSpec(DOMAIN_20));
    const nextLayout = compile(columnSpec(DOMAIN_25));
    const svg = render(nextLayout);

    runTransition({
      svg,
      prevLayout,
      nextLayout,
      animation: nextLayout.animation!,
      onComplete: () => {},
    });

    for (const t of [0, 150, 350, 2000]) {
      pumpRaf(t);
      const gl = gridlineByKey(svg, '25');
      const label = tickLabelByKey(svg, '25');
      expect(Number(label?.style.opacity)).toBeCloseTo(Number(gl?.style.opacity), 10);
    }
  });
});
