/**
 * Curve registry: the one source of every sampled easing curve.
 *
 * A curve is a list of stops evaluated piecewise-linearly, exactly like CSS
 * `linear()`. Stops are either evenly spaced values (`[0, 0.4, 1]`) or
 * positioned `{ t, value }` pairs, so a curve can be dense where it moves fast.
 *
 * The CSS tokens `--oc-ease-smooth` / `--oc-ease-snappy` are generated from
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

const CURVE_INPUTS = {
  /** Gentle ease-out. Today's CSS `smooth`. */
  smooth: [0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1],
  /**
   * Today's CSS `snappy`: starts slow, peaks at 1.028 and dips to 0.957, so it
   * is spring-shaped and NOT monotone. Value roles go through evalValueCurve.
   */
  snappy: [
    0, 0.012, 0.048, 0.108, 0.194, 0.302, 0.426, 0.559, 0.69, 0.808, 0.905, 0.973, 1.013, 1.028,
    1.023, 1.006, 0.984, 0.966, 0.957, 0.957, 0.964, 0.975, 0.986, 0.995, 1, 1.003, 1.002, 1, 0.998,
    0.998, 0.999, 1,
  ],
} as const satisfies Record<string, CurveInput>;

export type CurveName = keyof typeof CURVE_INPUTS;

/**
 * Curves `invertCurve` accepts. Kept as a type so a non-monotone curve is a
 * compile error; a test pins it to the runtime monotonicity check.
 */
export type MonotoneCurveName = 'smooth';

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
