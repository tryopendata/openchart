/**
 * Line & area chart module.
 *
 * Exports line and area chart renderers and computation functions.
 */

import type { LineMark, Mark } from '@opendata-ai/core';
import type { ChartRenderer } from '../registry';
import { computeAreaMarks } from './area';
import { computeLineMarks } from './compute';
import { computeLineLabels } from './labels';

// ---------------------------------------------------------------------------
// Line chart renderer
// ---------------------------------------------------------------------------

/**
 * Line chart renderer.
 *
 * Computes line marks + point marks for hover targets, then resolves
 * end-of-line labels and attaches them to the corresponding line marks.
 */
export const lineRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const marks = computeLineMarks(spec, scales, chartArea, strategy);

  // Extract just the line marks for label computation
  const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');

  // Compute and attach labels to line marks by seriesKey lookup
  const labelMap = computeLineLabels(lineMarks, strategy, spec.labels.density);
  for (const mark of marks) {
    if (mark.type === 'line' && mark.seriesKey) {
      const label = labelMap.get(mark.seriesKey);
      if (label) {
        mark.label = label;
      }
    }
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Area chart renderer
// ---------------------------------------------------------------------------

/**
 * Area chart renderer.
 *
 * Computes area fill marks (stacked if multi-series).
 * Also computes line marks for the top boundary and point marks
 * for hover targets, layered on top of the areas.
 */
export const areaRenderer: ChartRenderer = (spec, scales, chartArea, strategy, _theme) => {
  const areas = computeAreaMarks(spec, scales, chartArea);
  const lines = computeLineMarks(spec, scales, chartArea, strategy);

  // Areas go first (rendered behind lines), then lines on top
  return [...areas, ...lines] as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeAreaMarks } from './area';
export { computeLineMarks } from './compute';
export { computeLineLabels } from './labels';
