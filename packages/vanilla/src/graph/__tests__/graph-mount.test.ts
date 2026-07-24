import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';
import { SimulationManager } from '../simulation';
import { SpatialIndex } from '../spatial-index';

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
    // The entrance starts at 0.7× the fit zoom — strictly less than the final.
    // Drive far past the reveal (duration 600) + the fit flight (+100) to settle.
    for (let t = 50; t <= 1400; t += 50) pumpRaf(t);
    const settled = graph.getCamera();

    // Pulled-back zoom is 0.7 of the settled fit zoom (a readable pull-in).
    expect(pulledBack.k).toBeLessThan(settled.k);
    expect(pulledBack.k).toBeCloseTo(settled.k * 0.7, 5);

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
    // framing — i.e. reduced motion skipped the 0.7 pullback.
    expect(initial.k).toBeGreaterThan(0);

    graph.destroy();
  });

  it('user wheel zoom fires the coalesced onCameraChange', async () => {
    container = makeContainer();
    const onCameraChange = vi.fn();
    const graph = createGraph(container, warmedSpec, { onCameraChange });
    await Promise.resolve();
    pumpRaf(0);
    for (let t = 50; t <= 1400; t += 50) pumpRaf(t);
    onCameraChange.mockClear();

    const canvas = container.querySelector('canvas')!;
    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 300, bubbles: true }),
    );
    pumpRaf(1450);

    expect(onCameraChange).toHaveBeenCalled();
    const cam = onCameraChange.mock.calls.at(-1)?.[0] as { x: number; y: number; k: number };
    expect(cam.k).toBeGreaterThan(0);
    graph.destroy();
  });

  it('zoomToNode keeps following the settling node after the flight completes', async () => {
    container = makeContainer();
    const onCameraChange = vi.fn();
    const graph = createGraph(container, warmedSpec, { onCameraChange });
    await Promise.resolve();
    // Only a few frames: the sim must still be hot (alpha ≥ 0.05) when the
    // flight lands, otherwise there's nothing left to follow.
    pumpRaf(0);
    pumpRaf(50);
    pumpRaf(100);

    graph.zoomToNode('b', { duration: 100 });
    pumpRaf(150); // locks the flight start time
    pumpRaf(250); // flight completes (duration 100)
    onCameraChange.mockClear();

    // The sim is still settling, so the post-flight follow keeps snapping the
    // camera to the node — observable as per-frame camera events.
    pumpRaf(300);
    pumpRaf(350);
    expect(onCameraChange).toHaveBeenCalled();
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

  it('suppressEntrance: first camera is the instant fit (no 0.7 pullback, no reveal tween)', async () => {
    container = makeContainer();
    // Same warmed spec that DOES animate an entrance without suppressEntrance —
    // the only difference here is the mount option.
    const graph = createGraph(container, warmedSpec, { suppressEntrance: true });

    await Promise.resolve();
    pumpRaf(0);

    const initial = graph.getCamera();
    // No reveal tween or fit flight was scheduled: pumping further doesn't move it.
    for (let t = 50; t <= 1400; t += 50) pumpRaf(t);
    const later = graph.getCamera();

    expect(later.k).toBeCloseTo(initial.k, 6);
    expect(later.x).toBeCloseTo(initial.x, 6);
    expect(later.y).toBeCloseTo(initial.y, 6);
    // A real fit (finite, positive zoom), not the pulled-back 0.7 framing.
    expect(initial.k).toBeGreaterThan(0);

    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// Phase 8 — physics-feel gates (springy drag + cursor repulsion)
//
// happy-dom has no Worker, so the mount drives the SYNC SimulationManager. We
// spy on its setPointer/pinNode/unpinNode to observe exactly what the mount
// emits under each gate, and dispatch canvas mouse events to trigger the flow.
// ---------------------------------------------------------------------------

describe('createGraph physics-feel gates', () => {
  let setPointerSpy: ReturnType<typeof vi.spyOn>;
  let pinSpy: ReturnType<typeof vi.spyOn>;
  let unpinSpy: ReturnType<typeof vi.spyOn>;
  let nowValue: number;
  let restoreGetContext: (() => void) | null = null;

  function stubCanvas2D(): void {
    const noop = () => {};
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop) =>
        prop === 'measureText' ? () => ({ width: 0 }) : prop === 'setLineDash' ? noop : noop,
      set: () => true,
    });
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (id: string) => unknown };
    const original = proto.getContext;
    proto.getContext = () => ctx;
    restoreGetContext = () => {
      proto.getContext = original;
    };
  }

  function stubMatchMedia(reduced: boolean): void {
    const impl = (query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    });
    vi.stubGlobal('matchMedia', impl);
    window.matchMedia = globalThis.matchMedia;
  }

  /** A canvas mousemove at screen (cx, cy). */
  function moveMouse(canvas: Element, cx: number, cy: number): void {
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true }));
  }

  /** A specific number of nodes in a loose chain (keeps compile cheap). */
  function bigSpec(n: number, interaction: GraphSpec['interaction']): GraphSpec {
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
    const edges = Array.from({ length: n - 1 }, (_, i) => ({
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    // warmupTicks 0 keeps these large-graph tests fast; positions don't matter
    // for the gate assertions (we spy on the emitted physics calls).
    return { type: 'graph', nodes, edges, interaction, layout: { warmup: false } };
  }

  beforeEach(() => {
    nowValue = 0;
    stubCanvas2D();
    stubMatchMedia(false);
    vi.stubGlobal('performance', { now: () => nowValue });
    setPointerSpy = vi.spyOn(SimulationManager.prototype, 'setPointer');
    pinSpy = vi.spyOn(SimulationManager.prototype, 'pinNode');
    unpinSpy = vi.spyOn(SimulationManager.prototype, 'unpinNode');
  });

  afterEach(() => {
    restoreGetContext?.();
    restoreGetContext = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('default graph: no pointer feed emitted on mousemove', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(4, undefined));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    nowValue = 100;
    moveMouse(canvas, 400, 300);
    moveMouse(canvas, 410, 310);

    // Cursor repulsion off by default → the mount never feeds pointer positions.
    expect(setPointerSpy).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('cursorRepulsion on + small graph: mousemove feeds the pointer (throttled)', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(4, { cursorRepulsion: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    // First move at t=100 posts; a move within the ~33ms window is throttled.
    nowValue = 100;
    moveMouse(canvas, 400, 300);
    nowValue = 110;
    moveMouse(canvas, 405, 305);
    // A move past the throttle window posts again.
    nowValue = 200;
    moveMouse(canvas, 420, 320);

    const activeCalls = setPointerSpy.mock.calls.filter((c) => c[2] === true);
    expect(activeCalls.length).toBe(2);
    graph.destroy();
  });

  it('cursorRepulsion on but reduced motion: no pointer feed', async () => {
    stubMatchMedia(true);
    container = makeContainer();
    const graph = createGraph(container, bigSpec(4, { cursorRepulsion: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    nowValue = 100;
    moveMouse(canvas, 400, 300);
    nowValue = 200;
    moveMouse(canvas, 420, 320);

    // Ambient pointer-driven motion is exactly what reduced-motion suppresses.
    expect(setPointerSpy).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('cursorRepulsion on but graph > 2000 nodes: no pointer feed', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(2001, { cursorRepulsion: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    nowValue = 100;
    moveMouse(canvas, 400, 300);
    nowValue = 200;
    moveMouse(canvas, 420, 320);

    expect(setPointerSpy).not.toHaveBeenCalled();
    graph.destroy();
  });

  it('mouseleave deactivates the pointer feed when cursor repulsion is on', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(4, { cursorRepulsion: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    nowValue = 100;
    moveMouse(canvas, 400, 300);
    canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    const deactivate = setPointerSpy.mock.calls.filter((c) => c[2] === false);
    expect(deactivate.length).toBe(1);
    graph.destroy();
  });

  /**
   * Drive one full node drag (down → move → up). Hit-testing is made
   * deterministic by forcing SpatialIndex.findNearest to return a stub node, so
   * the drag reliably commits regardless of happy-dom's zero-size canvas rect.
   */
  function dragSomeNode(canvas: Element): void {
    const hit = vi
      .spyOn(SpatialIndex.prototype, 'findNearest')
      .mockReturnValue({ id: 'n0', x: 0, y: 0, index: 0, radius: 5 } as never);
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 400, clientY: 300, bubbles: true }),
    );
    // First move commits the drag (onNodeDragStart → pinNode).
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 410, clientY: 310, bubbles: true }),
    );
    canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 410, clientY: 310, bubbles: true }));
    hit.mockRestore();
  }

  it('springyDrag on + small graph: drag pins with alphaTarget 0.3, releases with 0', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(6, { springyDrag: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    dragSomeNode(canvas);

    // Springy: pin carries alphaTarget 0.3, unpin carries 0.
    expect(pinSpy.mock.calls[0][3]).toBe(0.3);
    expect(unpinSpy.mock.calls[0][1]).toBe(0);
    graph.destroy();
  });

  it('springyDrag off (default): drag pins with NO alphaTarget (legacy)', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(6, undefined));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    dragSomeNode(canvas);

    // Legacy: the springy arg is absent (undefined) on both pin and unpin.
    expect(pinSpy.mock.calls[0][3]).toBeUndefined();
    expect(unpinSpy.mock.calls[0][1]).toBeUndefined();
    graph.destroy();
  });

  // Building 5,001 nodes takes ~1s on its own; the 5s default leaves too little
  // headroom once the rest of the suite is competing for the machine.
  it('springyDrag on but graph > 5000 nodes: drag stays legacy (no alphaTarget)', async () => {
    container = makeContainer();
    const graph = createGraph(container, bigSpec(5001, { springyDrag: true }));
    await Promise.resolve();
    const canvas = container.querySelector('.oc-graph-canvas')!;

    dragSomeNode(canvas);

    // Above the gate, springy is off → legacy pin/unpin (no alphaTarget field).
    expect(pinSpy.mock.calls[0][3]).toBeUndefined();
    expect(unpinSpy.mock.calls[0][1]).toBeUndefined();
    graph.destroy();
  }, 20_000);
});
