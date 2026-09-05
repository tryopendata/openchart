/**
 * Shared utilities for chart mark computation.
 *
 * Common helpers used across multiple chart types: scale value resolution,
 * data grouping, color lookup, and shared constants.
 */

import {
  adaptForLightLineStroke,
  CATEGORICAL_PALETTE,
  type DataRow,
  type Encoding,
  type GradientDef,
  getRepresentativeColor,
  isOpaqueColor,
  type ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear, ScalePoint, ScaleTime } from 'd3-scale';
import type { D3Scale, ResolvedScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default single-series color when no color encoding is present and no theme
 * is in hand. Slot 1 of the categorical palette (the accent), so an untinted
 * mark matches the one a themed compile would produce.
 */
export const DEFAULT_COLOR: string = CATEGORICAL_PALETTE[0];

/** Corner radius applied to the value end of a non-stacked bar or column. */
export const BAR_CORNER_RADIUS = 2;

/**
 * Which corners of a bar/column receive `BAR_CORNER_RADIUS`.
 *
 * Only the value end rounds: the baseline end stays square so bars sit flush
 * on the zero line (the editorial convention -- a rounded baseline reads as a
 * floating pill). Negative values grow the other way, so the rounded end
 * swaps with the sign.
 */
export function valueEndCorners(
  orient: 'horizontal' | 'vertical',
  negative: boolean,
): { tl: boolean; tr: boolean; br: boolean; bl: boolean } {
  if (orient === 'horizontal') {
    return negative
      ? { tl: true, tr: false, br: false, bl: true }
      : { tl: false, tr: true, br: true, bl: false };
  }
  return negative
    ? { tl: false, tr: false, br: true, bl: true }
    : { tl: true, tr: true, br: false, bl: false };
}

/**
 * The 1px separator drawn between adjacent stacked fills, so neighbouring
 * segments meet WCAG 1.4.11 by separator rather than by hue contrast. Matches
 * the resolved canvas so the seam reads as a gap, not as a drawn line; a
 * non-opaque background ('transparent', 'none') has no color of its own, so
 * fall back to white the same way the scatter knockout stroke does.
 */
export function stackSeamStroke(theme?: ResolvedTheme): string {
  const bg = theme?.colors?.background;
  return bg && isOpaqueColor(bg) ? bg : '#ffffff';
}

/**
 * Mark types whose series color is drawn as a foreground stroke (a line, or
 * the top edge of an area) rather than as a fill. Their strokes go through
 * `adaptSeriesStroke`, so anything that echoes the series color as chrome --
 * legend swatches, endpoint labels, direct labels -- must adapt it too or a
 * swatch and its line show different colors.
 */
export function isStrokeSeriesMark(markType: string): boolean {
  return markType === 'line' || markType === 'area';
}

/**
 * Darken a palette-derived series color for use as a foreground stroke on a
 * light canvas. Mid-lightness palette hues are tuned as fills and are too thin
 * as a 2px line on white; the darkened variant clears 3:1. Dark canvases and
 * already-dark colors pass through unchanged.
 *
 * Prefer `resolveSeriesStroke`, which also honours an author's explicit range.
 */
export function adaptSeriesStroke(
  color: string | GradientDef,
  theme?: { isDark: boolean },
): string {
  const str = getRepresentativeColor(color);
  return theme && !theme.isDark ? adaptForLightLineStroke(str) : str;
}

/**
 * Did the author pin the series colors with an explicit
 * `encoding.color.scale.range`?
 *
 * Those hexes are the author's call in exactly the way `markDef.stroke` is, so
 * they render verbatim -- the library must not quietly darken a brand color
 * someone typed out. Theme palettes (the default one and a custom
 * `theme.colors.categorical`) are the library's own choice and still adapt.
 */
export function hasExplicitColorRange(spec: { encoding: Encoding }): boolean {
  const colorEnc = spec.encoding?.color;
  if (!colorEnc || !('field' in colorEnc)) return false;
  return Array.isArray(colorEnc.scale?.range);
}

/**
 * The rendered stroke color for one series of a line/area chart.
 *
 * Single source of truth: `computeLineMarks`, both area computes and the
 * legend all call this, so a swatch can never disagree with the line it names
 * -- and an explicit range comes out of all four verbatim.
 */
export function resolveSeriesStroke(
  spec: { encoding: Encoding },
  color: string | GradientDef,
  theme?: { isDark: boolean },
): string {
  return hasExplicitColorRange(spec)
    ? getRepresentativeColor(color)
    : adaptSeriesStroke(color, theme);
}

// ---------------------------------------------------------------------------
// Scale helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a data value to a pixel position using a D3 scale.
 *
 * Handles time scales (parsing string dates), categorical scales
 * (point, band, ordinal - passing string values directly), and
 * linear/log scales (coercing to number). Returns null for values
 * that can't be resolved (null, NaN, invalid dates, or values not
 * in a categorical scale's domain).
 */
export function scaleValue(scale: D3Scale, scaleType: string, value: unknown): number | null {
  if (value == null) return null;

  if (scaleType === 'time' || scaleType === 'utc') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return (scale as ScaleTime<number, number>)(date);
  }

  // Categorical scales: pass string values directly
  if (scaleType === 'point' || scaleType === 'band' || scaleType === 'ordinal') {
    const result = (scale as ScalePoint<string> | ScaleBand<string>)(String(value));
    return result ?? null;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return (scale as ScaleLinear<number, number>)(num);
}

// ---------------------------------------------------------------------------
// Data grouping
// ---------------------------------------------------------------------------

/**
 * Group data rows by a field value.
 *
 * If no field is provided, all rows are grouped under '__default__'.
 * Returns a Map preserving insertion order.
 */
export function groupByField(data: DataRow[], field: string | undefined): Map<string, DataRow[]> {
  const groups = new Map<string, DataRow[]>();

  if (!field) {
    groups.set('__default__', data);
    return groups;
  }

  for (const row of data) {
    const key = String(row[field] ?? '__default__');
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort data rows by a field value in ascending order.
 *
 * Type-aware: numbers compared numerically, Date objects by timestamp,
 * string-encoded numbers parsed and compared numerically, and everything
 * else compared lexicographically (which also handles ISO date strings).
 * Nulls are sorted last. Returns a new array (no mutation).
 */
export function sortByField(data: DataRow[], field: string): DataRow[] {
  if (data.length <= 1) return [...data];

  return [...data].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // Nulls last
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Both numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    // Both Dates
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }

    // String values: try numeric parse, then lexicographic
    const aStr = String(aVal);
    const bStr = String(bVal);

    const aNum = Number(aStr);
    const bNum = Number(bStr);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return aNum - bNum;
    }

    return aStr.localeCompare(bStr);
  });
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Get the color for a series/category from the resolved color scale.
 *
 * For single-series charts (key === '__default__'), uses the theme's
 * first categorical color via scales.defaultColor.
 */
export function getColor(
  scales: ResolvedScales,
  key: string,
  _index?: number,
  fallback: string = DEFAULT_COLOR,
): string | GradientDef {
  if (scales.color && key !== '__default__') {
    const colorScale = scales.color.scale as (v: string) => string;
    return colorScale(key);
  }
  return scales.defaultColor ?? fallback;
}

/**
 * Get color from a sequential (quantitative) color scale.
 * Maps a numeric value to a color via linear interpolation, or to a discrete
 * class color for binned (quantile/quantize/threshold) color scales.
 */
export function getSequentialColor(
  scales: ResolvedScales,
  value: number,
  fallback: string = DEFAULT_COLOR,
): string | GradientDef {
  const type = scales.color?.type;
  if (type === 'sequential' || type === 'quantile' || type === 'quantize' || type === 'threshold') {
    const colorScale = scales.color!.scale as unknown as (v: number) => string;
    return colorScale(value);
  }
  return scales.defaultColor ?? fallback;
}
