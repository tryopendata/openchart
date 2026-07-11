/**
 * Numeric rAF tweening for scrollytelling story steps.
 *
 * Owns imperative numeric interpolation: the story driver and camera math
 * mutate scalar/vector values per frame using these primitives instead of
 * hand-rolling rAF loops. Ported from opendata/shared/lib/tween.ts.
 *
 * Everything here is SSR-safe: no `window`/`performance` access at module
 * scope. Callers are expected to invoke these client-side.
 */

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type EasingFn = (t: number) => number;

export const easingFns = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutQuint: (t: number) => 1 - (1 - t) ** 5,
} as const satisfies Record<string, EasingFn>;

/**
 * Duration tokens (ms) for story state changes. Use these instead of
 * arbitrary numbers so all stories share one timing scale.
 */
export const storyMotion = {
  /** Small opacity/emphasis shifts */
  fast: 300,
  /** Step state transitions */
  base: 500,
  /** Whole-chart crossfade fallback (steps outside the morph gate) */
  crossfade: 400,
  /** Step-mode camera transitions */
  camera: 600,
  /** Scrub-mode camera damping time constant */
  cameraTau: 100,
} as const;

export interface TweenConfig<T> {
  initial: T;
  lerp: (a: T, b: T, t: number) => T;
  /** Default `storyMotion.base` */
  duration?: number;
  /** Default `easingFns.easeOutCubic` */
  ease?: EasingFn;
  onFrame: (value: T) => void;
}

export interface Tween<T> {
  /**
   * Retarget the tween. If a tween is mid-flight, the new tween starts FROM
   * THE LIVE INTERPOLATED VALUE, not the previous target -- fast retargeting
   * never jumps. `snap: true` applies the target synchronously with no rAF.
   */
  to: (target: T, opts?: { snap?: boolean }) => void;
  get: () => T;
  cancel: () => void;
}

/**
 * Retargetable tween over an arbitrary shape T.
 */
export function createTween<T>(config: TweenConfig<T>): Tween<T> {
  const { lerp: lerpT, duration = storyMotion.base, ease = easingFns.easeOutCubic, onFrame } = config;

  let current = config.initial;
  let rafId = 0;
  let running = false;

  const stop = () => {
    if (running) {
      cancelAnimationFrame(rafId);
      running = false;
    }
  };

  const to = (target: T, opts?: { snap?: boolean }) => {
    stop();
    if (opts?.snap || duration <= 0) {
      current = target;
      onFrame(current);
      return;
    }

    const from = current;
    const start = performance.now();
    running = true;

    const tick = (now: number) => {
      const t = clamp01((now - start) / duration);
      current = lerpT(from, target, ease(t));
      onFrame(current);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    rafId = requestAnimationFrame(tick);
  };

  return { to, get: () => current, cancel: stop };
}
