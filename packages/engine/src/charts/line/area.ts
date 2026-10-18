/**
 * Area chart mark computation.
 *
 * Uses D3 area() generator to produce AreaMark[] with top/bottom
 * boundary points and SVG path strings.
 *
 * Multi-series behavior (v8: VL-aligned defaults):
 * - Default for multi-series with `color` is **stacked** from a zero baseline.
 * - Overlap rendering is opt-out via `encoding.y.stack: null | false`.
 * - Single series always renders one gradient-filled area.
 */

import type {
  AreaMark,
  DataRow,
  Encoding,
  MarkAria,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { getRepresentativeColor, isGradientDef } from '@opendata-ai/openchart-core';
import type { ScaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeAreaStack } from '../../data/area-stack';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, resolveSeriesStroke, scaleValue, sortByField } from '../utils';
import { LINE_STROKE_WIDTH } from './compute';
import { resolveCurve } from './curves';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FILL_OPACITY = 0.15;

/**
 * Resolve `encoding.y.stack` to a boolean: should we stack this area chart?
 *
 * Vega-Lite-aligned semantics:
 * - undefined | true | 'zero' | 'normalize' | 'center' -> stacked (default)
 * - null | false -> overlap (opt-out)
 */
function isStacked(stackProp: unknown): boolean {
  return stackProp !== null && stackProp !== false;
}

// Gradient stops calibrated by series count. Solo areas can carry a slightly
// richer fill because there's no overlap to manage; multi-series overlap needs
// lighter stops so layered bands stay legible. Both fade to zero, in the
// 12-20% product-chart band -- a heavier wash competes with the line itself.
const SOLO_GRADIENT_STOPS = [
  { offset: 0, opacity: 0.2 },
  { offset: 1, opacity: 0 },
];

const OVERLAP_GRADIENT_STOPS = [
  { offset: 0, opacity: 0.14 },
  { offset: 1, opacity: 0 },
];

// Stacked bands render FLAT. A vertical gradient inside a stacked band reads as
// a value change within the band, which is exactly the thing a stacked area is
// meant to encode with height; every editorial reference stacks flat.
const STACKED_FILL_OPACITY = 0.92;

function buildGradientFill(
  colorStr: string,
  stops: ReadonlyArray<{ offset: number; opacity: number }>,
): import('@opendata-ai/openchart-core').GradientDef {
  return {
    gradient: 'linear',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: stops.map((s) => ({ offset: s.offset, color: colorStr, opacity: s.opacity })),
  };
}

// ---------------------------------------------------------------------------
// Single / overlap area (non-stacked)
// ---------------------------------------------------------------------------

/**
 * Compute area marks for non-stacked rendering.
 *
 * - With no `color` field: emits a single area with the solo gradient.
 * - With a `color` field (overlap mode): emits one area per series, each
 *   anchored at the y-domain baseline and using the lighter overlap gradient.
 */
