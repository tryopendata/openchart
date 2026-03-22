/**
 * Shared utilities for chart mark computation.
 *
 * Common helpers used across multiple chart types: scale value resolution,
 * data grouping, color lookup, and shared constants.
 */

import type { DataRow } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear, ScalePoint, ScaleTime } from 'd3-scale';
import type { D3Scale, ResolvedScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default single-series color when no color encoding is present. */
export const DEFAULT_COLOR = '#1b7fa3';

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
): string {
  if (scales.color && key !== '__default__') {
    const colorScale = scales.color.scale as (v: string) => string;
    return colorScale(key);
  }
  return scales.defaultColor ?? fallback;
}

/**
 * Get color from a sequential (quantitative) color scale.
 * Maps a numeric value to a color via linear interpolation.
 */
export function getSequentialColor(
  scales: ResolvedScales,
  value: number,
  fallback: string = DEFAULT_COLOR,
): string {
  if (scales.color?.type === 'sequential') {
    const colorScale = scales.color.scale as unknown as (v: number) => string;
    return colorScale(value);
  }
  return scales.defaultColor ?? fallback;
}
