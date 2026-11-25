import type { EncodingChannel } from '@opendata-ai/openchart-core';

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

/**
 * Read one raw period value. Temporal values sort by year number or epoch milliseconds
 * (ISO times without an offset read as UTC), quantitative values numerically, and ordinal
 * values get a placeholder sort key that `orderPeriods` replaces.
 * Returns undefined when the value can't be a period of that type.
 */
export function readPeriod(raw: unknown, type: PlaybackTimeType): PlaybackPeriod | undefined {
  void raw;
  void type;
  throw new Error('not implemented');
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
  void periods;
  void time;
  throw new Error('not implemented');
}
