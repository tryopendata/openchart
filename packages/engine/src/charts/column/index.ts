/**
 * Column chart module (vertical bars).
 *
 * Exports computation functions and registers "column" chart renderer
 * in the chart registry.
 */

import type { Mark } from '@openchart/core';
import type { ChartRenderer } from '../registry';
import { registerChartRenderer } from '../registry';
import { computeColumnMarks } from './compute';
import { computeColumnLabels } from './labels';

// ---------------------------------------------------------------------------
// Column chart renderer
// ---------------------------------------------------------------------------

const columnRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeColumnMarks(spec, scales, chartArea, strategy);

  // Compute and attach value labels (respects spec.labels.density)
  const labels = computeColumnLabels(marks, chartArea, spec.labels.density);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

registerChartRenderer('column', columnRenderer);

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeColumnMarks } from './compute';
export { computeColumnLabels } from './labels';
