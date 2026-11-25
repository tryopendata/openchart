/**
 * The playback matrix: long rows pivoted into keys x periods x channels, with the gap policy
 * applied, per-key static fields resolved, and data problems warned about or thrown.
 */
import type { DataRow } from '@opendata-ai/openchart-core';
import { PlaybackDataError } from './errors';
import { fillInteriorGaps } from './gaps';
import { collectObservations, type Observation, type ObservationTable } from './observations';
import { orderPeriods, type PlaybackPeriod, type PlaybackTimeEncoding } from './periods';

/** Interior gap policy. Leading and trailing gaps are never filled. */
export type PlaybackGaps = 'interpolate' | 'hold' | 'drop';

/** One numeric channel the frames read, named by the caller. */
export interface PlaybackChannel {
  /** Name the matrix keys this channel's values under, e.g. `x`, `y`, `size`, `value`. */
  name: string;
  /** Data field holding the channel's numbers. */
  field: string;
  /** Log-scale channel: interpolate fills geometrically and values <= 0 are absent. */
  log?: boolean;
}

/** What to pivot and how strictly to check it. */
export interface PlaybackMatrixOptions {
  /** Identity field. Its stringified value carries a mark from one period to the next. */
  identity: string;
  /** Time channel. `type` defaults to `temporal`. */
  time: PlaybackTimeEncoding;
  /** Numeric channels, one Float64Array per key each. */
  channels: PlaybackChannel[];
  /** Per-key fields that take the last non-null value in time (color category, label, nominal tooltips). */
  staticFields?: string[];
  /**
   * Throw `TOO_FEW_PERIODS` below two periods and `NO_VALUES` when no channel has a finite
   * value. The race passes true; charts and maps leave it off and warn instead.
   */
  requireTwoPeriods?: boolean;
  /** Noun for the 500-key warning, e.g. `bars`. Defaults to `keys`. */
  noun?: string;
  /** Replaces the advice after "N distinct <noun> in '<identity>'" in the 500-key warning. */
  manyKeysAdvice?: string;
}

/** The pivoted rows, ready for frames to read. */
export interface PlaybackMatrix {
  /** Sorted by `orderPeriods`. */
  periods: PlaybackPeriod[];
  /** Sorted by localeCompare with locale 'en'. */
  keys: string[];
  /** Per channel name: one array per key with one value per period. NaN represents absence. */
  values: Record<string, Float64Array[]>;
  /** Per key, in key order: each static field's last non-null value, absent when always null. */
  statics: Array<Record<string, unknown>>;
  /** Per channel name: how many values <= 0 a log channel treated as absent. Zero elsewhere. */
  nonPositiveCounts: Record<string, number>;
}

const MANY_KEYS_LIMIT = 500;

function throwOnCollision(table: ObservationTable, options: PlaybackMatrixOptions): void {
  const collision = table.firstCollision;
  if (!collision) return;
  const { key, period, observation } = collision;
  throw new PlaybackDataError(
    'DUPLICATE_KEY_PERIOD',
    `${observation.count} rows have ${options.identity} = '${key}' and ${options.time.field} = ${period.value}. Aggregate them first so each key has one value per period.`,
  );
}

function throwOnTooFewPeriods(
  table: ObservationTable,
  rowCount: number,
  time: PlaybackTimeEncoding,
): void {
  const periodCount = table.periods.length;
  if (periodCount >= 2) return;
  const timeType = time.type ?? 'temporal';
  const allPeriodsInvalid = table.invalidPeriodCount > 0 && table.invalidPeriodCount === rowCount;
  const suggestion =
    allPeriodsInvalid && timeType !== 'ordinal' ? " For category labels, set type: 'ordinal'." : '';
  throw new PlaybackDataError(
    'TOO_FEW_PERIODS',
    `${rowCount} rows contain ${periodCount} distinct periods in '${time.field}' (type '${timeType}'). Supply at least two periods.${suggestion}`,
  );
}

