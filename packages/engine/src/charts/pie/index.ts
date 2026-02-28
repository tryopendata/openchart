/**
 * Pie and donut chart module.
 *
 * Exports computation functions and registers "pie" and "donut" chart
 * renderers in the chart registry.
 */

import type { Mark } from '@openchart/core';
import type { ChartRenderer } from '../registry';
import { registerChartRenderer } from '../registry';
import { computePieMarks } from './compute';
import { computePieLabels } from './labels';

// ---------------------------------------------------------------------------
// Pie chart renderer
// ---------------------------------------------------------------------------

const pieRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
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

const donutRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, true);

  // Compute and attach labels (respects spec.labels.density)
  const labels = computePieLabels(marks, chartArea, spec.labels.density, theme.colors.text);
  for (let i = 0; i < marks.length && i < labels.length; i++) {
    marks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

registerChartRenderer('pie', pieRenderer);
registerChartRenderer('donut', donutRenderer);

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computePieMarks } from './compute';
export { computePieLabels } from './labels';
