/**
 * Area chart mark computation.
 *
 * Uses D3 area() generator to produce AreaMark[] with top/bottom
 * boundary points and SVG path strings. Supports single areas and
 * stacked areas via d3-shape stack layout.
 */

import type { AreaMark, DataRow, Encoding, MarkAria, Rect } from '@opendata-ai/core';
import type { ScaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line, stack, stackOffsetNone, stackOrderNone } from 'd3-shape';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { D3ContinuousScale, ResolvedScales } from '../../layout/scales';
import { getColor, scaleValue } from '../utils';

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
  const colorField = encoding.color?.field;
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

    // Compute points, filtering out null values
    const validPoints: { x: number; yTop: number; yBottom: number; row: DataRow }[] = [];

    for (const row of rows) {
      const xVal = scaleValue(
        scales.x.scale as D3ContinuousScale,
        scales.x.type,
        row[xChannel.field],
      );
      const yVal = scaleValue(
        scales.y.scale as D3ContinuousScale,
        scales.y.type,
        row[yChannel.field],
      );

      if (xVal === null || yVal === null) continue;

      validPoints.push({
        x: xVal,
        yTop: yVal,
        yBottom: baselineY,
        row,
      });
    }

    if (validPoints.length === 0) continue;

    // Build the area path
    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((d) => d.x)
      .y0((d) => d.yBottom)
      .y1((d) => d.yTop)
      .curve(curveMonotoneX);

    const pathStr = areaGenerator(validPoints) ?? '';

    // Top-line path for stroking only the data line (not the baseline)
    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((d) => d.x)
      .y((d) => d.yTop)
      .curve(curveMonotoneX);
    const topPathStr = topLineGenerator(validPoints) ?? '';

    const topPoints = validPoints.map((p) => ({ x: p.x, y: p.yTop }));
    const bottomPoints = validPoints.map((p) => ({ x: p.x, y: p.yBottom }));

    const ariaLabel =
      seriesKey === '__default__'
        ? `Area with ${validPoints.length} data points`
        : `${seriesKey}: area with ${validPoints.length} data points`;

    const aria: MarkAria = { label: ariaLabel };

    marks.push({
      type: 'area',
      topPoints,
      bottomPoints,
      path: pathStr,
      topPath: topPathStr,
      fill: color,
      fillOpacity: DEFAULT_FILL_OPACITY,
      stroke: color,
      strokeWidth: 2,
      seriesKey: seriesKey === '__default__' ? undefined : seriesKey,
      data: validPoints.map((p) => p.row),
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
  const colorField = encoding.color?.field;

  if (!xChannel || !yChannel || !scales.x || !scales.y || !colorField) {
    // If no color field, can't stack -- fall back to single area
    return computeSingleArea(spec, scales, chartArea);
  }

  // Collect unique series keys and x values, and build a lookup from
  // (x-value, series-key) -> original data row so stacked area marks
  // get original rows instead of pivot rows.
  const seriesKeys = new Set<string>();
  const xValueSet = new Set<string>();
  const rowsByXSeries = new Map<string, DataRow>();
  const rowsByX = new Map<string, DataRow[]>();

  for (const row of spec.data) {
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

  // Use d3 stack to compute the stacked layout
  const stackGenerator = stack<Record<string, unknown>>()
    .keys(keys)
    .order(stackOrderNone)
    .offset(stackOffsetNone);

  const stackedData = stackGenerator(pivotData);
  const yScale = scales.y.scale as ScaleLinear<number, number>;
  const marks: AreaMark[] = [];

  for (const layer of stackedData) {
    const seriesKey = layer.key;
    const color = getColor(scales, seriesKey);

    const validPoints: { x: number; yTop: number; yBottom: number }[] = [];

    for (const d of layer) {
      const xVal = scaleValue(scales.x.scale as D3ContinuousScale, scales.x.type, d.data.__x__);

      if (xVal === null) continue;

      const yTop = yScale(d[1] as number);
      const yBottom = yScale(d[0] as number);

      validPoints.push({ x: xVal, yTop, yBottom });
    }

    if (validPoints.length === 0) continue;

    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((p) => p.x)
      .y0((p) => p.yBottom)
      .y1((p) => p.yTop)
      .curve(curveMonotoneX);

    const pathStr = areaGenerator(validPoints) ?? '';

    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((p) => p.x)
      .y((p) => p.yTop)
      .curve(curveMonotoneX);
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
      stroke: color,
      strokeWidth: 1,
      seriesKey,
      data: layer.map((d) => {
        const xStr = String(d.data.__x__);
        return (rowsByXSeries.get(`${xStr}::${seriesKey}`) ?? d.data) as Record<string, unknown>;
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
