/**
 * Column chart (vertical bars) mark computation.
 *
 * Takes a normalized chart spec with resolved scales and produces
 * RectMark[] for rendering vertical columns. When a color encoding
 * is present, columns are either stacked (cumulative heights) or grouped
 * (side-by-side) based on the `stack` property of the quantitative channel.
 *
 * Shares conceptual logic with bar chart but axes are swapped:
 * x-axis is categorical (band scale), y-axis is quantitative.
 */

import type {
  ConditionalValueDef,
  DataRow,
  Encoding,
  GradientDef,
  LayoutStrategy,
  MarkAria,
  Rect,
  RectMark,
} from '@opendata-ai/openchart-core';
import { isGradientDef } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { isConditionalValueDef, resolveConditionalValue } from '../../transforms/conditional';
import { formatLabelValue } from '../_shared/format-label-value';
import { getColor, getSequentialColor, groupByField } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_COLUMN_HEIGHT = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute vertical column marks from a normalized chart spec.
 *
 * X axis uses a band scale for categories. Y axis uses a linear scale
 * for values. When a color encoding is present, columns within each
 * category are stacked (cumulative heights).
 */
export function computeColumnMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
): RectMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) {
    return [];
  }

  const xScale = scales.x.scale as ScaleBand<string>;
  const yScale = scales.y.scale as ScaleLinear<number, number>;

  // Band scale should provide bandwidth
  if (typeof xScale.bandwidth !== 'function') {
    return [];
  }

  const bandwidth = xScale.bandwidth();
  // Baseline = pixel y where the column's bottom edge anchors. When the
  // y-domain includes zero (the common case), this is yScale(0). Sparkline
  // mode tightens the domain to [min, max] (zero: false) so yScale(0) lands
  // outside the chart area; in that case we anchor to the bottom of the
  // y-range instead, otherwise every bar would render with the same height.
  const yDomain = yScale.domain() as [number, number];
  const yIncludesZero = yDomain[0] <= 0 && yDomain[1] >= 0;
  const baseline = yIncludesZero ? yScale(0) : yScale(yDomain[0]);
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const conditionalColor =
    encoding.color && isConditionalValueDef(encoding.color)
      ? (encoding.color as ConditionalValueDef)
      : undefined;
  const colorField = colorEnc?.field;

  const isSequentialColor = colorEnc?.type === 'quantitative';

  let marks: RectMark[];

  // Color encoding present: decide between colored simple columns vs stacked
  if (colorField && !isSequentialColor) {
    // Check if any category has multiple rows (actual stacking needed)
    const categoryGroups = groupByField(spec.data, xChannel.field);
    const needsStacking = Array.from(categoryGroups.values()).some((rows) => rows.length > 1);

    if (needsStacking) {
      const stackDisabled = yChannel.stack === null || yChannel.stack === false;

      if (stackDisabled) {
        marks = computeGroupedColumns(
          spec.data,
          xChannel.field,
          yChannel.field,
          colorField,
          xScale,
          yScale,
          bandwidth,
          baseline,
          scales,
        );
      } else {
        const stackMode =
          yChannel.stack === 'normalize'
            ? 'normalize'
            : yChannel.stack === 'center'
              ? 'center'
              : 'zero';

        marks = computeStackedColumns(
          spec.data,
          xChannel.field,
          yChannel.field,
          colorField,
          xScale,
          yScale,
          bandwidth,
          baseline,
          scales,
          stackMode,
        );
      }
    } else {
      // Single row per category: render like simple columns but with color from scale
      marks = computeColoredColumns(
        spec.data,
        xChannel.field,
        yChannel.field,
        colorField,
        xScale,
        yScale,
        bandwidth,
        baseline,
        scales,
      );
    }
  } else {
    marks = computeSimpleColumns(
      spec.data,
      xChannel.field,
      yChannel.field,
      xScale,
      yScale,
      bandwidth,
      baseline,
      scales,
      isSequentialColor,
      conditionalColor,
    );
  }

  return applyMarkDefOverrides(marks, spec, bandwidth);
}

