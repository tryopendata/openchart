/**
 * @opendata-ai/core
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
// available via SEQUENTIAL_PALETTES and DIVERGING_PALETTES or by direct import
// from '@opendata-ai/core/src/colors/palettes'.
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
  computeChrome,
  estimateTextWidth,
} from './layout/index';

// ---------------------------------------------------------------------------
// Responsive: breakpoints and layout strategies
// ---------------------------------------------------------------------------

export type {
  AnnotationPosition,
  AxisLabelDensity,
  Breakpoint,
  LabelMode,
  LayoutStrategy,
  LegendPosition,
} from './responsive/index';
export {
  getBreakpoint,
  getLayoutStrategy,
} from './responsive/index';

// ---------------------------------------------------------------------------
// Labels: collision detection and resolution
// ---------------------------------------------------------------------------

export type {
  LabelCandidate,
  LabelPriority,
} from './labels/index';
export { resolveCollisions } from './labels/index';

// ---------------------------------------------------------------------------
// Locale: number and date formatting
// ---------------------------------------------------------------------------

export type { DateGranularity } from './locale/index';
export {
  abbreviateNumber,
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
} from './helpers/spec-builders';
export {
  barChart,
  columnChart,
  dataTable,
  inferFieldType,
  lineChart,
  pieChart,
  scatterChart,
} from './helpers/spec-builders';
