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
  void values;
  void periodIndex;
  void fraction;
  void nextPeriodIndex;
  throw new Error('not implemented');
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
  void values;
  void periodIndex;
  void fraction;
  void nextPeriodIndex;
  throw new Error('not implemented');
}
