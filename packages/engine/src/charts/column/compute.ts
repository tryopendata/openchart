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
import { abbreviateNumber, formatNumber, isGradientDef } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { isConditionalValueDef, resolveConditionalValue } from '../../transforms/conditional';
import { getColor, getSequentialColor, groupByField } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_COLUMN_HEIGHT = 1;

/** Format a column value for display (abbreviate large numbers). */
function formatColumnValue(value: number): string {
  if (Math.abs(value) >= 1000) return abbreviateNumber(value);
  return formatNumber(value);
}

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
  const baseline = yScale(0);
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const conditionalColor =
    encoding.color && isConditionalValueDef(encoding.color)
      ? (encoding.color as ConditionalValueDef)
      : undefined;
  const colorField = colorEnc?.field;

  const isSequentialColor = colorEnc?.type === 'quantitative';

  // Color encoding present: decide between colored simple columns vs stacked
  if (colorField && !isSequentialColor) {
    // Check if any category has multiple rows (actual stacking needed)
    const categoryGroups = groupByField(spec.data, xChannel.field);
    const needsStacking = Array.from(categoryGroups.values()).some((rows) => rows.length > 1);

    if (needsStacking) {
      const stackDisabled = yChannel.stack === null || yChannel.stack === false;

      if (stackDisabled) {
        return computeGroupedColumns(
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

      return computeStackedColumns(
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

    // Single row per category: render like simple columns but with color from scale
    return computeColoredColumns(
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

  return computeSimpleColumns(
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
      label: `${category}: ${formatColumnValue(value)}`,
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
      label: `${category}, ${groupKey}: ${formatColumnValue(value)}`,
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
        label: `${category}, ${groupKey}: ${formatColumnValue(value)}`,
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

/** Compute stacked vertical columns. */
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
): RectMark[] {
  const marks: RectMark[] = [];
  const categoryGroups = groupByField(data, categoryField);

  for (const [category, rows] of categoryGroups) {
    const bandX = xScale(category);
    if (bandX === undefined) continue;

    let cumulativeValue = 0;

    for (const row of rows) {
      const groupKey = String(row[colorField] ?? '');
      const value = Number(row[valueField] ?? 0);
      // Stacking only applies to positive values; negative/zero rows are skipped
      // since cumulative stacking doesn't make visual sense for mixed signs.
      if (!Number.isFinite(value) || value <= 0) continue;

      const color = getColor(scales, groupKey);

      const yTop = yScale(cumulativeValue + value);
      const yBottom = yScale(cumulativeValue);
      const columnHeight = Math.max(Math.abs(yBottom - yTop), MIN_COLUMN_HEIGHT);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatColumnValue(value)}`,
      };

      marks.push({
        type: 'rect',
        x: bandX,
        y: yTop,
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
