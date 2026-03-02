/**
 * Bar chart module (horizontal bars).
 *
 * Exports the bar chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/core';
import type { ChartRenderer } from '../registry';
import { computeBarMarks } from './compute';
import { computeBarLabels } from './labels';

// ---------------------------------------------------------------------------
// Bar chart renderer
// ---------------------------------------------------------------------------

export const barRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeBarMarks(spec, scales, chartArea, strategy);

  // Compute and attach value labels (respects spec.labels.density)
  const labels = computeBarLabels(marks, chartArea, spec.labels.density);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeBarMarks } from './compute';
export { computeBarLabels } from './labels';
