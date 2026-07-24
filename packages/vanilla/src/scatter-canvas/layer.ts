/**
 * The scatter canvas mark layer: a `<canvas>` sibling of the chart SVG that
 * owns background, gridlines and point marks in canvas mode.
 *
 * Layering: the canvas is absolutely positioned at the container's top-left and
 * inserted BEFORE the SVG, sized to the full figure so canvas coordinates equal
 * layout coordinates. Mount sets `position: relative` on the SVG so both are
 * positioned and DOM order decides the stack (canvas below).
 *
 * The layer owns its own dirty-flag rAF loop plus an `AnimationScheduler` for
 * entrance/hover animations. Data-update transitions are driven by
 * `transition.ts` instead (one rAF for the whole chart), which calls `repaint()`
 * synchronously — the two loops never run at once.
 */

import type { ChartLayout, ResolvedAnimationPhase } from '@opendata-ai/openchart-core';
import { AnimationScheduler } from '../motion/scheduler';
import { SpatialIndex } from '../spatial-index';
import { type EntranceHandle, playCanvasEntrance } from './entrance';
import { ScatterCanvasRenderer } from './renderer';
import { buildScatterCanvasState } from './state';
import type { ScatterCanvasState } from './types';

/** A point entry in the hit-test index. */
export interface ScatterHit {
  /** Index into `state.marks`. */
  index: number;
  x: number;
  y: number;
  radius: number;
}

export interface ScatterCanvasLayer {
  /** The canvas element. Owned by the layer; removed on `destroy()`. */
  readonly canvas: HTMLCanvasElement;
  /** Mutable render state. Transitions write into this, then call `repaint()`. */
  readonly state: ScatterCanvasState;
  /** The scheduler driving entrance/hover animations on this layer. */
  readonly scheduler: AnimationScheduler;
  /** Paint the current state immediately (synchronous). */
  repaint(): void;
  /** Mark the layer dirty; paints on the next animation frame. */
  scheduleRepaint(): void;
  /** Nearest point within `maxDist` of (x, y) in layout coords, or `null`. */
  hitTest(x: number, y: number, maxDist: number): ScatterHit | null;
  /** Rebuild the spatial index from the current state. Never call per frame. */
  rebuildIndex(): void;
  /**
   * Fade the points in, replicating the CSS point entrance. Returns null when
   * there is nothing to animate (no points, or reduced motion), having already
   * settled the final state. The handle's `totalMs` must be used to size the
   * mount's animation-cleanup timer -- canvas mode emits no animated elements
   * for the DOM-counting estimate to find.
   */
  playEntrance(enter: ResolvedAnimationPhase, onDone?: () => void): EntranceHandle | null;
  /** Suspend/resume pointer interactions (used while a transition runs). */
  setInteractionSuspended(suspended: boolean): void;
  /** True while interactions are suspended. */
  isInteractionSuspended(): boolean;
  /** Cancel pending frames, stop animations, and remove the canvas. */
  destroy(): void;
}

/**
 * Create a canvas mark layer for a compiled layout and append it to `container`.
 *
 * The caller is responsible for inserting the SVG after this call so DOM order
 * puts the canvas underneath.
 */
export function createScatterCanvasLayer(
  container: HTMLElement,
  layout: ChartLayout,
): ScatterCanvasLayer {
  const { width, height } = layout.dimensions;

  const canvas = document.createElement('canvas');
  canvas.className = 'oc-mark-canvas';
  // The SVG carries the chart's role/label; the canvas is a pure paint surface.
  canvas.setAttribute('aria-hidden', 'true');
  // Top-left anchored rather than `inset: 0`: the canvas is sized in explicit
  // layout pixels, and `inset` would let a flexed container stretch it out of
  // sync with the layout coordinate space it paints in.
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  container.appendChild(canvas);

  const renderer = new ScatterCanvasRenderer(canvas);
  renderer.resize(width, height);

  const state = buildScatterCanvasState(layout);
  const index = new SpatialIndex<ScatterHit>();

  let destroyed = false;
  let frameId: number | null = null;
  let needsPaint = false;
  let interactionSuspended = false;

  function repaint(): void {
    if (destroyed) return;
    needsPaint = false;
    renderer.render(state);
  }

  function scheduleRepaint(): void {
    needsPaint = true;
    scheduleFrame();
  }

  function scheduleFrame(): void {
    if (frameId !== null || destroyed) return;
    frameId = requestAnimationFrame(onFrame);
  }

  const scheduler = new AnimationScheduler(scheduleFrame);

  function onFrame(now: number): void {
    frameId = null;
    if (destroyed) return;
    // Animations mutate layer state only; they never paint or re-arm rAF.
    if (scheduler.tick(now)) needsPaint = true;
    if (needsPaint) repaint();
    // Re-arm only while animations run, so the loop idles at zero cost.
    if (scheduler.active) scheduleFrame();
  }

  function rebuildIndex(): void {
    const marks = state.marks;
    const entries: ScatterHit[] = new Array(marks.n);
    for (let i = 0; i < marks.n; i++) {
      entries[i] = { index: i, x: marks.x[i], y: marks.y[i], radius: marks.r[i] };
    }
    index.rebuild(entries);
  }

  rebuildIndex();
  repaint();

  return {
    canvas,
    state,
    scheduler,
    repaint,
    scheduleRepaint,
    hitTest(x, y, maxDist) {
      return index.findNearest(x, y, maxDist);
    },
    rebuildIndex,
    playEntrance(enter, onDone) {
      return playCanvasEntrance({
        state,
        enter,
        addAnimation: (a) => scheduler.add(a),
        removeAnimation: (a) => scheduler.remove(a),
        requestPaint: scheduleRepaint,
        onDone,
      });
    },
    setInteractionSuspended(suspended: boolean) {
      interactionSuspended = suspended;
    },
    isInteractionSuspended() {
      return interactionSuspended;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scheduler.cancelAll();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      canvas.remove();
    },
  };
}
