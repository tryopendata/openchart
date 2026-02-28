/**
 * Heatmap coloring for table columns.
 *
 * Colors cell backgrounds using sequential or diverging color scales,
 * then picks an accessible text color for each background.
 */

import type { CellStyle, ColumnConfig, ResolvedTheme } from '@openchart/core';
import { adaptColorForDarkMode } from '@openchart/core';
import { interpolateRgb } from 'd3-interpolate';
import { scaleSequential } from 'd3-scale';
import { accessibleTextColor } from './utils';

/**
 * Build an interpolator from an array of color stops.
 * Uses d3-interpolate for smooth color transitions.
 */
function interpolatorFromStops(stops: string[]): (t: number) => string {
  if (stops.length === 0) return () => '#ffffff';
  if (stops.length === 1) return () => stops[0];

  return (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    const segment = clamped * (stops.length - 1);
    const lo = Math.floor(segment);
    const hi = Math.min(lo + 1, stops.length - 1);
    const frac = segment - lo;
    return interpolateRgb(stops[lo], stops[hi])(frac);
  };
}

/**
 * Resolve palette from column config or theme.
 *
 * - If palette is an array of color stops, use directly
 * - If palette is a string name, look it up in theme sequential then diverging
 * - If no palette specified, use the first sequential palette from the theme
 */
function resolvePalette(palette: string | string[] | undefined, theme: ResolvedTheme): string[] {
  if (Array.isArray(palette)) return palette;

  const seqPalettes = theme.colors.sequential;
  const divPalettes = theme.colors.diverging;

  if (typeof palette === 'string') {
    if (seqPalettes[palette]) return seqPalettes[palette];
    if (divPalettes[palette]) return divPalettes[palette];
  }

  // Default: first sequential palette
  const firstSeqKey = Object.keys(seqPalettes)[0];
  return firstSeqKey ? seqPalettes[firstSeqKey] : ['#deebf7', '#08519c'];
}

/**
 * Compute heatmap cell styles for a column.
 *
 * Returns a Map keyed by original data index with background and text colors.
 */
export function computeHeatmapColors(
  data: Record<string, unknown>[],
  column: ColumnConfig,
  theme: ResolvedTheme,
  darkMode: boolean,
): Map<number, CellStyle> {
  const result = new Map<number, CellStyle>();
  const config = column.heatmap;
  if (!config) return result;

  // Determine which field provides the color values
  const colorField = config.colorByField ?? column.key;

  // Extract numeric values and compute domain
  const numericValues: { index: number; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const raw = data[i][colorField];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      numericValues.push({ index: i, value: raw });
    }
  }

  if (numericValues.length === 0) return result;

  // Domain: from config or data min/max
  let domain: [number, number];
  if (config.domain) {
    domain = config.domain;
  } else {
    let min = Infinity;
    let max = -Infinity;
    for (const { value } of numericValues) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    domain = [min, max];
  }

  // Resolve palette and build scale
  let stops = resolvePalette(config.palette, theme);
  if (darkMode) {
    const lightBg = '#ffffff';
    const darkBg = theme.colors.background;
    stops = stops.map((c) => adaptColorForDarkMode(c, lightBg, darkBg));
  }

  const interpolator = interpolatorFromStops(stops);
  const scale = scaleSequential(interpolator).domain(domain).clamp(true);

  // Apply to each row
  for (const { index, value } of numericValues) {
    const bg = scale(value);
    const textColor = accessibleTextColor(bg);

    result.set(index, {
      backgroundColor: bg,
      color: textColor,
    });
  }

  return result;
}
