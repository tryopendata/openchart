/**
 * Category color assignment for table columns.
 *
 * Maps categorical values to colors using explicit mappings or
 * theme categorical palette, with AA-contrast text colors.
 */

import type { CellStyle, ColumnConfig, ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptColorForDarkMode, findAccessibleColor } from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import { resolveTableSurface } from './utils';

/**
 * How far the chip background sits from the surface toward the category
 * color. 14% reads as a tint, not a block: the hue is carried by the ink and
 * the dot, the background only groups them.
 */
const CHIP_TINT = 0.14;

/**
 * Compute category-colored cell styles for a column.
 *
 * Uses column.categoryColors for explicit value-to-color mappings.
 * Unmapped values get colors from the theme's categorical palette.
 *
 * Category cells render as chips: `accent` is the category color itself
 * (drawn as a dot), `backgroundColor` is a 14% tint of it toward the table
 * surface, and `color` is the category hue pushed to 4.5:1 on that tint.
 * Painting the whole cell in the raw color is the dashboard look this library
 * moved away from.
 *
 * Returns a Map keyed by original data index.
 */
export function computeCategoryColors(
  data: Record<string, unknown>[],
  column: ColumnConfig,
  theme: ResolvedTheme,
  darkMode: boolean,
): Map<number, CellStyle> {
  const result = new Map<number, CellStyle>();
  const explicitMap = column.categoryColors;
  if (!explicitMap) return result;

  const categoricalPalette = theme.colors.categorical;
  let nextPaletteIndex = 0;
  const autoAssigned = new Map<string, string>();
  const lightBg = '#ffffff';
  const darkBg = theme.colors.background;
  const surface = resolveTableSurface(theme);

  for (let i = 0; i < data.length; i++) {
    const raw = data[i][column.key];
    if (raw == null) continue;

    const key = String(raw);
    let bg: string;
    let isExplicit = false;

    if (explicitMap[key] != null) {
      if (explicitMap[key] === 'transparent' || explicitMap[key] === 'none') {
        // Skip transparent/none — let the cell inherit default table styling
        continue;
      }
      bg = explicitMap[key];
      isExplicit = true;
    } else if (column.autoAssign) {
      // Auto-assign from palette only when explicitly opted in
      if (autoAssigned.has(key)) {
        bg = autoAssigned.get(key)!;
      } else {
        bg = categoricalPalette[nextPaletteIndex % categoricalPalette.length];
        nextPaletteIndex++;
        autoAssigned.set(key, bg);
      }
    } else {
      // Default: skip unmapped values (no color assigned)
      continue;
    }

    // Dark mode adaptation (skip for explicit user-provided colors)
    if (darkMode && !isExplicit) {
      bg = adaptColorForDarkMode(bg, lightBg, darkBg);
    }

    const tint = interpolateRgb(surface, bg)(CHIP_TINT);
    result.set(i, {
      accent: bg,
      backgroundColor: tint,
      color: findAccessibleColor(bg, tint, 4.5),
    });
  }

  return result;
}
