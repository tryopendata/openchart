/**
 * Spec construction helpers: typed builder functions for common chart types.
 *
 * These builders reduce boilerplate when creating specs programmatically.
 * They accept field names as strings (simple case) or full EncodingChannel
 * objects (when you need to customize type, aggregate, axis, or scale).
 *
 * Type inference: when a string field name is provided, the builder samples
 * data values to infer the encoding type (quantitative, temporal, nominal).
 */

import type {
  AnimationSpec,
  Annotation,
  ChartSpec,
  Chrome,
  DarkMode,
  DataRow,
  Encoding,
  EncodingChannel,
  FieldType,
  LegendConfig,
  MarkDef,
  MarkType,
  TableSpec,
  ThemeConfig,
  TileMapEncoding,
  TileMapPalette,
  TileMapSpec,
} from '../types/spec';
import type { ColumnConfig } from '../types/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A field reference: either a plain string (field name) or a full EncodingChannel. */
export type FieldRef = string | EncodingChannel;

/** Common options shared by all chart builder functions. */
export interface ChartBuilderOptions {
  /** Color encoding: field name or full channel config for series differentiation. */
  color?: FieldRef;
  /** Size encoding: field name or full channel config. */
  size?: FieldRef;
  /** Editorial chrome (title, subtitle, source, etc.). */
  chrome?: Chrome;
  /** Data annotations. */
  annotations?: Annotation[];
  /** Whether the chart adapts to container width. Defaults to true. */
  responsive?: boolean;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. */
  darkMode?: DarkMode;
}

/** Options for the dataTable builder. */
export interface TableBuilderOptions {
  /** Column definitions. Auto-generated from data keys if omitted. */
  columns?: ColumnConfig[];
  /** Field to use as a unique row identifier. */
  rowKey?: string;
  /** Editorial chrome. */
  chrome?: Chrome;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. */
  darkMode?: DarkMode;
  /** Enable client-side search/filter. */
  search?: boolean;
  /** Pagination configuration. */
  pagination?: boolean | { pageSize: number };
  /** Stick the first column during horizontal scroll. */
  stickyFirstColumn?: boolean;
  /** Compact mode. */
  compact?: boolean;
  /** Whether the table adapts to container width. */
  responsive?: boolean;
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

/** ISO 8601 date patterns we recognize for temporal inference. */
const ISO_DATE_RE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2})?)?)?)?)?$/;

/**
 * Infer the encoding field type from data values.
 *
 * Samples up to 20 values from the data array for the given field.
 * - If all sampled values are numbers (or null/undefined), returns "quantitative".
 * - If all sampled string values match ISO date patterns, returns "temporal".
 * - Otherwise returns "nominal".
 */
export function inferFieldType(data: DataRow[], field: string): FieldType {
  const sampleSize = Math.min(data.length, 20);
  let hasNumber = false;
  let hasDateString = false;
  let hasOtherString = false;

  for (let i = 0; i < sampleSize; i++) {
    const value = data[i][field];

    // Skip null/undefined
    if (value == null) continue;

    if (typeof value === 'number') {
      hasNumber = true;
    } else if (typeof value === 'string') {
      if (ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value))) {
        hasDateString = true;
      } else {
        hasOtherString = true;
      }
    } else if (value instanceof Date) {
      hasDateString = true;
    } else {
      hasOtherString = true;
    }
  }

  // Numbers-only: quantitative
  if (hasNumber && !hasDateString && !hasOtherString) return 'quantitative';
  // Date strings/Date objects only: temporal
  if (hasDateString && !hasNumber && !hasOtherString) return 'temporal';
  // Everything else: nominal
  return 'nominal';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a FieldRef into a full EncodingChannel.
 * If the ref is a string, infer the type from data.
 */
function resolveField(ref: FieldRef, data: DataRow[]): EncodingChannel {
  if (typeof ref === 'string') {
    return { field: ref, type: inferFieldType(data, ref) };
  }
  return ref;
}

/** Build the encoding object from resolved channels. */
function buildEncoding(
  channels: { x?: EncodingChannel; y?: EncodingChannel },
  options?: ChartBuilderOptions,
  data?: DataRow[],
): Encoding {
  const encoding: Encoding = { ...channels };
  if (options?.color && data) {
    encoding.color = resolveField(options.color, data);
  }
  if (options?.size && data) {
    encoding.size = resolveField(options.size, data);
  }
  return encoding;
}

