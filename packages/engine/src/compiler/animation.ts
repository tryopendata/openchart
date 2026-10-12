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
  ResolvedAnimation,
  ResolvedAnimationPhase,
  UpdatePhaseConfig,
} from '@opendata-ai/openchart-core';
import { FLUID_SPRING, springDuration } from '@opendata-ai/openchart-core';

/** Default values for entrance animation. */
export const ENTER_DEFAULTS: ResolvedAnimationPhase = {
  duration: 450,
  ease: 'smooth',
  staggerDelay: 30,
  staggerOrder: 'index',
};

/** Default values for update (data transition) animation. */
export const UPDATE_DEFAULTS: ResolvedAnimationPhase = {
  duration: 450,
  ease: 'smooth',
  staggerDelay: 0,
  staggerOrder: 'index',
};

/** Default values for exit animation. */
export const EXIT_DEFAULTS: ResolvedAnimationPhase = {
  duration: 250,
  ease: 'smooth',
  staggerDelay: 0,
  staggerOrder: 'index',
};

/** Default annotation delay in ms after marks finish. */
const DEFAULT_ANNOTATION_DELAY = 150;

/** Maximum total stagger time in ms. Keeps the whole sweep inside one beat. */
const MAX_TOTAL_STAGGER_MS = 300;

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
  const preset = config.preset ?? 'legacy';
  const spring = preset === 'fluid' ? { ...FLUID_SPRING } : undefined;
  const base = (defaults: ResolvedAnimationPhase): ResolvedAnimationPhase =>
    preset === 'legacy'
      ? defaults
      : { ...defaults, duration: spring ? springDuration(spring) : 250, spring, staggerDelay: 0 };

  const enter = resolvePhase(config.enter, base(ENTER_DEFAULTS));
  const update = resolvePhase(config.update, base(UPDATE_DEFAULTS));
  // Exits are brief fades; only an authored phase opts into spring timing.
  const exit = resolvePhase(
    config.exit,
    preset === 'legacy' ? EXIT_DEFAULTS : { ...EXIT_DEFAULTS, duration: 160 },
  );

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
    annotationDelay: config.annotationDelay ?? (preset === 'legacy' ? DEFAULT_ANNOTATION_DELAY : 0),
  };
}

/**
 * Clamp stagger delay so total stagger time doesn't exceed MAX_TOTAL_STAGGER_MS.
 */
export function clampStaggerDelay(delay: number, elementCount: number): number {
  if (elementCount <= 1) return 0;
  return Math.min(delay, MAX_TOTAL_STAGGER_MS / elementCount);
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
