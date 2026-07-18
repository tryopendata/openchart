/**
 * Responsive module barrel export.
 */

export type {
  AnnotationPosition,
  AxisLabelDensity,
  Breakpoint,
  ChromeMode,
  HeightClass,
  LabelMode,
  LayoutStrategy,
  LegendPosition,
} from './breakpoints';
export {
  BREAKPOINT_COMPACT_MAX,
  BREAKPOINT_MEDIUM_MAX,
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  HEIGHT_CRAMPED_MAX,
  HEIGHT_SHORT_MAX,
} from './breakpoints';
export type { XAxisExtentInput } from './metrics';
export {
  AXIS_TITLE_GAP,
  AXIS_TITLE_OFFSET_COMPACT,
  AXIS_TITLE_OFFSET_DEFAULT,
  AXIS_TITLE_TRAILING_PAD,
  axisTitleOffset,
  computeXAxisExtentFromLabels,
  getAxisTitleOffset,
  HPAD_COMPACT_FRACTION,
  HPAD_COMPACT_MIN,
  LABEL_GAP_COMPACT,
  LABEL_GAP_DEFAULT,
  LABEL_GAP_NARROW_MAX,
  MAX_LEFT_LABEL_FRACTION_COMPACT,
  MAX_LEFT_LABEL_FRACTION_DEFAULT,
  MAX_LEFT_LABEL_FRACTION_MEDIUM,
  MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX,
  maxRotatedLabelWidth,
  NARROW_VIEWPORT_MAX,
  TICK_LABEL_OFFSET,
  TICK_LINE_HEIGHT_FACTOR,
  TOP_PAD_EXTRA_NARROW,
  TOP_PAD_NARROW_MAX,
  truncateRotatedLabel,
  truncateToWidth,
  X_AXIS_BAND_HEIGHT,
  X_AXIS_ROTATED_EXTENT_CAP,
  X_AXIS_TITLE_BAND,
  X_AXIS_TITLE_BAND_ROTATED,
} from './metrics';
