/**
 * WCAG contrast ratio utilities.
 *
 * Uses d3-color for color space parsing and manipulation.
 * All functions accept CSS color strings (hex, rgb, hsl, named colors).
 */

import { rgb } from 'd3-color';

// ---------------------------------------------------------------------------
// Relative luminance (WCAG 2.1)
// ---------------------------------------------------------------------------

/**
 * Compute the relative luminance of a color per WCAG 2.1 definition.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(color: string): number {
  const c = rgb(color);
  if (c == null) return 0;

  const srgb = [c.r / 255, c.g / 255, c.b / 255];
  const linear = srgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the WCAG contrast ratio between two colors.
 * Returns a value between 1 (identical) and 21 (black on white).
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if two colors meet WCAG AA contrast requirements.
 * Normal text: 4.5:1, large text (18px+ bold or 24px+): 3:1.
 */
export function meetsAA(fg: string, bg: string, largeText = false): boolean {
  const ratio = contrastRatio(fg, bg);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Find an accessible variant of `baseColor` against `bg`.
 *
 * Preserves the hue and saturation of baseColor but adjusts lightness
 * until the target contrast ratio is met. Returns the original color
 * if it already meets the target.
 */
export function findAccessibleColor(baseColor: string, bg: string, targetRatio = 4.5): string {
  if (contrastRatio(baseColor, bg) >= targetRatio) {
    return baseColor;
  }

  const c = rgb(baseColor);
  if (c == null) return baseColor;

  const bgLum = relativeLuminance(bg);
  // Determine direction: darken if bg is light, lighten if bg is dark.
  const bgIsLight = bgLum > 0.5;

  // Binary search for the lightness adjustment that hits the target ratio.
  let lo = 0;
  let hi = 1;
  let best = baseColor;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const adjusted = bgIsLight
      ? rgb(c.r * (1 - mid), c.g * (1 - mid), c.b * (1 - mid))
      : rgb(c.r + (255 - c.r) * mid, c.g + (255 - c.g) * mid, c.b + (255 - c.b) * mid);

    const hex = adjusted.formatHex();
    const ratio = contrastRatio(hex, bg);

    if (ratio >= targetRatio) {
      best = hex;
      hi = mid; // try less adjustment
    } else {
      lo = mid; // need more adjustment
    }
  }

  return best;
}
