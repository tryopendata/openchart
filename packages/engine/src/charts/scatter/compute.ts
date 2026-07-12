/**
 * Scatter / bubble chart mark computation.
 *
 * Takes a normalized chart spec with resolved scales and produces
 * PointMark[] for rendering scatter plots. Axes can be any field type.
 * Optional size encoding produces area-proportional bubbles via sqrt
 * scaling, and color encoding groups points by category.
 */

import type {
  Encoding,
  FieldType,
  GradientDef,
  LayoutStrategy,
  MarkAria,
  PointMark,
  Rect,
} from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear, ScalePoint, ScaleTime } from 'd3-scale';
import { buildSizeScale } from '../../compile/size-scale';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, getSequentialColor } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_POINT_RADIUS = 5;
const MIN_BUBBLE_RADIUS = 3;
const MAX_BUBBLE_RADIUS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a data value to a pixel position based on channel type and scale. */
function resolvePosition(
  value: unknown,
  channelType: FieldType,
  scale:
    | ScaleLinear<number, number>
    | ScaleTime<number, number>
    | ScaleBand<string>
    | ScalePoint<string>,
): number | undefined {
  switch (channelType) {
    case 'nominal':
    case 'ordinal': {
      const s = String(value);
      if ('bandwidth' in scale && typeof scale.bandwidth === 'function') {
        const bw = (scale as ScaleBand<string>).bandwidth();
        const pos = (scale as ScaleBand<string>)(s);
        if (pos === undefined) return undefined;
        // ScalePoint has bandwidth() === 0; ScaleBand has > 0.
        return bw > 0 ? pos + bw / 2 : pos;
      }
      return (scale as ScalePoint<string>)(s);
    }
    case 'temporal': {
      const px = (scale as ScaleTime<number, number>)(new Date(value as string | number));
      return Number.isNaN(px) ? undefined : px;
    }
    default: {
      const num = Number(value);
      if (!Number.isFinite(num)) return undefined;
      return (scale as ScaleLinear<number, number>)(num);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute scatter/bubble marks from a normalized chart spec.
 *
 * Axes accept any field type: quantitative (linear), temporal (time),
 * nominal/ordinal (band or point scale). Optional size encoding maps a
 * data field to point radius using sqrt scale (area-proportional).
 * Optional color encoding groups points by category with distinct colors.
 */
export function computeScatterMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
): PointMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) {
    return [];
  }

  const xScale = scales.x.scale as
    | ScaleLinear<number, number>
    | ScaleTime<number, number>
    | ScaleBand<string>
    | ScalePoint<string>;
  const yScale = scales.y.scale as
    | ScaleLinear<number, number>
    | ScaleTime<number, number>
    | ScaleBand<string>
    | ScalePoint<string>;
  const xType = xChannel.type;
  const yType = yChannel.type;

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const isSequentialColor = colorEnc?.type === 'quantitative';
  const colorField = colorEnc?.field;
  const sizeEnc = encoding.size && 'field' in encoding.size ? encoding.size : undefined;
  const sizeField = sizeEnc?.field;

  // Bubbles: sqrt so perceived magnitude tracks disc *area*. Author overrides
  // (`encoding.size.scale.{domain,range}`) and the degenerate-domain fallback
  // live in the shared builder, which the size legend also calls so the key and
  // the marks can never resolve different scales.
  const resolvedSize = buildSizeScale(sizeEnc, spec.data, {
    curve: 'sqrt',
    range: [MIN_BUBBLE_RADIUS, MAX_BUBBLE_RADIUS],
  });
  const sizeScale = resolvedSize?.scale;

  const keyEnc = encoding.key && 'field' in encoding.key ? encoding.key : undefined;
  const keyField = keyEnc?.field;
  const marks: PointMark[] = [];

  for (const row of spec.data) {
    const rawX = row[xChannel.field];
    const rawY = row[yChannel.field];

    const cx = resolvePosition(rawX, xType, xScale);
    const cy = resolvePosition(rawY, yType, yScale);

    if (cx === undefined || cy === undefined) continue;

    const category = colorField && !isSequentialColor ? String(row[colorField] ?? '') : undefined;
    let color: string | GradientDef;
    if (isSequentialColor && colorField) {
      const val = Number(row[colorField]);
      color = Number.isFinite(val)
        ? getSequentialColor(scales, val)
        : getColor(scales, '__default__');
    } else {
      color = getColor(scales, category ?? '__default__');
    }

    let radius = DEFAULT_POINT_RADIUS;
    if (sizeScale && sizeField) {
      const sizeVal = Number(row[sizeField]);
      if (Number.isFinite(sizeVal)) {
        radius = sizeScale(sizeVal);
      }
    }

    const labelParts = [`${xChannel.field}=${rawX}`, `${yChannel.field}=${rawY}`];
    if (category) labelParts.push(`${colorField}=${category}`);
    if (sizeField && row[sizeField] != null) {
      labelParts.push(`${sizeField}=${row[sizeField]}`);
    }

    const aria: MarkAria = {
      label: `Data point: ${labelParts.join(', ')}`,
    };

    marks.push({
      type: 'point',
      cx,
      cy,
      r: radius,
      fill: color,
      stroke: '#ffffff',
      strokeWidth: 1,
      fillOpacity: 0.7,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  // Stamp keys: encoding.key field when set, else seriesKey|x composite
  const rawKeys = marks.map((m) => {
    if (keyField) return serializeKeyValue(m.data[keyField]);
    const cat = colorField ? String(m.data[colorField] ?? '') : '';
    const xVal = serializeKeyValue(m.data[xChannel.field]);
    return cat ? `${cat}|${xVal}` : xVal;
  });
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}
