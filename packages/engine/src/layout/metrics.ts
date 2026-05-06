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

// Visual constants. Sized to match the editorial KPI mock: a 10px uppercase
// label sits above a 22px primary value, with breathing room below before the
// chart area starts. Derived from the 4px grid.
const LABEL_FONT_SIZE = 10;
const VALUE_FONT_SIZE = 22;
const LABEL_LINE_HEIGHT_RATIO = 1.4; // 14px
const VALUE_LINE_HEIGHT_RATIO = 1.15; // ~25.3px
const INTER_ROW_GAP = 4;
// Breathing room above labels (separates metric row from the subtitle).
const TOP_GAP = 16;
// Breathing room below values (separates metric row from legend / chart top).
const BOTTOM_GAP = 20;

/** Minimum container width that can fit a metric bar. */
const MIN_BAR_WIDTH = 480;
/** Minimum chart-area height after metric reservation. */
const MIN_CHART_HEIGHT = 150;
/** Inner cell gutter so adjacent cells don't visually touch. */
const CELL_INNER_PAD = 8;

/**
 * Total height the metric bar reserves above the chart area.
 * Always derived from the constants above; never hardcoded at the call site.
 */
export function metricBarHeight(): number {
  const labelLine = LABEL_FONT_SIZE * LABEL_LINE_HEIGHT_RATIO;
  const valueLine = VALUE_FONT_SIZE * VALUE_LINE_HEIGHT_RATIO;
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
      ? measureText(text, VALUE_FONT_SIZE, 510).width
      : estimateTextWidth(text, VALUE_FONT_SIZE, 510);
    if (measured > cellWidth - CELL_INNER_PAD) return undefined;
  }

  const labelLine = LABEL_FONT_SIZE * LABEL_LINE_HEIGHT_RATIO;
  const labelY = metricsTopY + TOP_GAP + LABEL_FONT_SIZE; // baseline for uppercase label
  const valueY = metricsTopY + TOP_GAP + labelLine + INTER_ROW_GAP + VALUE_FONT_SIZE;

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
    height: metricBarHeight(),
    cells,
  };
}

// Exposed for tests and consumers needing the same constants.
export const METRIC_BAR_INTERNALS = {
  LABEL_FONT_SIZE,
  VALUE_FONT_SIZE,
  LABEL_LINE_HEIGHT_RATIO,
  VALUE_LINE_HEIGHT_RATIO,
  INTER_ROW_GAP,
  TOP_GAP,
  BOTTOM_GAP,
  MIN_BAR_WIDTH,
  MIN_CHART_HEIGHT,
  CELL_INNER_PAD,
};
