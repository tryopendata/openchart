import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
    { id: 'c', label: 'Node C' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
  chrome: {
    title: 'Test Graph',
    subtitle: 'A simple test graph',
  },
};

const communitySpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A', group: 'x' },
    { id: 'b', label: 'Node B', group: 'x' },
    { id: 'c', label: 'Node C', group: 'y' },
    { id: 'd', label: 'Node D', group: 'y' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'c', target: 'd' },
    { source: 'a', target: 'c' },
  ],
  layout: {
    clustering: { field: 'group' },
  },
  chrome: {
    title: 'Community Graph',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  // happy-dom doesn't auto-size elements; we need to provide dimensions
  // for getBoundingClientRect to return useful values
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  });
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

let container: HTMLElement;

afterEach(() => {
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGraph', () => {
  it('creates expected DOM structure (wrapper, canvas, chrome, legend)', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    // Wrapper
    const wrapper = container.querySelector('.oc-graph-wrapper');
    expect(wrapper).not.toBeNull();

    // Canvas
    const canvas = container.querySelector('.oc-graph-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName.toLowerCase()).toBe('canvas');

    // Chrome
    const chrome = container.querySelector('.oc-graph-chrome');
    expect(chrome).not.toBeNull();

    // Title
    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Test Graph');

    // Subtitle
    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toBe('A simple test graph');

    // Legend exists (even if hidden for non-community graphs)
    const legend = container.querySelector('.oc-graph-legend');
    expect(legend).not.toBeNull();

    graph.destroy();
  });

  it('destroy cleans up DOM and does not error on subsequent calls', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    expect(container.querySelector('.oc-graph-wrapper')).not.toBeNull();

    graph.destroy();

    expect(container.querySelector('.oc-graph-wrapper')).toBeNull();
    expect(container.querySelector('.oc-graph-canvas')).toBeNull();

    // Calling destroy again should not throw
    expect(() => graph.destroy()).not.toThrow();

    // Calling methods after destroy should not throw
    expect(() => graph.update(basicSpec)).not.toThrow();
    expect(() => graph.search('test')).not.toThrow();
    expect(() => graph.zoomToFit()).not.toThrow();
    expect(() => graph.resize()).not.toThrow();
    expect(graph.getSelectedNodes()).toEqual([]);
  });

  it('update re-initializes with new spec', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('Test Graph');

    graph.update(communitySpec);

    const titleAfter = container.querySelector('.oc-title');
    expect(titleAfter?.textContent).toBe('Community Graph');

    graph.destroy();
  });

  it('shows legend for community graphs', () => {
    container = makeContainer();
    const graph = createGraph(container, communitySpec);

    const legend = container.querySelector('.oc-graph-legend');
    expect(legend).not.toBeNull();
    // Community graph should have visible legend items
    const items = container.querySelectorAll('.oc-graph-legend-item');
    expect(items.length).toBeGreaterThan(0);

    graph.destroy();
  });

  it('search and clearSearch update without errors', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    expect(() => graph.search('Node')).not.toThrow();
    expect(() => graph.clearSearch()).not.toThrow();

    graph.destroy();
  });

  it('selectNode and getSelectedNodes work', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec);

    graph.selectNode('a');
    expect(graph.getSelectedNodes()).toEqual(['a']);

    graph.destroy();
  });

  it('applies oc-dark class in dark mode', () => {
    container = makeContainer();
    const graph = createGraph(container, basicSpec, { darkMode: 'force' });

    expect(container.classList.contains('oc-dark')).toBe(true);

    graph.destroy();
    expect(container.classList.contains('oc-dark')).toBe(false);
  });

  it('onSelectionChange callback fires on selectNode', () => {
    container = makeContainer();
    const onSelectionChange = vi.fn();
    const graph = createGraph(container, basicSpec, { onSelectionChange });

    graph.selectNode('b');
    expect(onSelectionChange).toHaveBeenCalledWith(['b']);

    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// Entrance choreography (Phase 6)
// ---------------------------------------------------------------------------

// A warmed spec so the sync path runs the pre-reveal warmup and the first
// delivered tick is already near-settled (the entrance's first frame).
const warmedSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
  ],
  layout: { warmup: 30 },
};

