/**
 * Animated camera for the graph.
 *
 * Flights interpolate between two `ZoomTransform`s along d3's geodesic
 * `interpolateZoom` path (smooth zoom-and-pan that pulls back to see both
 * endpoints before diving in). A flight is a {@link GraphAnimation}, driven by
 * the mount's AnimationScheduler.
 *
 * `interpolateZoom` operates on a `[cx, cy, width]` "view" — the graph-space
 * center and the graph-space width visible across the viewport. We convert the
 * ZoomTransform ⇄ view around a fixed viewport size.
 */

import type { AnimationEase } from '@opendata-ai/openchart-core';
import { interpolateZoom } from 'd3-interpolate';
import { resolveEase } from './motion';
import type { GraphAnimation } from './scheduler';
import { ZoomTransform } from './zoom';

/** Minimum/maximum zoom scale a flight may resolve to. */
const K_MIN = 0.05;
const K_MAX = 15;

/** Auto-duration bounds (ms) and the interpolateZoom.duration scale factor. */
const AUTO_MIN_MS = 300;
const AUTO_MAX_MS = 1200;
const AUTO_SCALE = 0.6;

/** A d3 zoom "view": graph-space center x/y and the graph-space width in view. */
export type ZoomView = [number, number, number];

/** Viewport size a flight is framed against. */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * Convert a ZoomTransform to a d3 zoom view against a viewport.
 *
 * The view width is the graph-space span visible across `viewport.width`
 * (= viewport.width / k); the center is the graph point under the viewport
 * center.
 */
export function transformToView(t: ZoomTransform, viewport: Viewport): ZoomView {
  const cx = (viewport.width / 2 - t.x) / t.k;
  const cy = (viewport.height / 2 - t.y) / t.k;
  const width = viewport.width / t.k;
  return [cx, cy, width];
}

/** Inverse of {@link transformToView}: a zoom view back to a ZoomTransform. */
export function viewToTransform(view: ZoomView, viewport: Viewport): ZoomTransform {
  const [cx, cy, width] = view;
  const k = clampK(viewport.width / width);
  const x = viewport.width / 2 - cx * k;
  const y = viewport.height / 2 - cy * k;
  return new ZoomTransform(x, y, k);
}

/** Clamp a zoom scale into the allowed range. */
export function clampK(k: number): number {
  if (!Number.isFinite(k) || k <= 0) return K_MIN;
  return Math.min(K_MAX, Math.max(K_MIN, k));
}

/** Options controlling a camera flight. */
export interface CameraFlightOptions {
  /** Duration in ms, or `'auto'` to derive from the zoom distance. */
  duration?: number | 'auto';
  /** Easing preset. Default `'smooth'`. */
  ease?: AnimationEase;
}

/** Inputs to {@link createCameraFlight}. */
export interface CameraFlightInputs {
  /** Starting transform. */
  from: ZoomTransform;
  /**
   * Target transform, or a provider that returns the current target each frame
   * (used to track a node that is still settling). When a provider is passed,
   * the interpolator is rebuilt each frame from the ORIGINAL `from` to the
   * current target, so a moving target stays smooth.
   */
  to: ZoomTransform | (() => ZoomTransform);
  /** Viewport the flight is framed against. */
  viewport: Viewport;
  /** Applies an interpolated transform to the scene each frame. */
  apply: (t: ZoomTransform) => void;
  /** Fired once on natural completion (not on cancel). */
  onDone?: () => void;
  /** Flight options. */
  opts?: CameraFlightOptions;
}

/**
 * Create a camera flight as a {@link GraphAnimation}.
 *
 * Degenerate from≈to is guarded: duration is forced to at least 1ms and NaN
 * interpolation results fall back to the target. The start time locks on the
 * first tick for deterministic tests.
 */
export function createCameraFlight(inputs: CameraFlightInputs): GraphAnimation {
  const { from, viewport, apply, onDone, opts } = inputs;
  const ease = resolveEase(opts?.ease ?? 'smooth');
  const isProvider = typeof inputs.to === 'function';

  const fromView = transformToView(from, viewport);

  function targetView(): ZoomView {
    const to = isProvider ? (inputs.to as () => ZoomTransform)() : (inputs.to as ZoomTransform);
    return transformToView(to, viewport);
  }

  // Build the interpolator (rebuilt each frame in provider mode).
  let interp = interpolateZoom(fromView, targetView());
  const resolvedDuration = resolveDuration(opts?.duration, interp.duration);

  let startTime: number | null = null;
  let finished = false;

  function applyAt(t: number): void {
    if (isProvider) interp = interpolateZoom(fromView, targetView());
    const view = interp(t) as ZoomView;
    if (view.some((v) => !Number.isFinite(v))) {
      apply(viewToTransform(targetView(), viewport));
      return;
    }
    apply(viewToTransform(view, viewport));
  }

  return {
    tick(now: number): boolean {
      if (finished) return false;
      if (startTime === null) startTime = now;
      const raw = resolvedDuration <= 0 ? 1 : Math.min(1, (now - startTime) / resolvedDuration);
      applyAt(ease(raw));
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
      applyAt(1);
      onDone?.();
    },
    cancel(): void {
      finished = true;
    },
  };
}

/** Inputs to {@link createCameraFollow}. */
export interface CameraFollowInputs {
  /** Provider returning the current target transform each frame. */
  target: () => ZoomTransform;
  /** Applies the followed transform to the scene each frame. */
  apply: (t: ZoomTransform) => void;
  /** True while the tracked target may still move (e.g. sim alpha ≥ threshold). */
  isActive: () => boolean;
}

/**
 * Post-flight follow for provider-form flights: the flight converges at t=1
 * while the tracked node may still be settling, so this cheap animation snaps
 * the camera to the provider each frame until `isActive()` reports the sim has
 * settled. User input or a new flight cancels it via the scheduler.
 */
export function createCameraFollow(inputs: CameraFollowInputs): GraphAnimation {
  let finished = false;
  return {
    tick(): boolean {
      if (finished) return false;
      if (!inputs.isActive()) {
        finished = true;
        return false;
      }
      inputs.apply(inputs.target());
      return true;
    },
    finish(): void {
      finished = true;
    },
    cancel(): void {
      finished = true;
    },
  };
}

/**
 * Resolve a flight duration. `'auto'` (or undefined) derives from d3's
 * interpolateZoom.duration (a perceptual distance), scaled and clamped. An
 * explicit number is honored but floored at 1ms so degenerate flights still tick.
 */
export function resolveDuration(
  duration: number | 'auto' | undefined,
  interpDuration: number,
): number {
  if (typeof duration === 'number') return Math.max(1, duration);
  const scaled = interpDuration * AUTO_SCALE;
  return Math.max(AUTO_MIN_MS, Math.min(AUTO_MAX_MS, Math.max(1, scaled)));
}
