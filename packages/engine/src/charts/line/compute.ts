/**
 * Line chart mark computation.
 *
 * Takes a normalized chart spec with resolved scales and produces
 * LineMark[] and PointMark[] arrays for rendering. Groups data by
 * color field for multi-series, uses D3 line() generator for SVG
 * path computation, and handles missing data with line breaks.
 */

import type {
  DataRow,
  Encoding,
  GradientDef,
  LayoutStrategy,
  LineMark,
  MarkAria,
  PointMark,
  Rect,
} from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import { line } from 'd3-shape';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, getSequentialColor, groupByField, scaleValue, sortByField } from '../utils';
import { resolveCurve } from './curves';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default stroke width for line marks. */
const DEFAULT_STROKE_WIDTH = 2.5;

/** Default radius for point marks (hover targets). */
const DEFAULT_POINT_RADIUS = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute line marks from a normalized chart spec.
 *
 * Produces one LineMark per series (grouped by color field) plus
 * PointMark entries at each data point for hover targets. Missing
 * data (null/undefined y values) breaks the line path.
 */
export function computeLineMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
): (LineMark | PointMark)[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) {
    return [];
  }

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const isSequentialColor = colorEnc?.type === 'quantitative';
  // Sequential color: single series, per-point coloring. Categorical: group by color field.
  const colorField = isSequentialColor ? undefined : colorEnc?.field;
  const sequentialColorField = isSequentialColor ? colorEnc.field : undefined;
  const groups = groupByField(spec.data, colorField);
  const marks: (LineMark | PointMark)[] = [];

  for (const [seriesKey, rows] of groups) {
    // For sequential color, use a mid-range color for the line stroke
    const color: string | GradientDef = isSequentialColor
      ? getSequentialColor(scales, _getMidValue(rows, sequentialColorField!))
      : getColor(scales, seriesKey);
    const strokeColor = getRepresentativeColor(color);

    // Sort rows by x-axis field so lines draw left-to-right
    const sortedRows = sortByField(rows, xChannel.field);

    // Compute pixel positions for each data point, preserving nulls
    // for line break handling
    const pointsWithData: {
      x: number;
      y: number;
      row: DataRow;
    }[] = [];

    // We need to track segments separated by null values
    const segments: { x: number; y: number }[][] = [];
    let currentSegment: { x: number; y: number }[] = [];

    for (const row of sortedRows) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
      const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);

      if (xVal === null || yVal === null) {
        // Break the line here. Push current segment if non-empty.
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        continue;
      }

      const point = { x: xVal, y: yVal };
      currentSegment.push(point);
      pointsWithData.push({ ...point, row });
    }

    // Push the last segment
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    // Build the D3 line generator with configured interpolation
    const curve = resolveCurve(spec.markDef.interpolate);
    const lineGenerator = line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curve);

    // Combine all segments into a single path string with M/L commands.
    // Each segment starts a new M (moveto) command, creating line breaks
    // where data is missing.
    const allPoints: { x: number; y: number }[] = [];
    const pathParts: string[] = [];

    for (const segment of segments) {
      if (segment.length === 0) continue;
      const pathStr = lineGenerator(segment);
      if (pathStr) {
        pathParts.push(pathStr);
      }
      allPoints.push(...segment);
    }

    // Skip this series if there are no valid data points
    if (allPoints.length === 0) continue;

    const ariaLabel =
      seriesKey === '__default__'
        ? `Line with ${allPoints.length} data points`
        : `${seriesKey}: line with ${allPoints.length} data points`;

    const aria: MarkAria = {
      label: ariaLabel,
    };

    // Combine D3 curve path segments into a single path string.
    // Each segment produces a smooth monotone curve; line breaks between
    // segments are created by starting a new M command.
    const combinedPath = pathParts.join(' ');

    // Look up per-series style overrides
    const seriesStyleKey = seriesKey === '__default__' ? undefined : seriesKey;
    const styleOverride = seriesStyleKey ? spec.seriesStyles?.[seriesStyleKey] : undefined;

    // Map lineStyle to SVG strokeDasharray
    let strokeDasharray: string | undefined;
    if (styleOverride?.lineStyle === 'dashed') strokeDasharray = '6 4';
    else if (styleOverride?.lineStyle === 'dotted') strokeDasharray = '2 3';

    // Create the LineMark with the combined path points.
    // The points array includes all valid points across all segments.
    // dataPoints carries pixel coordinates + original data for voronoi tooltip overlay.
    const lineMark: LineMark = {
      type: 'line',
      points: allPoints,
      path: combinedPath,
      stroke: strokeColor,
      strokeWidth: styleOverride?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      strokeDasharray,
      opacity: styleOverride?.opacity,
      seriesKey: seriesStyleKey,
      data: pointsWithData.map((p) => p.row),
      dataPoints: pointsWithData.map((p) => ({ x: p.x, y: p.y, datum: p.row })),
      aria,
    };

    marks.push(lineMark);

    // Emit PointMark objects when markDef.point is truthy, or when sequential
    // color is active (points carry the gradient since SVG paths are single-color).
    const markPoint = spec.markDef.point;
    const showPoints = markPoint === true || markPoint === 'transparent' || isSequentialColor;

    if (showPoints) {
      const isTransparent = markPoint === 'transparent';
      // Also respect per-series showPoints override
      const seriesShowPoints = styleOverride?.showPoints !== false;

      for (let i = 0; i < pointsWithData.length; i++) {
        const p = pointsWithData[i];
        const visible = seriesShowPoints && !isTransparent;
        // Sequential color: each point gets colored by its data value
        let pointColor = color;
        if (isSequentialColor) {
          const val = Number(p.row[sequentialColorField!]);
          pointColor = Number.isFinite(val) ? getSequentialColor(scales, val) : color;
        }
        const pointMark: PointMark = {
          type: 'point',
          cx: p.x,
          cy: p.y,
          r: visible ? DEFAULT_POINT_RADIUS : 0,
          fill: pointColor,
          stroke: visible ? '#ffffff' : 'transparent',
          strokeWidth: visible ? 1.5 : 0,
          fillOpacity: isTransparent ? 0 : 1,
          data: p.row,
          aria: {
            label: `Data point: ${xChannel.field}=${String(p.row[xChannel.field])}, ${yChannel.field}=${String(p.row[yChannel.field])}`,
          },
        };
        marks.push(pointMark);
      }
    }
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the midpoint numeric value of a field across rows (for sequential line stroke). */
function _getMidValue(rows: DataRow[], field: string): number {
  const values = rows.map((r) => Number(r[field])).filter(Number.isFinite);
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
