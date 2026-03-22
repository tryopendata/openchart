/**
 * Spec types: the user-facing input contract.
 *
 * These types define what a user (or Claude) writes to describe a visualization.
 * The engine validates, normalizes, and compiles specs into layout objects.
 *
 * Encoding vocabulary follows Vega-Lite conventions (field/type/aggregate/mark)
 * with editorial extensions for chrome, annotations, responsive, and dark mode.
 */

// Re-import for use in LegendConfig and overrides (avoids circular by importing from sibling)
import type { Breakpoint, LegendPosition } from '../responsive/breakpoints';
import type { ColumnConfig } from './table';

// ---------------------------------------------------------------------------
// Mark type union (Vega-Lite aligned)
// ---------------------------------------------------------------------------

/**
 * Supported mark types, following Vega-Lite conventions.
 *
 * Mapping from previous OpenChart chart types:
 * - 'bar' covers both horizontal bars (old 'bar') and vertical columns (old 'column')
 * - 'arc' covers both pie (old 'pie') and donut (old 'donut')
 * - 'point' replaces old 'scatter'
 * - 'circle' replaces old 'dot'
 * - 'line' and 'area' unchanged
 *
 * New mark types not in previous OpenChart:
 * - 'text': data-positioned text labels
 * - 'rule': reference lines as data marks
 * - 'tick': strip/rug plot marks
 * - 'rect': heatmaps and 2D binned plots
 */
export type MarkType =
  | 'bar'
  | 'line'
  | 'area'
  | 'point'
  | 'circle'
  | 'arc'
  | 'text'
  | 'rule'
  | 'tick'
  | 'rect';

/** @deprecated Use MarkType instead. Kept for internal migration references. */
export type ChartType = MarkType;

// ---------------------------------------------------------------------------
// Mark definition (Vega-Lite aligned)
// ---------------------------------------------------------------------------

/**
 * Mark definition object with visual properties.
 *
 * When `mark` is a string, it's shorthand for `{ type: markString }`.
 * When it's an object, it can include properties like interpolation,
 * point markers, orientation, and more.
 */
export interface MarkDef {
  /** The mark type. */
  type: MarkType;
  /**
   * Show point markers on line/area marks.
   * - true: filled circles at each data point
   * - 'transparent': invisible hover targets (legacy behavior)
   * - false: no point marks (default; uses voronoi overlay for tooltips)
   */
  point?: boolean | 'transparent';
  /**
   * Curve interpolation for line/area marks.
   * Maps to d3-shape curve factories.
   */
  interpolate?:
    | 'linear'
    | 'monotone'
    | 'step'
    | 'step-before'
    | 'step-after'
    | 'basis'
    | 'cardinal'
    | 'natural';
  /** Explicit orientation override for bar marks. */
  orient?: 'horizontal' | 'vertical';
  /** Inner radius for arc marks. >0 produces a donut, 0 or omitted produces a pie. */
  innerRadius?: number;
  /** Outer radius for arc marks. */
  outerRadius?: number;
  /** Corner radius for rect/bar marks. */
  cornerRadius?: number;
  /** Whether the mark is filled (vs stroked only). */
  filled?: boolean;
  /** Default opacity (0-1). */
  opacity?: number;
  /** Default fill color. */
  fill?: string;
  /** Default stroke color. */
  stroke?: string;
  /** Default stroke width. */
  strokeWidth?: number;
  /** Tooltip behavior. null disables tooltips. */
  tooltip?: boolean | null;
  /** Clip marks to the chart area. */
  clip?: boolean;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Data field type, following Vega-Lite conventions. */
export type FieldType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';

/** Aggregate function applied to a field before encoding. */
export type AggregateOp = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';

/** Axis configuration for an encoding channel. */
export interface AxisConfig {
  /** Axis title text. If omitted, the field name is used. */
  title?: string;
  /** Number format string (d3-format). e.g. ",.0f" for comma-separated integers. */
  format?: string;
  /** Override tick count. Engine picks a sensible default if omitted. */
  tickCount?: number;
  /** Whether to show gridlines for this axis. */
  grid?: boolean;
  /** Rotation angle in degrees for tick labels. Common values: -45, -90, 90. */
  labelAngle?: number;
  /** Axis orientation override. */
  orient?: 'top' | 'bottom' | 'left' | 'right';
  /** Explicit tick values. */
  values?: unknown[];
  /** How to handle overlapping labels. */
  labelOverlap?: boolean | 'parity' | 'greedy';
  /** Whether to flush labels to the axis edges. */
  labelFlush?: boolean;
  /** Whether to show the axis domain line. */
  domain?: boolean;
  /** Whether to show tick marks. */
  ticks?: boolean;
  /** Axis position offset in pixels. */
  offset?: number;
  /** Padding between axis title and axis. */
  titlePadding?: number;
  /** Padding between tick labels and axis. */
  labelPadding?: number;

