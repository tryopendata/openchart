/**
 * The static compile of a chart with `encoding.time`: what `compileChart`, MCP renderers and
 * `renderStaticSVG` return for a playback spec.
 */
import type { ChartLayout, ChartSpec, CompileOptions, Mark } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from './compiler/types';
import { compilePaintedChartPlayback } from './playback/chart-playback';
import type { FrameMark } from './playback/chart-types';
import { isTrailMark, trailColorsByKey, trailMarks } from './playback/trail-marks';
import { computeTooltipDescriptors } from './tooltips/compute';

/** A frame mark as a static mark: absent keys dropped, fading ones at their faded opacity. */
function staticMark({ mark, presence }: FrameMark): Mark {
  if (presence >= 1 || mark.type !== 'point') return mark;
  return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
}

/** Frame marks still visible, as static marks. */
function staticMarks(frame: FrameMark[]): Mark[] {
  return frame.filter(({ presence }) => presence > 0).map(staticMark);
}

/** Tooltips for the data marks only; trail marks are decorative and get none. */
function dataTooltips(spec: NormalizedChartSpec, marks: Mark[]) {
  const descriptors = computeTooltipDescriptors(spec, marks);
  marks.forEach((mark, index) => {
    if (isTrailMark(mark)) descriptors.delete(`${mark.type}-${index}`);
  });
  return descriptors;
}

/**
 * Compile a time spec to the base layout with marks at one period: `options.playbackT`
 * when set, else the final period. Scales, axes and legend come from the frozen frame, so
 * they match every frame of the playback. Trails at that period paint first, then the period
 * label behind the marks, and name labels last, above them. Fewer than two periods renders the static chart of the
 * data present, with a warning.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 */
export function compileTimeChart(spec: ChartSpec, options: CompileOptions): ChartLayout {
  const { playback, frameMarksAt } = compilePaintedChartPlayback(spec, options);
  const t = options.playbackT ?? playback.periods.length - 1;
  const trails = trailMarks(playback.trailsAt(t), trailColorsByKey(playback.base));
  const marks = [...trails, ...staticMarks(frameMarksAt(t))];
  return {
    ...playback.base,
    marks,
    tooltipDescriptors: dataTooltips(playback.frame.spec, marks),
  };
}
