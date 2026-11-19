/**
 * Canvas motion primitives: easings, reduced-motion detection, and a generic
 * time-based tween.
 *
 * Canvas marks animate via a rAF scheduler (see scheduler.ts), NOT via CSS
 * keyframes like SVG charts. Value, entrance and fade curves come from core's
 * curve registry, the same one the CSS and the chart driver read. Camera and
 * hover keep the hand-rolled analytic cubics (`resolveCameraEase`).
 */

import {
  type AnimationEase,
  evalValueCurve,
  type MotionPhase,
  sampleMotion,
} from '@opendata-ai/openchart-core';
import { cubicInOut, cubicOut } from './easing';
import type { Animation } from './scheduler';

// ---------------------------------------------------------------------------
// Easings (shared definitions live in easing.ts; re-exported for callers)
// ---------------------------------------------------------------------------

export { cubicInOut, cubicOut, linear } from './easing';

/**
 * Resolve a named ease preset to the registry's value curve: clamped to
 * [0, 1] and never dipping back, so it is safe for geometry and alpha.
 */
export function resolveEase(ease: AnimationEase): (t: number) => number {
  return (t) => evalValueCurve(ease, t);
}

/**
 * Normalized-progress easing for a whole phase, honouring `spring` (which a
 * named curve can't express). Use with `createTween({ duration: phase.duration })`.
 */
export function motionEase(phase: MotionPhase): (t: number) => number {
  return (t) => sampleMotion(phase, t * phase.duration).position;
}

/**
 * Camera flights and hover emphasis keep the analytic cubics they always had:
 * `'snappy'` decelerates (cubicOut); `'smooth'` and `'gentle'` ease in and out.
 */
export function resolveCameraEase(ease: AnimationEase): (t: number) => number {
  return ease === 'snappy' ? cubicOut : cubicInOut;
}

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

/**
 * Whether the user prefers reduced motion. Mirrors `transition.ts`: guards
 * SSR/happy-dom where matchMedia may be missing or throw.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tween
// ---------------------------------------------------------------------------

/** Options for {@link createTween}. */
export interface TweenOptions {
  /** Duration in ms. A duration <= 0 completes on the first tick. */
  duration: number;
  /** Easing function applied to the normalized 0..1 progress. */
  ease: (t: number) => number;
  /** Called each tick with the eased progress. */
  apply: (t: number) => void;
  /** Called once when the tween completes (not on cancel). */
  onDone?: () => void;
}

/**
 * Create a time-based tween as an {@link Animation}.
 *
 * The start time locks on the FIRST `tick(now)` call (not at construction), so
 * a tween added while the scheduler is idle starts cleanly on the next frame
 * and tests get deterministic progress from a controllable clock.
 */
export function createTween(opts: TweenOptions): Animation {
  const { duration, ease, apply, onDone } = opts;
  let startTime: number | null = null;
  let finished = false;

  function settleAt(t: number): void {
    apply(ease(t));
  }

  return {
    tick(now: number): boolean {
      if (finished) return false;
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const raw = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      settleAt(raw);
      if (raw >= 1) {
        finished = true;
        onDone?.();
        return false;
      }
      return true;
    },
    finish(): void {
      if (finished) return;
      finished = true;
      settleAt(1);
      onDone?.();
    },
    cancel(): void {
      finished = true;
    },
  };
}