  // --- Deprecated aliases (will be removed) ---
  /** @deprecated Use `title` instead. */
  label?: string;
  /** @deprecated Use `labelAngle` instead. */
  tickAngle?: number;
}

/** Scale configuration for an encoding channel. */
export interface ScaleConfig {
  /** Explicit domain override. Auto-derived from data if omitted. */
  domain?: [number, number] | string[];
  /** Scale type override. Usually inferred from field type. */
  type?: ScaleType;
  /** Whether to nice-ify the domain for clean tick values. Defaults to true. */
  nice?: boolean;
  /** Whether the domain should include zero. Defaults to true for quantitative. */
  zero?: boolean;
  /** When true and domain is set, filter out data rows with values outside the domain range. */
  clip?: boolean;
  /** Explicit range override. */
  range?: unknown[];
  /** Reverse the range direction. */
  reverse?: boolean;
  /** Clamp output to the range. */
  clamp?: boolean;
  /** Padding for band/point scales. */
  padding?: number;
  /** Inner padding for band scales. */
  paddingInner?: number;
  /** Outer padding for band scales. */
  paddingOuter?: number;
  /** Exponent for pow scales. */
  exponent?: number;
  /** Base for log scales (default 10). */
  base?: number;
  /** Constant for symlog scales. */
  constant?: number;
}

/** Scale type, following Vega-Lite conventions. */
export type ScaleType =
  | 'linear'
  | 'log'
  | 'pow'
  | 'sqrt'
  | 'symlog'
  | 'time'
  | 'utc'
  | 'ordinal'
  | 'band'
  | 'point'
  | 'quantile'
  | 'quantize'
  | 'threshold';

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
 * Which channels are required depends on the mark type.
 * See MARK_ENCODING_RULES in encoding.ts for per-type requirements.
 */
export interface Encoding {
  /** Horizontal position channel. */
  x?: EncodingChannel;
  /** Vertical position channel. */
  y?: EncodingChannel;
  /** Color channel (series differentiation or heatmap). Accepts conditional definitions. */
  color?: EncodingChannel | ConditionalValueDef;
  /** Size channel (bubble charts, dot plots). Accepts conditional definitions. */
  size?: EncodingChannel | ConditionalValueDef;
  /** Detail channel (group without encoding to a visual property). */
  detail?: EncodingChannel;
  /** Secondary x position (for ranges, error bars). */
  x2?: EncodingChannel;
  /** Secondary y position (for ranges, error bars). */
  y2?: EncodingChannel;
  /** Data-driven opacity (0-1). Accepts conditional definitions. */
  opacity?: EncodingChannel | ConditionalValueDef;
  /** Point shape encoding (circle, square, diamond, triangle-up, etc.). */
  shape?: EncodingChannel;
  /** Data-driven stroke dash patterns. */
  strokeDash?: EncodingChannel;
  /** Rotation angle encoding. */
  angle?: EncodingChannel;
  /** Text content for text marks. */
  text?: EncodingChannel;
  /** Tooltip field(s). Can be a single channel or array. */
  tooltip?: EncodingChannel | EncodingChannel[];
  /** Hyperlink encoding. */
  href?: EncodingChannel;
  /** Stacking/drawing order. */
  order?: EncodingChannel;
  /** Angular position for arc marks. */
  theta?: EncodingChannel;
  /** Radial position for arc marks. */
  radius?: EncodingChannel;
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
  /** Style mapping for edges (solid, dashed, dotted). */
  edgeStyle?: GraphEncodingChannel;
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
  /** Extra px added to node radius for collision detection (default 2). */
  collisionPadding?: number;
  /** Link force strength override. */
  linkStrength?: number;
  /** Whether to apply center force (default true). */
  centerForce?: boolean;
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
  /** Pixel offset for fine-tuning position. */
  offset?: AnnotationOffset;
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
  /** Per-endpoint offsets for the connector line. Allows fine-tuning where the connector starts and ends. */
  connectorOffset?: {
    /** Offset for the label-end of the connector. */
    from?: AnnotationOffset;
    /** Offset for the data-point-end of the connector. */
    to?: AnnotationOffset;
  };
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
  /**
   * Color palette overrides.
   * Pass a flat string[] as shorthand for categorical colors,
   * or an object for full control over categorical, sequential, diverging, etc.
   */
  colors?:
    | string[]
    | {
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
  /** Per-series pixel offsets for fine-tuning label positions, keyed by series name. */
  offsets?: Record<string, AnnotationOffset>;
}

// ---------------------------------------------------------------------------
// Legend configuration
// ---------------------------------------------------------------------------

/** Legend display configuration. Overrides the responsive-default position. */
export interface LegendConfig {
  /** Override the legend position. If omitted, the responsive strategy decides. */
  position?: LegendPosition;
  /** Pixel offset for fine-tuning legend position. */
  offset?: AnnotationOffset;
  /** Whether to show the legend. Defaults to true. Set to false to hide. */
  show?: boolean;
}

// ---------------------------------------------------------------------------
// Spec types (the top-level discriminated union)
// ---------------------------------------------------------------------------

/** Data row: a plain object with string keys. */
export type DataRow = Record<string, unknown>;

/** Per-series visual style overrides for line/area charts. */
export interface SeriesStyle {
  /** Line dash style. Defaults to 'solid'. */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Whether to show data point markers. Defaults to true. */
  showPoints?: boolean;
  /** Stroke width override. */
  strokeWidth?: number;
  /** Opacity override (0-1). */
  opacity?: number;
}

/**
 * Breakpoint-conditional overrides for chart specs.
 *
 * Allows specifying different chrome, labels, legend, or annotations
 * per breakpoint. Merged shallowly into the base spec at compile time
 * when the container matches the breakpoint.
 */
export interface ChartSpecOverride {
  /** Override editorial chrome at this breakpoint. */
  chrome?: Chrome;
  /** Override label configuration at this breakpoint. */
  labels?: LabelConfig;
  /** Override legend configuration at this breakpoint. */
  legend?: LegendConfig;
  /** Override annotations at this breakpoint. */
  annotations?: Annotation[];
}

/**
 * Chart specification: the primary input for standard chart types.
 *
 * Uses the Vega-Lite `mark` property instead of `type` to specify
 * the visualization mark. The mark can be a string shorthand or an
 * object with additional properties (interpolation, point markers, etc.).
 */
export interface ChartSpec {
  /**
   * The mark type to render.
   * String shorthand: `mark: 'bar'`
   * Object with properties: `mark: { type: 'line', interpolate: 'step' }`
   */
  mark: MarkType | MarkDef;
  /** Data array: each element is a row with field values. */
  data: DataRow[];
  /** Data transforms applied in order before encoding (filter, bin, calculate, timeUnit). */
  transform?: Transform[];
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
  /** Series names to hide from rendering. Hidden series remain in the legend but are visually dimmed. */
  hiddenSeries?: string[];
  /** Per-series visual overrides, keyed by series name (the color field value). */
  seriesStyles?: Record<string, SeriesStyle>;
  /**
   * Breakpoint-conditional overrides. Keys are breakpoint names.
   * At compile time, if the container matches a breakpoint, its overrides
   * are shallow-merged into the spec before layout computation.
   */
  overrides?: Partial<Record<Breakpoint, ChartSpecOverride>>;
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

/** Per-node visual overrides, keyed by node id. */
export interface NodeOverride {
  /** Override fill color. */
  fill?: string;
  /** Override radius. */
  radius?: number;
  /** Override stroke width. */
  strokeWidth?: number;
  /** Override stroke color. */
  stroke?: string;
  /** Force label to always show regardless of zoom/priority. */
  alwaysShowLabel?: boolean;
}

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
  /** Per-node visual overrides, keyed by node id. */
  nodeOverrides?: Record<string, NodeOverride>;
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
 * Top-level visualization spec: union discriminated by structural shape.
 *
 * - ChartSpec: has `mark` field (no `type`, no `layer`)
 * - LayerSpec: has `layer` field (future)
 * - TableSpec: has `type: 'table'`
 * - GraphSpec: has `type: 'graph'`
 */
export type VizSpec = ChartSpec | TableSpec | GraphSpec;

/** Chart spec without runtime data, for persistence/storage. */
export type ChartSpecWithoutData = Omit<ChartSpec, 'data'>;
/** Table spec without runtime data and columns, for persistence/storage. Columns can be auto-generated via dataTable(). */
export type TableSpecWithoutData = Omit<TableSpec, 'data' | 'columns'>;
/** Graph spec without runtime data, for persistence/storage. */
export type GraphSpecWithoutData = Omit<GraphSpec, 'nodes' | 'edges'>;
/** Union of data-stripped spec types for persistence/storage. */
export type StoredVizSpec = ChartSpecWithoutData | TableSpecWithoutData | GraphSpecWithoutData;

// ---------------------------------------------------------------------------
// Transforms (Vega-Lite aligned)
// ---------------------------------------------------------------------------

/** Logical AND combinator for filter predicates. */
export interface LogicalAnd<T> {
  and: T[];
}

/** Logical OR combinator for filter predicates. */
export interface LogicalOr<T> {
  or: T[];
}

/** Logical NOT combinator for filter predicates. */
export interface LogicalNot<T> {
  not: T;
}

/** A predicate that tests a field value against a condition. */
export interface FieldPredicate {
  /** Data field to test. */
  field: string;
  /** Equals comparison. */
  equal?: unknown;
  /** Less than. */
  lt?: number;
  /** Less than or equal. */
  lte?: number;
  /** Greater than. */
  gt?: number;
  /** Greater than or equal. */
  gte?: number;
  /** Inclusive range [min, max]. */
  range?: [number, number];
  /** Value is one of these. */
  oneOf?: unknown[];
  /** Whether the value is valid (non-null, non-undefined, non-NaN). */
  valid?: boolean;
}

/**
 * A filter predicate: a field predicate or logical combination of predicates.
 */
export type FilterPredicate =
  | FieldPredicate
  | LogicalAnd<FilterPredicate>
  | LogicalOr<FilterPredicate>
  | LogicalNot<FilterPredicate>;

/** Parameters for binning a field. */
export interface BinParams {
  /** Maximum number of bins. */
  maxbins?: number;
  /** Exact step size between bins. */
  step?: number;
  /** Whether to nice-ify bin boundaries. */
  nice?: boolean;
  /** Explicit extent [min, max] for binning. */
  extent?: [number, number];
}

/** Expression for calculate transforms. */
export interface CalculateExpression {
  /** Arithmetic operation to apply. */
  op: '+' | '-' | '*' | '/' | 'abs' | 'round' | 'floor' | 'ceil' | 'log' | 'sqrt';
  /** Primary field to operate on. */
  field: string;
  /** Secondary field for binary operations (+, -, *, /). */
  field2?: string;
  /** Constant value for binary operations when field2 is not provided. */
  value?: number;
}

/**
 * Time unit granularity for temporal field transformations.
 * Follows Vega-Lite conventions.
 */
export type TimeUnit =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'dayofyear'
  | 'date'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds'
  | 'yearmonth'
  | 'yearmonthdate'
  | 'monthdate'
  | 'hoursminutes';

/** Filter transform: removes rows that don't match the predicate. */
export interface FilterTransform {
  filter: FilterPredicate;
}

/** Bin transform: adds binned field(s) to each row. */
export interface BinTransform {
  bin: true | BinParams;
  field: string;
  as: string | [string, string];
}

/** Calculate transform: adds a computed field to each row. */
export interface CalculateTransform {
  calculate: CalculateExpression;
  as: string;
}

/** Time unit transform: extracts a time unit from a temporal field. */
export interface TimeUnitTransform {
  timeUnit: TimeUnit;
  field: string;
  as: string;
}

/** Discriminated union of all transform types. */
export type Transform = FilterTransform | BinTransform | CalculateTransform | TimeUnitTransform;

// ---------------------------------------------------------------------------
// Conditional encoding (Vega-Lite aligned)
// ---------------------------------------------------------------------------

/**
 * A single condition with a test predicate and resulting value/field.
 * When the test passes for a datum, the condition's value/field is used.
 */
export interface Condition {
  /** Predicate to test against each datum. */
  test: FilterPredicate;
  /** Static value to use when the condition is true. */
  value?: unknown;
  /** Data field to use when the condition is true. */
  field?: string;
  /** Field type for the conditional field. */
  type?: FieldType;
}

/**
 * A conditional value definition for an encoding channel.
 * Evaluates conditions in order, falling back to the default value.
 */
export interface ConditionalValueDef {
  /** One or more conditions to evaluate. */
  condition: Condition | Condition[];
  /** Default value when no condition matches. */
  value?: unknown;
}

/**
 * Check if a channel definition is a regular EncodingChannel (has 'field' at top level).
 * Use this to narrow `EncodingChannel | ConditionalValueDef` in encoding channels
 * that support conditional encoding (color, size, opacity).
 */
export function isEncodingChannel(
  def: EncodingChannel | ConditionalValueDef | undefined,
): def is EncodingChannel {
  if (!def) return false;
  return 'field' in def && !('condition' in def);
}

/**
 * Check if a channel definition is a ConditionalValueDef.
 */
export function isConditionalDef(
  def: EncodingChannel | ConditionalValueDef | undefined,
): def is ConditionalValueDef {
  if (!def) return false;
  return 'condition' in def;
}

// ---------------------------------------------------------------------------
// Mark type helpers
// ---------------------------------------------------------------------------

/** All valid mark type strings for runtime checking. */
export const MARK_TYPES: ReadonlySet<string> = new Set<MarkType>([
  'bar',
  'line',
  'area',
  'point',
  'circle',
  'arc',
  'text',
  'rule',
  'tick',
  'rect',
]);

/** @deprecated Use MARK_TYPES instead. */
export const CHART_TYPES = MARK_TYPES;

/**
 * Extract the mark type string from a mark field (string or MarkDef).
 */
export function resolveMarkType(mark: MarkType | MarkDef): MarkType {
  return typeof mark === 'string' ? mark : mark.type;
}

/**
 * Extract the full MarkDef from a mark field, filling in defaults for string shorthand.
 */
export function resolveMarkDef(mark: MarkType | MarkDef): MarkDef {
  return typeof mark === 'string' ? { type: mark } : mark;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Check if a spec is a ChartSpec (has `mark` field, not a layer/table/graph). */
export function isChartSpec(spec: VizSpec | Record<string, unknown>): spec is ChartSpec {
  return 'mark' in spec && !('layer' in spec);
}

/** Check if a spec is a TableSpec. */
export function isTableSpec(spec: VizSpec | Record<string, unknown>): spec is TableSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'table';
}

/** Check if a spec is a GraphSpec. */
export function isGraphSpec(spec: VizSpec | Record<string, unknown>): spec is GraphSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'graph';
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

// ---------------------------------------------------------------------------
// Display name mapping for accessibility
// ---------------------------------------------------------------------------

/** Human-readable display names for mark types (used in alt text, error messages). */
export const MARK_DISPLAY_NAMES: Record<string, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  area: 'Area chart',
  point: 'Scatter plot',
  circle: 'Dot plot',
  arc: 'Pie chart', // overridden to "Donut chart" when innerRadius > 0
  text: 'Text chart',
  rule: 'Rule chart',
  tick: 'Tick plot',
  rect: 'Heatmap',
};
