/**
 * Time unit transform: extracts temporal components from date fields.
 *
 * Follows Vega-Lite time unit conventions.
 */

import type { DataRow, TimeUnit, TimeUnitTransform } from '@opendata-ai/openchart-core';

/**
 * Extract a time unit value from a Date object.
 */
function extractTimeUnit(date: Date, unit: TimeUnit): number | string {
  switch (unit) {
    case 'year':
      return date.getFullYear();
    case 'quarter':
      return Math.floor(date.getMonth() / 3) + 1;
    case 'month':
      return date.getMonth(); // 0-indexed like JS Date
    case 'week': {
      // ISO week number
      const d = new Date(date.getTime());
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }
    case 'day':
      return date.getDay(); // 0 = Sunday
    case 'dayofyear': {
      const start = new Date(date.getFullYear(), 0, 0);
      const diff = date.getTime() - start.getTime();
      return Math.floor(diff / 86400000);
    }
    case 'date':
      return date.getDate(); // 1-31
    case 'hours':
      return date.getHours();
    case 'minutes':
      return date.getMinutes();
    case 'seconds':
      return date.getSeconds();
    case 'milliseconds':
      return date.getMilliseconds();
    // Compound units
    case 'yearmonth':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'yearmonthdate':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    case 'monthdate':
      return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    case 'hoursminutes':
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Parse a value into a Date object.
 * Handles Date objects, ISO strings, and numeric timestamps.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Apply a time unit transform to data rows.
 *
 * Parses the field as a date and extracts the specified time unit,
 * storing the result in a new field.
 *
 * @param data - Input rows.
 * @param transform - Time unit transform definition.
 * @returns New rows with the time unit field added.
 */
export function runTimeUnit(data: DataRow[], transform: TimeUnitTransform): DataRow[] {
  return data.map((row) => {
    const date = toDate(row[transform.field]);
    return {
      ...row,
      [transform.as]: date ? extractTimeUnit(date, transform.timeUnit) : null,
    };
  });
}
