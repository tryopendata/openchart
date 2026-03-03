/**
 * Sparkline computation for inline mini-charts in table cells.
 *
 * Produces normalized data points (0-1 range) for sparkline rendering.
 * The adapter handles the actual drawing.
 */

import type {
  ResolvedTheme,
  SparklineColumnConfig,
  SparklineData,
} from '@opendata-ai/openchart-core';

export type { SparklineData };

/**
 * Extract numeric values from a row for sparkline rendering.
 *
 * If valuesField is specified, reads an array from that field.
 * Otherwise uses the column's own key (expects an array value).
 */
function extractValues(
  row: Record<string, unknown>,
  columnKey: string,
  config: SparklineColumnConfig,
): number[] {
  const field = config.valuesField ?? columnKey;
  const raw = row[field];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
    .filter((v): v is number => v !== null);
}

/**
 * Compute sparkline data for a single row.
 *
 * Normalizes values to 0-1 range. Returns null if no valid values.
 */
export function computeSparkline(
  values: number[],
  config: SparklineColumnConfig,
  theme: ResolvedTheme,
  _darkMode: boolean,
): SparklineData | null {
  if (values.length === 0) return null;

  const type = config.type ?? 'line';
  const color = config.color ?? theme.colors.categorical[0];

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  const normalize = (v: number): number => (range === 0 ? 0.5 : (v - min) / range);

  const startValue = values[0];
  const endValue = values[values.length - 1];

  if (type === 'line') {
    const points = values.map((v, i) => ({
      x: values.length === 1 ? 0.5 : i / (values.length - 1),
      y: normalize(v),
    }));

    return {
      type,
      points,
      bars: [],
      color,
      count: values.length,
      startValue,
      endValue,
    };
  }

  // Bar (horizontal) or column (vertical): normalized as proportions
  const bars = values.map(normalize);
  const points = values.map((v, i) => ({
    x: values.length === 1 ? 0.5 : i / (values.length - 1),
    y: normalize(v),
  }));

  return {
    type,
    points,
    bars,
    color,
    count: values.length,
    startValue,
    endValue,
  };
}

/**
 * Extract values and compute sparkline data for a cell.
 */
export function computeSparklineForRow(
  row: Record<string, unknown>,
  columnKey: string,
  config: SparklineColumnConfig,
  theme: ResolvedTheme,
  darkMode: boolean,
): SparklineData | null {
  const values = extractValues(row, columnKey, config);
  return computeSparkline(values, config, theme, darkMode);
}
