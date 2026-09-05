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
 * Convention for low-cardinality charts (1 / 2-4 / 5+ series) is available
 * as an opt-in via `theme.seriesStrategy`. The default strategy is 'palette'
 * (full categorical ramp always). The accent-neutral convention is:
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
 * Quiet ordered editorial categorical palette: six hues, cyan in slot 1.
 *
 * Construction rules (the contract; the hexes below are output, not input):
 *   - Hue order cyan 208 -> ochre 70 -> blue 262 -> rose 350 -> green 155 ->
 *     violet 300, so every adjacent pair including the wrap is >= 80° apart.
 *   - Lightness varies rather than matching: colour-vision deficiency
 *     collapses hue and only lightness survives, so a matched-lightness ramp
 *     fails the repo's own Brettel simulator on ochre/rose and blue/violet.
 *   - Strokes carry more chroma than fills; a fill is the same hue one step
 *     lighter and quieter, so a bar or slice never shouts as loud as a line.
 *   - Dark variants raise L and trim chroma instead of reusing the light hexes.
 *
 * Hex values are precomputed sRGB via the Ottosson OKLab -> linear sRGB ->
 * sRGB pipeline (raw `oklch()` strings parse unreliably through d3-color and
 * the dark-mode adapter's hsl-based binary search). Each entry carries its
 * *measured* OKLCH so the ramp can be regenerated; do not edit hexes directly.
 *
 * Every array here clears `checkPaletteDistinguishability` at the default
 * minDistance 30 for deuteranopia and protanopia — see
 * `colors/__tests__/palette-a11y.test.ts`, which is the guard on any change.
 */
export const CATEGORICAL_PALETTE = [
  '#06b6d4', // cyan   — oklch(0.715 0.126 215) — sRGB literal, primary accent
  '#e29e47', // ochre  — oklch(0.750 0.130 70)
  '#4170cb', // blue   — oklch(0.559 0.150 262)
  '#b2417f', // rose   — oklch(0.550 0.161 350)
  '#3ca368', // green  — oklch(0.640 0.130 155)
  '#a584dc', // violet — oklch(0.679 0.130 300)
] as const;

/**
 * Fill counterparts of {@link CATEGORICAL_PALETTE}: same hues, ~0.03 lighter
 * and ~0.03 lower chroma. Used for area-filling marks (bar, area, arc,
 * waffle, calendar, rect) so large blocks of colour read quieter than the
 * strokes of a line chart drawn beside them.
 */
export const CATEGORICAL_FILL_PALETTE = [
  '#51bccc', // cyan   — oklch(0.739 0.100 209)
  '#dda96b', // ochre  — oklch(0.770 0.100 70)
  '#587fc8', // blue   — oklch(0.601 0.120 262)
  '#bf6291', // rose   — oklch(0.619 0.131 350)
  '#62ab7d', // green  — oklch(0.681 0.101 155)
  '#ae96da', // violet — oklch(0.719 0.100 300)
] as const;

/** Dark-mode stroke palette: L raised ~0.10, chroma trimmed. */
export const CATEGORICAL_PALETTE_DARK = [
  '#22d3ee', // cyan   — oklch(0.797 0.134 212) — sRGB literal
  '#f9be78', // ochre  — oklch(0.840 0.111 70)
  '#6591e1', // blue   — oklch(0.660 0.129 262)
  '#d771a4', // rose   — oklch(0.680 0.140 350)
  '#6ebf8c', // green  — oklch(0.739 0.109 155)
  '#bca1ed', // violet — oklch(0.760 0.110 300)
] as const;

/** Dark-mode fill palette: the dark strokes one step quieter. */
export const CATEGORICAL_FILL_PALETTE_DARK = [
  '#72cedc', // cyan   — oklch(0.800 0.090 208)
  '#f3c898', // ochre  — oklch(0.859 0.079 70)
  '#7698d6', // blue   — oklch(0.679 0.100 262)
  '#d281a8', // rose   — oklch(0.700 0.111 350)
  '#82ba95', // green  — oklch(0.740 0.079 155)
  '#c2afe7', // violet — oklch(0.789 0.081 300)
] as const;

/**
 * Slots 7-12. Only reached past slot 6, and reaching it emits a warning:
 * a chart with more than six categorical series is a chart that should be
 * bucketed, faceted, or direct-labelled instead.
 *
 * Built by interleaving: each base hue + 40° (which lands each entry near the
 * midpoint of a gap in the base ramp) with lightness alternating ±0.12 from
 * its base slot. The array is rotated so slot 7 sits 105° from cyan and never
 * neighbours it on a seven-slice pie wrap; the two entries that do land near
 * cyan in hue are pushed to slots 10 and 12.
 */
export const CATEGORICAL_EXTENDED_PALETTE = [
  '#8e8f19', // olive     — oklch(0.629 0.130 110)
  '#b086eb', // periwinkle— oklch(0.701 0.149 302)
  '#ac3225', // brick     — oklch(0.501 0.161 30)
  '#00bfc0', // teal      — oklch(0.729 0.124 195)
  '#a5538c', // mulberry  — oklch(0.560 0.129 340)
  '#65b1f6', // sky       — oklch(0.740 0.126 248)
] as const;

/**
 * Measured OKLCH hue (deg) of each {@link CATEGORICAL_PALETTE} slot, in slot
 * order. Exported so the adjacency test can assert the ordering rule without
 * re-deriving OKLCH from the hexes.
 */
export const CATEGORICAL_HUES = [215.2, 70.0, 262.1, 349.7, 154.8, 300.2] as const;

/** Measured OKLCH lightness of each {@link CATEGORICAL_PALETTE} slot. */
export const CATEGORICAL_LIGHTNESS = [0.715, 0.75, 0.559, 0.55, 0.64, 0.679] as const;

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

// ---------------------------------------------------------------------------
// Scheme name resolution (spec-level `scale: { scheme }` support)
// ---------------------------------------------------------------------------

/**
 * Vega-Lite scheme-name aliases mapped onto the openchart palettes.
 * Keys are lowercase. Only schemes with a faithful local equivalent are
 * aliased; unknown names fail validation with the supported list rather
 * than silently substituting an unrelated ramp.
 */
const VL_SCHEME_ALIASES: Record<string, string> = {
  blues: 'blue',
  greens: 'green',
  oranges: 'orange',
  purples: 'purple',
  teals: 'teal',
  redblue: 'redBlue',
  brownteal: 'brownTeal',
  // ColorBrewer BrBG, which brownTeal mirrors
  brownbluegreen: 'brownTeal',
  category10: 'categorical',
  tableau10: 'categorical',
};

/**
 * Resolve a scheme name to its palette stops. Accepts openchart palette names
 * (blue, green, orange, purple, teal, redBlue, brownTeal, categorical) and
 * common Vega-Lite aliases (blues, greens, ..., redblue, category10).
 * Case-insensitive. Returns undefined for unknown names.
 */
export function resolveSchemeName(name: string): string[] | undefined {
  const canonical =
    SEQUENTIAL_PALETTES[name] || DIVERGING_PALETTES[name]
      ? name
      : (VL_SCHEME_ALIASES[name.toLowerCase()] ?? name.toLowerCase());
  if (canonical === 'categorical') return [...CATEGORICAL_PALETTE];
  return SEQUENTIAL_PALETTES[canonical] ?? DIVERGING_PALETTES[canonical];
}

/** Scheme names accepted by `scale: { scheme }`, for validation messages. */
export const SUPPORTED_SCHEME_NAMES: readonly string[] = [
  ...Object.keys(SEQUENTIAL_PALETTES),
  ...Object.keys(DIVERGING_PALETTES),
  'categorical',
  ...Object.keys(VL_SCHEME_ALIASES),
];
