/**
 * Gridline computation.
 *
 * Produces horizontal gridlines at y-axis tick positions and optional
 * vertical gridlines at x-axis tick positions.
 */

import type { Rect } from '@openchart/core';
import type { AxesResult } from './axes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single gridline with start/end positions. */
export interface GridlineSpec {
  /** Start x. */
  x1: number;
  /** Start y. */
  y1: number;
  /** End x. */
  x2: number;
  /** End y. */
  y2: number;
  /** Whether this is a major gridline. */
  major: boolean;
}

/** Complete gridline layout. */
export interface GridlineLayout {
  horizontal: GridlineSpec[];
  vertical: GridlineSpec[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute gridlines from axis layouts.
 *
 * Horizontal gridlines span the chart width at y-axis tick positions.
 * Vertical gridlines span the chart height at x-axis tick positions.
 *
 * @param axes - Computed axis layouts.
 * @param chartArea - The chart drawing area.
 * @param showVertical - Whether to include vertical gridlines (default: false).
 */
export function computeGridlines(
  axes: AxesResult,
  chartArea: Rect,
  showVertical = false,
): GridlineLayout {
  const horizontal: GridlineSpec[] = [];
  const vertical: GridlineSpec[] = [];

  // Horizontal gridlines at y-axis ticks
  if (axes.y) {
    for (const gridline of axes.y.gridlines) {
      horizontal.push({
        x1: chartArea.x,
        y1: gridline.position,
        x2: chartArea.x + chartArea.width,
        y2: gridline.position,
        major: gridline.major,
      });
    }
  }

  // Vertical gridlines at x-axis ticks (off by default)
  if (showVertical && axes.x) {
    for (const gridline of axes.x.gridlines) {
      vertical.push({
        x1: gridline.position,
        y1: chartArea.y,
        x2: gridline.position,
        y2: chartArea.y + chartArea.height,
        major: gridline.major,
      });
    }
  }

  return { horizontal, vertical };
}
