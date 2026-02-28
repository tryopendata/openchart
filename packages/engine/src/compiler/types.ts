/**
 * Internal engine types for the compilation pipeline.
 *
 * NormalizedSpec is the engine's internal representation where all optionals
 * have been filled with defaults. It's intentionally NOT in the core package
 * since it's an engine implementation detail, not a public contract.
 */

import type {
  AggregateOp,
  Annotation,
  AxisConfig,
  ChartType,
  ChromeText,
  ColumnConfig,
  DarkMode,
  DataRow,
  Encoding,
  FieldType,
  GraphEncoding,
  GraphLayoutConfig,
  GraphSpec,
  LabelConfig,
  LegendConfig,
  ScaleConfig,
  ThemeConfig,
} from '@openchart/core';

// ---------------------------------------------------------------------------
// NormalizedChrome: all fields are ChromeText objects (not plain strings)
// ---------------------------------------------------------------------------

/** Chrome with all string values normalized to ChromeText objects. */
export interface NormalizedChrome {
  title?: ChromeText;
  subtitle?: ChromeText;
  source?: ChromeText;
  byline?: ChromeText;
  footer?: ChromeText;
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

/** A ChartSpec with all optional fields filled with sensible defaults. */
export interface NormalizedChartSpec {
  type: ChartType;
  data: DataRow[];
  encoding: Encoding;
  chrome: NormalizedChrome;
  annotations: Annotation[];
  /** Normalized label configuration with defaults applied. */
  labels: Required<LabelConfig>;
  /** Legend configuration (position override). */
  legend?: LegendConfig;
  responsive: boolean;
  theme: ThemeConfig;
  darkMode: DarkMode;
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
  search: boolean;
  pagination: boolean | { pageSize: number };
  stickyFirstColumn: boolean;
  compact: boolean;
  responsive: boolean;
}

/** A GraphSpec with all optional fields filled with sensible defaults. */
export interface NormalizedGraphSpec {
  type: 'graph';
  nodes: GraphSpec['nodes'];
  edges: GraphSpec['edges'];
  encoding: GraphEncoding;
  layout: GraphLayoutConfig;
  chrome: NormalizedChrome;
  annotations: Annotation[];
  theme: ThemeConfig;
  darkMode: DarkMode;
}

/** Discriminated union of all normalized spec types. */
export type NormalizedSpec = NormalizedChartSpec | NormalizedTableSpec | NormalizedGraphSpec;

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
  normalized: import('@openchart/core').VizSpec | null;
}

/** Result of the compile pipeline (validate + normalize). */
export interface CompileResult {
  /** The normalized spec with all defaults applied. */
  spec: NormalizedSpec;
  /** Non-fatal warnings (e.g. type mismatches that were auto-corrected). */
  warnings: string[];
}
