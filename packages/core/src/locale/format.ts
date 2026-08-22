/**
 * Locale-aware number and date formatting utilities.
 *
 * Uses d3-format and d3-time-format for formatting,
 * with convenience wrappers for common patterns.
 */

import { format as d3Format } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';

// ---------------------------------------------------------------------------
// Cached d3-format instances
// ---------------------------------------------------------------------------

// Module-level caching assumes the d3-format/d3-time-format default locale;
// consumer `formatDefaultLocale()` calls are unsupported (verified: no
// callers of formatDefaultLocale exist in this codebase).
const FORMAT_INTEGER = d3Format(',');
const FORMAT_TINY = d3Format('.2~r');
const FORMAT_DECIMAL = d3Format(',.2f');
const FORMAT_ABBREV_MANTISSA = d3Format('.1~f');
const FORMAT_PERCENT_FRACTION = d3Format('.1~%');
const FORMAT_PERCENT_RAW = d3Format(',.1~f');
const FORMAT_CURRENCY_INTEGER = d3Format('$,');
const FORMAT_CURRENCY_DECIMAL = d3Format('$,.2f');
const FORMAT_STEP_FRACTION = [d3Format('.0~f'), d3Format('.1~f'), d3Format('.2~f')] as const;

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
  if (Number.isInteger(value)) {
    return FORMAT_INTEGER(value);
  }
  if (Math.abs(value) < 0.005) {
    return FORMAT_TINY(value);
  }
  return FORMAT_DECIMAL(value);
}

// ---------------------------------------------------------------------------
// Number abbreviation
// ---------------------------------------------------------------------------

const UNIT_TABLE: Array<{ threshold: number; suffix: string; divisor: number }> = [
  { threshold: 1_000_000_000_000, suffix: 'T', divisor: 1_000_000_000_000 },
  { threshold: 1_000_000_000, suffix: 'B', divisor: 1_000_000_000 },
  { threshold: 1_000_000, suffix: 'M', divisor: 1_000_000 },
  { threshold: 1_000, suffix: 'k', divisor: 1_000 },
];

function unitFor(abs: number): { suffix: string; divisor: number } {
  for (const entry of UNIT_TABLE) {
    if (abs >= entry.threshold) return entry;
  }
  return { suffix: '', divisor: 1 };
}

function fractionDigits(x: number): number {
  const a = Math.abs(x);
  for (let p = 0; p <= 3; p++) {
    const scaled = a * 10 ** p;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return p;
  }
  return 4;
}

export function abbreviateNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (let i = 0; i < UNIT_TABLE.length; i++) {
    const { threshold, suffix, divisor } = UNIT_TABLE[i];
    if (absValue >= threshold) {
      const mantissa = FORMAT_ABBREV_MANTISSA(absValue / divisor);
      // Roll-up: if mantissa rounds to 1000, use the next unit up.
      // When i === 0 (T), there's no larger unit so we emit "1000T".
      if (mantissa === '1000' && i > 0) {
        return `${sign}1${UNIT_TABLE[i - 1].suffix}`;
      }
      return `${sign}${mantissa}${suffix}`;
    }
  }

  return formatNumber(value);
}

// ---------------------------------------------------------------------------
// Ordinal formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as an English ordinal: 1 -> "1st", 2 -> "2nd", 3 -> "3rd",
 * 11 -> "11th", 22 -> "22nd". Values are rounded to the nearest integer first;
 * intended for rank axes where the domain is integer positions.
 */
