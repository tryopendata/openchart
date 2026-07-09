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
import type { SeriesStrategy, TokenValue } from './theme';

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
  | 'rect'
  | 'lollipop';

/** @deprecated Use MarkType instead. Kept for internal migration references. */
export type ChartType = MarkType;

// ---------------------------------------------------------------------------
// Gradient definitions (Vega-aligned)
// ---------------------------------------------------------------------------

/** A single color stop in a gradient definition. */
export interface GradientStop {
  /** Position along the gradient, 0 to 1. */
  offset: number;
  /** CSS color string at this stop. */
  color: string;
  /** Opacity at this stop, 0 to 1. Maps to SVG stop-opacity. */
  opacity?: number;
}

/**
 * Linear gradient definition.
 * Coordinates are in [0,1] normalized space relative to the mark's bounding box
 * (maps to SVG gradientUnits="objectBoundingBox").
 */
export interface LinearGradient {
  gradient: 'linear';
  /** Color stops from start to end. */
  stops: GradientStop[];
  /** Start x coordinate (0-1). Default: 0. */
  x1?: number;
  /** Start y coordinate (0-1). Default: 0. */
  y1?: number;
  /** End x coordinate (0-1). Default: 0. */
  x2?: number;
  /** End y coordinate (0-1). Default: 1 (top-to-bottom). */
  y2?: number;
}

/**
 * Radial gradient definition.
 * Coordinates are in [0,1] normalized space relative to the mark's bounding box.
 */
export interface RadialGradient {
  gradient: 'radial';
  /** Color stops from inner to outer. */
  stops: GradientStop[];
  /** Inner circle center x (0-1). Default: 0.5. */
  x1?: number;
  /** Inner circle center y (0-1). Default: 0.5. */
  y1?: number;
  /** Inner circle radius (0-1). Default: 0. */
  r1?: number;
  /** Outer circle center x (0-1). Default: 0.5. */
  x2?: number;
  /** Outer circle center y (0-1). Default: 0.5. */
  y2?: number;
  /** Outer circle radius (0-1). Default: 0.5. */
  r2?: number;
}

/** A gradient definition, either linear or radial. */
export type GradientDef = LinearGradient | RadialGradient;

/** Type guard: check if a value is a GradientDef object. */
export function isGradientDef(value: unknown): value is GradientDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'gradient' in value &&
    'stops' in value &&
    ((value as GradientDef).gradient === 'linear' || (value as GradientDef).gradient === 'radial')
  );
}

/**
 * Extract a single representative color from a fill value.
 * Returns the fill directly if it's a string, or the last stop color
 * if it's a gradient. Used by tooltips, labels, legends, and voronoi
 * overlays that need a flat color.
 */
export function getRepresentativeColor(fill: string | GradientDef): string {
  if (typeof fill === 'string') return fill;
  const stops = fill.stops;
  return stops.length > 0 ? stops[stops.length - 1].color : '#000000';
}

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
   * - 'endpoints': show only first and last point per series (hollow dots)
   * - 'last' / 'first': show only the last (or first) point — filled dot,
   *   no white halo. Useful for highlighting the latest reading on a line
   *   chart and the default for sparkline mode.
   * - false: no point marks (default; uses voronoi overlay for tooltips)
   */
  point?: boolean | 'transparent' | 'endpoints' | 'last' | 'first';
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
  /** Corner radius for rect/bar marks. 'pill' sets rx to half the bar thickness. */
  cornerRadius?: number | 'pill';
  /** Fixed bar thickness in pixels for bar/column marks. When set, bars are this height (horizontal) or width (vertical), centered within the band. */
  size?: number;
  /** Whether the mark is filled (vs stroked only). */
  filled?: boolean;
  /** Default opacity (0-1). */
  opacity?: number;
  /** Default fill color or gradient. */
  fill?: string | GradientDef;
  /** Default stroke color. */
  stroke?: string;
  /** Default stroke width. */
  strokeWidth?: number;
  /** Tooltip behavior. null disables tooltips. */
  tooltip?: boolean | null;
  /** Clip marks to the chart area. */
  clip?: boolean;
  /**
   * Overlay a least-squares regression line on scatter (point) marks.
   * Defaults to true. Set `mark: { type: 'point', trendline: false }` to
   * suppress it when the chart already carries its own reference line (e.g. a
   * manual x=y diagonal in a separate layer), which would otherwise produce
   * two competing diagonals.
   */
  trendline?: boolean;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Data field type, following Vega-Lite conventions. */
export type FieldType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';

/** Aggregate function applied to a field before encoding. */
export type AggregateOp =
  | 'count'
  | 'sum'
  | 'mean'
  | 'median'
  | 'min'
  | 'max'
  | 'variance'
  | 'stdev'
  | 'distinct'
  | 'q1'
  | 'q3';

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
  /** Color override for axis tick labels and title. Useful in dual-axis charts to match axis color to its series. */
  labelColor?: string;
  /** Literal string appended to every formatted tick label. e.g. "B" gives "$4.5B" when format is "$,.1~f". */
  labelSuffix?: string;
  /** Secondary data field to display alongside each tick label. Renders in lighter weight/color. Only effective on categorical y-axis labels (horizontal bar charts). */
  labelField?: string;
  /**
   * Where tick labels render relative to the chart area. Editorial line/area
   * y-axes default to `'inline'`: labels sit above their gridlines at the
   * chart's left edge, with no left gutter, axis line, or tick marks. Other
   * axis types default to `'gutter'` (the classic placement outside the chart
   * area).
   */
  tickPosition?: 'inline' | 'gutter';
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
 *
 * @template TData - The shape of a data row. When `ChartSpec<TData>` is used
 * with a typed data array, `field` is constrained to `keyof TData & string`,
 * giving IDE autocomplete and compile-time typo detection. Defaults to `DataRow`
 * which degrades to plain `string` (no constraint), keeping untyped specs working.
 */
