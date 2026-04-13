/**
 * Compute the brand watermark obstacle rect.
 *
 * The watermark is right-aligned on the same baseline as the first bottom
 * chrome element (source, byline, or footer), offset below the chart area
 * by the x-axis extent (tick labels + axis title). Returns null when the
 * watermark is disabled so callers can skip obstacle collection entirely.
 */

import type { Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { BRAND_RESERVE_WIDTH } from '@opendata-ai/openchart-core';
import type { AxesResult } from '../layout/axes';
import type { LayoutDimensions } from '../layout/dimensions';

/** Height of the watermark element used for obstacle avoidance. */
const WATERMARK_HEIGHT = 30;

/** Vertical padding below the x-axis label when an axis title is present. */
const X_AXIS_EXTENT_WITH_LABEL = 48;

/** Vertical padding below the x-axis ticks when no axis title is present. */
const X_AXIS_EXTENT_TICKS_ONLY = 26;

/**
 * Compute the rect occupied by the watermark, or null when it is disabled.
 *
 * @param dims - Layout dimensions (for total width and chrome positions).
 * @param watermark - Whether the watermark is enabled for this chart.
 * @param axes - Computed axes (the x-axis determines how far below the chart the watermark sits).
 * @param theme - Resolved theme (padding + fallback spacing).
 */
export function computeWatermarkObstacle(
  dims: LayoutDimensions,
  watermark: boolean,
  axes: AxesResult,
  theme: ResolvedTheme,
): Rect | null {
  if (!watermark) return null;

  const chartArea = dims.chartArea;
  const brandPadding = theme.spacing.padding;
  const brandX = dims.total.width - brandPadding - BRAND_RESERVE_WIDTH;
  const xAxisExtent = axes.x?.label
    ? X_AXIS_EXTENT_WITH_LABEL
    : axes.x
      ? X_AXIS_EXTENT_TICKS_ONLY
      : 0;
  const firstBottomChrome = dims.chrome.source ?? dims.chrome.byline ?? dims.chrome.footer;
  const brandY = firstBottomChrome
    ? chartArea.y + chartArea.height + xAxisExtent + firstBottomChrome.y
    : chartArea.y + chartArea.height + xAxisExtent + theme.spacing.chartToFooter;

  return { x: brandX, y: brandY, width: BRAND_RESERVE_WIDTH, height: WATERMARK_HEIGHT };
}
