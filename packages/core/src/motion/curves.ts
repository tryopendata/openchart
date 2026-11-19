/**
 * Curve registry: the one source of every sampled easing curve.
 *
 * A curve is a list of stops evaluated piecewise-linearly, exactly like CSS
 * `linear()`. Stops are either evenly spaced values (`[0, 0.4, 1]`) or
 * positioned `{ t, value }` pairs, so a curve can be dense where it moves fast.
 *
 * The CSS tokens `--oc-ease-smooth` / `--oc-ease-snappy` / `--oc-ease-gentle` are generated from
 * this registry (see `styles/token-definitions.ts`), and the JS paths evaluate
 * the same stops through `evalCurve`, so the two never drift.
 */
import type { AnimationEase } from '../types/spec';

export interface CurveStop {
  /** Input progress in [0, 1]. */
  t: number;
  /** Output value. May leave [0, 1] (overshoot) unless the curve is monotone. */
  value: number;
}

/** Evenly spaced values, or positioned stops with strictly increasing `t`. */
export type CurveInput = readonly number[] | readonly CurveStop[];

interface Curve {
  readonly stops: readonly CurveStop[];
  /** True when the input was an evenly spaced value array (CSS emits no positions). */
  readonly evenlySpaced: boolean;
  /** Non-decreasing values from 0 to 1, so `invertCurve` has one answer. */
  readonly monotone: boolean;
  /** Running max of the values clamped to [0, 1], per stop (for evalValueCurve). */
  readonly envelope: readonly number[];
}

/**
 * Decks `snap`: `M0,0 C0.06,0.6 0.12,0.9 0.3,0.97 C0.5,1 0.72,1 1,1`, two cubic
 * segments, sampled by solving x -> t on each segment (offline) and rounding to
 * 4 decimals. Stops are dense through the attack (every 0.02 up to 0.3, which
 * includes t=0.2) and sparse in the tail. Reaches ~0.67 at t=0.1 and ~0.89 at
 * t=0.2, then settles without overshoot.
 */
const SNAP: readonly CurveStop[] = [
  { t: 0, value: 0 },
  { t: 0.02, value: 0.1876 },
  { t: 0.04, value: 0.3469 },
  { t: 0.06, value: 0.4773 },
  { t: 0.08, value: 0.582 },
  { t: 0.1, value: 0.6656 },
  { t: 0.12, value: 0.7325 },
  { t: 0.14, value: 0.7862 },
  { t: 0.16, value: 0.8296 },
  { t: 0.18, value: 0.8647 },
  { t: 0.2, value: 0.8931 },
  { t: 0.22, value: 0.9161 },
  { t: 0.24, value: 0.9346 },
  { t: 0.26, value: 0.9494 },
  { t: 0.28, value: 0.961 },
  { t: 0.3, value: 0.97 },
  { t: 0.35, value: 0.9768 },
  { t: 0.4, value: 0.9825 },
  { t: 0.45, value: 0.987 },
  { t: 0.5, value: 0.9906 },
  { t: 0.55, value: 0.9934 },
  { t: 0.6, value: 0.9956 },
  { t: 0.65, value: 0.9971 },
  { t: 0.7, value: 0.9983 },
  { t: 0.75, value: 0.999 },
  { t: 0.8, value: 0.9995 },
  { t: 0.85, value: 0.9998 },
  { t: 0.9, value: 0.9999 },
  { t: 0.95, value: 1 },
  { t: 1, value: 1 },
];

