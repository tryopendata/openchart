/**
 * Internal engine types for the compilation pipeline.
 *
 * NormalizedSpec is the engine's internal representation where all optionals
 * have been filled with defaults. It's intentionally NOT in the core package
 * since it's an engine implementation detail, not a public contract.
 */

import type {
  AggregateOp,
  AnimationSpec,
  Annotation,
  AxisConfig,
  ChromeText,
  ColumnConfig,
  DarkMode,
  DataRow,
  Display,
  Encoding,
  FieldType,
  GraphAnimationSpec,
  GraphEncoding,
  GraphInteractionConfig,
  GraphLayoutConfig,
  GraphSpec,
  LabelConfig,
  LegendConfig,
  MarkDef,
  MarkType,
  NodeOverride,
  ScaleConfig,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import type { NormalizedBarListSpec } from '../barlist/types';
import type { NormalizedGeoMapSpec } from '../geo/types';
import type { NormalizedSankeySpec } from '../sankey/types';
import type { NormalizedTileMapSpec } from '../tilemap/types';

// ---------------------------------------------------------------------------
// NormalizedChrome: all fields are ChromeText objects (not plain strings)
// ---------------------------------------------------------------------------

/** Chrome with all string values normalized to ChromeText objects. */
export interface NormalizedChrome {
  eyebrow?: ChromeText;
  title?: ChromeText;
  subtitle?: ChromeText;
  source?: ChromeText;
  byline?: ChromeText;
  footer?: ChromeText;
  brand?: ChromeText;
}

// ---------------------------------------------------------------------------
// NormalizedEncoding: all encoding channels have their type filled in
// ---------------------------------------------------------------------------

/** An encoding channel with a guaranteed type (inferred if not provided). */
export interface NormalizedEncodingChannel {
  field: string;
  type: FieldType;
  aggregate?: AggregateOp;
  axis?: AxisConfig;
  scale?: ScaleConfig;
}

// ---------------------------------------------------------------------------
// NormalizedSpec types
// ---------------------------------------------------------------------------

/**
 * Tracks which top-level fields the user explicitly set in their input spec.
 *
 * Built from the raw expandedSpec (post-breakpoint-merge, pre-normalize) so
 * that "user wrote chrome.title" vs "user wrote nothing" is distinguishable
 * after normalization fills in defaults.
 *
 * Used by sparkline display mode to decide whether to suppress chrome/axes/
 * legend/etc. by default vs. respecting an explicit user opt-in.
 */
export interface UserExplicit {
  /** True if user wrote `chrome` (any non-empty chrome). */
  chrome: boolean;
  /** True if user wrote `legend`. */
  legend: boolean;
  /** True if user wrote `endpointLabels`. */
  endpointLabels: boolean;
  /** True if user wrote `encoding.x.axis`. */
  xAxis: boolean;
  /** True if user wrote `encoding.y.axis`. */
  yAxis: boolean;
  /** True if user wrote `labels`. */
  labels: boolean;
  /** True if user wrote `animation`. */
  animation: boolean;
  /** True if user wrote `watermark`. */
  watermark: boolean;
  /** True if user wrote `crosshair`. */
  crosshair: boolean;
}

/** A ChartSpec with all optional fields filled with sensible defaults. */
export interface NormalizedChartSpec {
  /** Resolved mark type string (extracted from spec.mark). */
  markType: MarkType;
  /** Resolved mark definition with defaults filled in. */
  markDef: MarkDef;
  data: DataRow[];
  encoding: Encoding;
  chrome: NormalizedChrome;
  /**
   * How chrome height interacts with the height budget. `'grow'` treats the
   * container height as the plot budget and grows the SVG by the chrome height;
   * `'subtract'` (default) shrinks the plot to fit chrome. Carried through from
   * the spec so the layout pipeline can honor it.
   */
  chromeLayout?: 'subtract' | 'grow';
  /** Optional KPI metric cells, passed through unchanged. */
  metrics?: import('@opendata-ai/openchart-core').Metric[];
  /**
   * Searchable series highlight config. Present only when `seriesSearch` is
   * enabled AND the spec has a categorical color encoding to search over.
   */
  seriesSearch?: import('@opendata-ai/openchart-core').SeriesSearchConfig;
  /** Resolved "you draw it" config with defaults filled in. Present only when `youDrawIt` is enabled. */
  youDrawIt?: import('@opendata-ai/openchart-core').YouDrawItConfig;
  annotations: Annotation[];
  /** Normalized label configuration with defaults applied. density, format, and prefix are always set; offsets and color stay optional. */
  labels: Required<Pick<LabelConfig, 'density' | 'format' | 'prefix'>> &
    Pick<LabelConfig, 'offsets' | 'color' | 'fontSize' | 'suffix'>;
  /** Legend configuration (position override). */
  legend?: LegendConfig;
  /** Right-side endpoint labels column config (multi-series line/area only). */
  endpointLabels?: boolean | import('@opendata-ai/openchart-core').EndpointLabelsConfig;
  responsive: boolean;
  /** Whether auto-thinning of annotations at narrow widths is enabled. Resolved from `responsive.autoThin`. */
  autoThin: boolean;
  theme: ThemeConfig;
  darkMode: DarkMode;
  /** Whether the tryOpenData.ai watermark is enabled. */
  watermark: boolean;
  /** Series names to hide from rendering. */
  hiddenSeries: string[];
  /** Per-series visual style overrides. */
  seriesStyles: Record<string, import('@opendata-ai/openchart-core').SeriesStyle>;
  /** Author accessibility overrides (alt-text description, aria-hidden opt-out). */
  a11y?: import('@opendata-ai/openchart-core').A11yConfig;
  /** Display mode controlling chrome/axes/legend stripping. Defaults to `'full'`. */
  display: Display;
  /** Resolve configuration for independent/shared scales in faceted charts. */
  resolve?: import('@opendata-ai/openchart-core').ResolveConfig;
  /**
   * Which top-level fields the user explicitly set. Populated by compileChart
   * from the raw expanded spec before normalization. NormalizeChartSpec runs
   * with a default-empty descriptor; compileChart overwrites it post-normalize.
   */
  userExplicit: UserExplicit;
  /**
   * Series values to visually emphasize. Non-highlighted series are muted to
   * a neutral gray. Normalized from `encoding.color.highlight` (always an
   * array; empty when no highlight is active).
   */
  highlight: string[];
}

/** A TableSpec with all optional fields filled with sensible defaults. */
export interface NormalizedTableSpec {
  type: 'table';
  data: DataRow[];
  columns: ColumnConfig[];
  rowKey?: string;
  chrome: NormalizedChrome;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  search: boolean;
  pagination: boolean | { pageSize: number };
  stickyFirstColumn: boolean;
  compact: boolean;
  responsive: boolean;
  animation?: AnimationSpec;
}

/** A GraphSpec with all optional fields filled with sensible defaults. */
export interface NormalizedGraphSpec {
  type: 'graph';
  nodes: GraphSpec['nodes'];
  edges: GraphSpec['edges'];
  encoding: GraphEncoding;
  layout: GraphLayoutConfig;
  nodeOverrides?: Record<string, NodeOverride>;
  /** Seed node, always in object form (the string shorthand is expanded). */
  seedNode?: { id: string; style?: NodeOverride };
  chrome: NormalizedChrome;
  annotations: Annotation[];
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: GraphAnimationSpec;
  interaction?: GraphInteractionConfig;
  legend?: boolean | { interactive?: boolean; counts?: boolean };
}

/** Discriminated union of all normalized spec types. */
export type NormalizedSpec =
  | NormalizedChartSpec
  | NormalizedTableSpec
  | NormalizedGraphSpec
  | NormalizedSankeySpec
  | NormalizedTileMapSpec
  | NormalizedGeoMapSpec
  | NormalizedBarListSpec;

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

/** Machine-readable error code for programmatic handling. */
export type ValidationErrorCode =
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'ENCODING_MISMATCH'
  | 'DATA_FIELD_MISSING'
  | 'EMPTY_DATA';

/** A single validation error with context. */
export interface ValidationError {
  /** Error message describing what's wrong. */
  message: string;
  /** The path to the problematic value (e.g. "encoding.x.field"). */
  path?: string;
  /** Machine-readable error code for programmatic handling. */
  code: ValidationErrorCode;
  /** Actionable suggestion for fixing the error. */
  suggestion: string;
}

/** Result of spec validation. */
export interface ValidationResult {
  /** Whether the spec is valid. */
  valid: boolean;
  /** Validation errors (empty if valid). */
  errors: ValidationError[];
  /** The validated spec cast to VizSpec, or null if invalid. */
  normalized: import('@opendata-ai/openchart-core').VizSpec | null;
}

/** Result of the compile pipeline (validate + normalize). */
export interface CompileResult {
  /** The normalized spec with all defaults applied. */
  spec: NormalizedSpec;
  /** Non-fatal warnings (e.g. type mismatches that were auto-corrected). */
  warnings: string[];
}
