/**
 * The vertical margin stack, shared by the layout plan (tick planning) and the
 * figure budget, so the plot height the plan plans ticks for is the plot
 * height the budget resolves.
 */

import type { Annotation, MeasureTextFn, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { getHeightClass } from '@opendata-ai/openchart-core';
import { type AnnotationMeasureTextFn, heuristicMeasure } from '../annotations/geometry';
import {
  defaultReferenceContainer,
  packReferenceRows,
  type ReferenceReserve,
  referenceLabelReserve,
  referenceLaneHeights,
} from '../annotations/reference-layout';
import type { NormalizedChartSpec } from '../compiler/types';
import { type MetricFontSizes, metricBarHeight } from './metrics';
import type { ChromeLayoutMode } from './shared';

/** Which height-budget bands sit outside the authored height in each chrome layout mode. */
export type BudgetBand = 'chrome' | 'notes';

/**
 * True when `band` grows the figure instead of consuming the height budget.
 * `'subtract'`: nothing does. `'notes'` (default): only the note band.
 * `'grow'`: chrome and notes both.
 */
export function outsideBudget(mode: ChromeLayoutMode, band: BudgetBand): boolean {
  if (mode === 'subtract') return false;
  return mode === 'grow' || band === 'notes';
}

/**
 * The height the plot-area math derives from. Bands outside the budget grow
 * the figure; their terms in the margin stack cancel against this growth.
 */
export function stackHeight(
  mode: ChromeLayoutMode,
  height: number,
  chrome: { topHeight: number; bottomHeight: number },
  noteBand: number,
): number {
  let effective = height;
  if (outsideBudget(mode, 'chrome')) effective = effective + chrome.topHeight + chrome.bottomHeight;
  if (outsideBudget(mode, 'notes')) effective += noteBand;
  return effective;
}

/**
 * The bands above and below the plot. From the SVG top edge:
 *   topPad, chromeTop (title / subtitle / eyebrow), metrics (KPI bar),
 *   search (series-search band), the outside reference lane, topLegendBand,
 *   axisGap, then the plot; below it `bottom` (x-axis extent, padding,
 *   chrome bottom, note band).
 */
export interface VerticalBands {
  topPad: number;
  chromeTop: number;
  metrics: number;
  search: number;
  topLegendBand: number;
  axisGap: number;
  bottom: number;
}

/** Top margin for the bands with a reference lane of `lane` px. */
export function stackTop(bands: VerticalBands, lane: number): number {
  return (
    bands.topPad +
    bands.chromeTop +
    bands.metrics +
    bands.search +
    lane +
    bands.topLegendBand +
    bands.axisGap
  );
}

/** Minimum plot height (non-sparkline) before the fallback ladder acts. */
export const MIN_CHART_HEIGHT = 40;

/** Input row height for the series-search band (matches the DOM input's CSS height). */
export const SERIES_SEARCH_INPUT_HEIGHT = 32;
/** Gap between the series-search input row and whatever stacks below it. */
const SERIES_SEARCH_GAP = 12;

/** Pull the metric-row font sizes from the resolved theme. */
export function metricFonts(theme: ResolvedTheme): MetricFontSizes {
  return { label: theme.fonts.sizes.metricLabel, value: theme.fonts.sizes.metricValue };
}

/**
 * Tentative metric-bar and series-search reservations. Both are gated off when
 * chrome is hidden and in the cramped height range (100-199px): they are sized
 * for full tiles and would blow the min-chart-height guardrail there.
 */
export function headerBands(
  spec: NormalizedChartSpec,
  chromeMode: string,
  height: number,
  theme: ResolvedTheme,
): { metrics: number; search: number } {
  const open = chromeMode !== 'hidden' && getHeightClass(height) !== 'cramped';
  const wantsMetrics = open && !!spec.metrics && spec.metrics.length > 0;
  return {
    metrics: wantsMetrics ? metricBarHeight(metricFonts(theme)) : 0,
    search: open && !!spec.seriesSearch ? SERIES_SEARCH_INPUT_HEIGHT + SERIES_SEARCH_GAP : 0,
  };
}

// ---------------------------------------------------------------------------
// Outside reference lane
// ---------------------------------------------------------------------------

/** Adapt the host measureText callback to the annotation measurement signature. */
export function annotationMeasureFn(measureText?: MeasureTextFn): AnnotationMeasureTextFn {
  return measureText
    ? (text, font) => measureText(text, font.fontSize, font.fontWeight).width
    : heuristicMeasure;
}

/**
 * The figure's reserve with its right lane ending at the chrome padding
 * (`pad`, the scaled theme padding the title, source and brand use), so a
 * right-lane label lines up with the chrome at every breakpoint. The
 * authored reserve is measured before the figure height (and so the scaled
 * padding) is known; only `right` depends on it.
 */
export function chromeInsetReference(
  reserve: ReferenceReserve,
  annotations: Annotation[],
  width: number,
  measureText: MeasureTextFn | undefined,
  theme: ResolvedTheme,
  pad: number,
): ReferenceReserve {
  if (reserve.right === 0) return reserve;
  const { right } = referenceLabelReserve(
    annotations,
    width,
    annotationMeasureFn(measureText),
    theme.fonts.sizes.small,
    pad,
  );
  return { ...reserve, right };
}

/**
 * The top reference lane may take at most this share of the authored height,
 * the same basis as the chrome share cap (PLOT_SHARE_MAX).
 */
export const REFERENCE_LANE_SHARE_MAX = 0.25;

/**
 * Fit the top lane to the plot. Admits leading rows while their cumulative
 * height (each including the lane's pad to the plot) stays within the share
 * cap and leaves the plot its minimum height, so the lane yields before any
 * chrome steps down. The reserve is exactly the admitted rows: growing past an
 * admission threshold shrinks the plot by at most one row, never by more than
 * the share cap.
 */
export function fitReferenceLane(
  cumulative: number[],
  height: number,
  plotWithoutLane: number,
  minPlot: number,
): { reserve: number; admitted: number } {
  const limit = Math.min(REFERENCE_LANE_SHARE_MAX * height, plotWithoutLane - minPlot);
  let admitted = 0;
  while (admitted < cumulative.length && cumulative[admitted] <= limit) admitted++;
  return { reserve: admitted > 0 ? cumulative[admitted - 1] : 0, admitted };
}

/**
 * Pixel x of each vertical reference rule (by spec annotation index) for a
 * scale area. Built by the compile from the render spec's x scale.
 */
export type ReferenceXResolver = (scaleArea: Rect) => (index: number) => number | null;

/** The x-scale range for a plot: inset past inline y-tick labels when they fit. */
export function scaleAreaFor(chartArea: Rect, inlineYLabelInset: number): Rect {
  if (inlineYLabelInset > 0 && inlineYLabelInset < chartArea.width)
    return {
      x: chartArea.x + inlineYLabelInset,
      y: chartArea.y,
      width: chartArea.width - inlineYLabelInset,
      height: chartArea.height,
    };
  return chartArea;
}

/**
 * Pack and measure the top reference lane for a plot rectangle: the rows,
 * placed as placement will place them, and their cumulative heights.
 */
export function referenceLaneFor(
  reference: ReferenceReserve,
  referenceX: ReferenceXResolver | undefined,
  plot: Rect,
  scaleArea: Rect,
  width: number,
) {
  const rows = packReferenceRows(
    reference.labels,
    referenceX && reference.labels.length > 0 ? referenceX(scaleArea) : undefined,
    plot,
    defaultReferenceContainer({ width, height: 0 }),
  );
  return { rows, cumulative: referenceLaneHeights(rows) };
}
