import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScatterCanvasRenderer } from '../renderer';
import type { ScatterCanvasState, ScatterPointsSoA } from '../types';
import { type CanvasStub, stubCanvas2D } from './canvas-stub';

let stub: CanvasStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
  vi.unstubAllGlobals();
});

function soa(
  points: { x: number; y: number; r: number; fill: string; stroke?: string; sw?: number }[],
): ScatterPointsSoA {
  const n = points.length;
  const s: ScatterPointsSoA = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    r: new Float32Array(n),
    fill: [],
    fillOpacity: new Float32Array(n),
    stroke: [],
    strokeWidth: new Float32Array(n),
    keys: [],
    markIds: [],
    animationIndex: new Uint32Array(n),
    data: [],
  };
  points.forEach((p, i) => {
    s.x[i] = p.x;
    s.y[i] = p.y;
    s.r[i] = p.r;
    s.fill.push(p.fill);
    s.fillOpacity[i] = 1;
    s.stroke.push(p.stroke ?? '');
    s.strokeWidth[i] = p.sw ?? 0;
    s.keys.push(undefined);
    s.markIds.push(`point-${i}`);
    s.data.push({});
  });
  return s;
}

function makeState(overrides: Partial<ScatterCanvasState> = {}): ScatterCanvasState {
  return {
    width: 400,
    height: 300,
    clipRect: { x: 0, y: 10, width: 400, height: 260 },
    background: '#ffffff',
    marks: soa([]),
    gridlines: [],
    gridlineStroke: '#eeeeee',
    gridlineWidth: 1,
    plotRect: { x: 40, y: 20, width: 340, height: 220 },
    accent: '#3b82f6',
    enterAlpha: null,
    exiting: null,
    hoverIndex: -1,
    ...overrides,
  };
}

describe('ScatterCanvasRenderer DPR handling', () => {
  it('caps the backing store scale at 2', () => {
    stub = stubCanvas2D();
    vi.stubGlobal('devicePixelRatio', 4);
    const canvas = document.createElement('canvas');
    const renderer = new ScatterCanvasRenderer(canvas);
    renderer.resize(400, 300);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('re-reads devicePixelRatio on every resize', () => {
    stub = stubCanvas2D();
    vi.stubGlobal('devicePixelRatio', 1);
    const canvas = document.createElement('canvas');
    const renderer = new ScatterCanvasRenderer(canvas);
    renderer.resize(400, 300);
    expect(canvas.width).toBe(400);

    // Dragging the window to a Retina display changes DPR mid-life.
    vi.stubGlobal('devicePixelRatio', 2);
    renderer.resize(400, 300);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });
});

/**
 * `fillStyle` values assigned for point fills, i.e. everything after the
 * full-bleed background write that `render()` performs first.
 */
function pointFillStyles(s: CanvasStub): unknown[] {
  const all = s.sets.filter((set) => set.prop === 'fillStyle').map((set) => set.value);
  // Assert rather than blind-slice: if the background write ever stops being
  // first, dropping [0] would silently swallow a real point fill and the
  // color-elision assertions would start passing for the wrong reason.
  expect(all[0], 'expected the full-bleed background fill first').toBe('#ffffff');
  return all.slice(1);
}

describe('ScatterCanvasRenderer per-point compositing', () => {
  /**
   * The renderer deliberately does NOT merge points into shared paths.
   *
   * Merging unions overlapping circles inside one path, so a single `fill()` at
   * `globalAlpha` fades the whole cluster once instead of letting each dot
   * composite -- dense translucent scatters rendered washed out. These tests
   * pin the call shape; `e2e/invariants/canvas-alpha-parity.spec.ts` pins the
   * resulting pixels, which is the part a recording stub cannot see.
   */
  it('issues one fill() per point rather than one per color bucket', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    const points = Array.from({ length: 50 }, (_, i) => ({
      x: 50 + i,
      y: 100,
      r: 3,
      fill: '#ff0000',
    }));
    renderer.render(makeState({ marks: soa(points) }));

    // 50 points => 50 fills and 50 arcs. A single fill() here would mean the
    // path batching regressed and translucent overlaps stopped accumulating.
    expect(stub.callsTo('fill')).toHaveLength(50);
    expect(stub.callsTo('arc')).toHaveLength(50);
    // 50 point paths + the one `render()` opens for the clip rect.
    expect(stub.callsTo('beginPath')).toHaveLength(51);
  });

  it('skips redundant fillStyle writes across a same-color run', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        marks: soa([
          { x: 50, y: 100, r: 3, fill: '#ff0000' },
          { x: 60, y: 100, r: 3, fill: '#00ff00' },
          { x: 70, y: 100, r: 3, fill: '#ff0000' },
        ]),
      }),
    );

    // Every point still gets its own fill()...
    expect(stub.callsTo('fill')).toHaveLength(3);
    // ...but the three colors here alternate, so all three assignments stand.
    // Drop the leading background write (makeState paints '#ffffff' full-bleed).
    expect(pointFillStyles(stub)).toEqual(['#ff0000', '#00ff00', '#ff0000']);
  });

  it('collapses fillStyle writes when consecutive points share a color', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        marks: soa([
          { x: 50, y: 100, r: 3, fill: '#ff0000' },
          { x: 60, y: 100, r: 3, fill: '#ff0000' },
          { x: 70, y: 100, r: 3, fill: '#00ff00' },
        ]),
      }),
    );

    expect(stub.callsTo('fill')).toHaveLength(3);
    // The second red point reuses the style already set by the first.
    expect(pointFillStyles(stub)).toEqual(['#ff0000', '#00ff00']);
  });

  it('strokes each point individually and skips zero-width strokes', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        marks: soa([
          { x: 50, y: 100, r: 3, fill: '#f00', stroke: '#000', sw: 1 },
          { x: 60, y: 100, r: 3, fill: '#f00', stroke: '#000', sw: 1 },
          { x: 70, y: 100, r: 3, fill: '#f00', stroke: '#000', sw: 2 },
          { x: 80, y: 100, r: 3, fill: '#f00' },
        ]),
      }),
    );

    // Three stroked points => three stroke() calls; the zero-width one is
    // skipped entirely. No gridlines here, so every stroke() is a point stroke.
    expect(stub.callsTo('stroke')).toHaveLength(3);
    // lineWidth changes only where the width actually changes (1 -> 2).
    const widths = stub.sets.filter((s) => s.prop === 'lineWidth').map((s) => s.value);
    expect(widths).toEqual([1, 2]);
  });

  it('culls points outside the clip rect', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        clipRect: { x: 0, y: 100, width: 400, height: 100 },
        marks: soa([
          { x: 50, y: 150, r: 3, fill: '#f00' },
          { x: 50, y: 10, r: 3, fill: '#f00' },
          { x: 50, y: 290, r: 3, fill: '#f00' },
        ]),
      }),
    );
    expect(stub.callsTo('arc')).toHaveLength(1);
  });

  it('batches gridlines into one stroke per alpha', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        gridlines: [
          { orient: 'y', position: 50, alpha: 0.6 },
          { orient: 'y', position: 100, alpha: 0.6 },
          { orient: 'x', position: 120, alpha: 0.6 },
        ],
      }),
    );
    expect(stub.callsTo('stroke')).toHaveLength(1);
    expect(stub.callsTo('moveTo')).toHaveLength(3);
    expect(stub.callsTo('lineTo')).toHaveLength(3);
  });
});

