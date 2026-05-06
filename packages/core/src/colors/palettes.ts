/**
 * Color palettes for @opendata-ai.
 *
 * Categorical palette leads with cyan and uses an OKLCH-balanced multi-hue
 * ramp tuned to L≈0.70, C≈0.13–0.15. Hex values are precomputed sRGB
 * (rather than raw `oklch()` strings) because raw OKLCH strings parse
 * unreliably through d3-color and the dark-mode adapter's hsl-based
 * binary search. Source OKLCH values are documented inline so the ramp
 * can be regenerated if needed.
 *
 * Convention for low-cardinality charts (1 / 2-4 / 5+ series) is enforced
 * by chart-type renderer logic, not the palette itself. The palette stays
 * a flat 9-color ramp consumed by index. The convention is:
 *   - 1 series: cyan only
 *   - 2-4 series: cyan + zinc-400/500/600 (achromatic)
 *   - 5+ series: full multi-hue ramp below
 *
 * Sequential palettes: 5-7 stops from light to dark.
 * Diverging palettes: 7 stops with a neutral midpoint.
 */

// ---------------------------------------------------------------------------
// Achromatic ramp (zinc-based, dark-mode canonical)
// ---------------------------------------------------------------------------

/**
 * Achromatic surface and supporting-series ramp. Values are the canonical
 * dark-mode tokens; light-mode equivalents are derived per token in
 * `theme/dark-mode.ts` and the CSS partials, not mirrored here.
 */
export const ACHROMATIC_RAMP = {
  fg: '#f7f8f8', // primary text
  fg2: '#d0d6e0', // body text
  fgMuted: '#a1a1aa', // secondary series (zinc-400)
  fgSubtle: '#71717a', // tertiary series (zinc-500)
  fgFaint: '#52525b', // quaternary series (zinc-600)
  secondary: '#27272a', // hover / raised surface
  card: '#111113', // card surface
  bg: '#09090b', // canvas
} as const;

// ---------------------------------------------------------------------------
// Categorical
// ---------------------------------------------------------------------------

/**
 * Default categorical palette. Cyan-led OKLCH-balanced multi-hue ramp.
 *
 * Hex values precomputed from OKLCH via the standard OKLab -> linear sRGB
 * -> sRGB pipeline. Documented OKLCH source values are the contract; if
 * the conversion math changes, regenerate from the source rather than
 * editing hex literals directly.
 */
export const CATEGORICAL_PALETTE = [
  '#06b6d4', // cyan, primary accent (sRGB literal)
  '#00b9c3', // teal    — oklch(70% 0.15 200)
  '#3bb974', // emerald — oklch(70% 0.15 155)
  '#e69c3a', // amber   — oklch(75% 0.14 70)
  '#eb7289', // rose    — oklch(70% 0.15 10)
  '#8494fa', // indigo  — oklch(70% 0.15 275)
  '#ad87ed', // violet  — oklch(70% 0.15 300)
  '#eb8656', // orange  — oklch(72% 0.14 45)
  '#4ba3f7', // sky     — oklch(70% 0.15 250)
] as const;

export type CategoricalPalette = typeof CATEGORICAL_PALETTE;

// ---------------------------------------------------------------------------
// Sequential
// ---------------------------------------------------------------------------

/** Sequential palette definition: an array of color stops from light to dark. */
export interface SequentialPalette {
  readonly name: string;
  readonly stops: readonly string[];
}

export const SEQUENTIAL_BLUE: SequentialPalette = {
  name: 'blue',
  stops: ['#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
} as const;

export const SEQUENTIAL_GREEN: SequentialPalette = {
  name: 'green',
  stops: ['#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#31a354', '#006d2c'],
} as const;

export const SEQUENTIAL_ORANGE: SequentialPalette = {
  name: 'orange',
  stops: ['#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#e6550d', '#a63603'],
} as const;

export const SEQUENTIAL_PURPLE: SequentialPalette = {
  name: 'purple',
  stops: ['#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1', '#54278f'],
} as const;

export const SEQUENTIAL_TEAL: SequentialPalette = {
  name: 'teal',
  stops: ['#06b6d4', '#05a3be', '#0490a8', '#037d92', '#026a7c', '#015766', '#004450'],
} as const;

/** All sequential palettes keyed by name. */
export const SEQUENTIAL_PALETTES: Record<string, string[]> = {
  blue: [...SEQUENTIAL_BLUE.stops],
  green: [...SEQUENTIAL_GREEN.stops],
  orange: [...SEQUENTIAL_ORANGE.stops],
  purple: [...SEQUENTIAL_PURPLE.stops],
  teal: [...SEQUENTIAL_TEAL.stops],
};

// ---------------------------------------------------------------------------
// Diverging
// ---------------------------------------------------------------------------

/** Diverging palette definition: an array of color stops with a neutral midpoint. */
export interface DivergingPalette {
  readonly name: string;
  readonly stops: readonly string[];
}

export const DIVERGING_RED_BLUE: DivergingPalette = {
  name: 'redBlue',
  stops: [
    '#b2182b', // strong red
    '#d6604d', // medium red
    '#f4a582', // light red
    '#f7f7f7', // neutral
    '#92c5de', // light blue
    '#4393c3', // medium blue
    '#2166ac', // strong blue
  ],
} as const;

export const DIVERGING_BROWN_TEAL: DivergingPalette = {
  name: 'brownTeal',
  stops: [
    '#8c510a', // strong brown
    '#bf812d', // medium brown
    '#dfc27d', // light brown
    '#f6e8c3', // neutral
    '#80cdc1', // light teal
    '#35978f', // medium teal
    '#01665e', // strong teal
  ],
} as const;

/** All diverging palettes keyed by name. */
export const DIVERGING_PALETTES: Record<string, string[]> = {
  redBlue: [...DIVERGING_RED_BLUE.stops],
  brownTeal: [...DIVERGING_BROWN_TEAL.stops],
};
