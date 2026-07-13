/**
 * Text mark renderer.
 *
 * Computes TextMarkLayout marks from a normalized chart spec.
 * Positions text at data coordinates using x/y encoding channels,
 * with content from the text encoding channel.
 */

import type { Encoding, Mark, MarkAria, TextMarkLayout } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import { buildSizeScale, SIZE_SCALE_DEFAULTS } from '../../compile/size-scale';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import type { ChartRenderer } from '../registry';
import { getColor, scaleValue } from '../utils';

/** Font size for text marks with no `size` encoding and no `mark.fontSize`. */
const DEFAULT_FONT_SIZE = 12;

const ALIGN_TO_ANCHOR = {
  left: 'start',
  center: 'middle',
  right: 'end',
} as const satisfies Record<string, TextMarkLayout['textAnchor']>;

const BASELINE_TO_DOMINANT = {
  top: 'hanging',
  middle: 'central',
  bottom: 'text-after-edge',
} as const satisfies Record<string, NonNullable<TextMarkLayout['dominantBaseline']>>;

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

  const markDef = spec.markDef ?? {};
  const dx = markDef.dx ?? 0;
  const dy = markDef.dy ?? 0;
  const isOffset = dx !== 0 || dy !== 0;
  const textAnchor = ALIGN_TO_ANCHOR[markDef.align ?? 'center'];
  const dominantBaseline = BASELINE_TO_DOMINANT[markDef.baseline ?? 'middle'];

  // Map the `size` field onto a font-size range. Linear, not sqrt: sqrt is right
  // for bubbles because perceived magnitude tracks *area* (∝ r²), but a glyph
  // reads by its height, which is linear in font size.
  //
  // Unlike scatter/beeswarm, this channel is *not* keyed: the library ships no
  // font-size legend, and no publication uses one. Treat it as emphasis, not as
  // a channel a reader is expected to decode back into a value.
  const fontSizeScale = buildSizeScale(sizeEncoding, spec.data, SIZE_SCALE_DEFAULTS.text)?.scale;

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

    const color = getRepresentativeColor(
      colorField
        ? getColor(scales, String(row[colorField] ?? '__default__'))
        : getColor(scales, '__default__'),
    );

    const fallbackFontSize = markDef.fontSize ?? DEFAULT_FONT_SIZE;
    const sizeValue = sizeEncoding ? Number(row[sizeEncoding.field]) : Number.NaN;
    const fontSize =
      fontSizeScale && Number.isFinite(sizeValue) ? fontSizeScale(sizeValue) : fallbackFontSize;

    const aria: MarkAria = {
      label: text,
    };

    // Bake the offset into x/y rather than emitting SVG dx/dy: the transition
    // driver tweens the x/y attributes and rotation pivots on them, so a
    // separate offset attribute would leave both reading the un-offset anchor.
    marks.push({
      type: 'textMark',
      x: x + dx,
      y: y + dy,
      ...(isOffset ? { anchorX: x, anchorY: y } : {}),
      text,
      fill: color,
      fontSize,
      textAnchor,
      dominantBaseline,
      angle:
        encoding.angle && 'field' in encoding.angle
          ? Number(row[encoding.angle.field]) || 0
          : undefined,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  // Stamp keys: position-defining value, fall back to index
  const posField = xChannel?.field ?? yChannel?.field;
  const rawKeys = marks.map((m, i) => (posField ? serializeKeyValue(m.data[posField]) : String(i)));
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}

/**
 * Text chart renderer.
 */
export const textRenderer: ChartRenderer = (spec, scales, _chartArea, _strategy, _theme) => {
  return computeTextMarks(spec, scales) as Mark[];
};
