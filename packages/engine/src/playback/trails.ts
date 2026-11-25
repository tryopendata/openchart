/** Scatter trails: each named key's path through its period positions up to the playhead. */
import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { FrozenChartFrame, TrailPath } from './chart-types';
import type { PlaybackMatrix } from './matrix';

/**
 * Trails for `keys` at playhead `t`: the frozen-scale positions of every period up to
 * floor(t) where the key has x and y values, plus the interpolated head at `t`
 * (geometric on log channels). Reads the matrix's `x` and `y` channels. Keys missing from
 * the matrix or with no position at `t` are left out.
 */
export function trailsAt(
  matrix: PlaybackMatrix,
  frame: FrozenChartFrame,
  keys: string[],
  t: number,
): TrailPath[] {
  void matrix;
  void frame;
  void keys;
  void t;
  throw new Error('not implemented');
}

/**
 * The keys `playback.trails` names: none for false or absent, every matrix key for true,
 * else the listed keys present in the matrix. Warns when `true` covers more than 30 keys.
 */
export function resolveTrailKeys(
  trails: NonNullable<ChartSpec['playback']>['trails'],
  keys: string[],
  warn: (message: string) => void,
): string[] {
  void trails;
  void keys;
  void warn;
  throw new Error('not implemented');
}
