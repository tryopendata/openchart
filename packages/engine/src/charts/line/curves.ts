/**
 * Curve interpolation mapping.
 *
 * Maps Vega-Lite-style interpolation strings to d3-shape curve factories.
 * Used by both line and area chart computations.
 */

import type { MarkDef } from '@opendata-ai/openchart-core';
import type { CurveFactory } from 'd3-shape';
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

/** Map of interpolation string names to d3 curve factories. */
const CURVE_MAP: Record<NonNullable<MarkDef['interpolate']>, CurveFactory> = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStep,
  'step-before': curveStepBefore,
  'step-after': curveStepAfter,
  basis: curveBasis,
  cardinal: curveCardinal,
  natural: curveNatural,
};

/**
 * Resolve an interpolation string to a d3 curve factory.
 * Defaults to `curveMonotoneX` when no interpolation is specified.
 */
export function resolveCurve(interpolate?: MarkDef['interpolate']): CurveFactory {
  if (!interpolate) return curveMonotoneX;
  return CURVE_MAP[interpolate] ?? curveMonotoneX;
}
