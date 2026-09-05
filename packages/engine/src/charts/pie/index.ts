/**
 * Pie and donut chart module.
 *
 * Exports pie and donut chart renderers and computation functions.
 */

import type { ArcMark, Mark, ResolvedTheme, TextMarkLayout } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../../compiler/types';
import { resolveFieldFormatter } from '../../format/field-format';
import type { ChartRenderer } from '../registry';
import { computePieMarks } from './compute';
import { computePieLabels, type PieLabelOptions } from './labels';

/**
 * Theme-derived label options. `labels.format` is the author asking for the
 * raw value on each slice; without it the label carries the percent share.
 */
function pieLabelOptions(spec: NormalizedChartSpec, theme: ResolvedTheme): PieLabelOptions {
  const valueChannel = spec.encoding.y ?? spec.encoding.x;
  const valueField =
    valueChannel && 'field' in valueChannel ? (valueChannel.field as string) : undefined;
  if (!spec.labels.format) return { fontFamily: theme.fonts.family };
  const formatter = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    values: valueField ? spec.data.map((r) => r[valueField]) : [],
  });
  return { fontFamily: theme.fonts.family, formatValue: formatter };
}

/**
 * Decorative center stat for a donut, opt in via `mark.centerLabel`. Two text
 * marks stacked on the hole's midpoint: the value at metric weight, an
 * optional caption under it. Decorative because the number is already in the
 * data the slices describe.
 */
function centerLabelMarks(
  spec: NormalizedChartSpec,
  marks: ArcMark[],
  theme: ResolvedTheme,
): TextMarkLayout[] {
  const config = spec.markDef.centerLabel;
  if (!config || marks.length === 0) return [];
  const text = typeof config === 'string' ? config : config.text;
  if (!text) return [];
  const subtitle = typeof config === 'string' ? undefined : config.subtitle;
  const { center } = marks[0];
  const valueSize = theme.fonts.sizes.metricValue;
  const captionSize = theme.fonts.sizes.small;
  // Two-line block is centered on the hole: shift the value up by half the
  // caption's line box so the pair reads as one optically centered unit.
  const valueY = subtitle ? center.y - captionSize * 0.6 : center.y;

  const out: TextMarkLayout[] = [
    {
      type: 'textMark',
      key: 'oc-center-value',
      x: center.x,
      y: valueY,
      text,
      fill: theme.colors.text,
      fontSize: valueSize,
      fontWeight: theme.fonts.weights.semibold,
      fontFamily: theme.fonts.family,
      textAnchor: 'middle',
      dominantBaseline: 'central',
      data: {},
      aria: { decorative: true },
    },
  ];
  if (subtitle) {
    out.push({
      type: 'textMark',
      key: 'oc-center-subtitle',
      x: center.x,
      y: valueY + valueSize * 0.75 + captionSize * 0.4,
      text: subtitle,
      fill: theme.colors.axis,
      fontSize: captionSize,
      fontWeight: theme.fonts.weights.normal,
      fontFamily: theme.fonts.family,
      textAnchor: 'middle',
      dominantBaseline: 'central',
      data: {},
      aria: { decorative: true },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pie chart renderer
// ---------------------------------------------------------------------------

export const pieRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, false, theme);

  // Compute and attach labels (respects spec.labels.density). Assign by the
  // label's carried index, never positionally: density filtering drops slices
  // and collision resolution re-sorts, so labels[i] is not marks[i].
  const labels = computePieLabels(
    marks,
    chartArea,
    spec.labels.density,
    theme.colors.text,
    pieLabelOptions(spec, theme),
  );
  for (const label of labels) {
    if (label.index !== undefined && marks[label.index]) marks[label.index].label = label;
  }

  return marks as Mark[];
};

// ---------------------------------------------------------------------------
// Donut chart renderer
// ---------------------------------------------------------------------------

export const donutRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computePieMarks(spec, scales, chartArea, strategy, true, theme);

  // Compute and attach labels (respects spec.labels.density). Assign by the
  // label's carried index, never positionally: density filtering drops slices
  // and collision resolution re-sorts, so labels[i] is not marks[i].
  const labels = computePieLabels(
    marks,
    chartArea,
    spec.labels.density,
    theme.colors.text,
    pieLabelOptions(spec, theme),
  );
  for (const label of labels) {
    if (label.index !== undefined && marks[label.index]) marks[label.index].label = label;
  }

  return [...marks, ...centerLabelMarks(spec, marks, theme)] as Mark[];
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computePieMarks } from './compute';
export { computePieLabels } from './labels';
