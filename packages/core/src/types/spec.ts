/**
 * Spec types: the user-facing input contract.
 *
 * These types define what a user (or Claude) writes to describe a visualization.
 * The engine validates, normalizes, and compiles specs into layout objects.
 *
 * Encoding vocabulary follows Vega-Lite conventions (field/type/aggregate)
 * with editorial extensions for chrome, annotations, responsive, and dark mode.
 */

// Re-import for use in LegendConfig (avoids circular by importing from sibling)
import type { LegendPosition } from '../responsive/breakpoints';
import type { ColumnConfig } from './table';

// ---------------------------------------------------------------------------
// Chart type union
// ---------------------------------------------------------------------------

/** Supported chart types. Graph is separate since it uses nodes/edges, not data + encoding. */
export type ChartType = 'line' | 'area' | 'bar' | 'column' | 'pie' | 'donut' | 'dot' | 'scatter';

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Data field type, following Vega-Lite conventions. */
export type FieldType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';

/** Aggregate function applied to a field before encoding. */
export type AggregateOp = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';

/** Axis configuration for an encoding channel. */
export interface AxisConfig {
  /** Axis label text. If omitted, the field name is used. */
  label?: string;
  /** Number format string (d3-format). e.g. ",.0f" for comma-separated integers. */
  format?: string;
  /** Override tick count. Engine picks a sensible default if omitted. */
  tickCount?: number;
  /** Whether to show gridlines for this axis. */
  grid?: boolean;
}

/** Scale configuration for an encoding channel. */
export interface ScaleConfig {
  /** Explicit domain override. Auto-derived from data if omitted. */
  domain?: [number, number] | string[];
  /** Scale type override. Usually inferred from field type. */
  type?: 'linear' | 'log' | 'time' | 'band' | 'point' | 'ordinal';
  /** Whether to nice-ify the domain for clean tick values. Defaults to true. */
  nice?: boolean;
  /** Whether the domain should include zero. Defaults to true for quantitative. */
  zero?: boolean;
}

/**
 * A single encoding channel mapping a data field to a visual property.
 *
 * Follows the Vega-Lite encoding model: field identifies the column,
 * type determines how the engine interprets values, aggregate applies
 * a transformation before encoding.
 */
export interface EncodingChannel {
  /** Data field name (column in the data array). */
  field: string;
  /**
   * How to interpret the field values.
   * - quantitative: continuous numbers (scale: linear)
   * - temporal: dates/times (scale: time)
   * - nominal: unordered categories (scale: ordinal)
   * - ordinal: ordered categories (scale: ordinal)
   */
  type: FieldType;
  /** Optional aggregate to apply before encoding. */
  aggregate?: AggregateOp;
  /** Axis configuration. Only relevant for x and y channels. */
  axis?: AxisConfig;
  /** Scale configuration. */
  scale?: ScaleConfig;
}

/**
 * Encoding object mapping visual channels to data fields.
 * Which channels are required depends on the chart type.
 * See ChartEncodingRules in encoding.ts for per-type requirements.
 */
export interface Encoding {
  /** Horizontal position channel. */
  x?: EncodingChannel;
  /** Vertical position channel. */
  y?: EncodingChannel;
  /** Color channel (series differentiation or heatmap). */
  color?: EncodingChannel;
  /** Size channel (bubble charts, dot plots). */
  size?: EncodingChannel;
  /** Detail channel (group without encoding to a visual property). */
  detail?: EncodingChannel;
}

// ---------------------------------------------------------------------------
// Graph-specific encoding
// ---------------------------------------------------------------------------

/** Encoding channel for graph nodes and edges. Same structure as EncodingChannel. */
export interface GraphEncodingChannel {
  /** Data field name on the node/edge object. */
  field: string;
  /** How to interpret the field values. */
  type?: FieldType;
}

/** Graph-specific encoding mapping visual properties to node/edge data fields. */
export interface GraphEncoding {
  /** Color mapping for nodes. */
  nodeColor?: GraphEncodingChannel;
  /** Size mapping for nodes. */
  nodeSize?: GraphEncodingChannel;
  /** Color mapping for edges. */
  edgeColor?: GraphEncodingChannel;
  /** Width mapping for edges. */
  edgeWidth?: GraphEncodingChannel;
  /** Label field for nodes. */
  nodeLabel?: GraphEncodingChannel;
}

