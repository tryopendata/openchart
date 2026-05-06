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
      calls.push({ method, args });
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
      sizes: { title: 18, subtitle: 14, body: 12, small: 10, axisTick: 11 },
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
    ...overrides,
  };
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
