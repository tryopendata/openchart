/**
 * The static compile of a chart with `encoding.time`: what `compileChart`, MCP renderers and
 * `renderStaticSVG` return for a playback spec.
 */
import type { ChartLayout, ChartSpec, CompileOptions, Mark } from '@opendata-ai/openchart-core';
import { compileChartPlayback } from './playback/chart-playback';
import type { FrameMark } from './playback/chart-types';
import { computeTooltipDescriptors } from './tooltips/compute';

/** A frame mark as a static mark: absent keys dropped, fading ones at their faded opacity. */
function staticMark({ mark, presence }: FrameMark): Mark {
  if (presence >= 1 || mark.type !== 'point') return mark;
  return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
}

/**
 * Compile a time spec to the base layout with marks at one period: `options.playbackT`
 * when set, else the final period. Scales, axes and legend come from the frozen frame, so
 * they match every frame of the playback. Fewer than two periods renders the static chart
 * of the data present, with a warning.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 */
export function compileTimeChart(spec: ChartSpec, options: CompileOptions): ChartLayout {
  const playback = compileChartPlayback(spec, options);
  const t = options.playbackT ?? playback.periods.length - 1;
  const marks = playback
    .marksAt(t)
    .filter(({ presence }) => presence > 0)
    .map(staticMark);
  return {
    ...playback.base,
    marks,
    tooltipDescriptors: computeTooltipDescriptors(playback.frame.spec, marks),
  };
}
