/**
 * Mirrored bars (population pyramids): the first color value extends left from a center
 * gutter, the second right, both on one symmetric value domain, with category labels in the
 * gutter and the two color values labelling the halves above the plot.
 */
import type {
  AxisTick,
  DataRow,
  LayoutStrategy,
  Mark,
  MeasureTextFn,
  Rect,
  RectMark,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import { finiteNumber } from '../../data/finite-number';
import { continuousTicks, resolveExplicitTicks, targetTickCount } from '../../layout/axes/ticks';
import type { D3ContinuousScale, ResolvedScale, ResolvedScales } from '../../layout/scales';
import { formatLabelValue } from '../_shared/format-label-value';
import { BAR_CORNER_RADIUS, getColor, valueEndCorners } from '../utils';
import type { BarLabelPlan } from './label-plan';
import { attachValueLabels, categoryLabelMarks, halfLabelMarks } from './mirror-labels';

/** A horizontal pixel span, start < end. */
export interface MirrorSpan {
  start: number;
  end: number;
}

/** Where each part of a mirrored chart sits across the plot. */
export interface MirrorGeometry {
  /** Center column holding the category labels. */
  gutter: MirrorSpan;
  /** Half for the first color value; bars grow leftward from `end`. */
  left: MirrorSpan;
  /** Half for the second color value; bars grow rightward from `start`. */
  right: MirrorSpan;
}

/** Space between a category label and each half's inner edge. */
const GUTTER_PADDING = 8;

/**
 * Split the plot into left half, center gutter and right half. The gutter is as wide as the
 * widest category label (measured at the axis tick font) plus padding; the halves share the
 * rest equally and together span the plot. The gutter never takes more than half the plot,
 * so the bars always keep room.
 */
export function mirrorGeometry(
  chartArea: Rect,
  categoryLabels: string[],
  measureText: MeasureTextFn | undefined,
  theme: ResolvedTheme,
): MirrorGeometry {
  const fontSize = theme.fonts.sizes.axisTick;
  const fontWeight = theme.fonts.weights.normal;
  let widestLabel = 0;
  for (const label of categoryLabels) {
    const width =
      measureText?.(label, fontSize, fontWeight).width ??
      estimateTextWidth(label, fontSize, fontWeight);
    widestLabel = Math.max(widestLabel, width);
  }
  const gutterWidth = Math.min(widestLabel + 2 * GUTTER_PADDING, chartArea.width / 2);
  const halfWidth = (chartArea.width - gutterWidth) / 2;
  const leftEnd = chartArea.x + halfWidth;
  const rightStart = leftEnd + gutterWidth;
  return {
    left: { start: chartArea.x, end: leftEnd },
    gutter: { start: leftEnd, end: rightStart },
    right: { start: rightStart, end: chartArea.x + chartArea.width },
  };
}

/**
 * Value-axis ticks for both halves: the x scale's ticks mapped onto the left half (reversed,
 * 0 at `left.end`) and the right half (0 at `right.start`), labelled with absolute values.
 * An authored `axis.values` or `axis.tickCount` applies to each half.
 */
export function mirrorAxisTicks(xScale: ResolvedScale, geometry: MirrorGeometry): AxisTick[] {
  const halfWidth = geometry.right.end - geometry.right.start;
  const axis = xScale.channel.axis || undefined;
  const baseTicks = axis?.values
    ? resolveExplicitTicks(axis.values, xScale)
    : continuousTicks(xScale, 'full', targetTickCount(halfWidth, 'full', 'x'));
  const fractionOf = rangeFraction(xScale);
  const onScale = baseTicks
    .map((tick) => ({ tick, fraction: fractionOf(tick.value as number) }))
    .filter(({ fraction }) => fraction >= -1e-9 && fraction <= 1 + 1e-9);
  const left = onScale
    .map(({ tick, fraction }) => ({ ...tick, position: geometry.left.end - fraction * halfWidth }))
    .reverse();
  const right = onScale.map(({ tick, fraction }) => ({
    ...tick,
    position: geometry.right.start + fraction * halfWidth,
  }));
  return [...left, ...right];
}

/**
 * The mirrored-bar renderer (registered as `bar-mirror`, same shape as `ChartRenderer`):
 * one rect per row on the side its color value picks, sized on the x scale's [0, max]
 * domain, plus text marks for the category labels centered in the gutter and the two half
 * labels above the plot. Value labels sit outside the outer end of each bar.
 */
export function computeMirrorMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  _strategy: LayoutStrategy,
  theme: ResolvedTheme,
  _containerWidth: number,
  labelPlan?: BarLabelPlan,
  measureText?: MeasureTextFn,
): Mark[] {
  const xField = spec.encoding.x?.field;
  const yField = spec.encoding.y?.field;
  const colorChannel = spec.encoding.color;
  if (!xField || !yField || !scales.x || !scales.y) return [];
  if (!colorChannel || !('field' in colorChannel)) return [];
  const yScale = scales.y.scale as ScaleBand<string>;
  if (typeof yScale.bandwidth !== 'function') return [];

  const categories = yScale.domain().map(String);
  const geometry = mirrorGeometry(chartArea, categories, measureText, theme);
  const sides = sideOrder(spec.data, colorChannel.field, colorChannel.sort);
  const rects = buildMirrorRects(spec, scales, geometry, {
    xField,
    yField,
    colorField: colorChannel.field,
    sides,
  });
  if (labelPlan?.placement !== 'suppress') attachValueLabels(rects, spec, xField, sides[0], theme);

  return [
    ...rects,
    ...categoryLabelMarks(categories, yScale, geometry, theme),
    ...halfLabelMarks(sides, geometry, chartArea, theme),
  ];
}

