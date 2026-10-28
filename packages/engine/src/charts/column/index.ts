/**
 * Column chart module (vertical bars).
 *
 * Exports the column chart renderer and computation functions.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import { resolveFieldFormatter } from '../../format/field-format';
import { filterByDensity } from '../_shared/density-filter';
import type { ChartRenderer } from '../registry';
import { computeColumnMarks } from './compute';
import { computeColumnLabels } from './labels';

// ---------------------------------------------------------------------------
// Column chart renderer
// ---------------------------------------------------------------------------

export const columnRenderer: ChartRenderer = (
  spec,
  scales,
  chartArea,
  strategy,
  theme,
  _containerWidth,
  labelPlan,
  measureText,
) => {
  const marks = computeColumnMarks(spec, scales, chartArea, strategy, theme);

  // Compute and attach value labels (respects spec.labels.density)
  const valueField =
    spec.encoding?.y && 'field' in spec.encoding.y ? spec.encoding.y.field : undefined;
  const labelFormatter = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat:
      spec.encoding?.y && 'format' in spec.encoding.y ? spec.encoding.y.format : undefined,
    values:
      valueField && spec.labels.content !== undefined && spec.encoding.y?.stack === 'normalize'
        ? marks.map((mark) => {
            const total = marks
              .filter((other) => other.stackGroup === mark.stackGroup)
              .reduce((sum, other) => sum + Math.max(0, Number(other.data[valueField]) || 0), 0);
            return total > 0 ? Number(mark.data[valueField]) / total : 0;
          })
        : valueField
          ? spec.data.map((r) => r[valueField])
          : [],
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
    theme.fonts.family,
    {
      content: spec.labels.content,
      labelField: spec.encoding.x?.field,
      normalize: spec.labels.content !== undefined && spec.encoding.y?.stack === 'normalize',
      placement: labelPlan?.placement ?? spec.labels.placement,
      columnWidth: labelPlan?.columnWidth,
      measureText: spec.labels.placement ? measureText : undefined,
    },
  );
  const labelMarks = spec.labels.placement ? filterByDensity(marks, spec.labels.density) : marks;
  for (let i = 0; i < labelMarks.length && i < labels.length; i++) {
    labelMarks[i].label = labels[i];
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeColumnMarks } from './compute';
export { computeColumnLabels } from './labels';
