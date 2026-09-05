/**
 * Shared utilities for table column computations.
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { contrastRatio, cssTokenDefault, isOpaqueColor } from '@opendata-ai/openchart-core';

/**
 * Resolve the opaque surface a filled table cell is painted on.
 *
 * Transparent themes fall back to the static `--oc-bg` token for the mode, so
 * color interpolation never passes through alpha = 0 (which would produce NaN
 * contrast ratios downstream).
 */
export function resolveTableSurface(theme: ResolvedTheme): string {
  const bg = theme.colors.background;
  if (isOpaqueColor(bg)) return bg;
  return cssTokenDefault('--oc-bg', theme.isDark ? 'dark' : 'light');
}

/**
 * Pick the more legible ink for a filled cell background.
 *
 * The candidates are the theme's own text color and the opposite mode's text
 * token — never pure black or white, which read as a different type system
 * dropped into the table.
 */
export function accessibleTextColor(bg: string, theme: ResolvedTheme): string {
  const own = theme.colors.text;
  const inverse = cssTokenDefault('--oc-text', theme.isDark ? 'light' : 'dark');
  return contrastRatio(inverse, bg) > contrastRatio(own, bg) ? inverse : own;
}
