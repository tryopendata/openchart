import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { utcFormat } from 'd3-time-format';
import { resolveFieldFormatter } from '../format/field-format';
import type { RaceMatrix } from './types';

/**
 * Formats temporal periods from the matrix's UTC sort keys. A four-digit integer
 * equal to its sort key prints as a year by default and uses January 1 for explicit formats.
 * Automatic labels use years if all dates are January 1, months if all dates are
 * the first of a month, and days otherwise.
 */
export function formatPeriodLabels(
  periods: RaceMatrix['periods'],
  time: EncodingChannel,
): string[] {
  if (time.type === 'temporal') {
    const dates = periods.map(({ value, sortKey }) => {
      const year =
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1000 &&
        value <= 9999 &&
        sortKey === value;
      return { value, year, date: new Date(year ? Date.UTC(value, 0, 1) : sortKey) };
    });
    const allFirstOfMonth = dates.every(({ date }) => date.getUTCDate() === 1);
    const allJanuary = dates.every(({ date }) => date.getUTCMonth() === 0);
    const format = utcFormat(
      time.format ?? (allFirstOfMonth ? (allJanuary ? '%Y' : '%b %Y') : '%b %-d, %Y'),
    );
    return dates.map(({ value, year, date }) =>
      year && time.format === undefined ? String(value) : format(date),
    );
  }

  if (time.type === 'quantitative' && time.format) {
    const format = resolveFieldFormatter({
      channelFormat: time.format,
      values: periods.map(({ value }) => value),
    });
    return periods.map(({ value }) => format(Number(value)));
  }

  return periods.map(({ value }) => String(value));
}
