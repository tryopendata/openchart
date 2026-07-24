/**
 * Keyed update transitions in canvas mark mode.
 *
 * This is the blog-morph scenario end to end: ~4.3k campus dots keyed by id,
 * some surviving, some entering, some leaving, with a trendline that has to
 * keep tweening on the SVG side while the dots move on canvas.
 *
 * Every assertion drives an explicit clock. `beginManualUpdate` + `step()` is
 * the probe of choice rather than the rAF loop: it reads layer state at an
 * exact elapsed time with no timing slop.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { type CanvasStub, stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';

let stub: CanvasStub;
let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

function setupRafMock() {
  rafCallbacks = new Map();
  nextRafId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
}

/** Pump all pending rAF callbacks at the given timestamp. */
function pumpRaf(timestamp: number) {
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of cbs) cb(timestamp);
}

beforeEach(() => {
  stub = stubCanvas2D();
  setupRafMock();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  stub.restore();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/**
 * A deterministic keyed scatter. `ids` selects which campuses exist, `shift`
 * moves every y so surviving points have somewhere to travel to.
 */
function scatter(
  ids: number[],
  shift: number,
  opts: { render?: 'canvas' | 'svg'; maxMarks?: number; trendline?: boolean } = {},
): ChartSpec {
  return {
    // Entrance off: gate 6 blocks updates while one is in flight, and an
    // entrance armed on mount would veto every transition under test. This is
    // also how the GIF/scrolly callers drive an update-only chart.
    animation: {
      enter: false,
      update: opts.maxMarks !== undefined ? { maxMarks: opts.maxMarks } : true,
    },
    mark: {
      type: 'point',
      ...(opts.render ? { render: opts.render } : {}),
      ...(opts.trendline ? { trendline: true } : {}),
    },
    data: ids.map((i) => ({ id: `p${i}`, x: i % 200, y: (i * 7 + shift) % 100 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

/** 2019 -> 2025: 4,198 campuses become 4,341, with 100 closing and 243 opening. */
const IDS_2019 = range(0, 4198);
const IDS_2025 = range(100, 4441);

/**
 * Count arcs belonging to FILL passes only.
 *
 * Ghosts and live points are filled; the separate stroke pass re-arcs the same
 * circles, so a raw `arc` count double-counts. Attributing each arc to whichever
 * of `fill`/`stroke` closes its path keeps the count one-per-visible-dot.
 */
function arcsClosedBy(closer: 'fill' | 'stroke'): number {
  let pending = 0;
  let total = 0;
  for (const call of stub.calls) {
    if (call.method === 'arc') pending++;
    else if (call.method === 'fill' || call.method === 'stroke') {
      if (call.method === closer) total += pending;
      pending = 0;
    }
  }
  return total;
}

const filledArcs = () => arcsClosedBy('fill');
const strokedArcs = () => arcsClosedBy('stroke');

/**
 * Arc centers from the LAST paint only.
 *
 * Several repaints can land in one window (render() rebuilds and paints, then
 * the from-state pass repaints over it). Each `render()` on the renderer starts
 * with a `clearRect`, so slicing at the final one isolates the frame that is
 * actually on screen.
 */
function lastFrameCenters(): string[] {
  let start = 0;
  for (let i = 0; i < stub.calls.length; i++) {
    if (stub.calls[i].method === 'clearRect') start = i;
  }
  return stub.calls
    .slice(start)
    .filter((c) => c.method === 'arc')
    .map((c) => `${(c.args[0] as number).toFixed(2)},${(c.args[1] as number).toFixed(2)}`);
}

function mountCanvas(spec: ChartSpec) {
  const container = createContainer(600, 400);
  const chart = createChart(container, spec, { width: 600, height: 400 });
  const canvas = container.querySelector('canvas.oc-mark-canvas') as HTMLCanvasElement;
  expect(canvas).not.toBeNull();
  return { container, chart };
}

describe('canvas keyed morph', () => {
  it('runs a transition for a 4,341-point keyed update', () => {
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();
    chart.destroy();
  });

  it('paints the rewound from-state synchronously, before the first step', () => {
    // render() already rebuilt the canvas at the DESTINATION geometry, so the
    // bitmap shows the final state until something repaints the rewound
    // arrays. rAF-runs-before-paint is an accident of ordering and manual mode
    // has no paint at all between beginManualUpdate() and the first step(), so
    // the from-state pass has to repaint itself.
    //
    // Probe geometry, not arc counts: the count is identical either way.
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));

    // Where the destination paints, captured from a clean mount of it.
    const dest = mountCanvas(scatter(IDS_2025, 33, { render: 'canvas' }));
    const destCenters = new Set(lastFrameCenters());
    dest.chart.destroy();

    stub.calls.length = 0;
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();

    // The last synchronous paint must be the REWOUND state. Overlap with the
    // destination is expected (points that barely move), but a bitmap left at
    // the destination would match it almost exactly.
    const painted = lastFrameCenters();
    expect(painted.length).toBeGreaterThan(0);
    const atDestination = painted.filter((k) => destCenters.has(k)).length;
    expect(atDestination / painted.length).toBeLessThan(0.5);

    chart.destroy();
  });

  it('paints on every manual step', () => {
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();

    const afterStart = stub.callsTo('arc').length;
    handle!.step(250);
    const afterStep = stub.callsTo('arc').length;
    expect(afterStep).toBeGreaterThan(afterStart);
    chart.destroy();
  });

  it('ghosts the exits and holds the enters back, then settles on exactly the survivors plus enters', () => {
    // 2019 -> 2025: 4,098 campuses survive, 100 close, 243 open.
    const SURVIVORS = 4098;
    const EXITS = 100;
    const ENTERS = 243;

    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();

    // t=120 is inside the exit fade (300ms) and before the enter delay
    // (40% of 500ms = 200ms), so: survivors drawn, exits ghosted, enters
    // still at alpha 0 and culled entirely.
    stub.calls.length = 0;
    handle!.step(120);
    expect(filledArcs()).toBe(SURVIVORS + EXITS);

    // Past the end: ghosts cleared, enters at full opacity.
    stub.calls.length = 0;
    handle!.step(5000);
    expect(filledArcs()).toBe(SURVIVORS + ENTERS);
    chart.destroy();
  });

  it('fades an entering point on the whole-mark channel, so its stroke fades too', () => {
    // Fading enters via `fillOpacity` would leave the stroke pass drawing a
    // full-opacity ring around an invisible fill -- and would also break SVG
    // parity, where `fill-opacity` never touches the stroke.
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();

    const SURVIVORS = 4098;
    const ENTERS = 243;

    stub.calls.length = 0;
    handle!.step(120); // before the enter delay: enters fully invisible
    // Ghosts are filled but never stroked, so the stroke pass sees exactly the
    // survivors. If the enter fade rode on `fillOpacity` instead, the stroke
    // pass would be blind to it and already be ringing all 4,341.
    expect(strokedArcs()).toBe(SURVIVORS);

    stub.calls.length = 0;
    handle!.step(5000);
    expect(strokedArcs()).toBe(SURVIVORS + ENTERS);
    chart.destroy();
  });

  it('keeps the SVG free of point circles and ghosts throughout', () => {
    // The whole point of canvas mode: 4k marks must never become 4k elements,
    // and exits must not mint ghost circles either.
    const { container, chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();

    const svg = container.querySelector('svg') as SVGElement;
    handle!.step(250);
    expect(svg.querySelectorAll('circle.oc-mark-point').length).toBe(0);
    expect(svg.querySelectorAll('circle.oc-ghost').length).toBe(0);
    chart.destroy();
  });

  it('lands on exactly the geometry a fresh render of the destination produces', () => {
    // The round-trip invariant: transitioning INTO a layout and rendering it
    // from scratch have to leave the same pixels. An off-by-an-eased-frame
    // snap would show up as a set difference here.
    const destSpec = scatter(IDS_2025, 33, { render: 'canvas' });

    const fresh = mountCanvas(destSpec);
    const reference = new Set(lastFrameCenters());
    fresh.chart.destroy();

    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    const handle = chart.beginManualUpdate(destSpec);
    expect(handle).not.toBeNull();
    stub.calls.length = 0;
    handle!.step(5000);

    const settled = new Set(lastFrameCenters());
    expect(settled.size).toBe(reference.size);
    expect([...settled].filter((k) => !reference.has(k))).toEqual([]);

    chart.destroy();
  });
});

describe('canvas transition gating', () => {
  it('runs above the SVG cap without any maxMarks override', () => {
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    expect(chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }))).not.toBeNull();
    chart.destroy();
  });

  it('falls back to an instant swap past the canvas cap', () => {
    const big = range(0, 20_002);
    const { chart } = mountCanvas(scatter(big, 0, { render: 'canvas' }));
    expect(chart.beginManualUpdate(scatter(big, 33, { render: 'canvas' }))).toBeNull();
    chart.destroy();
  });

  it('honors an explicit maxMarks above the canvas cap', () => {
    const big = range(0, 20_002);
    const { chart } = mountCanvas(scatter(big, 0, { render: 'canvas', maxMarks: 30_000 }));
    expect(
      chart.beginManualUpdate(scatter(big, 33, { render: 'canvas', maxMarks: 30_000 })),
    ).not.toBeNull();
    chart.destroy();
  });

  it('bars a canvas -> svg flip with mass exits (they would become SVG ghosts)', () => {
    // 4,341 canvas dots down to 400 SVG dots. Judging by the destination count
    // alone this looks trivially cheap, but the ~3,941 exits render as SVG
    // ghost circles in the destination mode -- exactly the jank the cap exists
    // to prevent.
    const container = createContainer(600, 400);
    const chart = createChart(container, scatter(IDS_2025, 0, { render: 'canvas' }), {
      width: 600,
      height: 400,
    });
    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();

    const handle = chart.beginManualUpdate(scatter(range(0, 400), 33, { render: 'svg' }));
    expect(handle).toBeNull();
    // The instant swap still happened: SVG mode, no canvas.
    expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();
    expect(container.querySelectorAll('circle.oc-mark-point').length).toBeGreaterThan(0);
    chart.destroy();
  });

  it('allows an svg -> canvas flip (exits paint on the canvas)', () => {
    const container = createContainer(600, 400);
    const chart = createChart(container, scatter(range(0, 400), 0, { render: 'svg' }), {
      width: 600,
      height: 400,
    });
    expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();

    const handle = chart.beginManualUpdate(scatter(range(50, 4341), 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();
    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();
    chart.destroy();
  });

  it('does nothing under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    expect(chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }))).toBeNull();
    chart.destroy();
  });
});

describe('canvas transition interruption', () => {
  it('retargets a second update from the interrupted positions', () => {
    const { chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));

    // Start an auto (rAF) transition and let it run partway.
    chart.update(scatter(IDS_2025, 33, { render: 'canvas' }));
    pumpRaf(0);
    pumpRaf(200);

    // Interrupt. The second update must produce a live handle -- a snapshot
    // that failed to key against the canvas arrays would leave nothing to
    // retarget, and this is where that shows up.
    const handle = chart.beginManualUpdate(scatter(IDS_2025, 66, { render: 'canvas' }));
    expect(handle).not.toBeNull();
    handle!.step(5000);
    chart.destroy();
  });

  it('survives an interruption across a canvas -> svg mode flip', () => {
    // The snapshot entries are plain `{type:'point'}` in both modes, so the
    // SVG builder can consume what the canvas tween froze.
    const container = createContainer(600, 400);
    const chart = createChart(container, scatter(range(0, 400), 0, { render: 'canvas' }), {
      width: 600,
      height: 400,
    });
    chart.update(scatter(range(0, 400), 33, { render: 'canvas' }));
    pumpRaf(0);
    pumpRaf(200);

    const handle = chart.beginManualUpdate(scatter(range(0, 400), 66, { render: 'svg' }));
    expect(handle).not.toBeNull();
    handle!.step(5000);
    chart.destroy();
  });
});

describe('canvas transition leaves the SVG layer working', () => {
  it('still tweens the trendline path while dots move on canvas', () => {
    const spec = (shift: number) => scatter(IDS_2019, shift, { render: 'canvas', trendline: true });
    const { container, chart } = mountCanvas(spec(0));

    const trend = container.querySelector('path.oc-mark-line, .oc-mark-line path');
    expect(trend).not.toBeNull();
    const finalD = trend!.getAttribute('d');

    const handle = chart.beginManualUpdate(
      scatter(IDS_2025, 33, { render: 'canvas', trendline: true }),
    );
    expect(handle).not.toBeNull();

    // Mid-flight the path must differ from the rendered destination: the
    // trendline is SVG even in canvas mode, and it has to keep animating.
    handle!.step(250);
    const midD = (
      container.querySelector('path.oc-mark-line, .oc-mark-line path') as SVGElement
    ).getAttribute('d');
    expect(midD).not.toBe(finalD);

    chart.destroy();
  });

  it('tweens axis tick labels on the SVG side', () => {
    const { container, chart } = mountCanvas(scatter(IDS_2019, 0, { render: 'canvas' }));
    // Gridlines moved to the canvas, but tick labels are still SVG and still
    // need to share the transition clock.
    expect(container.querySelectorAll('.oc-gridline').length).toBe(0);
    expect(container.querySelectorAll('.oc-axis-tick').length).toBeGreaterThan(0);

    const handle = chart.beginManualUpdate(scatter(IDS_2025, 33, { render: 'canvas' }));
    expect(handle).not.toBeNull();
    handle!.step(250);
    chart.destroy();
  });
});
