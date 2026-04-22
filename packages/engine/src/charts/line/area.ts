/**
 * Area chart mark computation.
 *
 * Uses D3 area() generator to produce AreaMark[] with top/bottom
 * boundary points and SVG path strings. Supports single areas and
 * stacked areas via d3-shape stack layout.
 */

import type { AreaMark, DataRow, Encoding, MarkAria, Rect } from '@opendata-ai/openchart-core';
import { getRepresentativeColor, isGradientDef } from '@opendata-ai/openchart-core';
import type { ScaleLinear } from 'd3-scale';
import {
  area,
  line,
  stack,
  stackOffsetExpand,
  stackOffsetNone,
  stackOffsetSilhouette,
  stackOrderNone,
} from 'd3-shape';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, scaleValue, sortByField } from '../utils';
import { resolveCurve } from './curves';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FILL_OPACITY = 0.15;

// ---------------------------------------------------------------------------
// Single area (non-stacked)
// ---------------------------------------------------------------------------

function computeSingleArea(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
): AreaMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) return [];

  const yScale = scales.y.scale as ScaleLinear<number, number>;
  // Use the domain minimum as the baseline so the area fill doesn't drop
  // below the visible scale range when zero: false excludes 0 from the domain.
  const domain = yScale.domain();
  const baselineY = yScale(Math.min(domain[0], domain[1]));

  // Group by color field
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;
  const groups = new Map<string, DataRow[]>();

  if (!colorField) {
    groups.set('__default__', spec.data);
  } else {
    for (const row of spec.data) {
      const key = String(row[colorField] ?? '__default__');
      const existing = groups.get(key);
      if (existing) {
        existing.push(row);
      } else {
        groups.set(key, [row]);
      }
    }
  }

  const marks: AreaMark[] = [];

  for (const [seriesKey, rows] of groups) {
    const color = getColor(scales, seriesKey);

    // Sort rows by x-axis field so areas draw left-to-right.
    // For nominal/ordinal axes, preserve data order.
    const sortedRows =
      xChannel.type === 'nominal' || xChannel.type === 'ordinal'
        ? rows
        : sortByField(rows, xChannel.field);

    // Compute points, filtering out null values
    const validPoints: { x: number; yTop: number; yBottom: number; row: DataRow }[] = [];

    // Check for y2 channel (band between y and y2)
    const y2Channel = (encoding as Encoding & { y2?: { field: string; type: string } }).y2;

    for (const row of sortedRows) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
      const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);

      if (xVal === null || yVal === null) continue;

      const yBottomVal =
        y2Channel && row[y2Channel.field] != null
          ? scaleValue(scales.y.scale, scales.y.type, row[y2Channel.field])
          : null;

      validPoints.push({
        x: xVal,
        yTop: yVal,
        yBottom: yBottomVal ?? baselineY,
        row,
      });
    }

    if (validPoints.length === 0) continue;

    // Build the area path with configured interpolation
    const curve = resolveCurve(spec.markDef.interpolate);
    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((d) => d.x)
      .y0((d) => d.yBottom)
      .y1((d) => d.yTop)
      .curve(curve);

    const pathStr = areaGenerator(validPoints) ?? '';

    // Top-line path for stroking only the data line (not the baseline)
    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((d) => d.x)
      .y((d) => d.yTop)
      .curve(curve);
    const topPathStr = topLineGenerator(validPoints) ?? '';

    const topPoints = validPoints.map((p) => ({ x: p.x, y: p.yTop }));
    const bottomPoints = validPoints.map((p) => ({ x: p.x, y: p.yBottom }));

    const ariaLabel =
      seriesKey === '__default__'
        ? `Area with ${validPoints.length} data points`
        : `${seriesKey}: area with ${validPoints.length} data points`;

    const aria: MarkAria = { label: ariaLabel };

    // Allow markDef.fill to override color with a gradient.
    // When a gradient is provided, set fillOpacity=1 so gradient stop-opacity controls the fade.
    const markFill = spec.markDef.fill;
    const fillValue = markFill != null ? markFill : color;
    const defaultFillOpacity = y2Channel ? 0.25 : DEFAULT_FILL_OPACITY;
    const fillOpacity = isGradientDef(fillValue) ? 1 : (spec.markDef.opacity ?? defaultFillOpacity);

    marks.push({
      type: 'area',
      topPoints,
      bottomPoints,
      path: pathStr,
      topPath: topPathStr,
      fill: fillValue,
      fillOpacity: fillOpacity,
      stroke: getRepresentativeColor(isGradientDef(fillValue) ? color : fillValue),
      strokeWidth: 2,
      seriesKey: seriesKey === '__default__' ? undefined : seriesKey,
      data: validPoints.map((p) => p.row),
      dataPoints: validPoints.map((p) => ({ x: p.x, y: p.yTop, datum: p.row })),
      aria,
    });
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Stacked area
// ---------------------------------------------------------------------------

