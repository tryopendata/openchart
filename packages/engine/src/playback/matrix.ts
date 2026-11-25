import type { DataRow } from '@opendata-ai/openchart-core';
import type { PlaybackPeriod, PlaybackTimeEncoding } from './periods';

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
}

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
  void rows;
  void options;
  void gaps;
  void warn;
  throw new Error('not implemented');
}
