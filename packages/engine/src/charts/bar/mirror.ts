/**
 * Mirrored bars (population pyramids): the first color value extends left from a center
 * gutter, the second right, both on one symmetric value domain, with category labels in the
 * gutter and the two color values labelling the halves above the plot.
 */
import type {
  AxisTick,
  LayoutStrategy,
  Mark,
  MeasureTextFn,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScale, ResolvedScales } from '../../layout/scales';
import type { BarLabelPlan } from './label-plan';

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
 * rest equally and together span the plot.
 */
export function mirrorGeometry(
  chartArea: Rect,
  categoryLabels: string[],
  measureText: MeasureTextFn | undefined,
  theme: ResolvedTheme,
): MirrorGeometry {
  void chartArea;
  void categoryLabels;
  void measureText;
  void theme;
  throw new Error('not implemented');
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
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  containerWidth: number,
  labelPlan?: BarLabelPlan,
  measureText?: MeasureTextFn,
): Mark[] {
  void spec;
  void scales;
  void chartArea;
  void strategy;
  void theme;
  void containerWidth;
  void labelPlan;
  void measureText;
  throw new Error('not implemented');
}

/**
 * Value-axis ticks for both halves: the x scale's ticks mapped onto the left half (reversed,
 * 0 at `left.end`) and the right half (0 at `right.start`), labelled with absolute values.
 */
export function mirrorAxisTicks(xScale: ResolvedScale, geometry: MirrorGeometry): AxisTick[] {
  void xScale;
  void geometry;
  throw new Error('not implemented');
}
