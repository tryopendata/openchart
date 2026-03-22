/**
 * Scatter / bubble chart mark computation.
 *
 * Takes a normalized chart spec with resolved scales and produces
 * PointMark[] for rendering scatter plots. Both axes are quantitative.
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
import type { ScaleLinear } from 'd3-scale';
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute scatter/bubble marks from a normalized chart spec.
 *
 * Both x and y are quantitative (linear scales). Optional size encoding
 * maps a data field to point radius using sqrt scale (area-proportional).
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

  const xScale = scales.x.scale as ScaleLinear<number, number>;
  const yScale = scales.y.scale as ScaleLinear<number, number>;

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
    const xVal = Number(row[xChannel.field]);
    const yVal = Number(row[yChannel.field]);

    if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) continue;

    const cx = xScale(xVal);
    const cy = yScale(yVal);

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

    const labelParts = [`${xChannel.field}=${xVal}`, `${yChannel.field}=${yVal}`];
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