function lastStatics(
  observations: Map<PlaybackPeriod, Observation> | undefined,
  periods: PlaybackPeriod[],
  fields: string[],
): Record<string, unknown> {
  const statics: Record<string, unknown> = {};
  for (const period of periods) {
    const observation = observations?.get(period);
    for (const field of fields) {
      const value = observation?.row[field];
      if (value != null) statics[field] = value;
    }
  }
  return statics;
}

function pivotChannel(
  table: ObservationTable,
  keys: string[],
  channelIndex: number,
): Float64Array[] {
  return keys.map((key) => {
    const observations = table.byKey.get(key);
    return Float64Array.from(
      table.periods,
      (period) => observations?.get(period)?.values[channelIndex] ?? NaN,
    );
  });
}

function countFinite(series: Float64Array[]): number {
  let count = 0;
  for (const values of series) {
    for (const value of values) if (Number.isFinite(value)) count++;
  }
  return count;
}

function warnAboutValues(
  table: ObservationTable,
  options: PlaybackMatrixOptions,
  keyCount: number,
  warn: (message: string) => void,
): void {
  options.channels.forEach((channel, index) => {
    const count = table.nonFiniteCounts[index];
    if (count > 0) warn(`Dropped ${count} non-finite values from '${channel.field}'.`);
  });
  if (keyCount <= MANY_KEYS_LIMIT) return;
  const noun = options.noun ?? 'keys';
  const advice =
    options.manyKeysAdvice ??
    `can slow playback precomputation. Filter the data to the ${noun} you need.`;
  warn(`${keyCount} distinct ${noun} in '${options.identity}' ${advice}`);
}

function throwOnNoValues(
  rowCount: number,
  periodCount: number,
  options: PlaybackMatrixOptions,
): never {
  const fields = options.channels.map(({ field }) => `'${field}'`).join(', ');
  throw new PlaybackDataError(
    'NO_VALUES',
    `${rowCount} rows contain no finite values in ${fields} across ${periodCount} periods. Supply a finite number for at least one key and period.`,
  );
}

/**
 * Pivot long rows into a keys x periods x channels matrix with the gap policy applied to
 * interior gaps of each channel (geometrically on log channels). Warns about skipped rows,
 * non-finite values, and more than 500 distinct keys.
 *
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD, naming the identity value and period.
 * @throws {PlaybackDataError} TOO_FEW_PERIODS and NO_VALUES, only with `requireTwoPeriods`.
 */
export function buildPlaybackMatrix(
  rows: DataRow[],
  options: PlaybackMatrixOptions,
  gaps: PlaybackGaps,
  warn: (message: string) => void,
): PlaybackMatrix {
  const { time, channels, requireTwoPeriods = false } = options;
  const timeType = time.type ?? 'temporal';
  const table = collectObservations(rows, options, timeType);
  if (table.firstSkipped) {
    const rowsLabel = table.skippedCount === 1 ? 'row' : 'rows';
    warn(
      `Skipped ${table.skippedCount} ${rowsLabel}. In the first skipped row, ${table.firstSkipped}.`,
    );
  }
  throwOnCollision(table, options);
  if (requireTwoPeriods) throwOnTooFewPeriods(table, rows.length, time);
  const periods = table.periods;
  orderPeriods(periods, { sort: time.sort, type: timeType });

  const keys = [...table.byKey.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  const values: Record<string, Float64Array[]> = {};
  const nonPositiveCounts: Record<string, number> = {};
  let finiteCount = 0;
  channels.forEach((channel, index) => {
    const series = pivotChannel(table, keys, index);
    finiteCount += countFinite(series);
    for (const keyValues of series) fillInteriorGaps(keyValues, gaps, channel.log);
    values[channel.name] = series;
    nonPositiveCounts[channel.name] = table.nonPositiveCounts[index];
  });
  const statics = keys.map((key) =>
    lastStatics(table.byKey.get(key), periods, options.staticFields ?? []),
  );

  warnAboutValues(table, options, keys.length, warn);
  if (requireTwoPeriods && finiteCount === 0) throwOnNoValues(rows.length, periods.length, options);
  return { periods, keys, values, statics, nonPositiveCounts };
}
