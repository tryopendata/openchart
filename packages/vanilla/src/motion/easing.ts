/**
 * Shared easing and interpolation primitives.
 *
 * Single source of truth for the hand-rolled easings used by the canvas
 * scheduler (motion/tween.ts), the update-transition driver (transition.ts)
 * and the story tweens (story/tween.ts). No `d3-ease` dependency.
 */

/** Linear (identity) easing. Required for stacked/segmented handoffs. */
export function linear(t: number): number {
  return t;
}

/** Cubic-out: decelerates into place. Maps to `'snappy'`. */
export function cubicOut(t: number): number {
  const f = 1 - t;
  return 1 - f * f * f;
}

/** Cubic-in-out: eases in and out. Maps to `'smooth'`. */
export function cubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