const CURVE_INPUTS = {
  /** Decks snap. The sampled source of the default `smooth`. */
  snap: SNAP,
  /** The default ease: an alias of `snap`, so the default improves with no spec change. */
  smooth: SNAP,
  /** Today's old `smooth` (a gentle ease-out), kept under its own name. */
  gentle: [0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1],
  /**
   * Monotone, non-overshooting ease-out, faster than `smooth`. Sampled from
   * `M0,0 C0.04,0.75 0.12,0.97 0.3,0.995 C0.4,1 0.5,1 0.6,1` then held at 1: it is
   * ~0.78 at t=0.1 (smooth: ~0.67), 0.951 at 0.2, reaches 0.999 by t~0.45 and
   * is exactly 1 from t=0.55, so it settles sooner than `smooth`.
   */
  snappy: [
    { t: 0, value: 0 },
    { t: 0.02, value: 0.2926 },
    { t: 0.04, value: 0.4806 },
    { t: 0.06, value: 0.6111 },
    { t: 0.08, value: 0.7061 },
    { t: 0.1, value: 0.7772 },
    { t: 0.12, value: 0.8315 },
    { t: 0.14, value: 0.8735 },
    { t: 0.16, value: 0.9061 },
    { t: 0.18, value: 0.9314 },
    { t: 0.2, value: 0.951 },
    { t: 0.22, value: 0.966 },
    { t: 0.24, value: 0.9773 },
    { t: 0.26, value: 0.9855 },
    { t: 0.28, value: 0.9913 },
    { t: 0.3, value: 0.995 },
    { t: 0.35, value: 0.9971 },
    { t: 0.4, value: 0.9985 },
    { t: 0.45, value: 0.9994 },
    { t: 0.5, value: 0.9998 },
    { t: 0.55, value: 1 },
    { t: 0.6, value: 1 },
    { t: 0.8, value: 1 },
    { t: 1, value: 1 },
  ],
  /**
   * Accent only (annotation markers and the like): Decks
   * `M0,0 C0.1,0.7 0.18,1.13 0.4,1.06 C0.58,0.99 0.8,1 1,1` overshoots to ~1.067
   * near t=0.35 and settles by ~0.8. NOT monotone, so it is never an authored
   * ease and never used for value-encoding geometry (use evalValueCurve there).
   */
  punch: [
    { t: 0, value: 0 },
    { t: 0.025, value: 0.1714 },
    { t: 0.05, value: 0.3321 },
    { t: 0.075, value: 0.4776 },
    { t: 0.1, value: 0.605 },
    { t: 0.125, value: 0.7132 },
    { t: 0.15, value: 0.8029 },
    { t: 0.175, value: 0.8757 },
    { t: 0.2, value: 0.9336 },
    { t: 0.225, value: 0.9787 },
    { t: 0.25, value: 1.0127 },
    { t: 0.275, value: 1.0373 },
    { t: 0.3, value: 1.0539 },
    { t: 0.325, value: 1.0636 },
    { t: 0.35, value: 1.0673 },
    { t: 0.375, value: 1.0659 },
    { t: 0.4, value: 1.06 },
    { t: 0.425, value: 1.0509 },
    { t: 0.45, value: 1.0428 },
    { t: 0.475, value: 1.0358 },
    { t: 0.5, value: 1.0296 },
    { t: 0.55, value: 1.0196 },
    { t: 0.6, value: 1.0122 },
    { t: 0.65, value: 1.0069 },
    { t: 0.7, value: 1.0033 },
    { t: 0.75, value: 1.0011 },
    { t: 0.8, value: 0.9999 },
    { t: 0.85, value: 0.9995 },
    { t: 0.9, value: 0.9996 },
    { t: 0.95, value: 0.9998 },
    { t: 1, value: 1 },
  ],
} as const satisfies Record<string, CurveInput>;

export type CurveName = keyof typeof CURVE_INPUTS;

/**
 * Curves `invertCurve` accepts. Kept as a type so a non-monotone curve is a
 * compile error; a test pins it to the runtime monotonicity check.
 */
export type MonotoneCurveName = 'snap' | 'smooth' | 'snappy' | 'gentle';

// Every authored ease must have a curve.
const _easeIsCurve: AnimationEase extends CurveName ? true : never = true;
void _easeIsCurve;

function buildCurve(name: string, input: CurveInput): Curve {
  if (input.length < 2) throw new Error(`Curve "${name}" needs at least two stops`);
  const evenlySpaced = typeof input[0] === 'number';
  const stops: CurveStop[] = evenlySpaced
    ? (input as readonly number[]).map((value, i, all) => ({ t: i / (all.length - 1), value }))
    : (input as readonly CurveStop[]).map((s) => ({ t: s.t, value: s.value }));
  if (stops[0].t !== 0 || stops[stops.length - 1].t !== 1) {
    throw new Error(`Curve "${name}" must start at t=0 and end at t=1`);
  }
  for (let i = 1; i < stops.length; i++) {
    if (!(stops[i].t > stops[i - 1].t)) {
      throw new Error(`Curve "${name}" stops must have strictly increasing t`);
    }
  }
  let monotone = stops[0].value === 0 && stops[stops.length - 1].value === 1;
  const envelope: number[] = [];
  let runningMax = 0;
  for (let i = 0; i < stops.length; i++) {
    if (i > 0 && stops[i].value < stops[i - 1].value) monotone = false;
    runningMax = Math.max(runningMax, clamp01(stops[i].value));
    envelope.push(runningMax);
  }
  return { stops, evenlySpaced, monotone, envelope };
}