export interface EncodingChannel<TData extends DataRow = DataRow> {
  /**
   * Data field name (column in the data array).
   *
   * When using `ChartSpec<TData>` with a typed data array, this is constrained
   * to the actual column names of `TData`. Typos fail at compile time and IDEs
   * autocomplete your column names.
   */
  field: keyof TData & string;
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
  /** Axis configuration. Set to `false` to suppress axis entirely (no space reserved). */
  axis?: AxisConfig | false;
  /** Scale configuration. */
  scale?: ScaleConfig;
  /**
   * Stacking behavior for quantitative channels (Vega-Lite aligned).
   *
   * Vega-Lite accepts `'zero' | 'normalize' | 'center' | null`. OpenChart adds
   * `true` (sugar for `'zero'`) and `false` (sugar for `null`) so callers can
   * write `stack: true` / `stack: false` without learning the string forms.
   * The string forms are still the canonical input — the boolean shorthand is
   * normalized to the matching string before reaching layout.
   *
   * - undefined: chart-type default (see below)
   * - true | 'zero': stack from zero baseline
   * - 'normalize': stack and normalize to fraction of total (0-1 per category)
   * - 'center': center stacks around zero (streamgraph style)
   * - null | false: no stacking -- renders overlap (area) or grouped/dodged (bar)
   *
   * **Defaults differ by chart type:**
   * - **Bar/Column**: defaults to grouped (side-by-side). Use `stack: 'zero'` (or `true`) for stacked bars.
   * - **Area**: defaults to overlap (v6 breaking change). Use `stack: 'zero'` (or `true`)
   *   to opt into stacked areas. Each overlapping series renders as a translucent
   *   gradient band anchored at the y-domain baseline.
   * - **Line**: stacking is not applied (lines always overlap).
   *
   * @example
   * // Stacked horizontal bars (opt-in; default is grouped):
   * "x": { "field": "revenue", "type": "quantitative", "stack": "zero" }
   *
   * @example
   * // Stacked area (opt-in; default is overlap):
   * "y": { "field": "value", "type": "quantitative", "stack": "zero" }
   */
  stack?: boolean | 'zero' | 'normalize' | 'center' | null;
  /**
   * Encoding-level bin shorthand (Vega-Lite aligned).
   * When set, auto-generates a BinTransform during normalization and updates
   * the field reference to the binned output (convention: `bin_<fieldName>`).
   * - true: bin with default params
   * - BinParams: bin with custom params (maxbins, step, etc.)
   */
  bin?: boolean | BinParams;
  /**
   * Encoding-level timeUnit shorthand (Vega-Lite aligned).
   * When set, auto-generates a TimeUnitTransform during normalization and
   * updates the field reference to the output (convention: `<timeUnit>_<fieldName>`).
   */
  timeUnit?: TimeUnit;
  /**
   * Sort order for categorical (nominal/ordinal) scale domains (Vega-Lite aligned).
   * - 'ascending': sort domain values ascending (default VL behavior)
   * - 'descending': sort domain values descending
   * - null: use data order (no sorting)
   * - undefined: ascending (VL default)
   */
  sort?: 'ascending' | 'descending' | null;
  /**
   * Display title override (Vega-Lite aligned).
   * Used as the label in tooltips instead of the raw field name.
   * Also usable for axis titles, but `axis.title` takes precedence there.
   */
  title?: string;
  /**
   * Format string for values (Vega-Lite aligned).
   * For quantitative fields: d3-format string (e.g. ",.0f", "$,.2f").
   * For temporal fields: d3-time-format string (e.g. "%Y", "%b %d").
   * Used in tooltips; `axis.format` takes precedence for axis tick labels.
   */
  format?: string;
  /**
   * Emphasis highlight for the color channel. Names one or more series values
   * to visually emphasize; all other series are muted to a neutral gray.
   *
   * Only meaningful on the `color` encoding channel. On other channels this
   * property is ignored.
   *
   * @example
   * encoding: {
   *   color: { field: 'region', type: 'nominal', highlight: 'West' }
   * }
   */
  highlight?: string | string[];
}

/**
 * Facet channel definition: partitions data into small-multiple panels.
 *
 * Unlike positional channels, facet only needs a field, a categorical type,
 * and optional layout hints (columns, sort). It does not carry scale/axis
 * config because it produces a grid, not a visual encoding.
 */
export interface FacetChannel<TData extends DataRow = DataRow> {
  /** Data field to partition by. Each unique value produces one panel. */
  field: keyof TData & string;
  /** Must be categorical. */
  type: 'nominal' | 'ordinal';
  /** Number of columns in the wrap grid. Auto-computed when omitted. */
  columns?: number;
  /** Sort order for panel values. Default ascending. */
  sort?: 'ascending' | 'descending' | null;
}

/**
 * Encoding object mapping visual channels to data fields.
 * Which channels are required depends on the mark type — see the per-mark
 * encoding interfaces (ArcEncoding, LineEncoding, etc.) and MARK_ENCODING_RULES
 * in encoding.ts for the full requirements table.
 *
 * @template TData - Propagated from ChartSpec<TData>. Constrains `field` in
 * every channel to `keyof TData & string` when a typed data row is provided.
 */
export interface Encoding<TData extends DataRow = DataRow> {
  /**
   * Horizontal position channel. Required for: bar, line, area, point, tick, rect, lollipop.
   * Maps a field to the x-axis. Use `type: 'temporal'` for dates, `'nominal'` for categories,
   * `'quantitative'` for numbers.
   */
  x?: EncodingChannel<TData>;
  /**
   * Vertical position channel. Required for: bar, line, area, point, tick, rect, arc, lollipop.
   * For arc marks, this is the value field (slice size). For all others it's the y-axis position.
   */
  y?: EncodingChannel<TData>;
  /**
   * Color channel. Required for arc marks (determines pie/donut slice coloring).
   * Optional for all other marks -- used for series differentiation on multi-series charts,
   * or heatmap intensity. Accepts a conditional definition to apply colors based on data predicates.
   */
  color?: EncodingChannel<TData> | ConditionalValueDef<TData>;
  /**
   * Size channel. Used by point/bubble charts to scale dot area by a quantitative field.
   * Accepts a conditional definition to vary size based on data predicates.
   */
  size?: EncodingChannel<TData> | ConditionalValueDef<TData>;
  /**
   * Detail channel. Groups data into multiple series without mapping to a visual property.
   * Useful when you want separate lines per category but don't need the color to differ.
   */
  detail?: EncodingChannel<TData>;
  /**
   * Secondary x position. Used with `x` to define a horizontal span (rect marks, error bars).
   * Both `x` and `x2` must be quantitative.
   */
  x2?: EncodingChannel<TData>;
  /**
   * Secondary y position. Used with `y` to define a vertical span (rect marks, error bands).
   * Both `y` and `y2` must be quantitative.
   */
  y2?: EncodingChannel<TData>;
  /**
   * Data-driven opacity (0-1 range). Accepts a conditional definition to vary opacity
   * based on data predicates (e.g., highlight selected points).
   */
  opacity?: EncodingChannel<TData> | ConditionalValueDef<TData>;
  /**
   * Point shape encoding. Valid values: 'circle', 'square', 'diamond', 'triangle-up',
   * 'triangle-down', 'cross'. Used on point/scatter marks to differentiate series by shape.
   */
  shape?: EncodingChannel<TData>;
  /**
   * Stroke dash pattern encoding. Maps a nominal field to different dash patterns
   * on line marks. Useful when color alone doesn't distinguish series well.
   */
  strokeDash?: EncodingChannel<TData>;
  /** Rotation angle encoding for point marks. Maps a quantitative field to 0-360 degrees. */
  angle?: EncodingChannel<TData>;
  /**
   * Text content for `text` marks. Required when mark is `'text'`.
   * Not meaningful for other mark types.
   */
  text?: EncodingChannel<TData>;
  /**
   * Tooltip field(s). Shown on hover. Can be a single channel or an array for
   * multi-field tooltips. Independent of the x/y/color encoding.
   */
  tooltip?: EncodingChannel<TData> | EncodingChannel<TData>[];
  /** Hyperlink encoding. Maps a field containing URLs to clickable marks. */
  href?: EncodingChannel<TData>;
  /**
   * Drawing order. Controls z-order and stacking sort order for bar/area marks.
   * Lower values are drawn first (behind higher values).
   */
  order?: EncodingChannel<TData>;
  /**
   * Angular position for arc marks (pie/donut).
   * Optional -- defaults to the `y` channel value when omitted.
   * Not used by any other mark type.
   */
  theta?: EncodingChannel<TData>;
  /**
   * Radial distance from center for arc marks.
   * Optional -- only meaningful on donut charts (controls inner radius boundary).
   * Not used by any other mark type.
   */
  radius?: EncodingChannel<TData>;
  /**
   * Facet channel: partitions data into a grid of small-multiple panels.
   * Each unique value of the facet field produces one panel. Panels share
   * scales by default; use `resolve: { scale: { y: 'independent' } }` for
   * per-panel axes.
   */
  facet?: FacetChannel<TData>;
}

