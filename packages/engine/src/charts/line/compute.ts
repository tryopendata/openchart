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
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { adaptForLightLineStroke, getRepresentativeColor } from '@opendata-ai/openchart-core';
import { line } from 'd3-shape';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, getSequentialColor, groupByField, scaleValue, sortByField } from '../utils';
import { resolveCurve } from './curves';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default stroke width for line marks. Sparklines use the same width so the
 *  visual weight matches the rest of the chart family. */
const DEFAULT_STROKE_WIDTH = 1.5;

/** Default radius for point marks (hover targets). */
const DEFAULT_POINT_RADIUS = 3;

/** Dash patterns cycled through by the strokeDash encoding, assigned in the
 *  ordinal (first-seen data) order of the field values. The first value
 *  renders solid so single-value charts keep the default look. */
const STROKE_DASH_PATTERNS = ['', '6 4', '2 3', '8 4 2 4', '4 4', '1 3'];

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
  theme?: ResolvedTheme,
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
  // strokeDash encoding: differentiate series by dash pattern (VL aligned).
  // Without a color channel, the strokeDash field becomes the series grouping
  // so each dash value renders as its own line. With a color channel, each
  // series takes the dash of its first row (typically the same field).
  const dashEnc =
    encoding.strokeDash && 'field' in encoding.strokeDash ? encoding.strokeDash : undefined;
  const dashField = dashEnc?.field;
  const dashIndexByValue = new Map<string, number>();
  if (dashField) {
    for (const row of spec.data) {
      const value = row[dashField];
      if (value == null) continue;
      const key = String(value);
      if (!dashIndexByValue.has(key)) dashIndexByValue.set(key, dashIndexByValue.size);
    }
  }
  const groups = groupByField(spec.data, colorField ?? dashField);
  const mutedMarks: (LineMark | PointMark)[] = [];
  const highlightedMarks: (LineMark | PointMark)[] = [];
  const highlight = spec.highlight ?? [];
  const highlightActive = highlight.length > 0;

  for (const [seriesKey, rows] of groups) {
    // For sequential color, use a mid-range color for the line stroke
    const color: string | GradientDef = isSequentialColor
      ? getSequentialColor(scales, _getMidValue(rows, sequentialColorField!))
      : getColor(scales, seriesKey);
    // markDef.stroke wins over the scale-derived color when set explicitly.
    // Sparkline mode injects this via applySparklineDefaults to carry the
    // trend color; users can also set it directly to override the palette.
    //
    // A palette-derived stroke on a light canvas goes through
    // adaptForLightLineStroke first: the accent (cyan-500) is tuned as a fill
    // and only clears 2.4:1 on white, which is too thin for a 2px line. The
    // darkened variant clears 3:1. An explicit markDef.stroke is the author's
    // call and passes through untouched, as does anything on a dark canvas.
    const strokeColor =
      spec.markDef.stroke ??
      (theme && !theme.isDark
        ? adaptForLightLineStroke(getRepresentativeColor(color))
        : getRepresentativeColor(color));

    // Sort rows by x-axis field so lines draw left-to-right.
    // For nominal/ordinal axes, preserve data order since there's no
    // natural sort and the scale domain already reflects intended order.
    const sortedRows =
      xChannel.type === 'nominal' || xChannel.type === 'ordinal'
        ? rows
        : sortByField(rows, xChannel.field);

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

    const isMuted = highlightActive && !highlight.includes(seriesKey);
    let resolvedStrokeWidth =
      styleOverride?.strokeWidth ?? spec.markDef.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    if (isMuted) {
      resolvedStrokeWidth = Math.max(1, resolvedStrokeWidth * 0.75);
    }

    // Map lineStyle to SVG strokeDasharray. Explicit seriesStyles win over
    // the strokeDash encoding.
    let strokeDasharray: string | undefined;
    if (styleOverride?.lineStyle === 'dashed') strokeDasharray = '6 4';
    else if (styleOverride?.lineStyle === 'dotted') strokeDasharray = '2 3';
    else if (dashField) {
      const dashValue = rows[0]?.[dashField];
      if (dashValue != null) {
        const idx = dashIndexByValue.get(String(dashValue)) ?? 0;
        const pattern = STROKE_DASH_PATTERNS[idx % STROKE_DASH_PATTERNS.length];
        if (pattern) strokeDasharray = pattern;
      }
    }

    // Create the LineMark with the combined path points.
    // The points array includes all valid points across all segments.
    // dataPoints carries pixel coordinates + original data for voronoi tooltip overlay.
    const keyField = encoding.key && 'field' in encoding.key ? encoding.key.field : undefined;
    const rawPointKeys = pointsWithData.map((p) =>
      keyField ? serializeKeyValue(p.row[keyField]) : serializeKeyValue(p.row[xChannel.field]),
    );

    const lineMark: LineMark = {
      type: 'line',
      key: seriesStyleKey ?? 'series',
      pointKeys: dedupeKeys(rawPointKeys),
      interpolate: spec.markDef.interpolate ?? 'monotone',
      points: allPoints,
      path: combinedPath,
      stroke: strokeColor,
      strokeWidth: resolvedStrokeWidth,
      strokeDasharray,
      opacity: styleOverride?.opacity,
      seriesKey: seriesStyleKey,
      data: pointsWithData.map((p) => p.row),
      dataPoints: pointsWithData.map((p) => ({ x: p.x, y: p.y, datum: p.row })),
      aria,
    };

    const bucket = isMuted ? mutedMarks : highlightedMarks;
    bucket.push(lineMark);

    // Emit PointMark objects when markDef.point is truthy, or when sequential
    // color is active (points carry the gradient since SVG paths are single-color).
    const markPoint = spec.markDef.point;
    const isSingleEndpoint = markPoint === 'last' || markPoint === 'first';
    const showPoints =
      markPoint === true ||
      markPoint === 'transparent' ||
      markPoint === 'endpoints' ||
      isSingleEndpoint ||
      isSequentialColor;

    if (showPoints) {
      const isTransparent = markPoint === 'transparent';
      const isEndpoints = markPoint === 'endpoints';
      // Also respect per-series showPoints override
      const seriesShowPoints = styleOverride?.showPoints !== false;
      const lastIdx = pointsWithData.length - 1;

      for (let i = 0; i < pointsWithData.length; i++) {
        const p = pointsWithData[i];
        const isEndpoint = i === 0 || i === lastIdx;
        const isLast = i === lastIdx;
        const isFirst = i === 0;
        // Single-endpoint mode ('last' / 'first'): emit only the chosen point.
        // Skip the others entirely instead of emitting invisible placeholders.
        if (isSingleEndpoint) {
          if (markPoint === 'last' && !isLast) continue;
          if (markPoint === 'first' && !isFirst) continue;
        }
        const visible = seriesShowPoints && !isTransparent && (!isEndpoints || isEndpoint);
        // Sequential color: each point gets colored by its data value
        let pointColor = color;
        if (isSequentialColor) {
          const val = Number(p.row[sequentialColorField!]);
          pointColor = Number.isFinite(val) ? getSequentialColor(scales, val) : color;
        }
        const hollow = isEndpoints && visible;
        const pointColorStr = getRepresentativeColor(pointColor);
        // 'last' / 'first' render as a tight filled terminator dot in the line
        // color — no white halo, no hollow ring. Marked decorative because the
        // data point already exists on the line and gets described by the a11y
        // data table; the dot is purely visual.
        const pointKey = keyField
          ? serializeKeyValue(p.row[keyField])
          : seriesStyleKey
            ? `${seriesStyleKey}|${serializeKeyValue(p.row[xChannel.field])}`
            : serializeKeyValue(p.row[xChannel.field]);
        if (isSingleEndpoint) {
          bucket.push({
            type: 'point',
            key: pointKey,
            cx: p.x,
            cy: p.y,
            r: 3.5,
            fill: strokeColor,
            stroke: 'transparent',
            strokeWidth: 0,
            fillOpacity: 1,
            data: p.row,
            aria: { decorative: true },
          });
          continue;
        }
        const pointMark: PointMark = {
          type: 'point',
          key: pointKey,
          cx: p.x,
          cy: p.y,
          r: visible ? DEFAULT_POINT_RADIUS : 0,
          fill: hollow ? 'transparent' : pointColorStr,
          stroke: hollow ? pointColorStr : visible ? '#ffffff' : 'transparent',
          strokeWidth: visible ? 1.5 : 0,
          fillOpacity: isTransparent ? 0 : 1,
          data: p.row,
          aria: {
            label: `Data point: ${xChannel.field}=${String(p.row[xChannel.field])}, ${yChannel.field}=${String(p.row[yChannel.field])}`,
          },
        };
        bucket.push(pointMark);
      }
    }
  }

  const allMarks = [...mutedMarks, ...highlightedMarks];

  // Dedupe series-level keys across all line marks
  const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
  const lineKeys = dedupeKeys(lineMarks.map((m) => m.key!));
  lineMarks.forEach((m, i) => {
    m.key = lineKeys[i];
  });

  // Dedupe point mark keys
  const pointMarks = allMarks.filter((m): m is PointMark => m.type === 'point');
  if (pointMarks.length > 0) {
    const pointKeys = dedupeKeys(pointMarks.map((m) => m.key ?? ''));
    pointMarks.forEach((m, i) => {
      m.key = pointKeys[i];
    });
  }

  return allMarks;
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
