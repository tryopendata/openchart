/**
 * Text for mirrored bars: value labels past each bar's outer end, category labels centered
 * in the gutter, and the two half labels above the plot.
 */
import type {
  Rect,
  RectMark,
  ResolvedLabel,
  ResolvedTheme,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';
import type { NormalizedChartSpec } from '../../compiler/types';
import { resolveFieldFormatter } from '../../format/field-format';
import { filterByDensity } from '../_shared/density-filter';
import type { MirrorGeometry } from './mirror';

/** Space between a half label's baseline and the top of the plot. */
const HALF_LABEL_GAP = 8;
const HALF_LABEL_LINE_HEIGHT = 1.2;
const VALUE_LABEL_GAP = 6;
const VALUE_LABEL_FONT_SIZE = 11;
const VALUE_LABEL_FONT_WEIGHT = 600;

/**
 * Height the two half labels need above the plot, so the layout plan can reserve it.
 */
export function mirrorHalfLabelBand(theme: ResolvedTheme): number {
  return Math.ceil(theme.fonts.sizes.body * HALF_LABEL_LINE_HEIGHT + HALF_LABEL_GAP);
}

/** Value labels just past the outer end of each bar, honoring the labels density. */
export function attachValueLabels(
  rects: RectMark[],
  spec: NormalizedChartSpec,
  xField: string,
  leftSeries: string,
  theme: ResolvedTheme,
): void {
  const format = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat: spec.encoding.x?.format,
    values: spec.data.map((row) => row[xField]),
  });
  const fontSize = spec.labels.fontSize ?? VALUE_LABEL_FONT_SIZE;
  for (const mark of filterByDensity(rects, spec.labels.density)) {
    const onLeft = mark.seriesKey === leftSeries;
    const text = `${spec.labels.prefix ?? ''}${format(Number(mark.data[xField]))}${spec.labels.suffix ?? ''}`;
    const label: ResolvedLabel = {
      text,
      x: onLeft ? mark.x - VALUE_LABEL_GAP : mark.x + mark.width + VALUE_LABEL_GAP,
      y: mark.y + mark.height / 2,
      visible: true,
      style: {
        fontFamily: theme.fonts.family,
        fontSize,
        fontWeight: VALUE_LABEL_FONT_WEIGHT,
        fill: spec.labels.color ?? getRepresentativeColor(mark.fill),
        lineHeight: 1.2,
        textAnchor: onLeft ? 'end' : 'start',
        dominantBaseline: 'central',
        fontVariant: 'tabular-nums',
      },
    };
    mark.label = label;
  }
}

/** One label per category, centered in the gutter on its row. */
export function categoryLabelMarks(
  categories: string[],
  yScale: ScaleBand<string>,
  geometry: MirrorGeometry,
  theme: ResolvedTheme,
): TextMarkLayout[] {
  const centerX = (geometry.gutter.start + geometry.gutter.end) / 2;
  const halfBand = yScale.bandwidth() / 2;
  return categories.flatMap((category) => {
    const bandY = yScale(category);
    if (bandY === undefined) return [];
    return [
      {
        type: 'textMark' as const,
        key: `oc-mirror-category|${category}`,
        x: centerX,
        y: bandY + halfBand,
        text: category,
        fill: theme.colors.axis,
        fontSize: theme.fonts.sizes.axisTick,
        fontWeight: theme.fonts.weights.normal,
        fontFamily: theme.fonts.family,
        textAnchor: 'middle' as const,
        dominantBaseline: 'central' as const,
        data: {},
        aria: { decorative: true },
      },
    ];
  });
}

/** The two color values, each centered over its half in the band above the plot. */
export function halfLabelMarks(
  sides: string[],
  geometry: MirrorGeometry,
  chartArea: Rect,
  theme: ResolvedTheme,
): TextMarkLayout[] {
  const spans = [geometry.left, geometry.right];
  return sides.slice(0, 2).map((side, index) => ({
    type: 'textMark' as const,
    key: `oc-mirror-half|${side}`,
    x: (spans[index].start + spans[index].end) / 2,
    y: chartArea.y - HALF_LABEL_GAP,
    text: side,
    fill: theme.colors.text,
    fontSize: theme.fonts.sizes.body,
    fontWeight: theme.fonts.weights.semibold,
    fontFamily: theme.fonts.family,
    textAnchor: 'middle' as const,
    data: {},
    aria: { decorative: true },
  }));
}
