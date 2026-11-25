/**
 * The first pass of the playback matrix: group long rows by identity and period, read each
 * channel's number, and tally what was skipped, duplicated or unusable for the warnings.
 */
import type { DataRow } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';
import type { PlaybackChannel, PlaybackMatrixOptions } from './matrix';
import { type PlaybackPeriod, type PlaybackTimeType, readPeriod } from './periods';

/** One row's reading for a key and period. `count` is how many rows claimed that cell. */
export interface Observation {
  row: DataRow;
  /** One value per channel, in channel order. NaN when absent. */
  values: number[];
  count: number;
}

/** Everything the first pass learned from the rows. */
export interface ObservationTable {
  /** Distinct periods in first-seen order. */
  periods: PlaybackPeriod[];
  /** Observations per identity value, per period. */
  byKey: Map<string, Map<PlaybackPeriod, Observation>>;
  /** The first key and period claimed by more than one row. */
  firstCollision?: { key: string; period: PlaybackPeriod; observation: Observation };
  skippedCount: number;
  invalidPeriodCount: number;
  /** Why the first skipped row was skipped, phrased to follow "In the first skipped row, ". */
  firstSkipped?: string;
  /** Per channel: values present but not finite. */
  nonFiniteCounts: number[];
  /** Per channel: values <= 0 that a log channel treated as absent. */
  nonPositiveCounts: number[];
}

function readChannelValues(
  row: DataRow,
  channels: PlaybackChannel[],
  table: ObservationTable,
): number[] {
  return channels.map((channel, index) => {
    const raw = row[channel.field];
    const value = finiteNumber(raw);
    if (value === undefined) {
      if (raw != null) table.nonFiniteCounts[index]++;
      return NaN;
    }
    if (channel.log && value <= 0) {
      table.nonPositiveCounts[index]++;
      return NaN;
    }
    return value;
  });
}

function recordObservation(
  table: ObservationTable,
  key: string,
  period: PlaybackPeriod,
  row: DataRow,
  values: number[],
): void {
  let keyRows = table.byKey.get(key);
  if (!keyRows) {
    keyRows = new Map();
    table.byKey.set(key, keyRows);
  }
  const existing = keyRows.get(period);
  if (!existing) {
    keyRows.set(period, { row, values, count: 1 });
    return;
  }
  existing.count++;
  table.firstCollision ??= { key, period, observation: existing };
}

/** Group rows into observations per key and period, skipping rows without a key or period. */
export function collectObservations(
  rows: DataRow[],
  options: PlaybackMatrixOptions,
  timeType: PlaybackTimeType,
): ObservationTable {
  const { identity, time, channels } = options;
  const table: ObservationTable = {
    periods: [],
    byKey: new Map(),
    skippedCount: 0,
    invalidPeriodCount: 0,
    nonFiniteCounts: channels.map(() => 0),
    nonPositiveCounts: channels.map(() => 0),
  };
  const periodsByValue = new Map<string | number, PlaybackPeriod>();

  for (const row of rows) {
    const values = readChannelValues(row, channels, table);
    const rawPeriod = row[time.field];
    const rawKey = row[identity];
    const parsedPeriod = readPeriod(rawPeriod, timeType);
    if (!parsedPeriod || rawKey == null) {
      table.skippedCount++;
      if (!parsedPeriod) table.invalidPeriodCount++;
      table.firstSkipped ??= !parsedPeriod
        ? `'${time.field}' has an invalid ${timeType} period '${String(rawPeriod)}'`
        : `'${identity}' has a missing key '${String(rawKey)}'`;
      continue;
    }

    let period = periodsByValue.get(parsedPeriod.value);
    if (!period) {
      period = parsedPeriod;
      periodsByValue.set(period.value, period);
      table.periods.push(period);
    }
    recordObservation(table, String(rawKey), period, row, values);
  }
  return table;
}
