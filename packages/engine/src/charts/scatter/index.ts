/**
 * Scatter / bubble chart module.
 *
 * Exports the scatter chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/core';
import type { ChartRenderer } from '../registry';
import { computeScatterMarks } from './compute';
import { computeTrendLine } from './trendline';

// ---------------------------------------------------------------------------
// Scatter chart renderer
// ---------------------------------------------------------------------------

/**
 * Scatter chart renderer.
 *
 * Produces point marks for each data point, optionally with size encoding
 * for bubbles and a trend line overlay.
 */
export const scatterRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const pointMarks = computeScatterMarks(spec, scales, chartArea, strategy);
  const marks: Mark[] = [...pointMarks];

  // Add trend line if there are enough points
  const trendLine = computeTrendLine(pointMarks);
  if (trendLine) {
    // Trend line goes behind points
    marks.unshift(trendLine);
  }

  return marks;
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeScatterMarks } from './compute';
export { computeTrendLine } from './trendline';