// ---------------------------------------------------------------------------
// Graph-specific encoding
// ---------------------------------------------------------------------------

/** Encoding channel for graph nodes and edges. */
export interface GraphEncodingChannel {
  /** Data field name on the node/edge object. */
  field: string;
  /** How to interpret the field values. */
  type?: FieldType;
  /** Scale configuration. Auto-derived from data if omitted. */
  scale?: ScaleConfig;
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
 * Editorial chrome elements: eyebrow, title, subtitle, source attribution, byline, footer.
 * These are first-class structural elements, not string-only afterthoughts.
 * Each element can be a simple string or a ChromeText object with style overrides.
 */
export interface Chrome {
  /**
   * Editorial kicker/category label rendered above the title. Typically
   * uppercase, tracked, and tinted with the accent color (e.g.
   * "Equities · Single Ticker"). Term follows IBM Carbon and Atlassian
   * Design System conventions; not part of Vega-Lite's title model.
   */
  eyebrow?: string | ChromeText;
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
  /**
   * Right-anchored brand block on the footer row, paired with a small accent
   * dot to its left. Visually balances the source/byline left-anchored text.
   * When set, suppresses the default `tryOpenData.ai` watermark for this chart.
   */
  brand?: string | ChromeText;
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

/** Style overrides for the dot marker drawn at the connector's data-point endpoint. */
export interface AnnotationDot {
  /** Circle radius in pixels. Default 5. */
  radius?: number;
  /** Fill color. Defaults to theme background for an "open ring" look. */
  fill?: string;
  /** Stroke color. Defaults to theme text color. */
  stroke?: string;
  /** Stroke width in pixels. Default 2. */
  strokeWidth?: number;
}

/** Base properties shared by all annotation types. */
interface AnnotationBase {
  /** Stable identifier for selection and edit callbacks. When provided, edit events include this ID for reliable element matching. */
  id?: string;
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
  /** When false, the annotation is always shown even at compact breakpoints. Default true. */
  responsive?: boolean;
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
  /** Thinning priority (lower = kept longer at narrow widths). When omitted, spec order is used. */
  priority?: number;
  /**
   * Optional muted second-tone text rendered below the primary `text`.
   * Used for supporting context (e.g. methodology, source). Newlines in
   * `text` still produce multi-line primary; subtitle is a separate block.
   */
  subtitle?: string;
  /**
   * Optional dot marker drawn at the connector's data-point endpoint.
   * `true` enables the default open-ring style. Pass an object to override
   * radius, fill, stroke, or strokeWidth.
   */
  dot?: boolean | AnnotationDot;
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
   * - `'straight'`: straight line (alias of `true`)
   * - `'curve'`: curved arrow with arrowhead
   * - `'drop-line'`: vertical line through the data point's x; label sits beside the line and auto-flips to the opposite side if it would overflow the chart area
   * - `false`: no connector
   */
  connector?: boolean | 'straight' | 'curve' | 'drop-line';
  /** Per-endpoint offsets for the connector line. Allows fine-tuning where the connector starts and ends. */
  connectorOffset?: {
    /** Offset for the label-end of the connector. */
    from?: AnnotationOffset;
    /** Offset for the data-point-end of the connector. */
    to?: AnnotationOffset;
  };
  /** Background color behind the text. Useful for readability over chart lines. */
  background?: string;
  /** Whether to show the paint-order stroke halo behind text. Default true. Set false for white text on colored backgrounds. */
  halo?: boolean;
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
  /**
   * For band/point (ordinal) x or y scales, whether the range extends from the
   * data point's center out to the band/step edge. Default `true`: a range on a
   * bar chart spans full columns, and a range on a line chart extends half a step
   * past the first/last point so the band reaches the plot edge. Set `false` to
   * anchor the range exactly at the data point centers instead — useful when you
   * want the band inset from the axis (e.g. starting at the first data point
   * rather than flush against the y-axis guide). No effect on linear/time scales.
   */
  extendToEdges?: boolean;
  /** Pixel offset for the range label. */
  labelOffset?: AnnotationOffset;
  /** Anchor direction for the range label. */
  labelAnchor?: AnnotationAnchor;
  /** Font size override for the range label (px). Default: 11. */
  fontSize?: number;
  /** Font weight override for the range label. Default: 500. */
  fontWeight?: number;
}

/**
 * Reference line annotation: a horizontal or vertical line at a data value.
 * Useful for baselines (zero), targets, or thresholds.
 */
export interface RefLineAnnotation extends AnnotationBase {
  type: 'refline' | 'rule';
  /** X-axis value for a vertical reference line. */
  x?: string | number;
  /** Y-axis value for a horizontal reference line. */
  y?: string | number;
  /** Line style. */
  style?: 'solid' | 'dashed' | 'dotted';
  /** Raw SVG dash pattern override, e.g. [4, 4]. Takes precedence over style. */
  strokeDash?: number[];
  /** Line width in pixels. */
  strokeWidth?: number;
  /** Pixel offset for the reference line label. */
  labelOffset?: AnnotationOffset;
  /** Anchor direction for the reference line label. */
  labelAnchor?: AnnotationAnchor;
  /** Label font size in pixels. Default: 11. */
  fontSize?: number;
  /** Label font weight. Default: 400. */
  fontWeight?: number;
}

/** Discriminated union of all annotation types. */
export type Annotation = TextAnnotation | RangeAnnotation | RefLineAnnotation;

// ---------------------------------------------------------------------------
// Theme + Dark Mode
// ---------------------------------------------------------------------------

/**
 * Dark mode behavior.
 *
 * - `"auto"` - Checks the `prefers-color-scheme` media query to detect the
 *   user's system-level preference. This does NOT detect class-based dark mode
 *   toggles (e.g. `document.documentElement.classList.toggle('dark')`). If your
 *   app uses class-based dark mode, use VizThemeProvider with `"force"` or
 *   `"off"` instead of `"auto"` and toggle based on your app's state.
 * - `"force"` - Always render in dark mode regardless of system preference.
 * - `"off"` - Always render in light mode (default).
 *
 * All components (Chart, Sankey, Graph) inherit darkMode from VizThemeProvider
 * when no explicit prop is passed.
 */
export type DarkMode = 'auto' | 'force' | 'off';

/**
 * Per-element chrome theme override. Pass a plain string (color only,
 * backward-compatible) or an object with full typography control.
 */
export interface ChromeThemeOverride {
  /** Text color. Accepts a TokenValue for light/dark pairs. */
  color?: TokenValue;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font weight. */
  fontWeight?: number;
  /** Line height multiplier. */
  lineHeight?: number;
}

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
        /** Background color. Accepts a TokenValue for light/dark pairs. */
        background?: TokenValue;
        /** Default text color. Accepts a TokenValue for light/dark pairs. */
        text?: TokenValue;
        /** Gridline color. Accepts a TokenValue for light/dark pairs. */
        gridline?: TokenValue;
        /** Axis line and tick color. Accepts a TokenValue for light/dark pairs. */
        axis?: TokenValue;
        /** Annotation fill color. Accepts a TokenValue for light/dark pairs. */
        annotationFill?: TokenValue;
        /** Annotation text color. Accepts a TokenValue for light/dark pairs. */
        annotationText?: TokenValue;
        /** Semantic color for positive/up-trend values. Accepts a TokenValue for light/dark pairs. */
        positive?: TokenValue;
        /** Semantic color for negative/down-trend values. Accepts a TokenValue for light/dark pairs. */
        negative?: TokenValue;
      };
  /** Font overrides. */
  fonts?: {
    /** Primary font family. */
    family?: string;
    /** Monospace font family (for tabular numbers). */
    mono?: string;
    /** Font size overrides in pixels. Partial — only specified keys are overridden. */
    sizes?: {
      /** Chart title. Default: 26. */
      title?: number;
      /** Subtitle below the title. Default: 14. */
      subtitle?: number;
      /** Body text (tooltips, legend labels). Default: 13. */
      body?: number;
      /** Small text (source line, footer). Default: 11. */
      small?: number;
      /** Axis tick labels. Default: 11. */
      axisTick?: number;
      /** KPI metric uppercase label. Default: 10. */
      metricLabel?: number;
      /** KPI metric primary value. Default: 22. Delta/secondary derive from this. */
      metricValue?: number;
    };
    /** Font weight overrides. Partial — only specified keys are overridden. */
    weights?: {
      /** Normal text weight. Default: 450. */
      normal?: number;
      /** Medium text weight. Default: 550. */
      medium?: number;
      /** Semibold text weight. Default: 590. */
      semibold?: number;
      /** Bold text weight. Default: 700. */
      bold?: number;
    };
  };
  /** Spacing overrides in pixels. */
  spacing?: {
    /** Padding inside the chart container. */
    padding?: number;
    /** Gap between chrome elements (title to subtitle, etc.). */
    chromeGap?: number;
    /** Gap between the last chrome element and the chart area. */
    chromeToChart?: number;
    /** Gap between chart area and source/footer below. */
    chartToFooter?: number;
    /** Internal padding within the chart area (axes margins). */
    axisMargin?: number;
    /** Height reserved below chart area for x-axis tick labels. Increase when large axisTick font sizes cause label clipping. */
    xAxisHeight?: number;
    /** Gap in pixels between the x-axis line and tick label text. Increase when larger axisTick fonts sit too close to the axis line. */
    xAxisLabelPadding?: number;
  };
  /** Border radius for chart container and tooltips. */
  borderRadius?: number;
  /**
   * Per-element chrome style overrides. Pass a plain string for color-only
   * (backward-compatible), or a ChromeThemeOverride object for full
   * typography control (color, fontSize, fontWeight, lineHeight).
   */
  chrome?: {
    /** Eyebrow (kicker) style override. */
    eyebrow?: string | ChromeThemeOverride;
    /** Title style override. */
    title?: string | ChromeThemeOverride;
    /** Subtitle style override. */
    subtitle?: string | ChromeThemeOverride;
    /** Source/attribution style override. */
    source?: string | ChromeThemeOverride;
    /** Byline style override. */
    byline?: string | ChromeThemeOverride;
    /** Footer style override. */
    footer?: string | ChromeThemeOverride;
  };
  /**
   * Series color assignment strategy.
   * Default: 'palette' (full categorical palette always, zero visual drift).
   */
  seriesStrategy?: SeriesStrategy;
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
  /** Literal string prepended to each formatted label value (e.g. "-" or "$"). */
  prefix?: string;
  /** Literal string appended to each formatted label value (e.g. "%" or "x"). */
  suffix?: string;
  /** Fixed CSS color for all labels. Overrides the default fill-derived color. */
  color?: string;
  /** Per-series pixel offsets for fine-tuning label positions, keyed by series name. */
  offsets?: Record<string, AnnotationOffset>;
  /** Font size in pixels for bar/column value labels. */
  fontSize?: number;
}

