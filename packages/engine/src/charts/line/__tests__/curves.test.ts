import {
  curveBasis,
  curveCardinal,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from 'd3-shape';
import { describe, expect, it } from 'vitest';
import { resolveCurve } from '../curves';

describe('resolveCurve', () => {
  it('defaults to curveMonotoneX when no interpolation is specified', () => {
    expect(resolveCurve()).toBe(curveMonotoneX);
    expect(resolveCurve(undefined)).toBe(curveMonotoneX);
  });

  it('maps "linear" to curveLinear', () => {
    expect(resolveCurve('linear')).toBe(curveLinear);
  });

  it('maps "monotone" to curveMonotoneX', () => {
    expect(resolveCurve('monotone')).toBe(curveMonotoneX);
  });

  it('maps "step" to curveStep', () => {
    expect(resolveCurve('step')).toBe(curveStep);
  });

  it('maps "step-before" to curveStepBefore', () => {
    expect(resolveCurve('step-before')).toBe(curveStepBefore);
  });

  it('maps "step-after" to curveStepAfter', () => {
    expect(resolveCurve('step-after')).toBe(curveStepAfter);
  });

  it('maps "basis" to curveBasis', () => {
    expect(resolveCurve('basis')).toBe(curveBasis);
  });

  it('maps "cardinal" to curveCardinal', () => {
    expect(resolveCurve('cardinal')).toBe(curveCardinal);
  });

  it('maps "natural" to curveNatural', () => {
    expect(resolveCurve('natural')).toBe(curveNatural);
  });
});
