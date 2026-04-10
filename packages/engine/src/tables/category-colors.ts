/**
 * Category color assignment for table columns.
 *
 * Maps categorical values to colors using explicit mappings or
 * theme categorical palette, with AA-contrast text colors.
 */

import type { CellStyle, ColumnConfig, ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptColorForDarkMode } from '@opendata-ai/openchart-core';
import { accessibleTextColor } from './utils';

/**
 * Compute category-colored cell styles for a column.
 *
 * Uses column.categoryColors for explicit value-to-color mappings.
 * Unmapped values get colors from the theme's categorical palette.
 *
 * Returns a Map keyed by original data index with background and text colors.
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
    } else if (autoAssigned.has(key)) {
      bg = autoAssigned.get(key)!;
    } else {
      // Assign from categorical palette
      bg = categoricalPalette[nextPaletteIndex % categoricalPalette.length];
      nextPaletteIndex++;
      autoAssigned.set(key, bg);
    }

    // Dark mode adaptation (skip for explicit user-provided colors)
    if (darkMode && !isExplicit) {
      bg = adaptColorForDarkMode(bg, lightBg, darkBg);
    }

    const textColor = accessibleTextColor(bg);
    result.set(i, {
      backgroundColor: bg,
      color: textColor,
    });
  }

  return result;
}
