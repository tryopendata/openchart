/**
 * Locale-aware number and date formatting utilities.
 *
 * Uses d3-format and d3-time-format for formatting,
 * with convenience wrappers for common patterns.
 */

import { format as d3Format } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number with locale-appropriate separators.
 *
 * Uses d3-format under the hood. Default format: comma-separated
 * with auto-precision (e.g. 1500000 -> "1,500,000").
 *
 * @param value - The number to format.
 * @param locale - Locale string (currently unused, reserved for i18n).
 */
export function formatNumber(value: number, _locale?: string): string {
  if (!Number.isFinite(value)) return String(value);
  // Auto-detect: use integer format for whole numbers, 2dp for decimals
  if (Number.isInteger(value)) {
    return d3Format(',')(value);
  }
  return d3Format(',.2f')(value);
}

// ---------------------------------------------------------------------------
// Number abbreviation
// ---------------------------------------------------------------------------

/** Suffixes for abbreviated numbers. */
const ABBREVIATIONS: Array<{ threshold: number; suffix: string; divisor: number }> = [
  { threshold: 1_000_000_000_000, suffix: 'T', divisor: 1_000_000_000_000 },
  { threshold: 1_000_000_000, suffix: 'B', divisor: 1_000_000_000 },
  { threshold: 1_000_000, suffix: 'M', divisor: 1_000_000 },
  { threshold: 1_000, suffix: 'K', divisor: 1_000 },
];

/**
 * Abbreviate a large number with a suffix.
 *
 * Examples:
 * - 1500000 -> "1.5M"
 * - 2300 -> "2.3K"
 * - 42 -> "42"
 * - 1000000000 -> "1B"
 */
export function abbreviateNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { threshold, suffix, divisor } of ABBREVIATIONS) {
    if (absValue >= threshold) {
      const abbreviated = absValue / divisor;
      // Use .1f precision, drop trailing .0
      const formatted = abbreviated % 1 === 0 ? String(abbreviated) : d3Format('.1f')(abbreviated);
      return `${sign}${formatted}${suffix}`;
    }
  }

  return formatNumber(value);
}

// ---------------------------------------------------------------------------
// d3-format with suffix support
// ---------------------------------------------------------------------------

/**
 * Regex that matches a valid d3-format specifier (with optional ~ trim flag)
 * followed by a literal suffix. The first capture group is the d3 format part,
 * the second is the trailing literal suffix (e.g. "T", "pp", etc.).
 *
 * Examples:
 * - "$,.2~fT"  -> ["$,.2~f", "T"]
 * - ".0f%"     -> [".0f", "%"]  (% here is literal, not d3 percent type)
 * - "$,.0f"    -> no match (valid d3 format, no suffix)
 */
const D3_FORMAT_SUFFIX_RE = /^(.*~?[efgsrdxXobcnp%])(.+)$/;

/**
 * Build a number formatter from a d3-format string, with support for a
 * trailing literal suffix that d3-format itself would reject.
 *
 * Returns null if the format string is falsy or unparseable.
 */
export function buildD3Formatter(formatStr: string | undefined): ((v: number) => string) | null {
  if (!formatStr) return null;

  try {
    return d3Format(formatStr);
  } catch {
    // If d3-format rejects it, try stripping a trailing literal suffix
    const m = formatStr.match(D3_FORMAT_SUFFIX_RE);
    if (m) {
      try {
        const fmt = d3Format(m[1]);
        const suffix = m[2];
        return (v: number) => fmt(v) + suffix;
      } catch {
        // Unparseable even after suffix stripping
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Granularity levels for date formatting. */
export type DateGranularity = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute';

/** Format strings for each granularity level. */
const GRANULARITY_FORMATS: Record<DateGranularity, string> = {
  year: '%Y',
  quarter: '', // Quarter is always special-cased in formatDate() below
  month: '%b %Y',
  week: '%b %d',
  day: '%b %d, %Y',
  hour: '%b %d %H:%M',
  minute: '%H:%M',
};

/**
 * Format a date value for display.
 *
 * @param value - Date object, ISO string, or timestamp number.
 * @param locale - Locale string (currently unused, reserved for i18n).
 * @param granularity - Time granularity for format selection.
 * @param useUtc - Whether to infer granularity and format using UTC methods.
 *   Pass `false` when formatting ticks from a local-time scale (d3 scaleTime),
 *   so that e.g. midnight local isn't misread as an intra-day UTC time.
 *   Defaults to `true` for backward compatibility.
 */
export function formatDate(
  value: Date | string | number,
  _locale?: string,
  granularity?: DateGranularity,
  useUtc: boolean = true,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const gran = granularity ?? inferGranularity(date, useUtc);

  // Special handling for quarter (not a d3 format token)
  if (gran === 'quarter') {
    const q = useUtc
      ? Math.ceil((date.getUTCMonth() + 1) / 3)
      : Math.ceil((date.getMonth() + 1) / 3);
    return `Q${q} ${date.getFullYear()}`;
  }

  const formatStr = GRANULARITY_FORMATS[gran];
  if (useUtc) {
    return utcFormat(formatStr)(date);
  }
  return timeFormat(formatStr)(date);
}

/**
 * Build a formatter for temporal values using a d3-time-format string (e.g. "%Y", "%b %Y").
 * Returns a function that accepts a Date, string, or number and returns the formatted string.
 * Returns null if the format string is falsy.
 */
export function buildTemporalFormatter(
  formatStr: string | undefined,
): ((value: Date | string | number) => string) | null {
  if (!formatStr) return null;
  const fmt = utcFormat(formatStr);
  return (value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return fmt(date);
  };
}

/**
 * Infer the appropriate granularity from a date value.
 * If time components are all zero, assume day or higher.
 *
 * @param useUtc - When true, inspect UTC fields. When false, inspect local-time
 *   fields. This must match the D3 scale type: scaleUtc -> true, scaleTime -> false.
 */
function inferGranularity(date: Date, useUtc: boolean = true): DateGranularity {
  const hours = useUtc ? date.getUTCHours() : date.getHours();
  const minutes = useUtc ? date.getUTCMinutes() : date.getMinutes();
  const day = useUtc ? date.getUTCDate() : date.getDate();
  const month = useUtc ? date.getUTCMonth() : date.getMonth();

  if (hours !== 0 || minutes !== 0) {
    return minutes !== 0 ? 'minute' : 'hour';
  }
  if (day !== 1) return 'day';
  if (month !== 0) return 'month';
  return 'year';
}
