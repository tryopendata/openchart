import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { GraphCanvasRenderer, labelThreshold, visibleRect } from '../canvas-renderer';
import type { GraphRenderState, PositionedEdge, PositionedNode } from '../types';

// ---------------------------------------------------------------------------
// Recording canvas context proxy
// ---------------------------------------------------------------------------

interface DrawCall {
  method: string;
  args: unknown[];
  /** globalAlpha in effect at fill/stroke time. */
  alpha?: number;
}

function createRecordingCanvas(): {
  canvas: HTMLCanvasElement;
  calls: DrawCall[];
} {
  const calls: DrawCall[] = [];

  // Methods we want to track
  const trackedMethods = [
    'clearRect',
    'fillRect',
    'beginPath',
    'arc',
    'fill',
    'stroke',
    'moveTo',
    'lineTo',
    'fillText',
    'strokeText',
    'save',
    'restore',
    'translate',
    'scale',
    'setTransform',
    'setLineDash',
  ];

  const fakeCtx: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
  };

  for (const method of trackedMethods) {
    fakeCtx[method] = (...args: unknown[]) => {
      // Snapshot the alpha in effect when a stroke/fill lands, so crossfade
      // tests can assert per-batch blended alpha (globalAlpha is mutable).
      if (method === 'fill' || method === 'stroke') {
        calls.push({ method, args, alpha: fakeCtx.globalAlpha as number });
      } else {
        calls.push({ method, args });
      }
    };
  }

  const canvas = {
    getContext: () => fakeCtx,
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;

  return { canvas, calls };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTheme(isDark = false): ResolvedTheme {
  return {
    isDark,
    colors: {
      categorical: ['#3b82f6', '#ef4444', '#22c55e'],
      sequential: {},
      diverging: {},
      background: isDark ? '#1a1a2e' : '#ffffff',
      text: isDark ? '#e0e0e0' : '#1a1a2e',
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
    spacing: {
      padding: 16,
      chromeGap: 4,
      chromeToChart: 12,
      chartToFooter: 8,
      axisMargin: 40,
    },
    borderRadius: 4,
    chrome: {
      eyebrow: { fontSize: 11, fontWeight: 510, color: '#06b6d4', lineHeight: 1.4 },
      title: { fontSize: 18, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.2 },
      subtitle: { fontSize: 14, fontWeight: 400, color: '#666', lineHeight: 1.3 },
      source: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
      byline: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
      footer: { fontSize: 10, fontWeight: 400, color: '#999', lineHeight: 1.2 },
    },
  };
}

function makeNode(overrides: Partial<PositionedNode> & { id: string }): PositionedNode {
  return {
    x: 0,
    y: 0,
    index: 0,
    radius: 5,
    fill: '#3b82f6',
    stroke: '#2563eb',
    strokeWidth: 1,
    label: undefined,
    labelPriority: 0.5,
    community: undefined,
    data: {},
    ...overrides,
  };
}

function makeEdge(
  source: string,
  target: string,
  overrides?: Partial<PositionedEdge>,
): PositionedEdge {
  return {
    source,
    target,
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    stroke: '#999',
    strokeWidth: 1,
    style: 'solid',
    data: {},
    ...overrides,
  };
}

function makeState(overrides?: Partial<GraphRenderState>): GraphRenderState {
  return {
    nodes: [],
    edges: [],
    transform: { x: 0, y: 0, k: 1 },
    hoveredNodeId: null,
    selectedNodeIds: new Set(),
    adjacencyMap: new Map(),
    theme: makeTheme(),
    searchMatches: null,
    isGesturing: false,
    watermark: false,
    dimOpacity: 0.15,
    ...overrides,
  } as GraphRenderState;
}

// ---------------------------------------------------------------------------
// Tests: labelThreshold
// ---------------------------------------------------------------------------

describe('labelThreshold', () => {
  it('returns ~1 at very low zoom (only top priority labels visible)', () => {
    const t = labelThreshold(0.2);
    expect(t).toBeCloseTo(1, 5);
  });

  it('returns ~0 at high zoom (all labels visible)', () => {
    const t = labelThreshold(2.0);
    expect(t).toBeCloseTo(0, 5);
  });

  it('returns ~0.5 at midpoint zoom', () => {
    const t = labelThreshold(1.1);
    expect(t).toBeCloseTo(0.5, 1);
  });

  it('clamps below 0.2 zoom', () => {
    expect(labelThreshold(0.05)).toBe(1);
  });

  it('clamps above 2.0 zoom', () => {
    expect(labelThreshold(5.0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: visibleRect
// ---------------------------------------------------------------------------

describe('visibleRect', () => {
  it('computes correct bounds with identity transform', () => {
    const rect = visibleRect(800, 600, { x: 0, y: 0, k: 1 }, 0);
    expect(rect.minX).toBeCloseTo(0);
    expect(rect.minY).toBeCloseTo(0);
    expect(rect.maxX).toBe(800);
    expect(rect.maxY).toBe(600);
  });

  it('accounts for pan offset', () => {
    const rect = visibleRect(800, 600, { x: 100, y: 50, k: 1 }, 0);
    expect(rect).toEqual({ minX: -100, minY: -50, maxX: 700, maxY: 550 });
  });

  it('accounts for zoom', () => {
    const rect = visibleRect(800, 600, { x: 0, y: 0, k: 2 }, 0);
    expect(rect.minX).toBeCloseTo(0);
    expect(rect.minY).toBeCloseTo(0);
    expect(rect.maxX).toBe(400);
    expect(rect.maxY).toBe(300);
  });

  it('includes margin', () => {
    const rect = visibleRect(800, 600, { x: 0, y: 0, k: 1 }, 50);
    expect(rect.minX).toBe(-50);
    expect(rect.minY).toBe(-50);
    expect(rect.maxX).toBe(850);
    expect(rect.maxY).toBe(650);
  });

  it('handles combined pan + zoom', () => {
    // Canvas 400x300, pan(200, 100), zoom 2x
    const rect = visibleRect(400, 300, { x: 200, y: 100, k: 2 }, 0);
    expect(rect.minX).toBeCloseTo(-100);
    expect(rect.minY).toBeCloseTo(-50);
    expect(rect.maxX).toBeCloseTo(100);
    expect(rect.maxY).toBeCloseTo(100);
  });
});

// ---------------------------------------------------------------------------
// Tests: DPR scaling
// ---------------------------------------------------------------------------

describe('GraphCanvasRenderer.resize', () => {
  it('sets canvas pixel dimensions with DPR scaling', () => {
    const { canvas } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    // DPR is 1 in happy-dom (no window.devicePixelRatio), so canvas = css size
    renderer.resize(800, 600);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    // CSS sizing is handled by width/height: 100% in graph.css,
    // so resize() no longer sets inline style dimensions
  });
});

// ---------------------------------------------------------------------------
// Tests: Render draw order
// ---------------------------------------------------------------------------

describe('GraphCanvasRenderer.render', () => {
  let canvas: HTMLCanvasElement;
  let calls: DrawCall[];
  let renderer: GraphCanvasRenderer;

  beforeEach(() => {
    const recording = createRecordingCanvas();
    canvas = recording.canvas;
    calls = recording.calls;
    renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);
  });

  it('clears canvas before drawing', () => {
    renderer.render(makeState());
    const clearIdx = calls.findIndex((c) => c.method === 'clearRect');
    expect(clearIdx).toBeGreaterThanOrEqual(0);
  });

  it('draws edges before nodes', () => {
    const nodes = [makeNode({ id: 'a', x: 100, y: 100 }), makeNode({ id: 'b', x: 200, y: 200 })];
    const edges = [makeEdge('a', 'b', { sourceX: 100, sourceY: 100, targetX: 200, targetY: 200 })];

    renderer.render(
      makeState({
        nodes,
        edges,
        adjacencyMap: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a'])],
        ]),
      }),
    );

    // Find first edge draw (moveTo) and first node draw (arc for fill)
    const firstMoveTo = calls.findIndex((c) => c.method === 'moveTo');
    const firstArc = calls.findIndex((c) => c.method === 'arc');

    expect(firstMoveTo).toBeLessThan(firstArc);
  });

  it('draws labels after nodes', () => {
    const nodes = [makeNode({ id: 'a', x: 100, y: 100, label: 'Node A', labelPriority: 1 })];

    renderer.render(makeState({ nodes }));

    // Find last arc (node drawing) and first fillText (label drawing)
    let lastArc = -1;
    let firstFillText = -1;
    for (let i = 0; i < calls.length; i++) {
      if (calls[i].method === 'arc') lastArc = i;
      if (calls[i].method === 'fillText' && firstFillText === -1) firstFillText = i;
    }

    expect(lastArc).toBeGreaterThan(-1);
    expect(firstFillText).toBeGreaterThan(lastArc);
  });

  it('culls nodes outside viewport', () => {
    const nodes = [
      makeNode({ id: 'visible', x: 400, y: 300 }),
      makeNode({ id: 'offscreen', x: 5000, y: 5000 }),
    ];

    renderer.render(makeState({ nodes }));

    // Count arcs -- only the visible node should produce arcs
    const arcCalls = calls.filter((c) => c.method === 'arc');
    // 1 visible node => 1 arc in fill batch + 1 arc in stroke batch = 2 arcs
    expect(arcCalls.length).toBe(2);
  });

  it('renders dashed edges with setLineDash', () => {
    const nodes = [makeNode({ id: 'a', x: 100, y: 100 }), makeNode({ id: 'b', x: 200, y: 200 })];
    const edges = [
      makeEdge('a', 'b', {
        style: 'dashed',
        sourceX: 100,
        sourceY: 100,
        targetX: 200,
        targetY: 200,
      }),
    ];

    renderer.render(makeState({ nodes, edges }));

    const dashCalls = calls.filter(
      (c) =>
        c.method === 'setLineDash' &&
        Array.isArray(c.args[0]) &&
        (c.args[0] as number[]).length > 0,
    );
    expect(dashCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Recording canvas with property tracking
// ---------------------------------------------------------------------------

interface PropertyChange {
  property: string;
  value: unknown;
}

interface DrawCallWithContext {
  method: string;
  args: unknown[];
}

/**
 * Extended recording canvas that also captures property assignments
 * (fillStyle, strokeStyle, globalAlpha, etc.) interleaved with draw calls.
 * Returns a timeline of operations in order.
 */
function createTrackingCanvas(): {
  canvas: HTMLCanvasElement;
  calls: DrawCallWithContext[];
  props: PropertyChange[];
  timeline: Array<{ type: 'call' | 'prop'; index: number }>;
} {
  const calls: DrawCallWithContext[] = [];
  const props: PropertyChange[] = [];
  const timeline: Array<{ type: 'call' | 'prop'; index: number }> = [];

  const trackedMethods = [
    'clearRect',
    'fillRect',
    'beginPath',
    'arc',
    'fill',
    'stroke',
    'moveTo',
    'lineTo',
    'fillText',
    'strokeText',
    'save',
    'restore',
    'translate',
    'scale',
    'setTransform',
    'setLineDash',
  ];

  const trackedProps = ['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth'];
  const internalState: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
  };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (typeof target[prop] === 'function') return target[prop];
      return internalState[prop];
    },
    set(_target, prop: string, value: unknown) {
      internalState[prop] = value;
      if (trackedProps.includes(prop)) {
        props.push({ property: prop, value });
        timeline.push({ type: 'prop', index: props.length - 1 });
      }
      return true;
    },
  };

  const fakeCtxTarget: Record<string, unknown> = {};
  for (const method of trackedMethods) {
    fakeCtxTarget[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      timeline.push({ type: 'call', index: calls.length - 1 });
    };
  }

  const fakeCtx = new Proxy(fakeCtxTarget, handler);

  const canvas = {
    getContext: () => fakeCtx,
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;

  return { canvas, calls, props, timeline };
}

// ---------------------------------------------------------------------------
// Tests: Community coloring
// ---------------------------------------------------------------------------

describe('community coloring', () => {
  it('nodes in same community share fill color', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    // Two nodes in community A, one in community B
    // Community coloring is handled upstream (compilation assigns fill colors),
    // so we give same-community nodes the same fill here
    const nodes = [
      makeNode({ id: 'a1', x: 100, y: 100, fill: '#3b82f6', community: 'groupA' }),
      makeNode({ id: 'a2', x: 200, y: 100, fill: '#3b82f6', community: 'groupA' }),
      makeNode({ id: 'b1', x: 300, y: 100, fill: '#ef4444', community: 'groupB' }),
    ];

    renderer.render(makeState({ nodes }));

    // Collect all fillStyle values set during rendering
    const fillStyles = props
      .filter((p) => p.property === 'fillStyle')
      .map((p) => p.value as string);

    // The community A color and community B color should both appear
    expect(fillStyles).toContain('#3b82f6');
    expect(fillStyles).toContain('#ef4444');
  });

  it('distinct communities produce distinct fill colors in draw calls', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodes = [
      makeNode({ id: 'a', x: 100, y: 100, fill: '#aaa', community: 'A' }),
      makeNode({ id: 'b', x: 200, y: 200, fill: '#bbb', community: 'B' }),
    ];

    renderer.render(makeState({ nodes }));

    const fillStyles = props
      .filter((p) => p.property === 'fillStyle')
      .map((p) => p.value as string);

    expect(fillStyles).toContain('#aaa');
    expect(fillStyles).toContain('#bbb');
  });
});

// ---------------------------------------------------------------------------
// Tests: Hover highlighting
// ---------------------------------------------------------------------------

describe('hover highlighting', () => {
  it('hovered node drawn with full opacity, others at default', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodes = [
      makeNode({ id: 'hovered', x: 100, y: 100, fill: '#3b82f6' }),
      makeNode({ id: 'other', x: 200, y: 200, fill: '#ef4444' }),
    ];

    renderer.render(
      makeState({
        nodes,
        hoveredNodeId: 'hovered',
        adjacencyMap: new Map(),
      }),
    );

    // The hovered node is drawn as a "special" node individually.
    // Its globalAlpha should be 1 (full opacity) before its arc call.
    // We check that globalAlpha=1 appears before at least one arc call.
    const alphaValues = props
      .filter((p) => p.property === 'globalAlpha')
      .map((p) => p.value as number);

    // Should have at least one globalAlpha=1 for the hovered node
    expect(alphaValues).toContain(1);
  });

  it('hovered node uses brightened fill color', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const originalFill = '#3b82f6';
    const nodes = [makeNode({ id: 'hovered', x: 100, y: 100, fill: originalFill })];

    renderer.render(makeState({ nodes, hoveredNodeId: 'hovered' }));

    // The hovered node should have a fillStyle that is NOT the original
    // (it's brightened by +40 per channel). The hovered node is drawn individually
    // as a "special" node, so we should see a brightened fill somewhere.
    const fillStyles = props
      .filter((p) => p.property === 'fillStyle')
      .map((p) => p.value as string);

    // brighten('#3b82f6') would produce something like rgb(99, 170, 246+40 capped)
    // The brightened color should be different from the original
    const hasBrightened = fillStyles.some((f) => f.startsWith('rgb(') && f !== originalFill);
    expect(hasBrightened).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Search highlighting
// ---------------------------------------------------------------------------

describe('search highlighting', () => {
  it('matching nodes drawn at full opacity, non-matching dimmed', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodes = [
      makeNode({ id: 'match', x: 100, y: 100, fill: '#3b82f6' }),
      makeNode({ id: 'no-match', x: 200, y: 200, fill: '#3b82f6' }),
    ];

    renderer.render(
      makeState({
        nodes,
        searchMatches: new Set(['match']),
      }),
    );

    const alphaValues = props
      .filter((p) => p.property === 'globalAlpha')
      .map((p) => p.value as number);

    // Should see full opacity (1) for matched nodes
    expect(alphaValues).toContain(1);
    // Should see dimmed opacity (0.15) for non-matching nodes
    expect(alphaValues).toContain(0.15);
  });

  it('search-dimmed edges use reduced opacity', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodes = [
      makeNode({ id: 'a', x: 100, y: 100 }),
      makeNode({ id: 'b', x: 200, y: 200 }),
      makeNode({ id: 'c', x: 300, y: 300 }),
    ];
    const edges = [
      makeEdge('a', 'b', { sourceX: 100, sourceY: 100, targetX: 200, targetY: 200 }),
      makeEdge('b', 'c', { sourceX: 200, sourceY: 200, targetX: 300, targetY: 300 }),
    ];

    renderer.render(
      makeState({
        nodes,
        edges,
        searchMatches: new Set(['a']),
        adjacencyMap: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a', 'c'])],
          ['c', new Set(['b'])],
        ]),
      }),
    );

    const alphaValues = props
      .filter((p) => p.property === 'globalAlpha')
      .map((p) => p.value as number);

    // Should have reduced alpha for non-matching edges (0.15 * base alpha)
    const hasDimmed = alphaValues.some((a) => a > 0 && a < 0.15 + 0.01);
    expect(hasDimmed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Selected nodes
// ---------------------------------------------------------------------------

describe('selected nodes', () => {
  it('selected node drawn with selection ring (extra arc at radius + 3)', () => {
    const { canvas, calls } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodeRadius = 10;
    const nodes = [makeNode({ id: 'selected', x: 200, y: 200, radius: nodeRadius })];

    renderer.render(
      makeState({
        nodes,
        selectedNodeIds: new Set(['selected']),
      }),
    );

    // Selected nodes draw a fill arc (stroke reuses same path), then a
    // selection ring arc at radius + 3. So at least 2 arcs total.
    const arcCalls = calls.filter((c) => c.method === 'arc');
    expect(arcCalls.length).toBeGreaterThanOrEqual(2);

    // The selection ring arc should be at radius + 3 = 13
    const selectionRingArc = arcCalls.find((c) => {
      const radius = c.args[2] as number;
      return Math.abs(radius - (nodeRadius + 3)) < 0.5;
    });
    expect(selectionRingArc).not.toBeUndefined();
  });

  it('selection ring uses theme categorical color', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const theme = makeTheme();
    const nodes = [makeNode({ id: 'selected', x: 200, y: 200, radius: 10 })];

    renderer.render(
      makeState({
        nodes,
        selectedNodeIds: new Set(['selected']),
        theme,
      }),
    );

    const strokeStyles = props
      .filter((p) => p.property === 'strokeStyle')
      .map((p) => p.value as string);

    // Selection ring should use theme.colors.categorical[0]
    expect(strokeStyles).toContain(theme.colors.categorical[0]);
  });

  it('selection ring has lineWidth of 2', () => {
    const { canvas, props } = createTrackingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(800, 600);

    const nodes = [makeNode({ id: 'selected', x: 200, y: 200, radius: 10 })];

    renderer.render(
      makeState({
        nodes,
        selectedNodeIds: new Set(['selected']),
      }),
    );

    const lineWidths = props
      .filter((p) => p.property === 'lineWidth')
      .map((p) => p.value as number);

    // Should see lineWidth=2 for the selection ring
    expect(lineWidths).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: focus crossfade + node dim tiers (Phase 5a)
// ---------------------------------------------------------------------------

import type { FocusSnapshot } from '../focus-transition';

function snapshot(over: Partial<FocusSnapshot> = {}): FocusSnapshot {
  return {
    hasActive: false,
    connected: new Set(),
    searchMatches: null,
    selected: new Set(),
    ...over,
  };
}

describe('focus crossfade', () => {
  // Two edges: one connected under the hovered node, one not.
  const nodes = [
    makeNode({ id: 'a', x: 0, y: 0 }),
    makeNode({ id: 'b', x: 10, y: 10 }),
    makeNode({ id: 'c', x: 50, y: 50 }),
  ];
  const edges = [
    makeEdge('a', 'b', { sourceX: 0, sourceY: 0, targetX: 10, targetY: 10 }),
    makeEdge('b', 'c', { sourceX: 10, sourceY: 10, targetX: 50, targetY: 50 }),
  ];
  const restingFocus = snapshot();
  const hoverFocus = snapshot({ hasActive: true, connected: new Set(['a', 'b']) });

  function edgeStrokeAlphas(calls: DrawCall[]): number[] {
    return calls.filter((c) => c.method === 'stroke' && c.alpha !== undefined).map((c) => c.alpha!);
  }

  it('mid-transition edge alphas fall strictly between resting and connected tiers', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(200, 200);
    renderer.render(
      makeState({
        nodes,
        edges,
        // Crossfade from resting (all default 0.35) → hover (a-b connected 1.0,
        // b-c dimmed 0.05). At t=0.5 the connected edge blends to 0.675, the
        // dimmed edge to 0.2.
        focus: { t: 0.5, prev: restingFocus, next: hoverFocus },
      }),
    );
    const alphas = edgeStrokeAlphas(calls);
    // connected a-b: lerp(0.35, 1.0, 0.5) = 0.675
    expect(alphas.some((a) => Math.abs(a - 0.675) < 1e-6)).toBe(true);
    // dimmed b-c: lerp(0.35, 0.05, 0.5) = 0.2
    expect(alphas.some((a) => Math.abs(a - 0.2) < 1e-6)).toBe(true);
    // Nothing is left at a pure tier value mid-flight.
    expect(alphas).not.toContain(0.35);
  });

  it('settled focus (t=1) uses the fast 3-bucket path at exact tier alphas', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(200, 200);
    renderer.render(
      makeState({ nodes, edges, focus: { t: 1, prev: hoverFocus, next: hoverFocus } }),
    );
    const alphas = edgeStrokeAlphas(calls);
    // connected a-b at 1.0, dimmed b-c at dimOpacity/3 = 0.05.
    expect(alphas).toContain(1);
    expect(alphas.some((a) => Math.abs(a - 0.05) < 1e-6)).toBe(true);
  });

  it('dims bulk (non-neighbor) node fills under an active focus', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(200, 200);
    renderer.render(
      makeState({ nodes, edges, focus: { t: 1, prev: hoverFocus, next: hoverFocus } }),
    );
    // Node c is not connected → its fill batch draws at dimOpacity (0.15).
    const fillAlphas = calls
      .filter((c) => c.method === 'fill' && c.alpha !== undefined)
      .map((c) => c.alpha!);
    expect(fillAlphas.some((a) => Math.abs(a - 0.15) < 1e-6)).toBe(true);
  });

  it('honors a custom dimOpacity for both node and edge dim tiers', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(200, 200);
    renderer.render(
      makeState({
        nodes,
        edges,
        dimOpacity: 0.3,
        focus: { t: 1, prev: hoverFocus, next: hoverFocus },
      }),
    );
    const edgeAlphas = edgeStrokeAlphas(calls);
    // edge dim tier = dimOpacity/3 = 0.1
    expect(edgeAlphas.some((a) => Math.abs(a - 0.1) < 1e-6)).toBe(true);
    const fillAlphas = calls
      .filter((c) => c.method === 'fill' && c.alpha !== undefined)
      .map((c) => c.alpha!);
    // node dim tier = dimOpacity = 0.3
    expect(fillAlphas.some((a) => Math.abs(a - 0.3) < 1e-6)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: label halo keyed on theme.isDark (Phase 5e)
// ---------------------------------------------------------------------------

describe('label halo on transparent background', () => {
  function haloColor(isDark: boolean): string {
    const strokeStyles: string[] = [];
    const { canvas } = createRecordingCanvas();
    // Intercept strokeStyle assignments around strokeText.
    const ctx = canvas.getContext('2d') as unknown as Record<string, unknown>;
    let lastStroke = '';
    Object.defineProperty(ctx, 'strokeStyle', {
      get: () => lastStroke,
      set: (v: string) => {
        lastStroke = v;
      },
      configurable: true,
    });
    ctx.strokeText = () => strokeStyles.push(lastStroke);

    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(200, 200);
    const theme = makeTheme(isDark);
    theme.colors.background = 'transparent';
    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', label: 'A', labelPriority: 1 })],
        theme,
        transform: { x: 0, y: 0, k: 2 },
      }),
    );
    return strokeStyles[0] ?? '';
  }

  it('dark mode → dark halo behind light text', () => {
    expect(haloColor(true)).toBe('rgba(0, 0, 0, 0.7)');
  });

  it('light mode → light halo behind dark text', () => {
    expect(haloColor(false)).toBe('rgba(255, 255, 255, 0.85)');
  });
});

// ---------------------------------------------------------------------------
// Entrance reveal ramp
// ---------------------------------------------------------------------------

describe('GraphCanvasRenderer entrance', () => {
  it('mid-entrance node fills use a ramped alpha (0.6 + 0.4·t), below 1', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 })],
        // Global fade (no stagger): nodeT = t = 0.5 → alpha 0.6 + 0.4·0.5 = 0.8.
        entrance: { t: 0.5, stagger: false },
      }),
    );

    const fills = calls.filter((c) => c.method === 'fill' && c.alpha !== undefined);
    expect(fills.length).toBeGreaterThan(0);
    const nodeFill = fills.find((c) => (c.alpha ?? 1) < 1);
    expect(nodeFill).toBeDefined();
    expect(nodeFill!.alpha).toBeCloseTo(0.8, 5);
  });

  it('settled (t≥1) renders at full alpha — entrance is a no-op', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 })],
        entrance: { t: 1, stagger: false },
      }),
    );

    const fills = calls.filter((c) => c.method === 'fill' && c.alpha !== undefined);
    // No ramped (sub-1) node fill: the entrance path is skipped at t≥1.
    expect(fills.every((c) => (c.alpha ?? 1) >= 1 - 1e-9)).toBe(true);
  });

  it('edges lag 30% behind the reveal (edge alpha 0 until t>0.3)', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 }), makeNode({ id: 'b', index: 1, x: 100 })],
        edges: [makeEdge('a', 'b')],
        // At t=0.2 (< 0.3 lag), the edge alpha scales to 0 → invisible stroke.
        entrance: { t: 0.2, stagger: false },
      }),
    );

    // Edges are stroked before nodes; the edge stroke lands at alpha 0 (fully
    // lagged), while node strokes ramp to 0.68 (0.6 + 0.4·0.2). So the very
    // first stroke recorded is the edge, and it must be transparent.
    const strokes = calls.filter((c) => c.method === 'stroke' && c.alpha !== undefined);
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[0].alpha).toBe(0);
    // At least one stroke (the edge) is fully lagged to 0.
    expect(strokes.some((c) => c.alpha === 0)).toBe(true);
  });

  it('past the 30% lag, edges fade in (edge alpha > 0)', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 }), makeNode({ id: 'b', index: 1, x: 100 })],
        edges: [makeEdge('a', 'b')],
        // t=0.65 → edgeAlpha = (0.65-0.3)/0.7 = 0.5, scaling the 0.35 default edge
        // alpha to 0.175. The first stroke (edge) is now visible.
        entrance: { t: 0.65, stagger: false },
      }),
    );

    const strokes = calls.filter((c) => c.method === 'stroke' && c.alpha !== undefined);
    expect(strokes[0].alpha).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Data-update transitions (Phase 7): enter fade + exit ghosts
