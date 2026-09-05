/**
 * Dot plot / lollipop chart mark computation.
 *
 * Category axis (band scale) + value axis (linear scale). Produces
 * PointMark[] for the dots plus RectMark[] for lollipop stems
 * (thin lines from axis baseline to each dot).
 *
 * When a color encoding is present (multi-series), renders as a dumbbell
 * chart: a connecting bar spans min-to-max per category instead of
 * baseline-to-dot stems.
 */

import type {
  Encoding,
  LayoutStrategy,
  MarkAria,
  PointMark,
  Rect,
  RectMark,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, getSequentialColor, groupByField, resolveKnockoutColor } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_RADIUS = 6;
const STEM_WIDTH = 2;
const STEM_COLOR = '#cccccc';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute dot plot marks from a normalized chart spec.
 *
 * Y axis uses a band scale for categories. X axis uses a linear scale
 * for values. When no color encoding is present, each data point produces
 * a lollipop stem + dot. When color is present (multi-series), renders
 * connecting bars between min/max values per category (dumbbell style).
 */
export function computeDotMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
  theme?: ResolvedTheme,
): (PointMark | RectMark)[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) {
    return [];
  }

  const xScale = scales.x.scale as ScaleLinear<number, number>;
  const yScale = scales.y.scale as ScaleBand<string>;

  // Band scale should provide bandwidth
  if (typeof yScale.bandwidth !== 'function') {
    return [];
  }

  const bandwidth = yScale.bandwidth();
  // Clamp baseline to the scale range so stems never extend past the plot area
  // (e.g., when domain doesn't include zero, xScale(0) would land outside).
  const [rangeStart, rangeEnd] = xScale.range();
  const rangeMin = Math.min(rangeStart, rangeEnd);
  const rangeMax = Math.max(rangeStart, rangeEnd);
  const baseline = Math.max(rangeMin, Math.min(rangeMax, xScale(0)));
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const isSequentialColor = colorEnc?.type === 'quantitative';
  const colorField = isSequentialColor ? undefined : colorEnc?.field;

  let marks: (PointMark | RectMark)[];

  // Multi-series (categorical): dumbbell chart with connecting bars
  if (colorField) {
    marks = computeDumbbellMarks(
      spec.data,
      xChannel.field,
      yChannel.field,
      colorField,
      xScale,
      yScale,
      bandwidth,
      scales,
      resolveKnockoutColor(theme),
    );
  } else {
    // Single series: lollipop stems from baseline
    marks = computeLollipopMarks(
      spec.data,
      xChannel.field,
      yChannel.field,
      xScale,
      yScale,
      bandwidth,
      baseline,
      scales,
      isSequentialColor,
      resolveKnockoutColor(theme),
    );
  }

  // Stamp keys on point marks (skip rect stems/connectors)
  const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
  const rawKeys = pointMarks.map((m) => {
    const cat = serializeKeyValue(m.data[yChannel.field]);
    const series = colorField ? String(m.data[colorField] ?? '') : '';
    return series ? `${series}|${cat}` : cat;
  });
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < pointMarks.length; i++) {
    pointMarks[i].key = keys[i];
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Dumbbell (multi-series)
// ---------------------------------------------------------------------------

/** Compute dumbbell marks: connecting bar + colored dots per category. */
function computeDumbbellMarks(
  data: readonly Record<string, unknown>[],
  valueField: string,
  categoryField: string,
  colorField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
  bandwidth: number,
  scales: ResolvedScales,
  dotKnockout: string,
): (PointMark | RectMark)[] {
  const marks: (PointMark | RectMark)[] = [];
  const categoryGroups = groupByField([...data], categoryField);

  for (const [category, rows] of categoryGroups) {
    const bandY = yScale(category);
    if (bandY === undefined) continue;

    const cy = bandY + bandwidth / 2;

    // Collect all x-values for this category to find the range
    const xValues: number[] = [];
    for (const row of rows) {
      const value = Number(row[valueField] ?? 0);
      if (Number.isFinite(value)) xValues.push(value);
    }

    if (xValues.length === 0) continue;

    const minVal = Math.min(...xValues);
    const maxVal = Math.max(...xValues);
    const xLeft = xScale(minVal);
    const xRight = xScale(maxVal);
    const barWidth = Math.abs(xRight - xLeft);

    // Connecting bar (rendered first so dots layer on top)
    if (barWidth > 0) {
      const stemAria: MarkAria = {
        label: `Range for ${category}: ${minVal} to ${maxVal}`,
      };

      marks.push({
        type: 'rect',
        x: Math.min(xLeft, xRight),
        y: cy - STEM_WIDTH / 2,
        width: barWidth,
        height: STEM_WIDTH,
        fill: STEM_COLOR,
        data: rows[0] as Record<string, unknown>,
        aria: stemAria,
      });
    }

    // Individual dots for each series value
    for (const row of rows) {
      const value = Number(row[valueField] ?? 0);
      if (!Number.isFinite(value)) continue;

      const cx = xScale(value);
      const colorCategory = String(row[colorField] ?? '');
      const color = getColor(scales, colorCategory);

      const dotAria: MarkAria = {
        label: `${category}, ${colorCategory}: ${value}`,
      };

      marks.push({
        type: 'point',
        cx,
        cy,
        r: DOT_RADIUS,
        fill: color,
        stroke: dotKnockout,
        strokeWidth: 2,
        data: row as Record<string, unknown>,
        aria: dotAria,
      });
    }
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Lollipop (single series)
// ---------------------------------------------------------------------------

/** Compute lollipop marks: stem from baseline + dot. */
function computeLollipopMarks(
  data: readonly Record<string, unknown>[],
  valueField: string,
  categoryField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
  isSequentialColor = false,
  dotKnockout = '#ffffff',
): (PointMark | RectMark)[] {
  const marks: (PointMark | RectMark)[] = [];

  for (const row of data) {
    const category = String(row[categoryField] ?? '');
    const value = Number(row[valueField] ?? 0);
    if (!Number.isFinite(value)) continue;

    const bandY = yScale(category);
    if (bandY === undefined) continue;

    const cx = xScale(value);
    const cy = bandY + bandwidth / 2;

    const color = isSequentialColor
      ? getSequentialColor(scales, value)
      : getColor(scales, '__default__');

    // Stem: thin rectangle from baseline to dot center
    const stemX = Math.min(baseline, cx);
    const stemWidth = Math.abs(cx - baseline);

    if (stemWidth > 0) {
      const stemAria: MarkAria = {
        label: `Stem for ${category}`,
      };

      marks.push({
        type: 'rect',
        x: stemX,
        y: cy - STEM_WIDTH / 2,
        width: stemWidth,
        height: STEM_WIDTH,
        fill: STEM_COLOR,
        data: row as Record<string, unknown>,
        aria: stemAria,
      });
    }

    // Dot
    const dotAria: MarkAria = {
      label: `${category}: ${value}`,
    };

    marks.push({
      type: 'point',
      cx,
      cy,
      r: DOT_RADIUS,
      fill: color,
      stroke: dotKnockout,
      strokeWidth: 2,
      data: row as Record<string, unknown>,
      aria: dotAria,
    });
  }

  return marks;
}
