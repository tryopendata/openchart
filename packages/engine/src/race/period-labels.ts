import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { utcFormat } from 'd3-time-format';
import { resolveFieldFormatter } from '../format/field-format';
import type { RaceMatrix } from './types';

export function formatPeriodLabels(
  periods: RaceMatrix['periods'],
  time: EncodingChannel,
): string[] {
  if (time.type === 'temporal') {
    const dates = periods.map(({ value }) => {
      const year =
        typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;
      // JavaScript treats ISO timestamps with no offset as local time.
      const utcValue =
        typeof value === 'string' && /T/i.test(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
          ? `${value}Z`
          : value;
      return { value, year, date: new Date(year ? Date.UTC(value, 0, 1) : utcValue) };
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
