/**
 * Derived neutral ramp.
 *
 * Every secondary gray in the system is the theme's text color mixed toward
 * its background, rather than a fixed zinc ladder. A custom warm or cool
 * theme therefore gets warm or cool grays for free instead of zinc showing
 * up uninvited beside its palette.
 *
 * The ramp is computed once in `resolveTheme`/`adaptTheme` and carried on
 * `ResolvedTheme.colors.neutral`. Mounts stamp the `--oc-gray-*`,
 * `--oc-text-secondary`, `--oc-text-faint` and `--oc-border` CSS tokens from
 * it. The direction is one-way: theme -> CSS. Engine code reads
 * `theme.colors.neutral.*` and never `cssTokenDefault`.
 */

import { cssTokenDefault } from '../styles/token-definitions';
import { isOpaqueColor } from './contrast';

/**
 * Neutral steps, named by the fraction of *text* in the text/background mix:
 * `100` is nearly the background, `800` is nearly the text.
 */
export interface NeutralRamp {
  100: string;
  200: string;
  300: string;
  400: string;
  600: string;
  800: string;
  /** Body-level secondary text. Same value as `800`. */
  secondary: string;
  /** Faintest legible ink (disabled states, empty cells). Same value as `300`. */
  faint: string;
  /** Container border / hairline on non-chart surfaces. Same value as `100`. */
  border: string;
  /**
   * The opaque canvas the theme paints on. Equal to the theme background when
   * that background has a color of its own; a transparent theme resolves to
   * the static `--oc-bg` token for the mode. Knockout rings, stacked-segment
   * seams, table cell fills and graph node rings all read this so they are cut
   * in the same color the surface actually renders as.
   */
  surface: string;
}

/** Mix weight (share of `text`) for each numbered step. */
const STEPS = [
  [100, 0.06],
  [200, 0.12],
  [300, 0.22],
  [400, 0.4],
  [600, 0.55],
  [800, 0.75],
] as const;

/** Parse `#rgb`/`#rrggbb` to an [r, g, b] triple, or null when unparseable. */
function parseHex(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Mix `text` toward `bg` in sRGB; `t` is the share of `text` in the result. */
function mix(text: [number, number, number], bg: [number, number, number], t: number): string {
  const c = (i: number) => Math.round(text[i] * t + bg[i] * (1 - t));
  const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${hex(c(0))}${hex(c(1))}${hex(c(2))}`;
}

/** The ramp the static CSS token defaults carry, for a given mode. */
function staticRamp(mode: 'light' | 'dark'): NeutralRamp {
  return {
    100: cssTokenDefault('--oc-gray-100', mode),
    200: cssTokenDefault('--oc-gray-200', mode),
    300: cssTokenDefault('--oc-gray-300', mode),
    400: cssTokenDefault('--oc-gray-400', mode),
    600: cssTokenDefault('--oc-gray-600', mode),
    800: cssTokenDefault('--oc-gray-800', mode),
    secondary: cssTokenDefault('--oc-text-secondary', mode),
    faint: cssTokenDefault('--oc-text-faint', mode),
    border: cssTokenDefault('--oc-border', mode),
    surface: cssTokenDefault('--oc-bg', mode),
  };
}

/**
 * Derive the neutral ramp for a text/background pair.
 *
 * Falls back to the static CSS token defaults when the background has no
 * intrinsic color (`transparent`, `none`, alpha-zero) or either color is not
 * a plain hex — the default theme's background is transparent, so this
 * fallback is the common path and is what keeps the theme and the generated
 * `tokens.css` in agreement.
 */
export function deriveNeutralRamp(text: string, bg: string, isDark = false): NeutralRamp {
  const mode = isDark ? 'dark' : 'light';
  // The surface is the background itself whenever that background paints
  // something; only a transparent/none background falls back to the token.
  const surface = isOpaqueColor(bg) ? bg : cssTokenDefault('--oc-bg', mode);
  if (!isOpaqueColor(bg)) return staticRamp(mode);
  const t = parseHex(text);
  const b = parseHex(bg);
  if (!t || !b) return { ...staticRamp(mode), surface };

  const ramp = Object.fromEntries(STEPS.map(([step, w]) => [step, mix(t, b, w)])) as Pick<
    NeutralRamp,
    100 | 200 | 300 | 400 | 600 | 800
  >;
  return {
    ...ramp,
    secondary: ramp[800],
    faint: ramp[300],
    border: ramp[100],
    surface,
  };
}