/** Shorthand: `false` disables all labels, `true` uses defaults, or pass a full config object. */
export type LabelSpec = boolean | LabelConfig;

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
  /** Number of columns for horizontal legend layout. Overrides the default row limit. */
  columns?: number;
  /** Max number of legend entries before truncation. Remaining entries show as "+N more". */
  symbolLimit?: number;
  /** Maximum number of rows for top-positioned legends before truncation. Defaults to 2. */
  maxRows?: number;
  /** Series names to exclude from the legend. Excluded series still render in the chart. */
  exclude?: string[];
}

/**
 * Configuration for the endpoint labels column rendered at the chart's right edge
 * for multi-series line/area charts. Each entry pairs the series name with its
 * last formatted value, optionally anchored to the line by an open-circle marker.
 *
 * The column is independent of the traditional `legend` and the legacy
 * end-of-line labels. Together with `legend.show`, the three suppression toggles
 * follow this truth table for ≥2-series line/area charts:
 *
 * | `legend.show` | `endpointLabels` | Traditional legend | Endpoint column | End-of-line labels |
 * |--|--|--|--|--|
 * | unset | unset | hidden (auto-suppressed) | shown (default) | hidden |
 * | true  | unset | shown                    | shown           | hidden |
 * | unset | false | shown (auto-suppress revoked) | hidden     | hidden |
 * | false | false | hidden                   | hidden          | shown (last-resort) |
 * | true  | false | shown                    | hidden          | hidden |
 * | false | true  | hidden                   | shown           | hidden |
 * | true  | true  | shown                    | shown           | hidden |
 *
 * Single-series charts: column is hidden by default (nothing to identify).
 *
 * The implementation is in `packages/engine/src/legend/suppression.ts` —
 * `resolveSuppression` is the single source of truth. The table above is
 * a user-facing mirror; if the two ever diverge, the engine wins. Tests
 * in `legend/__tests__/suppression.test.ts` enforce every cell.
 */
export interface EndpointLabelsConfig {
  /** Explicit on/off. When undefined, the chart auto-decides based on series count. */
  show?: boolean;
  /** Maximum number of series before endpoint labels switch to a legend. Default 8. */
  maxSeries?: number;
  /**
   * Which ends of the chart get label columns.
   * - `'end'` (default): labels on the right (trailing) edge only.
   * - `'both'`: labels on both left (leading) and right (trailing) edges.
   */
  ends?: 'end' | 'both';
  /** Field to read the displayed value from. Defaults to `encoding.y.field`. */
  valueField?: string;
  /** d3-format string for the value. Defaults to `encoding.y.axis.format`. */
  format?: string;
  /** Max wrap width in pixels for long series names. Default 96. */
  width?: number;
  /** Render an open-circle marker on the line at the right edge. Default true. */
  showMarker?: boolean;
  /** Override the marker style. */
  markerStyle?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    radius?: number;
  };
  /**
   * Render a thin leader line from the swatch row back to the line endpoint
   * when collision-sweep displaces a label off its data point. Default false:
   * the marker on the line plus the swatch in the column already pair label
   * to data; the connector tends to add visual noise for small displacements.
   * Opt in when labels collide hard and you need the explicit tie-back.
   */
  showLeader?: boolean;
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

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/**
 * Named easing presets for entrance animations.
 * Uses CSS linear() curves. Named 'ease' (not 'easing') to match Vega convention.
 */
export type AnimationEase = 'smooth' | 'snappy';

/** Stagger configuration for sequential element reveal. */
export interface AnimationStagger {
  /** Delay between each element in ms. Default: 80 */
  delay?: number;
  /** Ordering strategy. Default: 'index' (DOM order) */
  order?: 'index' | 'value' | 'reverse';
}

/** Fine-grained responsive behavior configuration. */
export interface ResponsiveConfig {
  /**
   * Automatic annotation thinning at narrow widths. When true (default),
   * annotations that can't be placed without overlap are demoted to numbered
   * dot markers with footnote text below the chart. Set false to restore
   * the pre-auto-thinning behavior (annotations hidden at compact breakpoints).
   */
  autoThin?: boolean;
}

