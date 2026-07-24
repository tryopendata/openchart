/**
 * Pointer interactions for the canvas mark layer.
 *
 * In SVG mode each mark is its own element and the browser does hit-testing for
 * us (`interactions/tooltip-events.ts`, `interactions/chart-events.ts`). Canvas
 * has no elements, so listeners live on the canvas itself and hit-testing goes
 * through the layer's quadtree. Payload shapes are reproduced from
 * `chart-events.ts` rather than imported: that module walks `[data-mark-id]`
 * elements, which don't exist here.
 */

import type { ChartEventHandlers, TooltipContent } from '@opendata-ai/openchart-core';
import type { TooltipManager } from '../tooltip';
import type { ScatterCanvasLayer } from './layer';

/** Hit tolerance in CSS px, beyond the point's own radius. */
const HIT_TOLERANCE_MOUSE = 8;
/** Fingers are blunter than mice. */
const HIT_TOLERANCE_TOUCH = 24;

export interface CanvasInteractionOptions {
  layer: ScatterCanvasLayer;
  /** The chart SVG. Coordinates are reported relative to its box, matching SVG mode. */
  svg: SVGElement;
  tooltipDescriptors: Map<string, TooltipContent>;
  tooltipManager: TooltipManager;
  options?: ChartEventHandlers;
}

/**
 * Wire pointer listeners on the layer's canvas. Returns a cleanup function that
 * removes them.
 */
export function wireCanvasInteractions({
  layer,
  svg,
  tooltipDescriptors,
  tooltipManager,
  options,
}: CanvasInteractionOptions): () => void {
  const canvas = layer.canvas;
  const state = layer.state;

  /**
   * Container-relative coordinates. `tooltip-events.ts` measures against the SVG
   * box and the tooltip manager positions inside the same container, so the
   * canvas must use the same origin — not its own rect, which can differ if the
   * SVG scales with the container.
   */
  function toLocal(e: PointerEvent): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Layout-space coordinates for hit testing (the canvas is 1:1 with layout). */
  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function tolerance(e: PointerEvent): number {
    return e.pointerType === 'touch' ? HIT_TOLERANCE_TOUCH : HIT_TOLERANCE_MOUSE;
  }

  function markPayload(index: number, local: { x: number; y: number }, e: PointerEvent) {
    const datum = state.marks.data[index];
    return {
      datum: (datum ?? {}) as Record<string, unknown>,
      series: undefined,
      position: local,
      event: e as unknown as MouseEvent,
    };
  }

  function clearHover(): void {
    if (state.hoverIndex === -1) return;
    state.hoverIndex = -1;
    layer.scheduleRepaint();
  }

  const handlePointerMove = (e: PointerEvent): void => {
    if (layer.isInteractionSuspended()) return;
    const { x, y } = toCanvas(e);
    const hit = layer.hitTest(x, y, tolerance(e));

    if (!hit) {
      tooltipManager.hide();
      if (state.hoverIndex !== -1) {
        clearHover();
        options?.onMarkLeave?.();
      }
      return;
    }

    const local = toLocal(e);
    const content = tooltipDescriptors.get(state.marks.markIds[hit.index]);
    if (content) tooltipManager.show(content, local.x, local.y);

    const changed = state.hoverIndex !== hit.index;
    if (changed) {
      state.hoverIndex = hit.index;
      layer.scheduleRepaint();
      options?.onMarkHover?.(markPayload(hit.index, local, e));
    }
  };

  const handlePointerDown = (e: PointerEvent): void => {
    if (layer.isInteractionSuspended()) return;
    if (!options?.onMarkClick) return;
    const { x, y } = toCanvas(e);
    const hit = layer.hitTest(x, y, tolerance(e));
    if (!hit) return;
    options.onMarkClick(markPayload(hit.index, toLocal(e), e));
  };

  const handlePointerLeave = (): void => {
    if (layer.isInteractionSuspended()) return;
    tooltipManager.hide();
    if (state.hoverIndex !== -1) {
      clearHover();
      options?.onMarkLeave?.();
    }
  };

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerleave', handlePointerLeave);

  return () => {
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointerleave', handlePointerLeave);
  };
}
