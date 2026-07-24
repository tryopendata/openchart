/**
 * The pointer path caches element boxes.
 *
 * `getBoundingClientRect()` forces layout, so measuring on every `pointermove`
 * is exactly the per-event cost the canvas layer exists to avoid. The cache is
 * only safe if it is invalidated when the boxes actually move, so both halves
 * are tested here: that repeat moves stop re-measuring, and that a scroll makes
 * the next event measure again (and land on the right point).
 */

import type { ChartLayout, ChartSpec, TooltipContent } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TooltipManager } from '../../tooltip';
import { wireCanvasInteractions } from '../interactions';
import { createScatterCanvasLayer, type ScatterCanvasLayer } from '../layer';
import { type CanvasStub, stubCanvas2D } from './canvas-stub';

function layout(): ChartLayout {
  const spec = {
    mark: 'point',
    data: [
      { a: 1, b: 1 },
      { a: 2, b: 2 },
    ],
    encoding: {
      x: { field: 'a', type: 'quantitative' },
      y: { field: 'b', type: 'quantitative' },
    },
  } as ChartSpec;
  return compileChart(spec, { width: 600, height: 400 });
}

/** A pointermove at viewport coordinates. */
function move(canvas: HTMLElement, clientX: number, clientY: number): void {
  const e = new Event('pointermove', { bubbles: true }) as PointerEvent;
  Object.defineProperty(e, 'clientX', { value: clientX });
  Object.defineProperty(e, 'clientY', { value: clientY });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  canvas.dispatchEvent(e);
}

describe('pointer rect caching', () => {
  let stub: CanvasStub;
  let container: HTMLElement;
  let layer: ScatterCanvasLayer;
  let cleanup: () => void;
  let canvasRectCalls: number;
  /** Vertical offset the fake page is scrolled by. */
  let scrollY: number;
  let tooltipManager: TooltipManager;

  beforeEach(() => {
    stub = stubCanvas2D();
    container = document.createElement('div');
    document.body.appendChild(container);
    layer = createScatterCanvasLayer(container, layout());

    // One point at layout (100, 100), so a hit is unambiguous.
    layer.state.marks.n = 1;
    layer.state.marks.x[0] = 100;
    layer.state.marks.y[0] = 100;
    layer.state.marks.r[0] = 5;
    layer.rebuildIndex();

    canvasRectCalls = 0;
    scrollY = 0;
    const rectAt = () => ({ left: 0, top: -scrollY, right: 600, bottom: 400 - scrollY }) as DOMRect;
    layer.canvas.getBoundingClientRect = () => {
      canvasRectCalls++;
      return rectAt();
    };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.getBoundingClientRect = rectAt;
    container.appendChild(svg);

    tooltipManager = { show: vi.fn(), hide: vi.fn() } as unknown as TooltipManager;

    cleanup = wireCanvasInteractions({
      layer,
      svg,
      tooltipDescriptors: new Map<string, TooltipContent>(),
      tooltipManager,
    });
  });

  afterEach(() => {
    cleanup();
    layer.destroy();
    container.remove();
    stub.restore();
    vi.restoreAllMocks();
  });

  it('measures the canvas box once across many pointer moves', () => {
    for (let i = 0; i < 25; i++) move(layer.canvas, 100 + i, 100);
    expect(canvasRectCalls).toBe(1);
  });

  it('re-measures after a scroll, and hit-tests against the new box', () => {
    move(layer.canvas, 100, 100);
    expect(layer.state.hoverIndex).toBe(0);
    expect(canvasRectCalls).toBe(1);

    // Scroll the page 50px: the same layout point is now 50px higher on screen.
    layer.state.hoverIndex = -1;
    scrollY = 50;
    window.dispatchEvent(new Event('scroll'));

    // The pre-scroll viewport coordinate must now MISS -- it maps to layout
    // y=150, which is 50px from the only point.
    move(layer.canvas, 100, 100);
    expect(layer.state.hoverIndex).toBe(-1);

    // The post-scroll coordinate for the same point must hit.
    move(layer.canvas, 100, 50);
    expect(layer.state.hoverIndex).toBe(0);
    expect(canvasRectCalls).toBeGreaterThan(1);
  });

  it('stops listening for scroll once cleaned up', () => {
    move(layer.canvas, 100, 100);
    const before = canvasRectCalls;
    cleanup();
    scrollY = 50;
    window.dispatchEvent(new Event('scroll'));
    move(layer.canvas, 100, 100);
    // No listeners at all now, so nothing re-measured and nothing handled.
    expect(canvasRectCalls).toBe(before);
  });
});
