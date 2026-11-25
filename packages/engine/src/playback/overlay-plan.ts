/**
 * Plans a chart playback's overlays once per run (period label text and placement, each name
 * label's side) and turns the plan into a function of the playhead.
 */
import {
  type ChartSpec,
  type EncodingChannel,
  estimateTextWidth,
  type Mark,
  type ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { FrameMark, FrozenChartFrame } from './chart-types';
import type { FrameSampler } from './frame-sampler';
import { specMarkType } from './freeze';
import type { ResolvedPlayback } from './options';
import {
  buildFrameOverlays,
  decideLabelSides,
  type FrameOverlays,
  type OverlayPlan,
  type PeriodLabelKind,
  type PeriodLabelPlacement,
  periodLabelPlacement,
} from './overlays';
import { formatPeriodLabels } from './period-labels';

/** Fewer periods with values than this and the chart renders static (RFC 2.7). */
const MIN_PLAYBACK_PERIODS = 2;

/** Smallest font a corner period label shrinks to while looking for room beside the marks. */
const MIN_CORNER_FONT_SIZE = 20;
/** Font size step, in px, while shrinking a corner label. */
const CORNER_FONT_STEP = 2;
/** Height of a run of digits as a share of the font size: cap height plus a little air. */
const DIGIT_HEIGHT_SHARE = 0.8;

/** An axis-aligned box in plot pixels. */
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Where a bar and its visible value label sit; other marks have no box to keep clear of. */
function markBoxes(mark: Mark): Box[] {
  if (mark.type !== 'rect') return [];
  const boxes = [
    { left: mark.x, right: mark.x + mark.width, top: mark.y, bottom: mark.y + mark.height },
  ];
  const label = mark.label;
  if (!label?.visible) return boxes;
  const { fontSize, fontWeight, textAnchor, dominantBaseline } = label.style;
  const width = estimateTextWidth(label.text, fontSize, fontWeight);
  const left =
    textAnchor === 'end'
      ? label.x - width
      : textAnchor === 'middle'
        ? label.x - width / 2
        : label.x;
  const top = dominantBaseline === 'central' ? label.y - fontSize / 2 : label.y - fontSize;
  boxes.push({ left, right: left + width, top, bottom: top + fontSize });
  return boxes;
}

/** The box a corner period label reading the widest of `texts` covers at `fontSize`. */
function cornerLabelBox(
  placement: PeriodLabelPlacement,
  texts: string[],
  fontSize: number,
  theme: ResolvedTheme,
): Box {
  const weight = theme.fonts.weights.bold;
  const width = Math.max(...texts.map((text) => estimateTextWidth(text, fontSize, weight)));
  const height = fontSize * DIGIT_HEIGHT_SHARE;
  const left = placement.textAnchor === 'end' ? placement.x - width : placement.x;
  const top = placement.dominantBaseline === 'hanging' ? placement.y : placement.y - height;
  return { left, right: left + width, top, bottom: top + height };
}

/**
 * A corner placement shrunk until its label clears every bar and value label at every
 * period, so the run never draws a mark over it. A centered label sits behind the marks by
 * design and is left alone. When no size down to `MIN_CORNER_FONT_SIZE` clears them, the
 * smallest is kept: it still paints behind the marks and stays faint.
 */
function fitCornerPlacement(
  placement: PeriodLabelPlacement,
  texts: string[],
  theme: ResolvedTheme,
  frames: Iterable<FrameMark[]>,
): PeriodLabelPlacement {
  if (placement.textAnchor === 'middle' || texts.length === 0) return placement;
  const obstacles = [...frames].flatMap((frame) => frame.flatMap(({ mark }) => markBoxes(mark)));
  for (let size = placement.fontSize; size > MIN_CORNER_FONT_SIZE; size -= CORNER_FONT_STEP) {
    const box = cornerLabelBox(placement, texts, size, theme);
    if (!obstacles.some((obstacle) => overlaps(box, obstacle)))
      return { ...placement, fontSize: size };
  }
  return { ...placement, fontSize: Math.min(placement.fontSize, MIN_CORNER_FONT_SIZE) };
}

/** What the overlay plan reads from the compiled playback. */
export interface OverlayPlanInput {
  /** The authored spec after sugar expansion. */
  source: ChartSpec;
  frame: FrozenChartFrame;
  timing: ResolvedPlayback;
  sampler: FrameSampler;
  /** Matrix key indexes in base order. */
  order: number[];
  time: EncodingChannel;
  marksAt(t: number): FrameMark[];
}

/** Whether at least two periods have a drawn key, so the run has periods worth labelling. */
function hasPlayablePeriods(sampler: FrameSampler, order: number[]): boolean {
  let withValues = 0;
  for (let period = 0; period < sampler.matrix.periods.length; period++) {
    if (order.some((keyIndex) => sampler.isPresent(keyIndex, period))) withValues++;
    if (withValues >= MIN_PLAYBACK_PERIODS) return true;
  }
  return false;
}

/**
 * What `auto` places the period label for: a mirrored bar chart is a pyramid, which keeps
 * the upper right corner clear; plain bars and points take it centered behind the marks.
 */
function periodLabelKind(source: ChartSpec, frame: FrozenChartFrame): PeriodLabelKind {
  const mirrored = specMarkType(source) === 'bar' && frame.spec.markDef.mirror === true;
  return mirrored ? 'pyramid' : 'scatter';
}

/** The marks at every period of the run, for decisions that must hold across all of them. */
function* periodFrames(marksAt: (t: number) => FrameMark[], periodCount: number) {
  for (let period = 0; period < periodCount; period++) yield marksAt(period);
}

/** Period label text per period, or null when the run shows no period label. */
function periodTexts(input: OverlayPlanInput): string[] | null {
  const { period } = input.timing;
  if (period === false || !hasPlayablePeriods(input.sampler, input.order)) return null;
  const time = period.format ? { ...input.time, format: period.format } : input.time;
  return formatPeriodLabels(input.sampler.matrix.periods, time);
}

/**
 * Period label text and placement, and each name label's side, fixed for the run. A run
 * without two playable periods renders as a static chart, which shows no period label.
 */
export function planOverlays(input: OverlayPlanInput): OverlayPlan {
  const { source, frame, timing } = input;
  const texts = periodTexts(input);
  const periodCount = input.sampler.matrix.periods.length;
  const placement = periodLabelPlacement(
    timing.period === false ? 'auto' : timing.period.position,
    frame.chartArea,
    periodLabelKind(source, frame),
  );
  return {
    periodTexts: texts,
    placement: fitCornerPlacement(
      placement,
      texts ?? [],
      frame.theme,
      periodFrames(input.marksAt, periodCount),
    ),
    labelSides: decideLabelSides(
      source.playback?.labels ?? [],
      periodFrames(input.marksAt, periodCount),
      frame.theme,
      frame.chartArea,
    ),
    theme: frame.theme,
  };
}

/**
 * The overlays at a playhead, from a plan fixed for the run. The period label shows the
 * period the playhead has reached, like the controls and period events.
 */
export function createOverlaysAt(input: OverlayPlanInput): (t: number) => FrameOverlays {
  const plan = planOverlays(input);
  const finalPeriod = input.sampler.matrix.periods.length - 1;
  return (t) =>
    buildFrameOverlays(plan, input.marksAt(t), Math.min(finalPeriod, Math.max(0, Math.floor(t))));
}
