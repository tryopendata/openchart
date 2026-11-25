/**
 * The frozen frame: the envelope spec (every present, gap-filled matrix cell across all
 * periods) compiled once, with the playback overrides of RFC section 3.2 applied.
 */
import type { ChartSpec, CompileOptions } from '@opendata-ai/openchart-core';
import type { FrozenChartFrame } from './chart-types';
import type { PlaybackMatrix } from './matrix';

/**
 * Build the envelope: `spec` with `data` replaced by one row per present, gap-filled cell
 * (statics attached, the time field set to the cell's period), `encoding.time` and
 * `playback` removed, and the playback overrides applied (no trendline).
 *
 * The matrix's channels are named after the encoding channels they feed (`x`, `y`, `size`
 * for points; `x` for horizontal bars), each reading that channel's field, and its
 * statics carry the color, key and other nominal fields.
 */
export function buildEnvelopeSpec(spec: ChartSpec, matrix: PlaybackMatrix): ChartSpec {
  void spec;
  void matrix;
  throw new Error('not implemented');
}

/**
 * Compile the envelope once at the given size and theme and keep what must stay still for
 * the run: layout without marks, scales, plot area, label plan, theme, the point opacity
 * for the largest per-period key count, and one formatter per field over all values.
 */
export function freezeChartFrame(
  spec: ChartSpec,
  options: CompileOptions,
  matrix: PlaybackMatrix,
): FrozenChartFrame {
  void spec;
  void options;
  void matrix;
  throw new Error('not implemented');
}