describe('createGraph entrance', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;
  let nowValue: number;

  function pumpRaf(ts: number): void {
    nowValue = ts;
    const cbs = [...rafCallbacks.entries()];
    rafCallbacks.clear();
    for (const [, cb] of cbs) cb(ts);
  }

  /** Stub matchMedia so prefers-reduced-motion returns `reduced`. */
  function stubMatchMedia(reduced: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }));
    // matchMedia is read off window in the mount.
    window.matchMedia = globalThis.matchMedia;
  }

  // happy-dom's canvas has no 2D context; return a no-op recorder so rendering
  // (driven by pumped rAF frames) doesn't throw on a null ctx.
  let restoreGetContext: (() => void) | null = null;
  function stubCanvas2D(): void {
    const noop = () => {};
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop) => {
        if (prop === 'setLineDash' || prop === 'measureText') {
          return prop === 'measureText' ? () => ({ width: 0 }) : noop;
        }
        return noop;
      },
      set: () => true,
    });
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (id: string) => unknown;
    };
    const original = proto.getContext;
    proto.getContext = () => ctx;
    restoreGetContext = () => {
      proto.getContext = original;
    };
  }

  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 1;
    nowValue = 0;
    stubCanvas2D();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      rafCallbacks.delete(id);
    });
    vi.stubGlobal('performance', { now: () => nowValue });
  });

  afterEach(() => {
    restoreGetContext?.();
    restoreGetContext = null;
    vi.unstubAllGlobals();
  });

  it('first frame is pulled back (≠ fit); post-duration it lands on the fit', async () => {
    container = makeContainer();
    const graph = createGraph(container, warmedSpec);

    // Drain the deferred warmup + first tick (fires startEntrance).
    await Promise.resolve();
    // Lock tween/flight start times at t=0.
    pumpRaf(0);

    const pulledBack = graph.getCamera();
    // The entrance starts at 0.92× the fit zoom — strictly less than the final.
    // Drive far past the reveal (duration 600) + the fit flight (+100) to settle.
    for (let t = 50; t <= 1400; t += 50) pumpRaf(t);
    const settled = graph.getCamera();

    // Pulled-back zoom is ~0.92 of the settled fit zoom.
    expect(pulledBack.k).toBeLessThan(settled.k);
    expect(pulledBack.k).toBeCloseTo(settled.k * 0.92, 5);

    graph.destroy();
  });

  it('under reduced motion: warmup runs but the reveal/flight is skipped (instant fit)', async () => {
    stubMatchMedia(true);
    container = makeContainer();
    const graph = createGraph(container, warmedSpec);

    await Promise.resolve();
    pumpRaf(0);

    const initial = graph.getCamera();
    // No reveal tween or flight was scheduled, so pumping further doesn't move it.
    for (let t = 50; t <= 1400; t += 50) pumpRaf(t);
    const later = graph.getCamera();

    expect(later.k).toBeCloseTo(initial.k, 6);
    expect(later.x).toBeCloseTo(initial.x, 6);
    expect(later.y).toBeCloseTo(initial.y, 6);
    // The instant fit is a real fit (finite, positive zoom), not the pulled-back
    // framing — i.e. reduced motion skipped the 0.92 pullback.
    expect(initial.k).toBeGreaterThan(0);

    graph.destroy();
  });

  it('resize mid-entrance keeps the reveal but re-fits to the new viewport', async () => {
    // A container whose rect can be shrunk mid-test.
    let rect = { width: 800, height: 600 };
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: rect.width,
        height: rect.height,
        top: 0,
        left: 0,
        bottom: rect.height,
        right: rect.width,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);

    const graph = createGraph(container, warmedSpec);

    await Promise.resolve();
    pumpRaf(0);
    // Advance partway through the reveal (duration 600), fit flight in progress.
    pumpRaf(200);
    const beforeResize = graph.getCamera();

    // Shrink the container, then resize. The in-flight fit flight must cancel and
    // snap to the new-viewport fit without throwing; the reveal keeps running.
    rect = { width: 400, height: 300 };
    expect(() => graph.resize()).not.toThrow();

    // Drive to completion — no errors writing to a live SVG/transform.
    for (let t = 250; t <= 1400; t += 50) pumpRaf(t);
    const afterResize = graph.getCamera();
    expect(Number.isFinite(afterResize.k)).toBe(true);
    expect(afterResize.k).toBeGreaterThan(0);
    // The camera actually moved for the smaller viewport.
    expect(afterResize).not.toEqual(beforeResize);

    graph.destroy();
  });
});
