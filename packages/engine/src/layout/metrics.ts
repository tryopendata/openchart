/**
 * Metric bar layout: a row of KPI cells rendered above the chart area.
 *
 * Cells lay out evenly across the chart width. The bar is auto-stripped when
 * the container is too narrow, when the chart area would be left too short,
 * or when value text would overflow its allotted cell width. Sparkline mode
 * never reserves space for metrics.
 */
import type {
  MeasureTextFn,
  Metric,
  ResolvedMetricBar,
  ResolvedMetricCell,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

// Font sizes default to the editorial KPI mock (10px uppercase label above a
// 22px primary value) but are theme-driven so charts can scale the row. The
// label/value sizes flow in from `theme.fonts.sizes.metricLabel/metricValue`.
const DEFAULT_LABEL_FONT_SIZE = 10;
const DEFAULT_VALUE_FONT_SIZE = 22;
const LABEL_LINE_HEIGHT_RATIO = 1.4;
const VALUE_LINE_HEIGHT_RATIO = 1.15;
const INTER_ROW_GAP = 4;
// Breathing room above labels (separates metric row from the subtitle).
const TOP_GAP = 16;
// Breathing room below values (separates metric row from legend / chart top).
const BOTTOM_GAP = 20;

/** Font sizes the metric layout reserves space for. */
export interface MetricFontSizes {
  /** Uppercase label size (px). */
  label: number;
  /** Primary value size (px). */
  value: number;
}

const DEFAULT_METRIC_FONT_SIZES: MetricFontSizes = {
  label: DEFAULT_LABEL_FONT_SIZE,
  value: DEFAULT_VALUE_FONT_SIZE,
};

/** Minimum container width that can fit a metric bar. */
const MIN_BAR_WIDTH = 480;
/** Minimum chart-area height after metric reservation. */
const MIN_CHART_HEIGHT = 150;
/** Inner cell gutter so adjacent cells don't visually touch. */
const CELL_INNER_PAD = 8;

/**
 * Total height the metric bar reserves above the chart area. Derived from the
 * font sizes (theme-driven) plus the fixed gaps; never hardcoded at the call site.
 */
export function metricBarHeight(fonts: MetricFontSizes = DEFAULT_METRIC_FONT_SIZES): number {
  const labelLine = fonts.label * LABEL_LINE_HEIGHT_RATIO;
  const valueLine = fonts.value * VALUE_LINE_HEIGHT_RATIO;
  return TOP_GAP + labelLine + INTER_ROW_GAP + valueLine + BOTTOM_GAP;
}

/**
 * Concatenate the visible value text used for overflow detection. Joined with
 * single spaces because the renderer separates the spans with `dx` attributes
 * that consume roughly a space's worth of width.
 */
function valueRunText(metric: Metric): string {
  const parts = [metric.value];
  if (metric.delta) parts.push(metric.delta);
  if (metric.secondary) parts.push(metric.secondary);
  return parts.join(' ');
}

/**
 * Compute the metric bar layout. Returns `undefined` when the bar should be
 * stripped (too narrow, chart too short, or any cell would overflow).
 */
export function computeMetricBar(
  metrics: Metric[] | undefined,
  metricsTopY: number,
  metricsArea: { x: number; width: number },
  remainingChartHeight: number,
  measureText?: MeasureTextFn,
  fonts: MetricFontSizes = DEFAULT_METRIC_FONT_SIZES,
): ResolvedMetricBar | undefined {
  if (!metrics || metrics.length === 0) return undefined;
  if (metricsArea.width < MIN_BAR_WIDTH) return undefined;
  if (remainingChartHeight < MIN_CHART_HEIGHT) return undefined;

  const cellWidth = metricsArea.width / metrics.length;

  // Bail if any cell's value run can't fit. Half-rendered metric rows look
  // worse than no row at all on small viewports.
  for (const metric of metrics) {
    const text = valueRunText(metric);
    const measured = measureText
      ? measureText(text, fonts.value, 510).width
      : estimateTextWidth(text, fonts.value, 510);
    if (measured > cellWidth - CELL_INNER_PAD) return undefined;
  }

  const labelLine = fonts.label * LABEL_LINE_HEIGHT_RATIO;
  const labelY = metricsTopY + TOP_GAP + fonts.label; // baseline for uppercase label
  const valueY = metricsTopY + TOP_GAP + labelLine + INTER_ROW_GAP + fonts.value;

  const cells: ResolvedMetricCell[] = metrics.map((metric, i) => ({
    x: metricsArea.x + i * cellWidth,
    cellWidth,
    labelY,
    valueY,
    metric,
    overflowed: false,
  }));

  return {
    y: metricsTopY,
    height: metricBarHeight(fonts),
    cells,
  };
}

// Exposed for tests and consumers needing the same constants.
export const METRIC_BAR_INTERNALS = {
  DEFAULT_LABEL_FONT_SIZE,
  DEFAULT_VALUE_FONT_SIZE,
  LABEL_LINE_HEIGHT_RATIO,
  VALUE_LINE_HEIGHT_RATIO,
  INTER_ROW_GAP,
  TOP_GAP,
  BOTTOM_GAP,
  MIN_BAR_WIDTH,
  MIN_CHART_HEIGHT,
  CELL_INNER_PAD,
};
