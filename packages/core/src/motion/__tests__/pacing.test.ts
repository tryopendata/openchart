/**
 * Default pacing: `smooth` is the soft `glide` curve, quick fades stay on
 * `snap`, the stagger budget is 450ms, and every curve the generated CSS names
 * has a token (an undefined var() voids the whole `animation` shorthand).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as choreography from '../choreography';
import { ENTRANCE_ROLES, FADE_CURVE } from '../choreography';
import * as curves from '../curves';
import { type CurveName, evalCurve, invertCurve, isMonotoneCurve } from '../curves';
import { clampStaggerDelay, MAX_TOTAL_STAGGER_MS } from '../stagger';

const tokensCss = readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf8');
const GLIDE = 'glide' as CurveName;

type Bezier = (b: readonly [number, number, number, number], t: number) => number;

describe('glide is the default curve', () => {
  it('is registered, monotone, and runs 0 to 1', () => {
    expect(isMonotoneCurve(GLIDE)).toBe(true);
    expect(evalCurve(GLIDE, 0)).toBe(0);
    expect(evalCurve(GLIDE, 1)).toBe(1);
  });

  it('is what smooth resolves to', () => {
    for (const t of [0.1, 0.5]) expect(evalCurve('smooth', t)).toBe(evalCurve(GLIDE, t));
  });

  it('starts gently and settles late', () => {
    const early = evalCurve('smooth', 0.1);
    expect(early).toBeGreaterThanOrEqual(0.15);
    expect(early).toBeLessThanOrEqual(0.3);
    const settle = invertCurve('smooth', 0.97);
    expect(settle).toBeGreaterThanOrEqual(0.6);
    expect(settle).toBeLessThanOrEqual(0.85);
  });

  it('follows cubic-bezier(0.2, 0, 0, 1) within sampling error', () => {
    const bezier = (curves as unknown as Record<string, Bezier>).evalCubicBezier;
    for (const t of [0.05, 0.2, 0.4, 0.7]) {
      expect(evalCurve(GLIDE, t)).toBeCloseTo(bezier([0.2, 0, 0, 1], t), 2);
    }
  });

  it('exports evalCubicBezier from curves and choreography alike', () => {
    const fromCurves = (curves as unknown as Record<string, Bezier>).evalCubicBezier;
    const fromChoreography = (choreography as unknown as Record<string, Bezier>).evalCubicBezier;
    expect(typeof fromCurves).toBe('function');
    expect(fromChoreography).toBe(fromCurves);
  });
});

describe('quick fades', () => {
  it('stay on snap', () => {
    expect(FADE_CURVE).toBe('snap');
  });
});

describe('ease tokens', () => {
  it('define snap, punch and glide', () => {
    for (const name of ['snap', 'punch', 'glide']) {
      expect(tokensCss).toMatch(new RegExp(`--oc-ease-${name}:\\s*linear\\(`));
    }
  });

  it('cover every curve the generated CSS names', () => {
    const named = new Set<string>([FADE_CURVE]);
    for (const role of ENTRANCE_ROLES) {
      if (role.timing.kind === 'curve') named.add(role.timing.curve);
    }
    for (const name of named) {
      expect(tokensCss, `--oc-ease-${name}`).toMatch(new RegExp(`--oc-ease-${name}:`));
    }
  });

  it('default the entrance duration to 800ms', () => {
    expect(tokensCss).toMatch(/--oc-animation-duration:\s*800ms/);
  });
});

describe('stagger budget', () => {
  it('spreads at most 450ms', () => {
    expect(MAX_TOTAL_STAGGER_MS).toBe(450);
    expect(clampStaggerDelay(80, 5)).toBe(80);
    expect(clampStaggerDelay(80, 41)).toBe(450 / 40);
  });
});