/**
 * Animation phase config. Follows Vega's enter/update/exit model.
 * Each phase can be true (use defaults) or a config object.
 */
export interface AnimationPhaseConfig {
  /** Duration in ms. Default: 500 for enter. */
  duration?: number;
  /** Easing preset. Default: 'smooth'. */
  ease?: AnimationEase;
  /** Stagger config. true = defaults, false = no stagger. Default: true for enter. */
  stagger?: AnimationStagger | boolean;
}

/**
 * Full animation config object. Structured as enter/update/exit phases
 * following Vega's encoding set model.
 *
 * v1 implements enter only. update and exit reserved for v2.
 */
export interface AnimationConfig {
  /** Entrance animation when chart first renders. */
  enter?: AnimationPhaseConfig | boolean;
  /** Transition animation when data updates. Reserved for v2. */
  update?: AnimationPhaseConfig | boolean;
  /** Exit animation when marks are removed. Reserved for v2. */
  exit?: AnimationPhaseConfig | boolean;
  /** Delay before annotations animate in (ms after marks). Default: 200. */
  annotationDelay?: number;
}

/**
 * Animation spec property.
 * - true: enable entrance animation with sensible defaults
 * - false/omitted: no animation (current behavior)
 * - AnimationConfig: full control via enter/update/exit phases
 */
export type AnimationSpec = boolean | AnimationConfig;

/**
 * Chart display mode.
 * - `'full'` (default): standard chart with chrome, axes, legend, padding.
 * - `'sparkline'`: minimal inline mini-chart. Strips chrome, axes, legend,
 *   watermark, animation, and reduces margins to a tiny safety pad. The mark
 *   fills the container edge-to-edge. Best with `mark: 'line' | 'area' | 'bar'`.
 *   Explicit user fields (chrome, legend, encoding.x.axis, etc.) still render
 *   when set, so users can opt in to specific elements.
 */
export type Display = 'full' | 'sparkline';

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
  labels?: LabelSpec;
  /** Override legend configuration at this breakpoint. */
  legend?: LegendConfig;
  /** Override annotations at this breakpoint. */
  annotations?: Annotation[];
  /** Override animation at this breakpoint. */
  animation?: AnimationSpec;
  /** Override display mode (`'full'` or `'sparkline'`) at this breakpoint. */
  display?: Display;
  /** Override watermark visibility at this breakpoint. */
  watermark?: boolean;
  /** Override crosshair behavior at this breakpoint. */
  crosshair?: boolean;
}

/**
 * A KPI/metric cell rendered above the chart in a horizontal row.
 *
 * Used for editorial dashboards (e.g. "CLOSE $186.10 +1.4%") where the chart
 * is paired with summary statistics. Cells lay out evenly across the chart
 * width. Hidden in sparkline mode; auto-stripped when the container can't
 * fit the laid-out values.
 */
export interface Metric {
  /** Uppercase eyebrow label, e.g. "CLOSE". */
  label: string;
  /** Primary numeric value, e.g. "$186.10". */
  value: string;
  /** Optional change indicator, e.g. "+1.4%". Rendered next to the value. */
  delta?: string;
  /** Tone for the delta. 'up' = positive (green), 'down' = negative (red). Default 'up'. */
  deltaTone?: 'up' | 'down';
  /** Optional secondary value (e.g. multiplier "10.3×"). Rendered after the delta. */
  secondary?: string;
}

// ---------------------------------------------------------------------------
// Per-mark encoding interfaces (Task 2)
// Required channels derived directly from MARK_ENCODING_RULES in encoding.ts.
// TypeScript types must stay in sync with those runtime rules.
// ---------------------------------------------------------------------------

/**
 * Encoding for arc marks (pie/donut charts).
 * - `y`: required (quantitative — the slice value)
 * - `color`: required (nominal/ordinal — the category)
 * - `theta`: optional (defaults to `y` channel)
 * - `radius`: optional (donut inner radius)
 */
export interface ArcEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  y: EncodingChannel<TData>;
  color: EncodingChannel<TData>;
}

/**
 * Encoding for line marks.
 * - `x`: required (temporal or ordinal — the time/category axis)
 * - `y`: required (quantitative — the value axis)
 */
export interface LineEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for bar marks (vertical columns and horizontal bars).
 * - `x`: required
 * - `y`: required
 */
export interface BarEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for area marks.
 * - `x`: required (temporal or ordinal)
 * - `y`: required (quantitative)
 */
export interface AreaEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for point marks (scatter plots).
 * - `x`: required
 * - `y`: required
 */
export interface PointEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for circle marks (dot plots).
 * - `x`: required (quantitative)
 * - `y`: required (nominal/ordinal — the category axis)
 */
export interface CircleEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for lollipop marks.
 * - `x`: required (quantitative)
 * - `y`: required (nominal/ordinal)
 */
export interface LollipopEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for text marks (data-positioned labels).
 * - `text`: required (the field to render as text)
 * - `x`, `y`: optional positioning
 */
export interface TextEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  text: EncodingChannel<TData>;
}

/**
 * Encoding for tick marks (strip/rug plots).
 * - `x`: required
 * - `y`: required
 */
export interface TickEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

/**
 * Encoding for rect marks (heatmaps, 2D binned plots).
 * - `x`: required
 * - `y`: required
 */
export interface RectEncoding<TData extends DataRow = DataRow> extends Encoding<TData> {
  x: EncodingChannel<TData>;
  y: EncodingChannel<TData>;
}

// ---------------------------------------------------------------------------
// Shared (non-mark-specific) ChartSpec properties
// ---------------------------------------------------------------------------

/**
 * Properties shared across all ChartSpec mark variants.
 * Extracted to avoid repeating them in every union member.
 *
 * @internal
 */
interface BaseChartSpec<TData extends DataRow = DataRow> {
  /** Data array: each element is a row with field values. */
  data: TData[];
  /** Data transforms applied in order before encoding (filter, bin, calculate, timeUnit). */
  transform?: Transform[];
  /** Editorial chrome (title, subtitle, source, etc.). */
  chrome?: Chrome;
  /**
   * KPI/metric cells rendered as a horizontal row between subtitle and chart
   * area. Each cell shows a label/value pair with optional delta and secondary
   * value. Hidden in sparkline mode and auto-stripped when the container is
   * too narrow or short, or when value text would overflow its cell.
   */
  metrics?: Metric[];
  /** Data annotations (text callouts, highlighted ranges, reference lines). */
  annotations?: Annotation[];
  /** Label display configuration. `false` disables all labels, `true` uses defaults. */
  labels?: LabelSpec;
  /** Legend display configuration (position override). */
  legend?: LegendConfig;
  /**
   * Right-side endpoint labels column for multi-series line/area charts.
   *
   * - `true` or `EndpointLabelsConfig`: render the column.
   * - `false`: hide the column.
   * - omitted: auto-enable for multi-series line/area charts, hide otherwise.
   *
   * See {@link EndpointLabelsConfig} for the full suppression truth table that
   * relates this flag to `legend.show` and the legacy end-of-line labels.
   */
  endpointLabels?: boolean | EndpointLabelsConfig;
  /**
   * Responsive behavior. `true`/`false` enables/disables container-width
   * adaptation. Pass a `ResponsiveConfig` object for fine-grained control
   * (e.g. `{ autoThin: false }` to disable automatic annotation thinning).
   */
  responsive?: boolean | ResponsiveConfig;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
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
  /**
   * Animation configuration.
   * - true: enable entrance animation with sensible defaults
   * - false/omitted: no animation (current behavior)
   * - AnimationConfig: full control via enter/update/exit phases
   */
  animation?: AnimationSpec;
  /**
   * Show a vertical crosshair line that tracks the nearest data point on
   * line and area charts. Only active when a voronoi overlay is present.
   * Defaults to false. In sparkline display mode, defaults to false unless
   * explicitly set.
   */
  crosshair?: boolean;
  /**
   * Display mode controlling how much chart chrome is rendered.
   *
   * - `'full'` (default): full publication chart with chrome, axes, legend, padding.
   * - `'sparkline'`: inline mini-chart for dashboards/KPI cards. Strips chrome,
   *   axes, legend, watermark, animation, and crosshair. The mark fills the
   *   container edge-to-edge with a small safety margin. Best with
   *   `mark: 'line' | 'area' | 'bar' | 'point'`.
   *
   * **Override precedence:** explicit user fields always win, even in sparkline
   * mode. Setting `chrome.title` on a sparkline still renders the title.
   * Setting `legend: { show: true }` still renders the legend. This applies at
   * top-level and per-breakpoint overrides.
   */
  display?: Display;
  /**
   * Resolution strategy for shared/independent scales and axes across facet
   * panels. Only meaningful when `encoding.facet` is present. Shared scales
   * (the default) let readers compare across panels; independent scales give
   * each panel its own domain.
   */
  resolve?: ResolveConfig;
  /**
   * Render order within a LayerSpec. Higher values render on top.
   * When omitted, layers render in array order (later layers paint on top).
   * Axis assignment (left/right y) is always determined by array position,
   * not zIndex.
   */
  zIndex?: number;
}

