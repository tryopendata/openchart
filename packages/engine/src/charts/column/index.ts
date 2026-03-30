/**
 * Column chart module (vertical bars).
 *
 * Exports the column chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeColumnMarks } from './compute';
import { computeColumnLabels } from './labels';

// ---------------------------------------------------------------------------
// Column chart renderer
// ---------------------------------------------------------------------------

export const columnRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeColumnMarks(spec, scales, chartArea, strategy);

  // Compute and attach value labels (respects spec.labels.density)
  const labels = computeColumnLabels(
    marks,
    chartArea,
    spec.labels.density,
    spec.labels.format,
    spec.labels.prefix,
  );
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeColumnMarks } from './compute';
export { computeColumnLabels } from './labels';
