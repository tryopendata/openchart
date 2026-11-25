/** Filling the interior gaps of one key's series under the playback gap policy. */
import { interpolatePlaybackLogValue, interpolatePlaybackValue } from './interpolate';
import type { PlaybackGaps } from './matrix';

/**
 * Fill absent values between two observed periods in place: `interpolate` lerps (in log
 * space when `log` is set), `hold` carries the earlier value, `drop` leaves them absent.
 * Leading and trailing gaps stay absent under every policy.
 */
export function fillInteriorGaps(values: Float64Array, gaps: PlaybackGaps, log = false): void {
  if (gaps === 'drop') return;
  const interpolate = log ? interpolatePlaybackLogValue : interpolatePlaybackValue;

  let previous = -1;
  for (let period = 0; period < values.length; period++) {
    if (Number.isNaN(values[period])) continue;
    for (let gap = previous + 1; previous >= 0 && gap < period; gap++) {
      values[gap] =
        gaps === 'hold'
          ? values[previous]
          : interpolate(values, previous, (gap - previous) / (period - previous), period);
    }
    previous = period;
  }
}
