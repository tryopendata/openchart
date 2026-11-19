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

/** Parse the evenly spaced values of a `linear()` token out of tokens.css. */
function emittedSamples(token: string): number[] {
  const match = tokensCss.match(new RegExp(`${token}:\\s*linear\\(([^)]*)\\)`));
  if (!match) throw new Error(`${token} not found in tokens.css`);
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

const grid = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('curve registry', () => {
  it.each([
    'smooth',
    'snappy',
  ] as const)('evalCurve(%s) matches the emitted linear() at every stop', (name) => {
    const samples = emittedSamples(`--oc-ease-${name}`);
    expect(samples.length).toBe(curveStops(name).length);
    samples.forEach((value, i) => {
      expect(evalCurve(name, i / (samples.length - 1))).toBeCloseTo(value, 12);
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
    expect(curveToCSSLinear('smooth')).toBe(
      'linear(0, 0.157, 0.438, 0.64, 0.766, 0.85, 0.906, 0.941, 0.964, 0.978, 0.988, 0.994, 0.998, 1)',
    );
  });

  it('MonotoneCurveName lists exactly the monotone curves', () => {
    const monotone: MonotoneCurveName[] = ['smooth'];
    expect(CURVE_NAMES.filter(isMonotoneCurve)).toEqual(monotone);
  });

  it.each(
    CURVE_NAMES.filter(isMonotoneCurve) as MonotoneCurveName[],
  )('invertCurve(%s, evalCurve(t)) recovers t', (name) => {
    for (const t of grid) {
      expect(invertCurve(name, evalCurve(name, t))).toBeCloseTo(t, 9);
    }
  });

  it('invertCurve rejects a non-monotone curve at runtime', () => {
    expect(() => invertCurve('snappy' as MonotoneCurveName, 0.5)).toThrow(/not monotone/);
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

  it("flattens snappy's overshoot and dip but leaves smooth untouched", () => {
    expect(Math.max(...grid.map((t) => evalCurve('snappy', t)))).toBeGreaterThan(1.02);
    // After the curve first reaches 1 the envelope holds at 1 through the 0.957 dip.
    expect(evalValueCurve('snappy', 18 / 31)).toBe(1);
    for (const t of grid) expect(evalValueCurve('smooth', t)).toBe(evalCurve('smooth', t));
  });
});
