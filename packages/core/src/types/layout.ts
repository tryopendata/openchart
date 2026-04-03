/**
 * Layout types: the engine output contract.
 *
 * These are the structured layout objects that the engine produces after
 * compiling a spec. Framework adapters consume these to render real DOM.
 *
 * The key distinction: spec.ts types are USER INPUT, layout.ts types are
 * ENGINE OUTPUT. Input types have optionals and unions. Output types are
 * fully resolved with computed positions, colors, and dimensions.
 */

import type { GradientDef } from './spec';
import type { ResolvedTheme } from './theme';

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

/** A rectangle defined by position and dimensions. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Margins around a region (top, right, bottom, left). */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A 2D point. */
export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Text styling
// ---------------------------------------------------------------------------

/** Resolved text style with all computed values. */
export interface TextStyle {
  /** Font family. */
  fontFamily: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Font weight. */
  fontWeight: number;
  /** Text color (CSS color string). */
  fill: string;
  /** Line height multiplier. */
  lineHeight: number;
  /** Text anchor for SVG: start, middle, or end. */
  textAnchor?: 'start' | 'middle' | 'end';
  /** Dominant baseline for SVG text vertical alignment. */
  dominantBaseline?: 'auto' | 'hanging' | 'central' | 'text-after-edge';
  /** Font variant (e.g. "tabular-nums" for fixed-width digits). */
  fontVariant?: string;
}

/** Cell style for table cells. */
export interface CellStyle {
  /** Background color. */
  backgroundColor?: string;
  /** Text color. */
  color?: string;
  /** Font weight. */
  fontWeight?: number;
  /** Font variant. */
  fontVariant?: string;
}

// ---------------------------------------------------------------------------
// Chrome (resolved)
// ---------------------------------------------------------------------------

/** A single resolved chrome text element with computed position and style. */
export interface ResolvedChromeElement {
  /** The text content. */
  text: string;
  /** X position in the layout coordinate system. */
  x: number;
  /** Y position (baseline) in the layout coordinate system. */
  y: number;
  /** Maximum width for line wrapping. */
  maxWidth: number;
  /** Computed text style. */
  style: TextStyle;
}

/**
 * Fully resolved chrome with computed positions for all elements.
 * Only present elements are included (no undefined checks needed at render time).
 */
export interface ResolvedChrome {
  /** Total height consumed by chrome elements above the chart area. */
  topHeight: number;
  /** Total height consumed by chrome elements below the chart area. */
  bottomHeight: number;
  /** Resolved chrome elements. Only present if specified in the spec. */
  title?: ResolvedChromeElement;
  subtitle?: ResolvedChromeElement;
  source?: ResolvedChromeElement;
  byline?: ResolvedChromeElement;
  footer?: ResolvedChromeElement;
}

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

/** A single axis tick with computed position and formatted label. */
export interface AxisTick {
  /** The raw data value at this tick. */
  value: unknown;
  /** Pixel position along the axis. */
  position: number;
  /** Formatted label string for display. */
  label: string;
}

/** A single gridline with computed positions. */
export interface Gridline {
  /** Pixel position along the axis. */
  position: number;
  /** Whether this is a major or minor gridline. */
  major: boolean;
}

/** Resolved axis layout with computed tick positions and labels. */
export interface AxisLayout {
  /** Axis ticks with positions and labels. */
  ticks: AxisTick[];
  /** Gridlines at tick positions. */
  gridlines: Gridline[];
  /** Axis label text (e.g. "GDP Growth (%)"). */
  label?: string;
  /** Label style. */
  labelStyle?: TextStyle;
  /** Tick label style. */
  tickLabelStyle: TextStyle;
  /** Rotation angle in degrees for tick labels. */
  tickAngle?: number;
  /** Axis line start position. */
  start: Point;
  /** Axis line end position. */
  end: Point;
  /** Axis orientation (which side it appears on). */
  orient?: 'top' | 'bottom' | 'left' | 'right';
  /** Whether to show the axis domain line. Defaults to true. */
  domainLine?: boolean;
  /** Whether to show tick marks. Defaults to true. */
  tickMarks?: boolean;
  /** Axis position offset in pixels. */
  offset?: number;
  /** Padding between axis title and axis in pixels. */
  titlePadding?: number;
  /** Padding between tick labels and axis in pixels. */
  labelPadding?: number;
  /** How overlapping labels should be handled. */
  labelOverlap?: boolean | 'parity' | 'greedy';
  /** Whether to flush labels to the axis edges. */
  labelFlush?: boolean;
}