/**
 * Chart specification: the primary input for standard chart types.
 *
 * Uses the Vega-Lite `mark` property instead of `type` to specify
 * the visualization mark. The mark can be a string shorthand or an
 * object with additional properties (interpolation, point markers, etc.).
 *
 * This is a discriminated union — the `mark` value determines which encoding
 * channels are required. TypeScript enforces required channels at compile time,
 * matching the runtime rules in `MARK_ENCODING_RULES`.
 *
 * @template TData - The shape of a single data row. When provided, `encoding.*.field`
 * values are constrained to `keyof TData` and IDEs autocomplete your column names.
 * Defaults to `DataRow` (no constraint) — existing untyped specs work unchanged.
 *
 * @example
 * // Typed: field autocomplete + typo detection
 * type SalesRow = { date: string; revenue: number; region: string };
 * const spec: ChartSpec<SalesRow> = {
 *   mark: 'line',
 *   data: rows,
 *   encoding: {
 *     x: { field: 'date', type: 'temporal' },      // autocompletes
 *     y: { field: 'revenue', type: 'quantitative' }, // typos fail at compile time
 *   }
 * };
 *
 * @example
 * // Untyped: works exactly as before (no migration needed)
 * const spec: ChartSpec = {
 *   mark: 'bar',
 *   data: myData,
 *   encoding: { x: { field: 'category', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } }
 * };
 */
export type ChartSpec<TData extends DataRow = DataRow> =
  | (BaseChartSpec<TData> & {
      mark: 'arc' | (MarkDef & { type: 'arc' });
      encoding: ArcEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'line' | (MarkDef & { type: 'line' });
      encoding: LineEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'bar' | (MarkDef & { type: 'bar' });
      encoding: BarEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'area' | (MarkDef & { type: 'area' });
      encoding: AreaEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'point' | (MarkDef & { type: 'point' });
      encoding: PointEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'circle' | (MarkDef & { type: 'circle' });
      encoding: CircleEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'lollipop' | (MarkDef & { type: 'lollipop' });
      encoding: LollipopEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'text' | (MarkDef & { type: 'text' });
      encoding: TextEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'tick' | (MarkDef & { type: 'tick' });
      encoding: TickEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'rect' | (MarkDef & { type: 'rect' });
      encoding: RectEncoding<TData>;
    })
  | (BaseChartSpec<TData> & {
      mark: 'rule' | (MarkDef & { type: 'rule' });
      encoding: Encoding<TData>;
    });

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
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
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
  /** Animation configuration for entrance animations. */
  animation?: AnimationSpec;
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
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
}

// ---------------------------------------------------------------------------
// Layer spec (multi-layer composition)
// ---------------------------------------------------------------------------

/**
 * Resolution strategy for shared resources across layers.
 * 'shared' (default): union domains, single axis/legend.
 * 'independent': each layer gets its own scale/axis/legend.
 */
export type ResolveMode = 'shared' | 'independent';

/**
 * Per-channel resolution config. Controls whether scales, axes, and legends
 * are shared or independent across layers.
 */
export interface ResolveConfig {
  scale?: Partial<Record<'x' | 'y' | 'color' | 'size', ResolveMode>>;
  axis?: Partial<Record<'x' | 'y', ResolveMode>>;
  legend?: Partial<Record<'color' | 'size', ResolveMode>>;
}

/**
 * Layer specification: composites multiple chart layers into a single view.
 *
 * Each element in `layer` is either a ChartSpec or another LayerSpec (nested).
 * Shared data, encoding, and transforms at the LayerSpec level are inherited
 * by children that don't define their own.
 *
 * @template TData - The shape of a single data row. When all layers share the
 * same data shape, pass it here to get field autocomplete across the layer.
 * For layers with different data shapes per child, omit TData (defaults to
 * `DataRow`) — children can be independently typed.
 */
export interface LayerSpec<TData extends DataRow = DataRow> {
  /** Array of child layers (ChartSpec or nested LayerSpec). */
  layer: (ChartSpec<TData> | LayerSpec<TData>)[];
  /** Shared data inherited by children without their own data. */
  data?: TData[];
  /** Shared encoding inherited by children (overridden per-channel by child). */
  encoding?: Encoding<TData>;
  /** Shared transforms. Parent transforms run before child transforms. */
  transform?: Transform[];
  /** Editorial chrome (title, subtitle, source, etc.). */
  chrome?: Chrome;
  /** Annotations on the layered view. */
  annotations?: Annotation[];
  /** Label display configuration. `false` disables all labels, `true` uses defaults. */
  labels?: LabelSpec;
  /** Legend display configuration. */
  legend?: LegendConfig;
  /** Whether the chart adapts to container width. Defaults to true. */
  responsive?: boolean;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Resolution strategy for shared scales/axes/legends. */
  resolve?: ResolveConfig;
  /** Hidden series names. */
  hiddenSeries?: string[];
  /** Endpoint labels column, inherited by child layers that don't set their own. */
  endpointLabels?: boolean | EndpointLabelsConfig;
  /** Animation configuration. */
  animation?: AnimationSpec;
}

// ---------------------------------------------------------------------------
// Sankey spec (encoding-centric flow diagram)
// ---------------------------------------------------------------------------

/** Node alignment strategy for sankey layout. */
export type SankeyNodeAlign = 'left' | 'right' | 'center' | 'justify';

/** Link coloring strategy for sankey diagrams. */
export type SankeyLinkColor = 'gradient' | 'source' | 'target' | 'neutral';

/** Encoding channels specific to sankey diagrams. */
export interface SankeyEncoding {
  /** Source node field (required, nominal). */
  source: EncodingChannel;
  /** Target node field (required, nominal). */
  target: EncodingChannel;
  /** Flow value field (required, quantitative). */
  value: EncodingChannel;
  /** Color encoding for nodes/links (optional, nominal). */
  color?: EncodingChannel;
  /** Tooltip encoding (optional). */
  tooltip?: EncodingChannel | EncodingChannel[];
}

