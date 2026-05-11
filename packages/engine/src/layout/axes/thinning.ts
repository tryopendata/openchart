/**
 * Tick label overlap detection and density thinning.
 *
 * Horizontal orientation (x-axis): checks label width against adjacent
 * positions. Vertical orientation (y-axis): checks font-based label height
 * against adjacent positions, ignoring text width so wide numeric labels
 * don't trigger aggressive thinning.
 */

import type { AxisTick, MeasureTextFn } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

/**
 * Minimum gap between adjacent tick labels as a multiple of font size.
 * At the default 11px axis font, this yields ~5-6px of breathing room.
 * Reduced from 1.0 to 0.5 to prevent over-aggressive thinning on charts
 * with a small number of categories that clearly have room for all labels.
 */
const MIN_TICK_GAP_FACTOR = 0.5;

/** Always show at least this many ticks, even if they overlap. */
const MIN_TICK_COUNT = 2;

/** Measure a single label's width using real measurement or heuristic fallback. */
export function measureLabel(
  text: string,
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
): number {
  return measureText
    ? measureText(text, fontSize, fontWeight).width
    : estimateTextWidth(text, fontSize, fontWeight);
}

/** Check whether any adjacent tick labels overlap along the axis direction. */
export function ticksOverlap(
  ticks: AxisTick[],
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): boolean {
  if (ticks.length < 2) return false;
  const minGap = fontSize * MIN_TICK_GAP_FACTOR;

  if (orientation === 'vertical') {
    // Y-axis: labels are stacked vertically. Check if vertical extent
    // (based on font height) overlaps between adjacent ticks.
    // Positions decrease going up in SVG coords, so sort ascending.
    const sorted = [...ticks].sort((a, b) => a.position - b.position);
    const labelHeight = fontSize * 1.2; // lineHeight
    for (let i = 0; i < sorted.length - 1; i++) {
      const aBottom = sorted[i].position + labelHeight / 2;
      const bTop = sorted[i + 1].position - labelHeight / 2;
      if (aBottom + minGap > bTop) return true;
    }
    return false;
  }

  for (let i = 0; i < ticks.length - 1; i++) {
    const aWidth = measureLabel(ticks[i].label, fontSize, fontWeight, measureText);
    const bWidth = measureLabel(ticks[i + 1].label, fontSize, fontWeight, measureText);
    const aRight = ticks[i].position + aWidth / 2;
    const bLeft = ticks[i + 1].position - bWidth / 2;
    if (aRight + minGap > bLeft) return true;
  }
  return false;
}

/**
 * Thin a tick array by removing every other tick until labels don't overlap.
 * Always keeps first and last tick. O(log n) iterations max.
 * Returns the original array if no thinning is needed.
 */
export function thinTicksUntilFit(
  ticks: AxisTick[],
  fontSize: number,
  fontWeight: number,
  measureText?: MeasureTextFn,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): AxisTick[] {
  if (!ticksOverlap(ticks, fontSize, fontWeight, measureText, orientation)) return ticks;

  let current = ticks;
  while (current.length > MIN_TICK_COUNT) {
    // Keep first, last, and every other tick in between
    const thinned = [current[0]];
    for (let i = 2; i < current.length - 1; i += 2) {
      thinned.push(current[i]);
    }
    if (current.length > 1) thinned.push(current[current.length - 1]);
    current = thinned;

    if (!ticksOverlap(current, fontSize, fontWeight, measureText, orientation)) break;
  }
  return current;
}
