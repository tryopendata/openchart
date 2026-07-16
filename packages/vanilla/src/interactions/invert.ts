import type { ScaleInvert } from '@opendata-ai/openchart-core';

/**
 * Convert a pixel position back to a data-space value using the serialized
 * scale inversion anchors from ChartLayout. For band/point scales, snaps to
 * the nearest domain value. For continuous scales, linearly interpolates.
 */
export function invertScale(invert: ScaleInvert, pixel: number): string | number {
  // Band/point: snap to nearest domain value
  if (invert.domain && invert.positions) {
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
  // Continuous: linear interpolation
  const span = invert.bottomPixel - invert.topPixel;
  if (span === 0) return invert.topData;
  const t = (pixel - invert.topPixel) / span;
  return invert.topData + t * (invert.bottomData - invert.topData);
}
