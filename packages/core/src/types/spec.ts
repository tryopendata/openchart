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
  /** Secondary data field to display alongside each tick label. Renders in lighter weight/color. Only effective on categorical y-axis labels (horizontal bar charts). */
  labelField?: string;
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
  /**
   * Stacking behavior for quantitative channels (Vega-Lite aligned).
   * - undefined | true | 'zero': stack from zero baseline (default)
   * - 'normalize': stack and normalize to fraction of total (0-1 per category)
   * - 'center': center stacks around zero (streamgraph style)
   * - null | false: no stacking -- renders grouped (side-by-side) bars instead
   *
   * Use `stack: null` to get grouped/dodged bars. This is the idiomatic way to
   * compare values across categories side-by-side rather than stacked on top of
   * each other. Without it, multi-series bar data stacks by default.
   *
   * @example
   * // Side-by-side grouped bars (comparing 2018 vs 2022 wages by firm size):
   * "x": { "field": "pay", "type": "quantitative", "stack": null }
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
  /** Literal string prepended to each formatted label value (e.g. "-" or "$"). */
  prefix?: string;
  /** Per-series pixel offsets for fine-tuning label positions, keyed by series name. */
  offsets?: Record<string, AnnotationOffset>;
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
  /** Label display configuration. `false` disables all labels, `true` uses defaults. */
  labels?: LabelSpec;
  /** Legend display configuration (position override). */
  legend?: LegendConfig;
  /** Whether the chart adapts to container width. Defaults to true. */
  responsive?: boolean;
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
   * Render order within a LayerSpec. Higher values render on top.
   * When omitted, layers render in array order (later layers paint on top).
   * Axis assignment (left/right y) is always determined by array position,
   * not zIndex.
   */
  zIndex?: number;
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
 */
export interface LayerSpec {
  /** Array of child layers (ChartSpec or nested LayerSpec). */
  layer: (ChartSpec | LayerSpec)[];
  /** Shared data inherited by children without their own data. */
  data?: DataRow[];
  /** Shared encoding inherited by children (overridden per-channel by child). */
  encoding?: Encoding;
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
  /** Value field (required, quantitative). Maps to the sequential color scale. */
  value: EncodingChannel;
  /** Tooltip encoding (optional). */
  tooltip?: EncodingChannel | EncodingChannel[];
}

/** Sequential color palette names available for tile maps. */
export type TileMapPalette = 'blue' | 'green' | 'orange' | 'purple';

export interface TileMapSpec {
  /** Discriminant: always "tilemap". */
  type: 'tilemap';
  /**
   * Data for the tile map. Accepts either:
   * - A record mapping state codes to numeric values: `{ "CA": 12000, "TX": 8500 }`
   * - Tabular data rows with state and value fields (requires encoding)
   */
  data: Record<string, number | null> | DataRow[];
  /**
   * Encoding channels mapping data fields to visual properties.
   * Required when data is DataRow[]. Auto-generated when data is a record map.
   */
  encoding?: TileMapEncoding;
  /** Sequential color palette. Defaults to 'blue'. */
  palette?: TileMapPalette;
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

/**
 * Top-level visualization spec: union discriminated by structural shape.
 *
 * - ChartSpec: has `mark` field (no `type`, no `layer`)
 * - LayerSpec: has `layer` field
 * - TableSpec: has `type: 'table'`
 * - GraphSpec: has `type: 'graph'`
 * - SankeySpec: has `type: 'sankey'`
 * - TileMapSpec: has `type: 'tilemap'`
 */
export type VizSpec = ChartSpec | LayerSpec | TableSpec | GraphSpec | SankeySpec | TileMapSpec;

/** Chart spec without runtime data, for persistence/storage. */
export type ChartSpecWithoutData = Omit<ChartSpec, 'data'>;
/** Table spec without runtime data and columns, for persistence/storage. Columns can be auto-generated via dataTable(). */
export type TableSpecWithoutData = Omit<TableSpec, 'data' | 'columns'>;
/** Graph spec without runtime data, for persistence/storage. */
export type GraphSpecWithoutData = Omit<GraphSpec, 'nodes' | 'edges'>;
/** Sankey spec without runtime data, for persistence/storage. */
export type SankeySpecWithoutData = Omit<SankeySpec, 'data'>;
/** TileMap spec without runtime data, for persistence/storage. */
export type TileMapSpecWithoutData = Omit<TileMapSpec, 'data'>;
/** Union of data-stripped spec types for persistence/storage. */
export type StoredVizSpec =
  | ChartSpecWithoutData
  | TableSpecWithoutData
  | GraphSpecWithoutData
  | SankeySpecWithoutData
  | TileMapSpecWithoutData;

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
  /** Data field to test. */
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
