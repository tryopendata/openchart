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
import { type ScaleBand, type ScaleLinear, scaleLinear } from 'd3-scale';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import { finiteNumber } from '../../data/finite-number';
import { formatTickLabel, targetTickCount } from '../../layout/axes/ticks';
import type { D3ContinuousScale, ResolvedScale, ResolvedScales } from '../../layout/scales';
import { formatLabelValue } from '../_shared/format-label-value';
import { BAR_CORNER_RADIUS, getColor, valueEndCorners } from '../utils';
import type { BarLabelPlan } from './label-plan';
import {
  attachValueLabels,
  categoryLabelMarks,
  GUTTER_PADDING,
  halfLabelMarks,
  measureCategoryLabel,
} from './mirror-labels';

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
  let widestLabel = 0;
  for (const label of categoryLabels) {
    widestLabel = Math.max(widestLabel, measureCategoryLabel(label, theme, measureText));
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
 * Value-axis ticks for both halves: ticks of the mirror's own [0, max] value scale mapped onto
 * the left half (reversed, 0 at `left.end`) and the right half (0 at `right.start`), so every
 * label is non-negative. An authored `axis.values` (non-negative, within the domain) or
 * `axis.tickCount` applies to each half. With no positive extent, only the 0 ticks remain.
 */
export function mirrorAxisTicks(xScale: ResolvedScale, geometry: MirrorGeometry): AxisTick[] {
  const halfWidth = geometry.right.end - geometry.right.start;
  const axis = xScale.channel.axis || undefined;
  const tickCount = mirrorTickCount(xScale, halfWidth);
  const valueScale = mirrorValueScale(xScale, halfWidth, tickCount);
  const [, domainMax] = valueScale?.domain() ?? [0, 0];
  const values = axis?.values
    ? axis.values.map(Number).filter((value) => value >= 0 && value <= domainMax)
    : (valueScale?.ticks(tickCount) ?? [0]);
  const offsets = values.map((value) => ({ value, offset: valueScale ? valueScale(value) : 0 }));
  const tick = (value: number, position: number): AxisTick => ({
    value,
    position,
    label: formatTickLabel(value, xScale),
  });
  const left = offsets.map(({ value, offset }) => tick(value, geometry.left.end - offset));
  const right = offsets.map(({ value, offset }) => tick(value, geometry.right.start + offset));
  return [...left.reverse(), ...right];
}

/** Ticks per half: the authored `axis.tickCount`, else the usual x density for one half. */
function mirrorTickCount(xScale: ResolvedScale, halfWidth: number): number {
  const axis = xScale.channel.axis || undefined;
  return axis?.tickCount ?? targetTickCount(halfWidth, 'full', 'x');
}

/**
 * The value mapping both halves share: [0, max] onto [0, halfWidth], clamped, where max is
 * the shared x domain's upper end (it already covers the largest value unless the author
 * capped the domain, and the axis ticks can only see the scale). The shared domain's lower
 * end is ignored, so negative data, `zero: false` or an authored floor never move 0 off the
 * inner edges. Undefined when max is not positive (all-zero or all-negative data): every bar
 * is then zero length.
 */
function mirrorValueScale(
  xScale: ResolvedScale,
  halfWidth: number,
  tickCount: number,
): ScaleLinear<number, number> | undefined {
  const domain = (xScale.scale as D3ContinuousScale).domain().map(Number);
  const max = Math.max(0, ...domain.filter(Number.isFinite));
  if (!(max > 0)) return undefined;
  return scaleLinear().domain([0, max]).range([0, halfWidth]).nice(tickCount).clamp(true);
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
  const sides = sideOrder(
    spec.data,
    colorChannel.field,
    colorChannel.sort,
    colorChannel.scale?.domain,
  );
  const rects = buildMirrorRects(spec, scales, geometry, {
    xField,
    yField,
    colorField: colorChannel.field,
    sides,
  });
  if (labelPlan?.placement !== 'suppress') attachValueLabels(rects, spec, xField, sides[0], theme);

  return [
    ...rects,
    ...categoryLabelMarks(categories, yScale, geometry, theme, measureText),
    ...halfLabelMarks(sides, geometry, chartArea, theme),
  ];
}

/**
 * The two color values in side order, left first: by an explicit sort array or direction,
 * else by the color scale's domain, else in the order they first appear in the data. Rows
 * with no color value pick no side.
 *
 * Normalize turns a sort array into `scale.domain`, and playback frames hand rows over in
 * key order, so the domain (not row order) is what keeps the authored sides on every frame.
 * The domain is used whole, so a frame missing one color's rows still keeps both sides.
 */
function sideOrder(data: DataRow[], colorField: string, sort: unknown, domain: unknown): string[] {
  const firstSeen: string[] = [];
  for (const row of data) {
    const raw = row[colorField];
    if (raw === undefined || raw === null) continue;
    const value = String(raw);
    if (!firstSeen.includes(value)) firstSeen.push(value);
  }
  if (sort === undefined && Array.isArray(domain)) {
    const ordered = domain.map(String);
    return [...ordered, ...firstSeen.filter((value) => !ordered.includes(value))];
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
  const halfWidth = geometry.right.end - geometry.right.start;
  const valueScale = mirrorValueScale(scales.x!, halfWidth, mirrorTickCount(scales.x!, halfWidth));
  const bandwidth = yScale.bandwidth();
  const marks: RectMark[] = [];
  for (const row of spec.data) {
    const value = finiteNumber(row[fields.xField]);
    const category = String(row[fields.yField] ?? '');
    const bandY = yScale(category);
    const rawSeries = row[fields.colorField];
    const series = String(rawSeries ?? '');
    const sideIndex = rawSeries == null ? -1 : fields.sides.indexOf(series);
    if (value === undefined || bandY === undefined || sideIndex < 0 || sideIndex > 1) continue;

    const onLeft = sideIndex === 0;
    const length = valueScale ? valueScale(Math.max(0, value)) : 0;
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
