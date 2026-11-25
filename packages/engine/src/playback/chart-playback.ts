/**
 * Chart playback compile: matrix, frozen frame, base layout and the per-frame functions for
 * point, circle and bar charts with `encoding.time`.
 */
import type { ChartSpec, CompileOptions } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from './chart-types';

/**
 * Validate a time spec, pivot its rows into the playback matrix, freeze the frame and
 * return the base layout plus `marksAt`, `trailsAt`, `observedAt` and `describe`. Frames
 * call the registered chart renderer with the frozen scales, plot area and label plan; no
 * frame compiles. Warnings (RFC 2.7) go to `warnings` and to `options.onWarn`.
 *
 * @throws The validation error `compileChart` throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 */
export function compileChartPlayback(spec: ChartSpec, options: CompileOptions): ChartPlayback {
  void spec;
  void options;
  throw new Error('not implemented');
}
