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
  LayoutStrategy,
  LineMark,
  MarkAria,
  PointMark,
  Rect,
} from '@opendata-ai/openchart-core';
import { curveMonotoneX, line } from 'd3-shape';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, groupByField, scaleValue, sortByField } from '../utils';

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

  const colorField = encoding.color?.field;
  const groups = groupByField(spec.data, colorField);
  const marks: (LineMark | PointMark)[] = [];

  for (const [seriesKey, rows] of groups) {
    const color = getColor(scales, seriesKey);

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

    // Build the D3 line generator with monotone interpolation
    const lineGenerator = line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveMonotoneX);

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

    // Create the LineMark with the combined path points.
    // The points array includes all valid points across all segments.
    const lineMark: LineMark = {
      type: 'line',
      points: allPoints,
      path: combinedPath,
      stroke: color,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      seriesKey: seriesKey === '__default__' ? undefined : seriesKey,
      data: pointsWithData.map((p) => p.row),
      aria,
    };

    marks.push(lineMark);

    // Create point marks for hover targets
    for (let i = 0; i < pointsWithData.length; i++) {
      const p = pointsWithData[i];
      const pointMark: PointMark = {
        type: 'point',
        cx: p.x,
        cy: p.y,
        r: DEFAULT_POINT_RADIUS,
        fill: color,
        stroke: '#ffffff',
        strokeWidth: 1.5,
        fillOpacity: 0,
        data: p.row,
        aria: {
          label: `Data point: ${xChannel.field}=${String(p.row[xChannel.field])}, ${yChannel.field}=${String(p.row[yChannel.field])}`,
        },
      };
      marks.push(pointMark);
    }
  }

  return marks;
}
