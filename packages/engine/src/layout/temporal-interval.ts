import type { DataRow, EncodingChannel } from '@opendata-ai/openchart-core';
import {
  timeDay,
  timeMonth,
  timeWeek,
  timeYear,
  utcDay,
  utcMonth,
  utcWeek,
  utcYear,
} from 'd3-time';

export type TemporalInterval = NonNullable<EncodingChannel['interval']>;
export interface ResolvedTemporalInterval {
  value: TemporalInterval;
  offset(date: Date): Date;
  warnings: string[];
}

/** Use the same date parsing as temporal scales. */
export function temporalDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

/** Calendar intervals follow the position scale's UTC/local interpretation. */
export function resolveTemporalInterval(
  channel: EncodingChannel,
  data: DataRow[],
  mode: 'utc' | 'time',
): ResolvedTemporalInterval {
  const times = [
    ...new Set(data.map((row) => +temporalDate(row[channel.field])).filter(Number.isFinite)),
  ].sort((a, b) => a - b);
  const differences = times.slice(1).map((time, i) => time - times[i]);
  const value =
    channel.interval ??
    (differences.length
      ? differences.reduce((smallest, difference) => Math.min(smallest, difference), Infinity)
      : 86400000);
  const warnings: string[] = [];
  const calendar =
    mode === 'utc'
      ? { day: utcDay, week: utcWeek, month: utcMonth, quarter: utcMonth, year: utcYear }
      : { day: timeDay, week: timeWeek, month: timeMonth, quarter: timeMonth, year: timeYear };
  const step = value === 'quarter' ? 3 : 1;
  const offset = (date: Date, count = 1): Date =>
    typeof value === 'number'
      ? new Date(+date + value * count)
      : calendar[value].offset(date, step * count);
  const aligned = times.slice(1).every((time, i) => {
    const previous = times[i];
    if (typeof value === 'number') {
      const ratio = (time - previous) / value;
      return Math.abs(ratio - Math.round(ratio)) < 1e-7;
    }
    const count = calendar[value].count(new Date(previous), new Date(time)) / step;
    return Number.isInteger(count) && +offset(new Date(previous), count) === time;
  });
  if (!aligned)
    warnings.push(
      `[openchart] encoding.${channel.field}.interval ${channel.interval === undefined ? 'was inferred as' : 'is'} ${value}; temporal observations are not all multiples of this interval.`,
    );
  if (!differences.length && channel.interval === undefined)
    warnings.push(
      `[openchart] Cannot infer a temporal interval for "${channel.field}" from fewer than two distinct dates; using one day.`,
    );
  return { value, offset, warnings };
}
