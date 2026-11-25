/**
 * Value interpolation between two periods of one key's series, linear or in log space.
 * Playback frames and gap filling read in-between values through these functions.
 */

function lerp(from: number, to: number, fraction: number): number {
  const delta = to - from;
  // Opposite-signed finite endpoints can have an unrepresentable difference.
  return Number.isFinite(delta) ? from + delta * fraction : from * (1 - fraction) + to * fraction;
}

/**
 * Interpolate from a period to the next period or a specified endpoint across a gap.
 * A zero fraction reads the starting value. Interpolation needs two finite endpoints.
 */
export function interpolatePlaybackValue(
  values: Float64Array,
  periodIndex: number,
  fraction: number,
  nextPeriodIndex = periodIndex + 1,
): number {
  const from = values[periodIndex];
  if (!Number.isFinite(from)) return NaN;
  if (fraction === 0) return from;
  const to = values[nextPeriodIndex];
  return Number.isFinite(to) ? lerp(from, to, fraction) : NaN;
}

/**
 * Log-space variant of `interpolatePlaybackValue`: exp(lerp(log a, log b)), so the midpoint
 * of 1 and 100 is 10. Needs two finite, positive endpoints; otherwise returns NaN.
 */
export function interpolatePlaybackLogValue(
  values: Float64Array,
  periodIndex: number,
  fraction: number,
  nextPeriodIndex = periodIndex + 1,
): number {
  const from = values[periodIndex];
  if (!(Number.isFinite(from) && from > 0)) return NaN;
  if (fraction === 0) return from;
  const to = values[nextPeriodIndex];
  if (!(Number.isFinite(to) && to > 0)) return NaN;
  return Math.exp(lerp(Math.log(from), Math.log(to), fraction));
}
