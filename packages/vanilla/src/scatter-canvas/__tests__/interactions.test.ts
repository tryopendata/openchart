/**
 * Pointer-handler behavior for `wireCanvasInteractions`.
 *
 * Two windows where the handlers must stay quiet or stay safe:
 *
 * 1. Interaction suspension. While an entrance/transition animates, the driver
 *    calls `layer.setInteractionSuspended(true)` and every pointer handler
 *    bails at its first line via `layer.isInteractionSuspended()`. No tooltip,
 *    no hover/click callbacks, no hover-state writes. Once the flag lifts, the
 *    exact same events must work again.
 *
 * 2. The stale-index window. `rebuildIndex()` is never called per frame, so
 *    between a geometry change (e.g. a resize recomputing point positions) and
 *    the next rebuild, the quadtree still answers from the OLD positions
 *    (contract established in `hit-test.test.ts`). Pointer events in that
 *    window must not crash: new positions miss, old positions still hit, and
 *    after `rebuildIndex()` hits land at the new geometry.
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

/** Dispatch a pointer event at viewport coordinates (happy-dom has no PointerEvent). */
function pointer(target: HTMLElement, type: string, clientX: number, clientY: number): void {
  const e = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperty(e, 'clientX', { value: clientX });
  Object.defineProperty(e, 'clientY', { value: clientY });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  target.dispatchEvent(e);
}

