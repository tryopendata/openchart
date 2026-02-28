/**
 * Color palettes for @openchart.
 *
 * Categorical palette is Infrographic-influenced with WCAG AA contrast
 * for large text (3:1 ratio) on both light (#ffffff) and dark (#1a1a2e)
 * backgrounds. Several colors do not meet the stricter 4.5:1 ratio
 * required for normal-sized body text. This is acceptable because chart
 * marks (bars, lines, areas, points) are large visual elements.
 *
 * Sequential palettes: 5-7 stops from light to dark.
 * Diverging palettes: 7 stops with a neutral midpoint.
 */

// ---------------------------------------------------------------------------
// Categorical
// ---------------------------------------------------------------------------

/**
 * Default categorical palette. 10 visually distinct colors that meet
 * WCAG AA contrast for large text (3:1) on both white and near-black
 * backgrounds. Some colors fall below the 4.5:1 threshold for normal
 * body text. Influenced by Infrographic's editorial palette with tweaks
 * for accessibility and colorblind distinguishability.
 */
export const CATEGORICAL_PALETTE = [
  '#1b7fa3', // teal-blue (primary)
  '#c44e52', // warm red (secondary)
  '#6a9f58', // softer green (tertiary)
  '#d47215', // orange
  '#507e79', // muted teal
  '#9a6a8d', // purple
  '#c4636b', // rose
  '#9c755f', // brown
  '#a88f22', // olive gold
  '#858078', // warm gray
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

/** All sequential palettes keyed by name. */
export const SEQUENTIAL_PALETTES: Record<string, string[]> = {
  blue: [...SEQUENTIAL_BLUE.stops],
  green: [...SEQUENTIAL_GREEN.stops],
  orange: [...SEQUENTIAL_ORANGE.stops],
  purple: [...SEQUENTIAL_PURPLE.stops],
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
