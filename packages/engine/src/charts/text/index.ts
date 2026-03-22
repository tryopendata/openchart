/**
 * Text mark renderer.
 *
 * Computes TextMarkLayout marks from a normalized chart spec.
 * Positions text at data coordinates using x/y encoding channels,
 * with content from the text encoding channel.
 */

import type { Encoding, Mark, MarkAria, TextMarkLayout } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import type { ChartRenderer } from '../registry';
import { getColor, scaleValue } from '../utils';

/**
 * Compute text marks from spec data and resolved scales.
 */
export function computeTextMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
): TextMarkLayout[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;
  const textChannel = encoding.text;

  if (!textChannel || !('field' in textChannel)) return [];

  const marks: TextMarkLayout[] = [];
  const colorEncoding = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const colorField = colorEncoding?.field;
  const sizeEncoding = encoding.size && 'field' in encoding.size ? encoding.size : undefined;

  for (const row of spec.data) {
    // Resolve x position (center of chart if no x encoding)
    let x = 0;
    if (xChannel && scales.x) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
      if (xVal == null) continue;
      x = xVal;
    }

    // Resolve y position (center of chart if no y encoding)
    let y = 0;
    if (yChannel && scales.y) {
      const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);
      if (yVal == null) continue;
      y = yVal;
    }

    const text = String(row[textChannel.field] ?? '');
    if (!text) continue;

    const color = colorField
      ? getColor(scales, String(row[colorField] ?? '__default__'))
      : getColor(scales, '__default__');

    const fontSize = sizeEncoding
      ? Math.max(8, Math.min(48, Number(row[sizeEncoding.field]) || 12))
      : 12;

    const aria: MarkAria = {
      label: text,
    };

    marks.push({
      type: 'textMark',
      x,
      y,
      text,
      fill: color,
      fontSize,
      textAnchor: 'middle',
      angle:
        encoding.angle && 'field' in encoding.angle
          ? Number(row[encoding.angle.field]) || 0
          : undefined,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  return marks;
}

/**
 * Text chart renderer.
 */
export const textRenderer: ChartRenderer = (spec, scales, _chartArea, _strategy, _theme) => {
  return computeTextMarks(spec, scales) as Mark[];
};