const CURVES: Readonly<Record<CurveName, Curve>> = Object.fromEntries(
  Object.entries(CURVE_INPUTS).map(([name, input]) => [name, buildCurve(name, input)]),
) as Record<CurveName, Curve>;

/** Names of every registered curve, in registry order. */
export const CURVE_NAMES: readonly CurveName[] = Object.keys(CURVE_INPUTS) as CurveName[];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function getCurve(name: CurveName): Curve {
  const curve = CURVES[name];
  if (!curve) throw new Error(`Unknown curve "${name}"`);
  return curve;
}

/** Index of the segment [i, i+1] containing t (t already clamped). */
function segmentIndex(stops: readonly CurveStop[], t: number): number {
  let lo = 0;
  let hi = stops.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (stops[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The curve's stops, for consumers that need the raw data (tests, generators). */
export function curveStops(name: CurveName): readonly CurveStop[] {
  return getCurve(name).stops;
}

/** Whether a curve is monotone from 0 to 1 (so it can be inverted). */
export function isMonotoneCurve(name: CurveName): boolean {
  return getCurve(name).monotone;
}

/** Evaluate a curve at t (clamped to [0, 1]), piecewise-linearly like CSS linear(). */
export function evalCurve(name: CurveName, t: number): number {
  const { stops } = getCurve(name);
  const x = Number.isNaN(t) ? 0 : clamp01(t);
  const i = segmentIndex(stops, x);
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  if (b.t === a.t) return a.value;
  return a.value + ((b.value - a.value) * (x - a.t)) / (b.t - a.t);
}

/**
 * Evaluate a curve for value-encoding geometry: the output is clamped to
 * [0, 1] and then replaced by its running maximum, so no curve can overshoot
 * or dip back. On a monotone curve this equals evalCurve.
 */
export function evalValueCurve(name: CurveName, t: number): number {
  const curve = getCurve(name);
  const x = Number.isNaN(t) ? 0 : clamp01(t);
  const i = segmentIndex(curve.stops, x);
  return Math.max(curve.envelope[i], clamp01(evalCurve(name, x)));
}

/**
 * The first t at which a monotone curve reaches progress p (clamped to [0, 1]).
 * Used to place delays at a progress point of a parent's tween.
 */
export function invertCurve(name: MonotoneCurveName, p: number): number {
  const curve = getCurve(name);
  if (!curve.monotone) throw new Error(`Curve "${name}" is not monotone and cannot be inverted`);
  const { stops } = curve;
  const target = clamp01(p);
  if (target <= stops[0].value) return 0;
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i];
    if (b.value >= target) {
      const a = stops[i - 1];
      if (b.value === a.value) return a.t;
      return a.t + ((target - a.value) * (b.t - a.t)) / (b.value - a.value);
    }
  }
  return 1;
}

function formatPercent(t: number): string {
  return `${Number((t * 100).toFixed(4))}%`;
}

/**
 * Emit a curve as a CSS `linear()` easing. Evenly spaced curves emit bare
 * values; positioned curves emit `value t%` pairs. With `indent`, each stop goes
 * on its own line (the tokens.css layout), indented two spaces past `indent`.
 */
export function curveToCSSLinear(name: CurveName, options?: { indent?: string }): string {
  const curve = getCurve(name);
  const items = curve.stops.map((s) =>
    curve.evenlySpaced ? String(s.value) : `${s.value} ${formatPercent(s.t)}`,
  );
  const indent = options?.indent;
  if (indent === undefined) return `linear(${items.join(', ')})`;
  const inner = `${indent}  `;
  return `linear(\n${inner}${items.join(`,\n${inner}`)}\n${indent})`;
}