function computeStackedArea(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
): AreaMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;

  if (!xChannel || !yChannel || !scales.x || !scales.y || !colorField) {
    // If no color field, can't stack -- fall back to single area
    return computeSingleArea(spec, scales, chartArea);
  }

  // Sort data by x field so stacked areas render left-to-right.
  // For nominal/ordinal axes, preserve data order.
  const sortedData =
    xChannel.type === 'nominal' || xChannel.type === 'ordinal'
      ? spec.data
      : sortByField(spec.data, xChannel.field);

  // Collect unique series keys and x values, and build a lookup from
  // (x-value, series-key) -> original data row so stacked area marks
  // get original rows instead of pivot rows.
  const seriesKeys = new Set<string>();
  const xValueSet = new Set<string>();
  const rowsByXSeries = new Map<string, DataRow>();
  const rowsByX = new Map<string, DataRow[]>();

  for (const row of sortedData) {
    const xStr = String(row[xChannel.field]);
    const series = String(row[colorField]);
    seriesKeys.add(series);
    xValueSet.add(xStr);
    rowsByXSeries.set(`${xStr}::${series}`, row);

    const existing = rowsByX.get(xStr);
    if (existing) {
      existing.push(row);
    } else {
      rowsByX.set(xStr, [row]);
    }
  }

  const keys = Array.from(seriesKeys);
  const xValues = Array.from(xValueSet);

  // Build a pivot table: one row per x value, one column per series
  const pivotData: Record<string, unknown>[] = xValues.map((xVal) => {
    const pivot: Record<string, unknown> = { __x__: xVal };
    for (const key of keys) {
      pivot[key] = 0;
    }
    // Fill in actual values from pre-grouped data
    const xRows = rowsByX.get(xVal);
    if (xRows) {
      for (const row of xRows) {
        const series = String(row[colorField]);
        pivot[series] = row[yChannel.field] ?? 0;
      }
    }
    return pivot;
  });

  // Resolve stack offset from the y channel's stack property
  const stackProp = yChannel.stack;
  const offsetFn =
    stackProp === 'normalize'
      ? stackOffsetExpand
      : stackProp === 'center'
        ? stackOffsetSilhouette
        : stackOffsetNone;

  // Use d3 stack to compute the stacked layout
  const stackGenerator = stack<Record<string, unknown>>()
    .keys(keys)
    .order(stackOrderNone)
    .offset(offsetFn);

  const stackedData = stackGenerator(pivotData);
  const yScale = scales.y.scale as ScaleLinear<number, number>;
  const marks: AreaMark[] = [];

  for (const layer of stackedData) {
    const seriesKey = layer.key;
    const color = getColor(scales, seriesKey);

    const validPoints: { x: number; yTop: number; yBottom: number }[] = [];

    for (const d of layer) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, d.data.__x__);

      if (xVal === null) continue;

      const yTop = yScale(d[1] as number);
      const yBottom = yScale(d[0] as number);

      validPoints.push({ x: xVal, yTop, yBottom });
    }

    if (validPoints.length === 0) continue;

    const stackCurve = resolveCurve(spec.markDef.interpolate);
    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((p) => p.x)
      .y0((p) => p.yBottom)
      .y1((p) => p.yTop)
      .curve(stackCurve);

    const pathStr = areaGenerator(validPoints) ?? '';

    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((p) => p.x)
      .y((p) => p.yTop)
      .curve(stackCurve);
    const topPathStr = topLineGenerator(validPoints) ?? '';

    const topPoints = validPoints.map((p) => ({ x: p.x, y: p.yTop }));
    const bottomPoints = validPoints.map((p) => ({ x: p.x, y: p.yBottom }));

    const aria: MarkAria = {
      label: `${seriesKey}: stacked area with ${validPoints.length} data points`,
    };

    marks.push({
      type: 'area',
      topPoints,
      bottomPoints,
      path: pathStr,
      topPath: topPathStr,
      fill: color,
      fillOpacity: 0.7, // Higher opacity for stacked so layers are visible
      stroke: getRepresentativeColor(color),
      strokeWidth: 1,
      seriesKey,
      data: layer.map((d) => {
        const xStr = String(d.data.__x__);
        return (rowsByXSeries.get(`${xStr}::${seriesKey}`) ?? d.data) as Record<string, unknown>;
      }),
      dataPoints: validPoints.map((p, idx) => {
        const xStr = String(layer[idx]?.data.__x__);
        const datum = (rowsByXSeries.get(`${xStr}::${seriesKey}`) ??
          layer[idx]?.data ??
          {}) as Record<string, unknown>;
        return { x: p.x, y: p.yTop, datum };
      }),
      aria,
    });
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute area marks from a normalized chart spec.
 *
 * For multi-series with color encoding, produces stacked areas.
 * For single series, produces a simple area fill from the line to baseline (y=0).
 */
export function computeAreaMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
): AreaMark[] {
  const encoding = spec.encoding as Encoding;
  const hasColor = !!encoding.color;

  if (hasColor) {
    return computeStackedArea(spec, scales, chartArea);
  }

  return computeSingleArea(spec, scales, chartArea);
}
