/**
 * Tick mark renderer.
 *
 * Computes TickMarkLayout marks from a normalized chart spec.
 * Ticks are short line segments used for strip/rug plots.
 * Each data point produces a small tick perpendicular to the data axis.
 */

import type { Encoding, Mark, MarkAria, Rect, TickMarkLayout } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import type { ChartRenderer } from '../registry';
import { getColor, scaleValue } from '../utils';

/** Default tick length in pixels. */
const DEFAULT_TICK_LENGTH = 18;

/**
 * Compute tick marks from spec data and resolved scales.
 *
 * Orientation is inferred from the encoding:
 * - If x is quantitative and y is categorical (or vice versa), ticks are
 *   perpendicular to the quantitative axis.
 * - Default: vertical ticks (short vertical lines at each x position).
 */
export function computeTickMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
): TickMarkLayout[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) return [];

  const colorEncoding = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const colorField = colorEncoding?.field;
  const marks: TickMarkLayout[] = [];

  // Determine orientation: ticks are perpendicular to the quantitative axis
  const isHorizontal = xChannel.type === 'quantitative' && yChannel.type !== 'quantitative';
  const orient: 'horizontal' | 'vertical' = isHorizontal ? 'horizontal' : 'vertical';

  for (const row of spec.data) {
    const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
    const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);
    if (xVal == null || yVal == null) continue;

    const color = getRepresentativeColor(
      colorField
        ? getColor(scales, String(row[colorField] ?? '__default__'))
        : getColor(scales, '__default__'),
    );

    const aria: MarkAria = {
      label: `${row[xChannel.field]}, ${row[yChannel.field]}`,
    };

    marks.push({
      type: 'tick',
      x: xVal,
      y: yVal,
      length: DEFAULT_TICK_LENGTH,
      orient,
      stroke: color,
      strokeWidth: 1,
      opacity:
        encoding.opacity && 'field' in encoding.opacity
          ? Math.max(0, Math.min(1, Number(row[encoding.opacity.field]) || 1))
          : undefined,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  // Stamp keys: position-defining value, fall back to index
  const posField = isHorizontal ? xChannel.field : yChannel.field;
  const rawKeys = marks.map((m) => serializeKeyValue(m.data[posField]));
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}

/**
 * Tick chart renderer.
 */
export const tickRenderer: ChartRenderer = (spec, scales, chartArea, _strategy, _theme) => {
  return computeTickMarks(spec, scales, chartArea) as Mark[];
};
