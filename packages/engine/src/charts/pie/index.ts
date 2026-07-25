/**
 * Pie and donut chart module.
 *
 * Exports pie and donut chart renderers and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computePieMarks } from './compute';
import { computePieLabels } from './labels';

// ---------------------------------------------------------------------------
// Pie chart renderer
// ---------------------------------------------------------------------------

export const pieRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, false);

  // Compute and attach labels (respects spec.labels.density). Assign by the
  // label's carried index, never positionally: density filtering drops slices
  // and collision resolution re-sorts, so labels[i] is not marks[i].
  const labels = computePieLabels(marks, chartArea, spec.labels.density, theme.colors.text);
  for (const label of labels) {
    if (label.index !== undefined && marks[label.index]) marks[label.index].label = label;
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Donut chart renderer
// ---------------------------------------------------------------------------

export const donutRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, true);

  // Compute and attach labels (respects spec.labels.density). Assign by the
  // label's carried index, never positionally: density filtering drops slices
  // and collision resolution re-sorts, so labels[i] is not marks[i].
  const labels = computePieLabels(marks, chartArea, spec.labels.density, theme.colors.text);
  for (const label of labels) {
    if (label.index !== undefined && marks[label.index]) marks[label.index].label = label;
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computePieMarks } from './compute';
export { computePieLabels } from './labels';
