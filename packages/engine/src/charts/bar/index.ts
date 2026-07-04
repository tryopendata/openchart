/**
 * Bar chart module (horizontal bars).
 *
 * Exports the bar chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeBarMarks } from './compute';
import { computeBarLabels } from './labels';

// ---------------------------------------------------------------------------
// Bar chart renderer
// ---------------------------------------------------------------------------

export const barRenderer: ChartRenderer = (
  spec,
  scales,
  chartArea,
  strategy,
  theme,
  containerWidth,
) => {
  const marks = computeBarMarks(spec, scales, chartArea, strategy, containerWidth);

  // Compute and attach value labels (respects spec.labels.density)
  const valueField =
    spec.encoding?.x && 'field' in spec.encoding.x ? spec.encoding.x.field : undefined;
  const labels = computeBarLabels(
    marks,
    chartArea,
    spec.labels.density,
    spec.labels.format,
    spec.labels.prefix,
    valueField,
    spec.labels.color,
    theme.isDark,
    spec.labels.fontSize,
    spec.labels.suffix,
  );
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
