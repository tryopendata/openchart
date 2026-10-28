import type { DataRow, EncodingChannel } from '@opendata-ai/openchart-core';
import { timeDay, timeMonth, timeWeek, utcDay, utcMonth, utcWeek } from 'd3-time';

export type TemporalInterval = NonNullable<EncodingChannel['interval']>;
export interface ResolvedTemporalInterval {
  value: TemporalInterval;
  offset(date: Date): Date;
  warnings: string[];
}

type CalendarUnit = Exclude<TemporalInterval, number>;
const MONTHS: Partial<Record<CalendarUnit, number>> = { month: 1, quarter: 3, year: 12 };
/** Largest first, so yearly data infers `year` rather than `month`. */
const INFERABLE_UNITS: CalendarUnit[] = ['year', 'quarter', 'month', 'week', 'day'];
const MIN_CALENDAR_DAY = 23 * 3600000;

/** Use the same date parsing as temporal scales. */
export function temporalDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function calendarFor(mode: 'utc' | 'time') {
  const day = mode === 'utc' ? utcDay : timeDay;
  const week = mode === 'utc' ? utcWeek : timeWeek;
  const month = mode === 'utc' ? utcMonth : timeMonth;

  /**
   * Month arithmetic that clamps to the target month's last day, so Jan 31
   * plus one month is Feb 28 rather than the Mar 3 that Date overflow gives.
   */
  const addMonths = (date: Date, months: number): Date => {
    const start = month.floor(date);
    const target = month.offset(start, months);
    const dayStart = day.floor(date);
    const lastDay = day.count(target, month.offset(target, 1)) - 1;
    const dayIndex = Math.min(day.count(start, dayStart), lastDay);
    return new Date(+day.offset(target, dayIndex) + (+date - +dayStart));
  };
  const isMonthEnd = (date: Date) =>
    +month.floor(day.offset(day.floor(date), 1)) !== +month.floor(date);

  const offset = (unit: CalendarUnit, date: Date, count: number): Date => {
    const months = MONTHS[unit];
    if (months) return addMonths(date, months * count);
    return (unit === 'week' ? week : day).offset(date, count);
  };
  /** Whole units between two dates, counted on calendar boundaries (DST-safe). */
  const count = (unit: CalendarUnit, from: Date, to: Date): number => {
    const months = MONTHS[unit];
    if (months) return month.count(from, to) / months;
    return (unit === 'week' ? week : day).count(from, to);
  };
  /**
   * Whether `time` sits a whole number of units after `anchor`. Month-based
   * units also accept a run of month-end dates (Jan 31, Feb 28, Mar 31).
   */
  const aligned = (unit: CalendarUnit, anchor: Date, time: Date): boolean => {
    const units = count(unit, anchor, time);
    if (!Number.isInteger(units)) return false;
    if (+offset(unit, anchor, units) === +time) return true;
    return (
      MONTHS[unit] !== undefined &&
      isMonthEnd(anchor) &&
      isMonthEnd(time) &&
      +anchor - +day.floor(anchor) === +time - +day.floor(time)
    );
  };
  return { offset, count, aligned };
}

/**
 * Infer the calendar unit whose single step is the smallest gap between
 * observations, when every observation is a whole number of those units
 * from its predecessor. Counting calendar boundaries keeps weekly data
 * crossing a DST change (a 7d-1h gap) and month-end runs on whole units.
 */
function inferCalendarUnit(
  times: number[],
  calendar: ReturnType<typeof calendarFor>,
): CalendarUnit | undefined {
  return INFERABLE_UNITS.find((unit) => {
    let smallest = Infinity;
    for (let i = 1; i < times.length; i++) {
      const previous = new Date(times[i - 1]);
      const time = new Date(times[i]);
      const units = calendar.count(unit, previous, time);
      if (units < 1 || !calendar.aligned(unit, previous, time)) return false;
      smallest = Math.min(smallest, units);
    }
    return smallest === 1;
  });
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
  const smallestDifference = differences.length
    ? differences.reduce((smallest, difference) => Math.min(smallest, difference), Infinity)
    : 86400000;
  const calendar = calendarFor(mode);
  const value: TemporalInterval =
    channel.interval ??
    (differences.length && smallestDifference >= MIN_CALENDAR_DAY
      ? inferCalendarUnit(times, calendar)
      : undefined) ??
    smallestDifference;
  const warnings: string[] = [];
  const offset = (date: Date): Date =>
    typeof value === 'number' ? new Date(+date + value) : calendar.offset(value, date, 1);
  const aligned = times.slice(1).every((time, i) => {
    const previous = times[i];
    if (typeof value === 'number') {
      const ratio = (time - previous) / value;
      return Math.abs(ratio - Math.round(ratio)) < 1e-7;
    }
    return calendar.aligned(value, new Date(previous), new Date(time));
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