/** Layout algorithm for graph visualization. */
export interface GraphLayoutConfig {
  /** Layout algorithm type. */
  type: 'force' | 'radial' | 'hierarchical';
  /** Optional clustering configuration. */
  clustering?: {
    /** Field to group nodes by for cluster forces. */
    field: string;
  };
  /** Charge strength for force layout. Negative values create repulsion. */
  chargeStrength?: number;
  /** Target distance between linked nodes. */
  linkDistance?: number;
}

// ---------------------------------------------------------------------------
// Chrome (editorial text elements)
// ---------------------------------------------------------------------------

/** Style overrides for a chrome text element. */
export interface ChromeTextStyle {
  /** Font size in pixels. */
  fontSize?: number;
  /** Font weight (400 = normal, 600 = semibold, 700 = bold). */
  fontWeight?: number;
  /** Font family override. */
  fontFamily?: string;
  /** Text color (CSS color string). */
  color?: string;
}

/** A chrome text element with optional style overrides. */
export interface ChromeText {
  /** The text content to display. */
  text: string;
  /** Optional style overrides. Theme defaults are used for any omitted property. */
  style?: ChromeTextStyle;
}

/**
 * Editorial chrome elements: title, subtitle, source attribution, byline, footer.
 * These are first-class structural elements, not string-only afterthoughts.
 * Each element can be a simple string or a ChromeText object with style overrides.
 */
export interface Chrome {
  /** Main title displayed above the visualization. */
  title?: string | ChromeText;
  /** Subtitle displayed below the title, typically providing context. */
  subtitle?: string | ChromeText;
  /** Data source attribution, displayed below the chart area. */
  source?: string | ChromeText;
  /** Author or organization byline. */
  byline?: string | ChromeText;
  /** Footer text, displayed at the very bottom. */
  footer?: string | ChromeText;
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

/** Pixel offset for fine-grained annotation positioning. */
export interface AnnotationOffset {
  /** Horizontal pixel offset. */
  dx?: number;
  /** Vertical pixel offset. */
  dy?: number;
}

/** Anchor direction for annotation label placement relative to the data point. */
export type AnnotationAnchor = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/** Base properties shared by all annotation types. */
interface AnnotationBase {
  /** Human-readable label for the annotation. */
  label?: string;
  /** Fill color for the annotation element. */
  fill?: string;
  /** Stroke color for the annotation element. */
  stroke?: string;
  /** Opacity from 0 to 1. */
  opacity?: number;
  /** Z-index for render ordering. Higher values render on top. */
  zIndex?: number;
}

/**
 * Text annotation positioned at a data coordinate.
 * Shows a callout label at a specific point in the chart.
 */
export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  /** X-axis data value or position. */
  x: string | number;
  /** Y-axis data value or position. */
  y: string | number;
  /** The annotation text. Required for text annotations. */
  text: string;
  /** Font size override. */
  fontSize?: number;
  /** Font weight override. */
  fontWeight?: number;
  /** Pixel offset from the computed position. */
  offset?: AnnotationOffset;
  /** Anchor direction for label placement relative to the data point. */
  anchor?: AnnotationAnchor;
  /**
   * Connector from label to anchor point.
   * - `true` (default): straight line
   * - `'curve'`: curved arrow with arrowhead
   * - `false`: no connector
   */
  connector?: boolean | 'curve';
  /** Background color behind the text. Useful for readability over chart lines. */
  background?: string;
}

/**
 * Range annotation highlighting a region of the chart.
 * Defined by x1/x2 (vertical band) or y1/y2 (horizontal band) or both (rectangle).
 */
export interface RangeAnnotation extends AnnotationBase {
  type: 'range';
  /** Start of the range on the x-axis. */
  x1?: string | number;
  /** End of the range on the x-axis. */
  x2?: string | number;
  /** Start of the range on the y-axis. */
  y1?: string | number;
  /** End of the range on the y-axis. */
  y2?: string | number;
  /** Pixel offset for the range label. */
  labelOffset?: AnnotationOffset;
  /** Anchor direction for the range label. */
  labelAnchor?: AnnotationAnchor;
}

/**
 * Reference line annotation: a horizontal or vertical line at a data value.
 * Useful for baselines (zero), targets, or thresholds.
 */
