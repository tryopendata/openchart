/**
 * One map layer's rows (the choropleth or the points) pivoted into the playback matrix, and
 * the row sets a map compile reads back out of it: one period's rows, every key held at a
 * playhead, and every present cell at once for the frozen scales.
 */
import type { DataRow } from '@opendata-ai/openchart-core';
import { createFrameSampler, type FrameSampler, type KeyState } from './frame-sampler';
import { buildPlaybackMatrix, type PlaybackChannel, type PlaybackGaps } from './matrix';
import { type PlaybackTimeEncoding, readPeriod } from './periods';

/** What one layer pivots on. */
export interface MapSeriesOptions {
  /** Identity field: the join key, the state code or `points.key`. */
  identity: string;
  time: PlaybackTimeEncoding & { type: NonNullable<PlaybackTimeEncoding['type']> };
  channels: PlaybackChannel[];
  /** Noun for the many-keys warning, e.g. `features`. */
  noun: string;
}

/** One layer's gap-filled matrix plus the source rows behind each cell. */
export interface MapSeries {
  options: MapSeriesOptions;
  sampler: FrameSampler;
  /** Matrix key index by key. */
  keyIndex: Map<string, number>;
  /** Per key and period: the source row, when one was observed there. */
  sourceRows: Array<Array<DataRow | undefined>>;
}

/** Identity value no data row carries; seed rows use it to share another layer's periods. */
const SEED_KEY = '\u0000oc-period-seed';

/** Rows that only name periods, so this layer's period list matches another layer's. */
function periodSeedRows(options: MapSeriesOptions, periodValues: unknown[]): DataRow[] {
  return periodValues.map((value) => ({
    [options.identity]: SEED_KEY,
    [options.time.field]: value,
  }));
}

function indexSourceRows(
  rows: DataRow[],
  options: MapSeriesOptions,
  sampler: FrameSampler,
): Array<Array<DataRow | undefined>> {
  const { matrix } = sampler;
  const periodIndex = new Map(matrix.periods.map((period, index) => [period.value, index]));
  const keyIndex = new Map(matrix.keys.map((key, index) => [key, index]));
  const table = matrix.keys.map(() => new Array<DataRow | undefined>(matrix.periods.length));
  for (const row of rows) {
    const period = readPeriod(row[options.time.field], options.time.type);
    const key = keyIndex.get(String(row[options.identity]));
    const index = period ? periodIndex.get(period.value) : undefined;
    if (key !== undefined && index !== undefined) table[key][index] = row;
  }
  return table;
}

/**
 * Pivot one layer's rows. `sharedPeriods` are raw time values from another layer, added as
 * empty periods so both layers index the same period list.
 *
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 */
export function pivotMapSeries(
  rows: DataRow[],
  options: MapSeriesOptions,
  gaps: PlaybackGaps,
  warn: (message: string) => void,
  sharedPeriods: unknown[] = [],
): MapSeries {
  const seeded = [...rows, ...periodSeedRows(options, sharedPeriods)];
  const observed = buildPlaybackMatrix(
    seeded,
    {
      identity: options.identity,
      time: options.time,
      channels: options.channels,
      noun: options.noun,
    },
    'drop',
    warn,
  );
  const sampler = createFrameSampler(observed, options.channels, gaps);
  const keyIndex = new Map<string, number>();
  sampler.matrix.keys.forEach((key, index) => {
    if (key !== SEED_KEY) keyIndex.set(key, index);
  });
  return { options, sampler, keyIndex, sourceRows: indexSourceRows(seeded, options, sampler) };
}

/** The source row nearest `period` for a key: observed there, else the closest observed one. */
export function contextRow(series: MapSeries, keyIndex: number, period: number): DataRow {
  const rows = series.sourceRows[keyIndex];
  for (let distance = 0; distance < rows.length; distance++) {
    const row = rows[period - distance] ?? rows[period + distance];
    if (row) return row;
  }
  return {};
}

/** A key's row at a playhead: its nearest source row with each channel's value at `t`. */
function rowFor(series: MapSeries, keyIndex: number, t: number, state: KeyState): DataRow {
  const row: DataRow = {
    ...contextRow(series, keyIndex, series.sampler.nearestPeriod(t)),
    [series.options.identity]: series.sampler.matrix.keys[keyIndex],
  };
  series.options.channels.forEach(({ field }, channel) => {
    const value = state.values[channel];
    row[field] = Number.isFinite(value) ? value : null;
  });
  return row;
}

/**
 * Presence at or above which a key counts as shown in a static frame. At whole periods
 * presence is 0 or 1; mid-fade frames switch halfway through the fade.
 */
export const SHOWN_PRESENCE = 0.5;

/** Every ever-present key's row at `t`. `shownOnly` drops keys that are faded out. */
export function rowsAtPlayhead(series: MapSeries, t: number, shownOnly: boolean): DataRow[] {
  const rows: DataRow[] = [];
  for (const keyIndex of series.keyIndex.values()) {
    if (!series.sampler.everPresent(keyIndex)) continue;
    const state = series.sampler.stateAt(keyIndex, t);
    if (shownOnly && state.presence < SHOWN_PRESENCE) continue;
    rows.push(rowFor(series, keyIndex, t, state));
  }
  return rows;
}

/** Every present, gap-filled cell as a row: what the frozen scales and legends read. */
export function everyPeriodRows(series: MapSeries): DataRow[] {
  const { sampler } = series;
  const rows: DataRow[] = [];
  for (const keyIndex of series.keyIndex.values()) {
    for (let period = 0; period < sampler.matrix.periods.length; period++) {
      if (!sampler.isPresent(keyIndex, period)) continue;
      rows.push(rowFor(series, keyIndex, period, sampler.stateAt(keyIndex, period)));
    }
  }
  return rows;
}

/** Whether some ever-present key lacks a value in some period. */
export function hasMissingCell(series: MapSeries): boolean {
  const { sampler } = series;
  for (const keyIndex of series.keyIndex.values()) {
    if (!sampler.everPresent(keyIndex)) continue;
    for (let period = 0; period < sampler.matrix.periods.length; period++) {
      if (!sampler.isPresent(keyIndex, period)) return true;
    }
  }
  return false;
}

/** The distinct raw time values in `rows`, for seeding another layer's periods. */
export function rawPeriodValues(rows: DataRow[], timeField: string): unknown[] {
  return [...new Set(rows.map((row) => row[timeField]).filter((value) => value != null))];
}