describe('wireCanvasInteractions', () => {
  let stub: CanvasStub;
  let container: HTMLElement;
  let layer: ScatterCanvasLayer;
  let cleanup: () => void;
  let tooltipManager: TooltipManager;
  let onMarkHover: ReturnType<typeof vi.fn>;
  let onMarkLeave: ReturnType<typeof vi.fn>;
  let onMarkClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stub = stubCanvas2D();
    container = document.createElement('div');
    document.body.appendChild(container);
    layer = createScatterCanvasLayer(container, layout());

    // One point at layout (100, 100), so hits and misses are unambiguous.
    layer.state.marks.n = 1;
    layer.state.marks.x[0] = 100;
    layer.state.marks.y[0] = 100;
    layer.state.marks.r[0] = 5;
    layer.rebuildIndex();

    // Both boxes at the viewport origin: client coords == layout coords.
    const rect = { left: 0, top: 0, right: 600, bottom: 400 } as DOMRect;
    layer.canvas.getBoundingClientRect = () => rect;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.getBoundingClientRect = () => rect;
    container.appendChild(svg);

    tooltipManager = { show: vi.fn(), hide: vi.fn() } as unknown as TooltipManager;
    onMarkHover = vi.fn();
    onMarkLeave = vi.fn();
    onMarkClick = vi.fn();

    const tooltipDescriptors = new Map<string, TooltipContent>([
      [layer.state.marks.markIds[0], { title: 'p0', rows: [] } as unknown as TooltipContent],
    ]);

    cleanup = wireCanvasInteractions({
      layer,
      svg,
      tooltipDescriptors,
      tooltipManager,
      options: { onMarkHover, onMarkLeave, onMarkClick },
    });
  });

  afterEach(() => {
    cleanup();
    layer.destroy();
    container.remove();
    stub.restore();
    vi.restoreAllMocks();
  });

  describe('during interaction suspension', () => {
    beforeEach(() => {
      // The mechanism the transition/entrance driver uses to gate hit-testing.
      layer.setInteractionSuspended(true);
    });

    it('ignores pointermove: no tooltip, no hover callback, no hover state', () => {
      pointer(layer.canvas, 'pointermove', 100, 100);

      expect(tooltipManager.show).not.toHaveBeenCalled();
      expect(tooltipManager.hide).not.toHaveBeenCalled();
      expect(onMarkHover).not.toHaveBeenCalled();
      expect(layer.state.hoverIndex).toBe(-1);
    });

    it('ignores pointerdown: no click callback', () => {
      pointer(layer.canvas, 'pointerdown', 100, 100);
      expect(onMarkClick).not.toHaveBeenCalled();
    });

    it('ignores pointerleave: does not hide the tooltip mid-animation', () => {
      pointer(layer.canvas, 'pointerleave', 0, 0);
      expect(tooltipManager.hide).not.toHaveBeenCalled();
      expect(onMarkLeave).not.toHaveBeenCalled();
    });

    it('handles the same events once suspension lifts', () => {
      pointer(layer.canvas, 'pointermove', 100, 100);
      expect(onMarkHover).not.toHaveBeenCalled();

      layer.setInteractionSuspended(false);

      pointer(layer.canvas, 'pointermove', 100, 100);
      expect(tooltipManager.show).toHaveBeenCalledTimes(1);
      expect(tooltipManager.show).toHaveBeenCalledWith(expect.anything(), 100, 100);
      expect(onMarkHover).toHaveBeenCalledTimes(1);
      expect(onMarkHover).toHaveBeenCalledWith(
        expect.objectContaining({ position: { x: 100, y: 100 } }),
      );
      expect(layer.state.hoverIndex).toBe(0);

      pointer(layer.canvas, 'pointerdown', 100, 100);
      expect(onMarkClick).toHaveBeenCalledTimes(1);
      expect(onMarkClick).toHaveBeenCalledWith(
        expect.objectContaining({ position: { x: 100, y: 100 } }),
      );
    });
  });

  describe('stale-index window (geometry changed, rebuildIndex not yet run)', () => {
    beforeEach(() => {
      // Establish a hover on the point at its original position.
      pointer(layer.canvas, 'pointermove', 100, 100);
      expect(layer.state.hoverIndex).toBe(0);

      // A resize-style geometry change moves the point, but the spatial index
      // is only rebuilt by an explicit rebuildIndex() call.
      layer.state.marks.x[0] = 300;
    });

    it('safely misses at the new position and reports leave, without crashing', () => {
      expect(() => pointer(layer.canvas, 'pointermove', 300, 100)).not.toThrow();

      // The stale index still holds the point at x=100, so x=300 is a miss.
      expect(onMarkHover).toHaveBeenCalledTimes(1); // only the initial hover
      expect(tooltipManager.hide).toHaveBeenCalledTimes(1);
      expect(onMarkLeave).toHaveBeenCalledTimes(1);
      expect(layer.state.hoverIndex).toBe(-1);
    });

    it('still hits at the stale position (the established contract)', () => {
      pointer(layer.canvas, 'pointermove', 105, 100);

      // Same index as before, so no new hover callback fires; the tooltip
      // re-shows at the pointer position from the stale hit.
      expect(layer.state.hoverIndex).toBe(0);
      expect(tooltipManager.show).toHaveBeenCalledTimes(2);
      expect(onMarkLeave).not.toHaveBeenCalled();
    });

    it('ignores clicks at the new position until the index is rebuilt', () => {
      pointer(layer.canvas, 'pointerdown', 300, 100);
      expect(onMarkClick).not.toHaveBeenCalled();
    });

    it('lands hits at the new geometry after rebuildIndex', () => {
      // Leave first so the post-rebuild hover is a fresh change.
      pointer(layer.canvas, 'pointermove', 500, 300);
      expect(layer.state.hoverIndex).toBe(-1);

      layer.rebuildIndex();

      pointer(layer.canvas, 'pointermove', 300, 100);
      expect(layer.state.hoverIndex).toBe(0);
      expect(onMarkHover).toHaveBeenCalledTimes(2);
      expect(onMarkHover).toHaveBeenLastCalledWith(
        expect.objectContaining({ position: { x: 300, y: 100 } }),
      );
      expect(tooltipManager.show).toHaveBeenLastCalledWith(expect.anything(), 300, 100);

      pointer(layer.canvas, 'pointerdown', 300, 100);
      expect(onMarkClick).toHaveBeenCalledTimes(1);

      // And the old position no longer hits.
      pointer(layer.canvas, 'pointermove', 100, 100);
      expect(layer.state.hoverIndex).toBe(-1);
    });
  });
});
