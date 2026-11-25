/** Scatter trails: each named key's path through its period positions up to the playhead. */
import type { ChartSpec, Point } from '@opendata-ai/openchart-core';
import type { FrozenChartFrame, TrailPath } from './chart-types';
import { interpolatePlaybackLogValue, interpolatePlaybackValue } from './interpolate';
import type { PlaybackMatrix } from './matrix';

/** `playback.trails` limit above which `true` warns that the chart will be crowded. */
const MANY_TRAILS_LIMIT = 30;

type PixelScale = (value: number) => number;

/** Frozen x and y scales as number-to-pixel functions, or null when either is missing. */
function pixelScales(frame: FrozenChartFrame) {
  const { x, y } = frame.scales;
  if (!(x && y)) return null;
  return {
    x: x.scale as unknown as PixelScale,
    y: y.scale as unknown as PixelScale,
    logX: x.type === 'log',
    logY: y.type === 'log',
  };
}

/** Pixel position for data values, or null when either is absent or off its scale. */
function toPixels(scales: NonNullable<ReturnType<typeof pixelScales>>, x: number, y: number) {
  if (!(Number.isFinite(x) && Number.isFinite(y))) return null;
  const point = { x: scales.x(x), y: scales.y(y) };
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

/** Every observed period position of one key from period 0 through `lastPeriod`. */
function observedPoints(
  scales: NonNullable<ReturnType<typeof pixelScales>>,
  xValues: Float64Array,
  yValues: Float64Array,
  lastPeriod: number,
): Point[] {
  const points: Point[] = [];
  for (let period = 0; period <= lastPeriod; period++) {
    const point = toPixels(scales, xValues[period], yValues[period]);
    if (point) points.push(point);
  }
  return points;
}

/** The key's position between periods `floor(t)` and the next, in log space on log axes. */
function headPosition(
  scales: NonNullable<ReturnType<typeof pixelScales>>,
  xValues: Float64Array,
  yValues: Float64Array,
  t: number,
): Point | null {
  const period = Math.floor(t);
  const fraction = t - period;
  const interpolateX = scales.logX ? interpolatePlaybackLogValue : interpolatePlaybackValue;
  const interpolateY = scales.logY ? interpolatePlaybackLogValue : interpolatePlaybackValue;
  return toPixels(
    scales,
    interpolateX(xValues, period, fraction),
    interpolateY(yValues, period, fraction),
  );
}

/**
 * Trails for `keys` at playhead `t`: the frozen-scale positions of every period up to
 * floor(t) where the key has x and y values, plus the interpolated head at `t`
 * (geometric on log channels). Reads the matrix's `x` and `y` channels. Keys missing from
 * the matrix or with no position at `t` are left out. When the head's period or the next
 * one has no value, the head holds at the last observed position.
 */
export function trailsAt(
  matrix: PlaybackMatrix,
  frame: FrozenChartFrame,
  keys: string[],
  t: number,
): TrailPath[] {
  const scales = pixelScales(frame);
  if (!scales || matrix.periods.length === 0) return [];
  const playhead = Math.min(Math.max(t, 0), matrix.periods.length - 1);
  const trails: TrailPath[] = [];
  for (const key of keys) {
    const index = matrix.keys.indexOf(key);
    if (index < 0) continue;
    const xValues = matrix.values.x[index];
    const yValues = matrix.values.y[index];
    const points = observedPoints(scales, xValues, yValues, Math.floor(playhead));
    const head = headPosition(scales, xValues, yValues, playhead) ?? points[points.length - 1];
    if (!head) continue;
    trails.push({ key, points, head });
  }
  return trails;
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
  if (!trails) return [];
  if (trails === true) {
    if (keys.length > MANY_TRAILS_LIMIT) {
      warn(
        `playback.trails: true draws ${keys.length} trails, which will be crowded. Name the keys to trace instead, e.g. trails: ["China", "India"].`,
      );
    }
    return keys;
  }
  const known = new Set(keys);
  return trails.filter((key) => known.has(key));
}