describe('ScatterCanvasRenderer paint order', () => {
  it('clips to the state clip rect after painting the background', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(makeState({ clipRect: { x: 0, y: 12, width: 400, height: 250 } }));

    const rectCalls = stub.callsTo('rect');
    expect(rectCalls).toHaveLength(1);
    expect(rectCalls[0].args).toEqual([0, 12, 400, 250]);
    expect(stub.callsTo('clip')).toHaveLength(1);

    const order = stub.calls.map((c) => c.method);
    expect(order.indexOf('fillRect')).toBeLessThan(order.indexOf('clip'));
    expect(order.indexOf('save')).toBeLessThan(order.indexOf('clip'));
  });

  it('paints exit ghosts before live points', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        marks: soa([{ x: 100, y: 150, r: 4, fill: '#0000ff' }]),
        exiting: {
          x: new Float32Array([200]),
          y: new Float32Array([150]),
          r: new Float32Array([4]),
          fill: ['#ff00ff'],
          alpha: 0.5,
        },
      }),
    );

    const ghostFill = stub.sets.findIndex((s) => s.prop === 'fillStyle' && s.value === '#ff00ff');
    const liveFill = stub.sets.findIndex((s) => s.prop === 'fillStyle' && s.value === '#0000ff');
    expect(ghostFill).toBeGreaterThanOrEqual(0);
    expect(ghostFill).toBeLessThan(liveFill);
    expect(stub.callsTo('fill')).toHaveLength(2);
  });

  it('draws a hover ring at r + 2 in the accent color', () => {
    stub = stubCanvas2D();
    const renderer = new ScatterCanvasRenderer(document.createElement('canvas'));
    renderer.resize(400, 300);
    renderer.render(
      makeState({
        marks: soa([{ x: 100, y: 150, r: 4, fill: '#0000ff' }]),
        hoverIndex: 0,
        accent: '#3b82f6',
      }),
    );

    const arcs = stub.callsTo('arc');
    // One arc for the fill pass, one for the hover ring.
    expect(arcs).toHaveLength(2);
    expect(arcs[1].args.slice(0, 3)).toEqual([100, 150, 6]);
    expect(stub.sets.some((s) => s.prop === 'strokeStyle' && s.value === '#3b82f6')).toBe(true);
  });
});

describe('ScatterCanvasRenderer without a 2D context', () => {
  it('renders as a no-op instead of throwing', () => {
    stub = stubCanvas2D('null');
    const canvas = document.createElement('canvas');
    const renderer = new ScatterCanvasRenderer(canvas);
    renderer.resize(400, 300);
    expect(() =>
      renderer.render(makeState({ marks: soa([{ x: 10, y: 10, r: 2, fill: '#f00' }]) })),
    ).not.toThrow();
    expect(stub.calls).toHaveLength(0);
  });
});