export interface RefLineAnnotation extends AnnotationBase {
  type: 'refline';
  /** X-axis value for a vertical reference line. */
  x?: string | number;
  /** Y-axis value for a horizontal reference line. */
  y?: string | number;
  /** Line style. */
  style?: 'solid' | 'dashed' | 'dotted';
  /** Line width in pixels. */
  strokeWidth?: number;
  /** Pixel offset for the reference line label. */
  labelOffset?: AnnotationOffset;
  /** Anchor direction for the reference line label. */
  labelAnchor?: AnnotationAnchor;
}

/** Discriminated union of all annotation types. */
export type Annotation = TextAnnotation | RangeAnnotation | RefLineAnnotation;

// ---------------------------------------------------------------------------
// Theme + Dark Mode
// ---------------------------------------------------------------------------

/**
 * Dark mode behavior.
 * - "auto": respect system preference (prefers-color-scheme)
 * - "force": always render in dark mode
 * - "off": always render in light mode (default)
 */
export type DarkMode = 'auto' | 'force' | 'off';

/**
 * User-facing theme configuration for overriding defaults.
 * All fields are optional. The engine deep-merges these onto the default theme.
 */
export interface ThemeConfig {
  /** Color palette overrides. */
  colors?: {
    /** Categorical palette for nominal data (array of CSS color strings). */
    categorical?: string[];
    /** Sequential palettes keyed by name. Each is an array of color stops. */
    sequential?: Record<string, string[]>;
    /** Diverging palettes keyed by name. Each is an array of color stops with a neutral midpoint. */
    diverging?: Record<string, string[]>;
    /** Background color. */
    background?: string;
    /** Default text color. */
    text?: string;
    /** Gridline color. */
    gridline?: string;
    /** Axis line and tick color. */
    axis?: string;
  };
  /** Font overrides. */
  fonts?: {
    /** Primary font family. */
    family?: string;
    /** Monospace font family (for tabular numbers). */
    mono?: string;
  };
  /** Spacing overrides in pixels. */
  spacing?: {
    /** Padding inside the chart container. */
    padding?: number;
    /** Gap between chrome elements (title to subtitle, etc.). */
    chromeGap?: number;
  };
  /** Border radius for chart container and tooltips. */
  borderRadius?: number;
}

// ---------------------------------------------------------------------------
// Label configuration
// ---------------------------------------------------------------------------

/**
 * Label density mode controlling how many data labels are shown.
 * - 'all': show every label, skip collision detection
 * - 'auto': show labels with collision detection (default)
 * - 'endpoints': show only first and last per series (useful for line charts)
 * - 'none': hide all labels (rely on tooltips and legend)
 */
export type LabelDensity = 'all' | 'auto' | 'endpoints' | 'none';

/** Label display configuration for chart data labels. */
export interface LabelConfig {
  /** How many labels to show. Defaults to 'auto'. */
  density?: LabelDensity;
  /** Number format override for label values (d3-format string, e.g. ",.0f"). */
  format?: string;
}

// ---------------------------------------------------------------------------
// Legend configuration
// ---------------------------------------------------------------------------

/** Legend display configuration. Overrides the responsive-default position. */
export interface LegendConfig {
  /** Override the legend position. If omitted, the responsive strategy decides. */
  position?: LegendPosition;
}

// ---------------------------------------------------------------------------
// Spec types (the top-level discriminated union)
// ---------------------------------------------------------------------------

/** Data row: a plain object with string keys. */
export type DataRow = Record<string, unknown>;

/**
 * Chart specification: the primary input for standard chart types.
 *
 * Combines a chart type with data, encoding channels, editorial chrome,
 * annotations, and configuration. The engine validates, normalizes, and
 * compiles this into a ChartLayout.
 */
export interface ChartSpec {
  /** The chart type to render. */
  type: ChartType;
  /** Data array: each element is a row with field values. */
  data: DataRow[];
  /** Encoding mapping data fields to visual channels. */
  encoding: Encoding;
  /** Editorial chrome (title, subtitle, source, etc.). */
  chrome?: Chrome;
  /** Data annotations (text callouts, highlighted ranges, reference lines). */
  annotations?: Annotation[];
  /** Label display configuration (density, format). */
  labels?: LabelConfig;
  /** Legend display configuration (position override). */
  legend?: LegendConfig;
  /** Whether the chart adapts to container width. Defaults to true. */
  responsive?: boolean;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
}

