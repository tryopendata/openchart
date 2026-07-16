import type { ScaleInvert } from '@opendata-ai/openchart-core';

/**
 * Convert a pixel position back to a data-space value using the serialized
 * scale inversion anchors from ChartLayout. For band/point scales, snaps to
 * the nearest domain value. For continuous scales, applies the inverse of
 * the scale transform (log, pow, sqrt, symlog, or linear).
 */
export function invertScale(invert: ScaleInvert, pixel: number): string | number {
  // Band/point: snap to nearest domain value
  if (invert.domain && invert.positions && invert.domain.length > 0) {
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < invert.positions.length; i++) {
      const dist = Math.abs(invert.positions[i] - pixel);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return invert.domain[closest];
  }
  // Continuous: interpolate in the scale's native space
  const span = invert.bottomPixel - invert.topPixel;
  if (span === 0) return invert.topData;
  const t = (pixel - invert.topPixel) / span;

  const { topData, bottomData, scaleType } = invert;

  if (scaleType === 'log') {
    if (topData <= 0 || bottomData <= 0) return topData + t * (bottomData - topData);
    return Math.exp(Math.log(topData) + t * (Math.log(bottomData) - Math.log(topData)));
  }
  if (scaleType === 'sqrt') {
    const sqrtTop = Math.sqrt(Math.abs(topData)) * Math.sign(topData);
    const sqrtBottom = Math.sqrt(Math.abs(bottomData)) * Math.sign(bottomData);
    const sqrtVal = sqrtTop + t * (sqrtBottom - sqrtTop);
    return sqrtVal * Math.abs(sqrtVal);
  }
  if (scaleType === 'pow') {
    const powTop = Math.sign(topData) * Math.abs(topData) ** 0.5;
    const powBottom = Math.sign(bottomData) * Math.abs(bottomData) ** 0.5;
    const powVal = powTop + t * (powBottom - powTop);
    return Math.sign(powVal) * Math.abs(powVal) ** 2;
  }
  if (scaleType === 'symlog') {
    const symlog = (x: number) => Math.sign(x) * Math.log1p(Math.abs(x));
    const symexp = (x: number) => Math.sign(x) * Math.expm1(Math.abs(x));
    return symexp(symlog(topData) + t * (symlog(bottomData) - symlog(topData)));
  }

  // linear, time, or unspecified
  return topData + t * (bottomData - topData);
}
