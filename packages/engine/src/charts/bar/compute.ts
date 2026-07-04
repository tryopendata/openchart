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
  GradientDef,
  LayoutStrategy,
  LinearGradient,
  MarkAria,
  Rect,
  RectMark,
} from '@opendata-ai/openchart-core';
import { isGradientDef, NARROW_VIEWPORT_MAX } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { isConditionalValueDef, resolveConditionalValue } from '../../transforms/conditional';
import { formatLabelValue } from '../_shared/format-label-value';
import { getColor, getSequentialColor, groupByField } from '../utils';

/**
 * Auto-orient a gradient for horizontal bars.
 *
 * If the gradient uses the default top-to-bottom direction (no explicit
 * x1/y1/x2/y2, or the defaults x1:0, y1:0, x2:0, y2:1), rotate it to
 * left-to-right so the gradient follows the bar's data direction.
 *
 * Gradients with explicit non-default coordinates are left unchanged.
 */
function orientGradientForHorizontalBar(grad: GradientDef): GradientDef {
  if (grad.gradient !== 'linear') return grad;
  const lg = grad as LinearGradient;
  // Only auto-orient if using the default vertical direction.
  // Default is x1:0, y1:0, x2:0, y2:1 (top-to-bottom).
  const isDefaultVertical =
    (lg.x1 === undefined || lg.x1 === 0) &&
    (lg.y1 === undefined || lg.y1 === 0) &&
    (lg.x2 === undefined || lg.x2 === 0) &&
    (lg.y2 === undefined || lg.y2 === 1);
  if (!isDefaultVertical) return grad;
  return { ...lg, x1: 0, y1: 0, x2: 1, y2: 0 };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BAR_WIDTH = 1;

/**
 * Readable floor (px) for a single grouped-bar thickness. Value labels render at
 * fontSize 10 with ~12px line height; below this a bar is thinner than its own
 * label and the chart reads as stripes (observed on iOS at 375-430px). When
 * grouped sub-bars would fall under this, we reclaim the band scale's reserved
 * inter-category whitespace (step - bandwidth) before letting bars shrink,
 * trading padding for legibility rather than inventing extra height.
 */
const MIN_GROUPED_BAR_THICKNESS = 8;

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
  chartArea: Rect,
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
  // Baseline = pixel x where the bar's left edge anchors. When the x-domain
  // includes zero (the common case), this is xScale(0). When the domain
  // excludes zero (explicit non-zero domain or scale.zero: false), xScale(0)
  // would extrapolate outside the plot area and overrun the y-axis labels, so
  // anchor to the domain minimum (the plot-area left edge) instead.
  const xDomain = xScale.domain() as [number, number];
  const xIncludesZero = xDomain[0] <= 0 && xDomain[1] >= 0;
  const baseline = xIncludesZero ? xScale(0) : xScale(xDomain[0]);
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const conditionalColor =
    encoding.color && isConditionalValueDef(encoding.color)
      ? (encoding.color as ConditionalValueDef)
      : undefined;
  const colorField = colorEnc?.field;
  const isSequentialColor = colorEnc?.type === 'quantitative';

  let marks: RectMark[];

  // If no color encoding, or sequential color (value-based gradient), render simple bars
  if (!colorField || isSequentialColor) {
    marks = computeSimpleBars(
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
  } else {
    // Color encoding present: decide between colored simple bars vs stacked
    const categoryGroups = groupByField(spec.data, yChannel.field);
    const needsStacking = Array.from(categoryGroups.values()).some((rows) => rows.length > 1);

    if (needsStacking) {
      // stack: true/'zero'/'normalize'/'center' -> stacked; default (undefined/null/false) -> grouped
      const stackEnabled =
        xChannel.stack === true ||
        xChannel.stack === 'zero' ||
        xChannel.stack === 'normalize' ||
        xChannel.stack === 'center';

      if (!stackEnabled) {
        marks = computeGroupedBars(
          spec.data,
          xChannel.field,
          yChannel.field,
          colorField,
          xScale,
          yScale,
          bandwidth,
          baseline,
          scales,
          chartArea.width,
        );
      } else {
        const stackMode =
          xChannel.stack === 'normalize'
            ? 'normalize'
            : xChannel.stack === 'center'
              ? 'center'
              : 'zero';

        marks = computeStackedBars(
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
      // Single row per category: render like simple bars but with color from scale
      marks = computeColoredBars(
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
  }

  return applyMarkDefOverrides(marks, spec, bandwidth);
}

/** Compute stacked horizontal bars with support for zero/normalize/center modes. */
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
  stackMode: 'zero' | 'normalize' | 'center' = 'zero',
): RectMark[] {
  const marks: RectMark[] = [];
  const categoryGroups = groupByField(data, categoryField);

  for (const [category, rows] of categoryGroups) {
    const bandY = yScale(category);
    if (bandY === undefined) continue;

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
      // Only stack positive values (same approach as stacked columns)
      if (!Number.isFinite(rawValue) || rawValue <= 0) continue;

      // For normalize mode, scale the value to a fraction of the total
      const value =
        stackMode === 'normalize' && categoryTotal > 0 ? rawValue / categoryTotal : rawValue;

      const color = getColor(scales, groupKey);

      const xLeft = xScale(cumulativeValue);
      const xRight = xScale(cumulativeValue + value);
      const barWidth = Math.max(Math.abs(xRight - xLeft), MIN_BAR_WIDTH);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatLabelValue(rawValue)}`,
      };

      marks.push({
        type: 'rect',
        x: Math.min(xLeft, xRight),
        y: bandY,
        width: barWidth,
        height: bandwidth,
        fill: isGradientDef(color) ? orientGradientForHorizontalBar(color) : color,
        cornerRadius: 0,
        data: row as Record<string, unknown>,
        aria,
        orient: 'horizontal',
        stackGroup: category,
      });

      cumulativeValue += value;
    }
  }

  return marks;
}

/** Compute grouped (dodged) horizontal bars -- side-by-side within each category band. */
function computeGroupedBars(
  data: DataRow[],
  valueField: string,
  categoryField: string,
  colorField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
  plotWidth: number,
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

  // Subdivide the band height by group count with a small gap.
  const gap = Math.min(1, bandwidth * 0.05);
  let groupHeight = bandwidth;
  let subBandHeight = (groupHeight - gap * (groupCount - 1)) / groupCount;

  // At tight bandwidths sub-bars fall below the readable floor and read as
  // stripes. The band scale reserves whitespace between categories (step -
  // bandwidth); reclaim it by growing the group height toward the full step
  // before letting bars shrink. Bars stay centered in the band so the widened
  // group doesn't touch its neighbors. A one-pixel residual keeps adjacent
  // categories visually separable even at full reclaim.
  //
  // Gated to narrow plots (< NARROW_VIEWPORT_MAX): the fix targets phones where
  // this was observed, and gating keeps wide/desktop layouts pixel-identical
  // even for contrived short-but-wide containers whose bandwidth is also tight.
  const step = typeof yScale.step === 'function' ? yScale.step() : bandwidth;
  const maxGroupHeight = Math.max(bandwidth, step - MIN_BAR_WIDTH);
  if (
    plotWidth < NARROW_VIEWPORT_MAX &&
    subBandHeight < MIN_GROUPED_BAR_THICKNESS &&
    maxGroupHeight > bandwidth
  ) {
    const needed = MIN_GROUPED_BAR_THICKNESS * groupCount + gap * (groupCount - 1);
    groupHeight = Math.min(Math.max(groupHeight, needed), maxGroupHeight);
    subBandHeight = (groupHeight - gap * (groupCount - 1)) / groupCount;
  }
  subBandHeight = Math.max(subBandHeight, MIN_BAR_WIDTH);
  // Center the (possibly widened) group within the band.
  const groupOffset = (bandwidth - groupHeight) / 2;

  for (const [category, rows] of categoryGroups) {
    const bandY = yScale(category);
    if (bandY === undefined) continue;

    for (const row of rows) {
      const groupKey = String(row[colorField] ?? '');
      const value = Number(row[valueField] ?? 0);
      if (!Number.isFinite(value)) continue;

      const groupIndex = groupIndexMap.get(groupKey) ?? 0;
      const color = getColor(scales, groupKey);
      const xPos = value >= 0 ? baseline : xScale(value);
      const barWidth = Math.max(Math.abs(xScale(value) - baseline), MIN_BAR_WIDTH);
      const subY = bandY + groupOffset + groupIndex * (subBandHeight + gap);

      const aria: MarkAria = {
        label: `${category}, ${groupKey}: ${formatLabelValue(value)}`,
      };

      marks.push({
        type: 'rect',
        x: xPos,
        y: subY,
        width: barWidth,
        height: subBandHeight,
        fill: isGradientDef(color) ? orientGradientForHorizontalBar(color) : color,
        cornerRadius: 2,
        data: row as Record<string, unknown>,
        aria,
        orient: 'horizontal',
      });
    }
  }

  return marks;
}

/** Compute colored (non-stacked) horizontal bars. Used when color encoding
 *  is present but each category has only one row (e.g., diverging charts). */
function computeColoredBars(
  data: DataRow[],
  valueField: string,
  categoryField: string,
  colorField: string,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleBand<string>,
  bandwidth: number,
  baseline: number,
  scales: ResolvedScales,
): RectMark[] {
  const marks: RectMark[] = [];

  for (const row of data) {
    const category = String(row[categoryField] ?? '');
    const value = Number(row[valueField] ?? 0);
    if (!Number.isFinite(value)) continue;

    const bandY = yScale(category);
    if (bandY === undefined) continue;

    const groupKey = String(row[colorField] ?? '');
    const color = getColor(scales, groupKey);
    const xPos = value >= 0 ? baseline : xScale(value);
    const barWidth = Math.max(Math.abs(xScale(value) - baseline), MIN_BAR_WIDTH);

    const aria: MarkAria = {
      label: `${category}, ${groupKey}: ${formatLabelValue(value)}`,
    };

    marks.push({
      type: 'rect',
      x: xPos,
      y: bandY,
      width: barWidth,
      height: bandwidth,
      fill: isGradientDef(color) ? orientGradientForHorizontalBar(color) : color,
      cornerRadius: 2,
      data: row as Record<string, unknown>,
      aria,
      orient: 'horizontal',
    });
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

  // Identify the rightmost segment per stackGroup (largest `x + width`).
  // Only that segment receives the corner rounding so the seams between
  // stacked segments stay square and flush.
  const rightPerStack = new Map<string, RectMark>();
  for (const mark of marks) {
    if (mark.stackGroup === undefined) continue;
    const current = rightPerStack.get(mark.stackGroup);
    const markRight = mark.x + mark.width;
    if (!current || markRight > current.x + current.width) {
      rightPerStack.set(mark.stackGroup, mark);
    }
  }

  for (const mark of marks) {
    if (fixedSize != null && mark.stackGroup === undefined) {
      const barHeight = Math.min(fixedSize, bandwidth);
      const offset = (bandwidth - barHeight) / 2;
      mark.y = mark.y + offset;
      mark.height = barHeight;
    }
    const effectiveHeight = mark.height;
    const isStacked = mark.stackGroup !== undefined;
    const isStackRight = isStacked && rightPerStack.get(mark.stackGroup!) === mark;

    if (isStacked && !isStackRight) continue;

    if (crSpec === 'pill') {
      mark.cornerRadius = effectiveHeight / 2;
    } else if (typeof crSpec === 'number') {
      mark.cornerRadius = crSpec;
    } else {
      continue;
    }

    if (isStackRight) {
      mark.cornerRadiusSides = { tl: false, tr: true, br: true, bl: false };
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
    const xPos = value >= 0 ? baseline : xScale(value);
    const barWidth = Math.max(Math.abs(xScale(value) - baseline), MIN_BAR_WIDTH);

    const aria: MarkAria = {
      label: `${category}: ${formatLabelValue(value)}`,
    };

    marks.push({
      type: 'rect',
      x: xPos,
      y: bandY,
      width: barWidth,
      height: bandwidth,
      fill: isGradientDef(color) ? orientGradientForHorizontalBar(color) : color,
      cornerRadius: 2,
      data: row as Record<string, unknown>,
      aria,
      orient: 'horizontal',
    });
  }

  return marks;
}
