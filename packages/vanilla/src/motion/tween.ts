/**
 * Canvas motion primitives: easings, reduced-motion detection, and a generic
 * time-based tween.
 *
 * Canvas marks animate via a rAF scheduler (see scheduler.ts), NOT via CSS
 * keyframes like SVG charts. Only the easing vocabulary is shared with charts
 * (`'smooth'` / `'snappy'`). No `d3-ease` dependency — easings are hand-rolled,
 * matching `transition.ts`'s `cubicOut`.
 */

import type { AnimationEase } from '@opendata-ai/openchart-core';
import { cubicInOut, cubicOut } from './easing';
import type { Animation } from './scheduler';

// ---------------------------------------------------------------------------
// Easings (shared definitions live in easing.ts; re-exported for callers)
// ---------------------------------------------------------------------------

export { cubicInOut, cubicOut, linear } from './easing';

/** Resolve a named ease preset to an easing function. */
export function resolveEase(ease: AnimationEase): (t: number) => number {
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
