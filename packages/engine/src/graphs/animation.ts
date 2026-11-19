/**
 * Graph animation resolver.
 *
 * Modeled on `compiler/animation.ts`. Like every visualization type, graphs
 * animate by default.
 *
 * - `undefined` (omitted) or `true` -> full defaults
 * - `false` -> undefined (no choreography; note `layout.warmup` still applies,
 *   resolved independently into SimulationConfig)
 * - object -> per-phase resolution; a per-phase `false` -> that phase is `null`
 *
 * A phase with `spring` lasts `springDuration(spring)`. The enter `stagger` is
 * on/off only: graphs order their reveal by layout, so the deprecated object
 * form counts as `true`.
 *
 * `reheatAlpha` for the update impulse and the entrance `cameraFit` toggle are
 * internal vanilla constants, not spec surface. Warmup is NOT part of this block
 * (it lives in `layout`); `fitOnLoad` is a mount option.
 */

import type {
  AnimationEase,
  GraphAnimationSpec,
  GraphEnterPhaseConfig,
  GraphPhaseConfig,
  SpringConfig,
} from '@opendata-ai/openchart-core';
import { springDuration } from '@opendata-ai/openchart-core';

/** A resolved graph phase. `spring` is present only when authored; duration is then its settling time. */
export interface ResolvedGraphPhase {
  duration: number;
  ease: AnimationEase;
  spring?: SpringConfig;
}

/** Fully resolved graph animation config consumed by the vanilla adapter. */
export interface ResolvedGraphAnimation {
  /**
   * Entrance reveal, or null if disabled. `cameraFit` flies the camera to the
   * fit on load. `trigger` is when it starts (default 'visible').
   */
  enter:
    | (ResolvedGraphPhase & { stagger: boolean; cameraFit: boolean; trigger: 'visible' | 'mount' })
    | null;
  /** Data-update enter-fade for newly added marks, or null. */
  update: ResolvedGraphPhase | null;
  /** Ghost fade-out for removed marks, or null. */
  exit: ResolvedGraphPhase | null;
  /** Camera flight easing, or null. `'auto'` derives duration from zoom distance. */
  camera: { duration: number | 'auto'; ease: AnimationEase } | null;
  /** Hover emphasis crossfade, or null. */
  hover: { duration: number; ease: AnimationEase } | null;
}

const ENTER_DEFAULT = {
  duration: 500,
  ease: 'smooth' as AnimationEase,
  stagger: true,
  cameraFit: true,
  trigger: 'visible' as 'visible' | 'mount',
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
    update: resolvePhase(spec.update, UPDATE_DEFAULT),
    exit: resolvePhase(spec.exit, EXIT_DEFAULT),
    camera: resolveCamera(spec.camera),
    hover: resolveDurationPhase(spec.hover, HOVER_DEFAULT),
  };
}

function resolveEnter(
  phase: GraphEnterPhaseConfig | boolean | undefined,
): ResolvedGraphAnimation['enter'] {
  if (phase === false) return null;
  if (phase === undefined || phase === true) return { ...ENTER_DEFAULT };
  return {
    ...resolvePhaseConfig(phase, ENTER_DEFAULT),
    stagger: phase.stagger !== false,
    cameraFit: ENTER_DEFAULT.cameraFit,
    trigger: phase.trigger === 'mount' ? 'mount' : 'visible',
  };
}

/** Resolve an enter/update/exit phase; a spring sets the duration to its settling time. */
function resolvePhase(
  phase: GraphPhaseConfig | boolean | undefined,
  defaults: { duration: number; ease: AnimationEase },
): ResolvedGraphPhase | null {
  if (phase === false) return null;
  if (phase === undefined || phase === true)
    return { duration: defaults.duration, ease: defaults.ease };
  return resolvePhaseConfig(phase, defaults);
}

function resolvePhaseConfig(
  phase: GraphPhaseConfig,
  defaults: { duration: number; ease: AnimationEase },
): ResolvedGraphPhase {
  const resolved: ResolvedGraphPhase = {
    duration: phase.duration ?? defaults.duration,
    ease: phase.ease ?? defaults.ease,
  };
  if (phase.spring) {
    resolved.spring = { ...phase.spring };
    resolved.duration = springDuration(phase.spring);
  }
  return resolved;
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
