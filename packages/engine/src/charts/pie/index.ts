/**
 * Pie and donut chart module.
 *
 * Exports pie and donut chart renderers and computation functions.
 */

import type { Mark } from '@opendata-ai/core';
import type { ChartRenderer } from '../registry';
import { computePieMarks } from './compute';
import { computePieLabels } from './labels';

// ---------------------------------------------------------------------------
// Pie chart renderer
// ---------------------------------------------------------------------------

export const pieRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, false);

  // Compute and attach labels (respects spec.labels.density)
  const labels = computePieLabels(marks, chartArea, spec.labels.density, theme.colors.text);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Donut chart renderer
// ---------------------------------------------------------------------------

export const donutRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, true);

  // Compute and attach labels (respects spec.labels.density)
  const labels = computePieLabels(marks, chartArea, spec.labels.density, theme.colors.text);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computePieMarks } from './compute';
export { computePieLabels } from './labels';
