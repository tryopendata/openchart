/**
 * Animation resolver: normalizes AnimationSpec into fully resolved config.
 *
 * Handles the shorthand forms:
 * - true -> { enter: true } -> full defaults
 * - { enter: { duration: 800 } } -> merge with defaults
 * - false/undefined -> undefined (no animation)
 */

import type {
  AnimationConfig,
  AnimationEase,
  AnimationPhaseConfig,
  AnimationSpec,
  AnimationStagger,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';

/** Default values for entrance animation. */
const ENTER_DEFAULTS = {
  duration: 500,
  ease: 'smooth' as AnimationEase,
  staggerDelay: 80,
  staggerOrder: 'index' as const,
  annotationDelay: 200,
} as const;

/** Maximum total stagger time in ms. Prevents 200-bar charts from taking 6s. */
const MAX_TOTAL_STAGGER_MS = 2000;

/**
 * Resolve an AnimationSpec into a fully resolved config with all defaults filled.
 * Returns undefined if animation is disabled (false or omitted).
 */
export function resolveAnimation(spec: AnimationSpec | undefined): ResolvedAnimation | undefined {
  if (spec === undefined || spec === false) return undefined;

  // true -> default enter animation
  if (spec === true) {
    return {
      enabled: true,
      duration: ENTER_DEFAULTS.duration,
      ease: ENTER_DEFAULTS.ease,
      staggerDelay: ENTER_DEFAULTS.staggerDelay,
      staggerOrder: ENTER_DEFAULTS.staggerOrder,
      annotationDelay: ENTER_DEFAULTS.annotationDelay,
    };
  }

  // AnimationConfig object
  const config = spec as AnimationConfig;

  // If no enter phase specified or enter is false, no animation
  if (config.enter === false || (config.enter === undefined && !hasAnyPhase(config))) {
    return undefined;
  }

  const enterConfig = resolvePhaseConfig(config.enter);

  return {
    enabled: true,
    duration: enterConfig.duration,
    ease: enterConfig.ease,
    staggerDelay: enterConfig.staggerDelay,
    staggerOrder: enterConfig.staggerOrder,
    annotationDelay: config.annotationDelay ?? ENTER_DEFAULTS.annotationDelay,
  };
}

/**
 * Clamp stagger delay so total stagger time doesn't exceed MAX_TOTAL_STAGGER_MS.
 */
export function clampStaggerDelay(delay: number, elementCount: number): number {
  if (elementCount <= 1) return 0;
  return Math.min(delay, MAX_TOTAL_STAGGER_MS / elementCount);
}

function hasAnyPhase(config: AnimationConfig): boolean {
  return config.enter !== undefined || config.update !== undefined || config.exit !== undefined;
}

interface ResolvedPhase {
  duration: number;
  ease: AnimationEase;
  staggerDelay: number;
  staggerOrder: 'index' | 'value' | 'reverse';
}

function resolvePhaseConfig(phase: AnimationPhaseConfig | boolean | undefined): ResolvedPhase {
  if (phase === undefined || phase === true) {
    return {
      duration: ENTER_DEFAULTS.duration,
      ease: ENTER_DEFAULTS.ease,
      staggerDelay: ENTER_DEFAULTS.staggerDelay,
      staggerOrder: ENTER_DEFAULTS.staggerOrder,
    };
  }

  const cfg = phase as AnimationPhaseConfig;
  const stagger = resolveStagger(cfg.stagger);

  return {
    duration: cfg.duration ?? ENTER_DEFAULTS.duration,
    ease: cfg.ease ?? ENTER_DEFAULTS.ease,
    staggerDelay: stagger.delay,
    staggerOrder: stagger.order,
  };
}

function resolveStagger(stagger: AnimationStagger | boolean | undefined): {
  delay: number;
  order: 'index' | 'value' | 'reverse';
} {
  if (stagger === false) return { delay: 0, order: 'index' };
  if (stagger === undefined || stagger === true) {
    return { delay: ENTER_DEFAULTS.staggerDelay, order: ENTER_DEFAULTS.staggerOrder };
  }
  return {
    delay: stagger.delay ?? ENTER_DEFAULTS.staggerDelay,
    order: stagger.order ?? ENTER_DEFAULTS.staggerOrder,
  };
}