export interface SankeySpec {
  /** Discriminant: always "sankey". */
  type: 'sankey';
  /** Tabular flow data. Each row is a source-target-value link. */
  data: DataRow[];
  /** Encoding channels mapping data fields to visual properties. */
  encoding: SankeyEncoding;
  /** Width of node rectangles in pixels. Defaults to 12. */
  nodeWidth?: number;
  /** Vertical padding between nodes in pixels. Defaults to 16. */
  nodePadding?: number;
  /** Node alignment algorithm. Defaults to 'justify'. */
  nodeAlign?: SankeyNodeAlign;
  /** Number of layout relaxation iterations. Defaults to 6. */
  iterations?: number;
  /** Link coloring strategy. Defaults to 'gradient'. */
  linkStyle?: SankeyLinkColor;
  /** Link fill opacity (0-1). Defaults to 0.5 in light mode, 0.75 in dark mode. */
  linkOpacity?: number;
  /**
   * Which side of each node to place labels. 'auto' uses the default heuristic
   * (left-column right, right-column left, middle right). 'right' forces all
   * labels to the right of their nodes. 'left' forces all labels to the left.
   * Defaults to 'auto'.
   */
  nodeLabelAlign?: 'auto' | 'left' | 'right';
  /**
   * Explicit vertical ordering of nodes. An array of node IDs listed from
   * top to bottom. Nodes sharing the same column are sorted by their position
   * in this array. Nodes not in the array are placed after those that are.
   */
  nodeSort?: string[];
  /** Editorial chrome (title, subtitle, source, byline, footer). */
  chrome?: Chrome;
  /** Legend display configuration. */
  legend?: LegendConfig;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Animation configuration for entrance animations. */
  animation?: AnimationSpec;
  /**
   * d3-format string applied to flow values in tooltips and ARIA labels.
   * Uses the literal suffix extension: ".0f%" appends "%" to the formatted
   * number (data value 28 renders as "28%"). For currency: "$,.0f" or "$~s".
   * For SI suffixes: "~s" (renders 1000 as "1k"). When not set, values use
   * the default number formatter.
   */
  valueFormat?: string;
}

// ---------------------------------------------------------------------------
// TileMap spec (US state tile grid map)
// ---------------------------------------------------------------------------

/** Encoding channels specific to tile map visualizations. */
export interface TileMapEncoding {
  /** State code field (required, nominal). Maps to US state abbreviations. */
  state: EncodingChannel;
  /**
   * Value field. For quantitative mode, maps to a sequential color scale.
   * For categorical mode (when color channel is present or values are strings),
   * maps to category labels shown in tooltips.
   */
  value: EncodingChannel;
  /** Color encoding channel (optional, nominal). When present, enables categorical coloring. */
  color?: EncodingChannel;
  /** Tooltip encoding (optional). */
  tooltip?: EncodingChannel | EncodingChannel[];
}

/** Sequential color palette names available for tile maps. */
export type TileMapPalette = 'blue' | 'green' | 'orange' | 'purple' | 'teal';

export interface TileMapSpec {
  /** Discriminant: always "tilemap". */
  type: 'tilemap';
  /**
   * Data for the tile map. Accepts either:
   * - A record mapping state codes to numeric values: `{ "CA": 12000, "TX": 8500 }`
   * - A record mapping state codes to string categories: `{ "CA": "high", "TX": "low" }`
   * - Tabular data rows with state and value fields (requires encoding)
   */
  data: Record<string, number | string | null> | DataRow[];
  /**
   * Encoding channels mapping data fields to visual properties.
   * Required when data is DataRow[]. Auto-generated when data is a record map.
   */
  encoding?: TileMapEncoding;
  /** Sequential color palette. Defaults to 'blue'. Only used in quantitative mode. */
  palette?: TileMapPalette;
  /**
   * Custom category-to-color mapping for categorical tilemaps.
   * Keys are category values, values are CSS color strings.
   * When provided, forces categorical mode regardless of encoding.
   * Example: `{ "medical_only": "#ee4a73", "religious": "#e07d00", "philosophical": "#06b6d4" }`
   */
  colors?: Record<string, string>;
  /** Editorial chrome (title, subtitle, source, byline, footer). */
  chrome?: Chrome;
  /** Legend display configuration. */
  legend?: LegendConfig;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Animation configuration for entrance animations. */
  animation?: AnimationSpec;
  /**
   * d3-format string applied to tile values, legend labels, and tooltips.
   * Examples: ".1f" for one decimal, "$,.0f" for currency, "~s" for SI.
   */
  valueFormat?: string;
}

// ---------------------------------------------------------------------------
// BarList spec (ranked horizontal bar list)
// ---------------------------------------------------------------------------

export interface BarListSpec {
  /** Discriminant: always "barlist". */
  type: 'barlist';
  /**
   * Data rows. Each row must have at least a label field and a value field.
   * Rendered as a ranked list of horizontal bars.
   */
  data: DataRow[];
  /** Encoding channels mapping data fields to visual properties. */
  encoding: BarListEncoding;
  /** Bar height in pixels. Defaults to 6. */
  barHeight?: number;
  /** Corner radius: number in px or "pill" for fully rounded ends. Defaults to "pill". */
  cornerRadius?: number | 'pill';
  /** Maximum number of rows to show. Defaults to 20. */
  maxItems?: number;
  /** Editorial chrome (title, subtitle, source, byline, footer). */
  chrome?: Chrome;
  /** Theme configuration overrides. */
  theme?: ThemeConfig;
  /** Dark mode behavior. Defaults to "off". */
  darkMode?: DarkMode;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Animation configuration for entrance animations. */
  animation?: AnimationSpec;
  /**
   * d3-format string applied to bar values and tooltips.
   * Examples: ".1f" for one decimal, "$,.0f" for currency, "~s" for SI.
   */
  valueFormat?: string;
}

/** Encoding channels for a barlist visualization. */
export interface BarListEncoding {
  /** Label field (required, nominal). The category name for each row. */
  label: EncodingChannel;
  /** Value field (required, quantitative). The numeric value that drives bar width. */
  value: EncodingChannel;
  /** Subtitle field (optional, nominal). Secondary text shown beside the label in lighter weight. */
  subtitle?: EncodingChannel;
  /** Color field (optional, nominal). Maps categories to colors from the palette. When omitted, colors cycle by row index. */
  color?: EncodingChannel;
  /** Tooltip encoding (optional). */
  tooltip?: EncodingChannel | EncodingChannel[];
}

/**
 * Top-level visualization spec: union discriminated by structural shape.
 *
 * - ChartSpec: has `mark` field (no `type`, no `layer`)
 * - LayerSpec: has `layer` field
 * - TableSpec: has `type: 'table'`
 * - GraphSpec: has `type: 'graph'`
 * - SankeySpec: has `type: 'sankey'`
 * - TileMapSpec: has `type: 'tilemap'`
 * - BarListSpec: has `type: 'barlist'`
 */
export type VizSpec =
  | ChartSpec
  | LayerSpec
  | TableSpec
  | GraphSpec
  | SankeySpec
  | TileMapSpec
  | BarListSpec;

/**
 * Chart spec without runtime data, for persistence/storage.
 * Generic: `ChartSpecWithoutData<MyRow>` constrains encoding field names.
 */
