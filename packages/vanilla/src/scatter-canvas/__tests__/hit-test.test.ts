import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScatterCanvasLayer, type ScatterCanvasLayer } from '../layer';
import { type CanvasStub, stubCanvas2D } from './canvas-stub';

/** Hit tolerances mirrored from `interactions.ts` (mouse vs touch). */
const MOUSE_TOLERANCE = 8;
const TOUCH_TOLERANCE = 24;

function gridLayout(): ChartLayout {
  const spec = {
    mark: 'point',
    data: [
      { a: 1, b: 1 },
      { a: 2, b: 2 },
      { a: 3, b: 3 },
      { a: 4, b: 4 },
    ],
    encoding: {
      x: { field: 'a', type: 'quantitative' },
      y: { field: 'b', type: 'quantitative' },
    },
  } as ChartSpec;
  return compileChart(spec, { width: 600, height: 400 });
}

/** Overwrite the layer's point geometry with a deterministic set. */
function seedPoints(
  layer: ScatterCanvasLayer,
  points: { x: number; y: number; r: number }[],
): void {
  const marks = layer.state.marks;
  if (points.length > marks.n) throw new Error('fixture needs at least as many compiled points');
  marks.n = points.length;
  points.forEach((p, i) => {
    marks.x[i] = p.x;
    marks.y[i] = p.y;
    marks.r[i] = p.r;
  });
  layer.rebuildIndex();
}

describe('ScatterCanvasLayer.hitTest', () => {
  let stub: CanvasStub;
  let container: HTMLElement;
  let layer: ScatterCanvasLayer;

  beforeEach(() => {
    stub = stubCanvas2D();
    container = document.createElement('div');
    document.body.appendChild(container);
    layer = createScatterCanvasLayer(container, gridLayout());
  });

  afterEach(() => {
    layer.destroy();
    container.remove();
    stub.restore();
  });

  it('returns the point whose circle contains the pointer', () => {
    seedPoints(layer, [
      { x: 100, y: 100, r: 5 },
      { x: 300, y: 100, r: 5 },
    ]);
    const hit = layer.hitTest(102, 101, MOUSE_TOLERANCE);
    expect(hit?.index).toBe(0);
  });

  it('picks the nearest point by edge distance, accounting for radius', () => {
    // Point 1's center is farther away but its radius makes it the closer edge.
    seedPoints(layer, [
      { x: 100, y: 100, r: 1 },
      { x: 112, y: 100, r: 10 },
    ]);
    const hit = layer.hitTest(106, 100, MOUSE_TOLERANCE);
    expect(hit?.index).toBe(1);
  });

  it('returns null when nothing is within the mouse tolerance', () => {
    seedPoints(layer, [{ x: 100, y: 100, r: 4 }]);
    // Edge distance = 20 - 4 = 16 > 8.
    expect(layer.hitTest(120, 100, MOUSE_TOLERANCE)).toBeNull();
  });

  it('hits at touch tolerance what it misses at mouse tolerance', () => {
    seedPoints(layer, [{ x: 100, y: 100, r: 4 }]);
    expect(layer.hitTest(120, 100, MOUSE_TOLERANCE)).toBeNull();
    expect(layer.hitTest(120, 100, TOUCH_TOLERANCE)?.index).toBe(0);
  });

  it('reflects moved points only after rebuildIndex', () => {
    seedPoints(layer, [{ x: 100, y: 100, r: 4 }]);
    layer.state.marks.x[0] = 300;
    // The index is not rebuilt per frame, so the stale position still hits.
    expect(layer.hitTest(300, 100, MOUSE_TOLERANCE)).toBeNull();
    layer.rebuildIndex();
    expect(layer.hitTest(300, 100, MOUSE_TOLERANCE)?.index).toBe(0);
  });
});

describe('createScatterCanvasLayer', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    stub = stubCanvas2D();
  });

  afterEach(() => {
    stub.restore();
  });

  it('creates an aria-hidden, top-left anchored canvas sized to the figure', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const layout = gridLayout();
    const layer = createScatterCanvasLayer(container, layout);

    expect(layer.canvas.className).toBe('oc-mark-canvas');
    expect(layer.canvas.getAttribute('aria-hidden')).toBe('true');
    expect(layer.canvas.style.position).toBe('absolute');
    expect(layer.canvas.style.left).toBe('0px');
    expect(layer.canvas.style.top).toBe('0px');
    expect(layer.canvas.style.width).toBe(`${layout.dimensions.width}px`);
    expect(layer.canvas.style.height).toBe(`${layout.dimensions.height}px`);
    expect(container.querySelector('canvas')).toBe(layer.canvas);

    layer.destroy();
    expect(container.querySelector('canvas')).toBeNull();
    container.remove();
  });

  it('tracks interaction suspension', () => {
    const container = document.createElement('div');
    const layer = createScatterCanvasLayer(container, gridLayout());
    expect(layer.isInteractionSuspended()).toBe(false);
    layer.setInteractionSuspended(true);
    expect(layer.isInteractionSuspended()).toBe(true);
    layer.setInteractionSuspended(false);
    expect(layer.isInteractionSuspended()).toBe(false);
    layer.destroy();
  });
});
