/** Deterministic, bounded motion shared by rendering and timestamp-based export. */
import type { AnimationEase, SpringConfig } from '../types/spec';

export interface MotionPhase {
  duration: number;
  ease?: AnimationEase;
  spring?: SpringConfig;
}

export interface MotionSample {
  /** Normalized progress; quantitative geometry never overshoots its endpoints. */
  position: number;
  /** Normalized distance per second. */
  velocity: number;
  settled: boolean;
}

export const MOTION_REST_THRESHOLD = 0.001;
export const MAX_SPRING_DURATION = 1200;
export const FLUID_SPRING: Readonly<Required<SpringConfig>> = {
  stiffness: 320,
  damping: 36,
  mass: 1,
};

// Critical damping is the lower bound for quantitative geometry: a bouncy
// panel must never inflate a value. UI controls may use independent springs.
function springState(timeMs: number, config: SpringConfig): MotionSample {
  const stiffness = config.stiffness ?? FLUID_SPRING.stiffness;
  const mass = config.mass ?? FLUID_SPRING.mass;
  const omega = Math.sqrt(stiffness / mass);
  const damping = Math.max(config.damping ?? FLUID_SPRING.damping, 2 * Math.sqrt(stiffness * mass));
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const t = Math.max(0, timeMs) / 1000;
  let remaining: number;
  let velocity: number;
  if (zeta - 1 < 0.0001) {
    const decay = Math.exp(-omega * t);
    remaining = (1 + omega * t) * decay;
    velocity = omega * omega * t * decay;
  } else {
    const root = Math.sqrt(zeta * zeta - 1);
    const slow = -omega / (zeta + root);
    const fast = -omega * (zeta + root);
    const denominator = fast - slow;
    remaining = (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / denominator;
    velocity = (-fast * slow * (Math.exp(slow * t) - Math.exp(fast * t))) / denominator;
  }
  return {
    position: Math.min(1, Math.max(0, 1 - remaining)),
    velocity,
    settled: remaining <= MOTION_REST_THRESHOLD && Math.abs(velocity) <= MOTION_REST_THRESHOLD,
  };
}

/** Resolve finite duration once, outside the frame loop. */
export function springDuration(config: SpringConfig): number {
  for (const name of ['stiffness', 'damping', 'mass'] as const) {
    const value = config[name];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`spring.${name} must be finite and positive`);
  }
  for (let ms = 1; ms < MAX_SPRING_DURATION; ms++) {
    if (springState(ms, config).settled) return ms;
  }
  return MAX_SPRING_DURATION;
}

/** All callers, including exports, pass elapsed milliseconds explicitly. */
export function sampleMotion(phase: MotionPhase, elapsedMs: number): MotionSample {
  if (phase.duration <= 0 || elapsedMs >= phase.duration) {
    return { position: 1, velocity: 0, settled: true };
  }
  if (elapsedMs <= 0) return { position: 0, velocity: 0, settled: false };
  if (phase.spring) return springState(elapsedMs, phase.spring);
  const t = elapsedMs / phase.duration;
  const power = phase.ease === 'snappy' ? 5 : 3;
  return {
    position: 1 - (1 - t) ** power,
    velocity: (power * (1 - t) ** (power - 1) * 1000) / phase.duration,
    settled: false,
  };
}

/** CSS samples use the same clock and evaluator as SVG, canvas, and export. */
export function motionCSS(phase: MotionPhase): string {
  return `linear(${Array.from({ length: 101 }, (_, i) => sampleMotion(phase, (i * phase.duration) / 100).position.toFixed(6)).join(',')})`;
}
