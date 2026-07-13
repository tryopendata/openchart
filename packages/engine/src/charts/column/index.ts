/**
 * Column chart module (vertical bars).
 *
 * Exports the column chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import { resolveFieldFormatter } from '../../format/field-format';
import type { ChartRenderer } from '../registry';
import { computeColumnMarks } from './compute';
import { computeColumnLabels } from './labels';

// ---------------------------------------------------------------------------
// Column chart renderer
// ---------------------------------------------------------------------------

export const columnRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computeColumnMarks(spec, scales, chartArea, strategy);

  // Compute and attach value labels (respects spec.labels.density)
  const valueField =
    spec.encoding?.y && 'field' in spec.encoding.y ? spec.encoding.y.field : undefined;
  const labelFormatter = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat:
      spec.encoding?.y && 'format' in spec.encoding.y ? spec.encoding.y.format : undefined,
    values: valueField ? spec.data.map((r) => r[valueField]) : [],
  });
  const labels = computeColumnLabels(
    marks,
    chartArea,
    spec.labels.density,
    labelFormatter,
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

export { computeColumnMarks } from './compute';
export { computeColumnLabels } from './labels';
