import { lerp } from './tween';

/**
 * Pure math for the scrollytelling camera. `createChartStory` owns DOM
 * writes; everything here is testable without a browser. Ported from
 * opendata/shared/lib/scrolly/camera-math.ts.
 *
 * The camera is a center + zoom over a fixed viewBox, applied as a
 * `transform` on a dedicated wrapper `<g>` around the marks group (NOT
 * viewBox interpolation -- that scales text and gives labels no way to
 * counter-scale). See .claude/rules/svg-animation.md: CSS transform
 * replaces SVG transform attributes, so the camera transform must compose
 * with, not replace, existing SVG transforms on marks.
 */

export interface Camera {
  cx: number;
  cy: number;
  /** Zoom factor. 1 = full viewBox visible. */
  k: number;
}

export interface CameraTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  /** ViewBox units added on all sides before fitting */
  padding?: number;
}

export interface ViewBoxSize {
  width: number;
  height: number;
}

export const FULL_VIEW = (vb: ViewBoxSize): CameraTarget => ({
  x: 0,
  y: 0,
  width: vb.width,
  height: vb.height,
});

/** Fit a target rect inside the viewBox, preserving aspect ratio. */
export function fitTarget(target: CameraTarget, vb: ViewBoxSize): Camera {
  const pad = target.padding ?? 0;
  const w = target.width + 2 * pad;
  const h = target.height + 2 * pad;
  return {
    cx: target.x + target.width / 2,
    cy: target.y + target.height / 2,
    k: Math.min(vb.width / w, vb.height / h),
  };
}

/**
 * Pan lerps linearly; zoom lerps in LOG space so the zoom rate reads
 * constant (a 1->4 zoom passes through 2 at the midpoint, not 2.5).
 */
export function interpolateCamera(a: Camera, b: Camera, t: number): Camera {
  return {
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), t)),
  };
}

/** SVG transform string that frames the camera inside the viewBox. */
export function cameraTransform(c: Camera, vb: ViewBoxSize): string {
  return `translate(${vb.width / 2} ${vb.height / 2}) scale(${c.k}) translate(${-c.cx} ${-c.cy})`;
}

/**
 * Frame-rate-independent exponential damping: two 8ms steps land where one
 * 16ms step does. `tauMs` is the time constant (~63% of the gap per tau).
 */
export function damp(current: number, target: number, tauMs: number, dtMs: number): number {
  if (tauMs <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dtMs / tauMs));
}

export function dampCamera(current: Camera, target: Camera, tauMs: number, dtMs: number): Camera {
  return {
    cx: damp(current.cx, target.cx, tauMs, dtMs),
    cy: damp(current.cy, target.cy, tauMs, dtMs),
    // k damped in log space, same rationale as interpolateCamera
    k: Math.exp(damp(Math.log(current.k), Math.log(target.k), tauMs, dtMs)),
  };
}

export function camerasClose(a: Camera, b: Camera, epsilon = 1e-3): boolean {
  return (
    Math.abs(a.cx - b.cx) < epsilon &&
    Math.abs(a.cy - b.cy) < epsilon &&
    Math.abs(Math.log(a.k) - Math.log(b.k)) < epsilon
  );
}

/**
 * Where the scrub camera should point for a given frame.
 *
 * Hold-zone semantics: the camera DWELLS on the active step's target while
 * the reader reads, and only transitions toward the next step's target in
 * the tail of the span (`stepProgress > holdUntil`). Interpolating across
 * the whole span would mean the camera departs the moment a step activates
 * and never rests on what the text is describing.
 */
export function scrubCamera(
  step: number,
  stepProgress: number,
  fitted: Camera[],
  holdUntil: number,
  ease: (t: number) => number,
): Camera {
  const n = fitted.length;
  if (n === 0) return { cx: 0, cy: 0, k: 1 };
  const clamped = Math.min(Math.max(step, 0), n - 1);
  const current = fitted[clamped]!;
  const next = fitted[Math.min(clamped + 1, n - 1)]!;
  if (step < 0 || clamped >= n - 1 || stepProgress <= holdUntil) {
    return current;
  }
  const t = (stepProgress - holdUntil) / (1 - holdUntil);
  return interpolateCamera(current, next, ease(t));
}
