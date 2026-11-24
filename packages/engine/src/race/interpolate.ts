function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction;
}

/**
 * Interpolate from a period to the next period or a specified endpoint across a gap.
 * A zero fraction reads the starting value. Interpolation needs two finite endpoints.
 */
export function interpolateRaceValue(
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
