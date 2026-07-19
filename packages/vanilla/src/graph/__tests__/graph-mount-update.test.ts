/**
 * Phase 7: unified update() data-transition tests.
 *
 * happy-dom has no Worker, so all sim coverage runs the SYNC path. rAF is stubbed
 * and pumped deterministically (mirroring the entrance test infra), and the canvas
 * renderer is spied so tests can read the per-frame GraphRenderState (enterAlpha,
 * exiting ghosts).
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';
import { GraphCanvasRenderer } from '../canvas-renderer';
import { SimulationManager } from '../simulation';
import type { GraphRenderState } from '../types';

// ---------------------------------------------------------------------------
// Fixtures + infra
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
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

function graphSpec(nodeIds: string[], edges: Array<[string, string]>): GraphSpec {
  return {
    type: 'graph',
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: edges.map(([source, target]) => ({ source, target })),
  };
}

let container: HTMLElement;
let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;
let nowValue: number;
let renderStates: GraphRenderState[];
let renderSpy: ReturnType<typeof vi.spyOn>;

function pumpRaf(ts: number): void {
  nowValue = ts;
  const cbs = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of cbs) cb(ts);
}

/** Drain the deferred sync-warmup microtask, then pump frames to `ts`. */
async function settle(from = 0, to = 2000, step = 25): Promise<void> {
  await Promise.resolve();
  for (let t = from; t <= to; t += step) pumpRaf(t);
}

function lastState(): GraphRenderState {
  return renderStates[renderStates.length - 1];
}

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
  window.matchMedia = globalThis.matchMedia;
}

function stubCanvas2D(): void {
  const noop = () => {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 0 }) : noop),
    set: () => true,
  });
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (id: string) => unknown };
  proto.getContext = () => ctx;
}

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  nowValue = 0;
  renderStates = [];
  stubCanvas2D();
  stubMatchMedia(false);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafCallbacks.delete(id);
  });
  vi.stubGlobal('performance', { now: () => nowValue });
  renderSpy = vi.spyOn(GraphCanvasRenderer.prototype, 'render').mockImplementation(function (
    this: unknown,
    state: GraphRenderState,
  ) {
    renderStates.push(state);
  });
});

afterEach(() => {
  renderSpy.mockRestore();
  vi.unstubAllGlobals();
  if (container?.parentNode) container.parentNode.removeChild(container);
});

// ---------------------------------------------------------------------------
// Enter fade
// ---------------------------------------------------------------------------

