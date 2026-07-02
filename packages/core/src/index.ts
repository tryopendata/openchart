/**
 * @opendata-ai/openchart-core
 *
 * Core types, theme engine, color system, accessibility, and locale utilities
 * for the openchart library.
 *
 * This package has no DOM dependencies and runs in any JavaScript environment.
 */

// ---------------------------------------------------------------------------
// Type system (specs, layouts, marks, encoding, theme types)
// ---------------------------------------------------------------------------

export * from './types/index';

// ---------------------------------------------------------------------------
// Colors: palette collections, contrast utilities, color-blindness simulation
//
// Individual named palettes (SEQUENTIAL_BLUE, DIVERGING_RED_BLUE, etc.) are
// available via the SEQUENTIAL_PALETTES and DIVERGING_PALETTES collections.
// ---------------------------------------------------------------------------

export type {
  CategoricalPalette,
  ColorBlindnessType,
  DivergingPalette,
  SequentialPalette,
} from './colors/index';
export {
  CATEGORICAL_PALETTE,
  checkPaletteDistinguishability,
  contrastRatio,
  DIVERGING_PALETTES,
  findAccessibleColor,
  meetsAA,
  pickLabelColor,
  SEQUENTIAL_PALETTES,
  simulateColorBlindness,
} from './colors/index';

// ---------------------------------------------------------------------------
// Theme: defaults, resolution, dark-mode adaptation
// ---------------------------------------------------------------------------

export {
  adaptColorForDarkMode,
  adaptTheme,
  DEFAULT_THEME,
  resolveTheme,
} from './theme/index';

// ---------------------------------------------------------------------------
// Layout: text measurement, chrome computation
// ---------------------------------------------------------------------------

export {
  BRAND_FONT_SIZE,
  BRAND_MIN_WIDTH,
  BRAND_RESERVE_WIDTH,
  COMPACT_WIDTH,
  computeChrome,
  estimateTextWidth,
  heuristicMeasure,
  resolveMeasurer,
  wrapText,
} from './layout/index';

// ---------------------------------------------------------------------------
// Responsive: breakpoints and layout strategies
// ---------------------------------------------------------------------------

export type {
  AnnotationPosition,
  AxisLabelDensity,
  Breakpoint,
  ChromeMode,
  HeightClass,
  LabelMode,
  LayoutStrategy,
  LegendPosition,
} from './responsive/index';
export {
  AXIS_TITLE_GAP,
  AXIS_TITLE_OFFSET_COMPACT,
  AXIS_TITLE_OFFSET_DEFAULT,
  AXIS_TITLE_TRAILING_PAD,
  axisTitleOffset,
  BREAKPOINT_COMPACT_MAX,
  BREAKPOINT_MEDIUM_MAX,
  getAxisTitleOffset,
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  HEIGHT_CRAMPED_MAX,
  HEIGHT_SHORT_MAX,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  LABEL_GAP_COMPACT,
  LABEL_GAP_DEFAULT,
  LABEL_GAP_NARROW_MAX,
  MAX_LEFT_LABEL_FRACTION_COMPACT,
  MAX_LEFT_LABEL_FRACTION_DEFAULT,
  MAX_LEFT_LABEL_FRACTION_MEDIUM,
  MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX,
  NARROW_VIEWPORT_MAX,
  TICK_LABEL_OFFSET,
  TOP_PAD_EXTRA_NARROW,
  TOP_PAD_NARROW_MAX,
} from './responsive/index';

// ---------------------------------------------------------------------------
// Labels: collision detection and resolution
// ---------------------------------------------------------------------------

export type {
  LabelCandidate,
  LabelPriority,
  OffsetStrategy,
} from './labels/index';
export {
  computeLabelBounds,
  detectCollision,
  EXTENDED_OFFSET_STRATEGIES,
  OFFSET_STRATEGIES,
  resolveCollisions,
} from './labels/index';

// ---------------------------------------------------------------------------
// Locale: number and date formatting
// ---------------------------------------------------------------------------

export type { DateGranularity } from './locale/index';
export {
  abbreviateNumber,
  buildD3Formatter,
  buildTemporalFormatter,
  formatDate,
  formatNumber,
} from './locale/index';

// ---------------------------------------------------------------------------
// Accessibility: alt text and ARIA label generation
// ---------------------------------------------------------------------------

export {
  generateAltText,
  generateAriaLabels,
  generateDataTable,
} from './accessibility/index';

// ---------------------------------------------------------------------------
// Helpers: spec construction builders
// ---------------------------------------------------------------------------

export type {
  ChartBuilderOptions,
  FieldRef,
  TableBuilderOptions,
  TileMapBuilderOptions,
} from './helpers/spec-builders';
export {
  areaChart,
  barChart,
  columnChart,
  dataTable,
  donutChart,
  dotChart,
  inferFieldType,
  lineChart,
  pieChart,
  scatterChart,
  tileMap,
} from './helpers/spec-builders';
