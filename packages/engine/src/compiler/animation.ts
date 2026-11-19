/**
 * Animation resolver: normalizes AnimationSpec into fully resolved config.
 *
 * Handles the shorthand forms:
 * - true -> all three phases with defaults
 * - { enter: { duration: 800 } } -> merge with defaults per phase
 * - false/undefined -> undefined (no animation)
 *
 * Each phase resolves independently:
 * - true/config-object -> resolved phase merged onto that phase's defaults
 * - false -> phase absent
 * - undefined -> phase present with defaults (animation: {} behaves like true)
 *
 * Returns undefined only when ALL phases resolve absent.
 */

import type {
  AnimationConfig,
  AnimationPhaseConfig,
  AnimationSpec,
  AnimationStagger,
  EnterPhaseConfig,
  ResolvedAnimation,
  ResolvedAnimationPhase,
  UpdatePhaseConfig,
} from '@opendata-ai/openchart-core';
import {
  EXIT_CURVE,
  EXIT_FADE_MS,
  FLUID_SPRING,
  springDuration,
} from '@opendata-ai/openchart-core';

// The stagger cap lives in core so every renderer shares it; re-exported unchanged.
export { clampStaggerDelay, MAX_TOTAL_STAGGER_MS } from '@opendata-ai/openchart-core';

/** Default values for entrance animation. */
export const ENTER_DEFAULTS: ResolvedAnimationPhase = {
  duration: 600,
  ease: 'smooth',
  staggerDelay: 80,
  staggerOrder: 'index',
  trigger: 'visible',
};

/** Default values for update (data transition) animation. */
export const UPDATE_DEFAULTS: ResolvedAnimationPhase = {
  duration: 500,
  ease: 'smooth',
  staggerDelay: 0,
  staggerOrder: 'index',
};

/**
 * Default values for exit animation: a quick fade that clears before survivors
 * move into the removed mark's slot (choreography's EXIT_FADE_MS/EXIT_CURVE).
 */
export const EXIT_DEFAULTS: ResolvedAnimationPhase = {
  duration: EXIT_FADE_MS,
  ease: EXIT_CURVE,
  staggerDelay: 0,
  staggerOrder: 'index',
};

/** Default annotation delay in ms after marks finish. */
const DEFAULT_ANNOTATION_DELAY = 150;

/**
 * Resolve an AnimationSpec into a fully resolved config with all defaults filled.
 * Returns undefined if animation is disabled (false or omitted).
 */
export function resolveAnimation(spec: AnimationSpec | undefined): ResolvedAnimation | undefined {
  if (spec === undefined || spec === false) return undefined;

  // true -> all three phases with defaults
  if (spec === true) {
    return {
      enter: { ...ENTER_DEFAULTS },
      update: { ...UPDATE_DEFAULTS },
      exit: { ...EXIT_DEFAULTS },
      annotationDelay: DEFAULT_ANNOTATION_DELAY,
    };
  }

  // AnimationConfig object
  const config: AnimationConfig = typeof spec === 'string' ? { preset: spec } : spec;
  const preset = config.preset;
  const spring = preset === 'fluid' ? { ...FLUID_SPRING } : undefined;
  const base = (defaults: ResolvedAnimationPhase): ResolvedAnimationPhase =>
    preset === undefined
      ? defaults
      : { ...defaults, duration: spring ? springDuration(spring) : 250, spring, staggerDelay: 0 };

  const enter = resolvePhase(config.enter, base(ENTER_DEFAULTS));
  const update = resolvePhase(config.update, base(UPDATE_DEFAULTS));
  // Exits are brief fades under every preset; only an authored phase opts
  // into spring timing.
  const exit = resolvePhase(config.exit, EXIT_DEFAULTS);

  // trigger is enter-only, so it is applied here like maxMarks below.
  // resolvePhase rebuilds the phase from its own fields, dropping it.
  if (enter) {
    const authored =
      config.enter && typeof config.enter === 'object'
        ? (config.enter as EnterPhaseConfig).trigger
        : undefined;
    enter.trigger = authored === 'mount' ? 'mount' : 'visible';
  }

  // maxMarks is update-only, so it is applied here rather than in the
  // phase-agnostic resolvePhase. No default is baked in: the renderer supplies
  // one so it can vary by render mode, and absence means "author didn't set it".
  if (
    update &&
    config.update &&
    typeof config.update === 'object' &&
    !Array.isArray(config.update)
  ) {
    const cap = (config.update as UpdatePhaseConfig).maxMarks;
    // Guard on >= 1, matching validate.ts: flooring a fractional cap like 0.5
    // would yield 0, and `0 ?? DEFAULT` keeps 0, disabling all transitions.
    if (typeof cap === 'number' && Number.isFinite(cap) && cap >= 1) {
      update.maxMarks = Math.floor(cap);
    }
  }

  // Return undefined only when ALL phases resolve absent
  if (!enter && !update && !exit) return undefined;

  return {
    enter: enter ?? undefined,
    update: update ?? undefined,
    exit: exit ?? undefined,
    annotationDelay:
      config.annotationDelay ?? (preset === undefined ? DEFAULT_ANNOTATION_DELAY : 0),
  };
}

/**
 * Resolve a single animation phase.
 * - false -> null (phase absent)
 * - undefined -> phase present with defaults
 * - true -> phase present with defaults
 * - config object -> merge with defaults
 */
function resolvePhase(
  phase: AnimationPhaseConfig | boolean | undefined,
  defaults: ResolvedAnimationPhase,
): ResolvedAnimationPhase | null {
  if (phase === false) return null;

  if (phase === undefined || phase === true) {
    return { ...defaults };
  }

  const cfg = phase as AnimationPhaseConfig;
  if (cfg.spring && (cfg.duration !== undefined || cfg.ease !== undefined)) {
    throw new Error('An animation phase cannot combine spring with duration or ease.');
  }
  const spring =
    cfg.spring ??
    (cfg.duration !== undefined || cfg.ease !== undefined ? undefined : defaults.spring);
  const stagger = resolveStagger(cfg.stagger, defaults);

  return {
    duration: spring ? springDuration(spring) : (cfg.duration ?? defaults.duration),
    spring,
    ease: cfg.ease ?? defaults.ease,
    staggerDelay: stagger.delay,
    staggerOrder: stagger.order,
  };
}

function resolveStagger(
  stagger: AnimationStagger | boolean | undefined,
  defaults: ResolvedAnimationPhase,
): {
  delay: number;
  order: 'index' | 'value' | 'reverse';
} {
  if (stagger === false) return { delay: 0, order: 'index' };
  if (stagger === undefined || stagger === true) {
    return { delay: defaults.staggerDelay, order: defaults.staggerOrder };
  }
  return {
    delay: stagger.delay ?? defaults.staggerDelay,
    order: stagger.order ?? defaults.staggerOrder,
  };
}
