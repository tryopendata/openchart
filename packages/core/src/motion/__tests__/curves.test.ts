import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURVE_NAMES,
  type CurveName,
  curveStops,
  curveToCSSLinear,
  evalCurve,
  evalValueCurve,
  invertCurve,
  isMonotoneCurve,
  type MonotoneCurveName,
} from '../curves';

const tokensCss = readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf8');

/** Parse the stops of a `linear()` token (positions optional) out of tokens.css. */
function emittedStops(token: string): { value: number; pos?: number }[] {
  const match = tokensCss.match(new RegExp(`${token}:\\s*linear\\(([^)]*)\\)`));
  if (!match) throw new Error(`${token} not found in tokens.css`);
  return parseLinear(match[1]);
}

function parseLinear(body: string): { value: number; pos?: number }[] {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const [value, pos] = item.split(/\s+/);
      return { value: Number(value), pos: pos ? Number.parseFloat(pos) / 100 : undefined };
    });
}

const grid = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('curve registry', () => {
  it.each([
    'smooth',
    'snappy',
    'gentle',
    'snap',
    'punch',
    'glide',
  ] as const)('evalCurve(%s) matches the tokens.css linear() at every stop', (name) => {
    const emitted = emittedStops(`--oc-ease-${name}`);
    const stops = curveStops(name);
    expect(emitted.length).toBe(stops.length);
    emitted.forEach((e, i) => {
      const t = e.pos ?? i / (emitted.length - 1);
      expect(t).toBeCloseTo(stops[i].t, 9);
      expect(evalCurve(name, t)).toBeCloseTo(e.value, 12);
    });
  });

  it.each(CURVE_NAMES)('curveToCSSLinear(%s) agrees with evalCurve at every stop', (name) => {
    const emitted = parseLinear(curveToCSSLinear(name).slice('linear('.length, -1));
    const stops = curveStops(name);
    expect(emitted.length).toBe(stops.length);
    emitted.forEach((e, i) => {
      const t = e.pos ?? i / (emitted.length - 1);
      expect(evalCurve(name, t)).toBeCloseTo(e.value, 12);
    });
  });

  it('interpolates linearly between stops and clamps t', () => {
    const stops = curveStops('smooth');
    const mid = (stops[1].t + stops[2].t) / 2;
    expect(evalCurve('smooth', mid)).toBeCloseTo((stops[1].value + stops[2].value) / 2, 12);
    expect(evalCurve('smooth', -1)).toBe(0);
    expect(evalCurve('smooth', 2)).toBe(1);
  });

  it('emits a single-line linear() without an indent', () => {
    expect(curveToCSSLinear('gentle')).toBe(
      'linear(0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1)',
    );
  });

  it('MonotoneCurveName lists exactly the monotone curves', () => {
    const monotone: MonotoneCurveName[] = ['snap', 'glide', 'smooth', 'gentle', 'snappy'];
    expect([...CURVE_NAMES.filter(isMonotoneCurve)].sort()).toEqual([...monotone].sort());
  });

  it.each(
    CURVE_NAMES.filter(isMonotoneCurve) as MonotoneCurveName[],
  )('invertCurve(%s, evalCurve(t)) recovers t', (name) => {
    // Past the first stop that reaches 1 the curve is flat, so it has no unique inverse.
    const limit = curveStops(name).find((s) => s.value === 1)?.t ?? 1;
    for (const t of grid.filter((x) => x <= limit)) {
      expect(invertCurve(name, evalCurve(name, t))).toBeCloseTo(t, 9);
    }
  });

  it('invertCurve rejects a non-monotone curve at runtime', () => {
    expect(() => invertCurve('punch' as MonotoneCurveName, 0.5)).toThrow(/not monotone/);
  });

  it.each(CURVE_NAMES)('evalValueCurve(%s) is monotone and within [0, 1]', (name: CurveName) => {
    let prev = -Infinity;
    for (const t of grid) {
      const v = evalValueCurve(name, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(evalValueCurve(name, 0)).toBe(0);
    expect(evalValueCurve(name, 1)).toBe(1);
  });

  it("flattens punch's overshoot but leaves monotone curves untouched", () => {
    expect(Math.max(...grid.map((t) => evalCurve('punch', t)))).toBeGreaterThan(1.05);
    expect(evalValueCurve('punch', 0.35)).toBe(1);
    for (const name of ['smooth', 'snappy', 'gentle'] as const) {
      for (const t of grid) expect(evalValueCurve(name, t)).toBe(evalCurve(name, t));
    }
  });

  it('glide and smooth share one set of samples', () => {
    expect(curveStops('smooth')).toEqual(curveStops('glide'));
    expect(curveStops('glide').some((s) => s.t === 0.2)).toBe(true);
  });

  it('smooth starts gently, settles late and never exceeds 1', () => {
    expect(evalCurve('smooth', 0.1)).toBeCloseTo(0.1562, 4);
    expect(evalCurve('smooth', 0.2)).toBe(0.5);
    expect(evalCurve('smooth', 0.7)).toBeCloseTo(0.9633, 4);
    expect(Math.max(...grid.map((t) => evalCurve('smooth', t)))).toBeLessThanOrEqual(1);
  });

  it('snap keeps the Decks attack for quick fades', () => {
    expect(evalCurve('snap', 0.2)).toBeGreaterThanOrEqual(0.89);
    expect(evalCurve('snap', 0.1)).toBeGreaterThanOrEqual(0.66);
  });

  it.each(['smooth', 'snappy', 'gentle'] as const)('%s is monotone and never exceeds 1', (name) => {
    expect(isMonotoneCurve(name)).toBe(true);
    let prev = 0;
    for (const t of grid) {
      const v = evalCurve(name, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it('snappy attacks at least as fast as smooth and settles sooner', () => {
    expect(evalCurve('snappy', 0.1)).toBeGreaterThanOrEqual(evalCurve('smooth', 0.1));
    expect(evalCurve('snappy', 0.6)).toBeGreaterThanOrEqual(0.999);
    expect(evalCurve('smooth', 0.6)).toBeLessThan(0.999);
  });

  it('gentle keeps the previous smooth samples', () => {
    expect(curveStops('gentle').map((s) => s.value)).toEqual([
      0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1,
    ]);
  });

  it('punch overshoots, is not monotone, and ends at 1', () => {
    expect(Math.max(...grid.map((t) => evalCurve('punch', t)))).toBeGreaterThan(1.05);
    expect(isMonotoneCurve('punch')).toBe(false);
    expect(evalCurve('punch', 1)).toBe(1);
  });
});