export function formatOrdinal(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const n = Math.round(value);
  const abs = Math.abs(n);
  const rem100 = abs % 100;
  const rem10 = abs % 10;
  let suffix: string;
  if (rem100 >= 11 && rem100 <= 13) suffix = 'th';
  else if (rem10 === 1) suffix = 'st';
  else if (rem10 === 2) suffix = 'nd';
  else if (rem10 === 3) suffix = 'rd';
  else suffix = 'th';
  return `${n}${suffix}`;
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
 * Also accepts the OpenChart extension `'ordinal'`, which renders English
 * ordinals ("1st", "2nd", "3rd") for rank axes.
 *
 * Returns null if the format string is falsy or unparseable.
 */
export function buildD3Formatter(formatStr: string | undefined): ((v: number) => string) | null {
  if (!formatStr) return null;

  // OpenChart extension: rank-axis ordinals ("1st", "2nd", "3rd").
  if (formatStr === 'ordinal') return formatOrdinal;

  try {
    const fmt = d3Format(formatStr);
    // Replace SI prefix "G" (giga) with "B" (billion) for financial readability
    if (formatStr.includes('s')) {
      return (v: number) => fmt(v).replace(/G$/, 'B');
    }
    return fmt;
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
// Number formatter type + semantic formatters
// ---------------------------------------------------------------------------

export type NumberFormatter = (value: number) => string;

export function formatPercent(value: number, options?: { fraction?: boolean }): string {
  const fraction = options?.fraction ?? true;
  if (fraction) {
    return FORMAT_PERCENT_FRACTION(value);
  }
  return `${FORMAT_PERCENT_RAW(value)}%`;
}

export function formatCurrency(value: number, options?: { compact?: boolean }): string {
  const compact = options?.compact ?? false;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (compact) {
    if (abs >= 1000) {
      return `${sign}$${abbreviateNumber(abs)}`;
    }
    return `${sign}$${formatNumber(abs)}`;
  }
  if (Number.isInteger(value)) {
    return sign + FORMAT_CURRENCY_INTEGER(abs);
  }
  return sign + FORMAT_CURRENCY_DECIMAL(abs);
}

// ---------------------------------------------------------------------------
// Years guard
// ---------------------------------------------------------------------------

export function isYearLikeValues(values: readonly number[]): boolean {
  if (values.length === 0) return false;
  for (const v of values) {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 1500 || v > 2500) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Field format context
// ---------------------------------------------------------------------------

export interface FieldFormatContext {
  extent?: [number, number];
  allIntegers?: boolean;
  surface?: 'chart' | 'table';
  step?: number;
  stepReference?: number;
}

export function computeFieldFormatContext(
  values: Iterable<unknown>,
  surface?: 'chart' | 'table',
): FieldFormatContext {
  let min = Infinity;
  let max = -Infinity;
  let allIntegers = true;
  let hasFinite = false;

  for (const raw of values) {
    const v = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(v)) continue;
    hasFinite = true;
    if (v < min) min = v;
    if (v > max) max = v;
    if (allIntegers && !Number.isInteger(v)) allIntegers = false;
  }

  const ctx: FieldFormatContext = {};
  if (hasFinite) {
    ctx.extent = [min, max];
    ctx.allIntegers = allIntegers;
  }
  if (surface) ctx.surface = surface;
  return ctx;
}

export function isYearContext(ctx: FieldFormatContext | undefined): boolean {
  if (!ctx?.extent || !ctx.allIntegers) return false;
  const [min, max] = ctx.extent;
  return min >= 1500 && max <= 2500;
}

// ---------------------------------------------------------------------------
// Keyword-aware formatter resolution
// ---------------------------------------------------------------------------

export function resolveNumberFormatter(
  formatStr: string | undefined,
  ctx?: FieldFormatContext,
): NumberFormatter | null {
  if (!formatStr) return null;

  if (formatStr === 'ordinal') return formatOrdinal;

  if (formatStr === 'percent') {
    // Heuristic: if all values fit in [0,1] (maxAbs <= 1), treat them as
    // fractions (0.45 -> "45%"). Values > 1 are treated as pre-scaled
    // (45 -> "45%"). Datasets like [0, 0.5, 1.1] are ambiguous; the <= 1
    // threshold errs on the side of the most common convention (fractions).
    const fraction = ctx?.extent
      ? Math.max(Math.abs(ctx.extent[0]), Math.abs(ctx.extent[1])) <= 1
      : true;
    return (v: number) => formatPercent(v, { fraction });
  }

  if (formatStr === 'currency') {
    const isTable = ctx?.surface === 'table';
    if (!isTable && ctx?.step != null && (ctx.stepReference ?? 0) >= 1000) {
      const stepFmt = buildCompactStepFormatter(ctx.step);
      return (v: number) => {
        const sign = v < 0 ? '-' : '';
        return `${sign}$${stepFmt(Math.abs(v))}`;
      };
    }
    return (v: number) => formatCurrency(v, { compact: !isTable });
  }

  return buildD3Formatter(formatStr);
}

// ---------------------------------------------------------------------------
// Default number formatter
// ---------------------------------------------------------------------------

export function defaultNumberFormatter(ctx?: FieldFormatContext): NumberFormatter {
  if (isYearContext(ctx)) {
    return (v: number) => String(Math.round(v));
  }

  if (ctx?.surface === 'table') {
    return formatNumber;
  }

  if (ctx?.step != null && (ctx.stepReference ?? maxAbs(ctx.extent)) >= 1000) {
    return buildCompactStepFormatter(ctx.step);
  }

  return (v: number) => {
    if (!Number.isFinite(v)) return String(v);
    // When no context is provided (ARIA marks, standalone helpers) we
    // fall back to a per-value year heuristic: integers in [1500, 2500]
    // render bare. This trades false positives on non-year integers
    // (e.g. "connections: 2024") for avoiding "2k" on actual year axes.
    // Callers with field context should always pass it to get the
    // field-level isYearContext check instead.
    if (ctx?.extent === undefined && ctx?.allIntegers === undefined) {
      if (Number.isInteger(v) && v >= 1500 && v <= 2500) return String(v);
    }
    return Math.abs(v) >= 1000 ? abbreviateNumber(v) : formatNumber(v);
  };
}

function maxAbs(extent: [number, number] | undefined): number {
  if (!extent) return 0;
  return Math.max(Math.abs(extent[0]), Math.abs(extent[1]));
}

// ---------------------------------------------------------------------------
// Step-aware compact tick formatter
// ---------------------------------------------------------------------------

export function buildCompactStepFormatter(step: number): NumberFormatter {
  return (v: number) => {
    if (v === 0) return '0';
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs < 1000) return formatNumber(v);
    const { suffix, divisor } = unitFor(abs);
    const p = fractionDigits(step / divisor);
    if (p > 2) {
      return Number.isInteger(v) ? FORMAT_INTEGER(v) : FORMAT_DECIMAL(v);
    }
    const sign = v < 0 ? '-' : '';
    return sign + FORMAT_STEP_FRACTION[p](abs / divisor) + suffix;
  };
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
 * Compact format strings used by axis ticks when full-format labels overlap.
 * Month is bare '%b': granularity inference runs per tick, so year-boundary
 * ticks already render as '2025' and the axis reads "2025 · Feb · Mar".
 * Year stays '%Y' — abbreviating to "'25" saves too little for the ambiguity.
 */
const GRANULARITY_FORMATS_COMPACT: Record<DateGranularity, string> = {
  year: '%Y',
  quarter: '', // special-cased below, like GRANULARITY_FORMATS
  month: '%b',
  week: '%b %d',
  day: '%b %d',
  hour: '%H:%M',
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
 * @param compact - Use the compact format table (axis ticks whose full-format
 *   labels would overlap). Defaults to `false`.
 */
export function formatDate(
  value: Date | string | number,
  _locale?: string,
  granularity?: DateGranularity,
  useUtc: boolean = true,
  compact: boolean = false,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const gran = granularity ?? inferGranularity(date, useUtc);

  // Special handling for quarter (not a d3 format token)
  if (gran === 'quarter') {
    const q = useUtc
      ? Math.ceil((date.getUTCMonth() + 1) / 3)
      : Math.ceil((date.getMonth() + 1) / 3);
    const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
    if (compact) {
      return `Q${q} '${String(year).slice(-2)}`;
    }
    return `Q${q} ${year}`;
  }

  const formatStr = (compact ? GRANULARITY_FORMATS_COMPACT : GRANULARITY_FORMATS)[gran];
  if (useUtc) {
    return getUtcFormatter(formatStr)(date);
  }
  return getTimeFormatter(formatStr)(date);
}

// Compiled d3-time-format formatters, keyed by format string. The key space
// is bounded to the strings in GRANULARITY_FORMATS / GRANULARITY_FORMATS_COMPACT.
const TIME_FORMAT_CACHE = new Map<string, ReturnType<typeof timeFormat>>();
const UTC_FORMAT_CACHE = new Map<string, ReturnType<typeof utcFormat>>();

function getTimeFormatter(formatStr: string): ReturnType<typeof timeFormat> {
  let fmt = TIME_FORMAT_CACHE.get(formatStr);
  if (!fmt) {
    fmt = timeFormat(formatStr);
    TIME_FORMAT_CACHE.set(formatStr, fmt);
  }
  return fmt;
}

function getUtcFormatter(formatStr: string): ReturnType<typeof utcFormat> {
  let fmt = UTC_FORMAT_CACHE.get(formatStr);
  if (!fmt) {
    fmt = utcFormat(formatStr);
    UTC_FORMAT_CACHE.set(formatStr, fmt);
  }
  return fmt;
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
