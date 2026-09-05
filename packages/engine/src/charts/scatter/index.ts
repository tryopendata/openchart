/**
 * Scatter / bubble chart module.
 *
 * Exports the scatter chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
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
export const scatterRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const pointMarks = computeScatterMarks(spec, scales, chartArea, strategy, theme);
  const marks: Mark[] = [...pointMarks];

  // Regression trend line renders by default but is opt-out via
  // `mark: { type: 'point', trendline: false }`. Rendering it unconditionally
  // competed with author-drawn reference lines (e.g. a manual x=y diagonal),
  // so a chart could show two diagonals.
  const trendline = spec.markDef?.trendline;
  if (trendline !== false) {
    const config = typeof trendline === 'object' ? trendline : undefined;
    // The trendline is a reference, not data: it sits at the axis-ink level so
    // it reads as chrome rather than competing with the cloud. Callers who need
    // it louder over a dense scatter can pass `trendline: { stroke }`.
    const stroke = config?.stroke ?? theme?.colors?.axis;
    const trendLine = computeTrendLine(pointMarks, stroke, config?.strokeWidth);
    if (trendLine) {
      // Stacking order defaults to `below` the points. Over a dense scatter
      // (thousands of overlapping dots) a line drawn underneath is fully
      // occluded, so callers can pass `trendline: { layer: 'above' }` to lift
      // the reference line over the cloud.
      if (config?.layer === 'above') {
        marks.push(trendLine);
      } else {
        marks.unshift(trendLine);
      }
    }
  }

  return marks;
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeScatterMarks } from './compute';
export { computeTrendLine } from './trendline';
