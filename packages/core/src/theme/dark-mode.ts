/**
 * Dark mode theme adaptation.
 *
 * Preserves hue of colors while adjusting lightness and saturation
 * to maintain the same relative contrast ratios on a dark background.
 */

import { hsl, rgb } from 'd3-color';
import { contrastRatio } from '../colors/contrast';
import { ACHROMATIC_RAMP } from '../colors/palettes';
import type { ResolvedTheme } from '../types/theme';

// ---------------------------------------------------------------------------
// Dark mode background
// ---------------------------------------------------------------------------

/** Default dark mode background color (zinc-based canvas). */
const DARK_BG = ACHROMATIC_RAMP.bg;
/** Default dark mode text color. */
const DARK_TEXT = ACHROMATIC_RAMP.fg;

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
  // Adapter only handles hex/rgb-style inputs. Raw oklch() and other
  // CSS Color 4 strings parse unreliably through d3-color in happy-dom,
  // so guard early instead of silently falling back to a default.
  if (rgb(color) == null) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[openchart] adaptColorForDarkMode: unparseable color "${color}", returning unchanged. Use precomputed sRGB hex.`,
      );
    }
    return color;
  }
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
  const inputBg = theme.colors.background;
  // "transparent" preserves the background token but must still adopt dark
  // text/gridline/axis colors — the container is dark, not the chart canvas.
  const isTransparent = inputBg === 'transparent';
  const alreadyDark = isTransparent || _luminanceFromHex(inputBg) < 0.2;

  // Preserve user-supplied background (including transparent) but always
  // apply dark-mode text/axis/gridline colors so labels are readable on the
  // dark host surface.
  const darkBg = alreadyDark ? inputBg : DARK_BG;
  const darkText = DARK_TEXT;
  const darkGridline = 'rgba(255,255,255,0.05)';
  // axis is also tick-label fill — needs WCAG AA contrast on dark bg.
  // Zinc-400 (`#a1a1aa`) hits ~6:1 against #09090b.
  const darkAxis = '#a1a1aa';
  const darkMuted = ACHROMATIC_RAMP.fgMuted;

  // Categorical palette is pinned to design-system tokens. The same vibrant
  // hex values render in both light and dark modes — adapting them via
  // contrast-equivalence dulls them on dark backgrounds (cyan -> teal),
  // which is the opposite of what the design system calls for.
  const categorical = theme.colors.categorical;

  return {
    ...theme,
    isDark: true,
    colors: {
      ...theme.colors,
      background: darkBg,
      text: darkText,
      gridline: darkGridline,
      axis: darkAxis,
      annotationFill: 'rgba(255,255,255,0.06)',
      annotationText: darkMuted,
      categorical,
      // Sparkline trend colors tuned for dark surfaces: teal-leaning green
      // and coral red read better than the saturated light-mode tokens.
      // Any non-default value is treated as a user override and preserved.
      positive: theme.colors.positive !== '#16a34a' ? theme.colors.positive : '#34d399',
      negative: theme.colors.negative !== '#dc2626' ? theme.colors.negative : '#f87171',
    },
    chrome: {
      // Eyebrow keeps its accent tint (cyan in both modes); the other
      // chrome elements desaturate to a muted gray on the dark canvas.
      eyebrow: theme.chrome.eyebrow,
      title: { ...theme.chrome.title, color: darkText },
      subtitle: { ...theme.chrome.subtitle, color: darkMuted },
      source: { ...theme.chrome.source, color: darkMuted },
      byline: { ...theme.chrome.byline, color: darkMuted },
      footer: { ...theme.chrome.footer, color: darkMuted },
    },
  };
}

// ---------------------------------------------------------------------------
// Light mode line stroke darkening
// ---------------------------------------------------------------------------

/**
 * Returns a darker variant of a color for use as a foreground stroke on
 * light backgrounds, where mid-lightness palette colors (e.g. cyan-500
 * `#06b6d4`) lack contrast against white. Drops HSL lightness by ~12%
 * absolute (clamped to >= 0) while preserving hue and saturation, which
 * reproduces the cyan-500 → cyan-600 step the cyan accent originally
 * needed and works for any other palette accent the user picks.
 *
 * Returns the input unchanged when:
 *   - the color is already dark enough (L <= ~0.40) — further darkening
 *     just muddies the stroke without adding contrast
 *   - the color isn't parseable
 *   - the color is achromatic (NaN hue) — HSL lightness on grays drifts
 *     toward black instead of staying neutral
 *
 * Exposed via the `--oc-accent-strong` CSS token.
 */
export function adaptForLightLineStroke(color: string): string {
  if (rgb(color) == null) return color;
  const c = hsl(color);
  if (c == null) return color;
  // Achromatic check: NaN hue OR low saturation. d3-color reports a valid
  // hue for grays whose RGB channels aren't perfectly equal (e.g. zinc
  // `#a1a1aa` has s≈0.05), so saturation is the more reliable signal.
  // Threshold 0.10 catches near-grays without tripping on real palette
  // colors (palette saturation is ≥ ~0.5).
  if (Number.isNaN(c.h) || c.s < 0.1) return color;
  if (c.l <= 0.4) return color;
  c.l = Math.max(0, c.l - 0.12);
  return c.formatHex();
}
