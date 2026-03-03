/**
 * Dot plot / lollipop chart module.
 *
 * Exports the dot chart renderer and computation functions.
 */

import type { Mark, PointMark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeDotMarks } from './compute';
import { computeDotLabels } from './labels';

// ---------------------------------------------------------------------------
// Dot chart renderer
// ---------------------------------------------------------------------------

/**
 * Dot/lollipop chart renderer.
 *
 * Produces stem (RectMark) and dot (PointMark) pairs for each data point.
 * Value labels are attached to the dot marks.
 */
export const dotRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeDotMarks(spec, scales, chartArea, strategy);

  // Extract just the point marks for label computation
  const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');

  // Compute and attach labels to point marks (respects spec.labels.density)
  const labels = computeDotLabels(pointMarks, chartArea, spec.labels.density);
  let labelIdx = 0;
  for (const mark of marks) {
    if (mark.type === 'point' && labelIdx < labels.length) {
      mark.label = labels[labelIdx];
      labelIdx++;
    }
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeDotMarks } from './compute';
export { computeDotLabels } from './labels';
