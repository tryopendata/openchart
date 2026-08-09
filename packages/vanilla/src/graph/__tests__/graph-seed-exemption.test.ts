/**
 * Seed-node dim exemption: `GraphRenderState.exemptIds` keeps the graph's
 * `seedNode` lit under a highlight/filter without lighting its neighborhood.
 *
 * The seed is deliberately NOT unioned into the highlight set — composeStandingFocus
 * expands the core set to `core ∪ neighbors(core)`, and a seed is by construction a
 * hub, so unioning it there would light most of the graph and defeat the category
 * filter. The regression test for that finding is
 * 'seed stays lit while its own neighbor dims under a category highlight'.
 *
 * happy-dom has no Worker, so all sim coverage runs the SYNC path; rAF is stubbed and
 * pumped deterministically and the canvas renderer is spied so tests can read the
 * per-frame GraphRenderState (mirroring graph-mount-update.test.ts).
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from '../../graph-mount';
import { GraphCanvasRenderer } from '../canvas-renderer';
import type { FocusSnapshot } from '../focus-transition';
import type { GraphRenderState, PositionedNode } from '../types';

// ---------------------------------------------------------------------------
// Alpha probe canvas: records the globalAlpha in effect at each arc/segment.
// ---------------------------------------------------------------------------

interface ProbedArc {
  x: number;
  y: number;
  alpha: number;
}
interface ProbedSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

function createAlphaProbe(): {
  canvas: HTMLCanvasElement;
  arcs: ProbedArc[];
  segments: ProbedSegment[];
  fills: number[];
} {
  const arcs: ProbedArc[] = [];
  const segments: ProbedSegment[] = [];
  const fills: number[] = [];
  let pen = { x: 0, y: 0 };
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
  };

  const methods: Record<string, (...args: never[]) => unknown> = {
    arc: ((x: number, y: number) => {
      arcs.push({ x, y, alpha: state.globalAlpha as number });
    }) as never,
    moveTo: ((x: number, y: number) => {
      pen = { x, y };
    }) as never,
    lineTo: ((x: number, y: number) => {
      segments.push({ x1: pen.x, y1: pen.y, x2: x, y2: y, alpha: state.globalAlpha as number });
      pen = { x, y };
    }) as never,
    fill: (() => {
      fills.push(state.globalAlpha as number);
    }) as never,
    measureText: (() => ({ width: 0 })) as never,
  };

  const noop = () => {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (prop in methods) return methods[prop];
      if (prop in state) return state[prop];
      return noop;
    },
    set(_t, prop: string, value: unknown) {
      state[prop] = value;
      return true;
    },
  });

  const canvas = {
    getContext: () => ctx,
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;

  return { canvas, arcs, segments, fills };
}

/** Alpha of the arc drawn at a node's position (node fills are drawn as arcs). */
function alphaAt(arcs: ProbedArc[], node: { x: number; y: number }): number | undefined {
  return arcs.find((a) => Math.abs(a.x - node.x) < 0.01 && Math.abs(a.y - node.y) < 0.01)?.alpha;
}

// ---------------------------------------------------------------------------
// Renderer-level: nodeTier honors exemptIds, edgeTier does not
// ---------------------------------------------------------------------------

