/**
 * Dark mode theme adaptation.
 *
 * Preserves hue of colors while adjusting lightness and saturation
 * to maintain the same relative contrast ratios on a dark background.
 */

import { hsl, rgb } from 'd3-color';
import { contrastRatio } from '../colors/contrast';
import type { ResolvedTheme } from '../types/theme';

// ---------------------------------------------------------------------------
// Dark mode background
// ---------------------------------------------------------------------------

/** Default dark mode background color. */
const DARK_BG = '#1a1a2e';
/** Default dark mode text color. */
const DARK_TEXT = '#e0e0e0';

// ---------------------------------------------------------------------------
// Color adaptation
// ---------------------------------------------------------------------------

/**
 * Adapt a single color for dark mode.
 *
 * Preserves the hue and adjusts lightness/saturation so the adapted
 * color has the same contrast ratio against darkBg as the original
 * had against lightBg.
 */
export function adaptColorForDarkMode(color: string, lightBg: string, darkBg: string): string {
  const originalRatio = contrastRatio(color, lightBg);
  const c = hsl(color);
  if (c == null || Number.isNaN(c.h)) {
    // Achromatic or invalid color: just adjust lightness
    const r = rgb(color);
    if (r == null) return color;
    const darkBgLum = _luminanceFromHex(darkBg);
    const isLight = darkBgLum < 0.5;
    if (isLight) return color;
    // Invert the lightness
    const inverted = hsl(color);
    if (inverted == null) return color;
    inverted.l = 1 - inverted.l;
    return inverted.formatHex();
  }

  // Binary search for lightness that gives equivalent contrast on dark bg
  let lo = 0.0;
  let hi = 1.0;
  let bestColor = color;
  let bestDiff = Infinity;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const candidate = hsl(c.h, c.s, mid);
    const hex = candidate.formatHex();
    const ratio = contrastRatio(hex, darkBg);
    const diff = Math.abs(ratio - originalRatio);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestColor = hex;
    }

    if (ratio < originalRatio) {
      // Need more contrast = more lightness on dark bg
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return bestColor;
}

/** Quick luminance estimation from a hex color. */
function _luminanceFromHex(color: string): number {
  const c = rgb(color);
  if (c == null) return 0;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

// ---------------------------------------------------------------------------
// Full theme adaptation
// ---------------------------------------------------------------------------

/**
 * Adapt an entire resolved theme for dark mode.
 *
 * Swaps background/text, adapts categorical and annotation colors,
 * adjusts gridline and axis colors for the dark background.
 */
export function adaptTheme(theme: ResolvedTheme): ResolvedTheme {
  const lightBg = theme.colors.background;
  const darkBg = DARK_BG;

  return {
    ...theme,
    isDark: true,
    colors: {
      ...theme.colors,
      background: darkBg,
      text: DARK_TEXT,
      gridline: '#333344',
      axis: '#888899',
      annotationFill: 'rgba(255,255,255,0.08)',
      annotationText: '#bbbbcc',
      categorical: theme.colors.categorical.map((c) => adaptColorForDarkMode(c, lightBg, darkBg)),
      // Sequential and diverging palettes are kept as-is since they're
      // typically used for fills where the lightness range still works.
      // If a specific use case needs adaptation, it can be done per-color.
    },
    chrome: {
      title: { ...theme.chrome.title, color: DARK_TEXT },
      subtitle: { ...theme.chrome.subtitle, color: '#aaaaaa' },
      source: { ...theme.chrome.source, color: '#888888' },
      byline: { ...theme.chrome.byline, color: '#888888' },
      footer: { ...theme.chrome.footer, color: '#888888' },
    },
  };
}
