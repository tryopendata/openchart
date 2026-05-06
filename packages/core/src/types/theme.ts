/**
 * Theme types: color palettes, typography, spacing, and chrome defaults.
 *
 * Theme is the user-facing partial config (all optional).
 * ResolvedTheme is the engine-internal fully resolved version (no optionals).
 */

// ---------------------------------------------------------------------------
// Color palette types
// ---------------------------------------------------------------------------

/** Color palettes for the visualization. */
export interface ThemeColors {
  /** Categorical palette for nominal data. Array of CSS color strings. */
  categorical: string[];
  /** Sequential palettes keyed by name. Each is an array of color stops from light to dark. */
  sequential: Record<string, string[]>;
  /** Diverging palettes keyed by name. Each is an array of color stops with a neutral midpoint. */
  diverging: Record<string, string[]>;
  /** Background color for the visualization container. */
  background: string;
  /** Default text color. */
  text: string;
  /** Gridline color. */
  gridline: string;
  /** Axis line and tick color. */
  axis: string;
  /** Annotation fill color. */
  annotationFill: string;
  /** Annotation text color. */
  annotationText: string;
}

// ---------------------------------------------------------------------------
// Typography types
// ---------------------------------------------------------------------------

/** Font size presets for the typography scale. */
export interface ThemeFontSizes {
  /** Title font size in pixels. */
  title: number;
  /** Subtitle font size in pixels. */
  subtitle: number;
  /** Body/label font size in pixels. */
  body: number;
  /** Small text (source, footer) font size in pixels. */
  small: number;
  /** Axis tick label font size in pixels. */
  axisTick: number;
}

/** Font weight presets. */
export interface ThemeFontWeights {
  /** Normal text weight. */
  normal: number;
  /** Medium text weight (subtitles). */
  medium: number;
  /** Semibold text weight (titles). */
  semibold: number;
  /** Bold text weight. */
  bold: number;
}

/** Complete typography configuration. */
export interface ThemeFonts {
  /** Primary font family. */
  family: string;
  /** Monospace font family (for tabular numbers). */
  mono: string;
  /** Font sizes. */
  sizes: ThemeFontSizes;
  /** Font weights. */
  weights: ThemeFontWeights;
}

// ---------------------------------------------------------------------------
// Spacing types
// ---------------------------------------------------------------------------

/** Spacing configuration in pixels. */
export interface ThemeSpacing {
  /** Padding inside the visualization container (all sides). */
  padding: number;
  /** Gap between chrome elements (title to subtitle, subtitle to chart, etc.). */
  chromeGap: number;
  /** Gap between the last chrome element and the chart area. */
  chromeToChart: number;
  /** Gap between chart area and source/footer below. */
  chartToFooter: number;
  /** Internal padding within the chart area (axes margins). */
  axisMargin: number;
}

// ---------------------------------------------------------------------------
// Chrome default styles
// ---------------------------------------------------------------------------

/** Default style configuration for a chrome text element. */
export interface ChromeDefaults {
  /** Font size in pixels. */
  fontSize: number;
  /** Font weight. */
  fontWeight: number;
  /** Text color (CSS color string). */
  color: string;
  /** Line height multiplier. */
  lineHeight: number;
}

/** Default chrome styles for each element type. */
export interface ThemeChromeDefaults {
  eyebrow: ChromeDefaults;
  title: ChromeDefaults;
  subtitle: ChromeDefaults;
  source: ChromeDefaults;
  byline: ChromeDefaults;
  footer: ChromeDefaults;
}

// ---------------------------------------------------------------------------
// Theme (user-facing, all optional)
// ---------------------------------------------------------------------------

/**
 * Complete theme interface. Used internally after merging user overrides
 * onto defaults. All fields are required here (this is what the engine
 * works with).
 *
 * Users provide ThemeConfig (from spec.ts) which is the partial/optional
 * version. The theme resolver deep-merges ThemeConfig onto the default Theme
 * to produce a ResolvedTheme.
 */
export interface Theme {
  /** Color palettes. */
  colors: ThemeColors;
  /** Typography settings. */
  fonts: ThemeFonts;
  /** Spacing values in pixels. */
  spacing: ThemeSpacing;
  /** Border radius for containers and tooltips. */
  borderRadius: number;
  /** Default chrome text styles. */
  chrome: ThemeChromeDefaults;
}

/**
 * Fully resolved theme with no optional fields.
 *
 * This is the result of resolveTheme(): the default theme with user
 * overrides deep-merged in. Every property is guaranteed to have a value.
 * The engine uses ResolvedTheme internally so it never needs null checks.
 *
 * Structurally identical to Theme (both have all required fields), but
 * exists as a separate type for semantic clarity: Theme is the default
 * definition, ResolvedTheme is the runtime-resolved instance.
 */
export interface ResolvedTheme extends Theme {
  /** Whether dark mode adaptations have been applied to this theme. */
  isDark: boolean;
}