export type ChartSpecWithoutData<TData extends DataRow = DataRow> = Omit<ChartSpec<TData>, 'data'>;
/** Table spec without runtime data and columns, for persistence/storage. Columns can be auto-generated via dataTable(). */
export type TableSpecWithoutData = Omit<TableSpec, 'data' | 'columns'>;
/** Graph spec without runtime data, for persistence/storage. */
export type GraphSpecWithoutData = Omit<GraphSpec, 'nodes' | 'edges'>;
/** Sankey spec without runtime data, for persistence/storage. */
export type SankeySpecWithoutData = Omit<SankeySpec, 'data'>;
/** TileMap spec without runtime data, for persistence/storage. */
export type TileMapSpecWithoutData = Omit<TileMapSpec, 'data'>;
/** BarList spec without runtime data, for persistence/storage. */
export type BarListSpecWithoutData = Omit<BarListSpec, 'data'>;
/** Union of data-stripped spec types for persistence/storage. */
export type StoredVizSpec =
  | ChartSpecWithoutData
  | TableSpecWithoutData
  | GraphSpecWithoutData
  | SankeySpecWithoutData
  | TileMapSpecWithoutData
  | BarListSpecWithoutData;

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

/** A relative-time reference that resolves against the data extent. */
export interface RelativeTimeRef {
  anchor: 'max' | 'min';
  offset: number;
  unit: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

/** A predicate that tests a field value against a condition. */
export interface FieldPredicate {
  /**
   * Data field to test.
   * Note: FieldPredicate is used in transforms (FilterTransform) which operate
   * on the raw DataRow type — field is typed as string here since transforms
   * can reference computed/derived fields not present in the original TData.
   */
  field: string;
  /** Equals comparison. */
  equal?: unknown;
  /** Less than. */
  lt?: number | RelativeTimeRef;
  /** Less than or equal. */
  lte?: number | RelativeTimeRef;
  /** Greater than. */
  gt?: number | RelativeTimeRef;
  /** Greater than or equal. */
  gte?: number | RelativeTimeRef;
  /** Inclusive range [min, max]. */
  range?: [number | RelativeTimeRef, number | RelativeTimeRef];
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

/**
 * Aggregate transform: group rows and compute summary statistics (VL aligned).
 * Produces one row per group with the groupby fields and computed aggregates.
 */
export interface AggregateTransform {
  aggregate: Array<{ op: AggregateOp; field: string; as: string }>;
  groupby: string[];
}

/**
 * Fold transform: unpivot wide-format columns into key/value rows (VL aligned).
 * For each input row, produces N output rows (one per fold field) with all
 * non-fold fields copied plus a key column (field name) and value column (field value).
 */
export interface FoldTransform {
  fold: string[];
  /** Output field names for [key, value]. Defaults to ['key', 'value']. */
  as?: [string, string];
}

/** Window operation types for computing values relative to other rows. */
export type WindowOp = 'lag' | 'lead' | 'diff' | 'pct_change' | 'cumsum' | 'rank' | 'first_value';

/** Sort field definition for window transforms. */
export interface WindowSortField {
  field: string;
  order?: 'ascending' | 'descending';
}

/** Window field definition specifying which operation to compute. */
export interface WindowFieldDef {
  op: WindowOp;
  field: string;
  /** Row offset for lag/lead/diff/pct_change. Defaults to 1. */
  offset?: number;
  as: string;
}

/** Window transform: computes values relative to other rows in sort order within a partition. */
export interface WindowTransform {
  window: WindowFieldDef[];
  /** Fields to sort by within each partition. */
  sort: WindowSortField[];
  /** Fields to partition (group) by. Each group is windowed independently. */
  groupby?: string[];
}

/** Discriminated union of all transform types. */
export type Transform =
  | FilterTransform
  | BinTransform
  | CalculateTransform
  | TimeUnitTransform
  | AggregateTransform
  | FoldTransform
  | WindowTransform;

// ---------------------------------------------------------------------------
// Conditional encoding (Vega-Lite aligned)
// ---------------------------------------------------------------------------

/**
 * A single condition with a test predicate and resulting value/field.
 * When the test passes for a datum, the condition's value/field is used.
 *
 * @template TData - Propagated from ChartSpec<TData>. Constrains `field` to
 * `keyof TData & string` when a typed data row is provided.
 */
export interface Condition<TData extends DataRow = DataRow> {
  /** Predicate to test against each datum. */
  test: FilterPredicate;
  /**
   * Static value to use when the condition is true.
   * Accepted values: CSS color string, opacity (0-1), size number, or boolean flag.
   */
  value?: string | number | boolean | null;
  /**
   * Data field to use when the condition is true.
   * Constrained to column names of `TData` when using `ChartSpec<TData>`.
   */
  field?: keyof TData & string;
  /** Field type for the conditional field. */
  type?: FieldType;
}

/**
 * A conditional value definition for an encoding channel.
 * Evaluates conditions in order, falling back to the default value.
 *
 * @template TData - Propagated from ChartSpec<TData>.
 */
export interface ConditionalValueDef<TData extends DataRow = DataRow> {
  /** One or more conditions to evaluate. */
  condition: Condition<TData> | Condition<TData>[];
  /**
   * Default value when no condition matches.
   * Accepted values: CSS color string, opacity (0-1), size number, or boolean flag.
   */
  value?: string | number | boolean | null;
}

/**
 * Check if a channel definition is a regular EncodingChannel (has 'field' at top level).
 * Use this to narrow `EncodingChannel | ConditionalValueDef` in encoding channels
 * that support conditional encoding (color, size, opacity).
 */
export function isEncodingChannel<TData extends DataRow = DataRow>(
  def: EncodingChannel<TData> | ConditionalValueDef<TData> | undefined,
): def is EncodingChannel<TData> {
  if (!def) return false;
  return 'field' in def && !('condition' in def);
}

/**
 * Check if a channel definition is a ConditionalValueDef.
 */
export function isConditionalDef<TData extends DataRow = DataRow>(
  def: EncodingChannel<TData> | ConditionalValueDef<TData> | undefined,
): def is ConditionalValueDef<TData> {
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
  'lollipop',
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

/** Check if a spec is a LayerSpec (has `layer` array). */
export function isLayerSpec(spec: VizSpec | Record<string, unknown>): spec is LayerSpec {
  return 'layer' in spec && Array.isArray((spec as Record<string, unknown>).layer);
}

/** Check if a spec is a TableSpec. */
export function isTableSpec(spec: VizSpec | Record<string, unknown>): spec is TableSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'table';
}

/** Check if a spec is a GraphSpec. */
export function isGraphSpec(spec: VizSpec | Record<string, unknown>): spec is GraphSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'graph';
}

/** Check if a spec is a SankeySpec. */
export function isSankeySpec(spec: VizSpec | Record<string, unknown>): spec is SankeySpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'sankey';
}

/** Check if a spec is a TileMapSpec. */
export function isTileMapSpec(spec: VizSpec | Record<string, unknown>): spec is TileMapSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'tilemap';
}

/** Check if a spec is a BarListSpec. */
export function isBarListSpec(spec: VizSpec | Record<string, unknown>): spec is BarListSpec {
  return 'type' in spec && (spec as Record<string, unknown>).type === 'barlist';
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
  return annotation.type === 'refline' || annotation.type === 'rule';
}

// ---------------------------------------------------------------------------
// Display name mapping for accessibility
// ---------------------------------------------------------------------------

/** Human-readable display names for mark types (used in alt text, error messages). */
export const MARK_DISPLAY_NAMES: Record<MarkType, string> = {
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
  lollipop: 'Lollipop chart',
};
