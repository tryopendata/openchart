/**
 * @opendata-ai/core type system barrel export.
 *
 * Re-exports all types from the type modules so consumers can import
 * from '@opendata-ai/core' directly.
 */

// Encoding rules
export type {
  ChannelRule,
  EncodingRule,
  GraphChannelRule,
} from './encoding';
export {
  CHART_ENCODING_RULES,
  GRAPH_ENCODING_RULES,
} from './encoding';
// Event types (chart interaction callbacks)
export type {
  ChartEventHandlers,
  MarkEvent,
} from './events';
// Layout types (engine output)
export type {
  A11yMetadata,
  ArcMark,
  AreaMark,
  AxisLayout,
  AxisTick,
  BarTableCell,
  CategoryTableCell,
  CellStyle,
  ChartLayout,
  CompileOptions,
  CompileTableOptions,
  FlagTableCell,
  GraphEdgeLayout,
  GraphLayout,
  GraphNodeLayout,
  Gridline,
  HeatmapTableCell,
  ImageTableCell,
  LegendEntry,
  LegendLayout,
  LineMark,
  Margins,
  Mark,
  MarkAria,
  MeasureTextFn,
  PaginationState,
  Point,
  PointMark,
  Rect,
  RectMark,
  ResolvedAnnotation,
  ResolvedChrome,
  ResolvedChromeElement,
  ResolvedColumn,
  ResolvedLabel,
  SortState,
  SparklineData,
  SparklineTableCell,
  TableCell,
  TableCellBase,
  TableLayout,
  TableRow,
  TextStyle,
  TextTableCell,
  TooltipContent,
  TooltipField,
} from './layout';
// Spec types (user input)
export type {
  AggregateOp,
  Annotation,
  AnnotationAnchor,
  AnnotationOffset,
  AxisConfig,
  ChartSpec,
  ChartType,
  Chrome,
  ChromeText,
  ChromeTextStyle,
  DarkMode,
  DataRow,
  Encoding,
  EncodingChannel,
  FieldType,
  GraphEdge,
  GraphEncoding,
  GraphEncodingChannel,
  GraphLayoutConfig,
  GraphNode,
  GraphSpec,
  LabelConfig,
  LabelDensity,
  LegendConfig,
  RangeAnnotation,
  RefLineAnnotation,
  ScaleConfig,
  TableSpec,
  TextAnnotation,
  ThemeConfig,
  VizSpec,
} from './spec';
export {
  CHART_TYPES,
  isChartSpec,
  isGraphSpec,
  isRangeAnnotation,
  isRefLineAnnotation,
  isTableSpec,
  isTextAnnotation,
} from './spec';
// Table types
export type {
  BarColumnConfig,
  CategoryColorsConfig,
  ColumnConfig,
  HeatmapColumnConfig,
  ImageColumnConfig,
  SparklineColumnConfig,
} from './table';
// Theme types
export type {
  ChromeDefaults,
  ResolvedTheme,
  Theme,
  ThemeChromeDefaults,
  ThemeColors,
  ThemeFontSizes,
  ThemeFonts,
  ThemeFontWeights,
  ThemeSpacing,
} from './theme';
