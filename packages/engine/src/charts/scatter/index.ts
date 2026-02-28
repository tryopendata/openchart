/**
 * Scatter / bubble chart module.
 *
 * Exports computation functions and registers "scatter" chart renderer
 * in the chart registry.
 */

import type { Mark } from '@openchart/core';
import type { ChartRenderer } from '../registry';
import { registerChartRenderer } from '../registry';
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
const scatterRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
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
// Registration
// ---------------------------------------------------------------------------

registerChartRenderer('scatter', scatterRenderer);

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeScatterMarks } from './compute';
export { computeTrendLine } from './trendline';