/** Maps a value to its share (0 at the domain start, 1 at the end) of the x scale's range. */
function rangeFraction(xScale: ResolvedScale): (value: number) => number {
  const scale = xScale.scale as D3ContinuousScale;
  const [rangeStart, rangeEnd] = scale.range() as [number, number];
  const span = rangeEnd - rangeStart;
  return (value) => (span === 0 ? 0 : ((scale(value) as number) - rangeStart) / span);
}

/**
 * The two color values in side order, left first: by an explicit sort array or direction,
 * else in the order they first appear in the data.
 */
function sideOrder(data: DataRow[], colorField: string, sort: unknown): string[] {
  const firstSeen: string[] = [];
  for (const row of data) {
    const value = String(row[colorField] ?? '');
    if (!firstSeen.includes(value)) firstSeen.push(value);
  }
  if (Array.isArray(sort)) {
    const sorted = sort.map(String).filter((value) => firstSeen.includes(value));
    return [...sorted, ...firstSeen.filter((value) => !sorted.includes(value))];
  }
  if (sort === 'ascending') return [...firstSeen].sort();
  if (sort === 'descending') return [...firstSeen].sort().reverse();
  return firstSeen;
}

interface MirrorFields {
  xField: string;
  yField: string;
  colorField: string;
  sides: string[];
}

/**
 * One rect per measured row, growing outward from its half's inner edge. Rows whose color
 * value is neither side are skipped; negative values draw as zero-length bars.
 */
function buildMirrorRects(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  geometry: MirrorGeometry,
  fields: MirrorFields,
): RectMark[] {
  const yScale = scales.y!.scale as ScaleBand<string>;
  const fractionOf = rangeFraction(scales.x!);
  const halfWidth = geometry.right.end - geometry.right.start;
  const bandwidth = yScale.bandwidth();
  const marks: RectMark[] = [];
  for (const row of spec.data) {
    const value = finiteNumber(row[fields.xField]);
    const category = String(row[fields.yField] ?? '');
    const bandY = yScale(category);
    const series = String(row[fields.colorField] ?? '');
    const sideIndex = fields.sides.indexOf(series);
    if (value === undefined || bandY === undefined || sideIndex < 0 || sideIndex > 1) continue;

    const onLeft = sideIndex === 0;
    const length = Math.max(0, fractionOf(value) * halfWidth);
    const color = getColor(scales, series);
    marks.push({
      type: 'rect',
      x: onLeft ? geometry.left.end - length : geometry.right.start,
      y: bandY,
      width: length,
      height: bandwidth,
      fill: color,
      cornerRadius: BAR_CORNER_RADIUS,
      cornerRadiusSides: valueEndCorners('horizontal', onLeft),
      seriesKey: series,
      data: row as Record<string, unknown>,
      aria: { label: `${category}, ${series}: ${formatLabelValue(value)}` },
      orient: 'horizontal',
      baseline: onLeft ? geometry.left.end : geometry.right.start,
    });
  }
  stampMirrorKeys(marks, fields.yField, fields.colorField);
  return marks;
}

/** Bar identity keys, `${series}|${category}`, matching ordinary bars so updates tween. */
function stampMirrorKeys(marks: RectMark[], categoryField: string, colorField: string): void {
  const keys = dedupeKeys(
    marks.map(
      (mark) =>
        `${String(mark.data[colorField] ?? '')}|${serializeKeyValue(mark.data[categoryField])}`,
    ),
  );
  marks.forEach((mark, index) => {
    mark.key = keys[index];
  });
}