/** Compute simple (non-grouped) vertical columns. */
function computeSimpleColumns(
  data: DataRow[],
  categoryField: string,
  valueField: string,
  xScale: ScaleBand<string>,
  yScale: ScaleLinear<number, number>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
  sequentialColor = false,
  conditionalColor?: ConditionalValueDef,
): RectMark[] {
  const marks: RectMark[] = [];

  for (const row of data) {
    const category = String(row[categoryField] ?? '');
    const value = Number(row[valueField] ?? 0);
    if (!Number.isFinite(value)) continue;

    const bandX = xScale(category);
    if (bandX === undefined) continue;

    let color: string | GradientDef;
    if (conditionalColor) {
      const resolved = resolveConditionalValue(row, conditionalColor);
      if (resolved != null) {
        color = isGradientDef(resolved) ? resolved : String(resolved);
      } else {
        color = getColor(scales, '__default__');
      }
    } else if (sequentialColor) {
      color = getSequentialColor(scales, value);
    } else {
      color = getColor(scales, '__default__');
    }
    const yPos = yScale(value);
    const columnHeight = Math.max(Math.abs(baseline - yPos), MIN_COLUMN_HEIGHT);

    // For positive values, column goes upward from baseline.
    // For negative values, column goes downward from baseline.
    const y = value >= 0 ? yPos : baseline;

    const aria: MarkAria = {
      label: `${category}: ${formatLabelValue(value)}`,
    };

    marks.push({
      type: 'rect',
      x: bandX,
      y,
      width: bandwidth,
      height: columnHeight,
      fill: color,
      cornerRadius: 2,
      data: row as Record<string, unknown>,
      aria,
      orient: 'vertical',
    });
  }

  return marks;
}

/** Compute colored (non-stacked) vertical columns. Used when color encoding
 *  is present but each category has only one row (e.g., diverging charts). */
function computeColoredColumns(
  data: DataRow[],
  categoryField: string,
  valueField: string,
  colorField: string,
  xScale: ScaleBand<string>,
  yScale: ScaleLinear<number, number>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
): RectMark[] {
  const marks: RectMark[] = [];

  for (const row of data) {
    const category = String(row[categoryField] ?? '');
    const value = Number(row[valueField] ?? 0);
    if (!Number.isFinite(value)) continue;

    const bandX = xScale(category);
    if (bandX === undefined) continue;

    const groupKey = String(row[colorField] ?? '');
    const color = getColor(scales, groupKey);
    const yPos = yScale(value);
    const columnHeight = Math.max(Math.abs(baseline - yPos), MIN_COLUMN_HEIGHT);

    const y = value >= 0 ? yPos : baseline;

    const aria: MarkAria = {
      label: `${category}, ${groupKey}: ${formatLabelValue(value)}`,
    };

    marks.push({
      type: 'rect',
      x: bandX,
      y,
      width: bandwidth,
      height: columnHeight,
      fill: color,
      cornerRadius: 2,
      data: row as Record<string, unknown>,
      aria,
      orient: 'vertical',
    });
  }

  return marks;
}

