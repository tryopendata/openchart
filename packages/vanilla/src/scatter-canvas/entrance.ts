/**
 * Canvas entrance animation.
 *
 * Replicates the CSS point-mark entrance (the `point` role in core's
 * choreography table, emitted as the `circle.oc-mark-point` rule) on canvas.
 * Timing comes from `entranceTiming('point', ...)` and the per-point alpha from
 * `evalRoleEase('point', ...)`, the same data the generated CSS is built from,
 * so SVG and canvas scatters enter identically.
 *
 * Canvas mode emits no point elements, so the CSS rule matches nothing and this
 * scheduler-driven tween stands in for it. Everything else in the chart (axes,
 * chrome, annotations) still animates via CSS on the SVG above.
 */

import {
  clampStaggerDelay,
  entranceEndMs,
  entranceTiming,
  evalRoleEase,
  type ResolvedAnimationPhase,
} from '@opendata-ai/openchart-core';
import type { Animation } from '../motion/scheduler';
import { createTween, prefersReducedMotion } from '../motion/tween';
import type { ScatterCanvasState } from './types';

export { MAX_TOTAL_STAGGER_MS } from '@opendata-ai/openchart-core';

/**
 * Total wall-clock time of the canvas entrance, in ms: the last point's delay
 * plus its own fade duration. Used both to drive the tween and to size the
 * cleanup timer, so the two cannot drift.
 */
export function computeEntranceDuration(enter: ResolvedAnimationPhase, markCount: number): number {
  return entranceEndMs({
    phase: enter,
    roles: { point: markCount },
    staggerMs: clampStaggerDelay(enter.staggerDelay, markCount),
  });
}

/**
 * Per-point alpha at time `t` (ms into the entrance), given its stagger slot.
 * Equals the opacity the CSS point rule gives the same point at the same time.
 * Exported so GIF capture can step the entrance deterministically without a
 * scheduler.
 */
export function entranceAlphaAt(
  t: number,
  markIndex: number,
  enter: ResolvedAnimationPhase,
  markCount: number,
): number {
  const { delayMs, durationMs } = entranceTiming('point', markIndex, enter, {
    staggerMs: clampStaggerDelay(enter.staggerDelay, markCount),
  });
  if (durationMs <= 0) return 1;
  const local = (t - delayMs) / durationMs;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  // The keyframe is opacity 0 -> 1, so opacity is the eased progress. CSS
  // clamps an overshooting curve's opacity to [0, 1]; so does this.
  const eased = evalRoleEase('point', enter, local);
  return eased < 0 ? 0 : eased > 1 ? 1 : eased;
}

/** Write the alpha for every point at time `t` into `state.enterAlpha`. */
function applyEntranceAt(
  state: ScatterCanvasState,
  t: number,
  enter: ResolvedAnimationPhase,
): void {
  const alpha = state.enterAlpha;
  if (!alpha) return;
  const { n, animationIndex } = state.marks;
  for (let i = 0; i < n; i++) {
    alpha[i] = entranceAlphaAt(t, animationIndex[i], enter, n);
  }
}

/**
 * Hold the points at the entrance's from-state (transparent) until
 * `playCanvasEntrance` starts: the canvas half of play-when-seen, where the
 * SVG half pauses its CSS. Reduced motion and empty charts are left as is.
 */
export function holdCanvasEntrance(state: ScatterCanvasState, requestPaint: () => void): void {
  const n = state.marks.n;
  if (n === 0 || prefersReducedMotion()) return;
  state.enterAlpha = new Float32Array(n);
  requestPaint();
}

export interface EntranceHandle {
  /** Total duration in ms, including the full stagger sweep. */
  totalMs: number;
  /**
   * Resolves once the entrance is over: when the tween completes, and also
   * (never rejecting) when it is cancelled, by `cancel()` or by the layer's
   * scheduler.
   */
  finished: Promise<void>;
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

  const totalMs = computeEntranceDuration(enter, n);
  let settle!: () => void;
  const finished = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const alpha = new Float32Array(n);
  state.enterAlpha = alpha;
  // Seed the from-state synchronously so the first painted frame is the start
  // of the entrance, not a flash of the final state.
  applyEntranceAt(state, 0, enter);

  const tween: Animation = createTween({
    duration: totalMs,
    // The per-point windows carry the easing; the driving clock stays linear so
    // stagger slots land at the times the formula says they do.
    ease: (p) => p,
    apply: (p) => {
      applyEntranceAt(state, p * totalMs, enter);
    },
    onDone: () => {
      // Null rather than filled with 1s: the renderer treats null as "no
      // entrance in flight" and skips the per-point multiply entirely.
      state.enterAlpha = null;
      onDone?.();
      settle();
    },
  });
  // The scheduler's cancelAll (layer destroy) bypasses the handle, so the
  // registered animation settles `finished` on cancel itself.
  const scheduled: Animation = {
    tick: (now) => tween.tick(now),
    finish: () => tween.finish(),
    cancel() {
      tween.cancel();
      settle();
    },
  };

  addAnimation(scheduled);
  requestPaint();

  return {
    totalMs,
    finished,
    cancel() {
      removeAnimation(scheduled);
      scheduled.cancel();
      state.enterAlpha = null;
      requestPaint();
    },
  };
}