/** Build a ChartSpec from the resolved pieces. */
function buildChartSpec(
  mark: MarkType | MarkDef,
  data: DataRow[],
  encoding: Encoding,
  options?: ChartBuilderOptions,
): ChartSpec {
  // Cast needed because the generic discriminated union can't be constructed
  // from a runtime MarkType variable — the caller always pairs mark+encoding correctly.
  const spec = { mark, data, encoding } as ChartSpec;
  if (options?.chrome) spec.chrome = options.chrome;
  if (options?.annotations) spec.annotations = options.annotations;
  if (options?.responsive !== undefined) spec.responsive = options.responsive;
  if (options?.theme) spec.theme = options.theme;
  if (options?.darkMode) spec.darkMode = options.darkMode;
  return spec;
}

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

/**
 * Create a line chart spec.
 *
 * @param data - Array of data rows.
 * @param x - X-axis field (typically temporal or ordinal).
 * @param y - Y-axis field (typically quantitative).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function lineChart(
  data: DataRow[],
  x: FieldRef,
  y: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const xChannel = resolveField(x, data);
  const yChannel = resolveField(y, data);
  const encoding = buildEncoding({ x: xChannel, y: yChannel }, options, data);
  return buildChartSpec('line', data, encoding, options);
}

/**
 * Create a bar chart spec (horizontal bars).
 *
 * Convention: category goes on y-axis, value on x-axis.
 * The `category` param maps to y, `value` maps to x.
 *
 * @param data - Array of data rows.
 * @param category - Category field (y-axis, nominal/ordinal).
 * @param value - Value field (x-axis, quantitative).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function barChart(
  data: DataRow[],
  category: FieldRef,
  value: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const categoryChannel = resolveField(category, data);
  const valueChannel = resolveField(value, data);

  // Bar charts: category on y, value on x
  const encoding = buildEncoding({ x: valueChannel, y: categoryChannel }, options, data);
  return buildChartSpec('bar', data, encoding, options);
}

/**
 * Create a column chart spec (vertical columns).
 *
 * @param data - Array of data rows.
 * @param x - X-axis field (category or temporal).
 * @param y - Y-axis field (quantitative value).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function columnChart(
  data: DataRow[],
  x: FieldRef,
  y: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const xChannel = resolveField(x, data);
  const yChannel = resolveField(y, data);
  const encoding = buildEncoding({ x: xChannel, y: yChannel }, options, data);
  return buildChartSpec({ type: 'bar' } as MarkDef, data, encoding, options);
}

/**
 * Create a pie chart spec.
 *
 * Convention: category maps to the color channel, value maps to y.
 * Pie charts have no x-axis.
 *
 * @param data - Array of data rows.
 * @param category - Category field (color channel, nominal).
 * @param value - Value field (y channel, quantitative).
 * @param options - Optional chrome, annotations, theme, etc.
 *                  Note: color option is ignored since category is used for color.
 */
export function pieChart(
  data: DataRow[],
  category: FieldRef,
  value: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const categoryChannel = resolveField(category, data);
  const valueChannel = resolveField(value, data);

  // Pie charts: value on y, category on color (no x-axis)
  const encoding: Encoding = {
    y: valueChannel,
    color: categoryChannel,
  };
  if (options?.size && data) {
    encoding.size = resolveField(options.size, data);
  }

  return buildChartSpec('arc', data, encoding, options);
}

/**
 * Create an area chart spec.
 *
 * @param data - Array of data rows.
 * @param x - X-axis field (typically temporal or ordinal).
 * @param y - Y-axis field (typically quantitative).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function areaChart(
  data: DataRow[],
  x: FieldRef,
  y: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const xChannel = resolveField(x, data);
  const yChannel = resolveField(y, data);
  const encoding = buildEncoding({ x: xChannel, y: yChannel }, options, data);
  return buildChartSpec('area', data, encoding, options);
}

/**
 * Create a donut chart spec.
 *
 * Convention: category maps to the color channel, value maps to y.
 * Donut charts have no x-axis.
 *
 * @param data - Array of data rows.
 * @param category - Category field (color channel, nominal).
 * @param value - Value field (y channel, quantitative).
 * @param options - Optional chrome, annotations, theme, etc.
 *                  Note: color option is ignored since category is used for color.
 */
export function donutChart(
  data: DataRow[],
  category: FieldRef,
  value: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const categoryChannel = resolveField(category, data);
  const valueChannel = resolveField(value, data);

  const encoding: Encoding = {
    y: valueChannel,
    color: categoryChannel,
  };
  if (options?.size && data) {
    encoding.size = resolveField(options.size, data);
  }

  return buildChartSpec({ type: 'arc', innerRadius: 40 } as MarkDef, data, encoding, options);
}