// ---------------------------------------------------------------------------

describe('GraphCanvasRenderer update transitions', () => {
  it('enterAlpha dims a newly-added node (multiplied into its fill alpha)', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 })],
        enterAlpha: new Map([['a', 0.25]]),
      }),
    );

    const fills = calls.filter((c) => c.method === 'fill' && c.alpha !== undefined);
    const faded = fills.find((c) => Math.abs((c.alpha ?? 1) - 0.25) < 1e-6);
    expect(faded).toBeDefined();
  });

  it('a node absent from enterAlpha renders at full alpha', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0 }), makeNode({ id: 'b', index: 1, x: 50 })],
        // Only 'a' is fading; 'b' is a survivor → full alpha.
        enterAlpha: new Map([['a', 0.5]]),
      }),
    );

    const fills = calls.filter((c) => c.method === 'fill' && c.alpha !== undefined);
    expect(fills.some((c) => Math.abs((c.alpha ?? 0) - 1) < 1e-6)).toBe(true);
    expect(fills.some((c) => Math.abs((c.alpha ?? 0) - 0.5) < 1e-6)).toBe(true);
  });

  it('exit ghosts are drawn UNDER the live marks at the ghost fade alpha', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    const ghostNode = makeNode({ id: 'gone', index: 0, x: 10, y: 10 });
    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0, x: 20, y: 20 })],
        exiting: { nodes: [ghostNode], edges: [], alpha: 0.4 },
      }),
    );

    // A ghost fill lands at the ghost alpha (0.4).
    const fills = calls.filter((c) => c.method === 'fill' && c.alpha !== undefined);
    const ghostFill = fills.find((c) => Math.abs((c.alpha ?? 1) - 0.4) < 1e-6);
    expect(ghostFill).toBeDefined();

    // Ghosts paint UNDER live marks: the first fill (index-wise) is the ghost.
    const firstFillIdx = calls.findIndex((c) => c.method === 'fill');
    const liveFillIdx = calls.findIndex(
      (c) => c.method === 'fill' && Math.abs((c.alpha ?? 0) - 1) < 1e-6,
    );
    expect(firstFillIdx).toBeLessThan(liveFillIdx);
    expect(calls[firstFillIdx].alpha).toBeCloseTo(0.4, 6);
  });

  it('exit ghost edges are stroked at the faded default edge alpha', () => {
    const { canvas, calls } = createRecordingCanvas();
    const renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(400, 400);

    const gn1 = makeNode({ id: 'x', index: 0, x: 0, y: 0 });
    const gn2 = makeNode({ id: 'y', index: 1, x: 100, y: 100 });
    renderer.render(
      makeState({
        nodes: [makeNode({ id: 'a', index: 0, x: 20, y: 20 })],
        exiting: {
          nodes: [gn1, gn2],
          edges: [makeEdge('x', 'y')],
          alpha: 0.5,
        },
      }),
    );

    // Ghost edge stroke = EDGE_ALPHA_DEFAULT (0.35) × ghost alpha (0.5) = 0.175.
    const strokes = calls.filter((c) => c.method === 'stroke' && c.alpha !== undefined);
    expect(strokes.some((c) => Math.abs((c.alpha ?? 0) - 0.175) < 1e-6)).toBe(true);
  });
});
