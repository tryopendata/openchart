import type { DataRow, RaceEncoding } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';
import { RaceDataError } from './errors';
import { interpolateRaceValue } from './interpolate';
import type { RaceMatrix, ResolvedRaceOptions } from './types';

type Period = RaceMatrix['periods'][number];
type TimeEncoding = RaceEncoding['time'];
type Observation = { row: DataRow; value: number; count: number };

const ISO_TIME_WITHOUT_OFFSET = /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/i;

function readPeriod(raw: unknown, type: TimeEncoding['type']): Period | undefined {
  const value = raw instanceof Date && Number.isFinite(raw.getTime()) ? raw.toISOString() : raw;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  let sortKey = 0;
  if (type === 'temporal') {
    sortKey =
      typeof value === 'number'
        ? value
        : Date.parse(ISO_TIME_WITHOUT_OFFSET.test(value) ? `${value}Z` : value);
  } else if (type === 'quantitative') {
    sortKey = finiteNumber(value) ?? NaN;
  }
  if (Number.isFinite(sortKey)) return { value, sortKey };
}

function orderPeriods(periods: Period[], time: TimeEncoding): void {
  if (time.type === 'ordinal') {
    if (Array.isArray(time.sort)) {
      const positions = new Map([...new Set(time.sort)].map((value, index) => [value, index]));
      const order = (period: Period) => positions.get(String(period.value)) ?? positions.size;
      periods.sort((a, b) => order(a) - order(b));
    }
    periods.forEach((period, index) => {
      period.sortKey = index;
    });
  } else {
    if (time.type === 'temporal' && periods.some(({ value }) => typeof value === 'string')) {
      for (const period of periods) {
        if (typeof period.value === 'number') period.sortKey = Date.UTC(period.value, 0, 1);
      }
    }
    periods.sort((a, b) => a.sortKey - b.sortKey);
  }
}

function fillInteriorGaps(values: Float64Array, gaps: ResolvedRaceOptions['gaps']): void {
  if (gaps === 'drop') return;

  let previous = -1;
  for (let period = 0; period < values.length; period++) {
    if (Number.isNaN(values[period])) continue;
    if (previous >= 0) {
      for (let gap = previous + 1; gap < period; gap++) {
        values[gap] =
          gaps === 'hold'
            ? values[previous]
            : interpolateRaceValue(
                values,
                previous,
                (gap - previous) / (period - previous),
                period,
              );
      }
    }
    previous = period;
  }
}

/**
 * Pivots long rows into a dense matrix with interpolate, hold, or drop applied to interior gaps.
 * Quantitative periods sort numerically. Temporal periods sort by year when all are numeric,
 * or by epoch milliseconds when any is a date. Ordinals follow a sort array or first-seen order.
 * Warns about skipped rows, non-finite values, and more than 500 distinct keys.
 *
 * @throws {RaceDataError} DUPLICATE_KEY_PERIOD, TOO_FEW_PERIODS, NO_VALUES
 */
export function buildRaceMatrix(
  rows: DataRow[],
  encoding: RaceEncoding,
  gaps: ResolvedRaceOptions['gaps'],
  warn: (message: string) => void,
): RaceMatrix {
  const { time, key, value, label, color } = encoding;
  const timeType = time.type ?? 'temporal';
  const periodsByValue = new Map<string | number, Period>();
  const rowsByKey = new Map<string, Map<Period, Observation>>();
  let firstCollision: { key: string; period: Period; entry: Observation } | undefined;
  let skippedCount = 0;
  let invalidPeriodCount = 0;
  let firstSkipped: string | undefined;
  let nonFiniteCount = 0;

  for (const row of rows) {
    const raw = row[value.field];
    const number = finiteNumber(raw);
    if (number === undefined && raw != null) nonFiniteCount++;

    const rawPeriod = row[time.field];
    const rawKey = row[key.field];
    const parsedPeriod = readPeriod(rawPeriod, timeType);
    if (!parsedPeriod || rawKey == null) {
      skippedCount++;
      if (!parsedPeriod) invalidPeriodCount++;
      firstSkipped ??= !parsedPeriod
        ? `'${time.field}' has an invalid ${timeType} period '${String(rawPeriod)}'`
        : `'${key.field}' has a missing key '${String(rawKey)}'`;
      continue;
    }
    const period = periodsByValue.get(parsedPeriod.value) ?? parsedPeriod;
    periodsByValue.set(period.value, period);

    const keyValue = String(rawKey);
    let keyRows = rowsByKey.get(keyValue);
    if (!keyRows) {
      keyRows = new Map();
      rowsByKey.set(keyValue, keyRows);
    }
    const entry = keyRows.get(period);
    if (entry) {
      entry.count++;
      firstCollision ??= { key: keyValue, period, entry };
    } else {
      keyRows.set(period, { row, value: number ?? NaN, count: 1 });
    }
  }

  if (firstSkipped) {
    const rowsLabel = skippedCount === 1 ? 'row' : 'rows';
    warn(`Skipped ${skippedCount} ${rowsLabel}. In the first skipped row, ${firstSkipped}.`);
  }

  if (firstCollision) {
    const { key: keyValue, period, entry } = firstCollision;
    throw new RaceDataError(
      'DUPLICATE_KEY_PERIOD',
      `${entry.count} rows have ${key.field} = '${keyValue}' and ${time.field} = ${period.value}. Aggregate them first so each key has one value per period.`,
    );
  }

  const periods = [...periodsByValue.values()];
  if (periods.length < 2) {
    const suggestion =
      invalidPeriodCount > 0 && invalidPeriodCount === rows.length && timeType !== 'ordinal'
        ? " For category labels, set type: 'ordinal'."
        : '';
    throw new RaceDataError(
      'TOO_FEW_PERIODS',
      `${rows.length} rows contain ${periods.length} distinct periods in '${time.field}' (type '${timeType}'). Supply at least two periods.${suggestion}`,
    );
  }
  orderPeriods(periods, { ...time, type: timeType });

  const keys = [...rowsByKey.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  const labels: string[] = [];
  const colorValues: Array<string | null> = [];
  const colorField = color && 'field' in color ? color.field : undefined;
  let finiteCount = 0;
  const values = keys.map((keyValue) => {
    const keyRows = rowsByKey.get(keyValue);
    const series = new Float64Array(periods.length).fill(NaN);
    let displayLabel = keyValue;
    let colorValue: string | null = null;

    periods.forEach((period, index) => {
      const observation = keyRows?.get(period);
      if (!observation) return;
      const { row, value } = observation;
      series[index] = value;
      if (Number.isFinite(value)) finiteCount++;

      const rowLabel = label === undefined ? undefined : row[label.field];
      const rowColor = colorField === undefined ? undefined : row[colorField];
      if (rowLabel != null) displayLabel = String(rowLabel);
      if (rowColor != null) colorValue = String(rowColor);
    });

    fillInteriorGaps(series, gaps);
    labels.push(displayLabel);
    colorValues.push(colorValue);
    return series;
  });

  if (nonFiniteCount > 0) {
    warn(`Dropped ${nonFiniteCount} non-finite values from '${value.field}'.`);
  }
  if (keys.length > 500) {
    warn(
      `${keys.length} distinct keys in '${key.field}' can slow race rank precomputation. Filter to the keys that can reach the top N, or aggregate the rest into an "Other" key.`,
    );
  }
  if (finiteCount === 0) {
    throw new RaceDataError(
      'NO_VALUES',
      `${rows.length} rows contain no finite values in '${value.field}' across ${periods.length} periods. Supply a finite number for at least one key and period.`,
    );
  }

  return { periods, keys, labels, colorValues, values };
}