/**
 * Table specification: input for data table visualizations.
 *
 * Tables are a visualization type, not just an HTML grid. They support
 * heatmap coloring, inline sparklines, sorted columns, search, and pagination.
 */
export interface TableSpec {
  /** Discriminant: always "table". */
  type: 'table';
  /** Data array: each element is a row. */
  data: DataRow[];
  /** Column definitions controlling display, sorting, formatting, and mini-charts. */
  columns: ColumnConfig[];
  /** Optional field to use as a unique row identifier. */
  rowKey?: string;
  /** Editorial chrome. */
  chrome?: Chrome;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. */
  darkMode?: DarkMode;
  /** Enable client-side search/filter. */
  search?: boolean;
  /** Pagination configuration. True for defaults, or an object with pageSize. */
  pagination?: boolean | { pageSize: number };
  /** Whether to stick the first column during horizontal scroll. */
  stickyFirstColumn?: boolean;
  /** Compact mode: reduced padding and font sizes. */
  compact?: boolean;
  /** Whether the table adapts to container width. Defaults to true. */
  responsive?: boolean;
}

/** Graph node: must have an id, plus arbitrary data fields. */
export interface GraphNode {
  /** Unique identifier for the node. */
  id: string;
  /** Arbitrary data fields. */
  [key: string]: unknown;
}

/** Graph edge: connects two nodes by id. */
export interface GraphEdge {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Arbitrary data fields (weight, type, confidence, etc.). */
  [key: string]: unknown;
}

/**
 * Graph specification: input for network/relationship visualizations.
 *
 * Uses a nodes + edges data model instead of the flat data + encoding model
 * used by chart types. The graph type is defined here for forward compatibility
 * but rendering is deferred to a future phase.
 */
export interface GraphSpec {
  /** Discriminant: always "graph". */
  type: 'graph';
  /** Node array. Each node must have an id field. */
  nodes: GraphNode[];
  /** Edge array. Each edge connects source and target node ids. */
  edges: GraphEdge[];
  /** Graph-specific encoding mapping visual properties to node/edge fields. */
  encoding?: GraphEncoding;
  /** Layout algorithm configuration. */
  layout?: GraphLayoutConfig;
  /** Editorial chrome. */
  chrome?: Chrome;
  /** Annotations. */
  annotations?: Annotation[];
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. */
  darkMode?: DarkMode;
}

/**
 * Top-level visualization spec: discriminated union on the `type` field.
 *
 * This is the primary API contract. Users (and Claude) write VizSpec objects,
 * the engine validates and compiles them into layout objects for rendering.
 */
export type VizSpec = ChartSpec | TableSpec | GraphSpec;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** All valid chart type strings for runtime checking. */
export const CHART_TYPES: ReadonlySet<string> = new Set<ChartType>([
  'line',
  'area',
  'bar',
  'column',
  'pie',
  'donut',
  'dot',
  'scatter',
]);

/** Check if a spec is a ChartSpec (any standard chart type). */
export function isChartSpec(spec: VizSpec): spec is ChartSpec {
  return CHART_TYPES.has(spec.type);
}

/** Check if a spec is a TableSpec. */
export function isTableSpec(spec: VizSpec): spec is TableSpec {
  return spec.type === 'table';
}

/** Check if a spec is a GraphSpec. */
export function isGraphSpec(spec: VizSpec): spec is GraphSpec {
  return spec.type === 'graph';
}

// ---------------------------------------------------------------------------
// Annotation type guards
// ---------------------------------------------------------------------------

/** Check if an annotation is a TextAnnotation. */
export function isTextAnnotation(annotation: Annotation): annotation is TextAnnotation {
  return annotation.type === 'text';
}

/** Check if an annotation is a RangeAnnotation. */
export function isRangeAnnotation(annotation: Annotation): annotation is RangeAnnotation {
  return annotation.type === 'range';
}

/** Check if an annotation is a RefLineAnnotation. */
export function isRefLineAnnotation(annotation: Annotation): annotation is RefLineAnnotation {
  return annotation.type === 'refline';
}
