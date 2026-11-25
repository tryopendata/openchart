/** Display labels for the matrix's periods: the readout under the controls and the big period label. */
import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { utcFormat } from 'd3-time-format';
import { resolveFieldFormatter } from '../format/field-format';
import type { PlaybackPeriod } from './periods';

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

function isPlainYear({ value, sortKey }: PlaybackPeriod): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_YEAR &&
    value <= MAX_YEAR &&
    sortKey === value
  );
}

function formatTemporalLabels(periods: PlaybackPeriod[], format: string | undefined): string[] {
  const dates = periods.map((period) => {
    const year = isPlainYear(period);
    return {
      value: period.value,
      year,
      date: new Date(year ? Date.UTC(Number(period.value), 0, 1) : period.sortKey),
    };
  });
  const allFirstOfMonth = dates.every(({ date }) => date.getUTCDate() === 1);
  const allJanuary = dates.every(({ date }) => date.getUTCMonth() === 0);
  const formatDate = utcFormat(
    format ?? (allFirstOfMonth ? (allJanuary ? '%Y' : '%b %Y') : '%b %-d, %Y'),
  );
  return dates.map(({ value, year, date }) =>
    year && format === undefined ? String(value) : formatDate(date),
  );
}

/**
 * Formats temporal periods from the matrix's UTC sort keys. A four-digit integer
 * equal to its sort key prints as a year by default and uses January 1 for explicit formats.
 * Automatic labels use years if all dates are January 1, months if all dates are
 * the first of a month, and days otherwise.
 */
export function formatPeriodLabels(periods: PlaybackPeriod[], time: EncodingChannel): string[] {
  if (time.type === 'temporal') return formatTemporalLabels(periods, time.format);

  if (time.type === 'quantitative' && time.format) {
    const format = resolveFieldFormatter({
      channelFormat: time.format,
      values: periods.map(({ value }) => value),
    });
    return periods.map(({ value }) => format(Number(value)));
  }

  return periods.map(({ value }) => String(value));
}
