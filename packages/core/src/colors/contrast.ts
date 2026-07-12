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
export function relativeLuminance(color: string): number {
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
 * Check whether a color string parses to a fully opaque color.
 * Contrast ratios are only meaningful against opaque backgrounds; the
 * default chart background ('transparent') defers to the host page and
 * can't be checked at compile time.
 */
export function isOpaqueColor(color: string): boolean {
  const c = rgb(color);
  return c != null && !Number.isNaN(c.r) && c.opacity === 1;
}

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
 * Pick a legible label color (white or near-black) for text placed on top of `bg`.
 *
 * Uses a perceptual luminance threshold rather than a strict 4.5:1 contrast
 * gate. WCAG's 4.5:1 ratio is calibrated for body text on a page; bold value
 * labels sitting on a saturated filled bar read fine at lower ratios. A pure
 * contrast-ratio gate sends mid-tone fills (e.g. slate `#94a3b8`, L≈0.36) to
 * dark text even though white reads cleaner on them.
 *
 * The threshold is mode-dependent because of simultaneous contrast: the same
 * bar fill looks lighter against a dark canvas than against a white page, so
 * dark text reads more grounded on it. Dark mode therefore uses a lower
 * threshold (L < 0.30) to pivot mid-tone fills to dark text sooner.
 *
 * - Light mode (L < 0.42 → white): white on saturated and mid-tone fills;
 *   dark text only on genuinely light fills (`#b0b0b0` and lighter).
 * - Dark mode (L < 0.30 → white): saturated fills keep white; mid-tone fills
 *   (slate `#94a3b8`, cyan `#06b6d4`, mid-grey) pivot to dark text.
 */
export function pickLabelColor(bg: string, darkMode = false): string {
  const WHITE = '#ffffff';
  const DARK = '#111111';
  const threshold = darkMode ? 0.3 : 0.42;
  return relativeLuminance(bg) < threshold ? WHITE : DARK;
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
  const baseLum = relativeLuminance(baseColor);

  // Try both directions: prefer the one matching bg luminance, but fall back
  // to the other if the base color is already at the extreme (e.g. white on
  // a medium-luminance background can't be lightened, so darken instead).
  const preferDarken = bgLum > 0.5;
  const directions = preferDarken ? [true, false] : [false, true];

  for (const darken of directions) {
    // Skip impossible directions: can't lighten white or darken black.
    if (!darken && baseLum > 0.95) continue;
    if (darken && baseLum < 0.05) continue;

    let lo = 0;
    let hi = 1;
    let best: string | null = null;

    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const adjusted = darken
        ? rgb(c.r * (1 - mid), c.g * (1 - mid), c.b * (1 - mid))
        : rgb(c.r + (255 - c.r) * mid, c.g + (255 - c.g) * mid, c.b + (255 - c.b) * mid);

      const hex = adjusted.formatHex();
      const ratio = contrastRatio(hex, bg);

      if (ratio >= targetRatio) {
        best = hex;
        hi = mid;
      } else {
        lo = mid;
      }
    }

    if (best) return best;
  }

  return baseColor;
}
