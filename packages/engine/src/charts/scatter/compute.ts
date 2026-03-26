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
  LayoutStrategy,
  MarkAria,
  PointMark,
  Rect,
} from '@opendata-ai/openchart-core';
import { max, min } from 'd3-array';
import type { ScaleBand, ScaleLinear, ScalePoint, ScaleTime } from 'd3-scale';
import { scaleSqrt } from 'd3-scale';

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
  channelType: string,
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
        const pos = (scale as ScaleBand<string>)(s);
        if (pos === undefined) return undefined;
        return pos + (scale as ScaleBand<string>).bandwidth() / 2;
      }
      // ScalePoint - no bandwidth, position is the point itself
      const pos = (scale as ScalePoint<string>)(s);
      return pos;
    }
    case 'temporal':
      return (scale as ScaleTime<number, number>)(new Date(value as string | number));
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
  const sizeField = encoding.size && 'field' in encoding.size ? encoding.size.field : undefined;

  // Build a size scale for bubble variant
  let sizeScale: ((v: number) => number) | undefined;
  if (sizeField) {
    const sizeValues = spec.data.map((d) => Number(d[sizeField])).filter((v) => Number.isFinite(v));

    const sizeMin = min(sizeValues) ?? 0;
    const sizeMax = max(sizeValues) ?? 1;

    sizeScale = scaleSqrt()
      .domain([sizeMin, sizeMax])
      .range([MIN_BUBBLE_RADIUS, MAX_BUBBLE_RADIUS]);
  }

  const marks: PointMark[] = [];

  for (const row of spec.data) {
    const rawX = row[xChannel.field];
    const rawY = row[yChannel.field];

    const cx = resolvePosition(rawX, xType, xScale);
    const cy = resolvePosition(rawY, yType, yScale);

    if (cx === undefined || cy === undefined) continue;

    const category = colorField && !isSequentialColor ? String(row[colorField] ?? '') : undefined;
    let color: string;
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

  return marks;
}
