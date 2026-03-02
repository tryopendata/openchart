/**
 * Bar column computation for inline bar visualization in table cells.
 *
 * Computes bar width as a proportion of the max value.
 * Supports negative values with bidirectional bars.
 */

import type { BarColumnConfig, ResolvedTheme } from '@opendata-ai/core';

const NEGATIVE_BAR_COLOR = '#c44e52';

/**
 * Compute the bar percentage, offset, and color for a single cell value.
 *
 * barPercent is 0-1. barOffset is 0-1 (left edge position).
 * When the column has negative values, bars extend bidirectionally from a zero line.
 */
export function computeBarCell(
  value: number,
  config: BarColumnConfig,
  columnMax: number,
  columnMin: number,
  theme: ResolvedTheme,
  _darkMode: boolean,
): { barPercent: number; barOffset: number; barColor: string; isNegative: boolean } {
  const barColor = config.color ?? theme.colors.categorical[0];
  const hasNegatives = columnMin < 0;

  if (!Number.isFinite(value)) {
    return { barPercent: 0, barOffset: 0, barColor, isNegative: false };
  }

  if (!hasNegatives) {
    // Positive-only column: simple left-to-right bars
    const maxValue = config.maxValue ?? columnMax;
    if (maxValue <= 0) {
      return { barPercent: 0, barOffset: 0, barColor, isNegative: false };
    }
    const barPercent = Math.max(0, Math.min(1, value / maxValue));
    return { barPercent, barOffset: 0, barColor, isNegative: false };
  }

  // Bidirectional: zero line position proportional to data range
  const maxPos = config.maxValue ?? columnMax;
  const absMin = Math.abs(columnMin);
  const totalRange = maxPos + absMin;
  if (totalRange === 0) {
    return { barPercent: 0, barOffset: 0, barColor, isNegative: false };
  }

  const zeroPos = absMin / totalRange;

  if (value >= 0) {
    const barPercent = value / totalRange;
    return { barPercent, barOffset: zeroPos, barColor, isNegative: false };
  }

  // Negative value: red bar extending left from zero
  const barPercent = Math.abs(value) / totalRange;
  return {
    barPercent,
    barOffset: zeroPos - barPercent,
    barColor: config.color ?? NEGATIVE_BAR_COLOR,
    isNegative: true,
  };
}

/**
 * Compute the column max and min from data for bar scaling.
 */
export function computeColumnMax(data: Record<string, unknown>[], key: string): number {
  let max = 0;
  for (const row of data) {
    const val = row[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > max) {
      max = val;
    }
  }
  return max;
}

/**
 * Compute the column minimum from data (for negative bar support).
 */
export function computeColumnMin(data: Record<string, unknown>[], key: string): number {
  let min = 0;
  for (const row of data) {
    const val = row[key];
    if (typeof val === 'number' && Number.isFinite(val) && val < min) {
      min = val;
    }
  }
  return min;
}