// ---------------------------------------------------------------------------
// Marks (data visual elements)
// ---------------------------------------------------------------------------

/** Accessibility attributes for a mark. */
export interface MarkAria {
  /** ARIA label for the mark. */
  label: string;
  /** Optional longer description. */
  description?: string;
  /** ARIA role override. */
  role?: string;
}

/**
 * Line mark: a series of connected points.
 * Used by line charts and area chart boundaries.
 */
export interface LineMark {
  type: 'line';
  /** Ordered array of points defining the line path. */
  points: Point[];
  /** Pre-computed SVG path string (D3 monotone curve). When present, renderers
   *  should use this instead of reconstructing straight M/L segments from points. */
  path?: string;
  /** Stroke color. */
  stroke: string;
  /** Stroke width in pixels. */
  strokeWidth: number;
  /** Line dash pattern (empty for solid). */
  strokeDasharray?: string;
  /** Overall opacity for the line (0-1). */
  opacity?: number;
  /** Series identifier (for multi-series charts). */
  seriesKey?: string;
  /** Original data rows for this series. */
  data: Record<string, unknown>[];
  /**
   * Pixel-coordinate data points for spatial tooltip lookup (voronoi overlay).
   * Each entry pairs a pixel position with its original data row.
   */
  dataPoints?: Array<{
    x: number;
    y: number;
    datum: Record<string, unknown>;
    tooltip?: TooltipContent;
  }>;
  /** Resolved label after collision detection. */
  label?: ResolvedLabel;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Area mark: a filled region bounded by a top line and a baseline.
 * Used by area charts.
 */
export interface AreaMark {
  type: 'area';
  /** Upper boundary points. */
  topPoints: Point[];
  /** Lower boundary points (baseline, usually y=0). */
  bottomPoints: Point[];
  /** SVG path string for the complete area shape. */
  path: string;
  /** SVG path string for just the top boundary (for stroking the data line only). */
  topPath: string;
  /** Fill color or gradient. */
  fill: string | GradientDef;
  /** Fill opacity. */
  fillOpacity: number;
  /** Optional stroke for the top boundary. */
  stroke?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Series identifier. */
  seriesKey?: string;
  /** Original data rows. */
  data: Record<string, unknown>[];
  /**
   * Pixel-coordinate data points for spatial tooltip lookup (voronoi overlay).
   * Each entry pairs a pixel position with its original data row.
   */
  dataPoints?: Array<{
    x: number;
    y: number;
    datum: Record<string, unknown>;
    tooltip?: TooltipContent;
  }>;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Rect mark: a rectangle.
 * Used by bar charts, column charts, and heatmap cells.
 */
export interface RectMark {
  type: 'rect';
  /** X position. */
  x: number;
  /** Y position. */
  y: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
  /** Fill color or gradient. */
  fill: string | GradientDef;
  /** Stroke color. */
  stroke?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Corner radius. */
  cornerRadius?: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Resolved label. */
  label?: ResolvedLabel;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
  /** Bar orientation for animation direction. Set by the engine based on encoding. */
  orient?: 'horizontal' | 'vertical';
  /** Stacking group key (e.g. category name). Segments sharing this key animate together. */
  stackGroup?: string;
  /** Position of this segment within its stack group (0, 1, 2...). Set by engine for stacked bars. */
  stackPos?: number;
}

/**
 * Arc mark: a pie/donut slice.
 * Used by pie and donut charts.
 */
export interface ArcMark {
  type: 'arc';
  /** SVG path string for the arc. */
  path: string;
  /** Centroid point (center of the arc, for label positioning). */
  centroid: Point;
  /** Center of the pie/donut chart (for SVG translate). */
  center: Point;
  /** Inner radius (0 for pie, >0 for donut). */
  innerRadius: number;
  /** Outer radius. */
  outerRadius: number;
  /** Start angle in radians. */
  startAngle: number;
  /** End angle in radians. */
  endAngle: number;
  /** Fill color or gradient. */
  fill: string | GradientDef;
  /** Stroke color (usually white for slice separation). */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Resolved label. */
  label?: ResolvedLabel;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Point mark: a circle or dot.
 * Used by scatter/bubble charts and dot plots.
 */
export interface PointMark {
  type: 'point';
  /** Center x position. */
  cx: number;
  /** Center y position. */
  cy: number;
  /** Radius in pixels. */
  r: number;
  /** Fill color or gradient. */
  fill: string | GradientDef;
  /** Stroke color. */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Fill opacity. */
  fillOpacity?: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Resolved label. */
  label?: ResolvedLabel;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Text mark: data-positioned text label.
 * Used by text charts for showing values directly at data coordinates.
 */
export interface TextMarkLayout {
  type: 'textMark';
  /** X position. */
  x: number;
  /** Y position. */
  y: number;
  /** Text content to display. */
  text: string;
  /** Fill color. */
  fill: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Font weight. */
  fontWeight?: number;
  /** Font family override. */
  fontFamily?: string;
  /** Horizontal text alignment. */
  textAnchor: 'start' | 'middle' | 'end';
  /** Rotation angle in degrees. */
  angle?: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Resolved label. */
  label?: ResolvedLabel;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Rule mark: a line segment between two points.
 * Used for reference lines rendered as data marks.
 */
export interface RuleMarkLayout {
  type: 'rule';
  /** Start x position. */
  x1: number;
  /** Start y position. */
  y1: number;
  /** End x position. */
  x2: number;
  /** End y position. */
  y2: number;
  /** Stroke color. */
  stroke: string;
  /** Stroke width in pixels. */
  strokeWidth: number;
  /** Stroke dash pattern (e.g. "4 2"). */
  strokeDasharray?: string;
  /** Opacity (0-1). */
  opacity?: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * Tick mark: a short line segment at a data coordinate.
 * Used for strip plots and rug plots.
 */
export interface TickMarkLayout {
  type: 'tick';
  /** X position. */
  x: number;
  /** Y position. */
  y: number;
  /** Length of the tick mark in pixels. */
  length: number;
  /** Whether the tick is horizontal or vertical. */
  orient: 'horizontal' | 'vertical';
  /** Stroke color. */
  stroke: string;
  /** Stroke width in pixels. */
  strokeWidth: number;
  /** Opacity (0-1). */
  opacity?: number;
  /** Original data row. */
  data: Record<string, unknown>;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/** Discriminated union of all mark types. */
export type Mark =
  | LineMark
  | AreaMark
  | RectMark
  | ArcMark
  | PointMark
  | TextMarkLayout
  | RuleMarkLayout
  | TickMarkLayout;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * A resolved label: text with a computed position after collision detection.
 * The collision engine determines whether labels are visible or demoted to tooltip-only.
 */
export interface ResolvedLabel {
  /** Label text content. */
  text: string;
  /** Computed x position. */
  x: number;
  /** Computed y position (baseline). */
  y: number;
  /** Text style. */
  style: TextStyle;
  /** Whether this label is visible or was demoted to tooltip-only by collision detection. */
  visible: boolean;
  /** If not at the anchor point, draw a connector line from label to anchor. */
  connector?: {
    /** Connector start (at the label). */
    from: Point;
    /** Connector end (at the data point). */
    to: Point;
    /** Connector line color. */
    stroke: string;
    /** Connector style: straight line or curved arrow. */
    style: 'straight' | 'curve';
  };
  /** Background color behind the label text. */
  background?: string;
}

// ---------------------------------------------------------------------------
// Annotations (resolved)
// ---------------------------------------------------------------------------

/** A resolved annotation with computed pixel positions. */
export interface ResolvedAnnotation {
  /** Original annotation type. */
  type: 'text' | 'range' | 'refline';
  /** Stable identifier from the spec annotation, for selection/edit callbacks. */
  id?: string;
  /** Label text (if any). */
  label?: ResolvedLabel;
  /** For range: the highlighted rectangle in pixel coordinates. */
  rect?: Rect;
  /** For refline: the line start and end in pixel coordinates. */
  line?: { start: Point; end: Point };
  /** Fill color. */
  fill?: string;
  /** Stroke color. */
  stroke?: string;
  /** Opacity. */
  opacity?: number;
  /** Line dash pattern for reflines. */
  strokeDasharray?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Z-index for render ordering. Higher values render on top. */
  zIndex?: number;
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

/** A single entry in the legend. */
export interface LegendEntry {
  /** The label text (category name or range description). */
  label: string;
  /** The color swatch. */
  color: string;
  /** Shape of the swatch (matches the mark type). */
  shape: 'circle' | 'square' | 'line';
  /** Whether this entry is currently highlighted/active. */
  active?: boolean;
  /** True for overflow indicator entries ("+N more"). Not interactive. */
  overflow?: boolean;
}

/** Resolved legend layout with position and entries. */
export interface LegendLayout {
  /** Where the legend is positioned relative to the chart area. */
  position: 'top' | 'right' | 'bottom' | 'bottom-right' | 'inline';
  /** Legend entries. */
  entries: LegendEntry[];
  /** Bounding box for the legend (pixel coordinates). */
  bounds: Rect;
  /** Entry label style. */
  labelStyle: TextStyle;
  /** Swatch size in pixels. */
  swatchSize: number;
  /** Gap between swatch and label. */
  swatchGap: number;
  /** Gap between entries. */
  entryGap: number;
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

/** A single field-value pair in a tooltip. */
export interface TooltipField {
  /** Field label (e.g. "GDP Growth"). */
  label: string;
  /** Formatted value (e.g. "4.2%"). */
  value: string;
  /** Optional color swatch for series identification. */
  color?: string;
}

/** Tooltip content descriptor for a data point. */
export interface TooltipContent {
  /** Title line (e.g. the x-axis value like "2020-Q1"). */
  title?: string;
  /** Field-value pairs to display. */
  fields: TooltipField[];
}

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

/** Accessibility metadata for the entire visualization. */
export interface A11yMetadata {
  /** Generated alt text describing the visualization. */
  altText: string;
  /** Tabular data fallback for screen readers. Each inner array is a row. */
  dataTableFallback: unknown[][];
  /** ARIA role for the visualization root element. */
  role: string;
  /** Whether the visualization is keyboard-navigable. */
  keyboardNavigable: boolean;
}

// ---------------------------------------------------------------------------
// Animation (resolved)
// ---------------------------------------------------------------------------

/** Resolved entrance animation config with all defaults applied. */
export interface ResolvedAnimation {
  /** Whether entrance animation is enabled. */
  enabled: boolean;
  /** Duration in ms. */
  duration: number;
  /** Easing preset name. */
  ease: import('./spec').AnimationEase;
  /** Stagger delay between elements in ms. */
  staggerDelay: number;
  /** Stagger ordering. */
  staggerOrder: 'index' | 'value' | 'reverse';
  /** Delay before annotations animate in (ms after marks). */
  annotationDelay: number;
}

// ---------------------------------------------------------------------------
// ChartLayout (the main engine output for charts)
// ---------------------------------------------------------------------------

/**
 * ChartLayout: the complete engine output for chart visualizations.
 *
 * Contains everything an adapter needs to render the chart: dimensions,
 * chrome text, axes, data marks, annotations, legend, tooltip descriptors,
 * and accessibility metadata. All values are fully computed pixel positions
 * and resolved colors.
 */
export interface ChartLayout {
  /** The chart drawing area (after chrome, axes, and legend are subtracted). */
  area: Rect;
  /** Resolved chrome text elements with positions and styles. */
  chrome: ResolvedChrome;
  /** Resolved axis layouts. */
  axes: {
    x?: AxisLayout;
    y?: AxisLayout;
  };
  /** Data marks: the visual representation of data points. */
  marks: Mark[];
  /** Resolved annotations with pixel positions. */
  annotations: ResolvedAnnotation[];
  /** Legend layout (position, entries, bounds). */
  legend: LegendLayout;
  /** Tooltip descriptors keyed by a mark identifier. */
  tooltipDescriptors: Map<string, TooltipContent>;
  /** Accessibility metadata. */
  a11y: A11yMetadata;
  /** The resolved theme used for rendering. */
  theme: ResolvedTheme;
  /** Total SVG dimensions. */
  dimensions: { width: number; height: number };
  /** Resolved animation config. Present only when animation is enabled. */
  animation?: ResolvedAnimation;
  /** Whether the tryOpenData.ai watermark is enabled. */
  watermark: boolean;
}

// ---------------------------------------------------------------------------
// TableLayout (engine output for tables)
// ---------------------------------------------------------------------------

/** A resolved column definition with computed properties. */
export interface ResolvedColumn {
  /** Column key (data field name). */
  key: string;
  /** Display label. */
  label: string;
  /** Computed width in pixels. */
  width: number;
  /** Whether sorting is enabled. */
  sortable: boolean;
  /** Text alignment. */
  align: 'left' | 'center' | 'right';
  /** Column cell type (determines rendering strategy). */
  cellType: 'text' | 'heatmap' | 'category' | 'bar' | 'sparkline' | 'image' | 'flag';
}

/** Base properties for all table cell types. */
export interface TableCellBase {
  /** Raw value from the data. */
  value: unknown;
  /** Formatted display value. */
  formattedValue: string;
  /** Computed cell style. */
  style: CellStyle;
  /** ARIA label for the cell. */
  aria?: string;
}

/** Plain text cell. */
export interface TextTableCell extends TableCellBase {
  cellType: 'text';
}

/** Heatmap-colored cell. */
export interface HeatmapTableCell extends TableCellBase {
  cellType: 'heatmap';
}

/** Category-colored cell. */
export interface CategoryTableCell extends TableCellBase {
  cellType: 'category';
}

/** Cell with an inline bar visualization. */
export interface BarTableCell extends TableCellBase {
  cellType: 'bar';
  /** Bar width as a proportion (0 to 1) of available cell width. */
  barWidth: number;
  /** Bar left-edge offset as a proportion (0 to 1). 0 = left edge. */
  barOffset: number;
  /** Bar fill color. */
  barColor: string;
  /** Whether this bar represents a negative value. */
  isNegative: boolean;
}

/** Normalized sparkline data ready for rendering. */
export interface SparklineData {
  /** Sparkline type. */
  type: 'line' | 'bar' | 'column';
  /** Normalized points in 0-1 range (for line type: x/y coordinates). */
  points: Array<{ x: number; y: number }>;
  /** For bar/column: widths or heights as 0-1 proportions. */
  bars: number[];
  /** Sparkline stroke/fill color. */
  color: string;
  /** Number of data points. */
  count: number;
  /** Raw value of the first data point. */
  startValue: number;
  /** Raw value of the last data point. */
  endValue: number;
}

/** Cell with an inline sparkline. */
export interface SparklineTableCell extends TableCellBase {
  cellType: 'sparkline';
  /** Sparkline rendering data (normalized points, color, type). Null when no valid data. */
  sparklineData: SparklineData | null;
}

/** Cell with an image. */
export interface ImageTableCell extends TableCellBase {
  cellType: 'image';
  /** Image URL. */
  src: string;
  /** Image width. */
  imageWidth: number;
  /** Image height. */
  imageHeight: number;
  /** Whether to apply rounded styling. */
  rounded: boolean;
}

/** Cell displaying a flag. */
export interface FlagTableCell extends TableCellBase {
  cellType: 'flag';
  /** Country code or flag identifier. */
  countryCode: string;
}

/** Discriminated union of all table cell types. */
export type TableCell =
  | TextTableCell
  | HeatmapTableCell
  | CategoryTableCell
  | BarTableCell
  | SparklineTableCell
  | ImageTableCell
  | FlagTableCell;

/** A resolved table row. */
export interface TableRow {
  /** Unique row identifier. */
  id: string;
  /** Resolved cells in column order. */
  cells: TableCell[];
  /** Original data row. */
  data: Record<string, unknown>;
}

/** Pagination state for the table. */
export interface PaginationState {
  /** Current page (0-indexed). */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Total number of rows. */
  totalRows: number;
  /** Total number of pages. */
  totalPages: number;
}

/** Sort state for the table. */
export interface SortState {
  /** Column key being sorted. */
  column: string;
  /** Sort direction. */
  direction: 'asc' | 'desc';
}

/**
 * TableLayout: the complete engine output for table visualizations.
 *
 * Contains resolved columns, rows with computed cell values and styles,
 * pagination, sort, search state, and accessibility metadata.
 */
export interface TableLayout {
  /** Resolved chrome text elements. */
  chrome: ResolvedChrome;
  /** Resolved column definitions. */
  columns: ResolvedColumn[];
  /** Resolved table rows with computed cell values and styles. */
  rows: TableRow[];
  /** Current sort state. */
  sort?: SortState;
  /** Pagination state. */
  pagination?: PaginationState;
  /** Whether search is enabled. */
  search: { enabled: boolean; placeholder: string; query: string };
  /** Whether the first column is sticky. */
  stickyFirstColumn: boolean;
  /** Whether compact mode is active. */
  compact: boolean;
  /** Accessibility metadata. */
  a11y: { caption: string; summary: string };
  /** The resolved theme. */
  theme: ResolvedTheme;
  /** Resolved animation config. Present only when animation is enabled. */
  animation?: ResolvedAnimation;
  /** Whether the tryOpenData.ai watermark is enabled. */
  watermark: boolean;
}

// ---------------------------------------------------------------------------
// GraphLayout (engine output for network graphs)
// ---------------------------------------------------------------------------

/** A resolved graph node with computed position and visual properties. */
export interface GraphNodeLayout {
  /** Node id. */
  id: string;
  /** Computed x position. */
  x: number;
  /** Computed y position. */
  y: number;
  /** Node radius in pixels. */
  radius: number;
  /** Fill color. */
  fill: string;
  /** Stroke color. */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Node label. */
  label?: ResolvedLabel;
  /** Original node data. */
  data: Record<string, unknown>;
  /** Community/cluster identifier (from clustering config). */
  community?: string;
  /** Accessibility attributes. */
  aria: MarkAria;
}

/** A resolved graph edge with computed positions and visual properties. */
export interface GraphEdgeLayout {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Source x position. */
  x1: number;
  /** Source y position. */
  y1: number;
  /** Target x position. */
  x2: number;
  /** Target y position. */
  y2: number;
  /** Stroke color. */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Line style. */
  style: 'solid' | 'dashed' | 'dotted';
  /** Original edge data. */
  data: Record<string, unknown>;
}

/**
 * GraphLayout: the complete engine output for network graph visualizations.
 *
 * Note: GraphLayout is defined here for forward compatibility but the engine
 * won't produce it until the graph renderer is implemented in a future phase.
 */
export interface GraphLayout {
  /** The graph drawing area. */
  area: Rect;
  /** Resolved chrome text. */
  chrome: ResolvedChrome;
  /** Resolved node positions and visual properties. */
  nodes: GraphNodeLayout[];
  /** Resolved edge positions and visual properties. */
  edges: GraphEdgeLayout[];
  /** Legend layout. */
  legend: LegendLayout;
  /** Tooltip descriptors. */
  tooltipDescriptors: Map<string, TooltipContent>;
  /** Accessibility metadata. */
  a11y: A11yMetadata;
  /** The resolved theme. */
  theme: ResolvedTheme;
  /** Total dimensions. */
  dimensions: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// SankeyLayout (engine output for sankey diagrams)
// ---------------------------------------------------------------------------

/** A resolved sankey node with computed position and visual properties. */
export interface SankeyNodeMark {
  type: 'sankeyNode';
  /** Left edge x position. */
  x: number;
  /** Top edge y position. */
  y: number;
  /** Node rectangle width. */
  width: number;
  /** Node rectangle height (proportional to throughput). */
  height: number;
  /** Fill color. */
  fill: string;
  /** Stroke color. */
  stroke?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Corner radius for subtle rounding. */
  cornerRadius: number;
  /** Node label positioned outside the node. */
  label: ResolvedLabel;
  /** Node identifier (unique across the diagram). */
  nodeId: string;
  /** Total value flowing through this node. */
  value: number;
  /** Depth column (0 = leftmost). */
  depth: number;
  /** Original data associated with this node. */
  data: Record<string, unknown>;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/** A resolved sankey link with computed path and visual properties. */
export interface SankeyLinkMark {
  type: 'sankeyLink';
  /** SVG path string for the curved ribbon. */
  path: string;
  /** Source node color (for gradient start). */
  sourceColor: string;
  /** Target node color (for gradient end). */
  targetColor: string;
  /** Fill opacity (0.35 default, increases on hover). */
  fillOpacity: number;
  /** Source node identifier. */
  sourceId: string;
  /** Target node identifier. */
  targetId: string;
  /** Link ribbon width at its thinnest point. */
  width: number;
  /** Flow value this link represents. */
  value: number;
  /** Original data row for this link. */
  data: Record<string, unknown>;
  /** Accessibility attributes. */
  aria: MarkAria;
  /** Index for stagger animation ordering. */
  animationIndex?: number;
}

/**
 * SankeyLayout: the complete engine output for sankey diagram visualizations.
 *
 * Contains everything an adapter needs to render the sankey: dimensions,
 * chrome, nodes, links, legend, tooltip descriptors, and accessibility metadata.
 * No axes (sankey has no traditional axis system).
 */
export interface SankeyLayout {
  /** The sankey drawing area (after chrome and legend are subtracted). */
  area: Rect;
  /** Resolved chrome text elements with positions and styles. */
  chrome: ResolvedChrome;
  /** Resolved sankey node marks with positions and colors. */
  nodes: SankeyNodeMark[];
  /** Resolved sankey link marks with paths and gradient colors. */
  links: SankeyLinkMark[];
  /** Legend layout (position, entries, bounds). */
  legend: LegendLayout;
  /** Tooltip descriptors keyed by node/link identifier. */
  tooltipDescriptors: Map<string, TooltipContent>;
  /** Accessibility metadata. */
  a11y: A11yMetadata;
  /** The resolved theme used for rendering. */
  theme: ResolvedTheme;
  /** Total SVG dimensions. */
  dimensions: { width: number; height: number };
  /** Resolved animation config. Present only when animation is enabled. */
  animation?: ResolvedAnimation;
  /** Whether the tryOpenData.ai watermark is enabled. */
  watermark: boolean;
}

// ---------------------------------------------------------------------------
// Compile options (engine input)
// ---------------------------------------------------------------------------

/** Function signature for text measurement provided by adapters. */
export type MeasureTextFn = (
  text: string,
  fontSize: number,
  fontWeight?: number,
) => { width: number; height: number };

/**
 * Options passed to the engine's compile functions.
 *
 * Width and height define the total available space. The engine subtracts
 * chrome, axes, and legend to compute the chart drawing area.
 */
export interface CompileOptions {
  /** Total available width in pixels. */
  width: number;
  /** Total available height in pixels. */
  height: number;
  /** Theme overrides. */
  theme?: import('./spec').ThemeConfig;
  /**
   * Resolved dark mode boolean.
   *
   * Note: this is a boolean, not the DarkMode union ("auto" | "force" | "off").
   * Adapters resolve "auto" by checking window.matchMedia('(prefers-color-scheme: dark)')
   * before calling compile. The engine always receives a resolved boolean.
   */
  darkMode?: boolean;
  /** Whether to show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /**
   * Real text measurement function provided by the adapter.
   * Uses a hidden canvas or DOM element for accurate text dimensions.
   * If not provided, the engine falls back to heuristic estimation.
   */
  measureText?: MeasureTextFn;
}

/** Extended compile options for table visualizations. */
export interface CompileTableOptions extends CompileOptions {
  /** Current sort state to apply. */
  sort?: SortState;
  /** Search query to filter rows. */
  search?: string;
  /** Current page (0-indexed). */
  page?: number;
  /** Rows per page. */
  pageSize?: number;
}