function computeSingleArea(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  theme?: ResolvedTheme,
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

  const isMultiSeries = colorField !== undefined && groups.size > 1;
  const defaultGradientStops = isMultiSeries ? OVERLAP_GRADIENT_STOPS : SOLO_GRADIENT_STOPS;

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
    const segments: (typeof validPoints)[] = [[]];

    // Check for y2 channel (band between y and y2)
    const y2Channel = (encoding as Encoding & { y2?: { field: string; type: string } }).y2;

    for (const row of sortedRows) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
      const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);

      const yBottomVal = y2Channel
        ? scaleValue(scales.y.scale, scales.y.type, row[y2Channel.field])
        : baselineY;
      if (xVal === null || yVal === null || yBottomVal === null) {
        if (segments[segments.length - 1].length > 0) segments.push([]);
        continue;
      }

      const point = { x: xVal, yTop: yVal, yBottom: yBottomVal, row };
      validPoints.push(point);
      segments[segments.length - 1].push(point);
    }

    if (validPoints.length === 0) continue;

    // Build the area path with configured interpolation
    const curve = resolveCurve(spec.markDef.interpolate);
    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((d) => d.x)
      .y0((d) => d.yBottom)
      .y1((d) => d.yTop)
      .curve(curve);

    const pathStr = segments.map((segment) => areaGenerator(segment) ?? '').join(' ');

    // Top-line path for stroking only the data line (not the baseline)
    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((d) => d.x)
      .y((d) => d.yTop)
      .curve(curve);
    const topPathStr = segments.map((segment) => topLineGenerator(segment) ?? '').join(' ');

    const topPoints = validPoints.map((p) => ({ x: p.x, y: p.yTop }));
    const bottomPoints = validPoints.map((p) => ({ x: p.x, y: p.yBottom }));

    const ariaLabel =
      seriesKey === '__default__'
        ? `Area with ${validPoints.length} data points`
        : `${seriesKey}: area with ${validPoints.length} data points`;

    const aria: MarkAria = { label: ariaLabel };

    // Allow markDef.fill to override color with a gradient.
    // When a gradient is provided, set fillOpacity=1 so gradient stop-opacity controls the fade.
    // When no fill is provided, auto-generate a top-to-bottom fade gradient
    // tuned to series count (lighter for overlap).
    const markFill = spec.markDef.fill;
    let fillValue: string | import('@opendata-ai/openchart-core').GradientDef;
    let fillOpacity: number;

    if (markFill != null) {
      fillValue = markFill;
      fillOpacity = isGradientDef(markFill)
        ? 1
        : (spec.markDef.fillOpacity ??
          spec.markDef.opacity ??
          (y2Channel ? 0.25 : DEFAULT_FILL_OPACITY));
    } else if (spec.markDef.fillOpacity != null) {
      // An explicit fillOpacity means the author wants a flat translucent
      // fill in the series color. Gradients and overlapping fills are
      // mutually exclusive: two stacked fades read as mud, which is exactly
      // the case overlapping density curves need to get right.
      fillValue = getRepresentativeColor(color);
      fillOpacity = spec.markDef.fillOpacity;
    } else {
      const colorStr = getRepresentativeColor(color);
      fillValue = buildGradientFill(colorStr, defaultGradientStops);
      fillOpacity = 1;
    }

    const keyField = encoding.key && 'field' in encoding.key ? encoding.key.field : undefined;
    const rawPointKeys = validPoints.map((p) =>
      keyField ? serializeKeyValue(p.row[keyField]) : serializeKeyValue(p.row[xChannel.field]),
    );

    marks.push({
      type: 'area',
      key: seriesKey === '__default__' ? 'area' : seriesKey,
      pointKeys: dedupeKeys(rawPointKeys),
      interpolate: spec.markDef.interpolate ?? 'monotone',
      topPoints,
      bottomPoints,
      path: pathStr,
      topPath: topPathStr,
      fill: fillValue,
      fillOpacity: fillOpacity,
      // The top edge is a foreground stroke, so it goes through the same
      // light-canvas adaptation as a line mark's stroke. Otherwise the area's
      // own top path and the LineMark the renderer draws over it (both from
      // this series color) come out as two different colors.
      stroke:
        spec.markDef.stroke ??
        resolveSeriesStroke(spec, isGradientDef(fillValue) ? color : fillValue, theme),
      strokeWidth: spec.markDef.strokeWidth ?? LINE_STROKE_WIDTH,
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
  theme?: ResolvedTheme,
): AreaMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;

  if (!xChannel || !yChannel || !scales.x || !scales.y || !colorField) {
    // If no color field, can't stack -- fall back to single area
    return computeSingleArea(spec, scales, chartArea, theme);
  }

  const stackProp = yChannel.stack;
  const { stackedData, rowsByXSeries, missingBoundaries } = computeAreaStack(
    spec.data,
    xChannel.field,
    yChannel.field,
    colorField,
    xChannel.type,
    yChannel.stack,
    spec.areaStackCache,
  );
  const yScale = scales.y.scale as ScaleLinear<number, number>;
  const marks: AreaMark[] = [];

  for (const layer of stackedData) {
    const seriesKey = layer.key;
    const color = getColor(scales, seriesKey);

    const validPoints: {
      x: number;
      yTop: number;
      yBottom: number;
      xKey: string;
      datum: DataRow;
      observed: boolean;
      segment: number;
    }[] = [];
    const segments: (typeof validPoints)[] = [[]];

    for (const d of layer) {
      const xVal = scaleValue(scales.x.scale, scales.x.type, d.data.__x__);

      const xKey = String(d.data.__x__);
      const yTop = yScale(d[1] as number);
      const yBottom = yScale(d[0] as number);
      if (
        xVal === null ||
        missingBoundaries.has(xKey) ||
        !Number.isFinite(yTop) ||
        !Number.isFinite(yBottom)
      ) {
        if (segments[segments.length - 1].length > 0) segments.push([]);
        continue;
      }

      const datum = rowsByXSeries.get(`${xKey}::${seriesKey}`) ?? d.data;
      const point = {
        x: xVal,
        yTop,
        yBottom,
        xKey,
        datum,
        observed: rowsByXSeries.has(`${xKey}::${seriesKey}`),
        segment: segments.length - 1,
      };
      validPoints.push(point);
      segments[segments.length - 1].push(point);
    }

    if (validPoints.length === 0) continue;

    const stackCurve = resolveCurve(spec.markDef.interpolate);
    const areaGenerator = area<{ x: number; yTop: number; yBottom: number }>()
      .x((p) => p.x)
      .y0((p) => p.yBottom)
      .y1((p) => p.yTop)
      .curve(stackCurve);

    const pathStr = segments.map((segment) => areaGenerator(segment) ?? '').join(' ');

    const topLineGenerator = line<{ x: number; yTop: number }>()
      .x((p) => p.x)
      .y((p) => p.yTop)
      .curve(stackCurve);
    const topPathStr = segments.map((segment) => topLineGenerator(segment) ?? '').join(' ');

    const topPoints = validPoints.map((p) => ({ x: p.x, y: p.yTop }));
    const bottomPoints = validPoints.map((p) => ({ x: p.x, y: p.yBottom }));

    const aria: MarkAria = {
      label: `${seriesKey}: stacked area with ${validPoints.length} data points`,
    };

    // Flat per-layer fill. User-supplied markDef.fill (string or gradient)
    // overrides it just like in single-area mode.
    const markFill = spec.markDef.fill;
    let fillValue: string | import('@opendata-ai/openchart-core').GradientDef;
    let fillOpacity: number;

    if (markFill != null) {
      fillValue = markFill;
      fillOpacity = isGradientDef(markFill)
        ? 1
        : (spec.markDef.fillOpacity ?? spec.markDef.opacity ?? 0.7);
    } else {
      fillValue = getRepresentativeColor(color);
      // Same precedence as the non-stacked path: an explicit fillOpacity is
      // the author's, and stacking shouldn't quietly overwrite it.
      fillOpacity = spec.markDef.fillOpacity ?? STACKED_FILL_OPACITY;
    }

    const rawPointKeys = validPoints.map((point) => serializeKeyValue(point.xKey));

    marks.push({
      type: 'area',
      key: seriesKey,
      pointKeys: dedupeKeys(rawPointKeys),
      interpolate: spec.markDef.interpolate ?? 'monotone',
      topPoints,
      bottomPoints,
      path: pathStr,
      topPath: topPathStr,
      fill: fillValue,
      fillOpacity,
      stroke: resolveSeriesStroke(spec, color, theme),
      strokeWidth: 1,
      seriesKey,
      stacked: true,
      stackNormalized: stackProp === 'normalize',
      data: validPoints.map((point) => point.datum),
      dataPoints: validPoints.map((point) => ({
        x: point.x,
        y: point.yTop,
        yBottom: point.yBottom,
        datum: point.datum,
        observed: point.observed,
        segment: point.segment,
      })),
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
 * Behavior depends on `encoding.y.stack` (Vega-Lite aligned):
 * - `undefined | true | 'zero' | 'normalize' | 'center'` -> stacked (default for multi-series)
 * - `null | false` -> overlap
 *
 * Single-series specs always render one gradient-filled area; the `stack`
 * branch only matters when a `color` encoding is present.
 */
export function computeAreaMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  theme?: ResolvedTheme,
): AreaMark[] {
  const encoding = spec.encoding as Encoding;
  const yChannel = encoding.y;

  let marks: AreaMark[];
  if (yChannel && isStacked(yChannel.stack)) {
    marks = computeStackedArea(spec, scales, chartArea, theme);
  } else {
    marks = computeSingleArea(spec, scales, chartArea, theme);
  }

  // Dedupe area mark keys
  const areaKeys = dedupeKeys(marks.map((m) => m.key!));
  marks.forEach((m, i) => {
    m.key = areaKeys[i];
  });

  const highlight = spec.highlight ?? [];
  if (highlight.length > 0) {
    const highlightSet = new Set(highlight);
    marks.sort((a, b) => {
      const aMuted = a.seriesKey != null && !highlightSet.has(a.seriesKey);
      const bMuted = b.seriesKey != null && !highlightSet.has(b.seriesKey);
      if (aMuted === bMuted) return 0;
      return aMuted ? -1 : 1;
    });
  }

  return marks;
}