/** Compute grouped (dodged) vertical columns -- side-by-side within each category band. */
function computeGroupedColumns(
  data: DataRow[],
  categoryField: string,
  valueField: string,
  colorField: string,
  xScale: ScaleBand<string>,
  yScale: ScaleLinear<number, number>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
): RectMark[] {
  const marks: RectMark[] = [];
  const categoryGroups = groupByField(data, categoryField);

  // Build a stable group order from first appearance in data (Map for O(1) lookup)
  const groupIndexMap = new Map<string, number>();
  for (const row of data) {
    const key = String(row[colorField] ?? '');
    if (!groupIndexMap.has(key)) {
      groupIndexMap.set(key, groupIndexMap.size);
    }
  }
  const groupCount = groupIndexMap.size;
  if (groupCount === 0) return marks;

  // Subdivide the band width by group count with a small gap
  const gap = Math.min(1, bandwidth * 0.05);
  const subBandWidth = Math.max(
    (bandwidth - gap * (groupCount - 1)) / groupCount,
    MIN_COLUMN_HEIGHT,
  );

  for (const [category, rows] of categoryGroups) {
    const bandX = xScale(category);
    if (bandX === undefined) continue;

    for (const row of rows) {
      const groupKey = String(row[colorField] ?? '');
      const value = Number(row[valueField] ?? 0);
      if (!Number.isFinite(value)) continue;

      const groupIndex = groupIndexMap.get(groupKey) ?? 0;
      const color = getColor(scales, groupKey);
      const yPos = yScale(value);
      const columnHeight = Math.max(Math.abs(baseline - yPos), MIN_COLUMN_HEIGHT);
      const y = value >= 0 ? yPos : baseline;
      const subX = bandX + groupIndex * (subBandWidth + gap);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatLabelValue(value)}`,
      };

      marks.push({
        type: 'rect',
        x: subX,
        y,
        width: subBandWidth,
        height: columnHeight,
        fill: color,
        cornerRadius: 2,
        data: row as Record<string, unknown>,
        aria,
        orient: 'vertical',
      });
    }
  }

  return marks;
}

/** Compute stacked vertical columns with support for zero/normalize/center modes. */
function computeStackedColumns(
  data: DataRow[],
  categoryField: string,
  valueField: string,
  colorField: string,
  xScale: ScaleBand<string>,
  yScale: ScaleLinear<number, number>,
  bandwidth: number,
  _baseline: number,
  scales: ResolvedScales,
  stackMode: 'zero' | 'normalize' | 'center' = 'zero',
): RectMark[] {
  const marks: RectMark[] = [];
  const categoryGroups = groupByField(data, categoryField);

  for (const [category, rows] of categoryGroups) {
    const bandX = xScale(category);
    if (bandX === undefined) continue;

    // Compute category total for normalize/center modes
    let categoryTotal = 0;
    for (const row of rows) {
      const v = Number(row[valueField] ?? 0);
      if (Number.isFinite(v) && v > 0) categoryTotal += v;
    }

    // For center mode, offset so the stack is centered around zero
    let cumulativeValue = stackMode === 'center' ? -categoryTotal / 2 : 0;

    for (const row of rows) {
      const groupKey = String(row[colorField] ?? '');
      const rawValue = Number(row[valueField] ?? 0);
      // Stacking only applies to positive values; negative/zero rows are skipped
      // since cumulative stacking doesn't make visual sense for mixed signs.
      if (!Number.isFinite(rawValue) || rawValue <= 0) continue;

      // For normalize mode, scale the value to a fraction of the total
      const value =
        stackMode === 'normalize' && categoryTotal > 0 ? rawValue / categoryTotal : rawValue;

      const color = getColor(scales, groupKey);

      const yTop = yScale(cumulativeValue + value);
      const yBottom = yScale(cumulativeValue);
      const columnHeight = Math.max(Math.abs(yBottom - yTop), MIN_COLUMN_HEIGHT);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatLabelValue(rawValue)}`,
      };

      marks.push({
        type: 'rect',
        x: bandX,
        y: Math.min(yTop, yBottom),
        width: bandwidth,
        height: columnHeight,
        fill: color,
        cornerRadius: 0,
        data: row as Record<string, unknown>,
        aria,
        orient: 'vertical',
        stackGroup: category,
      });

      cumulativeValue += value;
    }
  }

  return marks;
}

function applyMarkDefOverrides(
  marks: RectMark[],
  spec: NormalizedChartSpec,
  bandwidth: number,
): RectMark[] {
  const { markDef } = spec;
  const fixedSize = markDef.size;
  const crSpec = markDef.cornerRadius;

  if (fixedSize == null && crSpec == null) return marks;

  // Identify the topmost segment per stackGroup (smallest `y` since SVG
  // grows downward). Only that segment receives the corner rounding so
  // the seams between stacked segments stay square and flush.
  const topPerStack = new Map<string, RectMark>();
  for (const mark of marks) {
    if (mark.stackGroup === undefined) continue;
    const current = topPerStack.get(mark.stackGroup);
    if (!current || mark.y < current.y) {
      topPerStack.set(mark.stackGroup, mark);
    }
  }

  for (const mark of marks) {
    if (fixedSize != null && mark.stackGroup === undefined) {
      const barWidth = Math.min(fixedSize, bandwidth);
      const offset = (bandwidth - barWidth) / 2;
      mark.x = mark.x + offset;
      mark.width = barWidth;
    }
    const effectiveWidth = mark.width;
    const isStacked = mark.stackGroup !== undefined;
    const isStackTop = isStacked && topPerStack.get(mark.stackGroup!) === mark;

    // Stacked segments below the top stay square. Stack top rounds only its
    // top corners; non-stacked bars round all four.
    if (isStacked && !isStackTop) continue;

    if (crSpec === 'pill') {
      mark.cornerRadius = effectiveWidth / 2;
    } else if (typeof crSpec === 'number') {
      mark.cornerRadius = crSpec;
    } else {
      continue;
    }

    if (isStackTop) {
      mark.cornerRadiusSides = { tl: true, tr: true, br: false, bl: false };
    }
  }

  return marks;
}
