/**
 * The static compile of a chart with `encoding.time`: what `compileChart`, MCP renderers and
 * `renderStaticSVG` return for a playback spec.
 */
import type { ChartLayout, ChartSpec, CompileOptions } from '@opendata-ai/openchart-core';

/**
 * Compile a time spec to the base layout with marks at one period: `options.playbackT`
 * when set, else the final period. Scales, axes and legend come from the frozen frame, so
 * they match every frame of the playback. Fewer than two periods renders the static chart
 * of the data present, with a warning.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 */
export function compileTimeChart(spec: ChartSpec, options: CompileOptions): ChartLayout {
  void spec;
  void options;
  throw new Error('not implemented');
}
