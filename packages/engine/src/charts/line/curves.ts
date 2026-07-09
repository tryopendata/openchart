/**
 * Curve interpolation mapping and path builders.
 *
 * Maps Vega-Lite-style interpolation strings to d3-shape curve factories.
 * Used by both line and area chart computations.
 *
 * Also exports pure path-builder helpers (`buildLinePath`, `buildAreaPath`)
 * so downstream consumers (e.g. transition interpolators) can reconstruct
 * SVG paths from point arrays without pulling in chart-specific code.
 */

import type { MarkDef, Point } from '@opendata-ai/openchart-core';
import type { CurveFactory } from 'd3-shape';
import {
  area,
  curveBasis,
  curveCardinal,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  line,
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

/**
 * Build an SVG path string from an array of points using d3 line generator.
 * Accepts an optional interpolation string (defaults to 'monotone').
 */
export function buildLinePath(points: Point[], interpolate?: string): string {
  if (points.length === 0) return '';
  const curve = resolveCurve(interpolate as MarkDef['interpolate']);
  const generator = line<Point>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curve);
  return generator(points) ?? '';
}

/**
 * Build an SVG path string for a filled area from top and bottom point arrays.
 * Accepts an optional interpolation string (defaults to 'monotone').
 */
export function buildAreaPath(
  topPoints: Point[],
  bottomPoints: Point[],
  interpolate?: string,
): string {
  if (topPoints.length === 0) return '';
  const curve = resolveCurve(interpolate as MarkDef['interpolate']);
  // Pair top and bottom points for the area generator
  const paired = topPoints.map((tp, i) => ({
    x: tp.x,
    yTop: tp.y,
    yBottom: bottomPoints[i]?.y ?? 0,
  }));
  const generator = area<{ x: number; yTop: number; yBottom: number }>()
    .x((d) => d.x)
    .y0((d) => d.yBottom)
    .y1((d) => d.yTop)
    .curve(curve);
  return generator(paired) ?? '';
}