function makeTheme() {
  return {
    isDark: false,
    colors: {
      categorical: ['#3b82f6', '#ef4444', '#22c55e'],
      sequential: {},
      diverging: {},
      background: '#ffffff',
      text: '#1a1a2e',
      gridline: '#cccccc',
      axis: '#666666',
      annotationFill: '#ffff00',
      annotationText: '#000000',
    },
    fonts: {
      family: 'Inter, sans-serif',
      mono: 'monospace',
      sizes: {
        title: 18,
        subtitle: 14,
        body: 12,
        small: 10,
        axisTick: 11,
        metricLabel: 10,
        metricValue: 22,
      },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    spacing: { padding: 16, chromeGap: 4, chromeToChart: 12, chartToFooter: 8, axisMargin: 40 },
    borderRadius: 4,
    chrome: {
      eyebrow: { fontSize: 11, fontWeight: 510, color: '#06b6d4', lineHeight: 1.4 },
      title: { fontSize: 18, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.2 },
      subtitle: { fontSize: 14, fontWeight: 400, color: '#666', lineHeight: 1.3 },
      source: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
      byline: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
      footer: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
    },
  } as GraphRenderState['theme'];
}

function makeNode(id: string, x: number, y: number): PositionedNode {
  return {
    id,
    x,
    y,
    index: 0,
    radius: 5,
    fill: '#3b82f6',
    stroke: '#2563eb',
    strokeWidth: 1,
    label: undefined,
    labelPriority: 0.5,
    community: undefined,
    data: {},
  } as PositionedNode;
}

/** `core` is lit; everything else dims. */
function focusOn(ids: string[]): FocusSnapshot {
  return {
    hasActive: true,
    connected: new Set(ids),
    searchMatches: null,
    selected: new Set(),
  };
}

describe('canvas renderer: exemptIds', () => {
  const seed = makeNode('seed', 100, 100);
  const neighbor = makeNode('neighbor', 200, 100);
  const lit = makeNode('lit', 300, 100);

  function renderWith(exemptIds?: Set<string>, searchMatches: Set<string> | null = null) {
    const probe = createAlphaProbe();
    const renderer = new GraphCanvasRenderer(probe.canvas);
    renderer.resize(800, 600);
    const focus = focusOn(['lit']);
    renderer.render({
      nodes: [seed, neighbor, lit],
      edges: [
        {
          source: 'seed',
          target: 'neighbor',
          sourceX: 100,
          sourceY: 100,
          targetX: 200,
          targetY: 100,
          stroke: '#999',
          strokeWidth: 1,
          style: 'solid',
          data: {},
        },
      ],
      transform: { x: 0, y: 0, k: 1 },
      hoveredNodeId: null,
      hoveredEdgeId: null,
      selectedNodeIds: new Set(),
      adjacencyMap: new Map([
        ['seed', new Set(['neighbor'])],
        ['neighbor', new Set(['seed'])],
      ]),
      theme: makeTheme(),
      searchMatches,
      exemptIds,
      isGesturing: false,
      watermark: false,
      dimOpacity: 0.15,
      focus: { t: 1, prev: focus, next: focus },
    });
    return probe;
  }

  it('an exempt node stays lit while everything unconnected dims', () => {
    const { arcs } = renderWith(new Set(['seed']));
    expect(alphaAt(arcs, seed)).toBe(1);
    expect(alphaAt(arcs, lit)).toBe(1);
    expect(alphaAt(arcs, neighbor)).toBe(0.15);
  });

  it('without exemptIds the same node dims', () => {
    const { arcs } = renderWith();
    expect(alphaAt(arcs, seed)).toBe(0.15);
  });

  it('the exemption covers hover/selection focus too, not just highlight', () => {
    // A hover snapshot is the same shape as a highlight one (layerHoverFocus
    // replaces `connected` wholesale), so nodeTier can't tell them apart and
    // the seed stays lit under a hover on an unrelated node. Documented as
    // "always-visible anchor" in GraphRenderState.exemptIds.
    const probe = createAlphaProbe();
    const renderer = new GraphCanvasRenderer(probe.canvas);
    renderer.resize(800, 600);
    const hover = focusOn(['lit']); // reader hovers 'lit', far from the seed
    renderer.render({
      nodes: [seed, neighbor, lit],
      edges: [],
      transform: { x: 0, y: 0, k: 1 },
      hoveredNodeId: 'lit',
      hoveredEdgeId: null,
      selectedNodeIds: new Set(),
      adjacencyMap: new Map(),
      theme: makeTheme(),
      searchMatches: null,
      exemptIds: new Set(['seed']),
      isGesturing: false,
      watermark: false,
      dimOpacity: 0.15,
      focus: { t: 1, prev: hover, next: hover },
    });
    expect(alphaAt(probe.arcs, seed)).toBe(1);
    expect(alphaAt(probe.arcs, neighbor)).toBe(0.15);
  });

  it('search dimming is NOT exempted (a non-matching seed dims like anything else)', () => {
    // Search runs as a separate alpha multiplier keyed off searchMatches, so
    // the exemption cannot reach it — by design.
    const { arcs } = renderWith(new Set(['seed']), new Set(['lit']));
    expect(alphaAt(arcs, seed)).toBeLessThan(1);
  });

  it("the exempt node's edges still dim (lit without lighting its neighborhood)", () => {
    const { segments } = renderWith(new Set(['seed']));
    // edgeTier is untouched: the seed→neighbor edge is dimmed (dimOpacity / 3).
    expect(segments).toHaveLength(1);
    expect(segments[0].alpha).toBeCloseTo(0.05, 5);
  });
});

// ---------------------------------------------------------------------------
// Mount-level
// ---------------------------------------------------------------------------

/**
 * The seed ('a') is deliberately NOT adjacent to the highlighted category ('y'),
 * so a passing test can't be explained by neighborhood expansion.
 */
function seedSpec(seedId = 'a'): GraphSpec {
  return {
    type: 'graph',
    nodes: [
      { id: 'a', label: 'A', kind: 'seed' },
      { id: 'b', label: 'B', kind: 'x' },
      { id: 'c', label: 'C', kind: 'y' },
      { id: 'd', label: 'D', kind: 'y' },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' },
    ],
    encoding: { nodeColor: { field: 'kind', type: 'nominal' } },
    seedNode: seedId,
  };
}

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

async function settle(from = 0, to = 2000, step = 25): Promise<void> {
  await Promise.resolve();
  for (let t = from; t <= to; t += step) pumpRaf(t);
}

function lastState(): GraphRenderState {
  return renderStates[renderStates.length - 1];
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

describe('seedNode dim exemption (mount)', () => {
  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 1;
    nowValue = 0;
    renderStates = [];
    stubCanvas2D();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
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

  it('seed stays lit while its own neighbor dims under a category highlight', async () => {
    container = makeContainer();
    const graph = createGraph(container, seedSpec());
    await settle();

    graph.highlight({ category: { field: 'kind', value: 'y' } });
    await settle(nowValue + 25, nowValue + 1500, 25);

    const state = lastState();
    expect(state.exemptIds).toEqual(new Set(['a']));
    // The seed is not in the focus core, so only the exemption keeps it lit.
    expect(state.focus?.next.connected.has('a')).toBe(false);

    // Draw the captured state for real and read the per-node alphas back.
    renderSpy.mockRestore();
    const probe = createAlphaProbe();
    const renderer = new GraphCanvasRenderer(probe.canvas);
    renderer.resize(800, 600);
    renderer.render(state);

    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    expect(alphaAt(probe.arcs, byId.get('a')!)).toBe(1);
    // 'b' is the seed's own neighbor and is not in the highlighted category.
    // Literal, not state.dimOpacity: sourcing the expectation from the object
    // under test would pass vacuously if both sides went undefined.
    expect(state.dimOpacity).toBe(0.15);
    expect(alphaAt(probe.arcs, byId.get('b')!)).toBe(0.15);
    expect(alphaAt(probe.arcs, byId.get('c')!)).toBe(1);

    graph.destroy();
  });

  it('getHighlight() and onHighlightChange exclude the seed under a category filter', async () => {
    container = makeContainer();
    const onHighlightChange = vi.fn();
    const graph = createGraph(container, seedSpec(), { onHighlightChange });
    await settle();

    graph.setActiveCategories(['y']);
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);
    expect(onHighlightChange).toHaveBeenLastCalledWith(['c', 'd']);

    graph.highlight({ category: { field: 'kind', value: 'y' } });
    expect(graph.getHighlight()?.sort()).toEqual(['c', 'd']);
    expect(onHighlightChange).toHaveBeenLastCalledWith(['c', 'd']);

    graph.destroy();
  });

  it('re-derives the exempt set across update()', async () => {
    container = makeContainer();
    const graph = createGraph(container, seedSpec('a'));
    await settle();
    expect(lastState().exemptIds).toEqual(new Set(['a']));

    graph.update(seedSpec('c'));
    await settle(nowValue + 25, nowValue + 1500, 25);
    expect(lastState().exemptIds).toEqual(new Set(['c']));

    graph.destroy();
  });
});