describe('update() enter fade', () => {
  it('newly added node fades 0→1 over the update duration', async () => {
    container = makeContainer();
    const graph = createGraph(container, graphSpec(['a', 'b'], [['a', 'b']]));
    await settle();

    renderStates.length = 0;
    // Add node 'c' connected to survivor 'b'.
    graph.update(
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );

    // Immediately after update: 'c' present in enterAlpha at ~0.
    pumpRaf(nowValue + 1);
    const early = renderStates.find((s) => s.enterAlpha?.has('c'));
    expect(early).toBeDefined();
    expect(early!.enterAlpha!.get('c')).toBeLessThan(0.5);

    // Drive past update.duration (default 300ms): enterAlpha gone → full alpha.
    await settle(nowValue + 25, nowValue + 1500, 25);
    expect(lastState().enterAlpha).toBeUndefined();

    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// Exit ghosts
// ---------------------------------------------------------------------------

describe('update() exit ghosts', () => {
  it('removed node/edge become ghosts during the fade, then disappear', async () => {
    container = makeContainer();
    const graph = createGraph(
      container,
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );
    await settle();

    renderStates.length = 0;
    // Remove node 'c' and its edge.
    graph.update(graphSpec(['a', 'b'], [['a', 'b']]));

    pumpRaf(nowValue + 1);
    const withGhosts = renderStates.find((s) => s.exiting && s.exiting.alpha > 0);
    expect(withGhosts).toBeDefined();
    expect(withGhosts!.exiting!.nodes.map((n) => n.id)).toContain('c');
    expect(withGhosts!.exiting!.edges).toHaveLength(1);

    // Drive past exit.duration (default 300ms): ghosts gone.
    await settle(nowValue + 25, nowValue + 1500, 25);
    expect(lastState().exiting).toBeUndefined();

    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// No sim recreation on an identical update
// ---------------------------------------------------------------------------

describe('update() with identical spec', () => {
  it('does NOT recreate the simulation (visual-only path)', async () => {
    container = makeContainer();
    const spec = graphSpec(['a', 'b'], [['a', 'b']]);
    const graph = createGraph(container, spec);
    await settle();

    const createSpy = vi.spyOn(SimulationManager, 'create');
    // Same ids, same config (only re-passing the same spec).
    graph.update(graphSpec(['a', 'b'], [['a', 'b']]));
    await settle(nowValue + 25, nowValue + 500, 25);

    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
    graph.destroy();
  });

  it('DOES recreate the simulation when a node is added (structural path)', async () => {
    container = makeContainer();
    const graph = createGraph(container, graphSpec(['a', 'b'], [['a', 'b']]));
    await settle();

    const createSpy = vi.spyOn(SimulationManager, 'create');
    graph.update(
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );

    expect(createSpy).toHaveBeenCalledTimes(1);
    createSpy.mockRestore();
    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// Selection survival + pruning
// ---------------------------------------------------------------------------

describe('update() selection reconciliation', () => {
  it('deleted selected ids are pruned from the selection', async () => {
    container = makeContainer();
    const graph = createGraph(
      container,
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );
    await settle();

    // selectNode is single-select; select 'c' (the node we'll delete).
    graph.selectNode('c');
    expect(graph.getSelectedNodes()).toEqual(['c']);

    // Remove node 'c'. Its selection must be pruned.
    graph.update(graphSpec(['a', 'b'], [['a', 'b']]));
    await settle(nowValue + 25, nowValue + 500, 25);

    // 'c' is gone from the selection.
    expect(graph.getSelectedNodes()).not.toContain('c');

    graph.destroy();
  });

  it('a surviving selected node stays selected across an update', async () => {
    container = makeContainer();
    const graph = createGraph(
      container,
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );
    await settle();

    graph.selectNode('a');
    expect(graph.getSelectedNodes()).toEqual(['a']);

    // Remove 'c' (unrelated to 'a'). 'a' survives → stays selected.
    graph.update(graphSpec(['a', 'b'], [['a', 'b']]));
    await settle(nowValue + 25, nowValue + 500, 25);

    expect(graph.getSelectedNodes()).toEqual(['a']);
    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// Search survival
// ---------------------------------------------------------------------------

describe('update() search reconciliation', () => {
  it('re-runs the active query against the new graph', async () => {
    container = makeContainer();
    const graph = createGraph(container, graphSpec(['apple', 'banana'], [['apple', 'banana']]));
    await settle();

    graph.search('an'); // matches 'banana'
    expect(graph.getSearchMatches()).toEqual(['banana']);

    // Add 'mango' (also contains 'an'). After update the query re-runs.
    graph.update(
      graphSpec(
        ['apple', 'banana', 'mango'],
        [
          ['apple', 'banana'],
          ['banana', 'mango'],
        ],
      ),
    );
    await settle(nowValue + 25, nowValue + 800, 25);

    const matches = graph.getSearchMatches();
    expect(matches).toContain('banana');
    expect(matches).toContain('mango');
    graph.destroy();
  });

  it('drops matches for deleted nodes when the query re-runs', async () => {
    container = makeContainer();
    const graph = createGraph(container, graphSpec(['cat', 'car'], [['cat', 'car']]));
    await settle();

    graph.search('ca'); // matches both
    expect(graph.getSearchMatches()!.sort()).toEqual(['car', 'cat']);

    // Remove 'car'.
    graph.update(graphSpec(['cat'], []));
    await settle(nowValue + 25, nowValue + 800, 25);

    expect(graph.getSearchMatches()).toEqual(['cat']);
    graph.destroy();
  });
});

// ---------------------------------------------------------------------------
// updateVisuals alias
// ---------------------------------------------------------------------------

describe('updateVisuals deprecated alias', () => {
  it('routes through update() (structural change still reheats)', async () => {
    container = makeContainer();
    const graph = createGraph(container, graphSpec(['a', 'b'], [['a', 'b']]));
    await settle();

    const createSpy = vi.spyOn(SimulationManager, 'create');
    graph.updateVisuals(
      graphSpec(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
      ),
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
    createSpy.mockRestore();
    graph.destroy();
  });
});
