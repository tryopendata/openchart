import type { ScaleInvert } from '@opendata-ai/openchart-core';
import type { ResolvedScale } from '../layout/scales';

/**
 * Extract scale inversion anchors from a resolved scale so the vanilla layer
 * can convert pixel positions back to data-space values without holding the
 * d3 scale object. Generalizes the YouDrawItYInvert precedent to any axis.
 */
export function resolveScaleInvert(resolved: ResolvedScale | undefined): ScaleInvert | undefined {
  if (!resolved) return undefined;
  const { scale, type } = resolved;

  // Band / point scales: snap to nearest domain value
  if (type === 'band' || type === 'point') {
    const domain = (scale as { domain(): string[] }).domain() as (string | number)[];
    const positions = domain.map((v) => {
      const pos = (scale as (v: string | number) => number | undefined)(v) ?? 0;
      return type === 'band' ? pos + (scale as { bandwidth(): number }).bandwidth() / 2 : pos;
    });
    const range = (scale as { range(): number[] }).range();
    return {
      topPixel: range[0],
      bottomPixel: range[range.length - 1],
      topData: 0,
      bottomData: 0,
      domain,
      positions,
    };
  }

  // Continuous scales (linear, time, utc, log, pow, sqrt, symlog)
  const invert = (scale as { invert?: (px: number) => unknown }).invert;
  if (typeof invert !== 'function') return undefined;

  const range = (scale as { range(): number[] }).range();
  const topPx = range[0];
  const bottomPx = range[range.length - 1];
  const topVal = invert.call(scale, topPx);
  const bottomVal = invert.call(scale, bottomPx);

  // For time scales, convert Date to epoch ms
  const topData = topVal instanceof Date ? +topVal : Number(topVal);
  const bottomData = bottomVal instanceof Date ? +bottomVal : Number(bottomVal);
  if (!Number.isFinite(topData) || !Number.isFinite(bottomData)) return undefined;

  const scaleType = type as ScaleInvert['scaleType'];
  return { topPixel: topPx, bottomPixel: bottomPx, topData, bottomData, scaleType };
}
