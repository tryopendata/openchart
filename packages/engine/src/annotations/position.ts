/**
 * Data-coordinate to pixel-coordinate resolution for annotations.
 */

import type { ScaleBand, ScaleLinear, ScaleTime } from 'd3-scale';
import type { ResolvedScales } from '../layout/scales';

/**
 * Interpolate a numeric value between sorted domain entries.
 * Used when an annotation references a value not present in a categorical domain
 * (e.g. "2008" on an axis with data points at "2007" and "2009").
 * Returns null if domain values aren't numeric or the domain is too small.
 */
export function interpolateInDomain(
  numValue: number,
  domain: string[],
  positionOf: (entry: string) => number,
): number | null {
  if (domain.length < 2) return null;
  const nums = domain.map(Number);
  if (!nums.every(Number.isFinite)) return null;

  // Sort by numeric value so bracket-finding works regardless of data order
  const sorted = nums.map((n, i) => ({ n, i })).sort((a, b) => a.n - b.n);

  // Find the two sorted neighbors that bracket this value
  let lower = 0;
  let upper = sorted.length - 1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].n <= numValue) lower = i;
    if (sorted[i].n >= numValue) {
      upper = i;
      break;
    }
  }

  const lowerPos = positionOf(domain[sorted[lower].i]);
  const upperPos = positionOf(domain[sorted[upper].i]);
  if (lower === upper) return lowerPos;
  const t = (numValue - sorted[lower].n) / (sorted[upper].n - sorted[lower].n);
  return lowerPos + t * (upperPos - lowerPos);
}

/** Resolve a data value to a pixel position on a given axis. */
export function resolvePosition(
  value: string | number,
  scale: ResolvedScales['x'] | ResolvedScales['y'],
): number | null {
  if (!scale) return null;

  const s = scale.scale;
  const type = scale.type;

  if (type === 'time') {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return (s as ScaleTime<number, number>)(date);
  }

  if (type === 'linear' || type === 'log') {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    return (s as ScaleLinear<number, number>)(num);
  }

  if (type === 'band') {
    const bandScale = s as ScaleBand<string>;
    const strValue = String(value);
    const pos = bandScale(strValue);
    if (pos !== undefined) return pos + (bandScale.bandwidth?.() ?? 0) / 2;

    const bw = bandScale.bandwidth?.() ?? 0;
    return interpolateInDomain(
      Number(strValue),
      bandScale.domain(),
      (entry) => (bandScale(entry) ?? 0) + bw / 2,
    );
  }

  // point or ordinal: try direct lookup, fall back to interpolation
  const strValue = String(value);
  const directResult = (s as (v: string) => number | undefined)(strValue);
  if (directResult !== undefined) return directResult;

  if (type === 'point' || type === 'ordinal') {
    const domain = (s as { domain(): string[] }).domain();
    return interpolateInDomain(
      Number(strValue),
      domain,
      (entry) => (s as (v: string) => number)(entry) ?? 0,
    );
  }

  return null;
}
