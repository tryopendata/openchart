/**
 * Rule mark renderer.
 *
 * Computes RuleMarkLayout marks from a normalized chart spec.
 * Rules are line segments, typically used for reference lines as data marks.
 * Supports x, y, x2, y2 encoding channels for start/end positioning.
 */

import type { Encoding, Mark, MarkAria, Rect, RuleMarkLayout } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import type { ChartRenderer } from '../registry';
import { getColor, scaleValue } from '../utils';

/**
 * Compute rule marks from spec data and resolved scales.
 *
 * Positioning logic:
 * - x only: vertical line spanning full chart height
 * - y only: horizontal line spanning full chart width
 * - x + x2: horizontal segment at the y position (or spanning full height)
 * - y + y2: vertical segment at the x position (or spanning full width)
 * - x + y + x2 + y2: arbitrary line segment
 */
export function computeRuleMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
): RuleMarkLayout[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;
  const x2Channel = encoding.x2;
  const y2Channel = encoding.y2;
  const colorEncoding = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const colorField = colorEncoding?.field;

  const marks: RuleMarkLayout[] = [];

  for (const row of spec.data) {
    let x1 = chartArea.x;
    let y1 = chartArea.y;
    let x2 = chartArea.x + chartArea.width;
    let y2 = chartArea.y + chartArea.height;

    // Resolve x position
    if (xChannel && scales.x) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
      if (xVal == null) continue;
      x1 = xVal;
      x2 = xVal; // default: vertical line (same x)
    }

    // Resolve y position
    if (yChannel && scales.y) {
      const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);
      if (yVal == null) continue;
      y1 = yVal;
      y2 = yVal; // default: horizontal line (same y)
    }

    // If x is set but not y, span full height (vertical line)
    if (xChannel && !yChannel) {
      y1 = chartArea.y;
      y2 = chartArea.y + chartArea.height;
    }

    // If y is set but not x, span full width (horizontal line)
    if (yChannel && !xChannel) {
      x1 = chartArea.x;
      x2 = chartArea.x + chartArea.width;
    }

    // Resolve x2 if present
    if (x2Channel && scales.x) {
      const x2Val = scaleValue(scales.x.scale, scales.x.type, row[x2Channel.field]);
      if (x2Val != null) x2 = x2Val;
    }

    // Resolve y2 if present
    if (y2Channel && scales.y) {
      const y2Val = scaleValue(scales.y.scale, scales.y.type, row[y2Channel.field]);
      if (y2Val != null) y2 = y2Val;
    }

    const color = colorField
      ? getColor(scales, String(row[colorField] ?? '__default__'))
      : getColor(scales, '__default__');

    const strokeDashEncoding =
      encoding.strokeDash && 'field' in encoding.strokeDash ? encoding.strokeDash : undefined;
    const strokeDasharray = strokeDashEncoding
      ? String(row[strokeDashEncoding.field] ?? '')
      : undefined;

    const aria: MarkAria = {
      label: `Rule from (${Math.round(x1)}, ${Math.round(y1)}) to (${Math.round(x2)}, ${Math.round(y2)})`,
    };

    marks.push({
      type: 'rule',
      x1,
      y1,
      x2,
      y2,
      stroke: color,
      strokeWidth: 1,
      strokeDasharray: strokeDasharray || undefined,
      opacity:
        encoding.opacity && 'field' in encoding.opacity
          ? Math.max(0, Math.min(1, Number(row[encoding.opacity.field]) || 1))
          : undefined,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  return marks;
}

/**
 * Rule chart renderer.
 */
export const ruleRenderer: ChartRenderer = (spec, scales, chartArea, _strategy, _theme) => {
  return computeRuleMarks(spec, scales, chartArea) as Mark[];
};
