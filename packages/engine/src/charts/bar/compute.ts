/**
 * Bar chart (horizontal) mark computation.
 *
 * Takes a normalized chart spec with resolved scales and produces
 * RectMark[] for rendering horizontal bars. Supports grouped and
 * stacked variants via the color encoding channel.
 */

import type {
  ConditionalValueDef,
  DataRow,
  Encoding,
  LayoutStrategy,
  MarkAria,
  Rect,
  RectMark,
} from '@opendata-ai/openchart-core';
import { abbreviateNumber, formatNumber } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { isConditionalValueDef, resolveConditionalValue } from '../../transforms/conditional';
import { getColor, getSequentialColor, groupByField } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BAR_WIDTH = 1;

/** Format a bar value for display (abbreviate large numbers). */
function formatBarValue(value: number): string {
  if (Math.abs(value) >= 1000) return abbreviateNumber(value);
  return formatNumber(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute horizontal bar marks from a normalized chart spec.
 *
 * Y axis uses a band scale for categories. X axis uses a linear scale
 * for values. When a color encoding is present, bars within each category
 * are grouped (subdivided bands) or stacked (cumulative widths).
 */
export function computeBarMarks(
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

  const yScale = scales.y.scale as ScaleBand<string>;
  const xScale = scales.x.scale as ScaleLinear<number, number>;

  // Band scale should provide bandwidth
  if (typeof yScale.bandwidth !== 'function') {
    return [];
  }

  const bandwidth = yScale.bandwidth();
  const baseline = xScale(0);
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const conditionalColor =
    encoding.color && isConditionalValueDef(encoding.color)
      ? (encoding.color as ConditionalValueDef)
      : undefined;
  const colorField = colorEnc?.field;
  const isSequentialColor = colorEnc?.type === 'quantitative';

  // If no color encoding, or sequential color (value-based gradient), render simple bars
  if (!colorField || isSequentialColor) {
    return computeSimpleBars(
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

  // Stacked bars when color is present
  return computeStackedBars(
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

/** Compute stacked horizontal bars. */
function computeStackedBars(
  data: DataRow[],
  valueField: string,
  categoryField: string,
  colorField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
  bandwidth: number,
  _baseline: number,
  scales: ResolvedScales,
): RectMark[] {
  const marks: RectMark[] = [];
  const categoryGroups = groupByField(data, categoryField);

  for (const [category, rows] of categoryGroups) {
    const bandY = yScale(category);
    if (bandY === undefined) continue;

    let cumulativeValue = 0;

    for (const row of rows) {
      const groupKey = String(row[colorField] ?? '');
      const value = Number(row[valueField] ?? 0);
      // Only stack positive values (same approach as stacked columns)
      if (!Number.isFinite(value) || value <= 0) continue;

      const color = getColor(scales, groupKey);

      const xLeft = xScale(cumulativeValue);
      const xRight = xScale(cumulativeValue + value);
      const barWidth = Math.max(Math.abs(xRight - xLeft), MIN_BAR_WIDTH);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatBarValue(value)}`,
      };

      marks.push({
        type: 'rect',
        x: xLeft,
        y: bandY,
        width: barWidth,
        height: bandwidth,
        fill: color,
        cornerRadius: 0,
        data: row as Record<string, unknown>,
        aria,
      });

      cumulativeValue += value;
    }
  }

  return marks;
}

/** Compute simple (non-grouped) horizontal bars. */
function computeSimpleBars(
  data: DataRow[],
  valueField: string,
  categoryField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
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

    const bandY = yScale(category);
    if (bandY === undefined) continue;

    let color: string;
    if (conditionalColor) {
      color = String(
        resolveConditionalValue(row, conditionalColor) ?? getColor(scales, '__default__'),
      );
    } else if (sequentialColor) {
      color = getSequentialColor(scales, value);
    } else {
      color = getColor(scales, '__default__');
    }
    const xPos = value >= 0 ? baseline : xScale(value);
    const barWidth = Math.max(Math.abs(xScale(value) - baseline), MIN_BAR_WIDTH);

    const aria: MarkAria = {
      label: `${category}: ${formatBarValue(value)}`,
    };

    marks.push({
      type: 'rect',
      x: xPos,
      y: bandY,
      width: barWidth,
      height: bandwidth,
      fill: color,
      cornerRadius: 2,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  return marks;
}