/**
 * Create a dot chart spec (strip plot / dot plot).
 *
 * @param data - Array of data rows.
 * @param x - X-axis field (quantitative or temporal).
 * @param y - Y-axis field (nominal/categorical grouping).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function dotChart(
  data: DataRow[],
  x: FieldRef,
  y: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const xChannel = resolveField(x, data);
  const yChannel = resolveField(y, data);
  const encoding = buildEncoding({ x: xChannel, y: yChannel }, options, data);
  return buildChartSpec('circle', data, encoding, options);
}

/**
 * Create a scatter chart spec.
 *
 * @param data - Array of data rows.
 * @param x - X-axis field (quantitative).
 * @param y - Y-axis field (quantitative).
 * @param options - Optional color, size, chrome, annotations, theme, etc.
 */
export function scatterChart(
  data: DataRow[],
  x: FieldRef,
  y: FieldRef,
  options?: ChartBuilderOptions,
): ChartSpec {
  const xChannel = resolveField(x, data);
  const yChannel = resolveField(y, data);
  const encoding = buildEncoding({ x: xChannel, y: yChannel }, options, data);
  return buildChartSpec('point', data, encoding, options);
}

/**
 * Create a data table spec.
 *
 * If no columns are specified, auto-generates column configs from the
 * keys of the first data row.
 *
 * @param data - Array of data rows.
 * @param options - Column definitions, chrome, pagination, search, etc.
 */
export function dataTable(data: DataRow[], options?: TableBuilderOptions): TableSpec {
  // Auto-generate columns from data keys if not provided
  let columns = options?.columns;
  if (!columns && data.length > 0) {
    columns = Object.keys(data[0]).map((key): ColumnConfig => {
      // Infer alignment from data type
      const fieldType = inferFieldType(data, key);
      const align = fieldType === 'quantitative' ? ('right' as const) : ('left' as const);

      return {
        key,
        label: key,
        align,
      };
    });
  }

  const spec: TableSpec = {
    type: 'table',
    data,
    columns: columns ?? [],
  };

  if (options?.rowKey) spec.rowKey = options.rowKey;
  if (options?.chrome) spec.chrome = options.chrome;
  if (options?.theme) spec.theme = options.theme;
  if (options?.darkMode) spec.darkMode = options.darkMode;
  if (options?.search !== undefined) spec.search = options.search;
  if (options?.pagination !== undefined) spec.pagination = options.pagination;
  if (options?.stickyFirstColumn !== undefined) spec.stickyFirstColumn = options.stickyFirstColumn;
  if (options?.compact !== undefined) spec.compact = options.compact;
  if (options?.responsive !== undefined) spec.responsive = options.responsive;

  return spec;
}

// ---------------------------------------------------------------------------
// Tile map builder
// ---------------------------------------------------------------------------

/** Options for the tileMap convenience builder. */
export interface TileMapBuilderOptions {
  /** Encoding channels (required when data is DataRow[]). */
  encoding?: TileMapEncoding;
  /** Sequential color palette name (quantitative mode only). */
  palette?: TileMapPalette;
  /** Custom category-to-color mapping. Forces categorical mode. */
  colors?: Record<string, string>;
  /** Editorial chrome. */
  chrome?: Chrome;
  /** Legend display configuration. */
  legend?: LegendConfig;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting. */
  darkMode?: DarkMode;
  /** Whether to show the watermark. */
  watermark?: boolean;
  /** Animation configuration. */
  animation?: AnimationSpec;
  /** d3-format string for value formatting. */
  valueFormat?: string;
}

/**
 * Build a TileMapSpec from a state-to-value record or tabular data.
 *
 * @example Record map (simplest):
 * ```ts
 * tileMap({ CA: 4.4, TX: 17.6, NY: 4.5 })
 * ```
 *
 * @example Tabular data with encoding:
 * ```ts
 * tileMap(data, { encoding: { state: { field: 'code' }, value: { field: 'rate' } } })
 * ```
 */
export function tileMap(
  data: Record<string, number | string | null> | DataRow[],
  options?: TileMapBuilderOptions,
): TileMapSpec {
  return {
    type: 'tilemap' as const,
    data,
    ...(options?.encoding && { encoding: options.encoding }),
    ...(options?.palette && { palette: options.palette }),
    ...(options?.colors && { colors: options.colors }),
    ...(options?.chrome && { chrome: options.chrome }),
    ...(options?.legend && { legend: options.legend }),
    ...(options?.theme && { theme: options.theme }),
    ...(options?.darkMode && { darkMode: options.darkMode }),
    ...(options?.watermark !== undefined && { watermark: options.watermark }),
    ...(options?.animation && { animation: options.animation }),
    ...(options?.valueFormat && { valueFormat: options.valueFormat }),
  };
}
