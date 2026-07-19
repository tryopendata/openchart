/**
 * Graph animation resolver.
 *
 * Modeled on `compiler/animation.ts` but DEFAULT-ON (the deliberate chart/graph
 * divergence): graphs already move on load, so choreography is the default and
 * must be opted out of, not into.
 *
 * - `undefined` (omitted) -> full defaults
 * - `false` -> undefined (no choreography; note `layout.warmup` still applies,
 *   resolved independently into SimulationConfig)
 * - object -> per-phase resolution; a per-phase `false` -> that phase is `null`
 *
 * `reheatAlpha` for the update impulse and the entrance `cameraFit` toggle are
 * internal vanilla constants, not spec surface. Warmup is NOT part of this block
 * (it lives in `layout`); `fitOnLoad` is a mount option.
 */

import type {
  AnimationEase,
  AnimationPhaseConfig,
  GraphAnimationSpec,
} from '@opendata-ai/openchart-core';

/** Fully resolved graph animation config consumed by the vanilla adapter. */
export interface ResolvedGraphAnimation {
  /** Entrance reveal, or null if disabled. `cameraFit` flies the camera to the fit on load. */
  enter: { duration: number; ease: AnimationEase; stagger: boolean; cameraFit: boolean } | null;
  /** Data-update enter-fade for newly added marks, or null. */
  update: { duration: number; ease: AnimationEase } | null;
  /** Ghost fade-out for removed marks, or null. */
  exit: { duration: number; ease: AnimationEase } | null;
  /** Camera flight easing, or null. `'auto'` derives duration from zoom distance. */
  camera: { duration: number | 'auto'; ease: AnimationEase } | null;
  /** Hover emphasis crossfade, or null. */
  hover: { duration: number; ease: AnimationEase } | null;
}

const ENTER_DEFAULT = {
  duration: 600,
  ease: 'smooth' as AnimationEase,
  stagger: true,
  cameraFit: true,
};
const UPDATE_DEFAULT = { duration: 300, ease: 'smooth' as AnimationEase };
const EXIT_DEFAULT = { duration: 300, ease: 'smooth' as AnimationEase };
const CAMERA_DEFAULT = { duration: 'auto' as number | 'auto', ease: 'smooth' as AnimationEase };
const HOVER_DEFAULT = { duration: 150, ease: 'smooth' as AnimationEase };

/** The full-defaults config returned when animation is omitted. */
function fullDefaults(): ResolvedGraphAnimation {
  return {
    enter: { ...ENTER_DEFAULT },
    update: { ...UPDATE_DEFAULT },
    exit: { ...EXIT_DEFAULT },
    camera: { ...CAMERA_DEFAULT },
    hover: { ...HOVER_DEFAULT },
  };
}

/**
 * Resolve a GraphAnimationSpec.
 * - `undefined` -> full defaults (default-ON)
 * - `false` -> undefined (no choreography)
 * - `true` -> full defaults
 * - object -> per-phase; per-phase `false` -> null
 */
export function resolveGraphAnimation(
  spec: GraphAnimationSpec | undefined,
): ResolvedGraphAnimation | undefined {
  if (spec === undefined || spec === true) return fullDefaults();
  if (spec === false) return undefined;

  return {
    enter: resolveEnter(spec.enter),
    update: resolveDurationPhase(spec.update, UPDATE_DEFAULT),
    exit: resolveDurationPhase(spec.exit, EXIT_DEFAULT),
    camera: resolveCamera(spec.camera),
    hover: resolveDurationPhase(spec.hover, HOVER_DEFAULT),
  };
}

function resolveEnter(
  phase: AnimationPhaseConfig | boolean | undefined,
): ResolvedGraphAnimation['enter'] {
  if (phase === false) return null;
  if (phase === undefined || phase === true) return { ...ENTER_DEFAULT };
  return {
    duration: phase.duration ?? ENTER_DEFAULT.duration,
    ease: phase.ease ?? ENTER_DEFAULT.ease,
    stagger: phase.stagger !== false,
    cameraFit: ENTER_DEFAULT.cameraFit,
  };
}

function resolveDurationPhase<T extends { duration: number; ease: AnimationEase }>(
  phase: { duration?: number; ease?: AnimationEase } | boolean | undefined,
  defaults: T,
): { duration: number; ease: AnimationEase } | null {
  if (phase === false) return null;
  if (phase === undefined || phase === true)
    return { duration: defaults.duration, ease: defaults.ease };
  return {
    duration: phase.duration ?? defaults.duration,
    ease: phase.ease ?? defaults.ease,
  };
}

function resolveCamera(
  phase: { duration?: number; ease?: AnimationEase } | boolean | undefined,
): ResolvedGraphAnimation['camera'] {
  if (phase === false) return null;
  if (phase === undefined || phase === true) return { ...CAMERA_DEFAULT };
  return {
    duration: phase.duration ?? CAMERA_DEFAULT.duration,
    ease: phase.ease ?? CAMERA_DEFAULT.ease,
  };
}
