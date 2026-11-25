/**
 * Reading raw time values into periods and putting the distinct periods in playback order.
 */
import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';

/** How a time channel's values are read and ordered. */
export type PlaybackTimeType = 'temporal' | 'ordinal' | 'quantitative';

/** One distinct period. Dates become ISO strings; `sortKey` orders the periods. */
export interface PlaybackPeriod {
  value: string | number;
  sortKey: number;
}

/** The parts of a time channel that period reading and ordering use. */
export interface PlaybackTimeEncoding {
  /** Field holding the period value. */
  field: string;
  /** Defaults to `temporal` where a caller omits it. */
  type?: PlaybackTimeType;
  /** Ordinal order: a sort array, `descending` (reverse first-seen order), or first-seen order. */
  sort?: EncodingChannel['sort'];
  /** Period label format. */
  format?: string;
}

const ISO_TIME_WITHOUT_OFFSET = /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/i;

function temporalSortKey(value: string | number): number {
  if (typeof value === 'number') return value;
  return Date.parse(ISO_TIME_WITHOUT_OFFSET.test(value) ? `${value}Z` : value);
}

/**
 * Read one raw period value. Temporal values sort by year number or epoch milliseconds
 * (ISO times without an offset read as UTC), quantitative values numerically, and ordinal
 * values get a placeholder sort key that `orderPeriods` replaces.
 * Returns undefined when the value can't be a period of that type.
 */
export function readPeriod(raw: unknown, type: PlaybackTimeType): PlaybackPeriod | undefined {
  const value = raw instanceof Date && Number.isFinite(raw.getTime()) ? raw.toISOString() : raw;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  let sortKey = 0;
  if (type === 'temporal') sortKey = temporalSortKey(value);
  else if (type === 'quantitative') sortKey = finiteNumber(value) ?? NaN;
  return Number.isFinite(sortKey) ? { value, sortKey } : undefined;
}

function orderOrdinals(periods: PlaybackPeriod[], sort: EncodingChannel['sort']): void {
  if (Array.isArray(sort)) {
    const positions = new Map([...new Set(sort)].map((value, index) => [value, index]));
    const position = (period: PlaybackPeriod) =>
      positions.get(String(period.value)) ?? positions.size;
    periods.sort((a, b) => position(a) - position(b));
  } else if (sort === 'descending') {
    periods.reverse();
  }
  periods.forEach((period, index) => {
    period.sortKey = index;
  });
}

/**
 * Sort periods in place and assign final sort keys. Quantitative periods sort numerically.
 * Temporal periods sort by year when all are numeric, or by epoch milliseconds when any is a
 * date. Ordinals follow a sort array, reverse first-seen order for `descending`, or first-seen
 * order, and get their index as the sort key.
 */
export function orderPeriods(
  periods: PlaybackPeriod[],
  time: Pick<PlaybackTimeEncoding, 'sort'> & { type: PlaybackTimeType },
): void {
  if (time.type === 'ordinal') {
    orderOrdinals(periods, time.sort);
    return;
  }
  if (time.type === 'temporal' && periods.some(({ value }) => typeof value === 'string')) {
    for (const period of periods) {
      if (typeof period.value === 'number') period.sortKey = Date.UTC(period.value, 0, 1);
    }
  }
  periods.sort((a, b) => a.sortKey - b.sortKey);
}
