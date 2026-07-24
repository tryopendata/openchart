/**
 * Canvas entrance animation.
 *
 * Replicates the CSS point-mark entrance (`core/src/styles/animation.css`,
 * the `circle.oc-mark-point` rule) on canvas: fade-only, per-point duration
 * 40% of the configured enter duration, delayed by `stagger * markIndex`.
 *
 * Canvas mode emits no point elements, so the CSS rule matches nothing and this
 * scheduler-driven tween stands in for it. Everything else in the chart (axes,
 * chrome, annotations) still animates via CSS on the SVG above.
 */

import type { ResolvedAnimationPhase } from '@opendata-ai/openchart-core';
import type { Animation } from '../motion/scheduler';
import { createTween, prefersReducedMotion, resolveEase } from '../motion/tween';
import type { ScatterCanvasState } from './types';

/**
 * Maximum total stagger time in ms. Mirrors MAX_TOTAL_STAGGER_MS in
 * `engine/src/compiler/animation.ts` -- duplicated rather than imported
 * because vanilla does not depend on the engine at runtime.
 */
export const MAX_TOTAL_STAGGER_MS = 2000;

/** Fraction of the enter duration a single point takes to fade in. */
export const POINT_DURATION_FRACTION = 0.4;

/**
 * Clamp the stagger so the whole sweep fits in MAX_TOTAL_STAGGER_MS.
 * Mirrors `clampStaggerDelay` in the engine.
 */
export function clampStagger(delay: number, elementCount: number): number {
  if (elementCount <= 1) return 0;
  return Math.min(delay, MAX_TOTAL_STAGGER_MS / elementCount);
}

/**
 * Total wall-clock time of the canvas entrance, in ms: the last point's delay
 * plus its own fade duration. Used both to drive the tween and to size the
 * cleanup timer, so the two cannot drift.
 */
export function computeEntranceDuration(enter: ResolvedAnimationPhase, markCount: number): number {
  const stagger = clampStagger(enter.staggerDelay, markCount);
  const pointDuration = enter.duration * POINT_DURATION_FRACTION;
  return stagger * Math.max(0, markCount - 1) + pointDuration;
}

/**
 * Per-point alpha at time `t` (ms into the entrance), given its stagger slot.
 * Exported so GIF capture can step the entrance deterministically without a
 * scheduler.
 */
export function entranceAlphaAt(
  t: number,
  markIndex: number,
  enter: ResolvedAnimationPhase,
  markCount: number,
  ease: (p: number) => number,
): number {
  const stagger = clampStagger(enter.staggerDelay, markCount);
  const pointDuration = enter.duration * POINT_DURATION_FRACTION;
  if (pointDuration <= 0) return 1;
  const local = (t - stagger * markIndex) / pointDuration;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  return ease(local);
}

/** Write the alpha for every point at time `t` into `state.enterAlpha`. */
function applyEntranceAt(
  state: ScatterCanvasState,
  t: number,
  enter: ResolvedAnimationPhase,
  ease: (p: number) => number,
): void {
  const alpha = state.enterAlpha;
  if (!alpha) return;
  const { n, animationIndex } = state.marks;
  for (let i = 0; i < n; i++) {
    alpha[i] = entranceAlphaAt(t, animationIndex[i], enter, n, ease);
  }
}

export interface EntranceHandle {
  /** Total duration in ms, including the full stagger sweep. */
  totalMs: number;
  /** Stop the entrance without snapping to the final state. */
  cancel(): void;
}

/**
 * Start the canvas entrance. Returns null when there is nothing to animate
 * (no points, or reduced motion), having already left the state fully opaque.
 */
export function playCanvasEntrance(args: {
  state: ScatterCanvasState;
  enter: ResolvedAnimationPhase;
  addAnimation: (a: Animation) => void;
  removeAnimation: (a: Animation) => void;
  requestPaint: () => void;
  onDone?: () => void;
}): EntranceHandle | null {
  const { state, enter, addAnimation, removeAnimation, requestPaint, onDone } = args;
  const n = state.marks.n;

  // Reduced motion and empty charts skip straight to the final state. Leaving
  // enterAlpha null means the renderer paints at full fillOpacity.
  if (n === 0 || prefersReducedMotion()) {
    state.enterAlpha = null;
    requestPaint();
    onDone?.();
    return null;
  }

  const ease = resolveEase(enter.ease);
  const totalMs = computeEntranceDuration(enter, n);

  const alpha = new Float32Array(n);
  state.enterAlpha = alpha;
  // Seed the from-state synchronously so the first painted frame is the start
  // of the entrance, not a flash of the final state.
  applyEntranceAt(state, 0, enter, ease);

  const tween: Animation = createTween({
    duration: totalMs,
    // The per-point windows carry the easing; the driving clock stays linear so
    // stagger slots land at the times the formula says they do.
    ease: (p) => p,
    apply: (p) => {
      applyEntranceAt(state, p * totalMs, enter, ease);
    },
    onDone: () => {
      // Null rather than filled with 1s: the renderer treats null as "no
      // entrance in flight" and skips the per-point multiply entirely.
      state.enterAlpha = null;
      onDone?.();
    },
  });

  addAnimation(tween);
  requestPaint();

  return {
    totalMs,
    cancel() {
      removeAnimation(tween);
      state.enterAlpha = null;
      requestPaint();
    },
  };
}
